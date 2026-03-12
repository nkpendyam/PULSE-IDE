//! Git commands for KYRO IDE — uses types from git module

use crate::git::{BlameLine, FileDiff, GitBranch, GitCommit, GitManager, GitStatus, StashEntry};
use tauri::command;

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

#[command]
pub async fn git_stage(project_path: String, file_path: String) -> Result<(), String> {
    let mgr = GitManager::new();
    mgr.stage(&project_path, &file_path)
}

#[command]
pub async fn git_unstage(project_path: String, file_path: String) -> Result<(), String> {
    let mgr = GitManager::new();
    mgr.unstage(&project_path, &file_path)
}

#[command]
pub async fn git_stage_all(project_path: String) -> Result<(), String> {
    let mgr = GitManager::new();
    mgr.stage_all(&project_path)
}

#[command]
pub async fn git_unstage_all(project_path: String) -> Result<(), String> {
    let mgr = GitManager::new();
    mgr.unstage_all(&project_path)
}

#[command]
pub async fn git_discard(project_path: String, file_path: String) -> Result<(), String> {
    let mgr = GitManager::new();
    mgr.discard(&project_path, &file_path)
}

#[command]
pub async fn git_stage_hunk(
    project_path: String,
    file_path: String,
    hunk_index: usize,
) -> Result<(), String> {
    let mgr = GitManager::new();
    mgr.stage_hunk(&project_path, &file_path, hunk_index)
}
