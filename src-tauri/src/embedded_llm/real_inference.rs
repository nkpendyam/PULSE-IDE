//! Real LLM Inference using llama.cpp
//!
//! This module provides actual GGUF model inference using the llama-cpp-rs crate.
//! Supports CPU, CUDA, Metal, and Vulkan backends.

use anyhow::{Result, Context, bail};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::{RwLock, Mutex};
use std::collections::HashMap;
use std::time::Instant;

#[cfg(feature = "llama-cpp")]
use llama_cpp::{
    LlamaContext, LlamaModel, LlamaParams, SessionParams,
   _standard_sampler::StandardSampler,
    models::ModelLoadingError,
};

use super::{
    EmbeddedLLMConfig, InferenceRequest, InferenceResponse, 
    HardwareCapabilities, MemoryTier
};

/// Real LLM Backend using llama.cpp
pub struct RealLlamaBackend {
    model: Option<Arc<RwLock<LlamaModelWrapper>>>,
    config: EmbeddedLLMConfig,
    hardware: HardwareCapabilities,
    model_path: Option<PathBuf>,
    download_progress: Arc<Mutex<f32>>,
}

/// Wrapper for LlamaModel to handle optional feature
#[cfg(feature = "llama-cpp")]
struct LlamaModelWrapper {
    model: LlamaModel,
    context_params: SessionParams,
}

#[cfg(not(feature = "llama-cpp"))]
struct LlamaModelWrapper;

impl RealLlamaBackend {
    /// Create a new real LLM backend
    pub fn new(config: EmbeddedLLMConfig, hardware: HardwareCapabilities) -> Self {
        Self {
            model: None,
            config,
            hardware,
            model_path: None,
            download_progress: Arc::new(Mutex::new(0.0)),
        }
    }

    /// Get download progress (0.0 - 1.0)
    pub fn get_download_progress(&self) -> Arc<Mutex<f32>> {
        self.download_progress.clone()
    }

    /// Check if a model is loaded
    pub fn is_model_loaded(&self) -> bool {
        self.model.is_some()
    }

    /// Load a GGUF model from path
    #[cfg(feature = "llama-cpp")]
    pub async fn load_model(&mut self, model_path: &Path) -> Result<()> {
        log::info!("Loading model from: {:?}", model_path);
        
        if !model_path.exists() {
            bail!("Model file not found: {:?}", model_path);
        }

        let start = Instant::now();
        
        // Configure model loading based on hardware
        let n_gpu_layers = self.hardware.recommended_tier.gpu_layers();
        let n_ctx = self.config.context_size as u32;
        
        log::info!("GPU layers: {}, Context: {}", n_gpu_layers, n_ctx);

        // Load the model
        let model = LlamaModel::load_from_file(
            model_path,
            LlamaParams {
                n_gpu_layers: Some(n_gpu_layers),
                n_ctx: Some(n_ctx),
                use_mmap: Some(self.config.use_mmap),
                use_mlock: Some(self.config.use_mlock),
                ..Default::default()
            }
        ).map_err(|e| anyhow::anyhow!("Failed to load model: {:?}", e))?;

        // Configure session params
        let context_params = SessionParams {
            n_ctx: Some(n_ctx),
            n_batch: Some(512),
            n_threads: Some(self.config.n_threads as u32),
            ..Default::default()
        };

        let wrapper = LlamaModelWrapper {
            model,
            context_params,
        };

        self.model = Some(Arc::new(RwLock::new(wrapper)));
        self.model_path = Some(model_path.to_path_buf());

        let elapsed = start.elapsed();
        log::info!("Model loaded in {:.2}s", elapsed.as_secs_f64());

        Ok(())
    }

    /// Load model (stub for when llama-cpp feature is disabled)
    #[cfg(not(feature = "llama-cpp"))]
    pub async fn load_model(&mut self, _model_path: &Path) -> Result<()> {
        log::warn!("llama-cpp feature not enabled, using mock inference");
        self.model = Some(Arc::new(RwLock::new(LlamaModelWrapper)));
        Ok(())
    }

    /// Unload the current model
    pub async fn unload_model(&mut self) -> Result<()> {
        self.model = None;
        self.model_path = None;
        log::info!("Model unloaded");
        Ok(())
    }

    /// Run inference
    #[cfg(feature = "llama-cpp")]
    pub async fn infer(&self, request: InferenceRequest) -> Result<InferenceResponse> {
        let model_arc = self.model.as_ref()
            .ok_or_else(|| anyhow::anyhow!("No model loaded"))?;
        
        let model_guard = model_arc.read().await;
        let start = Instant::now();

        // Create context for this session
        let ctx = model_guard.model.create_context(Some(model_guard.context_params))
            .map_err(|e| anyhow::anyhow!("Failed to create context: {:?}", e))?;

        // Build the prompt
        let full_prompt = if let Some(system) = &request.system_prompt {
            format!("{}\n\n{}", system, request.prompt)
        } else {
            request.prompt.clone()
        };

        // Create sampler with parameters
        let mut sampler = StandardSampler::default();
        sampler.temp = request.temperature;
        sampler.top_p = request.top_p;
        sampler.top_k = request.top_k as i32;
        sampler.penalty_repeat = request.repeat_penalty;

        // Start the session
        let session = ctx.create_session()
            .map_err(|e| anyhow::anyhow!("Failed to create session: {:?}", e))?;

        // Feed the prompt
        session.advance_with_prompt(&full_prompt)
            .map_err(|e| anyhow::anyhow!("Failed to set prompt: {:?}", e))?;

        let time_to_first_token = start.elapsed().as_millis() as u64;

        // Generate tokens
        let mut generated_text = String::new();
        let mut tokens_generated = 0u32;
        let max_tokens = request.max_tokens.min(2048);

        for _ in 0..max_tokens {
            let token = session.sample_token(&sampler)
                .map_err(|e| anyhow::anyhow!("Sampling failed: {:?}", e))?;
            
            let piece = session.model().decode_token(token);
            
            // Check for stop sequences
            if request.stop_sequences.iter().any(|s| generated_text.contains(s)) {
                break;
            }

            generated_text.push_str(&piece);
            tokens_generated += 1;

            // Feed the token back for next iteration
            session.advance_token(token)
                .map_err(|e| anyhow::anyhow!("Failed to advance: {:?}", e))?;
        }

        let total_time = start.elapsed().as_millis() as u64;
        let tokens_per_second = if total_time > 0 {
            (tokens_generated as f64 / (total_time as f64 / 1000.0)) as f32
        } else {
            0.0
        };

        Ok(InferenceResponse {
            text: generated_text,
            tokens_generated,
            time_to_first_token_ms: time_to_first_token,
            total_time_ms: total_time,
            tokens_per_second,
            model: self.model_path.as_ref()
                .and_then(|p| p.file_name())
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string(),
            from_cache: false,
            memory_used: 0, // Would need model size
        })
    }

    /// Run inference (mock implementation when llama-cpp is disabled)
    #[cfg(not(feature = "llama-cpp"))]
    pub async fn infer(&self, request: InferenceRequest) -> Result<InferenceResponse> {
        if self.model.is_none() {
            bail!("No model loaded");
        }

        // Mock response for testing
        let start = Instant::now();
        
        // Simulate processing time
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        
        let mock_response = generate_mock_response(&request.prompt);

        let elapsed = start.elapsed();

        Ok(InferenceResponse {
            text: mock_response,
            tokens_generated: 50,
            time_to_first_token_ms: 50,
            total_time_ms: elapsed.as_millis() as u64,
            tokens_per_second: 50.0,
            model: "mock-model".to_string(),
            from_cache: false,
            memory_used: 0,
        })
    }

    /// Stream inference (returns chunks)
    pub async fn infer_stream<F>(&self, request: InferenceRequest, mut callback: F) -> Result<InferenceResponse>
    where
        F: FnMut(&str) + Send
    {
        // For now, just do regular inference and call callback with result
        let response = self.infer(request).await?;
        callback(&response.text);
        Ok(response)
    }
}

/// Generate mock response when llama-cpp is not available
fn generate_mock_response(prompt: &str) -> String {
    let prompt_lower = prompt.to_lowercase();
    
    if prompt_lower.contains("fix") || prompt_lower.contains("bug") {
        "I can help you fix that issue. Based on the code context, here's what I found:\n\n1. Check for null/undefined values\n2. Verify error handling\n3. Ensure proper type checking\n\nWould you like me to suggest a specific fix?".to_string()
    } else if prompt_lower.contains("explain") {
        "Let me explain this code:\n\nThis appears to be implementing a core functionality. The key components are:\n\n1. **Initialization**: Sets up the required state\n2. **Processing**: Handles the main logic\n3. **Output**: Returns the result\n\nIs there a specific part you'd like me to elaborate on?".to_string()
    } else if prompt_lower.contains("refactor") {
        "Here are some refactoring suggestions:\n\n1. **Extract Method**: Consider breaking this into smaller functions\n2. **Naming**: Variable names could be more descriptive\n3. **Error Handling**: Add proper error types\n\nShall I apply these changes?".to_string()
    } else if prompt_lower.contains("test") {
        "Here's a test structure for this code:\n\n```rust\n#[cfg(test)]\nmod tests {\n    use super::*;\n\n    #[test]\n    fn test_basic_functionality() {\n        // Arrange\n        let input = \"test\";\n        \n        // Act\n        let result = process(input);\n        \n        // Assert\n        assert!(result.is_ok());\n    }\n}\n```\n\nWant me to generate more specific tests?".to_string()
    } else {
        format!("I understand you're asking about: \"{}\"\n\nI can help you with:\n- Fixing bugs\n- Explaining code\n- Refactoring\n- Writing tests\n\nWhat would you like me to do?", 
            prompt.chars().take(100).collect::<String>())
    }
}

/// Model downloader with progress tracking
pub struct ModelDownloader {
    models_dir: PathBuf,
}

impl ModelDownloader {
    pub fn new(models_dir: PathBuf) -> Self {
        Self { models_dir }
    }

    /// Get the path where a model would be stored
    pub fn model_path(&self, model_name: &str) -> PathBuf {
        self.models_dir.join(format!("{}.gguf", model_name))
    }

    /// Check if a model is already downloaded
    pub fn is_model_downloaded(&self, model_name: &str) -> bool {
        self.model_path(model_name).exists()
    }

    /// Download a model from URL with progress callback
    pub async fn download_model<F>(&self, url: &str, model_name: &str, mut progress_callback: F) -> Result<PathBuf>
    where
        F: FnMut(f32) + Send
    {
        let model_path = self.model_path(model_name);
        
        if model_path.exists() {
            log::info!("Model already exists: {:?}", model_path);
            progress_callback(1.0);
            return Ok(model_path);
        }

        // Create models directory if needed
        std::fs::create_dir_all(&self.models_dir)?;

        log::info!("Downloading model from: {}", url);

        // Download with progress
        let response = reqwest::get(url).await?;
        let total_size = response.content_length().unwrap_or(0);
        
        let mut downloaded = 0u64;
        let mut file = std::fs::File::create(&model_path)?;
        let mut stream = response.bytes_stream();
        use futures_util::StreamExt;

        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            std::io::copy(&mut chunk.as_ref(), &mut file)?;
            downloaded += chunk.len() as u64;
            
            if total_size > 0 {
                let progress = downloaded as f32 / total_size as f32;
                progress_callback(progress);
            }
        }

        log::info!("Model downloaded to: {:?}", model_path);
        Ok(model_path)
    }
}

/// Default model URLs
pub const DEFAULT_MODELS: &[(&str, &str, usize)] = &[
    // (name, url, size_mb)
    ("phi-3.5-mini-q4", "https://huggingface.co/microsoft/Phi-3.5-mini-instruct-gguf/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf", 2_200),
    ("qwen2.5-3b-q4", "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf", 2_000),
    ("tinyllama-1.1b-q4", "https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf", 700),
];

/// Get recommended model for hardware
pub fn get_recommended_model(hardware: &HardwareCapabilities) -> &'static str {
    match hardware.recommended_tier {
        MemoryTier::High12GB => "phi-3.5-mini-q4",
        MemoryTier::Medium8GB => "phi-3.5-mini-q4",
        MemoryTier::Low4GB => "tinyllama-1.1b-q4",
        MemoryTier::Cpu => "tinyllama-1.1b-q4",
    }
}
