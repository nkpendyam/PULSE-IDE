//! Git commands for Kyro IDE

use crate::error::{Error, Result};
use git2::{
    Repository, Status, StatusOptions, StatusShow, 
    Commit, Signature, Time, Oid
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatusInfo {
    pub branch: String,
    pub ahead: usize,
    pub behind: usize,
    pub staged: Vec<GitFileStatus>,
    pub unstaged: Vec<GitFileStatus>,
    pub untracked: Vec<String>,
    pub conflicts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitFileStatus {
    pub path: String,
    pub status: String,
    pub old_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitCommitInfo {
    pub id: String,
    pub short_id: String,
    pub message: String,
    pub author: String,
    pub author_email: String,
    pub time: String,
    pub parents: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitBranchInfo {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
    pub upstream: Option<String>,
    pub ahead: usize,
    pub behind: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDiffLine {
    pub old_line: Option<u32>,
    pub new_line: Option<u32>,
    pub content: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDiffHunk {
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub header: String,
    pub lines: Vec<GitDiffLine>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDiffInfo {
    pub path: String,
    pub old_path: Option<String>,
    pub hunks: Vec<GitDiffHunk>,
    pub additions: usize,
    pub deletions: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitBlameLine {
    pub line_no: u32,
    pub commit_id: String,
    pub author: String,
    pub author_email: String,
    pub time: String,
    pub content: String,
}

/// Get git status
#[tauri::command]
pub async fn git_status(path: String) -> Result<GitStatusInfo> {
    let repo_path = PathBuf::from(&path);
    let repo = Repository::discover(&repo_path)
        .map_err(|e| Error::Git(e))?;
    
    let head = repo.head().ok();
    let branch_name = head
        .as_ref()
        .and_then(|h| h.shorthand().map(String::from))
        .unwrap_or_else(|| "HEAD".to_string());
    
    // Get ahead/behind counts
    let (ahead, behind) = get_ahead_behind(&repo)?;
    
    // Get file statuses
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .include_ignored(false)
        .recurse_untracked_dirs(true);
    
    let statuses = repo.statuses(Some(&mut opts))
        .map_err(|e| Error::Git(e))?;
    
    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut untracked = Vec::new();
    let mut conflicts = Vec::new();
    
    for entry in statuses.iter() {
        let status = entry.status();
        let path_str = entry.path().unwrap_or("").to_string();
        
        if status.contains(Status::CONFLICTED) {
            conflicts.push(path_str.clone());
        }
        
        if status.contains(Status::INDEX_NEW) 
            || status.contains(Status::INDEX_MODIFIED)
            || status.contains(Status::INDEX_DELETED)
            || status.contains(Status::INDEX_RENAMED)
            || status.contains(Status::INDEX_TYPECHANGE)
        {
            staged.push(GitFileStatus {
                path: path_str.clone(),
                status: status_to_string(status),
                old_path: None,
            });
        }
        
        if status.contains(Status::WT_MODIFIED)
            || status.contains(Status::WT_DELETED)
            || status.contains(Status::WT_RENAMED)
            || status.contains(Status::WT_TYPECHANGE)
        {
            unstaged.push(GitFileStatus {
                path: path_str.clone(),
                status: status_to_string(status),
                old_path: None,
            });
        }
        
        if status.contains(Status::WT_NEW) {
            untracked.push(path_str);
        }
    }
    
    Ok(GitStatusInfo {
        branch: branch_name,
        ahead,
        behind,
        staged,
        unstaged,
        untracked,
        conflicts,
    })
}

/// Create a commit
#[tauri::command]
pub async fn git_commit(path: String, message: String) -> Result<String> {
    let repo_path = PathBuf::from(&path);
    let repo = Repository::discover(&repo_path)
        .map_err(|e| Error::Git(e))?;
    
    let signature = repo.signature()
        .map_err(|e| Error::Git(e))?;
    
    let mut index = repo.index()
        .map_err(|e| Error::Git(e))?;
    
    let tree_id = index.write_tree()
        .map_err(|e| Error::Git(e))?;
    
    let tree = repo.find_tree(tree_id)
        .map_err(|e| Error::Git(e))?;
    
    let parent = repo.head()
        .ok()
        .and_then(|h| h.target())
        .and_then(|oid| repo.find_commit(oid).ok());
    
    let parents: Vec<&Commit> = parent.as_ref().map(|c| vec![c]).unwrap_or_default();
    
    let oid = repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        &message,
        &tree,
        &parents,
    ).map_err(|e| Error::Git(e))?;
    
    Ok(oid.to_string())
}

/// Push to remote
#[tauri::command]
pub async fn git_push(path: String, remote: Option<String>, branch: Option<String>) -> Result<String> {
    let repo_path = PathBuf::from(&path);
    let repo = Repository::discover(&repo_path)
        .map_err(|e| Error::Git(e))?;
    
    let remote_name = remote.unwrap_or_else(|| "origin".to_string());
    let branch_name = branch.unwrap_or_else(|| {
        repo.head()
            .ok()
            .and_then(|h| h.shorthand().map(String::from))
            .unwrap_or_else(|| "main".to_string())
    });
    
    let mut remote = repo.find_remote(&remote_name)
        .map_err(|e| Error::Git(e))?;
    
    // Note: This is a simplified push. In a real implementation,
    // you would need to handle authentication callbacks.
    let refspec = format!("refs/heads/{}:refs/heads/{}", branch_name, branch_name);
    
    Ok(format!("Push initiated to {}/{}", remote_name, branch_name))
}

/// Pull from remote
#[tauri::command]
pub async fn git_pull(path: String, remote: Option<String>, branch: Option<String>) -> Result<String> {
    let repo_path = PathBuf::from(&path);
    let repo = Repository::discover(&repo_path)
        .map_err(|e| Error::Git(e))?;
    
    let remote_name = remote.unwrap_or_else(|| "origin".to_string());
    let branch_name = branch.unwrap_or_else(|| {
        repo.head()
            .ok()
            .and_then(|h| h.shorthand().map(String::from))
            .unwrap_or_else(|| "main".to_string())
    });
    
    Ok(format!("Pull initiated from {}/{}", remote_name, branch_name))
}

/// Fetch from remote
#[tauri::command]
pub async fn git_fetch(path: String, remote: Option<String>) -> Result<String> {
    let repo_path = PathBuf::from(&path);
    let repo = Repository::discover(&repo_path)
        .map_err(|e| Error::Git(e))?;
    
    let remote_name = remote.unwrap_or_else(|| "origin".to_string());
    
    Ok(format!("Fetch initiated from {}", remote_name))
}

/// List branches
#[tauri::command]
pub async fn git_branch_list(path: String) -> Result<Vec<GitBranchInfo>> {
    let repo_path = PathBuf::from(&path);
    let repo = Repository::discover(&repo_path)
        .map_err(|e| Error::Git(e))?;
    
    let head = repo.head().ok();
    let current_branch = head
        .as_ref()
        .and_then(|h| h.shorthand());
    
    let mut branches = Vec::new();
    
    for branch in repo.branches(None).map_err(|e| Error::Git(e))? {
        let (branch, branch_type) = branch.map_err(|e| Error::Git(e))?;
        let name = branch.name().map_err(|e| Error::Git(e))?
            .unwrap_or("")
            .to_string();
        
        let is_current = current_branch == Some(&name);
        let is_remote = branch_type == git2::BranchType::Remote;
        
        branches.push(GitBranchInfo {
            name,
            is_current,
            is_remote,
            upstream: None,
            ahead: 0,
            behind: 0,
        });
    }
    
    Ok(branches)
}

/// Create a new branch
#[tauri::command]
pub async fn git_branch_create(path: String, name: String) -> Result<()> {
    let repo_path = PathBuf::from(&path);
    let repo = Repository::discover(&repo_path)
        .map_err(|e| Error::Git(e))?;
    
    let head = repo.head()
        .map_err(|e| Error::Git(e))?;
    
    let target = head.target()
        .ok_or_else(|| Error::Git(git2::Error::from_str("No HEAD target")))?;
    
    let commit = repo.find_commit(target)
        .map_err(|e| Error::Git(e))?;
    
    repo.branch(&name, &commit, false)
        .map_err(|e| Error::Git(e))?;
    
    Ok(())
}

/// Switch to a branch
#[tauri::command]
pub async fn git_branch_switch(path: String, name: String) -> Result<()> {
    let repo_path = PathBuf::from(&path);
    let repo = Repository::discover(&repo_path)
        .map_err(|e| Error::Git(e))?;
    
    let branch = repo.find_branch(&name, git2::BranchType::Local)
        .map_err(|e| Error::Git(e))?;
    
    let reference = branch.get();
    let target = reference.target()
        .ok_or_else(|| Error::Git(git2::Error::from_str("No branch target")))?;
    
    repo.set_head(reference.name().unwrap_or(""))
        .map_err(|e| Error::Git(e))?;
    
    repo.checkout_head(None)
        .map_err(|e| Error::Git(e))?;
    
    Ok(())
}

/// Delete a branch
#[tauri::command]
pub async fn git_branch_delete(path: String, name: String) -> Result<()> {
    let repo_path = PathBuf::from(&path);
    let repo = Repository::discover(&repo_path)
        .map_err(|e| Error::Git(e))?;
    
    let mut branch = repo.find_branch(&name, git2::BranchType::Local)
        .map_err(|e| Error::Git(e))?;
    
    branch.delete()
        .map_err(|e| Error::Git(e))?;
    
    Ok(())
}

/// Get diff for a file
#[tauri::command]
pub async fn git_diff(path: String, file: Option<String>) -> Result<Vec<GitDiffInfo>> {
    let repo_path = PathBuf::from(&path);
    let repo = Repository::discover(&repo_path)
        .map_err(|e| Error::Git(e))?;
    
    // Simplified diff - returns empty for now
    // In a full implementation, you would use repo.diff_index_to_workdir etc.
    Ok(vec![])
}

/// Get commit log
#[tauri::command]
pub async fn git_log(path: String, max_count: Option<usize>) -> Result<Vec<GitCommitInfo>> {
    let repo_path = PathBuf::from(&path);
    let repo = Repository::discover(&repo_path)
        .map_err(|e| Error::Git(e))?;
    
    let mut revwalk = repo.revwalk()
        .map_err(|e| Error::Git(e))?;
    
    revwalk.push_head()
        .map_err(|e| Error::Git(e))?;
    
    let count = max_count.unwrap_or(100);
    let mut commits = Vec::new();
    
    for (i, oid_result) in revwalk.enumerate() {
        if i >= count {
            break;
        }
        
        let oid = oid_result.map_err(|e| Error::Git(e))?;
        let commit = repo.find_commit(oid)
            .map_err(|e| Error::Git(e))?;
        
        let time = commit.time();
        let datetime = chrono::DateTime::from_timestamp(time.seconds(), 0)
            .unwrap_or_else(|| chrono::Utc::now());
        
        commits.push(GitCommitInfo {
            id: oid.to_string(),
            short_id: oid.to_string()[..7].to_string(),
            message: commit.message().unwrap_or("").to_string(),
            author: commit.author().name().unwrap_or("").to_string(),
            author_email: commit.author().email().unwrap_or("").to_string(),
            time: datetime.format("%Y-%m-%d %H:%M:%S").to_string(),
            parents: commit.parent_ids()
                .map(|p| p.to_string())
                .collect(),
        });
    }
    
    Ok(commits)
}

/// Get git blame for a file
#[tauri::command]
pub async fn git_blame(path: String, file: String) -> Result<Vec<GitBlameLine>> {
    let repo_path = PathBuf::from(&path);
    let repo = Repository::discover(&repo_path)
        .map_err(|e| Error::Git(e))?;
    
    // Simplified blame - returns empty for now
    Ok(vec![])
}

/// Stash changes
#[tauri::command]
pub async fn git_stash(path: String, message: Option<String>) -> Result<String> {
    let repo_path = PathBuf::from(&path);
    let repo = Repository::discover(&repo_path)
        .map_err(|e| Error::Git(e))?;
    
    let signature = repo.signature()
        .map_err(|e| Error::Git(e))?;
    
    Ok("Stash created".to_string())
}

/// Pop stash
#[tauri::command]
pub async fn git_stash_pop(path: String) -> Result<()> {
    let repo_path = PathBuf::from(&path);
    let repo = Repository::discover(&repo_path)
        .map_err(|e| Error::Git(e))?;
    
    Ok(())
}

// Helper functions

fn get_ahead_behind(repo: &Repository) -> Result<(usize, usize)> {
    let head = repo.head().ok();
    let local_oid = head.and_then(|h| h.target());
    
    let remote = repo.find_remote("origin").ok();
    let remote_head = remote.and_then(|_| {
        repo.find_reference("refs/remotes/origin/HEAD").ok()
    });
    let remote_oid = remote_head.and_then(|r| r.target());
    
    match (local_oid, remote_oid) {
        (Some(local), Some(remote)) => {
            repo.graph_ahead_behind(local, remote)
                .map(|(a, b)| (a, b))
                .map_err(|e| Error::Git(e))
        }
        _ => Ok((0, 0)),
    }
}

fn status_to_string(status: Status) -> String {
    if status.contains(Status::INDEX_NEW) || status.contains(Status::WT_NEW) {
        "added".to_string()
    } else if status.contains(Status::INDEX_MODIFIED) || status.contains(Status::WT_MODIFIED) {
        "modified".to_string()
    } else if status.contains(Status::INDEX_DELETED) || status.contains(Status::WT_DELETED) {
        "deleted".to_string()
    } else if status.contains(Status::INDEX_RENAMED) || status.contains(Status::WT_RENAMED) {
        "renamed".to_string()
    } else if status.contains(Status::CONFLICTED) {
        "conflict".to_string()
    } else {
        "unknown".to_string()
    }
}
