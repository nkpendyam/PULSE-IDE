//! Tauri Commands for Extension System
//!
//! Exposes extension management to the frontend

use crate::extensions::{ExtensionManager, ExtensionMetadata, InstalledExtension};
use std::sync::Mutex;
use tauri::State;

/// Global extension manager state
pub struct ExtensionState(pub Mutex<ExtensionManager>);

/// Search for extensions
#[tauri::command]
pub async fn search_extensions(
    state: State<'_, ExtensionState>,
    query: String,
) -> Result<Vec<ExtensionMetadata>, String> {
    let manager = state.0.lock().map_err(|e| e.to_string())?;
    manager.search(&query).await.map_err(|e| e.to_string())
}

/// Install extension
#[tauri::command]
pub async fn install_extension(
    state: State<'_, ExtensionState>,
    extension_id: String,
) -> Result<String, String> {
    let mut manager = state.0.lock().map_err(|e| e.to_string())?;
    manager.install(&extension_id).await.map_err(|e| e.to_string())
}

/// Uninstall extension
#[tauri::command]
pub fn uninstall_extension(
    state: State<'_, ExtensionState>,
    extension_id: String,
) -> Result<bool, String> {
    let mut manager = state.0.lock().map_err(|e| e.to_string())?;
    Ok(manager.uninstall(&extension_id))
}

/// List installed extensions
#[tauri::command]
pub fn list_extensions(
    state: State<'_, ExtensionState>,
) -> Result<Vec<InstalledExtension>, String> {
    let manager = state.0.lock().map_err(|e| e.to_string())?;
    Ok(manager.list_installed().into_iter().cloned().collect())
}

/// Enable/disable extension
#[tauri::command]
pub fn toggle_extension(
    state: State<'_, ExtensionState>,
    extension_id: String,
    enabled: bool,
) -> Result<bool, String> {
    let mut manager = state.0.lock().map_err(|e| e.to_string())?;
    Ok(manager.set_enabled(&extension_id, enabled))
}
