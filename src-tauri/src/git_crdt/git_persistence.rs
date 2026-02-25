//! Git persistence for CRDT state
//!
//! Stores collaboration history in Git commits

use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::collections::HashMap;

/// Git persistence layer for CRDT state
pub struct GitPersistence {
    repo_path: PathBuf,
    document_id: String,
    commit_history: Vec<CommitEntry>,
    last_commit: Option<String>,
}

/// Commit entry for tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitEntry {
    pub hash: String,
    pub message: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub author: String,
    pub crdt_version: u64,
}

/// Document version stored in git
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentVersion {
    pub content: String,
    pub version: u64,
    pub participants: Vec<String>,
    pub checksum: String,
}

impl GitPersistence {
    /// Create a new git persistence layer
    pub fn new(document_id: &str) -> Result<Self> {
        let repo_path = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("kyro-ide")
            .join("collab")
            .join(document_id);

        // Ensure directory exists
        std::fs::create_dir_all(&repo_path)
            .context("Failed to create persistence directory")?;

        let mut persistence = Self {
            repo_path,
            document_id: document_id.to_string(),
            commit_history: Vec::new(),
            last_commit: None,
        };

        // Initialize git repo if needed
        persistence.init_repo()?;

        Ok(persistence)
    }

    /// Initialize git repository
    fn init_repo(&mut self) -> Result<()> {
        let git_dir = self.repo_path.join(".git");
        
        if !git_dir.exists() {
            // Initialize a new git repository
            git2::Repository::init(&self.repo_path)
                .context("Failed to initialize git repository")?;
        }

        Ok(())
    }

    /// Commit current document state
    pub fn commit(&mut self, message: &str) -> Result<String> {
        let repo = git2::Repository::open(&self.repo_path)
            .context("Failed to open repository")?;

        // Get or create HEAD reference
        let mut index = repo.index()
            .context("Failed to get index")?;

        // Add all files
        index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
            .context("Failed to add files to index")?;
        index.write()
            .context("Failed to write index")?;

        let tree_id = index.write_tree()
            .context("Failed to write tree")?;
        let tree = repo.find_tree(tree_id)
            .context("Failed to find tree")?;

        // Create commit
        let sig = git2::Signature::now("KYRO IDE", "kyro@local")
            .context("Failed to create signature")?;

        let parent_commit = repo.head()
            .ok()
            .and_then(|h| h.target())
            .map(|oid| repo.find_commit(oid))
            .transpose()?;

        let parents: Vec<&git2::Commit> = parent_commit.iter().collect();

        let commit_id = repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            message,
            &tree,
            &parents,
        ).context("Failed to create commit")?;

        let commit_hash = commit_id.to_string();

        // Track commit in history
        self.commit_history.push(CommitEntry {
            hash: commit_hash.clone(),
            message: message.to_string(),
            timestamp: chrono::Utc::now(),
            author: "KYRO IDE".to_string(),
            crdt_version: self.commit_history.len() as u64,
        });

        self.last_commit = Some(commit_hash.clone());

        Ok(commit_hash)
    }

    /// Save document version to file
    pub fn save_version(&self, version: &DocumentVersion) -> Result<()> {
        let file_path = self.repo_path.join("document.json");
        let content = serde_json::to_string_pretty(version)
            .context("Failed to serialize document")?;
        
        std::fs::write(&file_path, content)
            .context("Failed to write document file")?;

        Ok(())
    }

    /// Load document version
    pub fn load_version(&self) -> Result<Option<DocumentVersion>> {
        let file_path = self.repo_path.join("document.json");
        
        if !file_path.exists() {
            return Ok(None);
        }

        let content = std::fs::read_to_string(&file_path)
            .context("Failed to read document file")?;
        
        let version: DocumentVersion = serde_json::from_str(&content)
            .context("Failed to parse document")?;

        Ok(Some(version))
    }

    /// Get commit history
    pub fn get_history(&self) -> &[CommitEntry] {
        &self.commit_history
    }

    /// Get a specific version
    pub fn get_version(&self, hash: &str) -> Result<Option<DocumentVersion>> {
        let repo = git2::Repository::open(&self.repo_path)
            .context("Failed to open repository")?;

        let oid = git2::Oid::from_str(hash)
            .context("Invalid commit hash")?;

        let commit = repo.find_commit(oid)
            .context("Commit not found")?;

        let tree = commit.tree()
            .context("Failed to get tree")?;

        let entry = tree.get_name("document.json")
            .ok_or_else(|| anyhow::anyhow!("document.json not found in commit"))?;

        let blob = repo.find_blob(entry.id())
            .context("Failed to find blob")?;

        let content = std::str::from_utf8(blob.content())
            .context("Invalid UTF-8 content")?;

        let version: DocumentVersion = serde_json::from_str(content)
            .context("Failed to parse document")?;

        Ok(Some(version))
    }

    /// Create a branch for collaboration
    pub fn create_branch(&self, branch_name: &str) -> Result<()> {
        let repo = git2::Repository::open(&self.repo_path)
            .context("Failed to open repository")?;

        let head = repo.head()
            .context("Failed to get HEAD")?;
        let target = head.target()
            .ok_or_else(|| anyhow::anyhow!("HEAD has no target"))?;
        let commit = repo.find_commit(target)
            .context("Failed to find commit")?;

        repo.branch(branch_name, &commit, false)
            .context("Failed to create branch")?;

        Ok(())
    }

    /// List branches
    pub fn list_branches(&self) -> Result<Vec<String>> {
        let repo = git2::Repository::open(&self.repo_path)
            .context("Failed to open repository")?;

        let branches: Vec<String> = repo.branches(None)
            .context("Failed to list branches")?
            .filter_map(|b| b.ok())
            .filter_map(|(branch, _)| {
                branch.name().ok()?.map(|s| s.to_string())
            })
            .collect();

        Ok(branches)
    }

    /// Get diff between two versions
    pub fn get_diff(&self, from_hash: &str, to_hash: &str) -> Result<String> {
        let repo = git2::Repository::open(&self.repo_path)
            .context("Failed to open repository")?;

        let from_oid = git2::Oid::from_str(from_hash)?;
        let to_oid = git2::Oid::from_str(to_hash)?;

        let from_commit = repo.find_commit(from_oid)?;
        let to_commit = repo.find_commit(to_oid)?;

        let from_tree = from_commit.tree()?;
        let to_tree = to_commit.tree()?;

        let diff = repo.diff_tree_to_tree(Some(&from_tree), Some(&to_tree), None)?;

        let mut diff_text = String::new();
        diff.print(git2::DiffFormat::Patch, |_, _, line| {
            diff_text.push_str(std::str::from_utf8(line.content()).unwrap_or(""));
            true
        })?;

        Ok(diff_text)
    }
}
