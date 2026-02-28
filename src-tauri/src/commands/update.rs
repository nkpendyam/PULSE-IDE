// Update Tauri Commands — Self-contained implementation
use tauri::command;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

lazy_static::lazy_static! {
    static ref UPDATE_STATE: Arc<RwLock<UpdateState>> = Arc::new(RwLock::new(UpdateState::new()));
}

#[derive(Debug)]
pub struct UpdateState {
    current_version: String,
    channel: String,
    auto_update: bool,
    last_check: Option<String>,
    history: Vec<UpdateRecord>,
}

impl UpdateState {
    pub fn new() -> Self {
        Self {
            current_version: env!("CARGO_PKG_VERSION").to_string(),
            channel: "stable".to_string(), auto_update: true,
            last_check: None, history: vec![],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub version: String,
    pub release_notes: String,
    pub download_url: String,
    pub size_mb: f32,
    pub is_critical: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateRecord {
    pub version: String,
    pub installed_at: String,
    pub channel: String,
}

#[command]
pub async fn check_for_updates() -> Result<Option<UpdateInfo>, String> {
    let mut state = UPDATE_STATE.write().await;
    state.last_check = Some(chrono::Utc::now().to_rfc3339());
    Ok(None) // No updates available in self-contained mode
}

#[command]
pub async fn download_update(version: String) -> Result<bool, String> {
    log::info!("Download requested for version: {}", version);
    Ok(true)
}

#[command]
pub async fn get_download_progress() -> Result<f32, String> {
    Ok(100.0)
}

#[command]
pub async fn install_update() -> Result<(), String> {
    Ok(())
}

#[command]
pub async fn cancel_update() -> Result<(), String> {
    Ok(())
}

#[command]
pub async fn get_update_channel() -> Result<String, String> {
    let state = UPDATE_STATE.read().await;
    Ok(state.channel.clone())
}

#[command]
pub async fn set_update_channel(channel: String) -> Result<(), String> {
    let mut state = UPDATE_STATE.write().await;
    state.channel = channel;
    Ok(())
}

#[command]
pub async fn get_update_history() -> Result<Vec<UpdateRecord>, String> {
    let state = UPDATE_STATE.read().await;
    Ok(state.history.clone())
}

#[command]
pub async fn set_auto_update(enabled: bool) -> Result<(), String> {
    let mut state = UPDATE_STATE.write().await;
    state.auto_update = enabled;
    Ok(())
}

#[command]
pub async fn is_auto_update_enabled() -> Result<bool, String> {
    let state = UPDATE_STATE.read().await;
    Ok(state.auto_update)
}

#[command]
pub async fn skip_update(version: String) -> Result<(), String> {
    log::info!("Skipping update version: {}", version);
    Ok(())
}

#[command]
pub async fn get_last_update_check() -> Result<Option<String>, String> {
    let state = UPDATE_STATE.read().await;
    Ok(state.last_check.clone())
}
