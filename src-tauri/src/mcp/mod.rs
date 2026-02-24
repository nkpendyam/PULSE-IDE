//! Model Context Protocol (MCP) Framework for KRO_IDE
//!
//! Implements the MCP specification for AI agent tool calling.
//! Based on FastMCP 3.0 patterns with stdio and SSE transports.
//!
//! ## Architecture
//! - MCP Server: Exposes tools, resources, and prompts
//! - MCP Client: Connects to external MCP servers
//! - Agent Orchestrator: Coordinates MCP tools with local LLM

pub mod server;
pub mod client;
pub mod tools;
pub mod resources;
pub mod prompts;
pub mod transport;

pub use server::MCPServer;
pub use client::MCPClient;
pub use tools::{Tool, ToolRegistry, ToolResult};
pub use resources::{Resource, ResourceRegistry};
pub use prompts::{PromptTemplate, PromptRegistry};

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// MCP version
pub const MCP_VERSION: &str = "2024-11-05";

/// MCP configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPConfig {
    /// Server name
    pub name: String,
    /// Server version
    pub version: String,
    /// Transport type
    pub transport: TransportType,
    /// Enable logging
    pub logging: bool,
    /// Max concurrent tool calls
    pub max_concurrent_tools: usize,
    /// Tool timeout in milliseconds
    pub tool_timeout_ms: u64,
}

impl Default for MCPConfig {
    fn default() -> Self {
        Self {
            name: "KRO_IDE_MCP".to_string(),
            version: "1.0.0".to_string(),
            transport: TransportType::Stdio,
            logging: true,
            max_concurrent_tools: 5,
            tool_timeout_ms: 30000,
        }
    }
}

/// Transport type for MCP communication
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransportType {
    /// Standard input/output (for local servers)
    Stdio,
    /// Server-Sent Events (for remote servers)
    SSE { url: String },
    /// WebSocket (for real-time)
    WebSocket { url: String },
}

/// MCP request types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "method", rename_all = "camelCase")]
pub enum MCPRequest {
    /// Initialize connection
    Initialize {
        params: InitializeParams,
    },
    /// List available tools
    ListTools {
        params: Option<ListParams>,
    },
    /// Call a tool
    CallTool {
        params: CallToolParams,
    },
    /// List available resources
    ListResources {
        params: Option<ListParams>,
    },
    /// Read a resource
    ReadResource {
        params: ReadResourceParams,
    },
    /// List available prompts
    ListPrompts {
        params: Option<ListParams>,
    },
    /// Get a prompt
    GetPrompt {
        params: GetPromptParams,
    },
}

/// Initialize parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitializeParams {
    pub protocol_version: String,
    pub capabilities: ClientCapabilities,
    pub client_info: ClientInfo,
}

/// Client capabilities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientCapabilities {
    pub experimental: Option<HashMap<String, serde_json::Value>>,
    pub roots: Option<RootsCapability>,
    pub sampling: Option<()>,
}

/// Roots capability
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RootsCapability {
    pub list_changed: bool,
}

/// Client info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientInfo {
    pub name: String,
    pub version: String,
}

/// List parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListParams {
    pub cursor: Option<String>,
}

/// Call tool parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallToolParams {
    pub name: String,
    pub arguments: HashMap<String, serde_json::Value>,
}

/// Read resource parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadResourceParams {
    pub uri: String,
}

/// Get prompt parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetPromptParams {
    pub name: String,
    pub arguments: Option<HashMap<String, String>>,
}

/// MCP response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPResponse<T> {
    pub result: Option<T>,
    pub error: Option<MCPError>,
}

/// MCP error
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPError {
    pub code: i32,
    pub message: String,
    pub data: Option<serde_json::Value>,
}

/// Server capabilities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerCapabilities {
    pub experimental: Option<HashMap<String, serde_json::Value>>,
    pub tools: Option<ToolsCapability>,
    pub resources: Option<ResourcesCapability>,
    pub prompts: Option<PromptsCapability>,
}

/// Tools capability
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolsCapability {
    pub list_changed: bool,
}

/// Resources capability
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourcesCapability {
    pub subscribe: bool,
    pub list_changed: bool,
}

/// Prompts capability
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptsCapability {
    pub list_changed: bool,
}

/// Tool definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

/// Resource definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceDefinition {
    pub uri: String,
    pub name: String,
    pub description: Option<String>,
    pub mime_type: Option<String>,
}

/// Prompt definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptDefinition {
    pub name: String,
    pub description: String,
    pub arguments: Vec<PromptArgument>,
}

/// Prompt argument
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptArgument {
    pub name: String,
    pub description: Option<String>,
    pub required: bool,
}

/// Tool list result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListToolsResult {
    pub tools: Vec<ToolDefinition>,
    pub next_cursor: Option<String>,
}

/// Call tool result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallToolResult {
    pub content: Vec<ContentBlock>,
    pub is_error: bool,
}

/// Content block
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ContentBlock {
    Text { text: String },
    Image { data: String, mime_type: String },
    Resource { resource: EmbeddedResource },
}

/// Embedded resource
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddedResource {
    pub uri: String,
    pub mime_type: Option<String>,
    pub text: Option<String>,
    pub blob: Option<String>,
}

/// Resource list result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListResourcesResult {
    pub resources: Vec<ResourceDefinition>,
    pub next_cursor: Option<String>,
}

/// Read resource result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadResourceResult {
    pub contents: Vec<ResourceContents>,
}

/// Resource contents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceContents {
    pub uri: String,
    pub mime_type: Option<String>,
    pub text: Option<String>,
    pub blob: Option<String>,
}

/// Prompt list result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListPromptsResult {
    pub prompts: Vec<PromptDefinition>,
    pub next_cursor: Option<String>,
}

/// Get prompt result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetPromptResult {
    pub description: Option<String>,
    pub messages: Vec<PromptMessage>,
}

/// Prompt message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptMessage {
    pub role: Role,
    pub content: ContentBlock,
}

/// Message role
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    User,
    Assistant,
}

/// Initialize result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitializeResult {
    pub protocol_version: String,
    pub capabilities: ServerCapabilities,
    pub server_info: ServerInfo,
}

/// Server info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerInfo {
    pub name: String,
    pub version: String,
}
