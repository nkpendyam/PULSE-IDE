//! Plugin System Tauri Commands
//!
//! Exposes WASM plugin functionality to the frontend

use tauri::command;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::plugin_sandbox::{PluginManager, Plugin, PluginCapability, PluginState as PluginRuntimeState};

/// Global plugin state
lazy_static::lazy_static! {
    static ref PLUGIN_STATE: Arc<RwLock<PluginState>> = Arc::new(RwLock::new(PluginState::new()));
}

#[derive(Debug)]
pub struct PluginState {
    manager: PluginManager,
    plugins: Vec<PluginInfo>,
}

impl PluginState {
    pub fn new() -> Self {
        Self {
            manager: PluginManager::new(Default::default()).unwrap(),
            plugins: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub description: Option<String>,
    pub enabled: bool,
    pub state: String, // "installed", "active", "error"
    pub capabilities: Vec<String>,
    pub wasm_path: String,
    pub memory_limit_mb: u32,
    pub installed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallPluginRequest {
    pub wasm_path: String,
    pub config: Option<PluginConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginConfig {
    pub memory_limit_mb: Option<u32>,
    pub capabilities: Option<Vec<String>>,
    pub timeout_ms: Option<u32>,
}

/// List installed plugins
#[command]
pub async fn list_plugins() -> Result<Vec<PluginInfo>, String> {
    let state = PLUGIN_STATE.read().await;
    Ok(state.plugins.clone())
}

/// Install a plugin from WASM file
#[command]
pub async fn install_plugin(request: InstallPluginRequest) -> Result<PluginInfo, String> {
    let mut state = PLUGIN_STATE.write().await;
    
    let config = request.config.unwrap_or_default();
    let memory_limit = config.memory_limit_mb.unwrap_or(64);
    let capabilities = config.capabilities.unwrap_or_default();
    
    // Load plugin
    let plugin_id = uuid::Uuid::new_v4().to_string();
    
    let plugin = PluginInfo {
        id: plugin_id.clone(),
        name: format!("Plugin {}", &plugin_id[..8]),
        version: "1.0.0".to_string(),
        author: "Unknown".to_string(),
        description: None,
        enabled: false,
        state: "installed".to_string(),
        capabilities,
        wasm_path: request.wasm_path,
        memory_limit_mb: memory_limit,
        installed_at: chrono::Utc::now().to_rfc3339(),
    };
    
    state.plugins.push(plugin.clone());
    
    Ok(plugin)
}

/// Uninstall a plugin
#[command]
pub async fn uninstall_plugin(plugin_id: String) -> Result<(), String> {
    let mut state = PLUGIN_STATE.write().await;
    
    // Deactivate first
    state.manager.deactivate_plugin(&plugin_id).await.unwrap_or(());
    
    // Remove from list
    state.plugins.retain(|p| p.id != plugin_id);
    
    Ok(())
}

/// Enable/activate a plugin
#[command]
pub async fn enable_plugin(plugin_id: String) -> Result<PluginInfo, String> {
    let mut state = PLUGIN_STATE.write().await;
    
    let plugin = state.plugins.iter_mut().find(|p| p.id == plugin_id)
        .ok_or("Plugin not found")?;
    
    state.manager.activate_plugin(&plugin_id).await
        .map_err(|e| format!("Failed to activate plugin: {}", e))?;
    
    plugin.enabled = true;
    plugin.state = "active".to_string();
    
    Ok(plugin.clone())
}

/// Disable/deactivate a plugin
#[command]
pub async fn disable_plugin(plugin_id: String) -> Result<PluginInfo, String> {
    let mut state = PLUGIN_STATE.write().await;
    
    let plugin = state.plugins.iter_mut().find(|p| p.id == plugin_id)
        .ok_or("Plugin not found")?;
    
    state.manager.deactivate_plugin(&plugin_id).await
        .map_err(|e| format!("Failed to deactivate plugin: {}", e))?;
    
    plugin.enabled = false;
    plugin.state = "inactive".to_string();
    
    Ok(plugin.clone())
}

/// Execute a plugin function
#[command]
pub async fn execute_plugin_function(
    plugin_id: String,
    function_name: String,
    args: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let state = PLUGIN_STATE.read().await;
    
    let result = state.manager.execute(&plugin_id, &function_name, args).await
        .map_err(|e| format!("Plugin execution failed: {}", e))?;
    
    Ok(result)
}

/// Get plugin capabilities
#[command]
pub async fn get_plugin_capabilities(plugin_id: String) -> Result<Vec<String>, String> {
    let state = PLUGIN_STATE.read().await;
    
    let plugin = state.plugins.iter().find(|p| p.id == plugin_id)
        .ok_or("Plugin not found")?;
    
    Ok(plugin.capabilities.clone())
}

/// Check if plugin has capability
#[command]
pub async fn plugin_has_capability(plugin_id: String, capability: String) -> Result<bool, String> {
    let state = PLUGIN_STATE.read().await;
    
    let plugin = state.plugins.iter().find(|p| p.id == plugin_id)
        .ok_or("Plugin not found")?;
    
    Ok(plugin.capabilities.contains(&capability))
}

/// Get plugin status
#[command]
pub async fn get_plugin_status(plugin_id: String) -> Result<String, String> {
    let state = PLUGIN_STATE.read().await;
    
    let plugin = state.plugins.iter().find(|p| p.id == plugin_id)
        .ok_or("Plugin not found")?;
    
    Ok(plugin.state.clone())
}

/// Reload all plugins
#[command]
pub async fn reload_plugins() -> Result<(), String> {
    let mut state = PLUGIN_STATE.write().await;
    
    for plugin in state.plugins.iter_mut() {
        if plugin.enabled {
            state.manager.deactivate_plugin(&plugin.id).await.unwrap_or(());
            state.manager.activate_plugin(&plugin.id).await.unwrap_or(());
        }
    }
    
    Ok(())
}

/// Get plugin memory usage
#[command]
pub async fn get_plugin_memory_usage(plugin_id: String) -> Result<u64, String> {
    let state = PLUGIN_STATE.read().await;
    
    let memory = state.manager.get_memory_usage(&plugin_id).await
        .map_err(|e| format!("Failed to get memory usage: {}", e))?;
    
    Ok(memory)
}
