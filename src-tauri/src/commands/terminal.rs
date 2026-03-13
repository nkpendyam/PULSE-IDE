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
pub async fn poll_terminal_output(
    manager: State<'_, Arc<Mutex<TerminalManager>>>,
    id: String,
) -> Result<String, String> {
    let mut mgr = manager.lock().await;
    mgr.poll_terminal_output(&id)
}

#[command]
pub async fn kill_terminal(
    manager: State<'_, Arc<Mutex<TerminalManager>>>,
    id: String,
) -> Result<(), String> {
    let mut mgr = manager.lock().await;
    mgr.kill_terminal(&id)
}
