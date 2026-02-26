//! Agent Lock Mechanism
//!
//! Ensures ONLY ONE agent runs at any time using a lock file.
//! Prevents concurrent agent execution and resource conflicts.

use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::agents::AgentError;

/// Lock file path
pub const LOCK_FILE: &str = "/tmp/kyro-agent.lock";

/// Memory context directory
pub const MEMORY_DIR: &str = "/tmp/kyro-agent-memory";

/// Agent lock handle
pub struct AgentLock {
    agent_name: String,
    pid: u32,
    lock_path: PathBuf,
}

/// Lock file contents
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LockInfo {
    pub agent_name: String,
    pub pid: u32,
    pub acquired_at: i64,
    pub task: Option<String>,
}

impl AgentLock {
    /// Try to acquire the agent lock
    ///
    /// # Errors
    /// Returns error if another agent is already running
    pub fn acquire(agent_name: &str) -> Result<Self, AgentError> {
        let lock_path = PathBuf::from(LOCK_FILE);

        // Check if lock file exists
        if lock_path.exists() {
            let existing = Self::read_lock_info(&lock_path)?;

            // Check if the process is still running
            if Self::is_process_running(existing.pid) {
                return Err(AgentError::ProcessError(format!(
                    "Another agent is running: {} (PID: {})",
                    existing.agent_name, existing.pid
                )));
            } else {
                // Stale lock file, remove it
                log::warn!(
                    "Removing stale lock file from agent {} (PID: {} no longer running)",
                    existing.agent_name,
                    existing.pid
                );
                let _ = fs::remove_file(&lock_path);
            }
        }

        // Ensure memory directory exists
        let memory_dir = PathBuf::from(MEMORY_DIR);
        if !memory_dir.exists() {
            fs::create_dir_all(&memory_dir)
                .map_err(|e| AgentError::ProcessError(format!("Failed to create memory dir: {}", e)))?;
        }

        // Create lock file
        let pid = process::id();
        let lock_info = LockInfo {
            agent_name: agent_name.to_string(),
            pid,
            acquired_at: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() as i64,
            task: None,
        };

        let lock_content = serde_json::to_string(&lock_info)
            .map_err(|e| AgentError::ProcessError(format!("Failed to serialize lock: {}", e)))?;

        let mut file = fs::File::create(&lock_path)
            .map_err(|e| AgentError::ProcessError(format!("Failed to create lock file: {}", e)))?;

        file.write_all(lock_content.as_bytes())
            .map_err(|e| AgentError::ProcessError(format!("Failed to write lock file: {}", e)))?;

        log::info!("Agent lock acquired: {} (PID: {})", agent_name, pid);

        Ok(Self {
            agent_name: agent_name.to_string(),
            pid,
            lock_path,
        })
    }

    /// Update the lock with current task
    pub fn update_task(&self, task: &str) -> Result<(), AgentError> {
        let mut lock_info = Self::read_lock_info(&self.lock_path)?;
        lock_info.task = Some(task.to_string());

        let lock_content = serde_json::to_string(&lock_info)
            .map_err(|e| AgentError::ProcessError(format!("Failed to serialize lock: {}", e)))?;

        let mut file = fs::File::create(&self.lock_path)
            .map_err(|e| AgentError::ProcessError(format!("Failed to update lock file: {}", e)))?;

        file.write_all(lock_content.as_bytes())
            .map_err(|e| AgentError::ProcessError(format!("Failed to write lock file: {}", e)))?;

        Ok(())
    }

    /// Read lock info from file
    fn read_lock_info(path: &PathBuf) -> Result<LockInfo, AgentError> {
        let mut file = fs::File::open(path)
            .map_err(|e| AgentError::ProcessError(format!("Failed to open lock file: {}", e)))?;

        let mut content = String::new();
        file.read_to_string(&mut content)
            .map_err(|e| AgentError::ProcessError(format!("Failed to read lock file: {}", e)))?;

        serde_json::from_str(&content)
            .map_err(|e| AgentError::ProcessError(format!("Failed to parse lock file: {}", e)))
    }

    /// Check if a process is still running
    fn is_process_running(pid: u32) -> bool {
        #[cfg(unix)]
        {
            // Send signal 0 to check if process exists
            unsafe {
                libc::kill(pid as i32, 0) == 0
            }
        }
        #[cfg(windows)]
        {
            // On Windows, use a different approach
            use std::process::Command;
            Command::new("tasklist")
                .args(["/FI", &format!("PID eq {}", pid)])
                .output()
                .map(|o| String::from_utf8_lossy(&o.stdout).contains(&pid.to_string()))
                .unwrap_or(false)
        }
    }

    /// Get current lock info if any
    pub fn current_lock() -> Option<LockInfo> {
        let lock_path = PathBuf::from(LOCK_FILE);
        if lock_path.exists() {
            Self::read_lock_info(&lock_path).ok()
        } else {
            None
        }
    }

    /// Check if any agent is running
    pub fn is_agent_running() -> bool {
        if let Some(lock) = Self::current_lock() {
            Self::is_process_running(lock.pid)
        } else {
            false
        }
    }

    /// Force release the lock (emergency use only)
    pub fn force_release() -> Result<(), AgentError> {
        let lock_path = PathBuf::from(LOCK_FILE);
        if lock_path.exists() {
            fs::remove_file(&lock_path)
                .map_err(|e| AgentError::ProcessError(format!("Failed to remove lock file: {}", e)))?;
            log::warn!("Force released agent lock");
        }
        Ok(())
    }
}

impl Drop for AgentLock {
    fn drop(&mut self) {
        // Clean up lock file when lock goes out of scope
        if self.lock_path.exists() {
            match fs::remove_file(&self.lock_path) {
                Ok(()) => log::info!("Agent lock released: {} (PID: {})", self.agent_name, self.pid),
                Err(e) => log::error!("Failed to release lock: {}", e),
            }
        }
    }
}

/// RAII guard for agent execution
pub struct AgentGuard {
    lock: AgentLock,
}

impl AgentGuard {
    /// Start agent execution with lock
    pub fn start(agent_name: &str) -> Result<Self, AgentError> {
        let lock = AgentLock::acquire(agent_name)?;
        Ok(Self { lock })
    }

    /// Update current task
    pub fn set_task(&self, task: &str) -> Result<(), AgentError> {
        self.lock.update_task(task)
    }

    /// Get the lock info
    pub fn info(&self) -> &AgentLock {
        &self.lock
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lock_acquire_release() {
        // Clean up any existing lock
        let _ = AgentLock::force_release();

        let lock = AgentLock::acquire("test-agent");
        assert!(lock.is_ok());

        // Should not be able to acquire again
        let second = AgentLock::acquire("second-agent");
        assert!(second.is_err());

        // Release by dropping
        drop(lock);

        // Now should be able to acquire
        let third = AgentLock::acquire("third-agent");
        assert!(third.is_ok());

        // Clean up
        let _ = AgentLock::force_release();
    }
}
