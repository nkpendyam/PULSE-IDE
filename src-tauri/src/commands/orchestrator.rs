//! Kyro Orchestrator Tauri Commands
//!
//! Exposes mission control, model listing, and agent control to the frontend.

use crate::orchestrator::{KyroOrchestrator, Mission, MissionPhase, OrchestratorConfig};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

/// Global orchestrator state
pub struct OrchestratorState(pub Arc<RwLock<KyroOrchestrator>>);

/// Request to start a mission
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartMissionRequest {
    pub goal: String,
    pub constraints: Option<Vec<String>>,
}

/// Start a new mission
#[tauri::command]
pub async fn orchestrator_start_mission(
    state: State<'_, OrchestratorState>,
    goal: String,
    constraints: Option<Vec<String>>,
) -> Result<Mission, String> {
    let orchestrator = state.0.write().await;
    Ok(orchestrator.start_mission(goal, constraints).await)
}

/// Get mission by ID
#[tauri::command]
pub async fn orchestrator_get_mission(
    state: State<'_, OrchestratorState>,
    id: String,
) -> Result<Option<Mission>, String> {
    let orchestrator = state.0.read().await;
    Ok(orchestrator.get_mission(&id).await)
}

/// List all missions
#[tauri::command]
pub async fn orchestrator_list_missions(
    state: State<'_, OrchestratorState>,
) -> Result<Vec<Mission>, String> {
    let orchestrator = state.0.read().await;
    Ok(orchestrator.list_missions().await)
}

/// Update mission phase
#[tauri::command]
pub async fn orchestrator_update_mission_phase(
    state: State<'_, OrchestratorState>,
    id: String,
    phase: String,
) -> Result<Option<Mission>, String> {
    let phase_enum = match phase.to_lowercase().as_str() {
        "plan" => MissionPhase::Plan,
        "edit" => MissionPhase::Edit,
        "test" => MissionPhase::Test,
        "review" => MissionPhase::Review,
        "deploy" => MissionPhase::Deploy,
        _ => return Err(format!("Invalid phase: {}", phase)),
    };
    let orchestrator = state.0.write().await;
    Ok(orchestrator.update_mission_phase(&id, phase_enum).await)
}

/// Get orchestrator config
#[tauri::command]
pub async fn orchestrator_get_config(state: State<'_, OrchestratorState>) -> Result<OrchestratorConfig, String> {
    let orchestrator = state.0.read().await;
    Ok(orchestrator.config().clone())
}
