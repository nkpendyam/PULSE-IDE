//! Git commands for KYRO IDE — uses types from git module

use tauri::command;
use crate::git::{GitManager, GitStatus, GitCommit, GitBranch, FileDiff, BlameLine, StashEntry};

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
pub async fn git_diff(path: String, staged: Option<bool>) -> Result<Vec<FileDiff>, String> {
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

#[command]
pub async fn git_blame(path: String, file: String) -> Result<Vec<BlameLine>, String> {
    let mgr = GitManager::new();
    mgr.blame(&path, &file)
}

#[command]
pub async fn git_stash(path: String, message: Option<String>) -> Result<String, String> {
    let mgr = GitManager::new();
    mgr.stash(&path, message.as_deref())
}

#[command]
pub async fn git_stash_pop(path: String) -> Result<(), String> {
    let mgr = GitManager::new();
    mgr.stash_pop(&path)
}

#[command]
pub async fn git_stash_list(path: String) -> Result<Vec<StashEntry>, String> {
    let mgr = GitManager::new();
    mgr.stash_list(&path)
}

#[command]
pub async fn git_merge(path: String, branch: String) -> Result<String, String> {
    let mgr = GitManager::new();
    mgr.merge(&path, &branch)
}
