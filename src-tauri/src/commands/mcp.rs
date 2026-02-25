//! MCP (Model Context Protocol) Tauri Commands
//!
//! Exposes MCP agent functionality to the frontend

use tauri::command;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::mcp::{McpServer, McpTool, McpResource, CallToolRequest};

/// Global MCP state
lazy_static::lazy_static! {
    static ref MCP_STATE: Arc<RwLock<McpState>> = Arc::new(RwLock::new(McpState::new()));
}

#[derive(Debug)]
pub struct McpState {
    server: McpServer,
    agents: Vec<AgentInfo>,
    tools: Vec<ToolInfo>,
}

impl McpState {
    pub fn new() -> Self {
        Self {
            server: McpServer::new(Default::default()),
            agents: Vec::new(),
            tools: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInfo {
    pub id: String,
    pub name: String,
    pub role: String,
    pub status: String,
    pub model: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolInfo {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceInfo {
    pub uri: String,
    pub name: String,
    pub mime_type: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunAgentRequest {
    pub agent_id: String,
    pub prompt: String,
    pub context: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentResponse {
    pub agent_id: String,
    pub response: String,
    pub tokens_used: u32,
    pub time_ms: u64,
    pub success: bool,
}

/// List available MCP agents
#[command]
pub async fn list_agents() -> Result<Vec<AgentInfo>, String> {
    let state = MCP_STATE.read().await;
    Ok(state.agents.clone())
}

/// Create a new agent
#[command]
pub async fn create_agent(name: String, role: String, model: Option<String>) -> Result<AgentInfo, String> {
    let mut state = MCP_STATE.write().await;
    
    let id = uuid::Uuid::new_v4().to_string();
    let agent = AgentInfo {
        id: id.clone(),
        name,
        role,
        status: "idle".to_string(),
        model: model.unwrap_or_else(|| "default".to_string()),
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    
    state.agents.push(agent.clone());
    
    Ok(agent)
}

/// Run an agent with a prompt
#[command]
pub async fn run_agent(request: RunAgentRequest) -> Result<AgentResponse, String> {
    let state = MCP_STATE.read().await;
    
    let agent = state.agents.iter().find(|a| a.id == request.agent_id)
        .ok_or("Agent not found")?;
    
    // Execute agent
    let start = std::time::Instant::now();
    
    let result = state.server.call_tool(CallToolRequest {
        name: "run_agent".to_string(),
        arguments: serde_json::json!({
            "agent_id": request.agent_id,
            "prompt": request.prompt,
            "context": request.context,
        }),
    }).await.map_err(|e| format!("Agent execution failed: {}", e))?;
    
    let response = result.content
        .get("response")
        .and_then(|v| v.as_str())
        .unwrap_or("No response")
        .to_string();
    
    Ok(AgentResponse {
        agent_id: request.agent_id,
        response,
        tokens_used: result.content.get("tokens_used")
            .and_then(|v| v.as_u64())
            .unwrap_or(0) as u32,
        time_ms: start.elapsed().as_millis() as u64,
        success: true,
    })
}

/// Get agent status
#[command]
pub async fn get_agent_status(agent_id: String) -> Result<String, String> {
    let state = MCP_STATE.read().await;
    
    let agent = state.agents.iter().find(|a| a.id == agent_id)
        .ok_or("Agent not found")?;
    
    Ok(agent.status.clone())
}

/// Delete an agent
#[command]
pub async fn delete_agent(agent_id: String) -> Result<(), String> {
    let mut state = MCP_STATE.write().await;
    state.agents.retain(|a| a.id != agent_id);
    Ok(())
}

/// List available MCP tools
#[command]
pub async fn list_mcp_tools() -> Result<Vec<ToolInfo>, String> {
    let state = MCP_STATE.read().await;
    Ok(state.tools.clone())
}

/// Execute an MCP tool
#[command]
pub async fn execute_tool(name: String, arguments: serde_json::Value) -> Result<serde_json::Value, String> {
    let state = MCP_STATE.read().await;
    
    let result = state.server.call_tool(CallToolRequest {
        name,
        arguments,
    }).await.map_err(|e| format!("Tool execution failed: {}", e))?;
    
    Ok(result.content)
}

/// List MCP resources
#[command]
pub async fn list_mcp_resources() -> Result<Vec<ResourceInfo>, String> {
    let state = MCP_STATE.read().await;
    
    let resources = state.server.list_resources(None).await
        .map_err(|e| format!("Failed to list resources: {}", e))?;
    
    Ok(resources.resources.into_iter().map(|r| ResourceInfo {
        uri: r.uri,
        name: r.name,
        mime_type: r.mime_type,
        description: r.description,
    }).collect())
}

/// Read an MCP resource
#[command]
pub async fn read_mcp_resource(uri: String) -> Result<String, String> {
    let state = MCP_STATE.read().await;
    
    let content = state.server.read_resource(&uri).await
        .map_err(|e| format!("Failed to read resource: {}", e))?;
    
    Ok(content)
}

/// Register a custom tool
#[command]
pub async fn register_tool(tool: ToolInfo) -> Result<(), String> {
    let mut state = MCP_STATE.write().await;
    
    state.tools.push(tool);
    
    Ok(())
}

/// Unregister a tool
#[command]
pub async fn unregister_tool(name: String) -> Result<(), String> {
    let mut state = MCP_STATE.write().await;
    state.tools.retain(|t| t.name != name);
    Ok(())
}
