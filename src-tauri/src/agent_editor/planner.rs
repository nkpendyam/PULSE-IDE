//! Edit Planner - Plans file edits from natural language

use super::*;
use serde_json::Value;
use anyhow::{Result, Context};

/// Edit planner that parses LLM responses into actions
pub struct EditPlanner {
    max_actions: usize,
}

impl EditPlanner {
    pub fn new() -> Self {
        Self {
            max_actions: 20,
        }
    }

    /// Parse LLM response into execution plan
    pub fn parse_plan(&self, response: &str, context: &AgentContext) -> Result<ExecutionPlan> {
        // Try to extract JSON from response
        let json = self.extract_json(response)?;

        // Parse actions
        let actions = self.parse_actions(&json, context)?;

        // Calculate risk level
        let risk_level = self.assess_risk(&actions);

        // Determine if approval is needed
        let requires_approval = actions.iter().any(|a| {
            matches!(a.action_type, ActionType::WriteFile | ActionType::EditLines | ActionType::DeleteFile | ActionType::CreateFile)
        });

        Ok(ExecutionPlan {
            actions,
            estimated_time_ms: 1000, // Placeholder
            requires_approval,
            risk_level,
        })
    }

    /// Extract JSON from LLM response
    fn extract_json(&self, response: &str) -> Result<Value> {
        // Try direct parse first
        if let Ok(json) = serde_json::from_str::<Value>(response) {
            return Ok(json);
        }

        // Try to find JSON in markdown code blocks
        if let Some(start) = response.find("```json") {
            let rest = &response[start + 7..];
            if let Some(end) = rest.find("```") {
                let json_str = rest[..end].trim();
                if let Ok(json) = serde_json::from_str::<Value>(json_str) {
                    return Ok(json);
                }
            }
        }

        // Try to find JSON without code block
        if let Some(start) = response.find('{') {
            if let Some(end) = response.rfind('}') {
                let json_str = &response[start..=end];
                if let Ok(json) = serde_json::from_str::<Value>(json_str) {
                    return Ok(json);
                }
            }
        }

        // Return a default action (open file)
        Ok(serde_json::json!({
            "actions": [],
            "reasoning": "Could not parse LLM response",
            "confidence": 0.0
        }))
    }

    /// Parse actions from JSON
    fn parse_actions(&self, json: &Value, context: &AgentContext) -> Result<Vec<AgentAction>> {
        let actions_json = json.get("actions")
            .and_then(|a| a.as_array())
            .ok_or_else(|| anyhow::anyhow!("No actions found in response"))?;

        let mut actions = Vec::new();

        for action_json in actions_json.iter().take(self.max_actions) {
            if let Ok(action) = self.parse_single_action(action_json, context) {
                actions.push(action);
            }
        }

        // If no actions were parsed, create a default "I need more info" action
        if actions.is_empty() {
            if let Some(current_file) = &context.current_file {
                actions.push(AgentAction {
                    id: uuid::Uuid::new_v4().to_string(),
                    action_type: ActionType::OpenFile,
                    description: "Open current file for review".to_string(),
                    target_file: Some(current_file.to_string_lossy().to_string()),
                    edits: vec![],
                    confidence: 0.5,
                    reasoning: json.get("reasoning")
                        .and_then(|r| r.as_str())
                        .unwrap_or("Need more information to proceed")
                        .to_string(),
                });
            }
        }

        Ok(actions)
    }

    /// Parse a single action from JSON
    fn parse_single_action(&self, json: &Value, context: &AgentContext) -> Result<AgentAction> {
        let type_str = json.get("type")
            .and_then(|t| t.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing action type"))?;

        let action_type = match type_str {
            "read_file" => ActionType::ReadFile,
            "write_file" => ActionType::WriteFile,
            "edit_file" => ActionType::EditLines,
            "create_file" => ActionType::CreateFile,
            "delete_file" => ActionType::DeleteFile,
            "rename_file" => ActionType::RenameFile,
            "open_file" => ActionType::OpenFile,
            "search_code" => ActionType::SearchCode,
            "list_files" => ActionType::RunCommand,
            _ => return Err(anyhow::anyhow!("Unknown action type: {}", type_str)),
        };

        let description = json.get("description")
            .and_then(|d| d.as_str())
            .unwrap_or("No description")
            .to_string();

        let path = json.get("path")
            .or_else(|| json.get("file"))
            .and_then(|p| p.as_str())
            .map(|p| self.resolve_path(p, context));

        let edits = self.parse_edits(json)?;

        let confidence = json.get("confidence")
            .and_then(|c| c.as_f64())
            .unwrap_or(0.8) as f32;

        let reasoning = json.get("reasoning")
            .and_then(|r| r.as_str())
            .unwrap_or("")
            .to_string();

        Ok(AgentAction {
            id: uuid::Uuid::new_v4().to_string(),
            action_type,
            description,
            target_file: path,
            edits,
            confidence,
            reasoning,
        })
    }

    /// Parse edits from action JSON
    fn parse_edits(&self, json: &Value) -> Result<Vec<EditOperation>> {
        let edits_json = json.get("edits")
            .and_then(|e| e.as_array());

        if let Some(edits) = edits_json {
            let mut result = Vec::new();

            for edit in edits {
                let start_line = edit.get("start_line")
                    .and_then(|s| s.as_i64())
                    .unwrap_or(1) as usize;

                let end_line = edit.get("end_line")
                    .and_then(|e| e.as_i64())
                    .unwrap_or(start_line) as usize;

                let new_content = edit.get("new_content")
                    .or_else(|| edit.get("content"))
                    .and_then(|c| c.as_str())
                    .unwrap_or("")
                    .to_string();

                result.push(EditOperation {
                    start_line,
                    end_line,
                    new_content,
                });
            }

            return Ok(result);
        }

        // Check for inline content specification
        if let Some(content) = json.get("content").and_then(|c| c.as_str()) {
            return Ok(vec![EditOperation {
                start_line: 1,
                end_line: 1,
                new_content: content.to_string(),
            }]);
        }

        Ok(vec![])
    }

    /// Resolve relative path to absolute
    fn resolve_path(&self, path: &str, context: &AgentContext) -> String {
        let path = std::path::Path::new(path);

        if path.is_absolute() {
            path.to_string_lossy().to_string()
        } else {
            context.project_path.join(path).to_string_lossy().to_string()
        }
    }

    /// Assess risk level of actions
    fn assess_risk(&self, actions: &[AgentAction]) -> RiskLevel {
        let has_deletes = actions.iter().any(|a| a.action_type == ActionType::DeleteFile);
        let has_writes = actions.iter().any(|a| 
            matches!(a.action_type, ActionType::WriteFile | ActionType::EditLines | ActionType::CreateFile)
        );
        let multiple_files = actions.iter()
            .filter_map(|a| a.target_file.as_ref())
            .collect::<std::collections::HashSet<_>>()
            .len() > 3;

        if has_deletes || multiple_files {
            RiskLevel::High
        } else if has_writes {
            RiskLevel::Medium
        } else {
            RiskLevel::Low
        }
    }

    /// Create a plan for a quick fix
    pub fn plan_quick_fix(&self, file_path: &str, description: &str, context: &AgentContext) -> ExecutionPlan {
        let actions = vec![
            AgentAction {
                id: uuid::Uuid::new_v4().to_string(),
                action_type: ActionType::ReadFile,
                description: format!("Read {} to understand the code", file_path),
                target_file: Some(file_path.to_string()),
                edits: vec![],
                confidence: 1.0,
                reasoning: "Need to read file before fixing".to_string(),
            },
            AgentAction {
                id: uuid::Uuid::new_v4().to_string(),
                action_type: ActionType::EditLines,
                description: description.to_string(),
                target_file: Some(file_path.to_string()),
                edits: vec![],
                confidence: 0.85,
                reasoning: "Applying fix based on description".to_string(),
            },
        ];

        ExecutionPlan {
            actions,
            estimated_time_ms: 500,
            requires_approval: true,
            risk_level: RiskLevel::Medium,
        }
    }
}

impl Default for EditPlanner {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_plan() {
        let planner = EditPlanner::new();
        let context = AgentContext::default();

        let response = r#"{
            "actions": [
                {
                    "type": "read_file",
                    "path": "test.rs",
                    "description": "Read the file"
                }
            ],
            "reasoning": "Test",
            "confidence": 0.9
        }"#;

        let plan = planner.parse_plan(response, &context).unwrap();
        assert_eq!(plan.actions.len(), 1);
        assert_eq!(plan.actions[0].action_type, ActionType::ReadFile);
    }

    #[test]
    fn test_assess_risk() {
        let planner = EditPlanner::new();

        let low_risk = vec![AgentAction {
            id: "1".to_string(),
            action_type: ActionType::ReadFile,
            description: "Read".to_string(),
            target_file: Some("test.rs".to_string()),
            edits: vec![],
            confidence: 1.0,
            reasoning: "".to_string(),
        }];
        assert_eq!(planner.assess_risk(&low_risk), RiskLevel::Low);

        let high_risk = vec![AgentAction {
            id: "1".to_string(),
            action_type: ActionType::DeleteFile,
            description: "Delete".to_string(),
            target_file: Some("test.rs".to_string()),
            edits: vec![],
            confidence: 1.0,
            reasoning: "".to_string(),
        }];
        assert_eq!(planner.assess_risk(&high_risk), RiskLevel::High);
    }
}
