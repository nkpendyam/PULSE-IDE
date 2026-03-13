// VS Code Compatibility Tauri Commands — Self-contained implementation
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::command;
use tokio::sync::RwLock;

lazy_static::lazy_static! {
    static ref EXTENSION_STATE: Arc<RwLock<ExtensionState>> = Arc::new(RwLock::new(ExtensionState::new()));
}

#[derive(Debug)]
pub struct ExtensionState {
    installed: HashMap<String, ExtensionInfo>,
}

impl Default for ExtensionState {
    fn default() -> Self {
        Self::new()
    }
}

impl ExtensionState {
    pub fn new() -> Self {
        Self {
            installed: HashMap::new(),
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionCompatibility {
    pub extension_id: String,
    pub installable: bool,
    pub level: String,
    pub reasons: Vec<String>,
    pub warnings: Vec<String>,
}

fn parse_major_vscode_version(value: &str) -> Option<u32> {
    let cleaned = value
        .trim()
        .trim_start_matches('^')
        .trim_start_matches('~')
        .trim_start_matches('>')
        .trim_start_matches('<')
        .trim_start_matches('=');

    cleaned.split('.').next()?.parse::<u32>().ok()
}

async fn fetch_extension_metadata(extension_id: &str) -> Result<serde_json::Value, String> {
    let parts: Vec<&str> = extension_id.split('.').collect();
    if parts.len() != 2 {
        return Err("Invalid extension ID (expected publisher.name)".to_string());
    }

    let url = format!(
        "https://open-vsx.org/api/{}/{}",
        urlencoding::encode(parts[0]),
        urlencoding::encode(parts[1])
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch extension metadata: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to fetch extension metadata: HTTP {}",
            response.status()
        ));
    }

    response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Failed to parse extension metadata: {}", e))
}

fn evaluate_extension_compatibility(
    extension_id: &str,
    metadata: &serde_json::Value,
) -> ExtensionCompatibility {
    let mut reasons = Vec::new();
    let mut warnings = Vec::new();

    if let Some(vscode_engine) = metadata["engines"]["vscode"].as_str() {
        if let Some(major) = parse_major_vscode_version(vscode_engine) {
            if major >= 2 {
                warnings.push(format!(
                    "Requires VS Code engine '{}'; compatibility may be partial in Kyro.",
                    vscode_engine
                ));
            }
        }
    }

    if metadata["main"].is_string() {
        warnings.push(
            "Declares Node/Electron entrypoint ('main'); this often depends on VS Code host internals."
                .to_string(),
        );
    }

    if metadata["browser"].is_string() {
        warnings.push(
            "Declares browser entrypoint; behavior can differ from desktop host integration."
                .to_string(),
        );
    }

    if let Some(kinds) = metadata["extensionKind"].as_array() {
        let has_workspace = kinds.iter().any(|k| k.as_str() == Some("workspace"));
        if has_workspace {
            warnings.push(
                "Workspace extension kind detected; may require APIs not fully implemented yet."
                    .to_string(),
            );
        }
    }

    if metadata["contributes"]["debuggers"].is_array() {
        warnings.push(
            "Contributes debugger adapters; some DAP workflows may require manual adapter configuration."
                .to_string(),
        );
    }

    let id_lower = extension_id.to_lowercase();
    let blocked_patterns = ["remote-ssh", "remote-containers", "wsl", "docker"];
    if blocked_patterns.iter().any(|pattern| id_lower.contains(pattern)) {
        reasons.push(
            "This extension targets deep remote/container host integrations that are not fully supported yet."
                .to_string(),
        );
    }

    let installable = reasons.is_empty();
    let level = if !installable {
        "incompatible"
    } else if warnings.is_empty() {
        "full"
    } else {
        "partial"
    }
    .to_string();

    ExtensionCompatibility {
        extension_id: extension_id.to_string(),
        installable,
        level,
        reasons,
        warnings,
    }
}

#[command]
pub async fn search_extensions(query: String, page: Option<usize>) -> Result<SearchResult, String> {
    // Search Open VSX in a real implementation
    let client = reqwest::Client::new();
    let page = page.unwrap_or(0);
    let url = format!(
        "https://open-vsx.org/api/-/search?query={}&offset={}&size=20",
        urlencoding::encode(&query),
        page * 20
    );
    match client.get(&url).send().await {
        Ok(resp) => {
            if let Ok(data) = resp.json::<serde_json::Value>().await {
                let extensions = data["extensions"]
                    .as_array()
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|e| {
                                Some(ExtensionInfo {
                                    id: format!(
                                        "{}.{}",
                                        e["namespace"].as_str()?,
                                        e["name"].as_str()?
                                    ),
                                    name: e["name"].as_str()?.to_string(),
                                    display_name: e["displayName"]
                                        .as_str()
                                        .unwrap_or(e["name"].as_str()?)
                                        .to_string(),
                                    version: e["version"].as_str().unwrap_or("0.0.0").to_string(),
                                    description: e["description"].as_str().map(|s| s.to_string()),
                                    publisher: e["namespace"].as_str()?.to_string(),
                                    enabled: false,
                                    installed: false,
                                    state: "available".to_string(),
                                    icon_url: e["files"]
                                        .get("icon")
                                        .and_then(|v| v.as_str())
                                        .map(|s| s.to_string()),
                                    download_count: e["downloadCount"].as_u64(),
                                    rating: e["averageRating"].as_f64().map(|f| f as f32),
                                })
                            })
                            .collect::<Vec<_>>()
                    })
                    .unwrap_or_default();
                let total = data["totalSize"].as_u64().unwrap_or(0) as usize;
                Ok(SearchResult {
                    extensions,
                    total,
                    page,
                    page_size: 20,
                })
            } else {
                Ok(SearchResult {
                    extensions: vec![],
                    total: 0,
                    page,
                    page_size: 20,
                })
            }
        }
        Err(e) => Err(format!("Search failed: {}", e)),
    }
}

#[command]
pub async fn get_extension_details(extension_id: String) -> Result<ExtensionInfo, String> {
    let parts: Vec<&str> = extension_id.split('.').collect();
    if parts.len() != 2 {
        return Err("Invalid extension ID (expected publisher.name)".to_string());
    }
    let (namespace, name) = (parts[0], parts[1]);

    // Fetch real details from Open VSX API
    let client = reqwest::Client::new();
    let url = format!(
        "https://open-vsx.org/api/{}/{}",
        urlencoding::encode(namespace),
        urlencoding::encode(name)
    );

    match client.get(&url).send().await {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(data) = resp.json::<serde_json::Value>().await {
                Ok(ExtensionInfo {
                    id: extension_id.clone(),
                    name: data["name"].as_str().unwrap_or(name).to_string(),
                    display_name: data["displayName"].as_str().unwrap_or(name).to_string(),
                    version: data["version"].as_str().unwrap_or("0.0.0").to_string(),
                    description: data["description"].as_str().map(|s| s.to_string()),
                    publisher: data["namespace"].as_str().unwrap_or(namespace).to_string(),
                    enabled: false,
                    installed: {
                        let state = EXTENSION_STATE.read().await;
                        state.installed.contains_key(&extension_id)
                    },
                    state: "available".to_string(),
                    icon_url: data["files"]
                        .get("icon")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    download_count: data["downloadCount"].as_u64(),
                    rating: data["averageRating"].as_f64().map(|f| f as f32),
                })
            } else {
                Err(format!(
                    "Failed to parse extension details for {}",
                    extension_id
                ))
            }
        }
        Ok(resp) => Err(format!("Extension not found: HTTP {}", resp.status())),
        Err(e) => Err(format!("Failed to fetch extension details: {}", e)),
    }
}

#[command]
pub async fn install_extension(extension_id: String) -> Result<ExtensionInfo, String> {
    // Fetch real extension details from Open VSX before installing
    let details = get_extension_details(extension_id.clone())
        .await
        .unwrap_or_else(|_| {
            let parts: Vec<&str> = extension_id.split('.').collect();
            ExtensionInfo {
                id: extension_id.clone(),
                name: parts.last().unwrap_or(&"ext").to_string(),
                display_name: parts.last().unwrap_or(&"ext").to_string(),
                version: "0.0.0".to_string(),
                description: None,
                publisher: parts.first().unwrap_or(&"unknown").to_string(),
                enabled: true,
                installed: true,
                state: "installed".to_string(),
                icon_url: None,
                download_count: None,
                rating: None,
            }
        });

    let ext = ExtensionInfo {
        enabled: true,
        installed: true,
        state: "installed".to_string(),
        ..details
    };

    let mut state = EXTENSION_STATE.write().await;
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
    if let Some(ext) = state.installed.get_mut(&extension_id) {
        ext.enabled = true;
    }
    Ok(())
}

#[command]
pub async fn disable_extension(extension_id: String) -> Result<(), String> {
    let mut state = EXTENSION_STATE.write().await;
    if let Some(ext) = state.installed.get_mut(&extension_id) {
        ext.enabled = false;
    }
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
    state
        .installed
        .get(&extension_id)
        .cloned()
        .ok_or_else(|| "Extension not found".to_string())
}

#[command]
pub async fn reload_extensions() -> Result<usize, String> {
    let state = EXTENSION_STATE.read().await;
    Ok(state.installed.len())
}

#[command]
pub async fn get_extension_recommendations() -> Result<Vec<ExtensionInfo>, String> {
    // Curated list of popular/useful extensions for IDE users
    let recommended_ids = [
        "rust-lang.rust-analyzer",
        "vadimcn.vscode-lldb",
        "esbenp.prettier-vscode",
        "dbaeumer.vscode-eslint",
        "eamodio.gitlens",
        "ms-python.python",
        "golang.go",
        "bradlc.vscode-tailwindcss",
    ];

    let client = reqwest::Client::new();
    let mut results = Vec::new();

    for ext_id in &recommended_ids {
        let parts: Vec<&str> = ext_id.split('.').collect();
        if parts.len() != 2 {
            continue;
        }
        let url = format!("https://open-vsx.org/api/{}/{}", parts[0], parts[1]);
        if let Ok(resp) = client.get(&url).send().await {
            if let Ok(data) = resp.json::<serde_json::Value>().await {
                if data["name"].is_string() {
                    results.push(ExtensionInfo {
                        id: ext_id.to_string(),
                        name: data["name"].as_str().unwrap_or(parts[1]).to_string(),
                        display_name: data["displayName"].as_str().unwrap_or(parts[1]).to_string(),
                        version: data["version"].as_str().unwrap_or("0.0.0").to_string(),
                        description: data["description"].as_str().map(|s| s.to_string()),
                        publisher: parts[0].to_string(),
                        enabled: false,
                        installed: false,
                        state: "recommended".to_string(),
                        icon_url: data["files"]
                            .get("icon")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string()),
                        download_count: data["downloadCount"].as_u64(),
                        rating: data["averageRating"].as_f64().map(|f| f as f32),
                    });
                }
            }
        }
    }

    Ok(results)
}

#[command]
pub async fn get_popular_extensions() -> Result<Vec<ExtensionInfo>, String> {
    search_extensions("popular".to_string(), Some(0))
        .await
        .map(|r| r.extensions)
}

#[command]
pub async fn search_extensions_unified(
    query: String,
    page: Option<usize>,
) -> Result<SearchResult, String> {
    search_extensions(query, page).await
}

#[command]
pub async fn install_extension_unified(extension_id: String) -> Result<ExtensionInfo, String> {
    let compatibility = get_extension_compatibility(extension_id.clone()).await?;
    if !compatibility.installable {
        return Err(format!(
            "Extension is incompatible with current Kyro capabilities: {}",
            compatibility.reasons.join("; ")
        ));
    }

    install_extension(extension_id).await
}

#[command]
pub async fn get_extension_compatibility(
    extension_id: String,
) -> Result<ExtensionCompatibility, String> {
    let metadata = fetch_extension_metadata(&extension_id).await?;
    Ok(evaluate_extension_compatibility(&extension_id, &metadata))
}

#[command]
pub async fn get_openvsx_popular() -> Result<Vec<ExtensionInfo>, String> {
    search_extensions("sort:downloadCount".to_string(), Some(0))
        .await
        .map(|r| r.extensions)
}

#[command]
pub async fn get_extension_readme(extension_id: String) -> Result<String, String> {
    let parts: Vec<&str> = extension_id.split('.').collect();
    if parts.len() != 2 {
        return Err("Invalid extension ID".to_string());
    }

    // Fetch README from Open VSX API
    let client = reqwest::Client::new();
    let url = format!("https://open-vsx.org/api/{}/{}/readme", parts[0], parts[1]);

    match client.get(&url).send().await {
        Ok(resp) if resp.status().is_success() => resp
            .text()
            .await
            .map_err(|e| format!("Failed to read readme: {}", e)),
        _ => {
            // Fallback: try the main API endpoint which may include readme
            let url2 = format!("https://open-vsx.org/api/{}/{}", parts[0], parts[1]);
            match client.get(&url2).send().await {
                Ok(resp) if resp.status().is_success() => {
                    if let Ok(data) = resp.json::<serde_json::Value>().await {
                        if let Some(readme_url) =
                            data["files"].get("readme").and_then(|v| v.as_str())
                        {
                            match client.get(readme_url).send().await {
                                Ok(r) => r.text().await.map_err(|e| e.to_string()),
                                Err(e) => Err(format!("Failed to fetch readme: {}", e)),
                            }
                        } else {
                            Ok(data["description"]
                                .as_str()
                                .unwrap_or("No README available.")
                                .to_string())
                        }
                    } else {
                        Ok("No README available.".to_string())
                    }
                }
                _ => Ok("No README available.".to_string()),
            }
        }
    }
}
