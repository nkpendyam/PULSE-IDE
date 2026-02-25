//! Swarm AI Tauri Commands
//!
//! Exposes distributed AI agent functionality to the frontend

use tauri::command;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::swarm_ai::{Swarm, Agent, AgentRole, AgentConfig};

/// Global swarm state
lazy_static::lazy_static! {
    static ref SWARM_STATE: Arc<RwLock<SwarmState>> = Arc::new(RwLock::new(SwarmState::new()));
}

#[derive(Debug)]
pub struct SwarmState {
    swarm: Swarm,
    tasks: Vec<TaskInfo>,
}

impl SwarmState {
    pub fn new() -> Self {
        Self {
            swarm: Swarm::new(Default::default()),
            tasks: Vec::new(),
        }
    }
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

/// List all agents in the swarm
#[command]
pub async fn list_swarm_agents() -> Result<Vec<SwarmAgentInfo>, String> {
    let state = SWARM_STATE.read().await;
    
    let agents = state.swarm.list_agents();
    
    Ok(agents.into_iter().map(|a| SwarmAgentInfo {
        id: a.id(),
        name: a.name().to_string(),
        role: format!("{:?}", a.role()),
        model: a.model().to_string(),
        status: format!("{:?}", a.status()),
        current_task: a.current_task().map(|s| s.to_string()),
    }).collect())
}

/// Create a new agent
#[command]
pub async fn create_swarm_agent(name: String, role: String, model: Option<String>) -> Result<SwarmAgentInfo, String> {
    let mut state = SWARM_STATE.write().await;
    
    let agent_role = match role.to_lowercase().as_str() {
        "planner" => AgentRole::Planner,
        "coder" => AgentRole::Coder,
        "reviewer" => AgentRole::Reviewer,
        "tester" => AgentRole::Tester,
        "debugger" => AgentRole::Debugger,
        "architect" => AgentRole::Architect,
        _ => AgentRole::Coder,
    };
    
    let agent = Agent::new(AgentConfig {
        name: name.clone(),
        role: agent_role,
        model: model.unwrap_or_else(|| "default".to_string()),
    });
    
    let info = SwarmAgentInfo {
        id: agent.id(),
        name,
        role: format!("{:?}", agent_role),
        model: agent.model().to_string(),
        status: "idle".to_string(),
        current_task: None,
    };
    
    state.swarm.add_agent(agent);
    
    Ok(info)
}

/// Submit a task to the swarm
#[command]
pub async fn submit_swarm_task(request: CreateTaskRequest) -> Result<TaskInfo, String> {
    let mut state = SWARM_STATE.write().await;
    
    let task_id = uuid::Uuid::new_v4().to_string();
    
    let task = TaskInfo {
        id: task_id.clone(),
        description: request.description.clone(),
        status: "pending".to_string(),
        assigned_agents: vec![],
        result: None,
        created_at: chrono::Utc::now().to_rfc3339(),
        completed_at: None,
    };
    
    // Decompose task and assign to agents
    let subtasks = state.swarm.decompose_task(&request.description).await
        .map_err(|e| format!("Task decomposition failed: {}", e))?;
    
    // Assign agents based on roles
    let agents = state.swarm.find_available_agents();
    for agent in agents.iter().take(subtasks.len()) {
        state.swarm.assign_task(&task_id, agent.id()).await.unwrap_or(());
    }
    
    state.tasks.push(task.clone());
    
    Ok(task)
}

/// Execute a swarm task
#[command]
pub async fn execute_swarm_task(task_id: String) -> Result<SwarmResponse, String> {
    let state = SWARM_STATE.read().await;
    
    let start = std::time::Instant::now();
    
    let result = state.swarm.execute_task(&task_id).await
        .map_err(|e| format!("Task execution failed: {}", e))?;
    
    Ok(SwarmResponse {
        task_id: task_id.clone(),
        result: result.output,
        agents_used: result.agents_used,
        time_ms: start.elapsed().as_millis() as u64,
        success: result.success,
    })
}

/// Get task status
#[command]
pub async fn get_swarm_task_status(task_id: String) -> Result<TaskInfo, String> {
    let state = SWARM_STATE.read().await;
    
    let task = state.tasks.iter().find(|t| t.id == task_id)
        .ok_or("Task not found")?;
    
    Ok(task.clone())
}

/// List all tasks
#[command]
pub async fn list_swarm_tasks() -> Result<Vec<TaskInfo>, String> {
    let state = SWARM_STATE.read().await;
    Ok(state.tasks.clone())
}

/// Cancel a task
#[command]
pub async fn cancel_swarm_task(task_id: String) -> Result<(), String> {
    let mut state = SWARM_STATE.write().await;
    
    state.swarm.cancel_task(&task_id).await
        .map_err(|e| format!("Failed to cancel task: {}", e))?;
    
    if let Some(task) = state.tasks.iter_mut().find(|t| t.id == task_id) {
        task.status = "cancelled".to_string();
    }
    
    Ok(())
}

/// Get swarm statistics
#[command]
pub async fn get_swarm_stats() -> Result<SwarmStats, String> {
    let state = SWARM_STATE.read().await;
    
    Ok(SwarmStats {
        total_agents: state.swarm.agent_count(),
        active_tasks: state.tasks.iter().filter(|t| t.status == "running").count(),
        completed_tasks: state.tasks.iter().filter(|t| t.status == "completed").count(),
        total_tasks: state.tasks.len(),
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwarmStats {
    pub total_agents: usize,
    pub active_tasks: usize,
    pub completed_tasks: usize,
    pub total_tasks: usize,
}

/// Delete an agent
#[command]
pub async fn delete_swarm_agent(agent_id: String) -> Result<(), String> {
    let mut state = SWARM_STATE.write().await;
    state.swarm.remove_agent(&agent_id);
    Ok(())
}

/// Send message between agents
#[command]
pub async fn send_agent_message(from: String, to: String, message: String) -> Result<(), String> {
    let state = SWARM_STATE.read().await;
    
    state.swarm.send_agent_message(&from, &to, &message).await
        .map_err(|e| format!("Failed to send message: {}", e))?;
    
    Ok(())
}
