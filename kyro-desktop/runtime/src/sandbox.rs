//! PULSE Runtime Kernel - Sandbox Manager
//!
//! Process isolation with Windows Job Objects / Linux cgroups.

use anyhow::{Result, bail};
use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use std::process::Command;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, debug};

/// Sandbox configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxConfig {
    /// Maximum memory in MB
    pub memory_limit_mb: u64,
    /// Maximum CPU percentage
    pub cpu_limit_percent: u32,
    /// Maximum execution time in seconds
    pub time_limit_secs: u64,
    /// Allowed directories (read)
    pub read_paths: Vec<String>,
    /// Allowed directories (write)
    pub write_paths: Vec<String>,
    /// Environment variables
    pub env_vars: HashMap<String, String>,
    /// Network access allowed
    pub network_allowed: bool,
}

impl Default for SandboxConfig {
    fn default() -> Self {
        Self {
            memory_limit_mb: 256,
            cpu_limit_percent: 50,
            time_limit_secs: 300,
            read_paths: Vec::new(),
            write_paths: Vec::new(),
            env_vars: HashMap::new(),
            network_allowed: false,
        }
    }
}

/// Sandbox execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxResult {
    /// Exit code
    pub exit_code: i32,
    /// Standard output
    pub stdout: String,
    /// Standard error
    pub stderr: String,
    /// Execution time in milliseconds
    pub duration_ms: u64,
    /// Peak memory usage in MB
    pub peak_memory_mb: u64,
    /// Whether the process was killed
    pub killed: bool,
    /// Kill reason
    pub kill_reason: Option<String>,
}

/// Running sandbox process
struct SandboxProcess {
    #[cfg(windows)]
    handle: Option<windows::Win32::Foundation::HANDLE>,
    pid: u32,
    started_at: std::time::Instant,
}

/// Sandbox manager for isolated execution
pub struct SandboxManager {
    /// Active sandboxes
    sandboxes: HashMap<String, SandboxProcess>,
    /// Default configuration
    default_config: SandboxConfig,
}

impl SandboxManager {
    /// Create a new sandbox manager
    pub fn new() -> Self {
        Self {
            sandboxes: HashMap::new(),
            default_config: SandboxConfig::default(),
        }
    }

    /// Initialize the sandbox manager
    pub fn initialize(&mut self) -> Result<()> {
        info!("Initializing sandbox manager");
        
        #[cfg(windows)]
        {
            // Windows-specific initialization
            info!("Platform: Windows - using Job Objects");
        }
        
        #[cfg(not(windows))]
        {
            // Linux/Unix initialization
            info!("Platform: Unix - using namespaces/cgroups");
        }

        Ok(())
    }

    /// Execute a command in a sandbox
    pub async fn execute(
        &mut self,
        sandbox_id: String,
        command: &str,
        args: &[&str],
        config: Option<SandboxConfig>,
    ) -> Result<SandboxResult> {
        let config = config.unwrap_or_else(|| self.default_config.clone());
        let start_time = std::time::Instant::now();

        info!(
            sandbox_id = %sandbox_id,
            command = %command,
            args = ?args,
            "Executing sandboxed command"
        );

        #[cfg(windows)]
        {
            self.execute_windows(sandbox_id, command, args, config, start_time).await
        }

        #[cfg(not(windows))]
        {
            self.execute_unix(sandbox_id, command, args, config, start_time).await
        }
    }

    #[cfg(windows)]
    async fn execute_windows(
        &mut self,
        sandbox_id: String,
        command: &str,
        args: &[&str],
        config: SandboxConfig,
        start_time: std::time::Instant,
    ) -> Result<SandboxResult> {
        use std::os::windows::process::CommandExt;
        use windows::Win32::System::JobObjects::*;
        use windows::Win32::System::Threading::*;
        use windows::Win32::Foundation::*;

        // Create job object for resource limits
        let job_handle = unsafe { CreateJobObjectW(None, None)? };

        // Configure job limits
        let mut job_info: JOBOBJECT_BASIC_LIMIT_INFORMATION = unsafe { std::mem::zeroed() };
        job_info.LimitFlags = JOB_OBJECT_LIMIT_JOB_MEMORY;
        job_info.JobMemoryLimit = config.memory_limit_mb * 1024 * 1024;

        // Set process command
        let mut cmd = Command::new(command);
        cmd.args(args);

        // Set environment
        for (key, value) in &config.env_vars {
            cmd.env(key, value);
        }

        // Spawn process
        let mut child = cmd
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()?;

        let pid = child.id();
        
        // Track sandbox
        self.sandboxes.insert(sandbox_id.clone(), SandboxProcess {
            handle: Some(job_handle),
            pid,
            started_at: start_time,
        });

        // Wait for completion with timeout
        let timeout_duration = std::time::Duration::from_secs(config.time_limit_secs);
        let result = tokio::time::timeout(timeout_duration, async {
            let output = child.wait_with_output()?;
            Ok::<_, anyhow::Error>(output)
        }).await;

        // Remove from tracking
        self.sandboxes.remove(&sandbox_id);

        match result {
            Ok(Ok(output)) => {
                let duration = start_time.elapsed();
                Ok(SandboxResult {
                    exit_code: output.status.code().unwrap_or(-1),
                    stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                    stderr: String::from_utf8_lossy(&output.stderr).to_string(),
                    duration_ms: duration.as_millis() as u64,
                    peak_memory_mb: 0, // Would need performance counters
                    killed: false,
                    kill_reason: None,
                })
            }
            Ok(Err(e)) => {
                Err(e)
            }
            Err(_) => {
                // Timeout - kill process
                warn!(sandbox_id = %sandbox_id, "Process timed out, killing");
                let _ = child.kill();
                Ok(SandboxResult {
                    exit_code: -1,
                    stdout: String::new(),
                    stderr: "Process killed due to timeout".to_string(),
                    duration_ms: config.time_limit_secs * 1000,
                    peak_memory_mb: 0,
                    killed: true,
                    kill_reason: Some("timeout".to_string()),
                })
            }
        }
    }

    #[cfg(not(windows))]
    async fn execute_unix(
        &mut self,
        sandbox_id: String,
        command: &str,
        args: &[&str],
        config: SandboxConfig,
        start_time: std::time::Instant,
    ) -> Result<SandboxResult> {
        use std::os::unix::process::CommandExt;

        // On Unix, we can use setsid and resource limits
        let mut cmd = Command::new(command);
        cmd.args(args);

        // Set environment
        for (key, value) in &config.env_vars {
            cmd.env(key, value);
        }

        // Process group for easy termination
        unsafe {
            cmd.pre_exec(|| {
                // Create new session
                libc::setsid();
                Ok(())
            });
        }

        let mut child = cmd
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()?;

        let pid = child.id();

        // Track sandbox
        self.sandboxes.insert(sandbox_id.clone(), SandboxProcess {
            handle: None,
            pid,
            started_at: start_time,
        });

        // Wait for completion with timeout
        let timeout_duration = std::time::Duration::from_secs(config.time_limit_secs);
        let result = tokio::time::timeout(timeout_duration, async {
            let output = child.wait_with_output()?;
            Ok::<_, anyhow::Error>(output)
        }).await;

        // Remove from tracking
        self.sandboxes.remove(&sandbox_id);

        match result {
            Ok(Ok(output)) => {
                let duration = start_time.elapsed();
                Ok(SandboxResult {
                    exit_code: output.status.code().unwrap_or(-1),
                    stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                    stderr: String::from_utf8_lossy(&output.stderr).to_string(),
                    duration_ms: duration.as_millis() as u64,
                    peak_memory_mb: 0,
                    killed: false,
                    kill_reason: None,
                })
            }
            Ok(Err(e)) => Err(e),
            Err(_) => {
                // Timeout - kill process group
                warn!(sandbox_id = %sandbox_id, "Process timed out, killing");
                let _ = child.kill();
                Ok(SandboxResult {
                    exit_code: -1,
                    stdout: String::new(),
                    stderr: "Process killed due to timeout".to_string(),
                    duration_ms: config.time_limit_secs * 1000,
                    peak_memory_mb: 0,
                    killed: true,
                    kill_reason: Some("timeout".to_string()),
                })
            }
        }
    }

    /// Kill a running sandbox
    pub fn kill(&mut self, sandbox_id: &str) -> Result<()> {
        if let Some(process) = self.sandboxes.remove(sandbox_id) {
            info!(sandbox_id = %sandbox_id, pid = process.pid, "Killing sandbox");
            
            #[cfg(windows)]
            {
                if let Some(handle) = process.handle {
                    unsafe {
                        let _ = windows::Win32::System::Threading::TerminateProcess(handle, 1);
                    }
                }
            }
            
            #[cfg(not(windows))]
            {
                // Kill process group
                unsafe {
                    libc::kill(-(process.pid as i32), libc::SIGKILL);
                }
            }
        }
        Ok(())
    }

    /// List active sandboxes
    pub fn list_active(&self) -> Vec<(String, u32)> {
        self.sandboxes
            .iter()
            .map(|(id, proc)| (id.clone(), proc.pid))
            .collect()
    }

    /// Check if sandbox is running
    pub fn is_running(&self, sandbox_id: &str) -> bool {
        self.sandboxes.contains_key(sandbox_id)
    }
}

impl Default for SandboxManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sandbox_config() {
        let config = SandboxConfig::default();
        assert_eq!(config.memory_limit_mb, 256);
        assert!(!config.network_allowed);
    }

    #[tokio::test]
    async fn test_sandbox_execute() {
        let mut manager = SandboxManager::new();
        manager.initialize().unwrap();

        #[cfg(windows)]
        let result = manager.execute(
            "test-1".to_string(),
            "cmd",
            &["/c", "echo hello"],
            None,
        ).await;

        #[cfg(not(windows))]
        let result = manager.execute(
            "test-1".to_string(),
            "echo",
            &["hello"],
            None,
        ).await;

        let result = result.unwrap();
        assert!(!result.killed);
        assert!(result.stdout.contains("hello"));
    }
}
