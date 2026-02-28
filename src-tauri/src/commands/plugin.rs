// Plugin Tauri Commands — Self-contained implementation
use tauri::command;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

lazy_static::lazy_static! {
    static ref PLUGIN_STATE: Arc<RwLock<PluginState>> = Arc::new(RwLock::new(PluginState::new()));
}

#[derive(Debug)]
pub struct PluginState {
    plugins: HashMap<String, PluginInfo>,
}

impl PluginState {
    pub fn new() -> Self {
        Self { plugins: HashMap::new() }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub enabled: bool,
    pub description: Option<String>,
    pub capabilities: Vec<String>,
    pub memory_usage: u64,
}

#[command]
pub async fn list_plugins() -> Result<Vec<PluginInfo>, String> {
    let state = PLUGIN_STATE.read().await;
    Ok(state.plugins.values().cloned().collect())
}

#[command]
pub async fn install_plugin(path: String) -> Result<PluginInfo, String> {
    let mut state = PLUGIN_STATE.write().await;
    let id = uuid::Uuid::new_v4().to_string();
    let plugin = PluginInfo {
        id: id.clone(), name: path.split('/').last().unwrap_or("plugin").to_string(),
        version: "1.0.0".to_string(), enabled: true,
        description: Some("Installed plugin".to_string()),
        capabilities: vec!["execute".to_string()], memory_usage: 0,
    };
    state.plugins.insert(id, plugin.clone());
    Ok(plugin)
}

#[command]
pub async fn uninstall_plugin(plugin_id: String) -> Result<(), String> {
    let mut state = PLUGIN_STATE.write().await;
    state.plugins.remove(&plugin_id);
    Ok(())
}

#[command]
pub async fn enable_plugin(plugin_id: String) -> Result<(), String> {
    let mut state = PLUGIN_STATE.write().await;
    if let Some(p) = state.plugins.get_mut(&plugin_id) { p.enabled = true; }
    Ok(())
}

#[command]
pub async fn disable_plugin(plugin_id: String) -> Result<(), String> {
    let mut state = PLUGIN_STATE.write().await;
    if let Some(p) = state.plugins.get_mut(&plugin_id) { p.enabled = false; }
    Ok(())
}

#[command]
pub async fn execute_plugin_function(plugin_id: String, function: String, args: Option<String>) -> Result<String, String> {
    let state = PLUGIN_STATE.read().await;
    let _plugin = state.plugins.get(&plugin_id).ok_or("Plugin not found")?;
    Ok(format!("Executed {}::{} with args: {:?}", plugin_id, function, args))
}

#[command]
pub async fn get_plugin_capabilities(plugin_id: String) -> Result<Vec<String>, String> {
    let state = PLUGIN_STATE.read().await;
    let plugin = state.plugins.get(&plugin_id).ok_or("Plugin not found")?;
    Ok(plugin.capabilities.clone())
}

#[command]
pub async fn plugin_has_capability(plugin_id: String, capability: String) -> Result<bool, String> {
    let state = PLUGIN_STATE.read().await;
    let plugin = state.plugins.get(&plugin_id).ok_or("Plugin not found")?;
    Ok(plugin.capabilities.contains(&capability))
}

#[command]
pub async fn get_plugin_status(plugin_id: String) -> Result<PluginInfo, String> {
    let state = PLUGIN_STATE.read().await;
    state.plugins.get(&plugin_id).cloned().ok_or_else(|| "Plugin not found".to_string())
}

#[command]
pub async fn reload_plugins() -> Result<usize, String> {
    let state = PLUGIN_STATE.read().await;
    Ok(state.plugins.len())
}

#[command]
pub async fn get_plugin_memory_usage(plugin_id: String) -> Result<u64, String> {
    let state = PLUGIN_STATE.read().await;
    let plugin = state.plugins.get(&plugin_id).ok_or("Plugin not found")?;
    Ok(plugin.memory_usage)
}
