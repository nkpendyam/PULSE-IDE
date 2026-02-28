//! Git commands for KYRO IDE — uses types from git module

use tauri::command;
use crate::git::{GitManager, GitStatus, GitCommit, GitBranch};

#[command]
pub async fn git_status(path: String) -> Result<GitStatus, String> {
    let mgr = GitManager::new();
    mgr.status(&path)
}

#[command]
pub async fn git_commit(path: String, message: String) -> Result<String, String> {
    let mgr = GitManager::new();
    mgr.commit(&path, &message)
}

#[command]
pub async fn git_diff(path: String, staged: Option<bool>) -> Result<Vec<serde_json::Value>, String> {
    let mgr = GitManager::new();
    mgr.diff(&path, staged.unwrap_or(false))
}

#[command]
pub async fn git_log(path: String, limit: Option<usize>) -> Result<Vec<GitCommit>, String> {
    let mgr = GitManager::new();
    mgr.log(&path, limit.unwrap_or(50))
}

#[command]
pub async fn git_branch(path: String) -> Result<Vec<GitBranch>, String> {
    let mgr = GitManager::new();
    mgr.branches(&path)
}
