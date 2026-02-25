//! VS Code Compatibility Tauri Commands
//!
//! Exposes VS Code extension functionality to the frontend

use tauri::command;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::vscode_compat::{ExtensionHost, Extension, ExtensionManifest, MarketplaceClient, ExtensionState};

/// Global extension state
lazy_static::lazy_static! {
    static ref EXTENSION_STATE: Arc<RwLock<ExtensionState>> = Arc::new(RwLock::new(ExtensionState::new()));
}

#[derive(Debug)]
pub struct ExtensionState {
    host: ExtensionHost,
    installed_extensions: Vec<ExtensionInfo>,
    marketplace_client: MarketplaceClient,
}

impl ExtensionState {
    pub fn new() -> Self {
        Self {
            host: ExtensionHost::new(Default::default()).unwrap(),
            installed_extensions: Vec::new(),
            marketplace_client: MarketplaceClient::new("https://open-vsx.org/api"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionInfo {
    pub id: String,
    pub name: String,
    pub display_name: String,
    pub version: String,
    pub description: Option<String>,
    pub publisher: String,
    pub enabled: bool,
    pub installed: bool,
    pub state: String, // "installed", "active", "inactive"
    pub icon_url: Option<String>,
    pub download_count: Option<u64>,
    pub rating: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub extensions: Vec<ExtensionInfo>,
    pub total: usize,
    pub page: usize,
    pub page_size: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallExtensionRequest {
    pub extension_id: String,
    pub version: Option<String>,
}

/// Search for extensions in the marketplace
#[command]
pub async fn search_extensions(query: String, page: Option<usize>) -> Result<SearchResult, String> {
    let state = EXTENSION_STATE.read().await;
    
    let results = state.marketplace_client.search(&query, crate::vscode_compat::SearchOptions {
        page: page.unwrap_or(1),
        page_size: 20,
        ..Default::default()
    }).await
        .map_err(|e| format!("Search failed: {}", e))?;
    
    let extensions: Vec<ExtensionInfo> = results.items.into_iter().map(|ext| ExtensionInfo {
        id: ext.id,
        name: ext.name.clone(),
        display_name: ext.display_name.unwrap_or(ext.name),
        version: ext.version,
        description: ext.description,
        publisher: ext.namespace,
        enabled: false,
        installed: false,
        state: "available".to_string(),
        icon_url: ext.icon_url,
        download_count: ext.download_count,
        rating: ext.average_rating,
    }).collect();
    
    Ok(SearchResult {
        total: results.total,
        page: page.unwrap_or(1),
        page_size: 20,
        extensions,
    })
}

/// Get extension details
#[command]
pub async fn get_extension_details(namespace: String, name: String) -> Result<ExtensionInfo, String> {
    let state = EXTENSION_STATE.read().await;
    
    let ext = state.marketplace_client.get_extension(&namespace, &name).await
        .map_err(|e| format!("Failed to get extension: {}", e))?;
    
    Ok(ExtensionInfo {
        id: ext.id,
        name: ext.name.clone(),
        display_name: ext.display_name.unwrap_or(ext.name),
        version: ext.version,
        description: ext.description,
        publisher: ext.namespace,
        enabled: false,
        installed: false,
        state: "available".to_string(),
        icon_url: ext.icon_url,
        download_count: ext.download_count,
        rating: ext.average_rating,
    })
}

/// Install an extension
#[command]
pub async fn install_extension(request: InstallExtensionRequest) -> Result<ExtensionInfo, String> {
    let mut state = EXTENSION_STATE.write().await;
    
    // Parse extension ID (namespace.name)
    let parts: Vec<&str> = request.extension_id.split('.').collect();
    if parts.len() != 2 {
        return Err("Invalid extension ID format. Expected: namespace.name".to_string());
    }
    
    let namespace = parts[0];
    let name = parts[1];
    
    // Get extension details
    let ext = state.marketplace_client.get_extension(namespace, name).await
        .map_err(|e| format!("Failed to get extension: {}", e))?;
    
    // Download and install
    state.marketplace_client.install_extension(namespace, name, request.version.as_deref()).await
        .map_err(|e| format!("Installation failed: {}", e))?;
    
    let info = ExtensionInfo {
        id: ext.id.clone(),
        name: ext.name.clone(),
        display_name: ext.display_name.unwrap_or(ext.name),
        version: ext.version.clone(),
        description: ext.description.clone(),
        publisher: ext.namespace.clone(),
        enabled: false,
        installed: true,
        state: "installed".to_string(),
        icon_url: ext.icon_url.clone(),
        download_count: ext.download_count,
        rating: ext.average_rating,
    };
    
    // Add to installed list
    state.installed_extensions.push(info.clone());
    
    Ok(info)
}

/// Uninstall an extension
#[command]
pub async fn uninstall_extension(extension_id: String) -> Result<(), String> {
    let mut state = EXTENSION_STATE.write().await;
    
    // Deactivate if active
    state.host.deactivate_extension(&extension_id).await
        .unwrap_or(());
    
    // Uninstall
    state.host.uninstall_extension(&extension_id).await
        .map_err(|e| format!("Uninstall failed: {}", e))?;
    
    // Remove from installed list
    state.installed_extensions.retain(|e| e.id != extension_id);
    
    Ok(())
}

/// Enable an extension
#[command]
pub async fn enable_extension(extension_id: String) -> Result<ExtensionInfo, String> {
    let mut state = EXTENSION_STATE.write().await;
    
    state.host.activate_extension(&extension_id).await
        .map_err(|e| format!("Failed to enable extension: {}", e))?;
    
    // Update state
    if let Some(ext) = state.installed_extensions.iter_mut().find(|e| e.id == extension_id) {
        ext.enabled = true;
        ext.state = "active".to_string();
        return Ok(ext.clone());
    }
    
    Err("Extension not found".to_string())
}

/// Disable an extension
#[command]
pub async fn disable_extension(extension_id: String) -> Result<ExtensionInfo, String> {
    let mut state = EXTENSION_STATE.write().await;
    
    state.host.deactivate_extension(&extension_id).await
        .map_err(|e| format!("Failed to disable extension: {}", e))?;
    
    // Update state
    if let Some(ext) = state.installed_extensions.iter_mut().find(|e| e.id == extension_id) {
        ext.enabled = false;
        ext.state = "inactive".to_string();
        return Ok(ext.clone());
    }
    
    Err("Extension not found".to_string())
}

/// List installed extensions
#[command]
pub async fn list_installed_extensions() -> Result<Vec<ExtensionInfo>, String> {
    let state = EXTENSION_STATE.read().await;
    Ok(state.installed_extensions.clone())
}

/// Get extension status
#[command]
pub async fn get_extension_status(extension_id: String) -> Result<String, String> {
    let state = EXTENSION_STATE.read().await;
    
    let ext = state.installed_extensions.iter().find(|e| e.id == extension_id)
        .ok_or("Extension not found")?;
    
    Ok(ext.state.clone())
}

/// Reload extensions
#[command]
pub async fn reload_extensions() -> Result<(), String> {
    let mut state = EXTENSION_STATE.write().await;
    
    // Deactivate all
    for ext in state.installed_extensions.iter() {
        if ext.enabled {
            state.host.deactivate_extension(&ext.id).await.unwrap_or(());
        }
    }
    
    // Reactivate enabled ones
    for ext in state.installed_extensions.iter_mut() {
        if ext.enabled {
            if state.host.activate_extension(&ext.id).await.is_ok() {
                ext.state = "active".to_string();
            }
        }
    }
    
    Ok(())
}

/// Get extension recommendations
#[command]
pub async fn get_extension_recommendations(language: Option<String>) -> Result<Vec<ExtensionInfo>, String> {
    let state = EXTENSION_STATE.read().await;
    
    // Search for popular extensions based on language
    let query = language.map(|l| format!("{} language", l)).unwrap_or_else(|| "popular".to_string());
    
    let results = state.marketplace_client.search(&query, crate::vscode_compat::SearchOptions {
        page: 1,
        page_size: 10,
        sort_by: "downloads".to_string(),
    }).await
        .map_err(|e| format!("Search failed: {}", e))?;
    
    Ok(results.items.into_iter().map(|ext| ExtensionInfo {
        id: ext.id,
        name: ext.name.clone(),
        display_name: ext.display_name.unwrap_or(ext.name),
        version: ext.version,
        description: ext.description,
        publisher: ext.namespace,
        enabled: false,
        installed: false,
        state: "recommended".to_string(),
        icon_url: ext.icon_url,
        download_count: ext.download_count,
        rating: ext.average_rating,
    }).collect())
}

/// Get popular extensions
#[command]
pub async fn get_popular_extensions() -> Result<Vec<ExtensionInfo>, String> {
    let state = EXTENSION_STATE.read().await;
    
    let results = state.marketplace_client.search("", crate::vscode_compat::SearchOptions {
        page: 1,
        page_size: 20,
        sort_by: "downloads".to_string(),
    }).await
        .map_err(|e| format!("Search failed: {}", e))?;
    
    Ok(results.items.into_iter().map(|ext| ExtensionInfo {
        id: ext.id,
        name: ext.name.clone(),
        display_name: ext.display_name.unwrap_or(ext.name),
        version: ext.version,
        description: ext.description,
        publisher: ext.namespace,
        enabled: false,
        installed: false,
        state: "popular".to_string(),
        icon_url: ext.icon_url,
        download_count: ext.download_count,
        rating: ext.average_rating,
    }).collect())
}
