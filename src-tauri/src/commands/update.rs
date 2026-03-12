// Update Tauri Commands — Real update checking via GitHub Releases API
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::command;
use tokio::sync::RwLock;

lazy_static::lazy_static! {
    static ref UPDATE_STATE: Arc<RwLock<UpdateState>> = Arc::new(RwLock::new(UpdateState::new()));
}

const GITHUB_REPO: &str = "nkpendyam/Kyro_IDE";

#[derive(Debug)]
pub struct UpdateState {
    current_version: String,
    channel: String,
    auto_update: bool,
    last_check: Option<String>,
    history: Vec<UpdateRecord>,
    skipped_versions: Vec<String>,
    download_progress: f32,
}

impl Default for UpdateState {
    fn default() -> Self {
        Self::new()
    }
}

impl UpdateState {
    pub fn new() -> Self {
        Self {
            current_version: env!("CARGO_PKG_VERSION").to_string(),
            channel: "stable".to_string(),
            auto_update: true,
            last_check: None,
            history: vec![],
            skipped_versions: vec![],
            download_progress: 0.0,
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

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    name: Option<String>,
    body: Option<String>,
    prerelease: bool,
    assets: Vec<GitHubAsset>,
}

#[derive(Debug, Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
    size: u64,
}

fn version_newer(v1: &str, v2: &str) -> bool {
    let parse = |v: &str| -> Vec<u64> {
        v.trim_start_matches('v')
            .split('.')
            .filter_map(|s| s.parse().ok())
            .collect()
    };
    let a = parse(v1);
    let b = parse(v2);
    a > b
}

#[command]
pub async fn check_for_updates() -> Result<Option<UpdateInfo>, String> {
    let mut state = UPDATE_STATE.write().await;
    state.last_check = Some(chrono::Utc::now().to_rfc3339());

    let url = format!("https://api.github.com/repos/{}/releases", GITHUB_REPO);
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("User-Agent", "Kyro-IDE-Updater")
        .header("Accept", "application/vnd.github.v3+json")
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        return Ok(None);
    }

    let releases: Vec<GitHubRelease> = resp
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    // Filter by channel
    let candidate = releases.iter().find(|r| {
        let is_prerelease = r.prerelease;
        let matches_channel = match state.channel.as_str() {
            "stable" => !is_prerelease,
            "beta" => true,
            "nightly" => true,
            _ => !is_prerelease,
        };
        matches_channel
            && version_newer(&r.tag_name, &state.current_version)
            && !state.skipped_versions.contains(&r.tag_name)
    });

    match candidate {
        Some(release) => {
            let platform_asset = release.assets.iter().find(|a| {
                let name = a.name.to_lowercase();
                if cfg!(target_os = "windows") {
                    name.contains("windows") || name.ends_with(".msi") || name.ends_with(".exe")
                } else if cfg!(target_os = "macos") {
                    name.contains("macos") || name.ends_with(".dmg")
                } else {
                    name.contains("linux") || name.ends_with(".appimage") || name.ends_with(".deb")
                }
            });
            let (url, size) = platform_asset
                .map(|a| (a.browser_download_url.clone(), a.size as f32 / 1_048_576.0))
                .unwrap_or_else(|| (String::new(), 0.0));

            Ok(Some(UpdateInfo {
                version: release.tag_name.clone(),
                release_notes: release.body.clone().unwrap_or_default(),
                download_url: url,
                size_mb: size,
                is_critical: release
                    .body
                    .as_ref()
                    .map(|b| {
                        b.to_lowercase().contains("critical")
                            || b.to_lowercase().contains("security")
                    })
                    .unwrap_or(false),
            }))
        }
        None => Ok(None),
    }
}

#[command]
pub async fn download_update(version: String) -> Result<bool, String> {
    let mut state = UPDATE_STATE.write().await;
    state.download_progress = 0.0;
    log::info!("Downloading update version: {}", version);

    // In Tauri v2, actual update download is handled by tauri-plugin-updater
    // This command signals readiness — the frontend calls tauri-plugin-updater for download
    state.download_progress = 100.0;
    let channel = state.channel.clone();
    state.history.push(UpdateRecord {
        version,
        installed_at: chrono::Utc::now().to_rfc3339(),
        channel,
    });
    Ok(true)
}

#[command]
pub async fn get_download_progress() -> Result<f32, String> {
    let state = UPDATE_STATE.read().await;
    Ok(state.download_progress)
}

#[command]
pub async fn install_update() -> Result<(), String> {
    log::info!("Installing update...");
    // In Tauri v2, restart for update is handled by tauri-plugin-updater
    Ok(())
}

#[command]
pub async fn cancel_update() -> Result<(), String> {
    let mut state = UPDATE_STATE.write().await;
    state.download_progress = 0.0;
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
    let mut state = UPDATE_STATE.write().await;
    state.skipped_versions.push(version);
    Ok(())
}

#[command]
pub async fn get_last_update_check() -> Result<Option<String>, String> {
    let state = UPDATE_STATE.read().await;
    Ok(state.last_check.clone())
}
