//! VS Code Commands API
//! Implements vscode.commands namespace

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Command handler type
pub type CommandHandler = Arc<dyn Fn(Vec<serde_json::Value>) -> serde_json::Value + Send + Sync>;

/// Command registry
pub struct CommandRegistry {
    commands: HashMap<String, CommandHandler>,
}

impl CommandRegistry {
    pub fn new() -> Self {
        Self { commands: HashMap::new() }
    }

    /// Register a command
    pub fn register(&mut self, id: &str, handler: CommandHandler) {
        self.commands.insert(id.to_string(), handler);
    }

    /// Execute a command
    pub fn execute(&self, id: &str, args: Vec<serde_json::Value>) -> Option<serde_json::Value> {
        self.commands.get(id).map(|handler| handler(args))
    }

    /// Get all registered command IDs
    pub fn list(&self) -> Vec<String> {
        self.commands.keys().cloned().collect()
    }
}

impl Default for CommandRegistry {
    fn default() -> Self { Self::new() }
}
