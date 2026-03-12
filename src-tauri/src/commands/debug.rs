//! Debug Tauri Commands
//!
//! Wraps the `crate::debug` module (DAP client, session manager, breakpoints)
//! and exposes Tauri commands that match the signatures DebugPanel.tsx expects.
//!
//! Uses real DAP (Debug Adapter Protocol) subprocess communication when a
//! debug adapter binary is found on PATH (lldb-vscode, debugpy, dlv, etc.).
//! Falls back to lightweight mock session when no adapter is installed.

use serde::{Deserialize, Serialize};
use tauri::command;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::debug::{DebugClient, LaunchRequestArguments, SourceBreakpoint};
use crate::debug::client::DebugAdapterConfig;
use log::{info, warn};

// ──────────────────────── Frontend-facing types ────────────────────────

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
    pub status: String,
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
    language: String,
    threads: Vec<FrontendThread>,
    call_stack: Vec<FrontendStackFrame>,
    variables: Vec<FrontendVariable>,
    breakpoints: Vec<FrontendBreakpoint>,
    /// Real DAP client — Some when a debug adapter is available
    dap_client: Option<DebugClient>,
    /// Whether this session is backed by a real DAP adapter
    is_real_dap: bool,
}

impl Default for DebugState {
    fn default() -> Self {
        Self { sessions: HashMap::new() }
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
    let language = detect_project_language(&project_path);
    
    // Try to find and connect to a real debug adapter
    let mut dap_client = None;
    let mut is_real_dap = false;
    
    if let Some(config) = DebugAdapterConfig::for_language(&language) {
        // Check if the adapter binary exists on PATH
        if which::which(&config.command).is_ok() {
            let (tx, _rx) = tokio::sync::mpsc::channel(256);
            let mut client = DebugClient::new(tx);
            
            match client.connect(&config) {
                Ok(()) => {
                    match client.initialize().await {
                        Ok(caps) => {
                            info!("Real DAP adapter connected: {} (caps: conditional_bp={:?})", 
                                config.command, caps.supports_conditional_breakpoints);
                            
                            // Launch the debug target
                            let launch_args = LaunchRequestArguments {
                                debug_type: config.adapter_type.clone(),
                                request: "launch".to_string(),
                                name: configuration.name.clone(),
                                program: Some(project_path.clone()),
                                args: None,
                                cwd: Some(project_path.clone()),
                                env: None,
                                stop_on_entry: Some(true),
                                console: Some("integratedTerminal".to_string()),
                                internal_console_options: None,
                                no_debug: None,
                                init_commands: None,
                                pre_launch_task: None,
                                post_debug_task: None,
                                additional_properties: HashMap::new(),
                            };
                            
                            if let Err(e) = client.launch(launch_args).await {
                                warn!("DAP launch failed, using mock: {}", e);
                            } else {
                                is_real_dap = true;
                            }
                        }
                        Err(e) => warn!("DAP init failed: {}", e),
                    }
                    dap_client = Some(client);
                }
                Err(e) => warn!("Could not start debug adapter {}: {}", config.command, e),
            }
        } else {
            info!("Debug adapter {} not found on PATH, using mock session", config.command);
        }
    }
    
    let data = SessionData {
        id: session_id.clone(),
        status: if is_real_dap { "running".to_string() } else { "running".to_string() },
        language,
        threads: vec![FrontendThread { id: 1, name: "main".to_string(), stopped: false }],
        call_stack: vec![],
        variables: vec![],
        breakpoints: vec![],
        dap_client,
        is_real_dap,
    };

    let view = make_session_view(&data);
    st.sessions.insert(session_id.clone(), data);
    info!("Debug session started: {} (real_dap: {})", session_id, is_real_dap);
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
        if let Some(ref mut client) = s.dap_client {
            let _ = client.disconnect().await;
        }
        s.status = "stopped".to_string();
        info!("Debug session stopped: {}", session_id);
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
    let s = st.sessions.get_mut(&session_id).ok_or("Session not found")?;
    
    if s.is_real_dap {
        if let Some(ref mut client) = s.dap_client {
            let thread_id = s.threads.first().map(|t| t.id).unwrap_or(1);
            client.continue_execution(thread_id).await
                .map_err(|e| format!("DAP continue failed: {}", e))?;
        }
    }
    
    s.status = "running".to_string();
    for t in &mut s.threads { t.stopped = false; }
    Ok(make_session_view(s))
}

/// Pause execution
#[command]
pub async fn debug_pause(
    state: tauri::State<'_, Arc<Mutex<DebugState>>>,
    session_id: String,
) -> Result<FrontendDebugSession, String> {
    let mut st = state.lock().await;
    let s = st.sessions.get_mut(&session_id).ok_or("Session not found")?;
    
    if s.is_real_dap {
        if let Some(ref mut client) = s.dap_client {
            let thread_id = s.threads.first().map(|t| t.id).unwrap_or(1);
            client.pause(thread_id).await
                .map_err(|e| format!("DAP pause failed: {}", e))?;
        }
    }
    
    s.status = "paused".to_string();
    for t in &mut s.threads { t.stopped = true; }
    
    // Refresh stack trace from real adapter
    if s.is_real_dap {
        if let Some(ref mut client) = s.dap_client {
            let thread_id = s.threads.first().map(|t| t.id).unwrap_or(1);
            if let Ok(frames) = client.get_stack_trace(thread_id).await {
                s.call_stack = frames.iter().map(|f| FrontendStackFrame {
                    id: f.id,
                    name: f.name.clone(),
                    file: f.source.as_ref()
                        .and_then(|src| src.path.clone())
                        .unwrap_or_default(),
                    line: f.line,
                    column: f.column,
                }).collect();
            }
            // Get variables for top frame
            if let Some(frame) = s.call_stack.first() {
                if let Ok(scopes) = client.get_scopes(frame.id).await {
                    let mut vars = Vec::new();
                    for scope in &scopes {
                        if let Ok(scope_vars) = client.get_variables(scope.variables_reference).await {
                            for v in scope_vars {
                                vars.push(FrontendVariable {
                                    name: v.name,
                                    value: v.value,
                                    var_type: v.r#type.unwrap_or_default(),
                                    children: None,
                                });
                            }
                        }
                    }
                    s.variables = vars;
                }
            }
        }
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
    let s = st.sessions.get_mut(&session_id).ok_or("Session not found")?;
    
    if s.is_real_dap {
        if let Some(mut client) = s.dap_client.take() {
            let thread_id = s.threads.first().map(|t| t.id).unwrap_or(1);
            client.step_over(thread_id).await
                .map_err(|e| format!("DAP step_over failed: {}", e))?;
            refresh_stack_and_vars(&mut client, s).await;
            s.dap_client = Some(client);
        }
    } else if let Some(frame) = s.call_stack.first_mut() {
        frame.line += 1;
    }
    
    s.status = "paused".to_string();
    Ok(make_session_view(s))
}

/// Step into
#[command]
pub async fn debug_step_into(
    state: tauri::State<'_, Arc<Mutex<DebugState>>>,
    session_id: String,
) -> Result<FrontendDebugSession, String> {
    let mut st = state.lock().await;
    let s = st.sessions.get_mut(&session_id).ok_or("Session not found")?;
    
    if s.is_real_dap {
        if let Some(mut client) = s.dap_client.take() {
            let thread_id = s.threads.first().map(|t| t.id).unwrap_or(1);
            client.step_into(thread_id).await
                .map_err(|e| format!("DAP step_into failed: {}", e))?;
            refresh_stack_and_vars(&mut client, s).await;
            s.dap_client = Some(client);
        }
    } else if let Some(frame) = s.call_stack.first_mut() {
        frame.line += 1;
    }
    
    s.status = "paused".to_string();
    Ok(make_session_view(s))
}

/// Step out
#[command]
pub async fn debug_step_out(
    state: tauri::State<'_, Arc<Mutex<DebugState>>>,
    session_id: String,
) -> Result<FrontendDebugSession, String> {
    let mut st = state.lock().await;
    let s = st.sessions.get_mut(&session_id).ok_or("Session not found")?;
    
    if s.is_real_dap {
        if let Some(mut client) = s.dap_client.take() {
            let thread_id = s.threads.first().map(|t| t.id).unwrap_or(1);
            client.step_out(thread_id).await
                .map_err(|e| format!("DAP step_out failed: {}", e))?;
            refresh_stack_and_vars(&mut client, s).await;
            s.dap_client = Some(client);
        }
    } else if s.call_stack.len() > 1 {
        s.call_stack.remove(0);
    }
    
    s.status = "paused".to_string();
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
    let s = st.sessions.get_mut(&session_id).ok_or("Session not found")?;
    s.breakpoints.push(breakpoint.clone());
    
    // Send to real DAP adapter
    if s.is_real_dap {
        if let Some(ref mut client) = s.dap_client {
            let file_bps: Vec<SourceBreakpoint> = s.breakpoints.iter()
                .filter(|b| b.file == breakpoint.file && b.enabled)
                .map(|b| SourceBreakpoint {
                    line: b.line,
                    column: None,
                    condition: b.condition.clone(),
                    hit_condition: None,
                    log_message: None,
                })
                .collect();
            let _ = client.set_breakpoints(&breakpoint.file, file_bps).await;
        }
    }
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
    let s = st.sessions.get_mut(&session_id).ok_or("Session not found")?;
    
    let removed_file = s.breakpoints.iter()
        .find(|b| b.id == breakpoint_id)
        .map(|b| b.file.clone());
    
    s.breakpoints.retain(|b| b.id != breakpoint_id);
    
    // Re-send remaining breakpoints to DAP for this file
    if s.is_real_dap {
        if let (Some(ref mut client), Some(file)) = (&mut s.dap_client, removed_file) {
            let file_bps: Vec<SourceBreakpoint> = s.breakpoints.iter()
                .filter(|b| b.file == file && b.enabled)
                .map(|b| SourceBreakpoint {
                    line: b.line, column: None,
                    condition: b.condition.clone(),
                    hit_condition: None, log_message: None,
                })
                .collect();
            let _ = client.set_breakpoints(&file, file_bps).await;
        }
    }
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
    let s = st.sessions.get_mut(&session_id).ok_or("Session not found")?;
    
    let mut target_file = None;
    if let Some(bp) = s.breakpoints.iter_mut().find(|b| b.id == breakpoint_id) {
        bp.condition = Some(condition);
        target_file = Some(bp.file.clone());
    }
    
    // Re-send breakpoints with updated condition to DAP
    if s.is_real_dap {
        if let (Some(ref mut client), Some(file)) = (&mut s.dap_client, target_file) {
            let file_bps: Vec<SourceBreakpoint> = s.breakpoints.iter()
                .filter(|b| b.file == file && b.enabled)
                .map(|b| SourceBreakpoint {
                    line: b.line, column: None,
                    condition: b.condition.clone(),
                    hit_condition: None, log_message: None,
                })
                .collect();
            let _ = client.set_breakpoints(&file, file_bps).await;
        }
    }
    Ok(())
}

/// Evaluate an expression in the debug context
#[command]
pub async fn debug_evaluate(
    state: tauri::State<'_, Arc<Mutex<DebugState>>>,
    session_id: String,
    expression: String,
) -> Result<String, String> {
    let mut st = state.lock().await;
    if let Some(s) = st.sessions.get_mut(&session_id) {
        if s.is_real_dap {
            if let Some(ref mut client) = s.dap_client {
                let frame_id = s.call_stack.first().map(|f| f.id);
                return client.evaluate(&expression, frame_id, "repl").await
                    .map_err(|e| format!("Evaluate failed: {}", e));
            }
        }
    }
    Ok(format!("(eval) {}", expression))
}

// ──────────────────────── Helpers ────────────────────────

/// Refresh stack trace and variables from the real DAP client
async fn refresh_stack_and_vars(client: &mut DebugClient, s: &mut SessionData) {
    let thread_id = s.threads.first().map(|t| t.id).unwrap_or(1);
    if let Ok(frames) = client.get_stack_trace(thread_id).await {
        s.call_stack = frames.iter().map(|f| FrontendStackFrame {
            id: f.id,
            name: f.name.clone(),
            file: f.source.as_ref()
                .and_then(|src| src.path.clone())
                .unwrap_or_default(),
            line: f.line,
            column: f.column,
        }).collect();
    }
    if let Some(frame) = s.call_stack.first() {
        if let Ok(scopes) = client.get_scopes(frame.id).await {
            let mut vars = Vec::new();
            for scope in &scopes {
                if let Ok(scope_vars) = client.get_variables(scope.variables_reference).await {
                    for v in scope_vars {
                        vars.push(FrontendVariable {
                            name: v.name,
                            value: v.value,
                            var_type: v.r#type.unwrap_or_default(),
                            children: None,
                        });
                    }
                }
            }
            s.variables = vars;
        }
    }
}

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
