
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

        let result = match tool_name.as_str() {
            "read_file" | "ast_prune" => {
                let path = step.tool_args.get("path").and_then(|v| v.as_str()).unwrap_or("");
                access_resource(&ExternalResource::File(path.to_string())).await
            },
            "write_file" => {
                let path = step.tool_args.get("path").and_then(|v| v.as_str()).unwrap_or("");
                let content = step.tool_args.get("content").and_then(|v| v.as_str()).unwrap_or("");
                if path.is_empty() {
                    ResourceResult {
                        resource: ExternalResource::File(path.to_string()),
                        success: false,
                        data: None,
                        error: Some("write_file: path is required".to_string()),
                    }
                } else if path.contains("..") {
                    ResourceResult {
                        resource: ExternalResource::File(path.to_string()),
                        success: false,
                        data: None,
                        error: Some("write_file: path traversal forbidden".to_string()),
                    }
                } else {
                    match std::fs::write(path, content) {
                        Ok(_) => ResourceResult {
                            resource: ExternalResource::File(path.to_string()),
                            success: true,
                            data: Some(format!("Wrote {} bytes to {}", content.len(), path)),
                            error: None,
                        },
                        Err(e) => ResourceResult {
                            resource: ExternalResource::File(path.to_string()),
                            success: false,
                            data: None,
                            error: Some(format!("write_file error: {}", e)),
                        },
                    }
                }
            },
            "run_terminal" => {
                let cmd = step.tool_args.get("command").and_then(|v| v.as_str()).unwrap_or("");
                access_resource(&ExternalResource::Tool(format!("terminal:{}", cmd))).await
            },
            "list_dir" => {
                let path = step.tool_args.get("path").and_then(|v| v.as_str()).unwrap_or(".");
                match std::fs::read_dir(path) {
                    Ok(entries) => {
                        let listing: Vec<String> = entries
                            .filter_map(|e| e.ok())
                            .map(|e| {
                                let name = e.file_name().to_string_lossy().to_string();
                                if e.path().is_dir() { format!("{}/", name) } else { name }
                            })
                            .collect();
                        ResourceResult {
                            resource: ExternalResource::File(path.to_string()),
                            success: true,
                            data: Some(listing.join("\n")),
                            error: None,
                        }
                    }
                    Err(e) => ResourceResult {
                        resource: ExternalResource::File(path.to_string()),
                        success: false,
                        data: None,
                        error: Some(format!("list_dir error: {}", e)),
                    },
                }
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
        Self::new(vec![
            "read_file".to_string(),
            "write_file".to_string(),
            "list_dir".to_string(),
            "ast_prune".to_string(),
            "run_terminal".to_string(),
        ])
    }
}
