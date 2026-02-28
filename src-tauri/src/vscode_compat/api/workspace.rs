//! VS Code Workspace API
//! Implements vscode.workspace namespace

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Workspace folder
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceFolder {
    pub uri: String,
    pub name: String,
    pub index: u32,
}

/// Workspace configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceConfiguration {
    pub values: std::collections::HashMap<String, serde_json::Value>,
}

impl WorkspaceConfiguration {
    pub fn new() -> Self {
        Self { values: std::collections::HashMap::new() }
    }

    pub fn get<T: serde::de::DeserializeOwned>(&self, key: &str) -> Option<T> {
        self.values.get(key).and_then(|v| serde_json::from_value(v.clone()).ok())
    }
}

impl Default for WorkspaceConfiguration {
    fn default() -> Self { Self::new() }
}
