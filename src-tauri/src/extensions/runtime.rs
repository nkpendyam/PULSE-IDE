//! Extension Runtime
//!
//! Manages extension lifecycle and execution

use std::collections::HashMap;

/// Extension runtime for managing extension lifecycle
pub struct ExtensionRuntime {
    /// Active extension hosts
    hosts: HashMap<String, ExtensionHost>,
}

impl ExtensionRuntime {
    pub fn new() -> Self {
        Self {
            hosts: HashMap::new(),
        }
    }
    
    /// Start extension host
    pub fn start_host(&mut self, extension_id: &str) -> anyhow::Result<()> {
        let host = ExtensionHost::new(extension_id);
        self.hosts.insert(extension_id.to_string(), host);
        Ok(())
    }
    
    /// Stop extension host
    pub fn stop_host(&mut self, extension_id: &str) -> bool {
        self.hosts.remove(extension_id).is_some()
    }
    
    /// Get active hosts
    pub fn active_hosts(&self) -> Vec<&str> {
        self.hosts.keys().map(|s| s.as_str()).collect()
    }
}

impl Default for ExtensionRuntime {
    fn default() -> Self {
        Self::new()
    }
}

/// Extension host (isolated execution environment)
pub struct ExtensionHost {
    /// Extension ID
    extension_id: String,
    /// Host state
    state: HostState,
}

/// Host state
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum HostState {
    Starting,
    Running,
    Stopping,
    Stopped,
    Error,
}

impl ExtensionHost {
    pub fn new(extension_id: &str) -> Self {
        Self {
            extension_id: extension_id.to_string(),
            state: HostState::Starting,
        }
    }
    
    /// Get host state
    pub fn state(&self) -> HostState {
        self.state
    }
    
    /// Activate extension
    pub async fn activate(&mut self) -> anyhow::Result<()> {
        self.state = HostState::Running;
        Ok(())
    }
    
    /// Deactivate extension
    pub async fn deactivate(&mut self) -> anyhow::Result<()> {
        self.state = HostState::Stopped;
        Ok(())
    }
}
