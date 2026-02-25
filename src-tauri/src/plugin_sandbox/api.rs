//! Plugin API for KRO_IDE
//!
//! Defines the interface that plugins can use

use super::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Plugin API interface
pub trait PluginApi: Send + Sync {
    /// Get plugin info
    fn info(&self) -> &PluginMetadata;
    
    /// Initialize plugin
    fn init(&mut self, context: &PluginContext) -> Result<()>;
    
    /// Shutdown plugin
    fn shutdown(&mut self) -> Result<()>;
    
    /// Execute a command
    fn execute(&mut self, command: &str, args: &serde_json::Value) -> Result<serde_json::Value>;
    
    /// Get available commands
    fn commands(&self) -> Vec<&str>;
}

/// Plugin command definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginCommand {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
    pub returns: serde_json::Value,
}

/// Plugin configuration schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginConfigSchema {
    pub properties: HashMap<String, ConfigProperty>,
    pub required: Vec<String>,
}

/// Configuration property
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigProperty {
    #[serde(rename = "type")]
    pub prop_type: String,
    pub description: Option<String>,
    pub default: Option<serde_json::Value>,
    pub enum_values: Option<Vec<String>>,
    pub minimum: Option<f64>,
    pub maximum: Option<f64>,
}

/// Plugin lifecycle events
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum PluginEvent {
    /// Plugin activated
    Activated { plugin_id: String },
    /// Plugin deactivated
    Deactivated { plugin_id: String },
    /// Plugin error
    Error { plugin_id: String, error: String },
    /// Command executed
    CommandExecuted { plugin_id: String, command: String, success: bool },
    /// Configuration changed
    ConfigChanged { plugin_id: String },
}

/// Plugin result wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginResult<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> PluginResult<T> {
    pub fn ok(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }
    
    pub fn err(error: impl Into<String>) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error.into()),
        }
    }
}

/// Built-in commands that all plugins can use
pub const BUILTIN_COMMANDS: &[(&str, &str)] = &[
    ("log", "Log a message to the console"),
    ("get_config", "Get plugin configuration"),
    ("set_config", "Update plugin configuration"),
    ("get_data_dir", "Get plugin data directory path"),
    ("has_capability", "Check if a capability is granted"),
];

/// Editor API commands (requires editor.read/write capabilities)
pub const EDITOR_COMMANDS: &[(&str, &str, &[&str])] = &[
    ("editor.getContent", "Get editor content", &["editor.read"]),
    ("editor.setContent", "Set editor content", &["editor.write"]),
    ("editor.getSelection", "Get current selection", &["editor.selection"]),
    ("editor.setSelection", "Set selection range", &["editor.selection"]),
    ("editor.insertText", "Insert text at position", &["editor.write"]),
    ("editor.deleteText", "Delete text range", &["editor.write"]),
    ("editor.openFile", "Open a file", &["editor.read"]),
    ("editor.saveFile", "Save current file", &["editor.write"]),
    ("editor.showNotification", "Show notification", &["editor.ui"]),
    ("editor.showQuickPick", "Show quick pick dialog", &["editor.ui"]),
];

/// File system API commands (requires fs.* capabilities)
pub const FS_COMMANDS: &[(&str, &str, &[&str])] = &[
    ("fs.readFile", "Read file contents", &["fs.read"]),
    ("fs.writeFile", "Write file contents", &["fs.write"]),
    ("fs.listDir", "List directory contents", &["fs.list"]),
    ("fs.createDir", "Create directory", &["fs.write"]),
    ("fs.delete", "Delete file or directory", &["fs.write"]),
    ("fs.exists", "Check if path exists", &["fs.read"]),
    ("fs.watch", "Watch file for changes", &["fs.watch"]),
];

/// AI API commands (requires ai.* capabilities)
pub const AI_COMMANDS: &[(&str, &str, &[&str])] = &[
    ("ai.complete", "Get AI completion", &["ai.completion"]),
    ("ai.analyze", "Analyze code", &["ai.analysis"]),
    ("ai.chat", "Chat with AI", &["ai.completion"]),
    ("ai.embed", "Get text embeddings", &["ai.models"]),
    ("ai.listModels", "List available models", &["ai.models"]),
];

/// Terminal API commands (requires terminal.* capabilities)
pub const TERMINAL_COMMANDS: &[(&str, &str, &[&str])] = &[
    ("terminal.execute", "Execute command", &["terminal.execute"]),
    ("terminal.readOutput", "Read terminal output", &["terminal.read"]),
    ("terminal.writeInput", "Write to terminal input", &["terminal.execute"]),
];

/// Git API commands (requires git.* capabilities)
pub const GIT_COMMANDS: &[(&str, &str, &[&str])] = &[
    ("git.status", "Get git status", &["git.read"]),
    ("git.diff", "Get git diff", &["git.read"]),
    ("git.commit", "Create commit", &["git.execute"]),
    ("git.branch", "Create/switch branch", &["git.execute"]),
    ("git.log", "Get commit history", &["git.read"]),
];
