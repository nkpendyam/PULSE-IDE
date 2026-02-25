//! Git Sync Enforcement
//!
//! Ensures agents commit and push regularly.
//! Prevents work loss and maintains sync with remote.

use std::process::Command;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use crate::agents::AgentError;

/// Auto commit every N changes
pub const AUTO_COMMIT_CHANGES: usize = 5;

/// Auto commit every N minutes
pub const AUTO_COMMIT_INTERVAL_SECS: u64 = 15 * 60; // 15 minutes

/// Push every commit
pub const PUSH_EVERY_COMMIT: bool = true;

/// Commit info
#[derive(Debug, Clone)]
pub struct CommitInfo {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub timestamp: i64,
}

/// Sync enforcer for git discipline
pub struct SyncEnforcer {
    repo_path: String,
    agent_name: String,
    changes_since_commit: usize,
    last_commit_time: Instant,
    last_push_time: Instant,
    total_commits: usize,
}

impl SyncEnforcer {
    /// Create new sync enforcer
    pub fn new(repo_path: &str, agent_name: &str) -> Self {
        Self {
            repo_path: repo_path.to_string(),
            agent_name: agent_name.to_string(),
            changes_since_commit: 0,
            last_commit_time: Instant::now(),
            last_push_time: Instant::now(),
            total_commits: 0,
        }
    }

    /// Record a file change
    pub fn record_change(&mut self) {
        self.changes_since_commit += 1;
    }

    /// Check if auto-commit is needed
    pub fn should_commit(&self) -> bool {
        // Check change count
        if self.changes_since_commit >= AUTO_COMMIT_CHANGES {
            return true;
        }

        // Check time interval
        let elapsed = self.last_commit_time.elapsed();
        if elapsed > Duration::from_secs(AUTO_COMMIT_INTERVAL_SECS) {
            return true;
        }

        false
    }

    /// Check if push is needed
    pub fn should_push(&self) -> bool {
        PUSH_EVERY_COMMIT && self.last_commit_time > self.last_push_time
    }

    /// Stage all changes
    pub fn stage_all(&self) -> Result<(), AgentError> {
        let output = Command::new("git")
            .args(["add", "-A"])
            .current_dir(&self.repo_path)
            .output()
            .map_err(|e| AgentError::SyncError(format!("Failed to stage: {}", e)))?;

        if output.status.success() {
            log::debug!("Staged all changes");
            Ok(())
        } else {
            Err(AgentError::SyncError(format!(
                "Failed to stage: {}",
                String::from_utf8_lossy(&output.stderr)
            )))
        }
    }

    /// Create a commit
    pub fn commit(&mut self, message: &str, commit_type: &str) -> Result<String, AgentError> {
        // Format commit message
        let formatted_msg = format!(
            "[agent-{}] {}: {}",
            self.agent_name, commit_type, message
        );

        let output = Command::new("git")
            .args(["commit", "-m", &formatted_msg])
            .current_dir(&self.repo_path)
            .output()
            .map_err(|e| AgentError::SyncError(format!("Failed to commit: {}", e)))?;

        if output.status.success() {
            // Get commit hash
            let hash = self.get_head_hash()?;
            
            // Update tracking
            self.changes_since_commit = 0;
            self.last_commit_time = Instant::now();
            self.total_commits += 1;

            log::info!("Committed: {} - {}", &hash[..7], formatted_msg);
            Ok(hash)
        } else {
            // Check if nothing to commit
            let stderr = String::from_utf8_lossy(&output.stderr);
            if stderr.contains("nothing to commit") {
                log::debug!("Nothing to commit");
                Ok(String::new())
            } else {
                Err(AgentError::SyncError(format!(
                    "Failed to commit: {}",
                    stderr
                )))
            }
        }
    }

    /// Get HEAD commit hash
    pub fn get_head_hash(&self) -> Result<String, AgentError> {
        let output = Command::new("git")
            .args(["rev-parse", "HEAD"])
            .current_dir(&self.repo_path)
            .output()
            .map_err(|e| AgentError::SyncError(format!("Failed to get HEAD: {}", e)))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err(AgentError::SyncError("Failed to get HEAD hash".to_string()))
        }
    }

    /// Push to origin
    pub fn push(&mut self, branch: Option<&str>) -> Result<(), AgentError> {
        let branch_name = match branch {
            Some(b) => b.to_string(),
            None => self.get_current_branch()?,
        };

        let output = Command::new("git")
            .args(["push", "origin", &branch_name])
            .current_dir(&self.repo_path)
            .output()
            .map_err(|e| AgentError::SyncError(format!("Failed to push: {}", e)))?;

        if output.status.success() {
            self.last_push_time = Instant::now();
            log::info!("Pushed to origin/{}", branch_name);
            Ok(())
        } else {
            // Try push with -u flag for new branches
            let output = Command::new("git")
                .args(["push", "-u", "origin", &branch_name])
                .current_dir(&self.repo_path)
                .output()
                .map_err(|e| AgentError::SyncError(format!("Failed to push: {}", e)))?;

            if output.status.success() {
                self.last_push_time = Instant::now();
                log::info!("Pushed (new branch) to origin/{}", branch_name);
                Ok(())
            } else {
                Err(AgentError::SyncError(format!(
                    "Failed to push: {}",
                    String::from_utf8_lossy(&output.stderr)
                )))
            }
        }
    }

    /// Pull from origin
    pub fn pull(&self, branch: Option<&str>) -> Result<(), AgentError> {
        let branch_name = match branch {
            Some(b) => b.to_string(),
            None => "main".to_string(),
        };

        let output = Command::new("git")
            .args(["pull", "origin", &branch_name])
            .current_dir(&self.repo_path)
            .output()
            .map_err(|e| AgentError::SyncError(format!("Failed to pull: {}", e)))?;

        if output.status.success() {
            log::info!("Pulled from origin/{}", branch_name);
            Ok(())
        } else {
            Err(AgentError::SyncError(format!(
                "Failed to pull: {}",
                String::from_utf8_lossy(&output.stderr)
            )))
        }
    }

    /// Get current branch name
    pub fn get_current_branch(&self) -> Result<String, AgentError> {
        let output = Command::new("git")
            .args(["branch", "--show-current"])
            .current_dir(&self.repo_path)
            .output()
            .map_err(|e| AgentError::SyncError(format!("Failed to get branch: {}", e)))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err(AgentError::SyncError("Failed to get current branch".to_string()))
        }
    }

    /// Get uncommitted changes count
    pub fn uncommitted_count(&self) -> Result<usize, AgentError> {
        let output = Command::new("git")
            .args(["status", "--porcelain"])
            .current_dir(&self.repo_path)
            .output()
            .map_err(|e| AgentError::SyncError(format!("Failed to get status: {}", e)))?;

        if output.status.success() {
            let count = String::from_utf8_lossy(&output.stdout)
                .lines()
                .count();
            Ok(count)
        } else {
            Ok(0)
        }
    }

    /// Check for uncommitted changes
    pub fn has_uncommitted(&self) -> Result<bool, AgentError> {
        Ok(self.uncommitted_count()? > 0)
    }

    /// Full sync: stage, commit, push
    pub fn full_sync(&mut self, message: &str, commit_type: &str) -> Result<String, AgentError> {
        // Check if there's anything to commit
        if !self.has_uncommitted()? {
            log::debug!("No uncommitted changes, skipping sync");
            return Ok(String::new());
        }

        // Stage
        self.stage_all()?;

        // Commit
        let hash = self.commit(message, commit_type)?;

        // Push
        if !hash.is_empty() {
            self.push(None)?;
        }

        Ok(hash)
    }

    /// Emergency commit (for OOM or crash scenarios)
    pub fn emergency_commit(&mut self, error: &str) -> Result<String, AgentError> {
        let message = format!("WIP: Emergency checkpoint - {}", error);
        self.full_sync(&message, "chore")
    }

    /// Get recent commits
    pub fn recent_commits(&self, count: usize) -> Result<Vec<CommitInfo>, AgentError> {
        let output = Command::new("git")
            .args([
                "log",
                &format!("-{}", count),
                "--format=%H|%s|%an|%ct",
            ])
            .current_dir(&self.repo_path)
            .output()
            .map_err(|e| AgentError::SyncError(format!("Failed to get commits: {}", e)))?;

        if output.status.success() {
            let commits = String::from_utf8_lossy(&output.stdout)
                .lines()
                .filter_map(|line| {
                    let parts: Vec<&str> = line.split('|').collect();
                    if parts.len() >= 4 {
                        Some(CommitInfo {
                            hash: parts[0].to_string(),
                            message: parts[1].to_string(),
                            author: parts[2].to_string(),
                            timestamp: parts[3].parse().unwrap_or(0),
                        })
                    } else {
                        None
                    }
                })
                .collect();
            Ok(commits)
        } else {
            Ok(Vec::new())
        }
    }

    /// Get sync statistics
    pub fn stats(&self) -> SyncStats {
        SyncStats {
            changes_since_commit: self.changes_since_commit,
            time_since_commit_secs: self.last_commit_time.elapsed().as_secs(),
            time_since_push_secs: self.last_push_time.elapsed().as_secs(),
            total_commits: self.total_commits,
            needs_commit: self.should_commit(),
            needs_push: self.should_push(),
        }
    }
}

/// Sync statistics
#[derive(Debug, Clone)]
pub struct SyncStats {
    pub changes_since_commit: usize,
    pub time_since_commit_secs: u64,
    pub time_since_push_secs: u64,
    pub total_commits: usize,
    pub needs_commit: bool,
    pub needs_push: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_commit_message_format() {
        let agent = "glm5";
        let msg = "Add feature X";
        let commit_type = "feat";
        let expected = format!("[agent-{}] {}: {}", agent, commit_type, msg);
        assert_eq!(expected, "[agent-glm5] feat: Add feature X");
    }

    #[test]
    fn test_should_commit_by_changes() {
        let mut sync = SyncEnforcer::new(".", "test");

        // Initially shouldn't need commit
        assert!(!sync.should_commit());

        // After 5 changes, should need commit
        for _ in 0..5 {
            sync.record_change();
        }
        assert!(sync.should_commit());
    }
}
