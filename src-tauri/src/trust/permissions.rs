//! Trust Permissions Module
//!
//! Permission management for workspace and extension trust

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Permission level for a workspace or extension
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PermissionLevel {
    /// Full trust - all operations allowed
    Full,
    /// Restricted - read operations only
    Restricted,
    /// Untrusted - no operations allowed
    Untrusted,
}

/// Permission entry for a specific path
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionEntry {
    pub path: PathBuf,
    pub level: PermissionLevel,
    pub granted_at: String,
}

/// Permission manager
pub struct PermissionManager {
    entries: Vec<PermissionEntry>,
}

impl PermissionManager {
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
        }
    }

    /// Grant permission to a path
    pub fn grant(&mut self, path: PathBuf, level: PermissionLevel) {
        self.entries.push(PermissionEntry {
            path,
            level,
            granted_at: chrono::Utc::now().to_rfc3339(),
        });
    }

    /// Check permission for a path
    pub fn check(&self, path: &PathBuf) -> PermissionLevel {
        self.entries
            .iter()
            .find(|e| path.starts_with(&e.path))
            .map(|e| e.level)
            .unwrap_or(PermissionLevel::Untrusted)
    }

    /// Revoke permission for a path
    pub fn revoke(&mut self, path: &PathBuf) {
        self.entries.retain(|e| &e.path != path);
    }
}

impl Default for PermissionManager {
    fn default() -> Self {
        Self::new()
    }
}
