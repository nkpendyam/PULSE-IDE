//! Tauri Commands for Agent Store
//!
//! Exposes agent management to the frontend

use crate::agent_store::{AgentStore, AgentDefinition, InstalledAgent, AgentExecutionResult};
use std::sync::Mutex;
use tauri::State;

/// Global agent store state
pub struct AgentStoreState(pub Mutex<AgentStore>);

/// Search for agents on GitHub
#[tauri::command]
pub async fn search_agents(
    state: State<'_, AgentStoreState>,
    query: String,
) -> Result<Vec<AgentDefinition>, String> {
    let mut store = state.0.lock().map_err(|e| e.to_string())?;
    store.search_github(&query).await.map_err(|e| e.to_string())
}

/// Install agent from GitHub
#[tauri::command]
pub async fn install_agent(
    state: State<'_, AgentStoreState>,
    repo_url: String,
) -> Result<String, String> {
    let mut store = state.0.lock().map_err(|e| e.to_string())?;
    store.install_from_github(&repo_url).await.map_err(|e| e.to_string())
}

/// List installed agents
#[tauri::command]
pub fn list_agents(
    state: State<'_, AgentStoreState>,
) -> Result<Vec<InstalledAgent>, String> {
    let store = state.0.lock().map_err(|e| e.to_string())?;
    Ok(store.list_installed().into_iter().cloned().collect())
}

/// Uninstall agent
#[tauri::command]
pub fn uninstall_agent(
    state: State<'_, AgentStoreState>,
    agent_id: String,
) -> Result<bool, String> {
    let mut store = state.0.lock().map_err(|e| e.to_string())?;
    Ok(store.uninstall(&agent_id))
}

/// Enable/disable agent
#[tauri::command]
pub fn toggle_agent(
    state: State<'_, AgentStoreState>,
    agent_id: String,
    enabled: bool,
) -> Result<bool, String> {
    let mut store = state.0.lock().map_err(|e| e.to_string())?;
    Ok(store.set_enabled(&agent_id, enabled))
}

/// Execute agent task
#[tauri::command]
pub async fn execute_agent(
    state: State<'_, AgentStoreState>,
    agent_id: String,
    task: String,
) -> Result<AgentExecutionResult, String> {
    let store = state.0.lock().map_err(|e| e.to_string())?;
    let mut executor = crate::agent_store::AgentExecutor::new(store.clone());
    executor.execute(&agent_id, &task).await.map_err(|e| e.to_string())
}

/// Get featured agents
#[tauri::command]
pub fn featured_agents(
    state: State<'_, AgentStoreState>,
) -> Result<Vec<AgentDefinition>, String> {
    let store = state.0.lock().map_err(|e| e.to_string())?;
    Ok(store.featured().into_iter().cloned().collect())
}
