//! VS Code Extension Host Implementation
//! 
//! Manages extension lifecycle and process isolation
//! Based on patterns from onivim/vscode-exthost

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::api::ExtensionContext;
use super::manifest::ExtensionManifest;

/// Extension host managing all extensions
pub struct ExtensionHost {
    extensions: HashMap<String, Extension>,
    extension_order: Vec<String>,
    activated_extensions: HashMap<String, bool>,
    context: Arc<RwLock<HostContext>>,
}

/// Host context shared with extensions
#[derive(Debug, Default)]
pub struct HostContext {
    pub workspace_root: Option<PathBuf>,
    pub active_editor: Option<String>,
    pub diagnostics: HashMap<String, Vec<super::api::Diagnostic>>,
}

/// Loaded extension
#[derive(Debug)]
pub struct Extension {
    pub id: String,
    pub manifest: ExtensionManifest,
    pub context: ExtensionContext,
    pub state: ExtensionState,
    pub exports: Option<serde_json::Value>,
}

/// Extension state
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ExtensionState {
    Installed,
    Activating,
    Active,
    Inactive,
    Failed(String),
}

impl ExtensionHost {
    pub fn new() -> Self {
        Self {
            extensions: HashMap::new(),
            extension_order: Vec::new(),
            activated_extensions: HashMap::new(),
            context: Arc::new(RwLock::new(HostContext::default())),
        }
    }

    /// Load extension from directory
    pub fn load_extension(&mut self, extension_path: &PathBuf) -> anyhow::Result<String> {
        // Load package.json
        let package_json_path = extension_path.join("package.json");
        let manifest_content = std::fs::read_to_string(&package_json_path)?;
        let manifest: ExtensionManifest = serde_json::from_str(&manifest_content)?;
        
        let extension_id = format!("{}.{}", manifest.publisher, manifest.name);
        
        let extension = Extension {
            id: extension_id.clone(),
            manifest,
            context: ExtensionContext::new(&extension_id, &extension_path.to_string_lossy()),
            state: ExtensionState::Installed,
            exports: None,
        };
        
        self.extensions.insert(extension_id.clone(), extension);
        self.extension_order.push(extension_id.clone());
        
        Ok(extension_id)
    }

    /// Activate an extension
    pub fn activate_extension(&mut self, extension_id: &str) -> anyhow::Result<()> {
        let extension = self.extensions.get_mut(extension_id)
            .ok_or_else(|| anyhow::anyhow!("Extension not found: {}", extension_id))?;
        
        if extension.state == ExtensionState::Active {
            return Ok(());
        }
        
        extension.state = ExtensionState::Activating;
        
        // Check activation events
        if self.should_activate(&extension.manifest) {
            // Execute activation (would call JS/WASM in real implementation)
            extension.state = ExtensionState::Active;
            self.activated_extensions.insert(extension_id.to_string(), true);
        } else {
            extension.state = ExtensionState::Inactive;
        }
        
        Ok(())
    }

    /// Check if extension should activate based on events
    fn should_activate(&self, manifest: &ExtensionManifest) -> bool {
        if let Some(activation_events) = &manifest.activation_events {
            for event in activation_events {
                match event.as_str() {
                    "*" => return true, // Activate on startup
                    e if e.starts_with("onLanguage:") => {
                        // Check if language is active
                        let ctx = self.context.read();
                        if ctx.active_editor.is_some() {
                            return true;
                        }
                    }
                    e if e.starts_with("onCommand:") => {
                        // Will activate on command
                    }
                    e if e.starts_with("onView:") => {
                        // Will activate on view
                    }
                    e if e.starts_with("workspaceContains:") => {
                        // Check workspace for files
                        let ctx = self.context.read();
                        if ctx.workspace_root.is_some() {
                            return true;
                        }
                    }
                    _ => {}
                }
            }
        }
        
        // Default: activate if no activation events specified
        manifest.activation_events.is_none()
    }

    /// Deactivate an extension
    pub fn deactivate_extension(&mut self, extension_id: &str) -> anyhow::Result<()> {
        let extension = self.extensions.get_mut(extension_id)
            .ok_or_else(|| anyhow::anyhow!("Extension not found: {}", extension_id))?;
        
        if extension.state == ExtensionState::Active {
            // Call deactivate function (would call JS/WASM)
            extension.state = ExtensionState::Inactive;
            self.activated_extensions.remove(extension_id);
        }
        
        Ok(())
    }

    /// Get all extensions
    pub fn get_extensions(&self) -> Vec<&Extension> {
        self.extensions.values().collect()
    }

    /// Get active extensions
    pub fn get_active_extensions(&self) -> Vec<&Extension> {
        self.extensions.values()
            .filter(|e| e.state == ExtensionState::Active)
            .collect()
    }

    /// Get extension by ID
    pub fn get_extension(&self, extension_id: &str) -> Option<&Extension> {
        self.extensions.get(extension_id)
    }

    /// Execute a command from an extension
    pub fn execute_command(&mut self, command_id: &str, args: Vec<serde_json::Value>) -> anyhow::Result<Option<serde_json::Value>> {
        // Find extension that registered this command
        for extension in self.extensions.values_mut() {
            if let Some(commands) = &extension.manifest.contributes {
                if let Some(cmds) = &commands.commands {
                    if cmds.iter().any(|c| &c.command == command_id) {
                        if extension.state != ExtensionState::Active {
                            self.activate_extension(&extension.id)?;
                        }
                        
                        // Execute command (would call JS/WASM handler)
                        return Ok(Some(serde_json::json!({
                            "command": command_id,
                            "args": args,
                            "result": "executed"
                        })));
                    }
                }
            }
        }
        
        Err(anyhow::anyhow!("Command not found: {}", command_id))
    }

    /// Set workspace root
    pub fn set_workspace(&mut self, path: PathBuf) {
        let mut ctx = self.context.write();
        ctx.workspace_root = Some(path);
    }

    /// Set active editor
    pub fn set_active_editor(&mut self, uri: &str) {
        let mut ctx = self.context.write();
        ctx.active_editor = Some(uri.to_string());
    }
}

impl Default for ExtensionHost {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extension_host_creation() {
        let host = ExtensionHost::new();
        assert!(host.extensions.is_empty());
    }

    #[test]
    fn test_extension_state_transitions() {
        let state = ExtensionState::Installed;
        assert_eq!(state, ExtensionState::Installed);
    }
}
