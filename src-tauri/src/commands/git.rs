use serde::{Deserialize, Serialize};
use git2::{Repository, Status, StatusOptions, Oid};

#[derive(Debug, Serialize, Deserialize)]
pub struct GitStatus {
    pub branch: String,
    pub ahead: usize,
    pub behind: usize,
    pub staged: Vec<String>,
    pub unstaged: Vec<String>,
    pub untracked: Vec<String>,
    pub conflicts: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitCommit {
    pub id: String,
    pub message: String,
    pub author: String,
    pub email: String,
    pub time: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitBranch {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
}

/// Get git status for a repository
#[tauri::command]
pub async fn git_status(path: String) -> Result<GitStatus, String> {
    let repo = Repository::discover(&path)
        .map_err(|e| format!("Failed to find repository: {}", e))?;
    
    let head = repo.head()
        .map_err(|e| format!("Failed to get HEAD: {}", e))?;
    
    let branch_name = head.shorthand()
        .unwrap_or("HEAD")
        .to_string();
    
    // Get status
    let mut status_opts = StatusOptions::new();
    status_opts.include_untracked(true);
    status_opts.include_ignored(false);
    status_opts.recurse_untracked_dirs(true);
    
    let statuses = repo.statuses(Some(&mut status_opts))
        .map_err(|e| format!("Failed to get status: {}", e))?;
    
    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut untracked = Vec::new();
    let mut conflicts = Vec::new();
    
    for entry in statuses.iter() {
        let status = entry.status();
        let path = entry.path().unwrap_or("").to_string();
        
        if status.contains(Status::CONFLICTED) {
            conflicts.push(path);
        } else if status.contains(Status::INDEX_NEW) | status.contains(Status::INDEX_MODIFIED) | status.contains(Status::INDEX_DELETED) {
            staged.push(path);
        } else if status.contains(Status::WT_NEW) {
            untracked.push(path);
        } else if status.contains(Status::WT_MODIFIED) | status.contains(Status::WT_DELETED) {
            unstaged.push(path);
        }
    }
    
    // Get ahead/behind count
    let mut ahead = 0;
    let mut behind = 0;
    
    if let Ok(local) = head.target() {
        if let Ok(remote) = repo.find_reference("refs/remotes/origin/HEAD") {
            if let Ok(remote_target) = remote.target() {
                let _ = repo.graph_ahead_behind(local, remote_target, &mut ahead, &mut behind);
            }
        }
    }
    
    Ok(GitStatus {
        branch: branch_name,
        ahead,
        behind,
        staged,
        unstaged,
        untracked,
        conflicts,
    })
}

/// Get commit log
#[tauri::command]
pub async fn git_log(path: String, limit: usize) -> Result<Vec<GitCommit>, String> {
    let repo = Repository::discover(&path)
        .map_err(|e| format!("Failed to find repository: {}", e))?;
    
    let mut revwalk = repo.revwalk()
        .map_err(|e| format!("Failed to create revwalk: {}", e))?;
    
    revwalk.push_head()
        .map_err(|e| format!("Failed to push HEAD: {}", e))?;
    
    let mut commits = Vec::new();
    
    for (i, oid_result) in revwalk.enumerate() {
        if i >= limit {
            break;
        }
        
        let oid = oid_result.map_err(|e| format!("Failed to get OID: {}", e))?;
        let commit = repo.find_commit(oid)
            .map_err(|e| format!("Failed to find commit: {}", e))?;
        
        commits.push(GitCommit {
            id: oid.to_string(),
            message: commit.message().unwrap_or("").to_string(),
            author: commit.author().name().unwrap_or("Unknown").to_string(),
            email: commit.author().email().unwrap_or("").to_string(),
            time: commit.time().seconds(),
        });
    }
    
    Ok(commits)
}

/// Get diff for a file
#[tauri::command]
pub async fn git_diff(path: String, file: Option<String>) -> Result<String, String> {
    let repo = Repository::discover(&path)
        .map_err(|e| format!("Failed to find repository: {}", e))?;
    
    let mut diff_options = git2::DiffOptions::new();
    
    if let Some(f) = file {
        diff_options.pathspec(f);
    }
    
    let diff = repo.diff_index_to_workdir(None, Some(&mut diff_options))
        .map_err(|e| format!("Failed to get diff: {}", e))?;
    
    let mut result = String::new();
    diff.print(git2::DiffFormat::Patch, |delta, _hunk, line| {
        result.push_str(&String::from_utf8_lossy(line.content()));
        true
    }).map_err(|e| format!("Failed to print diff: {}", e))?;
    
    Ok(result)
}

/// Stage files for commit
#[tauri::command]
pub async fn git_add(path: String, files: Vec<String>) -> Result<(), String> {
    let repo = Repository::discover(&path)
        .map_err(|e| format!("Failed to find repository: {}", e))?;
    
    let mut index = repo.index()
        .map_err(|e| format!("Failed to get index: {}", e))?;
    
    for file in files {
        index.add_path(std::path::Path::new(&file))
            .map_err(|e| format!("Failed to add '{}': {}", file, e))?;
    }
    
    index.write()
        .map_err(|e| format!("Failed to write index: {}", e))?;
    
    Ok(())
}

/// Unstage files
#[tauri::command]
pub async fn git_reset(path: String, files: Vec<String>) -> Result<(), String> {
    let repo = Repository::discover(&path)
        .map_err(|e| format!("Failed to find repository: {}", e))?;
    
    let mut index = repo.index()
        .map_err(|e| format!("Failed to get index: {}", e))?;
    
    for file in files {
        index.remove(std::path::Path::new(&file), 0)
            .map_err(|e| format!("Failed to remove '{}': {}", file, e))?;
    }
    
    index.write()
        .map_err(|e| format!("Failed to write index: {}", e))?;
    
    Ok(())
}

/// Create a commit
#[tauri::command]
pub async fn git_commit(path: String, message: String) -> Result<String, String> {
    let repo = Repository::discover(&path)
        .map_err(|e| format!("Failed to find repository: {}", e))?;
    
    let mut index = repo.index()
        .map_err(|e| format!("Failed to get index: {}", e))?;
    
    let tree_id = index.write_tree()
        .map_err(|e| format!("Failed to write tree: {}", e))?;
    
    let tree = repo.find_tree(tree_id)
        .map_err(|e| format!("Failed to find tree: {}", e))?;
    
    let head = repo.head()
        .map_err(|e| format!("Failed to get HEAD: {}", e))?;
    
    let parent = head.peel_to_commit()
        .map_err(|e| format!("Failed to get parent commit: {}", e))?;
    
    let sig = repo.signature()
        .map_err(|e| format!("Failed to get signature: {}", e))?;
    
    let commit_id = repo.commit(Some("HEAD"), &sig, &sig, &message, &tree, &[&parent])
        .map_err(|e| format!("Failed to commit: {}", e))?;
    
    Ok(commit_id.to_string())
}

/// List branches
#[tauri::command]
pub async fn git_branch(path: String) -> Result<Vec<GitBranch>, String> {
    let repo = Repository::discover(&path)
        .map_err(|e| format!("Failed to find repository: {}", e))?;
    
    let head = repo.head()
        .map_err(|e| format!("Failed to get HEAD: {}", e))?;
    
    let current_branch = head.shorthand().unwrap_or("");
    
    let mut branches = Vec::new();
    
    let branch_iter = repo.branches(None)
        .map_err(|e| format!("Failed to get branches: {}", e))?;
    
    for branch_result in branch_iter {
        let (branch, branch_type) = branch_result
            .map_err(|e| format!("Failed to get branch: {}", e))?;
        
        let name = branch.name()
            .map_err(|e| format!("Failed to get branch name: {}", e))?
            .unwrap_or("");
        
        branches.push(GitBranch {
            name: name.to_string(),
            is_current: name == current_branch,
            is_remote: branch_type == git2::BranchType::Remote,
        });
    }
    
    Ok(branches)
}

/// Checkout a branch
#[tauri::command]
pub async fn git_checkout(path: String, branch: String) -> Result<(), String> {
    let repo = Repository::discover(&path)
        .map_err(|e| format!("Failed to find repository: {}", e))?;
    
    let ref_name = if branch.starts_with("refs/") {
        branch
    } else {
        format!("refs/heads/{}", branch)
    };
    
    let reference = repo.find_reference(&ref_name)
        .map_err(|e| format!("Failed to find branch: {}", e))?;
    
    let commit = reference.peel_to_commit()
        .map_err(|e| format!("Failed to get commit: {}", e))?;
    
    repo.checkout_tree(commit.as_object(), None)
        .map_err(|e| format!("Failed to checkout: {}", e))?;
    
    repo.set_head(&ref_name)
        .map_err(|e| format!("Failed to set HEAD: {}", e))?;
    
    Ok(())
}

/// Pull from remote
#[tauri::command]
pub async fn git_pull(path: String, remote: Option<String>, branch: Option<String>) -> Result<(), String> {
    let repo = Repository::discover(&path)
        .map_err(|e| format!("Failed to find repository: {}", e))?;
    
    let remote_name = remote.unwrap_or_else(|| "origin".to_string());
    let branch_name = branch.unwrap_or_else(|| {
        repo.head()
            .ok()
            .and_then(|h| h.shorthand().map(|s| s.to_string()))
            .unwrap_or_else(|| "main".to_string())
    });
    
    let mut remote = repo.find_remote(&remote_name)
        .map_err(|e| format!("Failed to find remote: {}", e))?;
    
    remote.fetch(&[&branch_name], None, None)
        .map_err(|e| format!("Failed to fetch: {}", e))?;
    
    Ok(())
}

/// Push to remote
#[tauri::command]
pub async fn git_push(path: String, remote: Option<String>, branch: Option<String>) -> Result<(), String> {
    let repo = Repository::discover(&path)
        .map_err(|e| format!("Failed to find repository: {}", e))?;
    
    let remote_name = remote.unwrap_or_else(|| "origin".to_string());
    let branch_name = branch.unwrap_or_else(|| {
        repo.head()
            .ok()
            .and_then(|h| h.shorthand().map(|s| s.to_string()))
            .unwrap_or_else(|| "main".to_string())
    });
    
    let mut remote = repo.find_remote(&remote_name)
        .map_err(|e| format!("Failed to find remote: {}", e))?;
    
    let ref_name = format!("refs/heads/{}", branch_name);
    remote.push(&[&ref_name], None)
        .map_err(|e| format!("Failed to push: {}", e))?;
    
    Ok(())
}
