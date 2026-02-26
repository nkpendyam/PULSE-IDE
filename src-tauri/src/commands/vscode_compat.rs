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
            host: ExtensionHost::new(Default::default())
                .unwrap_or_else(|e| {
                    log::warn!("Failed to initialize extension host: {}, using empty host", e);
                    ExtensionHost::default()
                }),
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

// ============ Unified Marketplace Commands ============

/// Search extensions from both VS Code Marketplace and Open VSX
#[command]
pub async fn search_extensions_unified(
    query: String,
    category: Option<String>,
    source: Option<String>,
    sort_by: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<ExtensionInfo>, String> {
    let limit = limit.unwrap_or(50) as usize;
    let mut all_extensions = Vec::new();
    
    // Search VS Code Marketplace
    if source.as_deref() == Some("vscode") || source.as_deref() == Some("all") || source.is_none() {
        let vscode_client = crate::vscode_compat::MarketplaceClient::new();
        let vscode_query = crate::vscode_compat::ExtensionQuery {
            search_text: Some(query.clone()),
            category: category.clone(),
            ..Default::default()
        };
        
        if let Ok(results) = vscode_client.search(&vscode_query).await {
            for ext in results {
                all_extensions.push(ExtensionInfo {
                    id: format!("{}.{}", ext.publisher_name, ext.extension_name),
                    name: ext.extension_name,
                    display_name: ext.display_name,
                    version: ext.version,
                    description: Some(ext.short_description),
                    publisher: ext.publisher_name,
                    enabled: false,
                    installed: false,
                    state: "available".to_string(),
                    icon_url: ext.icon_url,
                    download_count: Some(ext.download_count),
                    rating: ext.average_rating,
                });
            }
        }
    }
    
    // Search Open VSX
    if source.as_deref() == Some("openvsx") || source.as_deref() == Some("all") || source.is_none() {
        let openvsx_client = crate::vscode_compat::OpenVsxClient::new();
        let openvsx_query = crate::vscode_compat::OpenVsxQuery {
            search_text: Some(query),
            category: category,
            size: (limit / 2) as u32,
            ..Default::default()
        };
        
        if let Ok(results) = openvsx_client.search(&openvsx_query).await {
            for ext in results {
                all_extensions.push(ExtensionInfo {
                    id: format!("{}.{}", ext.namespace, ext.name),
                    name: ext.name,
                    display_name: ext.display_name.unwrap_or_else(|| ext.name.clone()),
                    version: ext.version,
                    description: ext.description,
                    publisher: ext.namespace,
                    enabled: false,
                    installed: false,
                    state: "available".to_string(),
                    icon_url: ext.files.icon,
                    download_count: Some(ext.download_count),
                    rating: ext.average_rating,
                });
            }
        }
    }
    
    // Sort by downloads
    all_extensions.sort_by(|a, b| {
        b.download_count.unwrap_or(0).cmp(&a.download_count.unwrap_or(0))
    });
    
    // Limit results
    all_extensions.truncate(limit);
    
    Ok(all_extensions)
}

/// Install extension from unified marketplace
#[command]
pub async fn install_extension_unified(
    publisher: String,
    name: String,
    version: String,
    source: String,
) -> Result<ExtensionInfo, String> {
    let mut state = EXTENSION_STATE.write().await;
    
    let ext_id = format!("{}.{}", publisher, name);
    
    if source == "openvsx" {
        let openvsx_client = crate::vscode_compat::OpenVsxClient::new();
        
        // Download extension
        let vsix_path = openvsx_client.download_extension(&publisher, &name, &version).await
            .map_err(|e| format!("Download failed: {}", e))?;
        
        // Extract and install
        let extensions_dir = dirs::data_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join("kyro-ide")
            .join("extensions");
        
        let ext_dir = extensions_dir.join(&ext_id);
        std::fs::create_dir_all(&ext_dir).map_err(|e| e.to_string())?;
        
        // Extract VSIX
        extract_vsix(&vsix_path, &ext_dir)?;
        
        let info = ExtensionInfo {
            id: ext_id.clone(),
            name: name.clone(),
            display_name: name.clone(),
            version,
            description: None,
            publisher: publisher.clone(),
            enabled: false,
            installed: true,
            state: "installed".to_string(),
            icon_url: None,
            download_count: None,
            rating: None,
        };
        
        state.installed_extensions.push(info.clone());
        
        return Ok(info);
    }
    
    // VS Code Marketplace
    let ext = state.marketplace_client.get_extension(&publisher, &name).await
        .map_err(|e| format!("Failed to get extension: {}", e))?;
    
    state.marketplace_client.install_extension(&publisher, &name, Some(&version)).await
        .map_err(|e| format!("Installation failed: {}", e))?;
    
    let info = ExtensionInfo {
        id: ext_id.clone(),
        name: name.clone(),
        display_name: ext.display_name.unwrap_or(name),
        version: ext.version.clone(),
        description: ext.description.clone(),
        publisher: publisher.clone(),
        enabled: false,
        installed: true,
        state: "installed".to_string(),
        icon_url: ext.icon_url.clone(),
        download_count: Some(ext.download_count),
        rating: ext.average_rating,
    };
    
    state.installed_extensions.push(info.clone());
    
    Ok(info)
}

/// Get popular extensions from Open VSX
#[command]
pub async fn get_openvsx_popular(count: Option<u32>) -> Result<Vec<ExtensionInfo>, String> {
    let openvsx_client = crate::vscode_compat::OpenVsxClient::new();
    let count = count.unwrap_or(25);
    
    let results = openvsx_client.get_popular(count).await
        .map_err(|e| format!("Failed to get popular extensions: {}", e))?;
    
    Ok(results.into_iter().map(|ext| ExtensionInfo {
        id: format!("{}.{}", ext.namespace, ext.name),
        name: ext.name,
        display_name: ext.display_name.unwrap_or_else(|| ext.name.clone()),
        version: ext.version,
        description: ext.description,
        publisher: ext.namespace,
        enabled: false,
        installed: false,
        state: "popular".to_string(),
        icon_url: ext.files.icon,
        download_count: Some(ext.download_count),
        rating: ext.average_rating,
    }).collect())
}

/// Get extension readme
#[command]
pub async fn get_extension_readme(
    publisher: String,
    name: String,
    source: String,
) -> Result<String, String> {
    if source == "openvsx" {
        let openvsx_client = crate::vscode_compat::OpenVsxClient::new();
        
        if let Some(ext) = openvsx_client.get_extension(&publisher, &name).await.map_err(|e| e.to_string())? {
            if let Some(url) = ext.files.readme {
                let response = reqwest::get(&url).await.map_err(|e| e.to_string())?;
                return response.text().await.map_err(|e| e.to_string());
            }
        }
    }
    
    // VS Code Marketplace
    let marketplace_client = crate::vscode_compat::MarketplaceClient::new();
    let readme = marketplace_client.get_readme(&publisher, &name, "latest").await
        .map_err(|e| e.to_string())?;
    
    Ok(readme)
}

/// Extract VSIX file to directory
fn extract_vsix(vsix_path: &std::path::Path, dest: &std::path::Path) -> Result<(), String> {
    use std::fs::File;
    use std::io::Read;
    use zip::ZipArchive;
    
    let file = File::open(vsix_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
    
    std::fs::create_dir_all(dest).map_err(|e| e.to_string())?;
    
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let path = file.mangled_name();
        
        // VSIX files have extension/ prefix
        if let Ok(relative) = path.strip_prefix("extension/") {
            let out_path = dest.join(relative);
            
            if file.name().ends_with('/') {
                std::fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
            } else {
                if let Some(parent) = out_path.parent() {
                    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
                let mut outfile = File::create(&out_path).map_err(|e| e.to_string())?;
                std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
            }
        }
    }
    
    Ok(())
}
