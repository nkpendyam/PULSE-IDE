//! Auto-Update System for KRO_IDE
//!
//! Provides zero-downtime, rollback-capable auto-updates with:
//! - Delta patching for bandwidth efficiency
//! - Shadow staging for safe updates
//! - Automatic rollback on crash
//! - Multi-channel distribution (nightly/beta/stable/enterprise)

pub mod channels;
pub mod delta;
pub mod rollback;
pub mod models;

pub use channels::{UpdateChannel, UpdatePolicy};
pub use delta::DeltaUpdater;
pub use rollback::{RollbackManager, HealthMonitor};
pub use models::{ModelUpdater, ModelVersion};

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use anyhow::{Result, Context};
use std::path::PathBuf;

/// Update configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateConfig {
    /// Update channel
    pub channel: UpdateChannel,
    /// Auto-download updates
    pub auto_download: bool,
    /// Auto-install updates
    pub auto_install: bool,
    /// Only update during certain hours
    pub allowed_hours: Option<(u8, u8)>,
    /// Require code signing verification
    pub require_signature: bool,
    /// Rollback on failure
    pub auto_rollback: bool,
    /// Check interval in seconds
    pub check_interval_secs: u64,
    /// Update server URL
    pub server_url: String,
}

impl Default for UpdateConfig {
    fn default() -> Self {
        Self {
            channel: UpdateChannel::Stable,
            auto_download: true,
            auto_install: false,
            allowed_hours: Some((2, 4)), // 2-4 AM
            require_signature: true,
            auto_rollback: true,
            check_interval_secs: 3600, // 1 hour
            server_url: "https://updates.kro-ide.dev".to_string(),
        }
    }
}

/// Update status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStatus {
    /// Current version
    pub current_version: String,
    /// Available version (if update available)
    pub available_version: Option<String>,
    /// Download progress (0.0 - 1.0)
    pub download_progress: f32,
    /// Whether update is ready to install
    pub ready_to_install: bool,
    /// Whether currently downloading
    pub is_downloading: bool,
    /// Last check time
    pub last_check: Option<String>,
    /// Error message if any
    pub error: Option<String>,
    /// Size of update in bytes
    pub update_size: Option<u64>,
    /// Changelog summary
    pub changelog: Option<String>,
}

/// Update manager
pub struct UpdateManager {
    config: UpdateConfig,
    status: Arc<RwLock<UpdateStatus>>,
    delta_updater: DeltaUpdater,
    rollback_manager: RollbackManager,
    health_monitor: HealthMonitor,
    versions_dir: PathBuf,
    current_link: PathBuf,
}

impl UpdateManager {
    /// Create a new update manager
    pub fn new(config: UpdateConfig) -> Result<Self> {
        let versions_dir = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("kro_ide")
            .join("versions");
        
        let current_link = versions_dir.join("current");
        
        std::fs::create_dir_all(&versions_dir)?;
        
        let status = UpdateStatus {
            current_version: env!("CARGO_PKG_VERSION").to_string(),
            available_version: None,
            download_progress: 0.0,
            ready_to_install: false,
            is_downloading: false,
            last_check: None,
            error: None,
            update_size: None,
            changelog: None,
        };
        
        Ok(Self {
            delta_updater: DeltaUpdater::new()?,
            rollback_manager: RollbackManager::new(versions_dir.clone())?,
            health_monitor: HealthMonitor::new(),
            status: Arc::new(RwLock::new(status)),
            versions_dir,
            current_link,
            config,
        })
    }
    
    /// Check for updates
    pub async fn check_for_updates(&self) -> Result<Option<UpdateInfo>> {
        let client = reqwest::Client::new();
        
        let url = format!(
            "{}/v1/check?version={}&channel={}&platform={}",
            self.config.server_url,
            env!("CARGO_PKG_VERSION"),
            self.config.channel.to_string(),
            self.platform_string()
        );
        
        let response = client.get(&url)
            .timeout(std::time::Duration::from_secs(30))
            .send()
            .await?;
        
        if !response.status().is_success() {
            anyhow::bail!("Update check failed: {}", response.status());
        }
        
        let info: UpdateInfo = response.json().await?;
        
        let mut status = self.status.write().await;
        status.last_check = Some(chrono::Utc::now().to_rfc3339());
        
        if info.version != env!("CARGO_PKG_VERSION") {
            status.available_version = Some(info.version.clone());
            status.update_size = Some(info.size_bytes);
            status.changelog = info.changelog.clone();
            return Ok(Some(info));
        }
        
        Ok(None)
    }
    
    /// Download an update
    pub async fn download_update(&self, info: &UpdateInfo) -> Result<PathBuf> {
        let mut status = self.status.write().await;
        status.is_downloading = true;
        status.download_progress = 0.0;
        drop(status);
        
        let target_dir = self.versions_dir.join(&info.version);
        std::fs::create_dir_all(&target_dir)?;
        
        // Try delta update first
        let result = if info.delta_url.is_some() {
            self.delta_updater.download_and_apply_delta(
                &info.delta_url.as_ref().unwrap(),
                &target_dir,
                |progress| {
                    if let Ok(mut status) = self.status.try_write() {
                        status.download_progress = progress;
                    }
                }
            ).await
        } else {
            Err(anyhow::anyhow!("No delta available"))
        };
        
        // Fall back to full download
        let final_path = match result {
            Ok(path) => path,
            Err(_) => {
                self.download_full(&info.download_url, &target_dir).await?
            }
        };
        
        let mut status = self.status.write().await;
        status.is_downloading = false;
        status.download_progress = 1.0;
        status.ready_to_install = true;
        
        Ok(final_path)
    }
    
    /// Download full update
    async fn download_full(&self, url: &str, target: &PathBuf) -> Result<PathBuf> {
        use futures_util::StreamExt;
        use tokio::io::AsyncWriteExt;
        
        let response = reqwest::get(url).await?;
        let total_size = response.content_length().unwrap_or(0);
        
        let archive_path = target.join("update.archive");
        let mut file = tokio::fs::File::create(&archive_path).await?;
        let mut downloaded: u64 = 0;
        let mut stream = response.bytes_stream();
        
        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            file.write_all(&chunk).await?;
            downloaded += chunk.len() as u64;
            
            if total_size > 0 {
                if let Ok(mut status) = self.status.try_write() {
                    status.download_progress = downloaded as f32 / total_size as f32;
                }
            }
        }
        
        // Extract archive
        self.extract_archive(&archive_path, target).await?;
        std::fs::remove_file(&archive_path)?;
        
        Ok(target.join("kro_ide"))
    }
    
    /// Extract update archive
    async fn extract_archive(&self, archive: &PathBuf, target: &PathBuf) -> Result<()> {
        // Use tar/zip extraction based on file extension
        let ext = archive.extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");
        
        match ext {
            "zip" => {
                let file = std::fs::File::open(archive)?;
                let mut archive = zip::ZipArchive::new(file)?;
                archive.extract(target)?;
            }
            "gz" | "tgz" => {
                use flate2::read::GzDecoder;
                let file = std::fs::File::open(archive)?;
                let decoder = GzDecoder::new(file);
                let mut archive = tar::Archive::new(decoder);
                archive.unpack(target)?;
            }
            _ => anyhow::bail!("Unsupported archive format: {}", ext),
        }
        
        Ok(())
    }
    
    /// Install a staged update
    pub async fn install_update(&self) -> Result<()> {
        let status = self.status.read().await;
        
        if !status.ready_to_install {
            anyhow::bail!("No update ready to install");
        }
        
        let version = status.available_version.as_ref()
            .ok_or_else(|| anyhow::anyhow!("No update available"))?;
        
        drop(status);
        
        // Create rollback point
        self.rollback_manager.create_restore_point()?;
        
        // Activate new version
        let new_version_dir = self.versions_dir.join(version);
        self.activate_version(&new_version_dir)?;
        
        log::info!("Update {} installed successfully", version);
        Ok(())
    }
    
    /// Activate a version
    fn activate_version(&self, version_dir: &PathBuf) -> Result<()> {
        #[cfg(unix)]
        {
            // Atomic symlink swap on Unix
            let temp_link = self.versions_dir.join("current_new");
            
            if temp_link.exists() {
                std::fs::remove_file(&temp_link)?;
            }
            
            std::os::unix::fs::symlink(version_dir, &temp_link)?;
            std::fs::rename(&temp_link, &self.current_link)?;
        }
        
        #[cfg(windows)]
        {
            // Windows requires a different approach
            // We'll use a batch file that runs on restart
            let old_path = self.current_link.clone();
            let old_backup = self.versions_dir.join("current_old");
            
            if old_backup.exists() {
                std::fs::remove_dir_all(&old_backup)?;
            }
            
            if old_path.exists() {
                std::fs::rename(&old_path, &old_backup)?;
            }
            
            // Copy new version (can't symlink easily on Windows without admin)
            self.copy_dir_all(version_dir, &old_path)?;
            
            // Schedule cleanup of old version
            self.schedule_cleanup_on_reboot(&old_backup)?;
        }
        
        Ok(())
    }
    
    /// Copy directory recursively
    fn copy_dir_all(&self, src: &PathBuf, dst: &PathBuf) -> Result<()> {
        std::fs::create_dir_all(dst)?;
        
        for entry in std::fs::read_dir(src)? {
            let entry = entry?;
            let ty = entry.file_type()?;
            let src_path = entry.path();
            let dst_path = dst.join(entry.file_name());
            
            if ty.is_dir() {
                self.copy_dir_all(&src_path, &dst_path)?;
            } else {
                std::fs::copy(&src_path, &dst_path)?;
            }
        }
        
        Ok(())
    }
    
    /// Schedule cleanup on Windows reboot
    #[cfg(windows)]
    fn schedule_cleanup_on_reboot(&self, path: &PathBuf) -> Result<()> {
        use winapi::um::winbase::MoveFileExA;
        use winapi::um::winbase::MOVEFILE_DELAY_UNTIL_REBOOT;
        use std::ffi::CString;
        
        let path_cstr = CString::new(path.to_string_lossy().into_owned())?;
        
        unsafe {
            MoveFileExA(
                path_cstr.as_ptr(),
                std::ptr::null(),
                MOVEFILE_DELAY_UNTIL_REBOOT,
            );
        }
        
        Ok(())
    }
    
    #[cfg(not(windows))]
    fn schedule_cleanup_on_reboot(&self, _path: &PathBuf) -> Result<()> {
        Ok(())
    }
    
    /// Rollback to previous version
    pub async fn rollback(&self) -> Result<()> {
        self.rollback_manager.rollback()
    }
    
    /// Get current status
    pub async fn status(&self) -> UpdateStatus {
        self.status.read().await.clone()
    }
    
    /// Get platform string
    fn platform_string(&self) -> String {
        #[cfg(target_os = "windows")]
        { "windows".to_string() }
        
        #[cfg(target_os = "macos")]
        { "macos".to_string() }
        
        #[cfg(target_os = "linux")]
        { "linux".to_string() }
        
        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        { "unknown".to_string() }
    }
    
    /// Start background update checker
    pub fn start_background_checker(self: Arc<Self>) {
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(
                std::time::Duration::from_secs(self.config.check_interval_secs)
            );
            
            loop {
                interval.tick().await;
                
                // Check if within allowed hours
                if let Some((start, end)) = self.config.allowed_hours {
                    let now = chrono::Utc::now().hour() as u8;
                    if now < start || now > end {
                        continue;
                    }
                }
                
                // Check for updates
                if let Ok(Some(info)) = self.check_for_updates().await {
                    if self.config.auto_download {
                        if let Ok(_) = self.download_update(&info).await {
                            if self.config.auto_install {
                                let _ = self.install_update().await;
                            }
                        }
                    }
                }
            }
        });
    }
}

/// Update information from server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub version: String,
    pub size_bytes: u64,
    pub download_url: String,
    pub delta_url: Option<String>,
    pub changelog: Option<String>,
    pub critical: bool,
    pub release_date: String,
    pub signature: Option<String>,
}
