//! AirLLM Integration Module
//!
//! AirLLM enables running 70B+ models on 4-8GB VRAM through layer-wise inference.
//! This module provides a Python subprocess FFI bridge for AirLLM.
//!
//! ## How it works
//! Instead of loading the entire model into VRAM, AirLLM:
//! 1. Offloads model layers to CPU RAM
//! 2. Loads only the current layer to GPU for computation
//! 3. Dramatically reduces VRAM requirements (70B model on 4GB VRAM)
//!
//! ## Requirements
//! - Python 3.8+
//! - airllm package: `pip install airllm`
//! - CUDA-capable GPU (NVIDIA) or Metal (Apple Silicon)
//!
//! ## Usage
//! ```rust
//! let mut airllm = AirLLMEngine::new(AirLLMConfig::default());
//! airllm.load_model("Llama-2-70b-hf").await?;
//! let result = airllm.generate("Hello, world!").await?;
//! ```

use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::{Command, Stdio, Child};
use std::sync::Arc;
use tokio::sync::{RwLock, Mutex};

/// AirLLM configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AirLLMConfig {
    /// Python executable path (default: system python3)
    pub python_path: PathBuf,
    /// Model name or path (HuggingFace model ID or local path)
    pub model_name: String,
    /// Maximum context length
    pub max_context_length: usize,
    /// Maximum tokens to generate
    pub max_tokens: usize,
    /// Temperature for sampling
    pub temperature: f32,
    /// Top-p sampling
    pub top_p: f32,
    /// GPU memory budget in MB (4GB = 4096)
    pub gpu_memory_budget_mb: usize,
    /// Use quantization (4-bit for extreme memory savings)
    pub quantization: Option<QuantizationType>,
    /// Trust remote code (required for some models)
    pub trust_remote_code: bool,
    /// Device: "cuda", "metal", or "cpu"
    pub device: String,
}

/// Quantization types supported by AirLLM
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum QuantizationType {
    /// 4-bit quantization (maximum memory savings)
    Bit4,
    /// 8-bit quantization
    Bit8,
    /// No quantization
    None,
}

impl Default for AirLLMConfig {
    fn default() -> Self {
        Self {
            python_path: PathBuf::from("python3"),
            model_name: "meta-llama/Llama-2-7b-hf".to_string(),
            max_context_length: 4096,
            max_tokens: 512,
            temperature: 0.7,
            top_p: 0.9,
            gpu_memory_budget_mb: 4096, // 4GB default
            quantization: Some(QuantizationType::Bit4),
            trust_remote_code: true,
            device: "cuda".to_string(),
        }
    }
}

impl AirLLMConfig {
    /// Create config for 70B model on 8GB VRAM
    pub fn for_70b_8gb() -> Self {
        Self {
            model_name: "meta-llama/Llama-2-70b-hf".to_string(),
            gpu_memory_budget_mb: 8192,
            max_context_length: 4096,
            quantization: Some(QuantizationType::Bit4),
            ..Default::default()
        }
    }

    /// Create config for 7B model on 4GB VRAM
    pub fn for_7b_4gb() -> Self {
        Self {
            model_name: "meta-llama/Llama-2-7b-hf".to_string(),
            gpu_memory_budget_mb: 4096,
            max_context_length: 4096,
            quantization: Some(QuantizationType::Bit4),
            ..Default::default()
        }
    }

    /// Create config for Apple Silicon (Metal)
    #[cfg(target_os = "macos")]
    pub fn for_apple_silicon() -> Self {
        Self {
            device: "metal".to_string(),
            gpu_memory_budget_mb: 8192, // Unified memory
            ..Default::default()
        }
    }
}

/// Generation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationRequest {
    pub prompt: String,
    pub max_tokens: Option<usize>,
    pub temperature: Option<f32>,
    pub top_p: Option<f32>,
    pub stop_tokens: Vec<String>,
}

/// Generation response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationResponse {
    pub text: String,
    pub tokens_generated: usize,
    pub time_ms: u64,
    pub tokens_per_second: f32,
    pub model: String,
}

/// Model status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelStatus {
    pub loaded: bool,
    pub model_name: Option<String>,
    pub memory_used_mb: Option<usize>,
    pub device: Option<String>,
}

/// AirLLM Python bridge
pub struct AirLLMEngine {
    config: AirLLMConfig,
    python_process: Option<Arc<Mutex<Child>>>,
    model_loaded: Arc<RwLock<bool>>,
    current_model: Arc<RwLock<Option<String>>>,
}

impl AirLLMEngine {
    /// Create a new AirLLM engine
    pub fn new(config: AirLLMConfig) -> Self {
        Self {
            config,
            python_process: None,
            model_loaded: Arc::new(RwLock::new(false)),
            current_model: Arc::new(RwLock::new(None)),
        }
    }

    /// Check if AirLLM is available (Python + airllm package)
    pub async fn check_availability() -> Result<bool> {
        let output = Command::new("python3")
            .args(["-c", "import airllm; print(airllm.__version__)"])
            .output();

        match output {
            Ok(o) if o.status.success() => {
                log::info!("AirLLM is available: {}", String::from_utf8_lossy(&o.stdout).trim());
                Ok(true)
            }
            _ => {
                log::warn!("AirLLM not available. Install with: pip install airllm");
                Ok(false)
            }
        }
    }

    /// Load a model
    pub async fn load_model(&mut self, model_name: Option<&str>) -> Result<()> {
        let model = model_name.unwrap_or(&self.config.model_name);
        
        log::info!("Loading AirLLM model: {}", model);

        // Start Python process with AirLLM
        let python_script = self.create_loader_script(model)?;
        
        let child = Command::new(&self.config.python_path)
            .args(["-c", &python_script])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .context("Failed to start Python process for AirLLM")?;

        // Wait for model to load
        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;

        *self.model_loaded.write().await = true;
        *self.current_model.write().await = Some(model.to_string());
        self.python_process = Some(Arc::new(Mutex::new(child)));

        log::info!("AirLLM model loaded: {}", model);
        Ok(())
    }

    /// Unload the model
    pub async fn unload_model(&mut self) -> Result<()> {
        if let Some(process) = &self.python_process {
            let mut p = process.lock().await;
            p.kill().ok();
        }
        self.python_process = None;
        *self.model_loaded.write().await = false;
        *self.current_model.write().await = None;
        log::info!("AirLLM model unloaded");
        Ok(())
    }

    /// Generate text
    pub async fn generate(&self, request: GenerationRequest) -> Result<GenerationResponse> {
        let loaded = *self.model_loaded.read().await;
        if !loaded {
            anyhow::bail!("No model loaded. Call load_model() first.");
        }

        let model = self.current_model.read().await.clone().unwrap_or_default();
        let start = std::time::Instant::now();

        // For now, use a simplified approach - direct Python call
        let output = Command::new(&self.config.python_path)
            .args(["-c", &self.create_generation_script(&request)?])
            .output()
            .context("Failed to run AirLLM generation")?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("AirLLM generation failed: {}", stderr);
        }

        let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let tokens = text.split_whitespace().count();
        let elapsed = start.elapsed();

        Ok(GenerationResponse {
            text,
            tokens_generated: tokens,
            time_ms: elapsed.as_millis() as u64,
            tokens_per_second: if elapsed.as_millis() > 0 {
                tokens as f32 / (elapsed.as_millis() as f32 / 1000.0)
            } else {
                0.0
            },
            model,
        })
    }

    /// Get model status
    pub async fn status(&self) -> ModelStatus {
        ModelStatus {
            loaded: *self.model_loaded.read().await,
            model_name: self.current_model.read().await.clone(),
            memory_used_mb: Some(self.config.gpu_memory_budget_mb),
            device: Some(self.config.device.clone()),
        }
    }

    /// Create the Python loader script
    fn create_loader_script(&self, model_name: &str) -> Result<String> {
        let quantization = match &self.config.quantization {
            Some(QuantizationType::Bit4) => "4bit",
            Some(QuantizationType::Bit8) => "8bit",
            _ => "none",
        };

        Ok(format!(r#"
import sys
try:
    from airllm import AutoModelForCausalLM
    
    model = AutoModelForCausalLM.from_pretrained(
        "{model_name}",
        compression="{quantization}",
        trust_remote_code={trust_remote_code}
    )
    print("MODEL_LOADED")
    sys.stdout.flush()
    
    # Keep process alive
    import time
    while True:
        time.sleep(1)
        
except ImportError:
    print("AIRLLM_NOT_INSTALLED", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"ERROR: {{e}}", file=sys.stderr)
    sys.exit(1)
"#,
            model_name = model_name,
            quantization = quantization,
            trust_remote_code = self.config.trust_remote_code
        ))
    }

    /// Create the Python generation script
    fn create_generation_script(&self, request: &GenerationRequest) -> Result<String> {
        let max_tokens = request.max_tokens.unwrap_or(self.config.max_tokens);
        let temperature = request.temperature.unwrap_or(self.config.temperature);

        Ok(format!(r#"
from airllm import AutoModelForCausalLM
from transformers import AutoTokenizer

model_name = "{model_name}"
prompt = '''{prompt}'''

try:
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        compression="{quantization}",
        trust_remote_code={trust_remote_code}
    )
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    
    input_ids = tokenizer.encode(prompt, return_tensors="pt")
    
    outputs = model.generate(
        input_ids,
        max_new_tokens={max_tokens},
        temperature={temperature},
        top_p={top_p},
        do_sample=True
    )
    
    generated = tokenizer.decode(outputs[0][input_ids.shape[1]:], skip_special_tokens=True)
    print(generated)
    
except Exception as e:
    print(f"ERROR: {{e}}", file=__import__('sys').stderr)
    __import__('sys').exit(1)
"#,
            model_name = self.config.model_name,
            prompt = request.prompt.replace("'", "'\\''"),
            quantization = match &self.config.quantization {
                Some(QuantizationType::Bit4) => "4bit",
                Some(QuantizationType::Bit8) => "8bit",
                _ => "none",
            },
            trust_remote_code = self.config.trust_remote_code,
            max_tokens = max_tokens,
            temperature = temperature,
            top_p = self.config.top_p
        ))
    }
}

/// AirLLM Tauri commands
pub mod commands {
    use super::*;
    use tauri::State;
    use std::sync::Mutex as StdMutex;

    /// Global AirLLM state
    pub struct AirLLMState(pub StdMutex<Option<AirLLMEngine>>);

    /// Check AirLLM availability
    #[tauri::command]
    pub async fn airllm_check_availability() -> Result<bool, String> {
        AirLLMEngine::check_availability().await.map_err(|e| e.to_string())
    }

    /// Get AirLLM configuration
    #[tauri::command]
    pub fn airllm_get_config() -> AirLLMConfig {
        AirLLMConfig::default()
    }

    /// Load AirLLM model
    #[tauri::command]
    pub async fn airllm_load_model(
        state: State<'_, AirLLMState>,
        model_name: Option<String>,
        config: Option<AirLLMConfig>,
    ) -> Result<(), String> {
        let mut engine_opt = state.0.lock().map_err(|e| e.to_string())?;
        
        let config = config.unwrap_or_default();
        let mut engine = AirLLMEngine::new(config);
        
        engine.load_model(model_name.as_deref()).await
            .map_err(|e| e.to_string())?;
        
        *engine_opt = Some(engine);
        Ok(())
    }

    /// Unload AirLLM model
    #[tauri::command]
    pub async fn airllm_unload_model(
        state: State<'_, AirLLMState>,
    ) -> Result<(), String> {
        let mut engine_opt = state.0.lock().map_err(|e| e.to_string())?;
        
        if let Some(engine) = engine_opt.as_mut() {
            engine.unload_model().await.map_err(|e| e.to_string())?;
        }
        *engine_opt = None;
        Ok(())
    }

    /// Generate text with AirLLM
    #[tauri::command]
    pub async fn airllm_generate(
        state: State<'_, AirLLMState>,
        request: GenerationRequest,
    ) -> Result<GenerationResponse, String> {
        let engine_opt = state.0.lock().map_err(|e| e.to_string())?;
        
        let engine = engine_opt.as_ref()
            .ok_or_else(|| "No model loaded".to_string())?;
        
        engine.generate(request).await.map_err(|e| e.to_string())
    }

    /// Get AirLLM status
    #[tauri::command]
    pub async fn airllm_get_status(
        state: State<'_, AirLLMState>,
    ) -> Result<ModelStatus, String> {
        let engine_opt = state.0.lock().map_err(|e| e.to_string())?;
        
        match engine_opt.as_ref() {
            Some(engine) => Ok(engine.status().await),
            None => Ok(ModelStatus {
                loaded: false,
                model_name: None,
                memory_used_mb: None,
                device: None,
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_defaults() {
        let config = AirLLMConfig::default();
        assert_eq!(config.max_context_length, 4096);
        assert!(config.quantization.is_some());
    }

    #[test]
    fn test_70b_config() {
        let config = AirLLMConfig::for_70b_8gb();
        assert_eq!(config.gpu_memory_budget_mb, 8192);
        assert!(config.model_name.contains("70b"));
    }
}
