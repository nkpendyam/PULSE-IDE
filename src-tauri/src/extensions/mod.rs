//! VS Code Extension Compatibility Layer
//!
//! Open VSX Trojan Horse - Port top VS Code extensions to Kyro IDE
//! making it the best platform for them.
//!
//! This module provides:
//! - VS Code Extension API compatibility
//! - Open VSX registry integration
//! - Extension sandboxing for security
//! - Hot-reload support

pub mod api;
pub mod registry;
pub mod runtime;
pub mod sandbox;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use chrono::{DateTime, Utc};

pub use api::{ExtensionContext, ExtensionApi};
pub use registry::{OpenVSXRegistry, ExtensionMetadata};
pub use runtime::{ExtensionRuntime, ExtensionHost};
pub use sandbox::{ExtensionSandbox, SandboxConfig};

/// Installed extension information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledExtension {
    /// Extension ID (publisher.name)
    pub id: String,
    /// Extension display name
    pub name: String,
    /// Publisher/author
    pub publisher: String,
    /// Version
    pub version: String,
    /// Description
    pub description: String,
    /// Installation path
    pub path: PathBuf,
    /// Enabled state
    pub enabled: bool,
    /// Installation timestamp
    pub installed_at: DateTime<Utc>,
    /// Extension capabilities
    pub capabilities: ExtensionCapabilities,
    /// Configuration
    pub configuration: HashMap<String, serde_json::Value>,
}

/// Extension capabilities
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ExtensionCapabilities {
    /// Can contribute commands
    pub commands: bool,
    /// Can contribute languages
    pub languages: bool,
    /// Can contribute themes
    pub themes: bool,
    /// Can contribute keybindings
    pub keybindings: bool,
    /// Has language server
    pub language_server: bool,
    /// Has debugger
    pub debugger: bool,
    /// Uses workspace storage
    pub workspace_storage: bool,
    /// Requires network access
    pub network_access: bool,
}

/// Extension manager for installing/managing extensions
pub struct ExtensionManager {
    /// Installed extensions
    installed: HashMap<String, InstalledExtension>,
    /// Extension runtime
    runtime: ExtensionRuntime,
    /// Open VSX registry client
    registry: OpenVSXRegistry,
    /// Extension storage path
    storage_path: PathBuf,
}

impl ExtensionManager {
    /// Create new extension manager
    pub fn new(storage_path: PathBuf) -> Self {
        Self {
            installed: HashMap::new(),
            runtime: ExtensionRuntime::new(),
            registry: OpenVSXRegistry::new(),
            storage_path,
        }
    }
    
    /// Install extension from Open VSX
    pub async fn install(&mut self, extension_id: &str) -> anyhow::Result<String> {
        // Parse publisher.name format
        let parts: Vec<&str> = extension_id.split('.').collect();
        if parts.len() != 2 {
            return Err(anyhow::anyhow!("Invalid extension ID format. Use publisher.name"));
        }
        
        let publisher = parts[0];
        let name = parts[1];
        
        // Fetch metadata from Open VSX
        let metadata = self.registry.get_extension(publisher, name).await?;
        
        // Download extension
        let extension_path = self.storage_path.join(extension_id);
        self.registry.download_extension(&metadata, &extension_path).await?;
        
        // Create installed extension record
        let installed = InstalledExtension {
            id: extension_id.to_string(),
            name: metadata.name,
            publisher: metadata.publisher,
            version: metadata.version,
            description: metadata.description.unwrap_or_default(),
            path: extension_path,
            enabled: true,
            installed_at: Utc::now(),
            capabilities: ExtensionCapabilities::default(),
            configuration: HashMap::new(),
        };
        
        self.installed.insert(extension_id.to_string(), installed);
        
        Ok(extension_id.to_string())
    }
    
    /// Uninstall extension
    pub fn uninstall(&mut self, extension_id: &str) -> bool {
        if let Some(ext) = self.installed.remove(extension_id) {
            // Remove extension files
            if let Err(e) = std::fs::remove_dir_all(&ext.path) {
                log::warn!("Failed to remove extension files: {}", e);
            }
            true
        } else {
            false
        }
    }
    
    /// Enable/disable extension
    pub fn set_enabled(&mut self, extension_id: &str, enabled: bool) -> bool {
        if let Some(ext) = self.installed.get_mut(extension_id) {
            ext.enabled = enabled;
            true
        } else {
            false
        }
    }
    
    /// List installed extensions
    pub fn list_installed(&self) -> Vec<&InstalledExtension> {
        self.installed.values().collect()
    }
    
    /// Get extension by ID
    pub fn get(&self, extension_id: &str) -> Option<&InstalledExtension> {
        self.installed.get(extension_id)
    }
    
    /// Search Open VSX registry
    pub async fn search(&self, query: &str) -> anyhow::Result<Vec<ExtensionMetadata>> {
        self.registry.search(query).await
    }
}

impl Default for ExtensionManager {
    fn default() -> Self {
        Self::new(PathBuf::from("~/.local/share/kyro-ide/extensions"))
    }
}

/// Top priority extensions to port (from Open VSX Trojan Horse tactic)
pub const PRIORITY_EXTENSIONS: &[(&str, &str, &str)] = &[
    ("esbenp.prettier-vscode", "Prettier", "Code formatter using prettier"),
    ("dbaeumer.vscode-eslint", "ESLint", "Integrates ESLint JavaScript into VS Code"),
    ("eamodio.gitlens", "GitLens", "Git supercharged"),
    ("vscodevim.vim", "Vim", "Vim emulation for Visual Studio Code"),
    ("christian-kohler.path-intellisense", "Path Intellisense", "Autocomplete filenames"),
];

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_extension_manager_creation() {
        let manager = ExtensionManager::default();
        assert!(manager.installed.is_empty());
    }
    
    #[test]
    fn test_priority_extensions_list() {
        assert_eq!(PRIORITY_EXTENSIONS.len(), 5);
    }
}
