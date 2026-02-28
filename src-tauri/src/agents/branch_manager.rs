//! Branch Management
//!
//! Enforces trunk-based development with automatic merging.
//! Prevents branch sprawl and ensures main stays up to date.

use std::process::Command;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crate::agents::AgentError;

/// Maximum branches per agent
pub const MAX_BRANCHES_PER_AGENT: usize = 3;

/// Commits before merge required
pub const COMMITS_BEFORE_MERGE: usize = 10;

/// Time before merge required (in seconds)
pub const TIME_BEFORE_MERGE_SECS: u64 = 2 * 60 * 60; // 2 hours

/// Branch info
#[derive(Debug, Clone)]
pub struct BranchInfo {
    pub name: String,
    pub is_main: bool,
    pub commits_ahead: usize,
    pub commits_behind: usize,
    pub last_commit_time: Option<i64>,
    pub author: Option<String>,
}

/// Branch manager for git discipline
pub struct BranchManager {
    repo_path: String,
    agent_name: String,
    branches_created: Vec<String>,
    commits_since_merge: usize,
    last_merge_time: i64,
}

impl BranchManager {
    /// Create new branch manager
    pub fn new(repo_path: &str, agent_name: &str) -> Self {
        Self {
            repo_path: repo_path.to_string(),
            agent_name: agent_name.to_string(),
            branches_created: Vec::new(),
            commits_since_merge: 0,
            last_merge_time: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() as i64,
        }
    }

    /// Get current branch name
    pub fn current_branch(&self) -> Result<String, AgentError> {
        let output = Command::new("git")
            .args(["branch", "--show-current"])
            .current_dir(&self.repo_path)
            .output()
            .map_err(|e| AgentError::BranchError(format!("Failed to get current branch: {}", e)))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err(AgentError::BranchError(
                "Failed to get current branch".to_string(),
            ))
        }
    }

    /// Get all branches
    pub fn list_branches(&self) -> Result<Vec<BranchInfo>, AgentError> {
        let output = Command::new("git")
            .args(["branch", "-vv", "--format=%(refname:short)|%(upstream:short)|%(committerdate:unix)|%(authorname)"])
            .current_dir(&self.repo_path)
            .output()
            .map_err(|e| AgentError::BranchError(format!("Failed to list branches: {}", e)))?;

        let branches: Vec<BranchInfo> = String::from_utf8_lossy(&output.stdout)
            .lines()
            .filter_map(|line| {
                let parts: Vec<&str> = line.split('|').collect();
                if parts.is_empty() || parts[0].is_empty() {
                    return None;
                }

                let name = parts[0].trim().to_string();
                let is_main = name == "main" || name == "master";

                Some(BranchInfo {
                    name,
                    is_main,
                    commits_ahead: 0, // Would need additional git command
                    commits_behind: 0,
                    last_commit_time: parts.get(2).and_then(|t| t.parse().ok()),
                    author: parts.get(3).map(|s| s.to_string()),
                })
            })
            .collect();

        Ok(branches)
    }

    /// Check if we're on main branch
    pub fn is_on_main(&self) -> Result<bool, AgentError> {
        let current = self.current_branch()?;
        Ok(current == "main" || current == "master")
    }

    /// Ensure we're on main branch
    pub fn ensure_main(&self) -> Result<(), AgentError> {
        if !self.is_on_main()? {
            self.checkout("main")?;
        }
        Ok(())
    }

    /// Checkout a branch
    pub fn checkout(&self, branch: &str) -> Result<(), AgentError> {
        let output = Command::new("git")
            .args(["checkout", branch])
            .current_dir(&self.repo_path)
            .output()
            .map_err(|e| AgentError::BranchError(format!("Failed to checkout: {}", e)))?;

        if output.status.success() {
            log::info!("Checked out branch: {}", branch);
            Ok(())
        } else {
            Err(AgentError::BranchError(format!(
                "Failed to checkout {}: {}",
                branch,
                String::from_utf8_lossy(&output.stderr)
            )))
        }
    }

    /// Create a new work branch
    pub fn create_work_branch(&mut self, feature: &str) -> Result<String, AgentError> {
        // Check branch limit
        if self.branches_created.len() >= MAX_BRANCHES_PER_AGENT {
            return Err(AgentError::BranchError(format!(
                "Max branches ({}) exceeded. Merge existing branches first.",
                MAX_BRANCHES_PER_AGENT
            )));
        }

        // Ensure we're on main first
        self.ensure_main()?;

        // Generate branch name: agent-{name}-{date}-{feature}
        let date = chrono::Local::now().format("%Y%m%d");
        let branch_name = format!("agent-{}-{}-{}", self.agent_name, date, feature);

        // Create and checkout branch
        let output = Command::new("git")
            .args(["checkout", "-b", &branch_name])
            .current_dir(&self.repo_path)
            .output()
            .map_err(|e| AgentError::BranchError(format!("Failed to create branch: {}", e)))?;

        if output.status.success() {
            self.branches_created.push(branch_name.clone());
            log::info!("Created work branch: {}", branch_name);
            Ok(branch_name)
        } else {
            Err(AgentError::BranchError(format!(
                "Failed to create branch: {}",
                String::from_utf8_lossy(&output.stderr)
            )))
        }
    }

    /// Check if merge is required
    pub fn should_merge(&self) -> bool {
        // Check commit count
        if self.commits_since_merge >= COMMITS_BEFORE_MERGE {
            return true;
        }

        // Check time
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        let elapsed = now - self.last_merge_time;
        if elapsed > TIME_BEFORE_MERGE_SECS as i64 {
            return true;
        }

        false
    }

    /// Increment commit counter
    pub fn record_commit(&mut self) {
        self.commits_since_merge += 1;
    }

    /// Merge current branch to main
    pub fn merge_to_main(&mut self) -> Result<(), AgentError> {
        let current_branch = self.current_branch()?;

        // Don't merge main to main
        if current_branch == "main" || current_branch == "master" {
            log::debug!("Already on main, no merge needed");
            return Ok(());
        }

        // Switch to main
        self.checkout("main")?;

        // Pull latest
        let _ = Command::new("git")
            .args(["pull", "origin", "main"])
            .current_dir(&self.repo_path)
            .output();

        // Merge
        let output = Command::new("git")
            .args(["merge", "--no-ff", &current_branch, "-m", &format!("[agent-{}] Merge {} to main", self.agent_name, current_branch)])
            .current_dir(&self.repo_path)
            .output()
            .map_err(|e| AgentError::BranchError(format!("Failed to merge: {}", e)))?;

        if !output.status.success() {
            // Abort merge on failure
            let _ = Command::new("git")
                .args(["merge", "--abort"])
                .current_dir(&self.repo_path)
                .output();

            return Err(AgentError::BranchError(format!(
                "Merge conflict: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }

        // Push main
        let output = Command::new("git")
            .args(["push", "origin", "main"])
            .current_dir(&self.repo_path)
            .output()
            .map_err(|e| AgentError::BranchError(format!("Failed to push: {}", e)))?;

        if !output.status.success() {
            return Err(AgentError::BranchError(format!(
                "Failed to push main: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }

        // Delete the merged branch
        let _ = Command::new("git")
            .args(["branch", "-d", &current_branch])
            .current_dir(&self.repo_path)
            .output();

        // Delete from remote if exists
        let _ = Command::new("git")
            .args(["push", "origin", "--delete", &current_branch])
            .current_dir(&self.repo_path)
            .output();

        // Update tracking
        self.branches_created.retain(|b| b != &current_branch);
        self.commits_since_merge = 0;
        self.last_merge_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        log::info!("Merged {} to main and cleaned up", current_branch);
        Ok(())
    }

    /// Force merge and cleanup all agent branches
    pub fn force_merge_all(&mut self) -> Result<Vec<String>, AgentError> {
        let mut merged = Vec::new();

        for branch in self.branches_created.clone() {
            // Checkout and merge each branch
            if self.checkout(&branch).is_ok() {
                if self.merge_to_main().is_ok() {
                    merged.push(branch);
                }
            }
        }

        Ok(merged)
    }

    /// Get branch statistics
    pub fn stats(&self) -> BranchStats {
        BranchStats {
            branches_created: self.branches_created.len(),
            commits_since_merge: self.commits_since_merge,
            time_since_merge_secs: (SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() as i64)
                - self.last_merge_time,
            needs_merge: self.should_merge(),
        }
    }
}

/// Branch statistics
#[derive(Debug, Clone)]
pub struct BranchStats {
    pub branches_created: usize,
    pub commits_since_merge: usize,
    pub time_since_merge_secs: i64,
    pub needs_merge: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_branch_name_format() {
        let date = chrono::Local::now().format("%Y%m%d");
        let expected = format!("agent-glm5-{}-test-feature", date);
        assert!(expected.starts_with("agent-glm5-"));
        assert!(expected.ends_with("-test-feature"));
    }

    #[test]
    fn test_should_merge() {
        let mut manager = BranchManager::new(".", "test");

        // Initially shouldn't need merge
        assert!(!manager.should_merge());

        // After 10 commits, should need merge
        for _ in 0..10 {
            manager.record_commit();
        }
        assert!(manager.should_merge());
    }
}
