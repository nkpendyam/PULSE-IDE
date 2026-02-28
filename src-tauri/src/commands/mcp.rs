// MCP Tauri Commands — Self-contained implementation
use tauri::command;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

lazy_static::lazy_static! {
    static ref MCP_STATE: Arc<RwLock<McpState>> = Arc::new(RwLock::new(McpState::new()));
}

#[derive(Debug)]
pub struct McpState {
    agents: HashMap<String, AgentInfo>,
    tools: HashMap<String, ToolInfo>,
    resources: HashMap<String, ResourceInfo>,
}

impl McpState {
    pub fn new() -> Self {
        Self { agents: HashMap::new(), tools: HashMap::new(), resources: HashMap::new() }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInfo {
    pub id: String,
    pub name: String,
    pub status: String,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolInfo {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceInfo {
    pub uri: String,
    pub name: String,
    pub mime_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub success: bool,
    pub output: serde_json::Value,
    pub error: Option<String>,
}

#[command]
pub async fn list_agents() -> Result<Vec<AgentInfo>, String> {
    let state = MCP_STATE.read().await;
    Ok(state.agents.values().cloned().collect())
}

#[command]
pub async fn create_agent(name: String, model: Option<String>) -> Result<AgentInfo, String> {
    let mut state = MCP_STATE.write().await;
    let id = uuid::Uuid::new_v4().to_string();
    let agent = AgentInfo {
        id: id.clone(), name, status: "ready".to_string(),
        model: model.unwrap_or_else(|| "default".to_string()),
    };
    state.agents.insert(id, agent.clone());
    Ok(agent)
}

#[command]
pub async fn run_agent(agent_id: String, prompt: String) -> Result<String, String> {
    let state = MCP_STATE.read().await;
    let _agent = state.agents.get(&agent_id).ok_or("Agent not found")?;
    Ok(format!("Agent {} processed: {}", agent_id, prompt))
}

#[command]
pub async fn get_agent_status(agent_id: String) -> Result<AgentInfo, String> {
    let state = MCP_STATE.read().await;
    state.agents.get(&agent_id).cloned().ok_or_else(|| "Agent not found".to_string())
}

#[command]
pub async fn delete_agent(agent_id: String) -> Result<(), String> {
    let mut state = MCP_STATE.write().await;
    state.agents.remove(&agent_id);
    Ok(())
}

#[command]
pub async fn list_mcp_tools() -> Result<Vec<ToolInfo>, String> {
    let state = MCP_STATE.read().await;
    Ok(state.tools.values().cloned().collect())
}

#[command]
pub async fn execute_tool(tool_name: String, args: serde_json::Value) -> Result<ToolResult, String> {
    let state = MCP_STATE.read().await;
    let _tool = state.tools.get(&tool_name).ok_or("Tool not found")?;
    Ok(ToolResult { success: true, output: args, error: None })
}

#[command]
pub async fn list_mcp_resources() -> Result<Vec<ResourceInfo>, String> {
    let state = MCP_STATE.read().await;
    Ok(state.resources.values().cloned().collect())
}

#[command]
pub async fn read_mcp_resource(uri: String) -> Result<String, String> {
    let state = MCP_STATE.read().await;
    let _resource = state.resources.get(&uri).ok_or("Resource not found")?;
    Ok(format!("Content of {}", uri))
}

#[command]
pub async fn register_tool(name: String, description: String) -> Result<ToolInfo, String> {
    let mut state = MCP_STATE.write().await;
    let tool = ToolInfo { name: name.clone(), description, input_schema: serde_json::json!({}) };
    state.tools.insert(name, tool.clone());
    Ok(tool)
}

#[command]
pub async fn unregister_tool(name: String) -> Result<(), String> {
    let mut state = MCP_STATE.write().await;
    state.tools.remove(&name);
    Ok(())
}
