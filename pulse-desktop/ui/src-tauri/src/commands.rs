//! Tauri Commands - Frontend API

use crate::state::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

/// Kernel status response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KernelStatus {
    pub state: String,
    pub uptime_secs: u64,
    pub version: String,
    pub event_queue_length: usize,
    pub active_tasks: usize,
    pub ram_usage_mb: u64,
    pub ram_budget_mb: u64,
    pub policy_mode: String,
}

/// Task submission request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskRequest {
    pub name: String,
    pub source_id: String,
    pub payload: serde_json::Value,
}

/// Plan approval request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanApproval {
    pub plan_id: String,
    pub approved: bool,
    pub reason: Option<String>,
}

/// Chat request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    pub prompt: String,
    pub model: Option<String>,
}

/// Chat response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    pub content: String,
    pub model: String,
    pub latency_ms: u64,
}

/// Sandbox execution request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxRequest {
    pub command: String,
    pub args: Vec<String>,
    pub timeout_secs: Option<u64>,
}

/// Sandbox execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
    pub killed: bool,
}

/// Get kernel status
#[tauri::command]
async fn get_kernel_status(
    state: State<'_, AppState>,
) -> Result<KernelStatus, String> {
    let kernel = state.kernel.lock().await;
    kernel.get_status().await.map_err(|e| e.to_string())
}

/// Pause kernel
#[tauri::command]
async fn pause_kernel(
    state: State<'_, AppState>,
) -> Result<(), String> {
    let kernel = state.kernel.lock().await;
    kernel.pause().await.map_err(|e| e.to_string())
}

/// Resume kernel
#[tauri::command]
async fn resume_kernel(
    state: State<'_, AppState>,
) -> Result<(), String> {
    let kernel = state.kernel.lock().await;
    kernel.resume().await.map_err(|e| e.to_string())
}

/// Submit a task
#[tauri::command]
async fn submit_task(
    state: State<'_, AppState>,
    request: TaskRequest,
) -> Result<String, String> {
    let kernel = state.kernel.lock().await;
    kernel
        .submit_task(request.name, request.source_id, request.payload)
        .await
        .map_err(|e| e.to_string())
}

/// Get task status
#[tauri::command]
async fn get_task_status(
    state: State<'_, AppState>,
    task_id: String,
) -> Result<Option<String>, String> {
    let kernel = state.kernel.lock().await;
    kernel
        .get_task_status(&task_id)
        .await
        .map_err(|e| e.to_string())
}

/// List agents
#[tauri::command]
async fn list_agents(
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let kernel = state.kernel.lock().await;
    kernel.list_agents().await.map_err(|e| e.to_string())
}

/// List modules
#[tauri::command]
async fn list_modules(
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let kernel = state.kernel.lock().await;
    kernel.list_modules().await.map_err(|e| e.to_string())
}

/// Get memory usage
#[tauri::command]
async fn get_memory_usage(
    state: State<'_, AppState>,
) -> Result<u64, String> {
    let kernel = state.kernel.lock().await;
    kernel.get_memory_usage().await.map_err(|e| e.to_string())
}

/// Get logs
#[tauri::command]
async fn get_logs(
    state: State<'_, AppState>,
    limit: usize,
) -> Result<Vec<serde_json::Value>, String> {
    let kernel = state.kernel.lock().await;
    kernel.get_logs(limit).await.map_err(|e| e.to_string())
}

/// Approve a plan
#[tauri::command]
async fn approve_plan(
    state: State<'_, AppState>,
    approval: PlanApproval,
) -> Result<(), String> {
    let kernel = state.kernel.lock().await;
    kernel
        .approve_plan(&approval.plan_id)
        .await
        .map_err(|e| e.to_string())
}

/// Reject a plan
#[tauri::command]
async fn reject_plan(
    state: State<'_, AppState>,
    approval: PlanApproval,
) -> Result<(), String> {
    let kernel = state.kernel.lock().await;
    kernel
        .reject_plan(&approval.plan_id, approval.reason.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// Send chat message
#[tauri::command]
async fn chat(
    state: State<'_, AppState>,
    request: ChatRequest,
) -> Result<ChatResponse, String> {
    let kernel = state.kernel.lock().await;
    kernel
        .chat(&request.prompt, request.model.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// Execute sandboxed command
#[tauri::command]
async fn execute_sandbox(
    state: State<'_, AppState>,
    request: SandboxRequest,
) -> Result<SandboxResult, String> {
    let kernel = state.kernel.lock().await;
    kernel
        .execute_sandbox(&request.command, request.args, request.timeout_secs)
        .await
        .map_err(|e| e.to_string())
}

/// Open file dialog
#[tauri::command]
async fn open_file(
    app: tauri::AppHandle,
) -> Result<Option<String>, String> {
    use tauri::api::dialog::blocking::FileDialogBuilder;
    
    let path = FileDialogBuilder::new()
        .set_title("Open File")
        .pick_file();
    
    Ok(path.map(|p| p.to_string_lossy().to_string()))
}

/// Save file dialog
#[tauri::command]
async fn save_file(
    app: tauri::AppHandle,
    content: String,
    default_name: Option<String>,
) -> Result<Option<String>, String> {
    use tauri::api::dialog::blocking::FileDialogBuilder;
    use std::fs;
    
    let path = FileDialogBuilder::new()
        .set_title("Save File")
        .set_file_name(default_name.unwrap_or_else(|| "untitled.txt".to_string()))
        .save_file();
    
    if let Some(ref p) = path {
        fs::write(p, &content).map_err(|e| e.to_string())?;
    }
    
    Ok(path.map(|p| p.to_string_lossy().to_string()))
}
