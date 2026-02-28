
// Autonomous Executor Module
//
// Executes plan steps for autonomous agents, interacting with external
// tools and maintaining tool execution state.

use serde::{Deserialize, Serialize};
use super::planner::PlanStep;
use super::external::{access_resource, ExternalResource, ResourceResult};
use std::time::Instant;

/// Execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub step_id: String,
    pub success: bool,
    pub output: Option<String>,
    pub error: Option<String>,
    pub duration_ms: u64,
}

/// Step executor
#[derive(Debug, Serialize, Deserialize)]
pub struct Executor {
    pub allowed_tools: Vec<String>,
}

impl Executor {
    pub fn new(allowed_tools: Vec<String>) -> Self { 
        Self { allowed_tools } 
    }
    
    /// Execute a plan step
    pub async fn execute(&self, step: &PlanStep) -> ExecutionResult {
        let start = Instant::now();
        
        let tool_name = match &step.tool_name {
            Some(name) => name,
            None => {
                return ExecutionResult {
                    step_id: step.id.clone(),
                    success: true,
                    output: Some("No tool configured, step marked as complete by default.".to_string()),
                    error: None,
                    duration_ms: start.elapsed().as_millis() as u64,
                };
            }
        };

        if !self.allowed_tools.contains(tool_name) {
            return ExecutionResult {
                step_id: step.id.clone(),
                success: false,
                output: None,
                error: Some(format!("Tool '{}' is not in the allowed tools list", tool_name)),
                duration_ms: start.elapsed().as_millis() as u64,
            };
        }

        // Extremely simplified tool execution stub routing
        let result = match tool_name.as_str() {
            "read_file" | "ast_prune" => {
                let path = step.tool_args.get("path").and_then(|v| v.as_str()).unwrap_or("");
                access_resource(&ExternalResource::File(path.to_string())).await
            },
            "run_terminal" => {
                let cmd = step.tool_args.get("command").and_then(|v| v.as_str()).unwrap_or("");
                access_resource(&ExternalResource::Tool(format!("terminal:{}", cmd))).await
            },
            _ => {
                ResourceResult {
                    resource: ExternalResource::Tool(tool_name.clone()),
                    success: false,
                    data: None,
                    error: Some(format!("Tool '{}' not implemented", tool_name)),
                }
            }
        };

        ExecutionResult {
            step_id: step.id.clone(),
            success: result.success,
            output: result.data,
            error: result.error,
            duration_ms: start.elapsed().as_millis() as u64,
        }
    }
}

impl Default for Executor {
    fn default() -> Self { 
        Self::new(vec!["read_file".to_string(), "ast_prune".to_string(), "run_terminal".to_string(), "write_file".to_string()])
    }
}



