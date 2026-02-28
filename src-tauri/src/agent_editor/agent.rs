//! MCP Agent Implementation
//!
//! Autonomous agent that can read, understand, and edit code files

use super::*;
use crate::embedded_llm::{EmbeddedLLMEngine, InferenceRequest};
use crate::rag::vector_store::HnswVectorStore;
use crate::mcp::{ToolRegistry, Tool, MCPServer};

use anyhow::{Result, Context};
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;
use serde_json::json;

/// MCP Agent for autonomous code editing
pub struct MCPAgent {
    llm: Arc<RwLock<EmbeddedLLMEngine>>,
    vector_store: Arc<RwLock<HnswVectorStore>>,
    tool_registry: Arc<RwLock<ToolRegistry>>,
    config: AgentConfig,
    approval_workflow: ApprovalWorkflow,
    planner: EditPlanner,
}

impl MCPAgent {
    /// Create a new MCP agent
    pub fn new(
        llm: Arc<RwLock<EmbeddedLLMEngine>>,
        vector_store: Arc<RwLock<HnswVectorStore>>,
        config: AgentConfig,
    ) -> Self {
        let tool_registry = Arc::new(RwLock::new(ToolRegistry::new()));

        Self {
            llm,
            vector_store,
            tool_registry,
            config,
            approval_workflow: ApprovalWorkflow::new(),
            planner: EditPlanner::new(),
        }
    }

    /// Initialize agent tools
    pub async fn initialize(&self) -> anyhow::Result<()> {
        let mut registry = self.tool_registry.write().await;

        // Register file read tool
        registry.register(Tool::new(
            "read_file",
            "Read the contents of a file",
            json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "File path to read" }
                },
                "required": ["path"]
            }),
            |args| async move {
                let path = args.get("path")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| anyhow::anyhow!("Missing path argument"))?;

                let content = tokio::fs::read_to_string(path).await
                    .map_err(|e| anyhow::anyhow!("Failed to read file: {}", e))?;

                Ok(json!({ "content": content, "path": path }))
            },
        ));

        // Register file write tool
        registry.register(Tool::new(
            "write_file",
            "Write content to a file (creates if doesn't exist)",
            json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "File path to write" },
                    "content": { "type": "string", "description": "Content to write" }
                },
                "required": ["path", "content"]
            }),
            |args| async move {
                let path = args.get("path")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| anyhow::anyhow!("Missing path argument"))?;
                let content = args.get("content")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| anyhow::anyhow!("Missing content argument"))?;

                // Create parent directories if needed
                if let Some(parent) = std::path::Path::new(path).parent() {
                    tokio::fs::create_dir_all(parent).await
                        .map_err(|e| anyhow::anyhow!("Failed to create directories: {}", e))?;
                }

                tokio::fs::write(path, content).await
                    .map_err(|e| anyhow::anyhow!("Failed to write file: {}", e))?;

                Ok(json!({ "success": true, "path": path }))
            },
        ));

        // Register edit file tool
        registry.register(Tool::new(
            "edit_file",
            "Edit specific lines in a file with a diff",
            json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "File path to edit" },
                    "edits": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "start_line": { "type": "integer" },
                                "end_line": { "type": "integer" },
                                "new_content": { "type": "string" }
                            },
                            "required": ["start_line", "end_line", "new_content"]
                        },
                        "description": "List of edits to apply"
                    }
                },
                "required": ["path", "edits"]
            }),
            |args| async move {
                let path = args.get("path")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| anyhow::anyhow!("Missing path argument"))?;
                let edits = args.get("edits")
                    .and_then(|v| v.as_array())
                    .ok_or_else(|| anyhow::anyhow!("Missing edits argument"))?;

                // Read current content
                let content = tokio::fs::read_to_string(path).await
                    .map_err(|e| anyhow::anyhow!("Failed to read file: {}", e))?;
                let mut lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();

                // Apply edits in reverse order (to preserve line numbers)
                let mut sorted_edits: Vec<_> = edits.iter().collect();
                sorted_edits.sort_by(|a, b| {
                    let a_line = a.get("start_line").and_then(|v| v.as_i64()).unwrap_or(0);
                    let b_line = b.get("start_line").and_then(|v| v.as_i64()).unwrap_or(0);
                    b_line.cmp(&a_line)
                });

                for edit in sorted_edits {
                    let start = edit.get("start_line").and_then(|v| v.as_i64()).unwrap_or(1) as usize;
                    let end = edit.get("end_line").and_then(|v| v.as_i64()).unwrap_or(1) as usize;
                    let new_content = edit.get("new_content")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");

                    // Adjust for 0-indexing
                    let start = start.saturating_sub(1);
                    let end = end.saturating_sub(1);

                    // Replace lines
                    let new_lines: Vec<String> = new_content.lines().map(|s| s.to_string()).collect();
                    lines.splice(start..=end.min(lines.len().saturating_sub(1)), new_lines);
                }

                // Write back
                let new_content = lines.join("\n");
                tokio::fs::write(path, new_content).await
                    .map_err(|e| anyhow::anyhow!("Failed to write file: {}", e))?;

                Ok(json!({ "success": true, "path": path }))
            },
        ));

        // Register search code tool
        registry.register(Tool::new(
            "search_code",
            "Search for code in the project using semantic search",
            json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "Search query" },
                    "limit": { "type": "integer", "description": "Max results", "default": 5 }
                },
                "required": ["query"]
            }),
            |args| async move {
                let query = args.get("query")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| anyhow::anyhow!("Missing query argument"))?;
                let limit = args.get("limit")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(5) as usize;

                // Real implementation: search using regex patterns in project files
                let mut results = Vec::new();
                let query_lower = query.to_lowercase();
                
                // Common source directories to search
                let search_dirs = ["src", "src-tauri/src", "lib", "app"];
                
                for dir in &search_dirs {
                    let dir_path = std::path::Path::new(dir);
                    if !dir_path.exists() {
                        continue;
                    }
                    
                    // Walk directory
                    if let Ok(entries) = walkdir::WalkDir::new(dir_path)
                        .max_depth(5)
                        .into_iter()
                        .filter_map(|e| e.ok())
                        .filter(|e| e.file_type().is_file())
                        .take(limit * 2) // Limit files to scan
                        .collect::<Vec<_>>()
                    {
                        for entry in entries {
                            let path = entry.path();
                            
                            // Check if it's a code file
                            let ext = path.extension()
                                .and_then(|e| e.to_str())
                                .unwrap_or("");
                            
                            if !["rs", "py", "js", "ts", "go", "java", "c", "cpp", "h"].contains(&ext) {
                                continue;
                            }
                            
                            // Read file and search for query
                            if let Ok(content) = std::fs::read_to_string(path) {
                                for (line_num, line) in content.lines().enumerate() {
                                    if line.to_lowercase().contains(&query_lower) {
                                        results.push(json!({
                                            "file": path.to_string_lossy().to_string(),
                                            "line": line_num + 1,
                                            "content": line.trim().to_string(),
                                            "match_type": "contains"
                                        }));
                                        
                                        if results.len() >= limit {
                                            break;
                                        }
                                    }
                                }
                            }
                            
                            if results.len() >= limit {
                                break;
                            }
                        }
                    }
                    
                    if results.len() >= limit {
                        break;
                    }
                }
                
                // Also search using vector store if available (would need to be passed in context)
                // For now, return the grep-style results
                
                Ok(json!({
                    "results": results,
                    "query": query,
                    "count": results.len()
                }))
            },
        ));

        // Register list files tool
        registry.register(Tool::new(
            "list_files",
            "List files in a directory",
            json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Directory path" },
                    "pattern": { "type": "string", "description": "Glob pattern", "default": "*" }
                },
                "required": ["path"]
            }),
            |args| async move {
                let path = args.get("path")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| anyhow::anyhow!("Missing path argument"))?;

                let mut entries = Vec::new();
                let mut dir = tokio::fs::read_dir(path).await
                    .map_err(|e| anyhow::anyhow!("Failed to read directory: {}", e))?;

                while let Some(entry) = dir.next_entry().await.map_err(|e| anyhow::anyhow!("Failed to read entry: {}", e))? {
                    let name = entry.file_name().to_string_lossy().to_string();
                    let is_dir = entry.file_type().await
                        .map(|t| t.is_dir())
                        .unwrap_or(false);
                    entries.push(json!({
                        "name": name,
                        "is_directory": is_dir
                    }));
                }

                Ok(json!({ "entries": entries }))
            },
        ));

        // Register open file tool
        registry.register(Tool::new(
            "open_file",
            "Open a file in the editor",
            json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "File path to open" }
                },
                "required": ["path"]
            }),
            |args| async move {
                let path = args.get("path")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| anyhow::anyhow!("Missing path argument"))?;

                // This would emit an event to the frontend to open the file
                // For now, just return success
                Ok(json!({ "success": true, "path": path, "action": "open_in_editor" }))
            },
        ));

        log::info!("MCP Agent initialized with {} tools", registry.len());
        Ok(())
    }

    /// Process a natural language command
    pub async fn process_command(
        &self,
        command: &str,
        context: &AgentContext,
    ) -> anyhow::Result<AgentResult> {
        log::info!("Processing agent command: {}", command);

        // Parse intent and plan actions
        let plan = self.plan_actions(command, context).await?;

        // Check if approval is needed
        if self.config.require_approval && plan.requires_approval {
            let pending = self.approval_workflow.create_pending(plan.actions.clone())?;

            return Ok(AgentResult {
                success: true,
                action: AgentAction {
                    id: uuid::Uuid::new_v4().to_string(),
                    action_type: ActionType::EditLines,
                    description: format!("Planned {} actions", plan.actions.len()),
                    target_file: None,
                    edits: vec![],
                    confidence: 0.9,
                    reasoning: "Waiting for user approval".to_string(),
                },
                message: "Actions planned. Awaiting approval.".to_string(),
                files_changed: vec![],
                requires_approval: true,
                approval_id: Some(pending.id.clone()),
            });
        }

        // Execute actions
        self.execute_actions(&plan.actions, context).await
    }

    /// Plan actions from natural language command
    async fn plan_actions(&self, command: &str, context: &AgentContext) -> anyhow::Result<ExecutionPlan> {
        // Build prompt for LLM
        let prompt = self.build_planning_prompt(command, context)?;

        // Get LLM response
        let llm = self.llm.read().await;
        let request = InferenceRequest {
            prompt,
            max_tokens: 2048,
            temperature: 0.3, // Lower temperature for more deterministic planning
            top_p: 0.9,
            top_k: 40,
            repeat_penalty: 1.1,
            stop_sequences: vec!["USER:".to_string()],
            stream: false,
            system_prompt: Some(include_str!("prompts/agent_planner.txt").to_string()),
            history: vec![],
        };

        let response = llm.complete(&request).await?;
        drop(llm);

        // Parse response into actions
        self.planner.parse_plan(&response.text, context)
    }

    /// Build prompt for action planning
    fn build_planning_prompt(&self, command: &str, context: &AgentContext) -> anyhow::Result<String> {
        let mut prompt = String::new();

        // Add context
        prompt.push_str("PROJECT: ");
        prompt.push_str(&context.project_path.to_string_lossy());
        prompt.push_str("\n\n");

        if let Some(current) = &context.current_file {
            prompt.push_str("CURRENT FILE: ");
            prompt.push_str(&current.to_string_lossy());
            prompt.push_str("\n\n");
        }

        prompt.push_str("OPEN FILES:\n");
        for file in &context.open_files {
            prompt.push_str(&format!("- {}\n", file.to_string_lossy()));
        }
        prompt.push_str("\n");

        prompt.push_str("USER REQUEST: ");
        prompt.push_str(command);
        prompt.push_str("\n\n");

        prompt.push_str("Plan the actions needed to fulfill this request. Output as JSON.");

        Ok(prompt)
    }

    /// Execute planned actions
    async fn execute_actions(
        &self,
        actions: &[AgentAction],
        context: &AgentContext,
    ) -> anyhow::Result<AgentResult> {
        let mut files_changed = Vec::new();
        let mut last_action = None;

        for action in actions {
            // Validate action
            self.validate_action(action, context)?;

            // Execute action
            match self.execute_single_action(action).await {
                Ok(result) => {
                    if let Some(file) = &action.target_file {
                        files_changed.push(file.clone());
                    }
                    last_action = Some(action.clone());
                    log::info!("Action executed: {:?}", action.action_type);
                }
                Err(e) => {
                    log::error!("Action failed: {}", e);
                    return Ok(AgentResult {
                        success: false,
                        action: action.clone(),
                        message: format!("Action failed: {}", e),
                        files_changed,
                        requires_approval: false,
                        approval_id: None,
                    });
                }
            }
        }

        let action = last_action.unwrap_or_else(|| AgentAction {
            id: uuid::Uuid::new_v4().to_string(),
            action_type: ActionType::ReadFile,
            description: "No actions executed".to_string(),
            target_file: None,
            edits: vec![],
            confidence: 0.0,
            reasoning: String::new(),
        });

        Ok(AgentResult {
            success: true,
            action,
            message: format!("Successfully completed {} actions", actions.len()),
            files_changed,
            requires_approval: false,
            approval_id: None,
        })
    }

    /// Validate an action before execution
    fn validate_action(&self, action: &AgentAction, context: &AgentContext) -> anyhow::Result<()> {
        // Check if file editing is allowed
        if let Some(file) = &action.target_file {
            // Check blocked patterns
            for pattern in &self.config.blocked_patterns {
                if glob_match::glob_match(pattern, file) {
                    anyhow::bail!("File {} matches blocked pattern {}", file, pattern);
                }
            }

            // Check file size for edits
            if action.action_type == ActionType::EditLines || action.action_type == ActionType::WriteFile {
                if let Ok(metadata) = std::fs::metadata(file) {
                    if metadata.len() > self.config.max_file_size {
                        anyhow::bail!("File {} exceeds maximum size limit", file);
                    }
                }
            }
        }

        Ok(())
    }

    /// Execute a single action
    async fn execute_single_action(&self, action: &AgentAction) -> anyhow::Result<()> {
        let registry = self.tool_registry.read().await;

        match action.action_type {
            ActionType::ReadFile => {
                let path = action.target_file.as_ref()
                    .ok_or_else(|| anyhow::anyhow!("No file specified"))?;

                let mut args = HashMap::new();
                args.insert("path".to_string(), json!(path));

                registry.call("read_file", args).await?;
            }
            ActionType::WriteFile => {
                let path = action.target_file.as_ref()
                    .ok_or_else(|| anyhow::anyhow!("No file specified"))?;

                let content = action.edits.first()
                    .map(|e| e.new_content.clone())
                    .unwrap_or_default();

                let mut args = HashMap::new();
                args.insert("path".to_string(), json!(path));
                args.insert("content".to_string(), json!(content));

                registry.call("write_file", args).await?;
            }
            ActionType::EditLines => {
                let path = action.target_file.as_ref()
                    .ok_or_else(|| anyhow::anyhow!("No file specified"))?;

                let edits: Vec<serde_json::Value> = action.edits.iter()
                    .map(|e| json!({
                        "start_line": e.start_line,
                        "end_line": e.end_line,
                        "new_content": e.new_content
                    }))
                    .collect();

                let mut args = HashMap::new();
                args.insert("path".to_string(), json!(path));
                args.insert("edits".to_string(), json!(edits));

                registry.call("edit_file", args).await?;
            }
            ActionType::OpenFile => {
                let path = action.target_file.as_ref()
                    .ok_or_else(|| anyhow::anyhow!("No file specified"))?;

                let mut args = HashMap::new();
                args.insert("path".to_string(), json!(path));

                registry.call("open_file", args).await?;
            }
            ActionType::CreateFile => {
                let path = action.target_file.as_ref()
                    .ok_or_else(|| anyhow::anyhow!("No file specified"))?;

                let content = action.edits.first()
                    .map(|e| e.new_content.clone())
                    .unwrap_or_default();

                let mut args = HashMap::new();
                args.insert("path".to_string(), json!(path));
                args.insert("content".to_string(), json!(content));

                registry.call("write_file", args).await?;
            }
            _ => {
                log::warn!("Unsupported action type: {:?}", action.action_type);
            }
        }

        Ok(())
    }

    /// Approve pending actions
    pub async fn approve(&self, approval_id: &str, context: &AgentContext) -> anyhow::Result<AgentResult> {
        let pending = self.approval_workflow.approve(approval_id)?;

        if !pending.approved {
            anyhow::bail!("Approval was rejected");
        }

        self.execute_actions(&pending.actions, context).await
    }

    /// Reject pending actions
    pub fn reject(&mut self, approval_id: &str) -> anyhow::Result<()> {
        self.approval_workflow.reject(approval_id)
    }

    /// Get pending approvals
    pub fn get_pending_approvals(&self) -> Vec<PendingEdit> {
        self.approval_workflow.get_pending()
    }

    /// Quick fix command (the "Fix the bug" moment)
    pub async fn quick_fix(
        &self,
        file_path: &str,
        description: &str,
        context: &AgentContext,
    ) -> anyhow::Result<AgentResult> {
        let command = format!("Fix the following in {}: {}", file_path, description);
        self.process_command(&command, context).await
    }

    /// Quick add command
    pub async fn quick_add(
        &self,
        file_path: &str,
        description: &str,
        context: &AgentContext,
    ) -> anyhow::Result<AgentResult> {
        let command = format!("Add the following to {}: {}", file_path, description);
        self.process_command(&command, context).await
    }

    /// Quick refactor command
    pub async fn quick_refactor(
        &self,
        file_path: &str,
        description: &str,
        context: &AgentContext,
    ) -> anyhow::Result<AgentResult> {
        let command = format!("Refactor {}: {}", file_path, description);
        self.process_command(&command, context).await
    }
}
