// MCP Tauri Commands — Real agent execution via Ollama
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
    ollama_url: String,
}

impl McpState {
    pub fn new() -> Self {
        Self {
            agents: HashMap::new(),
            tools: HashMap::new(),
            resources: HashMap::new(),
            ollama_url: "http://localhost:11434".to_string(),
        }
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

fn system_prompt_for_agent(name: &str) -> String {
    format!(
        "You are '{}', an AI coding agent inside Kyro IDE. \
         Help the user with code tasks. Be concise and provide working code. \
         Format code in markdown code blocks with language tags.",
        name
    )
}

async fn call_ollama(model: &str, system: &str, prompt: &str, ollama_url: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": model,
        "prompt": prompt,
        "system": system,
        "stream": false
    });
    let resp = client
        .post(format!("{}/api/generate", ollama_url))
        .json(&body)
        .timeout(std::time::Duration::from_secs(120))
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}. Is Ollama running?", e))?;
    let json: serde_json::Value = resp.json().await
        .map_err(|e| format!("Ollama response parse error: {}", e))?;
    json["response"].as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "No response field from Ollama".to_string())
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
    let model_name = model.unwrap_or_else(|| "codellama:7b".to_string());
    let agent = AgentInfo {
        id: id.clone(),
        name,
        status: "ready".to_string(),
        model: model_name,
    };
    state.agents.insert(id, agent.clone());
    Ok(agent)
}

#[command]
pub async fn run_agent(agent_id: String, prompt: String) -> Result<String, String> {
    let (agent, ollama_url) = {
        let state = MCP_STATE.read().await;
        let agent = state.agents.get(&agent_id).ok_or("Agent not found")?.clone();
        (agent, state.ollama_url.clone())
    };
    // Update status to running
    {
        let mut state = MCP_STATE.write().await;
        if let Some(a) = state.agents.get_mut(&agent_id) {
            a.status = "running".to_string();
        }
    }
    let system = system_prompt_for_agent(&agent.name);
    let result = call_ollama(&agent.model, &system, &prompt, &ollama_url).await;
    // Update status back to ready
    {
        let mut state = MCP_STATE.write().await;
        if let Some(a) = state.agents.get_mut(&agent_id) {
            a.status = "ready".to_string();
        }
    }
    result
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
    let (tool, ollama_url) = {
        let state = MCP_STATE.read().await;
        let tool = state.tools.get(&tool_name).ok_or("Tool not found")?.clone();
        (tool, state.ollama_url.clone())
    };
    // Execute tool by asking AI to process with the tool's description as context
    let system = format!(
        "You are a tool executor. Tool: '{}' - {}. Process the given arguments and return the result as JSON.",
        tool.name, tool.description
    );
    let prompt = format!("Execute with arguments: {}", args);
    match call_ollama("codellama:7b", &system, &prompt, &ollama_url).await {
        Ok(response) => Ok(ToolResult {
            success: true,
            output: serde_json::Value::String(response),
            error: None,
        }),
        Err(e) => Ok(ToolResult {
            success: false,
            output: serde_json::Value::Null,
            error: Some(e),
        }),
    }
}

#[command]
pub async fn list_mcp_resources() -> Result<Vec<ResourceInfo>, String> {
    let state = MCP_STATE.read().await;
    Ok(state.resources.values().cloned().collect())
}

#[command]
pub async fn read_mcp_resource(uri: String) -> Result<String, String> {
    let state = MCP_STATE.read().await;
    let resource = state.resources.get(&uri).ok_or("Resource not found")?;
    // Read file resources from disk
    if uri.starts_with("file://") {
        let path = uri.strip_prefix("file://").unwrap_or(&uri);
        tokio::fs::read_to_string(path).await
            .map_err(|e| format!("Failed to read resource: {}", e))
    } else {
        Ok(format!("Resource: {} ({})", resource.name, resource.uri))
    }
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
