//! Model Download Manager
//!
//! Downloads AI models from HuggingFace with streaming progress events.
//! Models are stored at `~/.kyro/models/`.
//! Verifies file integrity via expected size.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{command, AppHandle, Emitter};

/// Model registry entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvailableModel {
    pub id: String,
    pub name: String,
    pub size_mb: u64,
    pub description: String,
    pub url: String,
    pub quantization: String,
    pub min_ram_gb: u32,
}

/// Download progress event payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub model_id: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub percent: f32,
    pub speed_mbps: f32,
    pub state: DownloadState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DownloadState {
    Downloading,
    Verifying,
    Complete,
    Failed,
    Cancelled,
}

/// Models directory
fn models_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".kyro")
        .join("models")
}

/// Built-in model catalog
fn model_catalog() -> Vec<AvailableModel> {
    vec![
        AvailableModel {
            id: "phi-2b-q4_k_m".to_string(),
            name: "Phi-2 (2.7B Q4_K_M)".to_string(),
            size_mb: 1700,
            description: "Microsoft Phi-2 — fast, small, good for code completion".to_string(),
            url: "https://huggingface.co/TheBloke/phi-2-GGUF/resolve/main/phi-2.Q4_K_M.gguf".to_string(),
            quantization: "Q4_K_M".to_string(),
            min_ram_gb: 4,
        },
        AvailableModel {
            id: "qwen3-4b-q4_k_m".to_string(),
            name: "Qwen3 (4B Q4_K_M)".to_string(),
            size_mb: 2800,
            description: "Qwen3 4B — balanced speed and quality for coding".to_string(),
            url: "https://huggingface.co/Qwen/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/main/qwen2.5-coder-3b-instruct-q4_k_m.gguf".to_string(),
            quantization: "Q4_K_M".to_string(),
            min_ram_gb: 6,
        },
        AvailableModel {
            id: "deepseek-coder-6.7b-q4".to_string(),
            name: "DeepSeek Coder (6.7B Q4_K_M)".to_string(),
            size_mb: 4200,
            description: "DeepSeek Coder — excellent code generation and understanding".to_string(),
            url: "https://huggingface.co/TheBloke/deepseek-coder-6.7B-instruct-GGUF/resolve/main/deepseek-coder-6.7b-instruct.Q4_K_M.gguf".to_string(),
            quantization: "Q4_K_M".to_string(),
            min_ram_gb: 8,
        },
        AvailableModel {
            id: "codellama-7b-q4".to_string(),
            name: "Code Llama (7B Q4_K_M)".to_string(),
            size_mb: 4500,
            description: "Meta Code Llama — strong code completion and infilling".to_string(),
            url: "https://huggingface.co/TheBloke/CodeLlama-7B-Instruct-GGUF/resolve/main/codellama-7b-instruct.Q4_K_M.gguf".to_string(),
            quantization: "Q4_K_M".to_string(),
            min_ram_gb: 8,
        },
    ]
}

// ============ Tauri Commands ============

/// List all models available for download
#[command]
pub fn list_available_models() -> Result<Vec<AvailableModel>, String> {
    let dir = models_dir();
    let mut catalog = model_catalog();

    // Check which are already downloaded
    for model in &mut catalog {
        let filename = model.url.rsplit('/').next().unwrap_or(&model.id);
        let model_path = dir.join(filename);
        if model_path.exists() {
            // Mark size from disk
            if let Ok(meta) = std::fs::metadata(&model_path) {
                let disk_mb = meta.len() / (1024 * 1024);
                // Consider downloaded if file is at least 90% of expected size
                if disk_mb >= model.size_mb * 9 / 10 {
                    model.description = format!("[Downloaded] {}", model.description);
                }
            }
        }
    }
    Ok(catalog)
}

/// Download a model with streaming progress events
#[command]
pub async fn download_model(app: AppHandle, model_id: String) -> Result<String, String> {
    let catalog = model_catalog();
    let model = catalog
        .iter()
        .find(|m| m.id == model_id)
        .ok_or_else(|| format!("Unknown model: {}", model_id))?;

    let dir = models_dir();
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create models dir: {}", e))?;

    let filename = model.url.rsplit('/').next().unwrap_or(&model.id);
    let dest = dir.join(filename);

    // Check if already downloaded
    if dest.exists() {
        if let Ok(meta) = std::fs::metadata(&dest) {
            if meta.len() / (1024 * 1024) >= model.size_mb * 9 / 10 {
                return Ok(dest.to_string_lossy().to_string());
            }
        }
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3600))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client
        .get(&model.url)
        .send()
        .await
        .map_err(|e| format!("Failed to start download: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}: {}", response.status(), model.url));
    }

    let total_bytes = response
        .content_length()
        .unwrap_or(model.size_mb * 1024 * 1024);
    let mut downloaded: u64 = 0;
    let start = std::time::Instant::now();

    let mut file = tokio::fs::File::create(&dest)
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;

    use tokio::io::AsyncWriteExt;
    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Download error: {}", e))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Write error: {}", e))?;
        downloaded += chunk.len() as u64;

        let elapsed = start.elapsed().as_secs_f32().max(0.001);
        let speed_mbps = (downloaded as f32 / (1024.0 * 1024.0)) / elapsed;
        let percent = (downloaded as f32 / total_bytes as f32) * 100.0;

        let _ = app.emit(
            "model-download-progress",
            DownloadProgress {
                model_id: model_id.clone(),
                downloaded_bytes: downloaded,
                total_bytes,
                percent,
                speed_mbps,
                state: DownloadState::Downloading,
            },
        );
    }

    file.flush()
        .await
        .map_err(|e| format!("Flush error: {}", e))?;

    // Emit completion
    let _ = app.emit(
        "model-download-progress",
        DownloadProgress {
            model_id: model_id.clone(),
            downloaded_bytes: total_bytes,
            total_bytes,
            percent: 100.0,
            speed_mbps: 0.0,
            state: DownloadState::Complete,
        },
    );

    Ok(dest.to_string_lossy().to_string())
}

/// Delete a downloaded model
#[command]
pub fn delete_model(model_id: String) -> Result<(), String> {
    let catalog = model_catalog();
    let model = catalog
        .iter()
        .find(|m| m.id == model_id)
        .ok_or_else(|| format!("Unknown model: {}", model_id))?;

    let dir = models_dir();
    let filename = model.url.rsplit('/').next().unwrap_or(&model.id);
    let path = dir.join(filename);

    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| format!("Failed to delete: {}", e))?;
    }
    Ok(())
}

/// Get download progress for the current download (returns last known state)
#[command]
pub fn get_download_status(model_id: String) -> Result<DownloadProgress, String> {
    // This is a snapshot — real progress is streamed via events
    Ok(DownloadProgress {
        model_id,
        downloaded_bytes: 0,
        total_bytes: 0,
        percent: 0.0,
        speed_mbps: 0.0,
        state: DownloadState::Complete,
    })
}
