//! Auto-Update Tauri Commands
//!
//! Exposes auto-update functionality to the frontend

use tauri::command;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::update::{UpdateManager, UpdateChannel, UpdateInfo as UpdateInfoStruct};

/// Global update state
lazy_static::lazy_static! {
    static ref UPDATE_STATE: Arc<RwLock<UpdateState>> = Arc::new(RwLock::new(UpdateState::new()));
}

#[derive(Debug)]
pub struct UpdateState {
    manager: UpdateManager,
    available_update: Option<UpdateInfo>,
    download_progress: f32,
}

impl UpdateState {
    pub fn new() -> Self {
        Self {
            manager: UpdateManager::new(Default::default()),
            available_update: None,
            download_progress: 0.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub version: String,
    pub current_version: String,
    pub release_date: String,
    pub release_notes: String,
    pub channel: String,
    pub size_mb: f32,
    pub mandatory: bool,
    pub download_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProgress {
    pub downloaded_mb: f32,
    pub total_mb: f32,
    pub percentage: f32,
    pub speed_mbps: f32,
}

/// Check for updates
#[command]
pub async fn check_for_updates() -> Result<Option<UpdateInfo>, String> {
    let mut state = UPDATE_STATE.write().await;
    
    let update = state.manager.check_for_updates().await
        .map_err(|e| format!("Failed to check for updates: {}", e))?;
    
    let info = update.map(|u| UpdateInfo {
        version: u.version,
        current_version: u.current_version,
        release_date: u.release_date.to_rfc3339(),
        release_notes: u.release_notes,
        channel: format!("{:?}", u.channel),
        size_mb: u.size_mb,
        mandatory: u.mandatory,
        download_url: u.download_url,
    });
    
    state.available_update = info.clone();
    
    Ok(info)
}

/// Download update
#[command]
pub async fn download_update() -> Result<(), String> {
    let mut state = UPDATE_STATE.write().await;
    
    let update = state.available_update.as_ref()
        .ok_or("No update available")?;
    
    state.manager.download_update(&update.download_url).await
        .map_err(|e| format!("Failed to download update: {}", e))?;
    
    Ok(())
}

/// Get download progress
#[command]
pub async fn get_download_progress() -> Result<UpdateProgress, String> {
    let state = UPDATE_STATE.read().await;
    
    let progress = state.manager.get_download_progress().await;
    
    Ok(UpdateProgress {
        downloaded_mb: progress.downloaded_mb,
        total_mb: progress.total_mb,
        percentage: progress.percentage,
        speed_mbps: progress.speed_mbps,
    })
}

/// Install update
#[command]
pub async fn install_update() -> Result<(), String> {
    let state = UPDATE_STATE.read().await;
    
    state.manager.install_update().await
        .map_err(|e| format!("Failed to install update: {}", e))?;
    
    Ok(())
}

/// Cancel update download
#[command]
pub async fn cancel_update() -> Result<(), String> {
    let mut state = UPDATE_STATE.write().await;
    
    state.manager.cancel_download().await
        .map_err(|e| format!("Failed to cancel update: {}", e))?;
    
    state.download_progress = 0.0;
    
    Ok(())
}

/// Get current update channel
#[command]
pub async fn get_update_channel() -> Result<String, String> {
    let state = UPDATE_STATE.read().await;
    Ok(format!("{:?}", state.manager.get_channel()))
}

/// Set update channel
#[command]
pub async fn set_update_channel(channel: String) -> Result<(), String> {
    let mut state = UPDATE_STATE.write().await;
    
    let channel = match channel.to_lowercase().as_str() {
        "stable" => UpdateChannel::Stable,
        "beta" => UpdateChannel::Beta,
        "nightly" => UpdateChannel::Nightly,
        "enterprise" => UpdateChannel::Enterprise,
        _ => return Err("Invalid channel".to_string()),
    };
    
    state.manager.set_channel(channel);
    
    Ok(())
}

/// Get update history
#[command]
pub async fn get_update_history() -> Result<Vec<UpdateInfo>, String> {
    let state = UPDATE_STATE.read().await;
    
    let history = state.manager.get_update_history().await
        .map_err(|e| format!("Failed to get history: {}", e))?;
    
    Ok(history.into_iter().map(|u| UpdateInfo {
        version: u.version,
        current_version: u.current_version,
        release_date: u.release_date.to_rfc3339(),
        release_notes: u.release_notes,
        channel: format!("{:?}", u.channel),
        size_mb: u.size_mb,
        mandatory: u.mandatory,
        download_url: u.download_url,
    }).collect())
}

/// Enable/disable automatic updates
#[command]
pub async fn set_auto_update(enabled: bool) -> Result<(), String> {
    let mut state = UPDATE_STATE.write().await;
    state.manager.set_auto_update(enabled);
    Ok(())
}

/// Check if auto-update is enabled
#[command]
pub async fn is_auto_update_enabled() -> Result<bool, String> {
    let state = UPDATE_STATE.read().await;
    Ok(state.manager.is_auto_update_enabled())
}

/// Skip current update
#[command]
pub async fn skip_update() -> Result<(), String> {
    let mut state = UPDATE_STATE.write().await;
    state.available_update = None;
    Ok(())
}

/// Get last update check time
#[command]
pub async fn get_last_update_check() -> Result<String, String> {
    let state = UPDATE_STATE.read().await;
    Ok(state.manager.get_last_check_time().to_rfc3339())
}
