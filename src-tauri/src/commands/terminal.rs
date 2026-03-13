//! Terminal commands for KYRO IDE

use crate::terminal::TerminalManager;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{command, State};
use tokio::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TerminalInfo {
    pub id: String,
    pub shell: String,
    pub cwd: String,
}

#[command]
pub async fn create_terminal(
    manager: State<'_, Arc<Mutex<TerminalManager>>>,
    id: String,
    cwd: Option<String>,
) -> Result<TerminalInfo, String> {
    let mut mgr = manager.lock().await;
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
    let cwd = cwd.unwrap_or_else(|| std::env::var("HOME").unwrap_or_else(|_| ".".to_string()));
    mgr.create_terminal(&id, &cwd)?;
    Ok(TerminalInfo { id, shell, cwd })
}

#[command]
pub async fn write_to_terminal(
    manager: State<'_, Arc<Mutex<TerminalManager>>>,
    id: String,
    data: String,
) -> Result<(), String> {
    let mut mgr = manager.lock().await;
    mgr.write_to_terminal(&id, &data)
}

#[command]
pub async fn resize_terminal(
    manager: State<'_, Arc<Mutex<TerminalManager>>>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let mut mgr = manager.lock().await;
    mgr.resize_terminal(&id, cols, rows)
}

#[command]
pub async fn kill_terminal(
    manager: State<'_, Arc<Mutex<TerminalManager>>>,
    id: String,
) -> Result<(), String> {
    let mut mgr = manager.lock().await;
    mgr.kill_terminal(&id)
}

/// Run a one-shot terminal command and capture its output.
/// Used by DeployPanel, NotebookPanel, and similar features.
#[derive(Debug, Serialize, Deserialize)]
pub struct CommandOutput {
    pub output: String,
    pub exit_code: i32,
}

#[command]
pub async fn run_terminal_command(command: String) -> Result<CommandOutput, String> {
    use std::process::Command;

    let (shell, flag) = if cfg!(windows) {
        ("cmd", "/C")
    } else {
        ("sh", "-c")
    };

    let result = Command::new(shell)
        .arg(flag)
        .arg(&command)
        .output()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    let stdout = String::from_utf8_lossy(&result.stdout).to_string();
    let stderr = String::from_utf8_lossy(&result.stderr).to_string();
    let combined = if stderr.is_empty() {
        stdout
    } else if stdout.is_empty() {
        stderr
    } else {
        format!("{}\n{}", stdout, stderr)
    };

    let exit_code = result.status.code().unwrap_or(-1);

    Ok(CommandOutput {
        output: combined,
        exit_code,
    })
}
