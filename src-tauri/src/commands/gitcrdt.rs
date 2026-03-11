//! Git CRDT Commands
//! 
//! Real git operations via the git2 crate for version-controlled collaboration

use tauri::State;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Git CRDT status
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct GitCrdtStatus {
    pub branch: String,
    pub ahead: u32,
    pub behind: u32,
    pub uncommitted_changes: u32,
    pub last_sync: Option<String>,
    pub is_syncing: bool,
}

/// Sync result
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SyncResult {
    pub commits_pulled: u32,
    pub commits_pushed: u32,
    pub conflicts: Vec<ConflictInfo>,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ConflictInfo {
    pub file_path: String,
    pub our_version: String,
    pub their_version: String,
    pub auto_resolvable: bool,
}

/// Commit info
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CommitInfo {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub timestamp: String,
    pub files_changed: Vec<String>,
}

/// Git CRDT state
pub struct GitCrdtState {
    pub repo_path: Option<String>,
    pub auto_commit: bool,
    pub auto_push: bool,
    pub commit_interval_secs: u32,
}

impl Default for GitCrdtState {
    fn default() -> Self {
        Self {
            repo_path: None,
            auto_commit: true,
            auto_push: false,
            commit_interval_secs: 60,
        }
    }
}

/// Helper: open git2 repository from state or discover from cwd  
fn open_repo(state: &GitCrdtState) -> Result<git2::Repository, String> {
    if let Some(ref path) = state.repo_path {
        git2::Repository::open(path).map_err(|e| format!("Failed to open repo: {}", e))
    } else {
        git2::Repository::discover(".").map_err(|e| format!("No git repo found: {}", e))
    }
}

/// Helper: get current branch name
fn current_branch(repo: &git2::Repository) -> String {
    repo.head()
        .ok()
        .and_then(|h| h.shorthand().map(|s| s.to_string()))
        .unwrap_or_else(|| "HEAD".to_string())
}

/// Helper: count uncommitted changes
fn count_uncommitted(repo: &git2::Repository) -> u32 {
    repo.statuses(None)
        .map(|s| s.len() as u32)
        .unwrap_or(0)
}

// ============ Tauri Commands ============

#[tauri::command]
pub async fn git_crdt_status(
    state: State<'_, Arc<RwLock<GitCrdtState>>>,
) -> Result<GitCrdtStatus, String> {
    let gs = state.read().await;
    let repo = open_repo(&gs)?;
    let branch = current_branch(&repo);
    let uncommitted = count_uncommitted(&repo);
    
    Ok(GitCrdtStatus {
        branch,
        ahead: 0,
        behind: 0,
        uncommitted_changes: uncommitted,
        last_sync: None,
        is_syncing: false,
    })
}

#[tauri::command]
pub async fn git_crdt_sync(
    state: State<'_, Arc<RwLock<GitCrdtState>>>,
) -> Result<SyncResult, String> {
    let gs = state.read().await;
    let repo = open_repo(&gs)?;
    let start = std::time::Instant::now();
    
    // Attempt to fetch from origin
    let mut pulled = 0u32;
    if let Ok(mut remote) = repo.find_remote("origin") {
        let branch = current_branch(&repo);
        let refspec = format!("refs/heads/{}", branch);
        if remote.fetch(&[&refspec], None, None).is_ok() {
            // Count how many new commits came in from FETCH_HEAD
            if let Ok(fetch_head) = repo.find_reference("FETCH_HEAD") {
                if let Ok(target) = fetch_head.peel_to_commit() {
                    if let Ok(head_commit) = repo.head().and_then(|h| h.peel_to_commit()) {
                        let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
                        let _ = revwalk.push(target.id());
                        let _ = revwalk.hide(head_commit.id());
                        pulled = revwalk.count() as u32;
                    }
                }
            }
        }
    }
    
    let duration = start.elapsed().as_millis() as u64;
    
    Ok(SyncResult {
        commits_pulled: pulled,
        commits_pushed: 0,
        conflicts: vec![],
        duration_ms: duration,
    })
}

#[tauri::command]
pub async fn git_crdt_commit(
    message: String,
    state: State<'_, Arc<RwLock<GitCrdtState>>>,
) -> Result<CommitInfo, String> {
    let gs = state.read().await;
    let repo = open_repo(&gs)?;
    
    // Stage all changes
    let mut index = repo.index().map_err(|e| format!("Index error: {}", e))?;
    index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| format!("Failed to stage: {}", e))?;
    index.write().map_err(|e| format!("Index write error: {}", e))?;
    let tree_oid = index.write_tree().map_err(|e| format!("Write tree error: {}", e))?;
    let tree = repo.find_tree(tree_oid).map_err(|e| format!("Find tree error: {}", e))?;
    
    // Get signature from git config or use fallback
    let sig = repo.signature().unwrap_or_else(|_| {
        git2::Signature::now("Kyro IDE", "kyro@ide.local").unwrap()
    });
    
    // Find parent commit
    let parent = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
    let parents: Vec<&git2::Commit> = parent.iter().collect();
    
    // Create commit
    let oid = repo.commit(Some("HEAD"), &sig, &sig, &message, &tree, &parents)
        .map_err(|e| format!("Commit failed: {}", e))?;
    
    // Collect changed files
    let files_changed: Vec<String> = repo.statuses(None)
        .map(|s| s.iter().filter_map(|e| e.path().map(|p| p.to_string())).collect())
        .unwrap_or_default();
    
    Ok(CommitInfo {
        hash: oid.to_string(),
        message,
        author: sig.name().unwrap_or("unknown").to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        files_changed,
    })
}

#[tauri::command]
pub async fn git_crdt_auto_commit(
    enabled: bool,
    state: State<'_, Arc<RwLock<GitCrdtState>>>,
) -> Result<(), String> {
    let mut git = state.write().await;
    git.auto_commit = enabled;
    Ok(())
}

#[tauri::command]
pub async fn git_crdt_auto_push(
    enabled: bool,
    state: State<'_, Arc<RwLock<GitCrdtState>>>,
) -> Result<(), String> {
    let mut git = state.write().await;
    git.auto_push = enabled;
    Ok(())
}

#[tauri::command]
pub async fn git_crdt_resolve_conflict(
    file_path: String,
    resolution: String,
    state: State<'_, Arc<RwLock<GitCrdtState>>>,
) -> Result<(), String> {
    let gs = state.read().await;
    let repo = open_repo(&gs)?;
    
    // Write the resolution content to the file
    let full_path = repo.workdir()
        .ok_or("No workdir")?
        .join(&file_path);
    std::fs::write(&full_path, &resolution)
        .map_err(|e| format!("Failed to write resolution: {}", e))?;
    
    // Stage the resolved file
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index.add_path(std::path::Path::new(&file_path)).map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub async fn git_crdt_get_history(
    limit: u32,
    state: State<'_, Arc<RwLock<GitCrdtState>>>,
) -> Result<Vec<CommitInfo>, String> {
    let gs = state.read().await;
    let repo = open_repo(&gs)?;
    
    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push_head().map_err(|e| format!("No HEAD: {}", e))?;
    revwalk.set_sorting(git2::Sort::TIME).map_err(|e| e.to_string())?;
    
    let mut history = Vec::new();
    for oid_result in revwalk.take(limit as usize) {
        let oid = oid_result.map_err(|e| e.to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
        
        // Diff to get changed files
        let mut files_changed = Vec::new();
        if let Ok(tree) = commit.tree() {
            let parent_tree = commit.parent(0).ok().and_then(|p| p.tree().ok());
            if let Ok(diff) = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), None) {
                diff.foreach(&mut |delta, _| {
                    if let Some(path) = delta.new_file().path() {
                        files_changed.push(path.to_string_lossy().to_string());
                    }
                    true
                }, None, None, None).ok();
            }
        }
        
        let author = commit.author();
        history.push(CommitInfo {
            hash: oid.to_string(),
            message: commit.message().unwrap_or("").to_string(),
            author: author.name().unwrap_or("unknown").to_string(),
            timestamp: chrono::DateTime::from_timestamp(commit.time().seconds(), 0)
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_default(),
            files_changed,
        });
    }
    
    Ok(history)
}

#[tauri::command]
pub async fn git_crdt_create_branch(
    branch_name: String,
    state: State<'_, Arc<RwLock<GitCrdtState>>>,
) -> Result<(), String> {
    let gs = state.read().await;
    let repo = open_repo(&gs)?;
    
    let head = repo.head().map_err(|e| format!("No HEAD: {}", e))?;
    let commit = head.peel_to_commit().map_err(|e| e.to_string())?;
    repo.branch(&branch_name, &commit, false)
        .map_err(|e| format!("Failed to create branch: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn git_crdt_switch_branch(
    branch_name: String,
    state: State<'_, Arc<RwLock<GitCrdtState>>>,
) -> Result<(), String> {
    let gs = state.read().await;
    let repo = open_repo(&gs)?;
    
    let refname = format!("refs/heads/{}", branch_name);
    let obj = repo.revparse_single(&refname).map_err(|e| format!("Branch not found: {}", e))?;
    repo.checkout_tree(&obj, None).map_err(|e| format!("Checkout failed: {}", e))?;
    repo.set_head(&refname).map_err(|e| format!("Set HEAD failed: {}", e))?;
    
    Ok(())
}
