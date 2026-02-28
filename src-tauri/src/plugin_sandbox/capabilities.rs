//! Plugin Capabilities System
//!
//! Capability-based security for WASM plugins

use serde::{Deserialize, Serialize};
use std::collections::HashSet;

/// Plugin capability
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Capability {
    // File system access
    /// Read files (with path restrictions)
    FsRead,
    /// Write files (with path restrictions)
    FsWrite,
    /// List directories
    FsList,
    /// Watch file changes
    FsWatch,
    
    // Network access
    /// Make HTTP requests
    NetHttp,
    /// WebSocket connections
    NetWebSocket,
    /// DNS resolution
    NetDns,
    
    // Editor access
    /// Read editor content
    EditorRead,
    /// Modify editor content
    EditorWrite,
    /// Access selections and cursors
    EditorSelection,
    /// Show UI elements
    EditorUi,
    
    // Terminal access
    /// Execute terminal commands
    TerminalExecute,
    /// Read terminal output
    TerminalRead,
    
    // AI access
    /// Use AI for completions
    AiCompletion,
    /// Use AI for analysis
    AiAnalysis,
    /// Access AI models
    AiModels,
    
    // Git access
    /// Read git status
    GitRead,
    /// Execute git commands
    GitExecute,
    
    // System access
    /// Access clipboard
    SystemClipboard,
    /// Show notifications
    SystemNotifications,
    /// Access environment variables
    SystemEnv,
    
    // Storage
    /// Persistent storage
    Storage,
    /// Temporary storage
    TempStorage,
}

impl Capability {
    /// Parse from string
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "fs.read" => Some(Self::FsRead),
            "fs.write" => Some(Self::FsWrite),
            "fs.list" => Some(Self::FsList),
            "fs.watch" => Some(Self::FsWatch),
            "net.http" => Some(Self::NetHttp),
            "net.websocket" => Some(Self::NetWebSocket),
            "net.dns" => Some(Self::NetDns),
            "editor.read" => Some(Self::EditorRead),
            "editor.write" => Some(Self::EditorWrite),
            "editor.selection" => Some(Self::EditorSelection),
            "editor.ui" => Some(Self::EditorUi),
            "terminal.execute" => Some(Self::TerminalExecute),
            "terminal.read" => Some(Self::TerminalRead),
            "ai.completion" => Some(Self::AiCompletion),
            "ai.analysis" => Some(Self::AiAnalysis),
            "ai.models" => Some(Self::AiModels),
            "git.read" => Some(Self::GitRead),
            "git.execute" => Some(Self::GitExecute),
            "system.clipboard" => Some(Self::SystemClipboard),
            "system.notifications" => Some(Self::SystemNotifications),
            "system.env" => Some(Self::SystemEnv),
            "storage" => Some(Self::Storage),
            "temp" => Some(Self::TempStorage),
            _ => None,
        }
    }
    
    /// Convert to string
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::FsRead => "fs.read",
            Self::FsWrite => "fs.write",
            Self::FsList => "fs.list",
            Self::FsWatch => "fs.watch",
            Self::NetHttp => "net.http",
            Self::NetWebSocket => "net.websocket",
            Self::NetDns => "net.dns",
            Self::EditorRead => "editor.read",
            Self::EditorWrite => "editor.write",
            Self::EditorSelection => "editor.selection",
            Self::EditorUi => "editor.ui",
            Self::TerminalExecute => "terminal.execute",
            Self::TerminalRead => "terminal.read",
            Self::AiCompletion => "ai.completion",
            Self::AiAnalysis => "ai.analysis",
            Self::AiModels => "ai.models",
            Self::GitRead => "git.read",
            Self::GitExecute => "git.execute",
            Self::SystemClipboard => "system.clipboard",
            Self::SystemNotifications => "system.notifications",
            Self::SystemEnv => "system.env",
            Self::Storage => "storage",
            Self::TempStorage => "temp",
        }
    }
    
    /// Get risk level
    pub fn risk_level(&self) -> RiskLevel {
        match self {
            // Low risk - read-only operations
            Self::FsRead | Self::FsList | Self::FsWatch |
            Self::EditorRead | Self::EditorSelection |
            Self::TerminalRead |
            Self::GitRead |
            Self::SystemClipboard => RiskLevel::Low,
            
            // Medium risk - limited write operations
            Self::EditorWrite | Self::EditorUi |
            Self::SystemNotifications |
            Self::Storage | Self::TempStorage |
            Self::AiCompletion | Self::AiAnalysis => RiskLevel::Medium,
            
            // High risk - network and system access
            Self::FsWrite |
            Self::NetHttp | Self::NetWebSocket | Self::NetDns |
            Self::TerminalExecute |
            Self::AiModels |
            Self::GitExecute |
            Self::SystemEnv => RiskLevel::High,
        }
    }
}

impl std::fmt::Display for Capability {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Risk level for capabilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
}

/// Set of capabilities
#[derive(Debug, Clone, Default)]
pub struct CapabilitySet {
    capabilities: HashSet<String>,
}

impl CapabilitySet {
    pub fn new() -> Self {
        Self {
            capabilities: HashSet::new(),
        }
    }
    
    /// Create from iterator
    pub fn from_iter<'a, I: IntoIterator<Item = &'a str>>(iter: I) -> Self {
        Self {
            capabilities: iter.into_iter().map(|s| s.to_string()).collect(),
        }
    }
    
    /// Add a capability
    pub fn add(&mut self, capability: impl AsRef<str>) {
        self.capabilities.insert(capability.as_ref().to_string());
    }
    
    /// Remove a capability
    pub fn remove(&mut self, capability: impl AsRef<str>) {
        self.capabilities.remove(capability.as_ref());
    }
    
    /// Check if capability is present
    pub fn has(&self, capability: impl AsRef<str>) -> bool {
        self.capabilities.contains(capability.as_ref())
    }
    
    /// Check if all capabilities are present
    pub fn has_all(&self, capabilities: &[&str]) -> bool {
        capabilities.iter().all(|c| self.has(*c))
    }
    
    /// Check if any capability is present
    pub fn has_any(&self, capabilities: &[&str]) -> bool {
        capabilities.iter().any(|c| self.has(*c))
    }
    
    /// Merge with another set
    pub fn merge(&mut self, other: &CapabilitySet) {
        for cap in &other.capabilities {
            self.capabilities.insert(cap.clone());
        }
    }
    
    /// Get capabilities as slice
    pub fn as_slice(&self) -> Vec<&str> {
        self.capabilities.iter().map(|s| s.as_str()).collect()
    }
    
    /// Get count
    pub fn len(&self) -> usize {
        self.capabilities.len()
    }
    
    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.capabilities.is_empty()
    }
    
    /// Filter by risk level
    pub fn filter_by_risk(&self, max_risk: RiskLevel) -> Self {
        Self::from_iter(
            self.capabilities.iter()
                .filter_map(|s| {
                    Capability::from_str(s)
                        .filter(|c| c.risk_level() <= max_risk)
                        .map(|c| c.as_str())
                })
        )
    }
}

/// Default capabilities for untrusted plugins
pub fn default_sandbox_capabilities() -> CapabilitySet {
    CapabilitySet::from_iter([
        "editor.read",
        "editor.selection",
        "storage",
        "temp",
    ])
}

/// Full capabilities for trusted plugins
pub fn full_capabilities() -> CapabilitySet {
    CapabilitySet::from_iter([
        "fs.read", "fs.write", "fs.list", "fs.watch",
        "net.http", "net.websocket",
        "editor.read", "editor.write", "editor.selection", "editor.ui",
        "terminal.execute", "terminal.read",
        "ai.completion", "ai.analysis",
        "git.read",
        "system.clipboard", "system.notifications",
        "storage", "temp",
    ])
}
