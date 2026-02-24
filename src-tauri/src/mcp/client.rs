//! MCP Client for KRO_IDE
//!
//! Connects to external MCP servers and proxies tool calls

use super::*;
use anyhow::Result;
use async_trait::async_trait;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;

/// MCP Client for connecting to external MCP servers
pub struct MCPClient {
    name: String,
    transport: Box<dyn transport::Transport>,
    capabilities: Option<ServerCapabilities>,
    tools: HashMap<String, ToolDefinition>,
    resources: HashMap<String, ResourceDefinition>,
    prompts: HashMap<String, PromptDefinition>,
}

impl MCPClient {
    /// Create a new MCP client
    pub fn new(name: impl Into<String>, transport: Box<dyn transport::Transport>) -> Self {
        Self {
            name: name.into(),
            transport,
            capabilities: None,
            tools: HashMap::new(),
            resources: HashMap::new(),
            prompts: HashMap::new(),
        }
    }

    /// Connect and initialize with the server
    pub async fn connect(&mut self) -> Result<()> {
        // Send initialize request
        let request = MCPRequest::Initialize {
            params: InitializeParams {
                protocol_version: MCP_VERSION.to_string(),
                capabilities: ClientCapabilities {
                    experimental: None,
                    roots: Some(RootsCapability { list_changed: true }),
                    sampling: Some(()),
                },
                client_info: ClientInfo {
                    name: self.name.clone(),
                    version: "1.0.0".to_string(),
                },
            },
        };

        let response = self.send_request(&request).await?;

        if let Some(result) = response.result {
            let init_result: InitializeResult = serde_json::from_value(result)?;
            self.capabilities = Some(init_result.capabilities);
            log::info!("Connected to MCP server: {}", init_result.server_info.name);
        }

        // Fetch tools, resources, prompts
        self.fetch_tools().await?;
        self.fetch_resources().await?;
        self.fetch_prompts().await?;

        Ok(())
    }

    /// Send a request to the server
    async fn send_request(&self, request: &MCPRequest) -> Result<MCPResponse<serde_json::Value>> {
        let message = serde_json::to_value(request)?;
        self.transport.send(&message).await?;

        // In production, would wait for response
        Ok(MCPResponse {
            result: None,
            error: None,
        })
    }

    /// Fetch available tools from server
    async fn fetch_tools(&mut self) -> Result<()> {
        let request = MCPRequest::ListTools { params: None };
        let response = self.send_request(&request).await?;

        if let Some(result) = response.result {
            let tools_result: ListToolsResult = serde_json::from_value(result)?;
            for tool in tools_result.tools {
                self.tools.insert(tool.name.clone(), tool);
            }
        }

        Ok(())
    }

    /// Fetch available resources from server
    async fn fetch_resources(&mut self) -> Result<()> {
        let request = MCPRequest::ListResources { params: None };
        let response = self.send_request(&request).await?;

        if let Some(result) = response.result {
            let resources_result: ListResourcesResult = serde_json::from_value(result)?;
            for resource in resources_result.resources {
                self.resources.insert(resource.uri.clone(), resource);
            }
        }

        Ok(())
    }

    /// Fetch available prompts from server
    async fn fetch_prompts(&mut self) -> Result<()> {
        let request = MCPRequest::ListPrompts { params: None };
        let response = self.send_request(&request).await?;

        if let Some(result) = response.result {
            let prompts_result: ListPromptsResult = serde_json::from_value(result)?;
            for prompt in prompts_result.prompts {
                self.prompts.insert(prompt.name.clone(), prompt);
            }
        }

        Ok(())
    }

    /// Call a tool on the server
    pub async fn call_tool(
        &self,
        name: &str,
        arguments: HashMap<String, serde_json::Value>,
    ) -> Result<CallToolResult> {
        let request = MCPRequest::CallTool {
            params: CallToolParams {
                name: name.to_string(),
                arguments,
            },
        };

        let response = self.send_request(&request).await?;

        if let Some(result) = response.result {
            return Ok(serde_json::from_value(result)?);
        }

        if let Some(error) = response.error {
            anyhow::bail!("Tool call error: {}", error.message);
        }

        anyhow::bail!("No response from server");
    }

    /// Read a resource from the server
    pub async fn read_resource(&self, uri: &str) -> Result<ReadResourceResult> {
        let request = MCPRequest::ReadResource {
            params: ReadResourceParams {
                uri: uri.to_string(),
            },
        };

        let response = self.send_request(&request).await?;

        if let Some(result) = response.result {
            return Ok(serde_json::from_value(result)?);
        }

        anyhow::bail!("Failed to read resource: {}", uri);
    }

    /// Get a prompt from the server
    pub async fn get_prompt(
        &self,
        name: &str,
        arguments: Option<HashMap<String, String>>,
    ) -> Result<GetPromptResult> {
        let request = MCPRequest::GetPrompt {
            params: GetPromptParams {
                name: name.to_string(),
                arguments,
            },
        };

        let response = self.send_request(&request).await?;

        if let Some(result) = response.result {
            return Ok(serde_json::from_value(result)?);
        }

        anyhow::bail!("Failed to get prompt: {}", name);
    }

    /// Get available tools
    pub fn tools(&self) -> Vec<&ToolDefinition> {
        self.tools.values().collect()
    }

    /// Get available resources
    pub fn resources(&self) -> Vec<&ResourceDefinition> {
        self.resources.values().collect()
    }

    /// Get available prompts
    pub fn prompts(&self) -> Vec<&PromptDefinition> {
        self.prompts.values().collect()
    }

    /// Get server capabilities
    pub fn capabilities(&self) -> Option<&ServerCapabilities> {
        self.capabilities.as_ref()
    }

    /// Disconnect from server
    pub async fn disconnect(&self) -> Result<()> {
        self.transport.close().await
    }
}
