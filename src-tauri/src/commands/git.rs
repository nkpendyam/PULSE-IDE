//! Git commands for KYRO IDE

use serde::{Deserialize, Serialize};
use tauri::command;
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::git::GitManager;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitStatus {
    pub branch: String,
    pub ahead: usize,
    pub behind: usize,
    pub staged: Vec<FileStatus>,
    pub unstaged: Vec<FileStatus>,
    pub untracked: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileStatus { pub path: String, pub status: String }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitCommit { pub hash: String, pub message: String, pub author: String, pub date: String }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitBranch { pub name: String, pub is_current: bool, pub is_remote: bool }

#[command]
pub async fn git_status(manager: Arc<Mutex<GitManager>>, path: String) -> Result<GitStatus, String> {
    let mgr = manager.lock().await;
    mgr.status(&path)
}

#[command]
pub async fn git_commit(manager: Arc<Mutex<GitManager>>, path: String, message: String) -> Result<String, String> {
    let mgr = manager.lock().await;
    mgr.commit(&path, &message)
}

#[command]
pub async fn git_diff(manager: Arc<Mutex<GitManager>>, path: String, staged: Option<bool>) -> Result<Vec<serde_json::Value>, String> {
    let mgr = manager.lock().await;
    mgr.diff(&path, staged.unwrap_or(false))
}

#[command]
pub async fn git_log(manager: Arc<Mutex<GitManager>>, path: String, limit: Option<usize>) -> Result<Vec<GitCommit>, String> {
    let mgr = manager.lock().await;
    mgr.log(&path, limit.unwrap_or(50))
}

#[command]
pub async fn git_branch(manager: Arc<Mutex<GitManager>>, path: String) -> Result<Vec<GitBranch>, String> {
    let mgr = manager.lock().await;
    mgr.branches(&path)
}
