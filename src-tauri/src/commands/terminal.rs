//! Terminal commands for KYRO IDE

use serde::{Deserialize, Serialize};
use tauri::command;
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::terminal::TerminalManager;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TerminalInfo {
    pub id: String,
    pub shell: String,
    pub cwd: String,
}

#[command]
pub async fn create_terminal(manager: Arc<Mutex<TerminalManager>>, id: String, cwd: Option<String>) -> Result<TerminalInfo, String> {
    let mut mgr = manager.lock().await;
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
    let cwd = cwd.unwrap_or_else(|| std::env::var("HOME").unwrap_or_else(|_| ".".to_string()));
    mgr.create_terminal(&id, &cwd)?;
    Ok(TerminalInfo { id, shell, cwd })
}

#[command]
pub async fn write_to_terminal(manager: Arc<Mutex<TerminalManager>>, id: String, data: String) -> Result<(), String> {
    let mut mgr = manager.lock().await;
    mgr.write_to_terminal(&id, &data)
}

#[command]
pub async fn resize_terminal(manager: Arc<Mutex<TerminalManager>>, id: String, cols: u16, rows: u16) -> Result<(), String> {
    let mut mgr = manager.lock().await;
    mgr.resize_terminal(&id, cols, rows)
}

#[command]
pub async fn kill_terminal(manager: Arc<Mutex<TerminalManager>>, id: String) -> Result<(), String> {
    let mut mgr = manager.lock().await;
    mgr.kill_terminal(&id)
}
