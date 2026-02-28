//! Extension Sandbox
//!
//! Provides security sandboxing for extensions

use serde::{Deserialize, Serialize};

/// Sandbox configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxConfig {
    /// Allow network access
    pub allow_network: bool,
    /// Allow file system access
    pub allow_filesystem: bool,
    /// Allow subprocess execution
    pub allow_subprocess: bool,
    /// Allowed paths (for filesystem access)
    pub allowed_paths: Vec<String>,
    /// CPU time limit (ms)
    pub cpu_limit_ms: Option<u64>,
    /// Memory limit (bytes)
    pub memory_limit: Option<u64>,
}

impl Default for SandboxConfig {
    fn default() -> Self {
        Self {
            allow_network: false,
            allow_filesystem: true,
            allow_subprocess: false,
            allowed_paths: vec![],
            cpu_limit_ms: Some(5000),
            memory_limit: Some(100 * 1024 * 1024), // 100MB
        }
    }
}

/// Extension sandbox
pub struct ExtensionSandbox {
    config: SandboxConfig,
}

impl ExtensionSandbox {
    pub fn new(config: SandboxConfig) -> Self {
        Self { config }
    }
    
    /// Check if operation is allowed
    pub fn check_permission(&self, operation: &str) -> bool {
        match operation {
            "network" => self.config.allow_network,
            "filesystem" => self.config.allow_filesystem,
            "subprocess" => self.config.allow_subprocess,
            _ => false,
        }
    }
    
    /// Get config
    pub fn config(&self) -> &SandboxConfig {
        &self.config
    }
}

impl Default for ExtensionSandbox {
    fn default() -> Self {
        Self::new(SandboxConfig::default())
    }
}
