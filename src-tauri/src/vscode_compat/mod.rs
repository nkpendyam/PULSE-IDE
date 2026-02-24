//! VS Code Extension Compatibility Layer for KYRO IDE
//!
//! This module provides full VS Code extension API compatibility, allowing users
//! to install and run VS Code extensions directly in KYRO IDE.
//!
//! ## Architecture
//! - `api` - VS Code namespace API shim (window, workspace, commands, etc.)
//! - `extension_host` - Extension lifecycle and process management
//! - `manifest` - Extension manifest (package.json) parsing and validation
//! - `marketplace` - VS Code Marketplace client for extension discovery
//! - `protocol` - JSON-RPC protocol for extension communication

pub mod api;
pub mod extension_host;
pub mod manifest;
pub mod marketplace;
pub mod protocol;

pub use api::VsCodeApi;
pub use extension_host::{ExtensionHost, ExtensionState};
pub use manifest::{ExtensionManifest, ExtensionKind};
pub use marketplace::{MarketplaceClient, ExtensionQuery};
pub use protocol::ExtensionProtocol;

use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

/// VS Code extension compatibility manager
pub struct VSCodeCompatibilityManager {
    /// Extension host processes
    hosts: Arc<RwLock<HashMap<String, ExtensionHost>>>,
    /// Loaded extensions
    extensions: Arc<RwLock<HashMap<String, LoadedExtension>>>,
    /// Marketplace client
    marketplace: MarketplaceClient,
    /// Extension installation directory
    extensions_dir: PathBuf,
    /// Global storage directory
    global_storage: PathBuf,
}

/// Loaded extension instance
#[derive(Debug)]
pub struct LoadedExtension {
    pub manifest: ExtensionManifest,
    pub state: ExtensionState,
    pub extension_path: PathBuf,
    pub subscriptions: Vec<String>,
    pub activation_events: Vec<String>,
}

/// Extension activation context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionContext {
    pub extension_path: String,
    pub global_state: serde_json::Value,
    pub workspace_state: serde_json::Value,
    pub subscriptions: Vec<String>,
    pub extension_mode: ExtensionMode,
    pub log_path: String,
    pub storage_uri: Option<String>,
    pub global_storage_uri: Option<String>,
}

/// Extension running mode
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum ExtensionMode {
    Production,
    Development,
    Test,
}

/// Extension activation event
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "value")]
pub enum ActivationEvent {
    #[serde(rename = "onLanguage")]
    OnLanguage(String),
    #[serde(rename = "onCommand")]
    OnCommand(String),
    #[serde(rename = "workspaceContains")]
    WorkspaceContains(String),
    #[serde(rename = "onFileSystem")]
    OnFileSystem(String),
    #[serde(rename = "onView")]
    OnView(String),
    #[serde(rename = "onUri")]
    OnUri,
    #[serde(rename = "onWebviewPanel")]
    OnWebviewPanel(String),
    #[serde(rename = "onCustomEditor")]
    OnCustomEditor(String),
    #[serde(rename = "onStartupFinished")]
    OnStartupFinished,
    #[serde(rename = "*")]
    OnStartup,
}

impl VSCodeCompatibilityManager {
    /// Create a new VS Code compatibility manager
    pub fn new(extensions_dir: PathBuf) -> Self {
        let global_storage = extensions_dir.join("global_storage");
        
        Self {
            hosts: Arc::new(RwLock::new(HashMap::new())),
            extensions: Arc::new(RwLock::new(HashMap::new())),
            marketplace: MarketplaceClient::new(),
            extensions_dir,
            global_storage,
        }
    }
    
    /// Initialize the compatibility layer
    pub async fn initialize(&self) -> Result<()> {
        // Create directories
        std::fs::create_dir_all(&self.extensions_dir)?;
        std::fs::create_dir_all(&self.global_storage)?;
        
        // Scan for installed extensions
        self.scan_extensions().await?;
        
        log::info!("VS Code compatibility layer initialized");
        Ok(())
    }
    
    /// Scan for installed extensions
    pub async fn scan_extensions(&self) -> Result<Vec<String>> {
        let mut found = Vec::new();
        
        if !self.extensions_dir.exists() {
            return Ok(found);
        }
        
        for entry in std::fs::read_dir(&self.extensions_dir)? {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_dir() {
                if let Ok(manifest) = ExtensionManifest::from_dir(&path) {
                    let extension_id = manifest.identifier.id.clone();
                    found.push(extension_id.clone());
                    
                    let loaded = LoadedExtension {
                        manifest,
                        state: ExtensionState::Inactive,
                        extension_path: path,
                        subscriptions: Vec::new(),
                        activation_events: Vec::new(),
                    };
                    
                    self.extensions.write().await.insert(extension_id, loaded);
                }
            }
        }
        
        log::info!("Found {} installed VS Code extensions", found.len());
        Ok(found)
    }
    
    /// Install extension from marketplace
    pub async fn install_extension(&self, extension_id: &str) -> Result<()> {
        log::info!("Installing extension: {}", extension_id);
        
        // Query marketplace
        let query = ExtensionQuery {
            extension_id: Some(extension_id.to_string()),
            ..Default::default()
        };
        
        let results = self.marketplace.search(&query).await?;
        let extension = results.first()
            .ok_or_else(|| anyhow::anyhow!("Extension not found: {}", extension_id))?;
        
        // Download extension
        let vsix_path = self.marketplace.download_extension(&extension.publisher_name, &extension.extension_name, &extension.version)
            .await?;
        
        // Extract VSIX
        let extract_dir = self.extensions_dir.join(extension_id);
        self.extract_vsix(&vsix_path, &extract_dir)?;
        
        // Load extension
        let manifest = ExtensionManifest::from_dir(&extract_dir)?;
        let loaded = LoadedExtension {
            manifest,
            state: ExtensionState::Inactive,
            extension_path: extract_dir,
            subscriptions: Vec::new(),
            activation_events: Vec::new(),
        };
        
        self.extensions.write().await.insert(extension_id.to_string(), loaded);
        
        log::info!("Successfully installed extension: {}", extension_id);
        Ok(())
    }
    
    /// Uninstall extension
    pub async fn uninstall_extension(&self, extension_id: &str) -> Result<()> {
        let mut extensions = self.extensions.write().await;
        
        if let Some(mut ext) = extensions.remove(extension_id) {
            // Deactivate first
            if ext.state == ExtensionState::Active {
                ext.state = ExtensionState::Deactivating;
                // Would call deactivate on extension host
            }
            
            // Remove directory
            if ext.extension_path.exists() {
                std::fs::remove_dir_all(&ext.extension_path)?;
            }
            
            log::info!("Uninstalled extension: {}", extension_id);
        }
        
        Ok(())
    }
    
    /// Activate extension
    pub async fn activate_extension(&self, extension_id: &str) -> Result<()> {
        let mut extensions = self.extensions.write().await;
        
        let extension = extensions.get_mut(extension_id)
            .ok_or_else(|| anyhow::anyhow!("Extension not found: {}", extension_id))?;
        
        if extension.state != ExtensionState::Inactive {
            return Ok(());
        }
        
        extension.state = ExtensionState::Activating;
        
        // Create extension context
        let context = ExtensionContext {
            extension_path: extension.extension_path.to_string_lossy().to_string(),
            global_state: serde_json::json!({}),
            workspace_state: serde_json::json!({}),
            subscriptions: Vec::new(),
            extension_mode: ExtensionMode::Production,
            log_path: self.global_storage.join(format!("{}.log", extension_id)).to_string_lossy().to_string(),
            storage_uri: None,
            global_storage_uri: Some(self.global_storage.to_string_lossy().to_string()),
        };
        
        // Create extension host if needed
        let host = ExtensionHost::new(extension_id.to_string(), extension.extension_path.clone())?;
        host.activate(&context).await?;
        
        self.hosts.write().await.insert(extension_id.to_string(), host);
        
        extension.state = ExtensionState::Active;
        log::info!("Activated extension: {}", extension_id);
        
        Ok(())
    }
    
    /// Deactivate extension
    pub async fn deactivate_extension(&self, extension_id: &str) -> Result<()> {
        let mut extensions = self.extensions.write().await;
        
        let extension = extensions.get_mut(extension_id)
            .ok_or_else(|| anyhow::anyhow!("Extension not found: {}", extension_id))?;
        
        if extension.state != ExtensionState::Active {
            return Ok(());
        }
        
        extension.state = ExtensionState::Deactivating;
        
        // Deactivate host
        if let Some(host) = self.hosts.write().await.get_mut(extension_id) {
            host.deactivate().await?;
        }
        
        extension.state = ExtensionState::Inactive;
        log::info!("Deactivated extension: {}", extension_id);
        
        Ok(())
    }
    
    /// Get all extensions
    pub async fn list_extensions(&self) -> Vec<&LoadedExtension> {
        self.extensions.read().await.values().collect()
    }
    
    /// Get extension by ID
    pub async fn get_extension(&self, extension_id: &str) -> Option<LoadedExtension> {
        self.extensions.read().await.get(extension_id).cloned()
    }
    
    /// Check activation events and activate matching extensions
    pub async fn check_activation_events(&self, event: &ActivationEvent) -> Result<Vec<String>> {
        let mut activated = Vec::new();
        let extensions = self.extensions.read().await;
        
        for (id, ext) in extensions.iter() {
            if ext.state != ExtensionState::Inactive {
                continue;
            }
            
            // Check if extension activates on this event
            let should_activate = ext.manifest.activation_events.iter().any(|ae| {
                match (event, ae.as_str()) {
                    (ActivationEvent::OnLanguage(lang), ae) => {
                        ae == &format!("onLanguage:{}", lang) || ae == "*"
                    }
                    (ActivationEvent::OnCommand(cmd), ae) => {
                        ae == &format!("onCommand:{}", cmd) || ae == "*"
                    }
                    (ActivationEvent::WorkspaceContains(glob), ae) => {
                        ae == &format!("workspaceContains:{}", glob) || ae == "*"
                    }
                    (ActivationEvent::OnStartup, ae) => ae == "*",
                    (ActivationEvent::OnStartupFinished, _) => false,
                    _ => false,
                }
            });
            
            if should_activate {
                drop(extensions);
                self.activate_extension(id).await?;
                activated.push(id.clone());
            }
        }
        
        Ok(activated)
    }
    
    /// Extract VSIX package
    fn extract_vsix(&self, vsix_path: &PathBuf, dest: &PathBuf) -> Result<()> {
        use zip::ZipArchive;
        use std::fs::File;
        
        let file = File::open(vsix_path)?;
        let mut archive = ZipArchive::new(file)?;
        
        // Create destination
        if dest.exists() {
            std::fs::remove_dir_all(dest)?;
        }
        std::fs::create_dir_all(dest)?;
        
        // Extract extension folder from VSIX
        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let path = file.mangled_name();
            
            // VSIX has extension/ prefix for actual files
            if let Ok(relative) = path.strip_prefix("extension/") {
                let out_path = dest.join(relative);
                
                if file.name().ends_with('/') {
                    std::fs::create_dir_all(&out_path)?;
                } else {
                    if let Some(parent) = out_path.parent() {
                        std::fs::create_dir_all(parent)?;
                    }
                    let mut outfile = File::create(&out_path)?;
                    std::io::copy(&mut file, &mut outfile)?;
                }
            }
        }
        
        Ok(())
    }
}

impl Clone for LoadedExtension {
    fn clone(&self) -> Self {
        Self {
            manifest: self.manifest.clone(),
            state: self.state,
            extension_path: self.extension_path.clone(),
            subscriptions: self.subscriptions.clone(),
            activation_events: self.activation_events.clone(),
        }
    }
}

/// VS Code compatible command
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Command {
    pub id: String,
    pub title: String,
    pub category: Option<String>,
    pub icon: Option<String>,
}

/// VS Code compatible language
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageDefinition {
    pub id: String,
    pub extensions: Vec<String>,
    pub aliases: Vec<String>,
    pub filenames: Vec<String>,
    pub first_line: Option<String>,
}
