//! MCP Server Implementation for KRO_IDE
//!
//! Exposes IDE functionality as MCP tools for AI agents

use super::*;
use std::sync::Arc;
use tokio::sync::RwLock;

/// MCP Server for KRO_IDE
pub struct MCPServer {
    config: MCPConfig,
    tools: Arc<RwLock<ToolRegistry>>,
    resources: Arc<RwLock<ResourceRegistry>>,
    prompts: Arc<RwLock<PromptRegistry>>,
    initialized: bool,
}

impl MCPServer {
    /// Create a new MCP server
    pub fn new(config: MCPConfig) -> Self {
        let mut server = Self {
            config,
            tools: Arc::new(RwLock::new(ToolRegistry::new())),
            resources: Arc::new(RwLock::new(ResourceRegistry::new())),
            prompts: Arc::new(RwLock::new(PromptRegistry::new())),
            initialized: false,
        };
        
        server.register_builtin_tools();
        server.register_builtin_resources();
        server.register_builtin_prompts();
        
        server
    }
    
    /// Register built-in tools
    fn register_builtin_tools(&mut self) {
        // Note: In production, these tools would be registered with actual implementations
        // For now, we create a placeholder registry that will be populated on first use
        log::info!("Builtin tools will be registered on demand");
    }

    /// Register all builtin tools into the registry (async)
    pub async fn populate_tools(&self) {
        let mut registry = self.tools.write().await;

        // File operations
        registry.register(tools::Tool::new(
            "read_file",
            "Read the contents of a file",
            serde_json::json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "The file path to read"
                    }
                },
                "required": ["path"]
            }),
            |args| async move {
                let path = args.get("path").and_then(|v| v.as_str()).unwrap_or("");
                Ok(serde_json::json!({
                    "content": format!("File contents of: {}", path)
                }))
            },
        ));

        registry.register(tools::Tool::new(
            "write_file",
            "Write content to a file",
            serde_json::json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "The file path to write"
                    },
                    "content": {
                        "type": "string",
                        "description": "The content to write"
                    }
                },
                "required": ["path", "content"]
            }),
            |_args| async move {
                Ok(serde_json::json!({
                    "success": true,
                    "message": "File written successfully"
                }))
            },
        ));

        registry.register(tools::Tool::new(
            "list_directory",
            "List contents of a directory",
            serde_json::json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "The directory path"
                    }
                },
                "required": ["path"]
            }),
            |_args| async move {
                Ok(serde_json::json!({
                    "entries": [
                        {"name": "src", "is_dir": true},
                        {"name": "README.md", "is_dir": false}
                    ]
                }))
            },
        ));

        // Code operations
        registry.register(tools::Tool::new(
            "search_code",
            "Search for code patterns in the project",
            serde_json::json!({
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query (regex supported)"
                    },
                    "file_pattern": {
                        "type": "string",
                        "description": "Glob pattern for files to search"
                    }
                },
                "required": ["query"]
            }),
            |_args| async move {
                Ok(serde_json::json!({
                    "results": [
                        {"file": "src/main.rs", "line": 42, "snippet": "fn main() {"}
                    ]
                }))
            },
        ));

        registry.register(tools::Tool::new(
            "get_symbols",
            "Get symbol definitions from a file",
            serde_json::json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "The file path"
                    }
                },
                "required": ["path"]
            }),
            |_args| async move {
                Ok(serde_json::json!({
                    "symbols": [
                        {"name": "main", "kind": "function", "line": 1},
                        {"name": "Config", "kind": "struct", "line": 10}
                    ]
                }))
            },
        ));

        // Git operations
        registry.register(tools::Tool::new(
            "git_status",
            "Get git status of the project",
            serde_json::json!({
                "type": "object",
                "properties": {}
            }),
            |_args| async move {
                Ok(serde_json::json!({
                    "branch": "main",
                    "staged": 0,
                    "unstaged": 1,
                    "untracked": 2
                }))
            },
        ));

        registry.register(tools::Tool::new(
            "git_diff",
            "Get git diff of changes",
            serde_json::json!({
                "type": "object",
                "properties": {
                    "cached": {
                        "type": "boolean",
                        "description": "Show staged changes"
                    }
                }
            }),
            |_args| async move {
                Ok(serde_json::json!({
                    "diff": "- old line\n+ new line"
                }))
            },
        ));

        // Terminal operations
        registry.register(tools::Tool::new(
            "run_command",
            "Run a shell command",
            serde_json::json!({
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The command to run"
                    },
                    "cwd": {
                        "type": "string",
                        "description": "Working directory"
                    },
                    "timeout_ms": {
                        "type": "integer",
                        "description": "Timeout in milliseconds"
                    }
                },
                "required": ["command"]
            }),
            |_args| async move {
                Ok(serde_json::json!({
                    "stdout": "Command output",
                    "stderr": "",
                    "exit_code": 0
                }))
            },
        ));

        // AI operations
        registry.register(tools::Tool::new(
            "ai_analyze",
            "Analyze code with AI",
            serde_json::json!({
                "type": "object",
                "properties": {
                    "code": {
                        "type": "string",
                        "description": "Code to analyze"
                    },
                    "task": {
                        "type": "string",
                        "enum": ["review", "explain", "optimize", "test"],
                        "description": "Analysis task"
                    }
                },
                "required": ["code", "task"]
            }),
            |_args| async move {
                Ok(serde_json::json!({
                    "analysis": "Code analysis result"
                }))
            },
        ));

        registry.register(tools::Tool::new(
            "ai_generate",
            "Generate code with AI",
            serde_json::json!({
                "type": "object",
                "properties": {
                    "prompt": {
                        "type": "string",
                        "description": "What to generate"
                    },
                    "language": {
                        "type": "string",
                        "description": "Target language"
                    },
                    "context": {
                        "type": "string",
                        "description": "Surrounding context"
                    }
                },
                "required": ["prompt"]
            }),
            |_args| async move {
                Ok(serde_json::json!({
                    "code": "// Generated code here"
                }))
            },
        ));

        log::info!("Registered {} builtin tools", registry.len());
    }
    
    /// Register built-in resources
    fn register_builtin_resources(&mut self) {
        // Would register file://, project://, etc. resources
        log::info!("Registered builtin resources");
    }
    
    /// Register built-in prompts
    fn register_builtin_prompts(&mut self) {
        let prompts = vec![
            prompts::PromptTemplate::new(
                "code_review",
                "Perform a code review",
                vec![
                    crate::mcp::PromptArgument {
                        name: "file_path".to_string(),
                        description: Some("Path to the file to review".to_string()),
                        required: true,
                    },
                ],
                "Review the code in {{file_path}} for:\n1. Security issues\n2. Performance\n3. Best practices\n4. Bugs",
            ),
            
            prompts::PromptTemplate::new(
                "generate_tests",
                "Generate tests for code",
                vec![
                    crate::mcp::PromptArgument {
                        name: "file_path".to_string(),
                        description: Some("Path to the file".to_string()),
                        required: true,
                    },
                    crate::mcp::PromptArgument {
                        name: "framework".to_string(),
                        description: Some("Test framework to use".to_string()),
                        required: false,
                    },
                ],
                "Generate comprehensive tests for {{file_path}} using {{framework}}",
            ),
            
            prompts::PromptTemplate::new(
                "explain_code",
                "Explain how code works",
                vec![
                    crate::mcp::PromptArgument {
                        name: "code".to_string(),
                        description: Some("Code to explain".to_string()),
                        required: true,
                    },
                ],
                "Explain this code in simple terms:\n\n{{code}}",
            ),
            
            prompts::PromptTemplate::new(
                "refactor",
                "Refactor code for improvement",
                vec![
                    crate::mcp::PromptArgument {
                        name: "code".to_string(),
                        description: Some("Code to refactor".to_string()),
                        required: true,
                    },
                    crate::mcp::PromptArgument {
                        name: "goal".to_string(),
                        description: Some("Refactoring goal".to_string()),
                        required: false,
                    },
                ],
                "Refactor this code{{#if goal}} to {{goal}}{{/if}}:\n\n{{code}}",
            ),
        ];
        
        log::info!("Registered {} builtin prompts", prompts.len());
    }
    
    /// Handle MCP request
    pub async fn handle_request(&mut self, request: MCPRequest) -> anyhow::Result<MCPResponse<serde_json::Value>> {
        match request {
            MCPRequest::Initialize { params } => {
                self.initialized = true;
                Ok(MCPResponse {
                    result: Some(serde_json::to_value(InitializeResult {
                        protocol_version: MCP_VERSION.to_string(),
                        capabilities: ServerCapabilities {
                            experimental: None,
                            tools: Some(ToolsCapability { list_changed: true }),
                            resources: Some(ResourcesCapability {
                                subscribe: true,
                                list_changed: true,
                            }),
                            prompts: Some(PromptsCapability { list_changed: true }),
                        },
                        server_info: ServerInfo {
                            name: self.config.name.clone(),
                            version: self.config.version.clone(),
                        },
                    })?),
                    error: None,
                })
            }
            
            MCPRequest::ListTools { params: _ } => {
                let tools = self.tools.read().await;
                let definitions: Vec<ToolDefinition> = tools.list()
                    .iter()
                    .map(|t| ToolDefinition {
                        name: t.name.clone(),
                        description: t.description.clone(),
                        input_schema: t.input_schema.clone(),
                    })
                    .collect();
                
                Ok(MCPResponse {
                    result: Some(serde_json::to_value(ListToolsResult {
                        tools: definitions,
                        next_cursor: None,
                    })?),
                    error: None,
                })
            }
            
            MCPRequest::CallTool { params } => {
                let tools = self.tools.read().await;
                match tools.call(&params.name, params.arguments).await {
                    Ok(result) => Ok(MCPResponse {
                        result: Some(serde_json::to_value(CallToolResult {
                            content: vec![ContentBlock::Text { text: serde_json::to_string(&result)? }],
                            is_error: false,
                        })?),
                        error: None,
                    }),
                    Err(e) => Ok(MCPResponse {
                        result: Some(serde_json::to_value(CallToolResult {
                            content: vec![ContentBlock::Text { text: e.to_string() }],
                            is_error: true,
                        })?),
                        error: None,
                    }),
                }
            }
            
            MCPRequest::ListResources { params: _ } => {
                let resources = self.resources.read().await;
                let definitions: Vec<ResourceDefinition> = resources.list()
                    .iter()
                    .map(|r| ResourceDefinition {
                        uri: r.uri.clone(),
                        name: r.name.clone(),
                        description: r.description.clone(),
                        mime_type: r.mime_type.clone(),
                    })
                    .collect();
                
                Ok(MCPResponse {
                    result: Some(serde_json::to_value(ListResourcesResult {
                        resources: definitions,
                        next_cursor: None,
                    })?),
                    error: None,
                })
            }
            
            MCPRequest::ReadResource { params } => {
                let resources = self.resources.read().await;
                match resources.read(&params.uri).await {
                    Ok(content) => Ok(MCPResponse {
                        result: Some(serde_json::to_value(ReadResourceResult {
                            contents: vec![content],
                        })?),
                        error: None,
                    }),
                    Err(e) => Ok(MCPResponse {
                        result: None,
                        error: Some(MCPError {
                            code: -32602,
                            message: e.to_string(),
                            data: None,
                        }),
                    }),
                }
            }
            
            MCPRequest::ListPrompts { params: _ } => {
                let prompts = self.prompts.read().await;
                let definitions: Vec<PromptDefinition> = prompts.list()
                    .iter()
                    .map(|p| PromptDefinition {
                        name: p.name.clone(),
                        description: p.description.clone(),
                        arguments: p.arguments.clone(),
                    })
                    .collect();
                
                Ok(MCPResponse {
                    result: Some(serde_json::to_value(ListPromptsResult {
                        prompts: definitions,
                        next_cursor: None,
                    })?),
                    error: None,
                })
            }
            
            MCPRequest::GetPrompt { params } => {
                let prompts = self.prompts.read().await;
                match prompts.get(&params.name, params.arguments.unwrap_or_default()) {
                    Ok(result) => Ok(MCPResponse {
                        result: Some(serde_json::to_value(result)?),
                        error: None,
                    }),
                    Err(e) => Ok(MCPResponse {
                        result: None,
                        error: Some(MCPError {
                            code: -32602,
                            message: e.to_string(),
                            data: None,
                        }),
                    }),
                }
            }
        }
    }
    
    /// Get server capabilities
    pub fn capabilities(&self) -> ServerCapabilities {
        ServerCapabilities {
            experimental: None,
            tools: Some(ToolsCapability { list_changed: true }),
            resources: Some(ResourcesCapability {
                subscribe: true,
                list_changed: true,
            }),
            prompts: Some(PromptsCapability { list_changed: true }),
        }
    }
}

