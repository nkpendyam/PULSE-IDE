// VS Code Compatibility Tauri Commands — Self-contained implementation
use tauri::command;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

lazy_static::lazy_static! {
    static ref EXTENSION_STATE: Arc<RwLock<ExtensionState>> = Arc::new(RwLock::new(ExtensionState::new()));
}

#[derive(Debug)]
pub struct ExtensionState {
    installed: HashMap<String, ExtensionInfo>,
}

impl ExtensionState {
    pub fn new() -> Self {
        Self { installed: HashMap::new() }
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
    pub state: String,
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

#[command]
pub async fn search_extensions(query: String, page: Option<usize>) -> Result<SearchResult, String> {
    // Search Open VSX in a real implementation
    let client = reqwest::Client::new();
    let page = page.unwrap_or(0);
    let url = format!(
        "https://open-vsx.org/api/-/search?query={}&offset={}&size=20",
        urlencoding::encode(&query), page * 20
    );
    match client.get(&url).send().await {
        Ok(resp) => {
            if let Ok(data) = resp.json::<serde_json::Value>().await {
                let extensions = data["extensions"].as_array()
                    .map(|arr| arr.iter().filter_map(|e| {
                        Some(ExtensionInfo {
                            id: format!("{}.{}", e["namespace"].as_str()?, e["name"].as_str()?),
                            name: e["name"].as_str()?.to_string(),
                            display_name: e["displayName"].as_str().unwrap_or(e["name"].as_str()?).to_string(),
                            version: e["version"].as_str().unwrap_or("0.0.0").to_string(),
                            description: e["description"].as_str().map(|s| s.to_string()),
                            publisher: e["namespace"].as_str()?.to_string(),
                            enabled: false, installed: false, state: "available".to_string(),
                            icon_url: e["files"].get("icon").and_then(|v| v.as_str()).map(|s| s.to_string()),
                            download_count: e["downloadCount"].as_u64(),
                            rating: e["averageRating"].as_f64().map(|f| f as f32),
                        })
                    }).collect::<Vec<_>>())
                    .unwrap_or_default();
                let total = data["totalSize"].as_u64().unwrap_or(0) as usize;
                Ok(SearchResult { extensions, total, page, page_size: 20 })
            } else {
                Ok(SearchResult { extensions: vec![], total: 0, page, page_size: 20 })
            }
        }
        Err(e) => Err(format!("Search failed: {}", e)),
    }
}

#[command]
pub async fn get_extension_details(extension_id: String) -> Result<ExtensionInfo, String> {
    let parts: Vec<&str> = extension_id.split('.').collect();
    if parts.len() != 2 { return Err("Invalid extension ID".to_string()); }
    Ok(ExtensionInfo {
        id: extension_id.clone(), name: parts[1].to_string(),
        display_name: parts[1].to_string(), version: "1.0.0".to_string(),
        description: None, publisher: parts[0].to_string(),
        enabled: false, installed: false, state: "available".to_string(),
        icon_url: None, download_count: None, rating: None,
    })
}

#[command]
pub async fn install_extension(extension_id: String) -> Result<ExtensionInfo, String> {
    let mut state = EXTENSION_STATE.write().await;
    let ext = ExtensionInfo {
        id: extension_id.clone(), name: extension_id.split('.').last().unwrap_or("ext").to_string(),
        display_name: extension_id.split('.').last().unwrap_or("ext").to_string(),
        version: "1.0.0".to_string(), description: None,
        publisher: extension_id.split('.').next().unwrap_or("unknown").to_string(),
        enabled: true, installed: true, state: "installed".to_string(),
        icon_url: None, download_count: None, rating: None,
    };
    state.installed.insert(extension_id, ext.clone());
    Ok(ext)
}

#[command]
pub async fn uninstall_extension(extension_id: String) -> Result<(), String> {
    let mut state = EXTENSION_STATE.write().await;
    state.installed.remove(&extension_id);
    Ok(())
}

#[command]
pub async fn enable_extension(extension_id: String) -> Result<(), String> {
    let mut state = EXTENSION_STATE.write().await;
    if let Some(ext) = state.installed.get_mut(&extension_id) { ext.enabled = true; }
    Ok(())
}

#[command]
pub async fn disable_extension(extension_id: String) -> Result<(), String> {
    let mut state = EXTENSION_STATE.write().await;
    if let Some(ext) = state.installed.get_mut(&extension_id) { ext.enabled = false; }
    Ok(())
}

#[command]
pub async fn list_installed_extensions() -> Result<Vec<ExtensionInfo>, String> {
    let state = EXTENSION_STATE.read().await;
    Ok(state.installed.values().cloned().collect())
}

#[command]
pub async fn get_extension_status(extension_id: String) -> Result<ExtensionInfo, String> {
    let state = EXTENSION_STATE.read().await;
    state.installed.get(&extension_id).cloned().ok_or_else(|| "Extension not found".to_string())
}

#[command]
pub async fn reload_extensions() -> Result<usize, String> {
    let state = EXTENSION_STATE.read().await;
    Ok(state.installed.len())
}

#[command]
pub async fn get_extension_recommendations() -> Result<Vec<ExtensionInfo>, String> {
    Ok(vec![])
}

#[command]
pub async fn get_popular_extensions() -> Result<Vec<ExtensionInfo>, String> {
    search_extensions("popular".to_string(), Some(0)).await.map(|r| r.extensions)
}

#[command]
pub async fn search_extensions_unified(query: String, page: Option<usize>) -> Result<SearchResult, String> {
    search_extensions(query, page).await
}

#[command]
pub async fn install_extension_unified(extension_id: String) -> Result<ExtensionInfo, String> {
    install_extension(extension_id).await
}

#[command]
pub async fn get_openvsx_popular() -> Result<Vec<ExtensionInfo>, String> {
    search_extensions("sort:downloadCount".to_string(), Some(0)).await.map(|r| r.extensions)
}

#[command]
pub async fn get_extension_readme(extension_id: String) -> Result<String, String> {
    Ok(format!("# {}\n\nExtension readme placeholder.", extension_id))
}
