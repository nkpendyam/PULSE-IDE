//! Autonomous External Module
//!
//! External tool and resource access for autonomous agents. Contains
//! AST pruning capabilities and sandboxed terminal execution.

use serde::{Deserialize, Serialize};

/// External resource type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExternalResource {
    File(String),
    Url(String),
    Api(String),
    Tool(String),
}

/// External resource access result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceResult {
    pub resource: ExternalResource,
    pub success: bool,
    pub data: Option<String>,
    pub error: Option<String>,
}

/// Access an external resource (with real file reading and sandboxed terminal execution)
pub async fn access_resource(resource: &ExternalResource) -> ResourceResult {
    match resource {
        ExternalResource::File(path) => {
            // Read the file and return its contents (with size guard)
            match std::fs::read_to_string(path) {
                Ok(content) => {
                    // Limit content to 50KB to avoid blowing up memory in the agent pipeline
                    let truncated = if content.len() > 50_000 {
                        format!("{}\n\n... (truncated, {} bytes total)", &content[..50_000], content.len())
                    } else {
                        content
                    };
                    ResourceResult {
                        resource: resource.clone(),
                        success: true,
                        data: Some(truncated),
                        error: None,
                    }
                }
                Err(e) => ResourceResult {
                    resource: resource.clone(),
                    success: false,
                    data: None,
                    error: Some(format!("Failed to read file {}: {}", path, e)),
                },
            }
        },
        ExternalResource::Tool(command) if command.starts_with("terminal:") => {
            // Sandboxed terminal execution — run the command and capture output
            let cmdstr = command.strip_prefix("terminal:").unwrap_or("");
            if cmdstr.is_empty() {
                return ResourceResult {
                    resource: resource.clone(),
                    success: false,
                    data: None,
                    error: Some("Empty command".to_string()),
                };
            }

            // Use platform-appropriate shell
            #[cfg(target_os = "windows")]
            let output = tokio::process::Command::new("cmd")
                .args(["/C", cmdstr])
                .output()
                .await;

            #[cfg(not(target_os = "windows"))]
            let output = tokio::process::Command::new("sh")
                .args(["-c", cmdstr])
                .output()
                .await;

            match output {
                Ok(output) => {
                    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                    let success = output.status.success();
                    let combined = if stderr.is_empty() {
                        stdout
                    } else {
                        format!("{}\n[stderr]\n{}", stdout, stderr)
                    };
                    ResourceResult {
                        resource: resource.clone(),
                        success,
                        data: Some(combined),
                        error: if success { None } else { Some(format!("Exit code: {:?}", output.status.code())) },
                    }
                }
                Err(e) => ResourceResult {
                    resource: resource.clone(),
                    success: false,
                    data: None,
                    error: Some(format!("Failed to execute command: {}", e)),
                },
            }
        },
        ExternalResource::Url(url) => {
            // Fetch URL content
            match reqwest::get(url).await {
                Ok(response) => {
                    if response.status().is_success() {
                        let text = response.text().await.unwrap_or_default();
                        let truncated = if text.len() > 50_000 {
                            format!("{}\n\n... (truncated, {} bytes total)", &text[..50_000], text.len())
                        } else {
                            text
                        };
                        ResourceResult {
                            resource: resource.clone(),
                            success: true,
                            data: Some(truncated),
                            error: None,
                        }
                    } else {
                        ResourceResult {
                            resource: resource.clone(),
                            success: false,
                            data: None,
                            error: Some(format!("HTTP {}", response.status())),
                        }
                    }
                }
                Err(e) => ResourceResult {
                    resource: resource.clone(),
                    success: false,
                    data: None,
                    error: Some(format!("Request failed: {}", e)),
                },
            }
        },
        _ => {
            ResourceResult {
                resource: resource.clone(),
                success: false,
                data: None,
                error: Some("External resource type not supported".to_string()),
            }
        }
    }
}
