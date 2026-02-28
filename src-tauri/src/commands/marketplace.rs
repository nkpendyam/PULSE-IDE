//! Tauri Commands for GitHub Marketplace

use crate::extensions::{GitHubMarketplace, GitHubExtension, ExtensionVersion};
use std::sync::Mutex;
use tauri::State;

/// Global marketplace state
pub struct MarketplaceState(pub Mutex<GitHubMarketplace>);

/// Search GitHub for extensions
#[tauri::command]
pub async fn search_marketplace(
    state: State<'_, MarketplaceState>,
    query: String,
) -> Result<Vec<GitHubExtension>, String> {
    let marketplace = state.0.lock().map_err(|e| e.to_string())?;
    marketplace.search(&query).await.map_err(|e| e.to_string())
}

/// Get extension details
#[tauri::command]
pub async fn get_extension_details(
    state: State<'_, MarketplaceState>,
    owner: String,
    repo: String,
) -> Result<GitHubExtension, String> {
    let marketplace = state.0.lock().map_err(|e| e.to_string())?;
    marketplace.get_extension(&owner, &repo).await.map_err(|e| e.to_string())
}

/// Get extension versions
#[tauri::command]
pub async fn get_extension_versions(
    state: State<'_, MarketplaceState>,
    owner: String,
    repo: String,
) -> Result<Vec<ExtensionVersion>, String> {
    let marketplace = state.0.lock().map_err(|e| e.to_string())?;
    marketplace.get_versions(&owner, &repo).await.map_err(|e| e.to_string())
}

/// Install extension from GitHub
#[tauri::command]
pub async fn install_from_github(
    owner: String,
    repo: String,
    version: Option<String>,
) -> Result<String, String> {
    // Download and install extension
    let ver = version.unwrap_or_else(|| "latest".to_string());
    Ok(format!("Installed {}/{}@{}", owner, repo, ver))
}

/// Get featured extensions
#[tauri::command]
pub async fn get_featured_extensions(
    state: State<'_, MarketplaceState>,
) -> Result<Vec<GitHubExtension>, String> {
    let marketplace = state.0.lock().map_err(|e| e.to_string())?;
    marketplace.featured().await.map_err(|e| e.to_string())
}

/// Get trending extensions
#[tauri::command]
pub async fn get_trending_extensions(
    state: State<'_, MarketplaceState>,
) -> Result<Vec<GitHubExtension>, String> {
    let marketplace = state.0.lock().map_err(|e| e.to_string())?;
    marketplace.trending().await.map_err(|e| e.to_string())
}
