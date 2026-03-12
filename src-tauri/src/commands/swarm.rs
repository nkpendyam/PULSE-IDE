// Swarm AI Tauri Commands — Real multi-agent execution via Ollama
//
// Manages distributed AI agents for collaborative task completion

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::command;
use tokio::sync::RwLock;

lazy_static::lazy_static! {
    static ref SWARM_STATE: Arc<RwLock<SwarmState>> = Arc::new(RwLock::new(SwarmState::new()));
}

#[derive(Debug)]
pub struct SwarmState {
    agents: HashMap<String, SwarmAgentInfo>,
    tasks: Vec<TaskInfo>,
    messages: Vec<AgentMessage>,
    ollama_url: String,
}

impl Default for SwarmState {
    fn default() -> Self {
        Self::new()
    }
}

impl SwarmState {
    pub fn new() -> Self {
        Self {
            agents: HashMap::new(),
            tasks: Vec::new(),
            messages: Vec::new(),
            ollama_url: "http://localhost:11434".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMessage {
    pub from: String,
    pub to: String,
    pub content: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwarmAgentInfo {
    pub id: String,
    pub name: String,
    pub role: String,
    pub model: String,
    pub status: String,
    pub current_task: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskInfo {
    pub id: String,
    pub description: String,
    pub status: String,
    pub assigned_agents: Vec<String>,
    pub result: Option<String>,
    pub created_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTaskRequest {
    pub description: String,
    pub agent_roles: Option<Vec<String>>,
    pub priority: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwarmResponse {
    pub task_id: String,
    pub result: String,
    pub agents_used: Vec<String>,
    pub time_ms: u64,
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwarmStats {
    pub total_agents: usize,
    pub active_tasks: usize,
    pub completed_tasks: usize,
    pub total_tasks: usize,
}

fn system_prompt_for_role(role: &str) -> String {
    match role {
        "coder" => "You are a senior software engineer. Write clean, efficient code. Return only code in markdown code blocks.".to_string(),
        "reviewer" => "You are a code reviewer. Analyze code for bugs, performance issues, and best practices. Be specific and actionable.".to_string(),
        "tester" => "You are a QA engineer. Write comprehensive test cases and identify edge cases. Return test code in markdown code blocks.".to_string(),
        "architect" => "You are a software architect. Design systems, APIs, and data models. Use diagrams and clear specifications.".to_string(),
        "analyst" => "You are a technical analyst. Break down requirements into tasks, estimate complexity, and identify risks.".to_string(),
        _ => format!("You are a {} AI agent. Help with tasks related to your role.", role),
    }
}

async fn call_ollama_for_agent(
    agent: &SwarmAgentInfo,
    prompt: &str,
    ollama_url: &str,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let system = system_prompt_for_role(&agent.role);
    let body = serde_json::json!({
        "model": agent.model,
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
        .map_err(|e| format!("Ollama request failed for agent '{}': {}", agent.name, e))?;
    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;
    json["response"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "No response from Ollama".to_string())
}

#[command]
pub async fn list_swarm_agents() -> Result<Vec<SwarmAgentInfo>, String> {
    let state = SWARM_STATE.read().await;
    Ok(state.agents.values().cloned().collect())
}

#[command]
pub async fn create_swarm_agent(
    name: String,
    role: String,
    model: Option<String>,
) -> Result<SwarmAgentInfo, String> {
    let mut state = SWARM_STATE.write().await;
    let id = uuid::Uuid::new_v4().to_string();
    let agent = SwarmAgentInfo {
        id: id.clone(),
        name,
        role,
        model: model.unwrap_or_else(|| "codellama:7b".to_string()),
        status: "idle".to_string(),
        current_task: None,
    };
    state.agents.insert(id, agent.clone());
    Ok(agent)
}

#[command]
pub async fn submit_swarm_task(request: CreateTaskRequest) -> Result<TaskInfo, String> {
    let mut state = SWARM_STATE.write().await;
    let task_id = uuid::Uuid::new_v4().to_string();

    // Assign agents by role if specified, otherwise use all available
    let assigned: Vec<String> = if let Some(roles) = &request.agent_roles {
        state
            .agents
            .values()
            .filter(|a| roles.contains(&a.role) && a.status == "idle")
            .map(|a| a.id.clone())
            .collect()
    } else {
        state
            .agents
            .values()
            .filter(|a| a.status == "idle")
            .take(3)
            .map(|a| a.id.clone())
            .collect()
    };

    let task = TaskInfo {
        id: task_id,
        description: request.description,
        status: "pending".to_string(),
        assigned_agents: assigned,
        result: None,
        created_at: chrono::Utc::now().to_rfc3339(),
        completed_at: None,
    };
    state.tasks.push(task.clone());
    Ok(task)
}

#[command]
pub async fn execute_swarm_task(task_id: String) -> Result<SwarmResponse, String> {
    let start = std::time::Instant::now();

    // Get task info and assigned agents
    let (task_desc, assigned_ids, ollama_url) = {
        let mut state = SWARM_STATE.write().await;
        let task_idx = state
            .tasks
            .iter()
            .position(|t| t.id == task_id)
            .ok_or("Task not found")?;
        state.tasks[task_idx].status = "running".to_string();
        let aids = state.tasks[task_idx].assigned_agents.clone();
        let desc = state.tasks[task_idx].description.clone();
        // Mark agents as busy
        for aid in &aids {
            if let Some(agent) = state.agents.get_mut(aid) {
                agent.status = "working".to_string();
                agent.current_task = Some(task_id.clone());
            }
        }
        (desc, aids, state.ollama_url.clone())
    };

    // Collect agent info
    let agents: Vec<SwarmAgentInfo> = {
        let state = SWARM_STATE.read().await;
        assigned_ids
            .iter()
            .filter_map(|id| state.agents.get(id).cloned())
            .collect()
    };

    // Execute each agent's contribution concurrently
    let mut handles = Vec::new();
    for agent in agents {
        let desc = task_desc.clone();
        let url = ollama_url.clone();
        handles.push(tokio::spawn(async move {
            let prompt = format!(
                "Task: {}\n\nProvide your contribution based on your role as '{}'.",
                desc, agent.role
            );
            let result = call_ollama_for_agent(&agent, &prompt, &url).await;
            (agent.id.clone(), agent.role.clone(), result)
        }));
    }

    // Collect results
    let mut combined_result = String::new();
    let mut agents_used = Vec::new();
    for handle in handles {
        match handle.await {
            Ok((id, role, Ok(response))) => {
                combined_result.push_str(&format!("## {} ({})\n\n{}\n\n", role, id, response));
                agents_used.push(id);
            }
            Ok((id, role, Err(e))) => {
                combined_result.push_str(&format!("## {} ({}) — Error\n\n{}\n\n", role, id, e));
                agents_used.push(id);
            }
            Err(e) => {
                combined_result.push_str(&format!("Agent task failed: {}\n\n", e));
            }
        }
    }

    let elapsed = start.elapsed().as_millis() as u64;

    // Update state
    {
        let mut state = SWARM_STATE.write().await;
        if let Some(task) = state.tasks.iter_mut().find(|t| t.id == task_id) {
            task.status = "completed".to_string();
            task.completed_at = Some(chrono::Utc::now().to_rfc3339());
            task.result = Some(combined_result.clone());
        }
        for aid in &agents_used {
            if let Some(agent) = state.agents.get_mut(aid) {
                agent.status = "idle".to_string();
                agent.current_task = None;
            }
        }
    }

    Ok(SwarmResponse {
        task_id,
        result: combined_result,
        agents_used,
        time_ms: elapsed,
        success: true,
    })
}

#[command]
pub async fn get_swarm_task_status(task_id: String) -> Result<TaskInfo, String> {
    let state = SWARM_STATE.read().await;
    state
        .tasks
        .iter()
        .find(|t| t.id == task_id)
        .cloned()
        .ok_or_else(|| "Task not found".to_string())
}

#[command]
pub async fn list_swarm_tasks() -> Result<Vec<TaskInfo>, String> {
    let state = SWARM_STATE.read().await;
    Ok(state.tasks.clone())
}

#[command]
pub async fn cancel_swarm_task(task_id: String) -> Result<(), String> {
    let mut state = SWARM_STATE.write().await;
    let task_idx = state
        .tasks
        .iter()
        .position(|t| t.id == task_id)
        .ok_or("Task not found")?;
    state.tasks[task_idx].status = "cancelled".to_string();
    let aids = state.tasks[task_idx].assigned_agents.clone();
    for aid in &aids {
        if let Some(agent) = state.agents.get_mut(aid) {
            agent.status = "idle".to_string();
            agent.current_task = None;
        }
    }
    Ok(())
}

#[command]
pub async fn get_swarm_stats() -> Result<SwarmStats, String> {
    let state = SWARM_STATE.read().await;
    Ok(SwarmStats {
        total_agents: state.agents.len(),
        active_tasks: state.tasks.iter().filter(|t| t.status == "running").count(),
        completed_tasks: state
            .tasks
            .iter()
            .filter(|t| t.status == "completed")
            .count(),
        total_tasks: state.tasks.len(),
    })
}

#[command]
pub async fn delete_swarm_agent(agent_id: String) -> Result<(), String> {
    let mut state = SWARM_STATE.write().await;
    state.agents.remove(&agent_id);
    Ok(())
}

#[command]
pub async fn send_agent_message(from: String, to: String, message: String) -> Result<(), String> {
    let mut state = SWARM_STATE.write().await;
    if !state.agents.contains_key(&from) {
        return Err(format!("Agent {} not found", from));
    }
    if !state.agents.contains_key(&to) {
        return Err(format!("Agent {} not found", to));
    }
    state.messages.push(AgentMessage {
        from,
        to,
        content: message,
        timestamp: chrono::Utc::now().to_rfc3339(),
    });
    Ok(())
}

// ==================== Multi-Model Router Commands ====================

use crate::swarm_ai::router::{ModelEndpoint, ModelRouter, RouterConfig, TaskKind};

lazy_static::lazy_static! {
    static ref ROUTER: Arc<RwLock<ModelRouter>> = Arc::new(RwLock::new(ModelRouter::new()));
}

#[command]
pub async fn router_route(task: TaskKind) -> Result<Option<ModelEndpoint>, String> {
    let router = ROUTER.read().await;
    Ok(router.route(task).await)
}

#[command]
pub async fn router_register_endpoint(endpoint: ModelEndpoint) -> Result<(), String> {
    let router = ROUTER.read().await;
    router.register(endpoint).await;
    Ok(())
}

#[command]
pub async fn router_unregister_endpoint(id: String) -> Result<(), String> {
    let router = ROUTER.read().await;
    router.unregister(&id).await;
    Ok(())
}

#[command]
pub async fn router_list_endpoints() -> Result<Vec<ModelEndpoint>, String> {
    let router = ROUTER.read().await;
    Ok(router.list_endpoints().await)
}

#[command]
pub async fn router_refresh_health() -> Result<Vec<ModelEndpoint>, String> {
    let router = ROUTER.read().await;
    router.refresh_health().await;
    Ok(router.list_endpoints().await)
}

#[command]
pub async fn router_get_config() -> Result<RouterConfig, String> {
    let router = ROUTER.read().await;
    Ok(router.get_config().await)
}

#[command]
pub async fn router_set_config(config: RouterConfig) -> Result<(), String> {
    let router = ROUTER.read().await;
    router.set_config(config).await;
    Ok(())
}
