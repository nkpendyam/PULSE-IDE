//! Plugin Sandbox for KRO_IDE
//!
//! WASM-based plugin system with capability-based security

pub mod capabilities;
pub mod runtime;
pub mod api;

pub use capabilities::{Capability, CapabilitySet};
pub use runtime::WasmRuntime;
pub use api::PluginApi;
pub use crate::plugin_sandbox::runtime::PluginContext;

use serde::{Deserialize, Serialize};
use anyhow::{Result, Context};
use std::path::PathBuf;
use std::collections::HashMap;

/// Plugin metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMetadata {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub repository: Option<String>,
    pub license: String,
    pub min_kro_version: String,
    pub capabilities: Vec<String>,
    pub permissions: Vec<String>,
    pub main: String, // WASM entry point
    pub icon: Option<String>,
    pub keywords: Vec<String>,
}

/// Plugin state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PluginState {
    /// Plugin is loaded but not active
    Loaded,
    /// Plugin is active and running
    Active,
    /// Plugin is disabled
    Disabled,
    /// Plugin has errors
    Error,
}

/// Plugin instance
pub struct Plugin {
    pub metadata: PluginMetadata,
    pub state: PluginState,
    pub capabilities: CapabilitySet,
    runtime: Option<WasmRuntime>,
    error: Option<String>,
}

impl Plugin {
    /// Create a new plugin from metadata
    pub fn new(metadata: PluginMetadata) -> Self {
        let capabilities = CapabilitySet::from_iter(
            metadata.capabilities.iter().map(|s| s.as_str())
        );
        
        Self {
            metadata,
            state: PluginState::Loaded,
            capabilities,
            runtime: None,
            error: None,
        }
    }
    
    /// Load plugin from directory
    pub fn load_from_dir(dir: &PathBuf) -> Result<Self> {
        let manifest_path = dir.join("plugin.json");
        let wasm_path = dir.join("plugin.wasm");
        
        if !manifest_path.exists() {
            anyhow::bail!("Plugin manifest not found: {:?}", manifest_path);
        }
        
        if !wasm_path.exists() {
            anyhow::bail!("Plugin WASM not found: {:?}", wasm_path);
        }
        
        let manifest_content = std::fs::read_to_string(&manifest_path)?;
        let metadata: PluginMetadata = serde_json::from_str(&manifest_content)?;
        
        let mut plugin = Self::new(metadata);
        
        // Initialize WASM runtime
        let runtime = WasmRuntime::new(&wasm_path)?;
        plugin.runtime = Some(runtime);
        
        Ok(plugin)
    }
    
    /// Activate the plugin
    pub fn activate(&mut self, context: &PluginContext) -> Result<()> {
        if self.state == PluginState::Active {
            return Ok(());
        }
        
        if let Some(ref mut runtime) = self.runtime {
            runtime.activate(context)?;
            self.state = PluginState::Active;
            log::info!("Plugin {} activated", self.metadata.name);
        } else {
            anyhow::bail!("Plugin runtime not initialized");
        }
        
        Ok(())
    }
    
    /// Deactivate the plugin
    pub fn deactivate(&mut self) -> Result<()> {
        if self.state != PluginState::Active {
            return Ok(());
        }
        
        if let Some(ref mut runtime) = self.runtime {
            runtime.deactivate()?;
        }
        
        self.state = PluginState::Loaded;
        log::info!("Plugin {} deactivated", self.metadata.name);
        Ok(())
    }
    
    /// Execute a plugin command
    pub fn execute(&mut self, command: &str, args: &serde_json::Value) -> Result<serde_json::Value> {
        if self.state != PluginState::Active {
            anyhow::bail!("Plugin is not active");
        }
        
        if let Some(ref mut runtime) = self.runtime {
            runtime.execute(command, args)
        } else {
            anyhow::bail!("Plugin runtime not initialized");
        }
    }
    
    /// Check if plugin has a capability
    pub fn has_capability(&self, capability: &str) -> bool {
        self.capabilities.has(capability)
    }
    
    /// Get plugin state
    pub fn state(&self) -> PluginState {
        self.state
    }
    
    /// Get error message
    pub fn error(&self) -> Option<&str> {
        self.error.as_deref()
    }
}

/// Plugin manager
pub struct PluginManager {
    plugins_dir: PathBuf,
    plugins: HashMap<String, Plugin>,
    capability_grants: HashMap<String, CapabilitySet>,
}

impl PluginManager {
    pub fn new(plugins_dir: PathBuf) -> Self {
        Self {
            plugins_dir,
            plugins: HashMap::new(),
            capability_grants: HashMap::new(),
        }
    }
    
    /// Scan for plugins
    pub fn scan_plugins(&mut self) -> Result<Vec<String>> {
        let mut found = Vec::new();
        
        if !self.plugins_dir.exists() {
            std::fs::create_dir_all(&self.plugins_dir)?;
            return Ok(found);
        }
        
        for entry in std::fs::read_dir(&self.plugins_dir)? {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_dir() {
                if let Ok(plugin) = Plugin::load_from_dir(&path) {
                    let id = plugin.metadata.id.clone();
                    found.push(id.clone());
                    self.plugins.insert(id, plugin);
                }
            }
        }
        
        log::info!("Found {} plugins", found.len());
        Ok(found)
    }
    
    /// Install a plugin from archive
    pub async fn install_plugin(&mut self, archive_path: &PathBuf) -> Result<String> {
        // Extract archive
        let extract_dir = tempfile::tempdir()?;
        let extract_path = extract_dir.path().to_path_buf();
        
        // Extract based on extension
        let ext = archive_path.extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");
        
        match ext {
            "zip" => {
                let file = std::fs::File::open(archive_path)?;
                let mut archive = zip::ZipArchive::new(file)?;
                archive.extract(&extract_path)?;
            }
            "gz" | "tgz" => {
                use flate2::read::GzDecoder;
                let file = std::fs::File::open(archive_path)?;
                let decoder = GzDecoder::new(file);
                let mut archive = tar::Archive::new(decoder);
                archive.unpack(&extract_path)?;
            }
            _ => anyhow::bail!("Unsupported archive format: {}", ext),
        }
        
        // Load and validate plugin
        let plugin = Plugin::load_from_dir(&extract_path)?;
        let id = plugin.metadata.id.clone();
        let name = plugin.metadata.name.clone();
        
        // Copy to plugins directory
        let dest_dir = self.plugins_dir.join(&id);
        if dest_dir.exists() {
            std::fs::remove_dir_all(&dest_dir)?;
        }
        std::fs::rename(&extract_path, &dest_dir)?;
        
        // Reload from new location
        let plugin = Plugin::load_from_dir(&dest_dir)?;
        self.plugins.insert(id.clone(), plugin);
        
        log::info!("Installed plugin: {} ({})", name, id);
        Ok(id)
    }
    
    /// Uninstall a plugin
    pub fn uninstall_plugin(&mut self, id: &str) -> Result<()> {
        if let Some(mut plugin) = self.plugins.remove(id) {
            plugin.deactivate()?;
            
            let plugin_dir = self.plugins_dir.join(id);
            if plugin_dir.exists() {
                std::fs::remove_dir_all(&plugin_dir)?;
            }
            
            self.capability_grants.remove(id);
            log::info!("Uninstalled plugin: {}", id);
        }
        
        Ok(())
    }
    
    /// Activate a plugin
    pub fn activate_plugin(&mut self, id: &str, context: &PluginContext) -> Result<()> {
        let plugin = self.plugins.get_mut(id)
            .ok_or_else(|| anyhow::anyhow!("Plugin not found: {}", id))?;
        
        plugin.activate(context)
    }
    
    /// Deactivate a plugin
    pub fn deactivate_plugin(&mut self, id: &str) -> Result<()> {
        let plugin = self.plugins.get_mut(id)
            .ok_or_else(|| anyhow::anyhow!("Plugin not found: {}", id))?;
        
        plugin.deactivate()
    }
    
    /// Execute plugin command
    pub fn execute(
        &mut self, 
        plugin_id: &str, 
        command: &str, 
        args: &serde_json::Value
    ) -> Result<serde_json::Value> {
        let plugin = self.plugins.get_mut(plugin_id)
            .ok_or_else(|| anyhow::anyhow!("Plugin not found: {}", plugin_id))?;
        
        // Check capability
        self.check_capability(plugin_id, command)?;
        
        plugin.execute(command, args)
    }
    
    /// Grant capabilities to a plugin
    pub fn grant_capabilities(&mut self, plugin_id: &str, capabilities: &[&str]) {
        let cap_set = CapabilitySet::from_iter(capabilities);
        self.capability_grants.insert(plugin_id.to_string(), cap_set);
    }
    
    /// Revoke capabilities from a plugin
    pub fn revoke_capabilities(&mut self, plugin_id: &str) {
        self.capability_grants.remove(plugin_id);
    }
    
    /// Check if plugin has granted capability
    fn check_capability(&self, plugin_id: &str, capability: &str) -> Result<()> {
        let granted = self.capability_grants.get(plugin_id);
        let plugin = self.plugins.get(plugin_id);
        
        match (granted, plugin) {
            (Some(grants), Some(plugin)) => {
                if !grants.has(capability) && !plugin.has_capability(capability) {
                    anyhow::bail!("Plugin {} does not have capability: {}", plugin_id, capability);
                }
                Ok(())
            }
            _ => anyhow::bail!("Plugin not found or no capabilities granted"),
        }
    }
    
    /// List plugins
    pub fn list_plugins(&self) -> Vec<&Plugin> {
        self.plugins.values().collect()
    }
    
    /// Get plugin by ID
    pub fn get_plugin(&self, id: &str) -> Option<&Plugin> {
        self.plugins.get(id)
    }
    
    /// Get plugin count
    pub fn len(&self) -> usize {
        self.plugins.len()
    }
    
    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.plugins.is_empty()
    }
}

use flate2::read::GzDecoder;

