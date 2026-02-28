//! Local Inference Engine using llama.cpp integration
//!
//! This module provides direct local LLM inference without Ollama dependency.
//! It uses the GGUF format models with quantization support (Q4_K_M, Q5_K_M, etc.)

use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Command;
use sha2::Digest;

/// Local inference engine that manages llama.cpp processes
pub struct LocalInferenceEngine {
    models_dir: PathBuf,
    loaded_models: HashMap<String, LoadedModel>,
    max_memory_gb: f32,
    default_model: String,
    llama_cpp_path: Option<PathBuf>,
}

/// A loaded model with its process handle
struct LoadedModel {
    name: String,
    path: PathBuf,
    context_length: u32,
    quantization: String,
    memory_usage_gb: f32,
}

/// Model download progress
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub model_name: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub percentage: f32,
}

/// Inference parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceParams {
    pub temperature: f32,
    pub top_p: f32,
    pub top_k: u32,
    pub repeat_penalty: f32,
    pub mirostat: u8,
    pub threads: u32,
    pub n_gpu_layers: i32,
}

impl Default for InferenceParams {
    fn default() -> Self {
        Self {
            temperature: 0.7,
            top_p: 0.9,
            top_k: 40,
            repeat_penalty: 1.1,
            mirostat: 2,
            threads: 4,
            n_gpu_layers: -1, // Auto-detect GPU layers
        }
    }
}

impl LocalInferenceEngine {
    /// Create a new local inference engine
    pub async fn new(default_model: String, max_memory_gb: f32) -> Result<Self> {
        let models_dir = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("kyro-ide")
            .join("models");

        // Ensure models directory exists
        tokio::fs::create_dir_all(&models_dir).await
            .context("Failed to create models directory")?;

        // Try to find llama.cpp binary
        let llama_cpp_path = Self::find_llama_cpp()?;

        Ok(Self {
            models_dir,
            loaded_models: HashMap::new(),
            max_memory_gb,
            default_model,
            llama_cpp_path,
        })
    }

    /// Find llama.cpp binary on the system
    fn find_llama_cpp() -> Result<Option<PathBuf>> {
        // Check common locations
        let paths = vec![
            "/usr/local/bin/llama",
            "/usr/bin/llama",
            "./llama.cpp/main",
            "./llama.cpp/llama-cli",
        ];

        for path in &paths {
            if PathBuf::from(path).exists() {
                return Ok(Some(PathBuf::from(path)));
            }
        }

        // Check PATH
        if let Ok(path) = which::which("llama-cli") {
            return Ok(Some(path));
        }

        if let Ok(path) = which::which("llama") {
            return Ok(Some(path));
        }

        // Check for Ollama as fallback
        if which::which("ollama").is_ok() {
            // Ollama is available, we can use it as fallback
            return Ok(None);
        }

        Ok(None)
    }

    /// Load a model into memory
    pub async fn load_model(&mut self, model_name: &str) -> Result<()> {
        if self.loaded_models.contains_key(model_name) {
            return Ok(());
        }

        // Check if model file exists locally
        let model_path = self.get_model_path(model_name);
        
        if !model_path.exists() {
            // Download model
            self.download_model(model_name).await?;
        }

        // Verify model integrity
        self.verify_model(&model_path).await?;

        // Load model info
        let model_info = self.get_model_info(&model_path).await?;

        // Check memory constraints
        if model_info.memory_usage_gb > self.max_memory_gb {
            return Err(anyhow::anyhow!(
                "Model requires {} GB but only {} GB allocated",
                model_info.memory_usage_gb,
                self.max_memory_gb
            ));
        }

        self.loaded_models.insert(
            model_name.to_string(),
            LoadedModel {
                name: model_name.to_string(),
                path: model_path,
                context_length: model_info.context_length,
                quantization: model_info.quantization,
                memory_usage_gb: model_info.memory_usage_gb,
            },
        );

        Ok(())
    }

    /// Get the local path for a model
    fn get_model_path(&self, model_name: &str) -> PathBuf {
        // Convert model name to filename
        let filename = model_name
            .replace("/", "--")
            .replace(":", "-");
        self.models_dir.join(format!("{}.gguf", filename))
    }

    /// Download a model from HuggingFace
    async fn download_model(&self, model_name: &str) -> Result<()> {
        let model_path = self.get_model_path(model_name);
        
        // Parse model name to get HuggingFace URL
        let url = self.get_huggingface_url(model_name)?;
        
        println!("Downloading model from: {}", url);

        // Use reqwest to download
        let response = reqwest::get(&url).await
            .context("Failed to start download")?;

        let total_size = response.content_length().unwrap_or(0);
        let mut downloaded: u64 = 0;
        let mut stream = response.bytes_stream();
        let mut file = tokio::fs::File::create(&model_path).await?;

        use futures_util::StreamExt;
        use tokio::io::AsyncWriteExt;

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.context("Failed to read chunk")?;
            file.write_all(&chunk).await?;
            downloaded += chunk.len() as u64;
            
            if total_size > 0 {
                let pct = (downloaded as f32 / total_size as f32) * 100.0;
                println!("Downloaded: {:.1}%", pct);
            }
        }

        file.flush().await?;
        println!("Model downloaded successfully: {:?}", model_path);

        Ok(())
    }

    /// Get HuggingFace download URL for a model
    fn get_huggingface_url(&self, model_name: &str) -> Result<String> {
        // Map common model names to HuggingFace URLs
        let urls: HashMap<&str, &str> = [
            ("codellama:7b-instruct-q4_K_M", 
             "https://huggingface.co/TheBloke/CodeLlama-7B-Instruct-GGUF/resolve/main/codellama-7b-instruct.Q4_K_M.gguf"),
            ("codellama:13b-instruct-q4_K_M",
             "https://huggingface.co/TheBloke/CodeLlama-13B-Instruct-GGUF/resolve/main/codellama-13b-instruct.Q4_K_M.gguf"),
            ("tinyllama:1.1b-q4_K_M",
             "https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf"),
            ("mistral:7b-instruct-q4_K_M",
             "https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf"),
            ("deepseek-coder:6.7b-instruct-q4_K_M",
             "https://huggingface.co/TheBloke/deepseek-coder-6.7B-instruct-GGUF/resolve/main/deepseek-coder-6.7b-instruct.Q4_K_M.gguf"),
        ].iter().cloned().collect();

        urls.get(model_name)
            .map(|s| s.to_string())
            .ok_or_else(|| anyhow::anyhow!("Unknown model: {}", model_name))
    }

    /// Verify model file integrity
    async fn verify_model(&self, model_path: &PathBuf) -> Result<()> {
        // Check file exists and is not empty
        let metadata = tokio::fs::metadata(model_path).await
            .context("Model file not found")?;

        if metadata.len() < 1_000_000 {
            return Err(anyhow::anyhow!("Model file too small, likely corrupted"));
        }

        // Verify GGUF magic number
        let mut file = tokio::fs::File::open(model_path).await?;
        let mut magic = [0u8; 4];
        use tokio::io::AsyncReadExt;
        file.read_exact(&mut magic).await?;

        // GGUF magic: "GGUF"
        if &magic != b"GGUF" {
            return Err(anyhow::anyhow!("Invalid GGUF file format"));
        }

        Ok(())
    }

    /// Get model information
    async fn get_model_info(&self, model_path: &PathBuf) -> Result<ModelLoadInfo> {
        let metadata = tokio::fs::metadata(model_path).await?;
        let size = metadata.len();

        // Estimate memory usage (GGUF files are typically 1.3x their size in memory)
        let memory_usage_gb = (size as f32 * 1.3) / (1024.0 * 1024.0 * 1024.0);

        // Extract quantization from filename
        let filename = model_path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        
        let quantization = if filename.contains("Q4_K_M") {
            "Q4_K_M"
        } else if filename.contains("Q5_K_M") {
            "Q5_K_M"
        } else if filename.contains("Q8_0") {
            "Q8_0"
        } else {
            "Unknown"
        }.to_string();

        Ok(ModelLoadInfo {
            context_length: 4096, // Default, should be read from GGUF
            quantization,
            memory_usage_gb,
        })
    }

    /// Generate completion
    pub async fn complete(&mut self, prompt: &str, max_tokens: u32) -> Result<String> {
        // If llama.cpp is available, use it directly
        if let Some(ref llama_path) = self.llama_cpp_path {
            return self.complete_with_llama_cpp(llama_path, prompt, max_tokens).await;
        }

        // Fall back to Ollama
        self.complete_with_ollama(prompt, max_tokens).await
    }

    /// Complete using llama.cpp binary
    async fn complete_with_llama_cpp(&self, llama_path: &PathBuf, prompt: &str, max_tokens: u32) -> Result<String> {
        // Find a loaded model
        let model = self.loaded_models.values().next()
            .ok_or_else(|| anyhow::anyhow!("No model loaded"))?;

        let params = InferenceParams::default();

        let output = Command::new(llama_path)
            .arg("-m").arg(&model.path)
            .arg("-p").arg(prompt)
            .arg("-n").arg(max_tokens.to_string())
            .arg("--temp").arg(params.temperature.to_string())
            .arg("--top-p").arg(params.top_p.to_string())
            .arg("--top-k").arg(params.top_k.to_string())
            .arg("--repeat-penalty").arg(params.repeat_penalty.to_string())
            .arg("-t").arg(params.threads.to_string())
            .arg("-ngl").arg(params.n_gpu_layers.to_string())
            .arg("--no-display-prompt")
            .output()
            .context("Failed to run llama.cpp")?;

        if output.status.success() {
            let response = String::from_utf8_lossy(&output.stdout).to_string();
            Ok(response.trim().to_string())
        } else {
            let error = String::from_utf8_lossy(&output.stderr);
            Err(anyhow::anyhow!("llama.cpp error: {}", error))
        }
    }

    /// Complete using Ollama as fallback
    async fn complete_with_ollama(&self, prompt: &str, max_tokens: u32) -> Result<String> {
        #[derive(serde::Serialize)]
        struct OllamaRequest {
            model: String,
            prompt: String,
            stream: bool,
            options: OllamaOptions,
        }

        #[derive(serde::Serialize)]
        struct OllamaOptions {
            num_predict: u32,
            temperature: f32,
        }

        let request = OllamaRequest {
            model: self.default_model.clone(),
            prompt: prompt.to_string(),
            stream: false,
            options: OllamaOptions {
                num_predict: max_tokens,
                temperature: 0.7,
            },
        };

        let client = reqwest::Client::new();
        let response = client
            .post("http://localhost:11434/api/generate")
            .json(&request)
            .timeout(std::time::Duration::from_secs(120))
            .send()
            .await
            .context("Failed to connect to Ollama")?;

        #[derive(serde::Deserialize)]
        struct OllamaResponse {
            response: String,
        }

        let data: OllamaResponse = response.json().await
            .context("Failed to parse Ollama response")?;

        Ok(data.response)
    }

    /// Generate streaming completion
    pub async fn complete_stream(
        &mut self,
        prompt: &str,
        max_tokens: u32,
        mut callback: impl FnMut(String) + Send + 'static,
    ) -> Result<String> {
        // Use Ollama streaming for now
        #[derive(serde::Serialize)]
        struct OllamaRequest {
            model: String,
            prompt: String,
            stream: bool,
        }

        let request = OllamaRequest {
            model: self.default_model.clone(),
            prompt: prompt.to_string(),
            stream: true,
        };

        let client = reqwest::Client::new();
        let response = client
            .post("http://localhost:11434/api/generate")
            .json(&request)
            .timeout(std::time::Duration::from_secs(120))
            .send()
            .await
            .context("Failed to connect to Ollama")?;

        use futures_util::StreamExt;
        let mut stream = response.bytes_stream();
        let mut full_response = String::new();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.context("Failed to read stream chunk")?;
            let text = String::from_utf8_lossy(&chunk);

            // Parse each JSON line
            for line in text.lines() {
                if line.is_empty() {
                    continue;
                }

                #[derive(serde::Deserialize)]
                struct StreamResponse {
                    response: String,
                    done: bool,
                }

                if let Ok(data) = serde_json::from_str::<StreamResponse>(line) {
                    if !data.response.is_empty() {
                        callback(data.response.clone());
                        full_response.push_str(&data.response);
                    }
                    if data.done {
                        break;
                    }
                }
            }
        }

        Ok(full_response)
    }

    /// Get number of loaded models
    pub fn models_loaded(&self) -> usize {
        self.loaded_models.len()
    }

    /// Unload a model
    pub fn unload_model(&mut self, model_name: &str) -> Result<()> {
        self.loaded_models.remove(model_name);
        Ok(())
    }

    /// Get memory usage
    pub fn memory_usage(&self) -> f32 {
        self.loaded_models.values().map(|m| m.memory_usage_gb).sum()
    }
}

struct ModelLoadInfo {
    context_length: u32,
    quantization: String,
    memory_usage_gb: f32,
}
