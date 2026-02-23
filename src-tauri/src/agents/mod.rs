//! KYRO IDE Agent System
//! 
//! This module provides controlled, safe agent execution with:
//! - Resource limits (memory, CPU, time)
//! - Context persistence (SQLite-backed memory)
//! - File access control (whitelist/blacklist)
//! - Branch management (trunk-based development)
//! - Sync enforcement (automatic merging)

pub mod guardrails;
pub mod memory;
pub mod file_guard;
pub mod branch_manager;
pub mod sync_enforcer;
pub mod scheduler;

pub use guardrails::AgentGuardrails;
pub use memory::AgentMemory;
pub use file_guard::{FileGuardrails, FileAccess};
pub use branch_manager::BranchManager;
pub use sync_enforcer::SyncEnforcer;
pub use scheduler::AgentScheduler;

use serde::{Deserialize, Serialize};

/// Agent identifier
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentId(pub String);

/// Agent configuration
#[derive(Debug, Clone)]
pub struct AgentConfig {
    pub id: AgentId,
    pub max_memory_mb: usize,
    pub max_cpu_percent: f32,
    pub max_runtime_secs: u64,
    pub allowed_paths: Vec<String>,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            id: AgentId("default".to_string()),
            max_memory_mb: 2048,      // 2GB
            max_cpu_percent: 50.0,    // 50%
            max_runtime_secs: 600,    // 10 minutes
            allowed_paths: vec![
                "src/".to_string(),
                "src-tauri/src/".to_string(),
            ],
        }
    }
}

/// Work in progress tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkInProgress {
    pub task: String,
    pub file: String,
    pub line: usize,
    pub status: String,
}

/// Agent error types
#[derive(Debug, thiserror::Error)]
pub enum AgentError {
    #[error("Memory limit exceeded: used {used} bytes, limit {limit} bytes")]
    MemoryLimitExceeded { used: usize, limit: usize },
    
    #[error("CPU limit exceeded: {used}% > {limit}%")]
    CpuLimitExceeded { used: f32, limit: f32 },
    
    #[error("Runtime exceeded: {elapsed:?} > {limit:?}")]
    RuntimeExceeded { elapsed: std::time::Duration, limit: std::time::Duration },
    
    #[error("File access denied: {0}")]
    FileAccessDenied(String),
    
    #[error("Branch error: {0}")]
    BranchError(String),
    
    #[error("Sync error: {0}")]
    SyncError(String),
    
    #[error("Database error: {0}")]
    DatabaseError(String),
    
    #[error("Process error: {0}")]
    ProcessError(String),
    
    #[error("Scheduler busy: {0} agents queued")]
    SchedulerBusy(usize),
}

/// Tool call record for memory persistence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub tool: String,
    pub params: serde_json::Value,
    pub result: Option<String>,
    pub timestamp: i64,
}

/// Agent process handle
#[derive(Debug)]
pub struct AgentHandle {
    pub id: AgentId,
    pub pid: Option<u32>,
    pub started_at: std::time::Instant,
}
