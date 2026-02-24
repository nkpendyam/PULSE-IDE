//! VS Code Commands API Implementation
//! 
//! Command registration and execution for extensions

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use parking_lot::RwLock;
use uuid::Uuid;

/// Command registry for VS Code compatible commands
pub struct CommandRegistry {
    commands: Arc<RwLock<HashMap<String, RegisteredCommand>>>,
    keybindings: HashMap<String, Vec<String>>,
}

/// A registered command
#[derive(Debug, Clone)]
pub struct RegisteredCommand {
    pub id: String,
    pub title: String,
    pub category: Option<String>,
    pub icon: Option<String>,
    pub handler: CommandHandler,
    pub when: Option<String>,
    pub keybinding: Option<Keybinding>,
}

/// Command handler type
#[derive(Debug, Clone)]
pub enum CommandHandler {
    /// Built-in command (Rust)
    Builtin(fn(Vec<serde_json::Value>) -> anyhow::Result<serde_json::Value>),
    /// Extension command (will be dispatched to extension host)
    Extension(String),
    /// No handler (placeholder)
    None,
}

/// Keybinding definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Keybinding {
    pub key: String,
    pub mac: Option<String>,
    pub win: Option<String>,
    pub linux: Option<String>,
    pub when: Option<String>,
}

/// Command execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResult {
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
}

impl CommandRegistry {
    pub fn new() -> Self {
        let registry = Self {
            commands: Arc::new(RwLock::new(HashMap::new())),
            keybindings: HashMap::new(),
        };
        
        // Register built-in commands
        registry.register_builtin_commands();
        registry
    }

    /// Register built-in KRO IDE commands
    fn register_builtin_commands(&self) {
        // File commands
        self.register_command(RegisteredCommand {
            id: "workbench.action.files.newFile".to_string(),
            title: "New File".to_string(),
            category: Some("File".to_string()),
            icon: Some("file-plus".to_string()),
            handler: CommandHandler::Builtin(|_| Ok(serde_json::json!({ "action": "newFile" }))),
            when: None,
            keybinding: Some(Keybinding {
                key: "Ctrl+N".to_string(),
                mac: Some("Cmd+N".to_string()),
                win: None,
                linux: None,
                when: None,
            }),
        });

        self.register_command(RegisteredCommand {
            id: "workbench.action.files.openFile".to_string(),
            title: "Open File...".to_string(),
            category: Some("File".to_string()),
            icon: Some("folder-open".to_string()),
            handler: CommandHandler::Builtin(|_| Ok(serde_json::json!({ "action": "openFile" }))),
            when: None,
            keybinding: Some(Keybinding {
                key: "Ctrl+O".to_string(),
                mac: Some("Cmd+O".to_string()),
                win: None,
                linux: None,
                when: None,
            }),
        });

        self.register_command(RegisteredCommand {
            id: "workbench.action.files.save".to_string(),
            title: "Save".to_string(),
            category: Some("File".to_string()),
            icon: Some("save".to_string()),
            handler: CommandHandler::Builtin(|_| Ok(serde_json::json!({ "action": "save" }))),
            when: None,
            keybinding: Some(Keybinding {
                key: "Ctrl+S".to_string(),
                mac: Some("Cmd+S".to_string()),
                win: None,
                linux: None,
                when: None,
            }),
        });

        self.register_command(RegisteredCommand {
            id: "workbench.action.files.saveAll".to_string(),
            title: "Save All".to_string(),
            category: Some("File".to_string()),
            icon: None,
            handler: CommandHandler::Builtin(|_| Ok(serde_json::json!({ "action": "saveAll" }))),
            when: None,
            keybinding: Some(Keybinding {
                key: "Ctrl+Shift+S".to_string(),
                mac: Some("Cmd+Shift+S".to_string()),
                win: None,
                linux: None,
                when: None,
            }),
        });

        // Edit commands
        self.register_command(RegisteredCommand {
            id: "editor.action.clipboardCutAction".to_string(),
            title: "Cut".to_string(),
            category: Some("Edit".to_string()),
            icon: Some("scissors".to_string()),
            handler: CommandHandler::Builtin(|_| Ok(serde_json::json!({ "action": "cut" }))),
            when: None,
            keybinding: Some(Keybinding {
                key: "Ctrl+X".to_string(),
                mac: Some("Cmd+X".to_string()),
                win: None,
                linux: None,
                when: None,
            }),
        });

        self.register_command(RegisteredCommand {
            id: "editor.action.clipboardCopyAction".to_string(),
            title: "Copy".to_string(),
            category: Some("Edit".to_string()),
            icon: Some("copy".to_string()),
            handler: CommandHandler::Builtin(|_| Ok(serde_json::json!({ "action": "copy" }))),
            when: None,
            keybinding: Some(Keybinding {
                key: "Ctrl+C".to_string(),
                mac: Some("Cmd+C".to_string()),
                win: None,
                linux: None,
                when: None,
            }),
        });

        self.register_command(RegisteredCommand {
            id: "editor.action.clipboardPasteAction".to_string(),
            title: "Paste".to_string(),
            category: Some("Edit".to_string()),
            icon: Some("clipboard".to_string()),
            handler: CommandHandler::Builtin(|_| Ok(serde_json::json!({ "action": "paste" }))),
            when: None,
            keybinding: Some(Keybinding {
                key: "Ctrl+V".to_string(),
                mac: Some("Cmd+V".to_string()),
                win: None,
                linux: None,
                when: None,
            }),
        });

        self.register_command(RegisteredCommand {
            id: "editor.action.undo".to_string(),
            title: "Undo".to_string(),
            category: Some("Edit".to_string()),
            icon: Some("undo".to_string()),
            handler: CommandHandler::Builtin(|_| Ok(serde_json::json!({ "action": "undo" }))),
            when: None,
            keybinding: Some(Keybinding {
                key: "Ctrl+Z".to_string(),
                mac: Some("Cmd+Z".to_string()),
                win: None,
                linux: None,
                when: None,
            }),
        });

        self.register_command(RegisteredCommand {
            id: "editor.action.redo".to_string(),
            title: "Redo".to_string(),
            category: Some("Edit".to_string()),
            icon: Some("redo".to_string()),
            handler: CommandHandler::Builtin(|_| Ok(serde_json::json!({ "action": "redo" }))),
            when: None,
            keybinding: Some(Keybinding {
                key: "Ctrl+Y".to_string(),
                mac: Some("Cmd+Shift+Z".to_string()),
                win: None,
                linux: None,
                when: None,
            }),
        });

        // Find commands
        self.register_command(RegisteredCommand {
            id: "actions.find".to_string(),
            title: "Find".to_string(),
            category: Some("Edit".to_string()),
            icon: Some("search".to_string()),
            handler: CommandHandler::Builtin(|_| Ok(serde_json::json!({ "action": "find" }))),
            when: None,
            keybinding: Some(Keybinding {
                key: "Ctrl+F".to_string(),
                mac: Some("Cmd+F".to_string()),
                win: None,
                linux: None,
                when: None,
            }),
        });

        self.register_command(RegisteredCommand {
            id: "editor.action.startFindReplaceAction".to_string(),
            title: "Replace".to_string(),
            category: Some("Edit".to_string()),
            icon: Some("find-replace".to_string()),
            handler: CommandHandler::Builtin(|_| Ok(serde_json::json!({ "action": "replace" }))),
            when: None,
            keybinding: Some(Keybinding {
                key: "Ctrl+H".to_string(),
                mac: Some("Cmd+H".to_string()),
                win: None,
                linux: None,
                when: None,
            }),
        });

        // View commands
        self.register_command(RegisteredCommand {
            id: "workbench.action.toggleSidebarVisibility".to_string(),
            title: "Toggle Sidebar".to_string(),
            category: Some("View".to_string()),
            icon: Some("sidebar".to_string()),
            handler: CommandHandler::Builtin(|_| Ok(serde_json::json!({ "action": "toggleSidebar" }))),
            when: None,
            keybinding: Some(Keybinding {
                key: "Ctrl+B".to_string(),
                mac: Some("Cmd+B".to_string()),
                win: None,
                linux: None,
                when: None,
            }),
        });

        self.register_command(RegisteredCommand {
            id: "workbench.action.terminal.toggleTerminal".to_string(),
            title: "Toggle Terminal".to_string(),
            category: Some("View".to_string()),
            icon: Some("terminal".to_string()),
            handler: CommandHandler::Builtin(|_| Ok(serde_json::json!({ "action": "toggleTerminal" }))),
            when: None,
            keybinding: Some(Keybinding {
                key: "Ctrl+`".to_string(),
                mac: Some("Cmd+`".to_string()),
                win: None,
                linux: None,
                when: None,
            }),
        });

        self.register_command(RegisteredCommand {
            id: "workbench.action.showCommands".to_string(),
            title: "Show All Commands".to_string(),
            category: Some("View".to_string()),
            icon: None,
            handler: CommandHandler::Builtin(|_| Ok(serde_json::json!({ "action": "showCommands" }))),
            when: None,
            keybinding: Some(Keybinding {
                key: "Ctrl+Shift+P".to_string(),
                mac: Some("Cmd+Shift+P".to_string()),
                win: None,
                linux: None,
                when: None,
            }),
        });

        // AI commands
        self.register_command(RegisteredCommand {
            id: "kyro.ai.explain".to_string(),
            title: "Explain Code".to_string(),
            category: Some("AI".to_string()),
            icon: Some("sparkles".to_string()),
            handler: CommandHandler::Builtin(|args| {
                Ok(serde_json::json!({ "action": "explain", "args": args }))
            }),
            when: None,
            keybinding: None,
        });

        self.register_command(RegisteredCommand {
            id: "kyro.ai.fix".to_string(),
            title: "Fix Code".to_string(),
            category: Some("AI".to_string()),
            icon: Some("wrench".to_string()),
            handler: CommandHandler::Builtin(|args| {
                Ok(serde_json::json!({ "action": "fix", "args": args }))
            }),
            when: None,
            keybinding: None,
        });

        self.register_command(RegisteredCommand {
            id: "kyro.ai.refactor".to_string(),
            title: "Refactor Code".to_string(),
            category: Some("AI".to_string()),
            icon: Some("code".to_string()),
            handler: CommandHandler::Builtin(|args| {
                Ok(serde_json::json!({ "action": "refactor", "args": args }))
            }),
            when: None,
            keybinding: None,
        });

        self.register_command(RegisteredCommand {
            id: "kyro.ai.generateTests".to_string(),
            title: "Generate Tests".to_string(),
            category: Some("AI".to_string()),
            icon: Some("beaker".to_string()),
            handler: CommandHandler::Builtin(|args| {
                Ok(serde_json::json!({ "action": "generateTests", "args": args }))
            }),
            when: None,
            keybinding: None,
        });

        self.register_command(RegisteredCommand {
            id: "kyro.ai.review".to_string(),
            title: "Code Review".to_string(),
            category: Some("AI".to_string()),
            icon: Some("comment".to_string()),
            handler: CommandHandler::Builtin(|args| {
                Ok(serde_json::json!({ "action": "review", "args": args }))
            }),
            when: None,
            keybinding: None,
        });
    }

    /// Register a new command
    pub fn register_command(&self, command: RegisteredCommand) {
        let mut commands = self.commands.write();
        
        if let Some(ref keybinding) = command.keybinding {
            let key = &keybinding.key;
            self.keybindings.entry(key.clone())
                .or_insert_with(Vec::new)
                .push(command.id.clone());
        }
        
        commands.insert(command.id.clone(), command);
    }

    /// Execute a command
    pub fn execute_command(&self, command_id: &str, args: Vec<serde_json::Value>) -> CommandResult {
        let commands = self.commands.read();
        
        match commands.get(command_id) {
            Some(cmd) => {
                match &cmd.handler {
                    CommandHandler::Builtin(handler) => {
                        match handler(args) {
                            Ok(result) => CommandResult {
                                success: true,
                                result: Some(result),
                                error: None,
                            },
                            Err(e) => CommandResult {
                                success: false,
                                result: None,
                                error: Some(e.to_string()),
                            },
                        }
                    }
                    CommandHandler::Extension(_ext_id) => {
                        // Would dispatch to extension host
                        CommandResult {
                            success: true,
                            result: Some(serde_json::json!({ "dispatched": true })),
                            error: None,
                        }
                    }
                    CommandHandler::None => {
                        CommandResult {
                            success: true,
                            result: None,
                            error: None,
                        }
                    }
                }
            }
            None => CommandResult {
                success: false,
                result: None,
                error: Some(format!("Command not found: {}", command_id)),
            },
        }
    }

    /// Get all registered commands
    pub fn get_all_commands(&self) -> Vec<CommandInfo> {
        let commands = self.commands.read();
        commands.values()
            .map(|cmd| CommandInfo {
                id: cmd.id.clone(),
                title: cmd.title.clone(),
                category: cmd.category.clone(),
                icon: cmd.icon.clone(),
            })
            .collect()
    }

    /// Get command by ID
    pub fn get_command(&self, command_id: &str) -> Option<CommandInfo> {
        let commands = self.commands.read();
        commands.get(command_id).map(|cmd| CommandInfo {
            id: cmd.id.clone(),
            title: cmd.title.clone(),
            category: cmd.category.clone(),
            icon: cmd.icon.clone(),
        })
    }

    /// Get commands by category
    pub fn get_commands_by_category(&self, category: &str) -> Vec<CommandInfo> {
        let commands = self.commands.read();
        commands.values()
            .filter(|cmd| cmd.category.as_deref() == Some(category))
            .map(|cmd| CommandInfo {
                id: cmd.id.clone(),
                title: cmd.title.clone(),
                category: cmd.category.clone(),
                icon: cmd.icon.clone(),
            })
            .collect()
    }
}

impl Default for CommandRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Command info for display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandInfo {
    pub id: String,
    pub title: String,
    pub category: Option<String>,
    pub icon: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_command_registry_creation() {
        let registry = CommandRegistry::new();
        let commands = registry.get_all_commands();
        assert!(!commands.is_empty());
    }

    #[test]
    fn test_builtin_commands() {
        let registry = CommandRegistry::new();
        
        // Test save command
        let result = registry.execute_command("workbench.action.files.save", vec![]);
        assert!(result.success);
        
        // Test AI explain
        let result = registry.execute_command("kyro.ai.explain", vec![
            serde_json::json!({ "code": "fn main() {}" })
        ]);
        assert!(result.success);
    }

    #[test]
    fn test_unknown_command() {
        let registry = CommandRegistry::new();
        let result = registry.execute_command("unknown.command", vec![]);
        assert!(!result.success);
        assert!(result.error.is_some());
    }

    #[test]
    fn test_get_commands_by_category() {
        let registry = CommandRegistry::new();
        let file_commands = registry.get_commands_by_category("File");
        assert!(!file_commands.is_empty());
        
        let ai_commands = registry.get_commands_by_category("AI");
        assert!(!ai_commands.is_empty());
    }
}
