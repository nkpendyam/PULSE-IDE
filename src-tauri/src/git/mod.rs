//! Git integration for KYRO IDE

use git2::{Repository, Status, StatusOptions};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatus {
    pub branch: String,
    pub ahead: usize,
    pub behind: usize,
    pub staged: Vec<FileStatus>,
    pub unstaged: Vec<FileStatus>,
    pub untracked: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileStatus { pub path: String, pub status: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitCommit { pub hash: String, pub message: String, pub author: String, pub date: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitBranch { pub name: String, pub is_current: bool, pub is_remote: bool }

pub struct GitManager;

impl GitManager {
    pub fn new() -> Self { Self }
    
    pub fn status(&self, path: &str) -> Result<GitStatus, String> {
        let repo = Repository::discover(Path::new(path)).map_err(|e| format!("Not a git repository: {}", e))?;
        let head = repo.head().map_err(|e| format!("Failed to get HEAD: {}", e))?;
        let branch = head.shorthand().unwrap_or("HEAD").to_string();
        let mut opts = StatusOptions::new();
        opts.include_untracked(true).recurse_untracked_dirs(true);
        let statuses = repo.statuses(Some(&mut opts)).map_err(|e| format!("Failed to get status: {}", e))?;
        let mut staged = Vec::new();
        let mut unstaged = Vec::new();
        let mut untracked = Vec::new();
        for entry in statuses.iter() {
            let path = entry.path().unwrap_or("").to_string();
            let status = entry.status();
            if status.contains(Status::INDEX_NEW | Status::INDEX_MODIFIED | Status::INDEX_DELETED) {
                staged.push(FileStatus { path: path.clone(), status: "modified".to_string() });
            } else if status.contains(Status::WT_NEW) {
                untracked.push(path);
            } else if status.contains(Status::WT_MODIFIED | Status::WT_DELETED) {
                unstaged.push(FileStatus { path, status: "modified".to_string() });
            }
        }
        Ok(GitStatus { branch, ahead: 0, behind: 0, staged, unstaged, untracked })
    }
    
    pub fn commit(&self, path: &str, message: &str) -> Result<String, String> {
        let repo = Repository::discover(Path::new(path)).map_err(|e| format!("Not a git repository: {}", e))?;
        let mut index = repo.index().map_err(|e| format!("Failed to get index: {}", e))?;
        index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None).map_err(|e| format!("Failed to stage: {}", e))?;
        index.write().map_err(|e| format!("Failed to write index: {}", e))?;
        let tree_id = index.write_tree().map_err(|e| format!("Failed to write tree: {}", e))?;
        let tree = repo.find_tree(tree_id).map_err(|e| format!("Failed to find tree: {}", e))?;
        let sig = repo.signature().map_err(|e| format!("Failed to get signature: {}", e))?;
        let parent = repo.head().ok().and_then(|h| h.target()).and_then(|oid| repo.find_commit(oid).ok());
        let parents: Vec<_> = parent.iter().collect();
        let commit_id = repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &parents).map_err(|e| format!("Failed to commit: {}", e))?;
        Ok(commit_id.to_string())
    }
    
    pub fn diff(&self, _path: &str, _staged: bool) -> Result<Vec<serde_json::Value>, String> { Ok(vec![]) }
    
    pub fn log(&self, path: &str, limit: usize) -> Result<Vec<GitCommit>, String> {
        let repo = Repository::discover(Path::new(path)).map_err(|e| format!("Not a git repository: {}", e))?;
        let mut revwalk = repo.revwalk().map_err(|e| format!("Failed to create revwalk: {}", e))?;
        revwalk.push_head().map_err(|e| format!("Failed to push HEAD: {}", e))?;
        let mut commits = Vec::new();
        for (i, oid_result) in revwalk.enumerate() {
            if i >= limit { break; }
            let oid = oid_result.map_err(|e| format!("Failed to get OID: {}", e))?;
            let commit = repo.find_commit(oid).map_err(|e| format!("Failed to find commit: {}", e))?;
            commits.push(GitCommit {
                hash: commit.id().to_string()[..7].to_string(),
                message: commit.message().unwrap_or("").to_string(),
                author: commit.author().name().unwrap_or("Unknown").to_string(),
                date: commit.time().seconds().to_string(),
            });
        }
        Ok(commits)
    }
    
    pub fn branches(&self, path: &str) -> Result<Vec<GitBranch>, String> {
        let repo = Repository::discover(Path::new(path)).map_err(|e| format!("Not a git repository: {}", e))?;
        let head = repo.head().ok().and_then(|h| h.shorthand().map(|s| s.to_string()));
        let branches = repo.branches(None).map_err(|e| format!("Failed to list branches: {}", e))?;
        let mut result = Vec::new();
        for branch_result in branches {
            let (branch, branch_type) = branch_result.map_err(|e| format!("Failed to get branch: {}", e))?;
            let name = branch.name().map_err(|e| format!("Failed to get branch name: {}", e))?.unwrap_or("").to_string();
            result.push(GitBranch {
                is_current: head.as_ref() == Some(&name),
                is_remote: branch_type == git2::BranchType::Remote,
                name,
            });
        }
        Ok(result)
    }
}

impl Default for GitManager {
    fn default() -> Self { Self::new() }
}
