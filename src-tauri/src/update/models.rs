//! Model Update System for KRO_IDE
//!
//! Manages AI model updates independent of IDE updates

use super::*;
use anyhow::{Result, Context};
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

/// Model version info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelVersion {
    pub name: String,
    pub version: String,
    pub size_bytes: u64,
    pub download_url: String,
    pub sha256: String,
    pub release_date: String,
    pub improvements: Vec<String>,
    pub breaking_changes: bool,
}

/// Model updater
pub struct ModelUpdater {
    models_dir: PathBuf,
    registry_url: String,
}

impl ModelUpdater {
    pub fn new(models_dir: PathBuf) -> Self {
        Self {
            models_dir,
            registry_url: "https://models.kro-ide.dev/v1/registry".to_string(),
        }
    }
    
    /// Check for model updates
    pub async fn check_for_updates(&self) -> Result<Vec<ModelUpdate>> {
        let client = reqwest::Client::new();
        
        // Get local model versions
        let local_versions = self.get_local_versions()?;
        
        // Fetch remote registry
        let response = client.get(&self.registry_url)
            .timeout(std::time::Duration::from_secs(30))
            .send()
            .await?;
        
        let registry: ModelRegistry = response.json().await?;
        
        // Compare versions
        let mut updates = Vec::new();
        
        for local in &local_versions {
            if let Some(remote) = registry.models.iter().find(|m| &m.name == &local.name) {
                if remote.version != local.version {
                    updates.push(ModelUpdate {
                        current: local.clone(),
                        available: remote.clone(),
                        delta_available: false,
                        priority: if remote.breaking_changes {
                            UpdatePriority::Critical
                        } else {
                            UpdatePriority::Normal
                        },
                    });
                }
            }
        }
        
        Ok(updates)
    }
    
    /// Download model update
    pub async fn download_model(
        &self,
        update: &ModelUpdate,
        progress: impl Fn(f32) + Send + 'static,
    ) -> Result<PathBuf> {
        use futures_util::StreamExt;
        use tokio::io::AsyncWriteExt;
        
        let model_path = self.models_dir.join(&update.available.name);
        std::fs::create_dir_all(&model_path)?;
        
        let file_path = model_path.join(format!("{}.gguf", update.available.name));
        let temp_path = model_path.join(format!("{}.gguf.tmp", update.available.name));
        
        // Download with resume support
        let response = reqwest::get(&update.available.download_url).await?;
        let total_size = response.content_length().unwrap_or(update.available.size_bytes);
        
        let mut file = tokio::fs::File::create(&temp_path).await?;
        let mut downloaded: u64 = 0;
        let mut stream = response.bytes_stream();
        
        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            file.write_all(&chunk).await?;
            downloaded += chunk.len() as u64;
            progress(downloaded as f32 / total_size as f32);
        }
        
        // Verify SHA256
        let hash = self.compute_sha256(&temp_path).await?;
        if hash != update.available.sha256 {
            std::fs::remove_file(&temp_path)?;
            anyhow::bail!("SHA256 verification failed");
        }
        
        // Atomic rename
        std::fs::rename(&temp_path, &file_path)?;
        
        // Update manifest
        self.update_manifest(&update.available)?;
        
        Ok(file_path)
    }
    
    /// Get local model versions
    fn get_local_versions(&self) -> Result<Vec<ModelVersion>> {
        let manifest_path = self.models_dir.join("manifest.json");
        
        if !manifest_path.exists() {
            return Ok(Vec::new());
        }
        
        let content = std::fs::read_to_string(&manifest_path)?;
        let manifest: ModelManifest = serde_json::from_str(&content)?;
        
        Ok(manifest.models)
    }
    
    /// Compute SHA256 hash
    async fn compute_sha256(&self, path: &PathBuf) -> Result<String> {
        use sha2::{Sha256, Digest};
        
        let mut hasher = Sha256::new();
        let mut file = std::fs::File::open(path)?;
        
        let mut buffer = vec![0u8; 8192];
        loop {
            let bytes_read = file.read(&mut buffer)?;
            if bytes_read == 0 {
                break;
            }
            hasher.update(&buffer[..bytes_read]);
        }
        
        Ok(format!("{:x}", hasher.finalize()))
    }
    
    /// Update manifest after download
    fn update_manifest(&self, model: &ModelVersion) -> Result<()> {
        let manifest_path = self.models_dir.join("manifest.json");
        
        let mut manifest = if manifest_path.exists() {
            let content = std::fs::read_to_string(&manifest_path)?;
            serde_json::from_str::<ModelManifest>(&content)?
        } else {
            ModelManifest { models: Vec::new() }
        };
        
        // Update or add model
        if let Some(existing) = manifest.models.iter_mut().find(|m| m.name == model.name) {
            *existing = model.clone();
        } else {
            manifest.models.push(model.clone());
        }
        
        let content = serde_json::to_string_pretty(&manifest)?;
        std::fs::write(&manifest_path, content)?;
        
        Ok(())
    }
    
    /// Delete old model version
    pub fn delete_model(&self, name: &str) -> Result<()> {
        let model_dir = self.models_dir.join(name);
        if model_dir.exists() {
            std::fs::remove_dir_all(&model_dir)?;
        }
        Ok(())
    }
    
    /// Get model storage usage
    pub fn get_storage_usage(&self) -> Result<u64> {
        let mut total = 0u64;
        
        if self.models_dir.exists() {
            for entry in std::fs::read_dir(&self.models_dir)? {
                let entry = entry?;
                if entry.path().is_dir() {
                    for file in std::fs::read_dir(entry.path())? {
                        let file = file?;
                        total += file.metadata()?.len();
                    }
                }
            }
        }
        
        Ok(total)
    }
}

/// Model update info
#[derive(Debug, Clone)]
pub struct ModelUpdate {
    pub current: ModelVersion,
    pub available: ModelVersion,
    pub delta_available: bool,
    pub priority: UpdatePriority,
}

/// Update priority
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UpdatePriority {
    Low,
    Normal,
    High,
    Critical,
}

/// Model registry from server
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ModelRegistry {
    models: Vec<ModelVersion>,
}

/// Local model manifest
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ModelManifest {
    models: Vec<ModelVersion>,
}

use std::io::Read;
use sha2::Sha256;
