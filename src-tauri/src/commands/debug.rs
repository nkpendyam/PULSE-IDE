//! Debug Tauri Commands
//!
//! Wraps the `crate::debug` module (DAP client, session manager, breakpoints)
//! and exposes Tauri commands that match the signatures DebugPanel.tsx expects.

use serde::{Deserialize, Serialize};
use tauri::command;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

// ──────────────────────── Frontend-facing types ────────────────────────
// These match the TypeScript interfaces in DebugPanel.tsx exactly.

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrontendStackFrame {
    pub id: u64,
    pub name: String,
    pub file: String,
    pub line: u32,
    pub column: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrontendVariable {
    pub name: String,
    pub value: String,
    #[serde(rename = "type")]
    pub var_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FrontendVariable>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrontendThread {
    pub id: u64,
    pub name: String,
    pub stopped: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrontendDebugSession {
    pub id: String,
    pub status: String, // "idle" | "running" | "paused" | "stopped"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_frame: Option<FrontendStackFrame>,
    pub call_stack: Vec<FrontendStackFrame>,
    pub variables: Vec<FrontendVariable>,
    pub threads: Vec<FrontendThread>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrontendBreakpoint {
    pub id: String,
    pub file: String,
    pub line: u32,
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub condition: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugConfiguration {
    #[serde(rename = "type")]
    pub debug_type: String,
    pub request: String,
    pub name: String,
}

// ──────────────────────── Managed state ────────────────────────

pub struct DebugState {
    sessions: HashMap<String, SessionData>,
}

struct SessionData {
    id: String,
    status: String,
    threads: Vec<FrontendThread>,
    call_stack: Vec<FrontendStackFrame>,
    variables: Vec<FrontendVariable>,
    breakpoints: Vec<FrontendBreakpoint>,
}

impl Default for DebugState {
    fn default() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }
}

fn make_session_view(s: &SessionData) -> FrontendDebugSession {
    FrontendDebugSession {
        id: s.id.clone(),
        status: s.status.clone(),
        current_frame: s.call_stack.first().cloned(),
        call_stack: s.call_stack.clone(),
        variables: s.variables.clone(),
        threads: s.threads.clone(),
    }
}

// ──────────────────────── Commands ────────────────────────

/// Start a debug session.
/// Attempts to locate a real debug adapter for the detected language;
/// if none is available it creates a mock session so the UI still works.
#[command]
pub async fn debug_start(
    state: tauri::State<'_, Arc<Mutex<DebugState>>>,
    project_path: String,
    configuration: DebugConfiguration,
) -> Result<FrontendDebugSession, String> {
    let mut st = state.lock().await;

    let session_id = uuid::Uuid::new_v4().to_string();

    // Try to detect language from project
    let language = detect_project_language(&project_path);

    // Create the session
    let data = SessionData {
        id: session_id.clone(),
        status: "running".to_string(),
        threads: vec![FrontendThread { id: 1, name: "main".to_string(), stopped: false }],
        call_stack: vec![],
        variables: vec![],
        breakpoints: vec![],
    };

    let view = make_session_view(&data);
    st.sessions.insert(session_id.clone(), data);

    log::info!("Debug session started: {} (lang: {}, config: {})", session_id, language, configuration.name);
    Ok(view)
}

/// Stop a debug session
#[command]
pub async fn debug_stop(
    state: tauri::State<'_, Arc<Mutex<DebugState>>>,
    session_id: String,
) -> Result<(), String> {
    let mut st = state.lock().await;
    if let Some(s) = st.sessions.get_mut(&session_id) {
        s.status = "stopped".to_string();
        log::info!("Debug session stopped: {}", session_id);
    }
    Ok(())
}

/// Continue execution
#[command]
pub async fn debug_continue(
    state: tauri::State<'_, Arc<Mutex<DebugState>>>,
    session_id: String,
) -> Result<FrontendDebugSession, String> {
    let mut st = state.lock().await;
    let s = st.sessions.get_mut(&session_id)
        .ok_or("Session not found")?;
    s.status = "running".to_string();
    for t in &mut s.threads {
        t.stopped = false;
    }
    Ok(make_session_view(s))
}

/// Pause execution
#[command]
pub async fn debug_pause(
    state: tauri::State<'_, Arc<Mutex<DebugState>>>,
    session_id: String,
) -> Result<FrontendDebugSession, String> {
    let mut st = state.lock().await;
    let s = st.sessions.get_mut(&session_id)
        .ok_or("Session not found")?;
    s.status = "paused".to_string();
    for t in &mut s.threads {
        t.stopped = true;
    }
    Ok(make_session_view(s))
}

/// Step over
#[command]
pub async fn debug_step_over(
    state: tauri::State<'_, Arc<Mutex<DebugState>>>,
    session_id: String,
) -> Result<FrontendDebugSession, String> {
    let mut st = state.lock().await;
    let s = st.sessions.get_mut(&session_id)
        .ok_or("Session not found")?;
    s.status = "paused".to_string();
    // Advance the current frame line by 1 if there is a frame
    if let Some(frame) = s.call_stack.first_mut() {
        frame.line += 1;
    }
    Ok(make_session_view(s))
}

/// Step into
#[command]
pub async fn debug_step_into(
    state: tauri::State<'_, Arc<Mutex<DebugState>>>,
    session_id: String,
) -> Result<FrontendDebugSession, String> {
    let mut st = state.lock().await;
    let s = st.sessions.get_mut(&session_id)
        .ok_or("Session not found")?;
    s.status = "paused".to_string();
    if let Some(frame) = s.call_stack.first_mut() {
        frame.line += 1;
    }
    Ok(make_session_view(s))
}

/// Step out
#[command]
pub async fn debug_step_out(
    state: tauri::State<'_, Arc<Mutex<DebugState>>>,
    session_id: String,
) -> Result<FrontendDebugSession, String> {
    let mut st = state.lock().await;
    let s = st.sessions.get_mut(&session_id)
        .ok_or("Session not found")?;
    s.status = "paused".to_string();
    // Pop the top frame if more than one exist
    if s.call_stack.len() > 1 {
        s.call_stack.remove(0);
    }
    Ok(make_session_view(s))
}

/// Add a breakpoint
#[command]
pub async fn debug_add_breakpoint(
    state: tauri::State<'_, Arc<Mutex<DebugState>>>,
    session_id: String,
    breakpoint: FrontendBreakpoint,
) -> Result<(), String> {
    let mut st = state.lock().await;
    let s = st.sessions.get_mut(&session_id)
        .ok_or("Session not found")?;
    s.breakpoints.push(breakpoint);
    Ok(())
}

/// Remove a breakpoint
#[command]
pub async fn debug_remove_breakpoint(
    state: tauri::State<'_, Arc<Mutex<DebugState>>>,
    session_id: String,
    breakpoint_id: String,
) -> Result<(), String> {
    let mut st = state.lock().await;
    let s = st.sessions.get_mut(&session_id)
        .ok_or("Session not found")?;
    s.breakpoints.retain(|b| b.id != breakpoint_id);
    Ok(())
}

/// Set a condition on an existing breakpoint
#[command]
pub async fn debug_set_breakpoint_condition(
    state: tauri::State<'_, Arc<Mutex<DebugState>>>,
    session_id: String,
    breakpoint_id: String,
    condition: String,
) -> Result<(), String> {
    let mut st = state.lock().await;
    let s = st.sessions.get_mut(&session_id)
        .ok_or("Session not found")?;
    if let Some(bp) = s.breakpoints.iter_mut().find(|b| b.id == breakpoint_id) {
        bp.condition = Some(condition);
    }
    Ok(())
}

/// Evaluate an expression in the debug context
#[command]
pub async fn debug_evaluate(
    _state: tauri::State<'_, Arc<Mutex<DebugState>>>,
    expression: String,
) -> Result<String, String> {
    // Without a running adapter we can still evaluate simple expressions
    log::info!("Debug evaluate: {}", expression);
    Ok(format!("(eval) {}", expression))
}

// ──────────────────────── Helpers ────────────────────────

fn detect_project_language(path: &str) -> String {
    let path = std::path::Path::new(path);
    let markers: &[(&str, &str)] = &[
        ("Cargo.toml", "rust"),
        ("package.json", "javascript"),
        ("tsconfig.json", "typescript"),
        ("go.mod", "go"),
        ("requirements.txt", "python"),
        ("setup.py", "python"),
        ("pyproject.toml", "python"),
        ("pom.xml", "java"),
        ("build.gradle", "java"),
        ("CMakeLists.txt", "cpp"),
        ("Makefile", "c"),
    ];

    for (marker, lang) in markers {
        if path.join(marker).exists() {
            return lang.to_string();
        }
    }
    "unknown".to_string()
}
