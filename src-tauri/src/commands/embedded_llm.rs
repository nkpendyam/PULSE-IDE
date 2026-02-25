//! Embedded LLM commands for KRO_IDE
//!
//! These commands provide direct access to the embedded LLM engine
//! without requiring Ollama installation.

use crate::embedded_llm::{EmbeddedLLMEngine, EmbeddedLLMConfig, InferenceRequest, InferenceResponse, HardwareCapabilities, ModelStatus};
use tauri::command;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Embedded LLM state wrapper
pub struct EmbeddedLLMState {
    pub engine: Option<Arc<RwLock<EmbeddedLLMEngine>>>,
    pub hardware: HardwareCapabilities,
}

impl Default for EmbeddedLLMState {
    fn default() -> Self {
        Self {
            engine: None,
            hardware: HardwareCapabilities {
                vram_bytes: 0,
                ram_bytes: 0,
                gpu_name: None,
                gpu_compute_capability: None,
                recommended_backend: "cpu".to_string(),
                recommended_tier: crate::embedded_llm::MemoryTier::Cpu,
                cpu_cores: num_cpus::get(),
                cpu_features: vec![],
            },
        }
    }
}

/// Hardware info for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareInfo {
    pub gpu_name: Option<String>,
    pub vram_gb: f32,
    pub ram_gb: f32,
    pub cpu_cores: usize,
    pub backend: String,
    pub memory_tier: String,
    pub recommended_model: String,
}

/// Model info for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalModelInfo {
    pub name: String,
    pub size_mb: u64,
    pub downloaded: bool,
    pub loaded: bool,
    pub quantization: String,
    pub min_memory_tier: String,
}

/// Completion options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionOptions {
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
    pub top_p: Option<f32>,
    pub top_k: Option<u32>,
    pub stop_sequences: Option<Vec<String>>,
    pub stream: Option<bool>,
}

impl Default for CompletionOptions {
    fn default() -> Self {
        Self {
            max_tokens: Some(512),
            temperature: Some(0.7),
            top_p: Some(0.9),
            top_k: Some(40),
            stop_sequences: None,
            stream: Some(false),
        }
    }
}

/// Get hardware capabilities
#[command]
pub async fn get_hardware_info(state: tauri::State<'_, Arc<RwLock<EmbeddedLLMState>>>) -> Result<HardwareInfo, String> {
    let state = state.read().await;
    let hw = &state.hardware;
    
    Ok(HardwareInfo {
        gpu_name: hw.gpu_name.clone(),
        vram_gb: hw.vram_bytes as f32 / (1024.0 * 1024.0 * 1024.0),
        ram_gb: hw.ram_bytes as f32 / (1024.0 * 1024.0 * 1024.0),
        cpu_cores: hw.cpu_cores,
        backend: hw.recommended_backend.clone(),
        memory_tier: format!("{:?}", hw.recommended_tier),
        recommended_model: hw.recommended_tier.recommended_models()
            .first()
            .map(|s| s.to_string())
            .unwrap_or_else(|| "phi-2b-q4_k_m".to_string()),
    })
}

/// Initialize embedded LLM engine
#[command]
pub async fn init_embedded_llm(
    state: tauri::State<'_, Arc<RwLock<EmbeddedLLMState>>>,
    model_name: Option<String>,
) -> Result<String, String> {
    let mut state = state.write().await;
    
    let model = model_name.unwrap_or_else(|| {
        state.hardware.recommended_tier.recommended_models()
            .first()
            .map(|s| s.to_string())
            .unwrap_or_else(|| "phi-2b-q4_k_m".to_string())
    });
    
    let config = EmbeddedLLMConfig {
        default_model: model.clone(),
        max_vram_mb: (state.hardware.vram_bytes / (1024 * 1024)) * 80 / 100,
        context_size: state.hardware.recommended_tier.recommended_context_size(),
        n_gpu_layers: state.hardware.recommended_tier.gpu_layers(),
        ..Default::default()
    };
    
    match EmbeddedLLMEngine::new(config).await {
        Ok(engine) => {
            state.engine = Some(Arc::new(RwLock::new(engine)));
            Ok(format!("Embedded LLM initialized with model: {}", model))
        }
        Err(e) => Err(format!("Failed to initialize embedded LLM: {}", e)),
    }
}

/// Load a model
#[command]
pub async fn load_model(
    state: tauri::State<'_, Arc<RwLock<EmbeddedLLMState>>>,
    model_name: String,
) -> Result<String, String> {
    let state = state.read().await;
    
    if let Some(ref engine) = state.engine {
        let mut engine = engine.write().await;
        engine.load_model(&model_name).await
            .map(|_| format!("Model {} loaded successfully", model_name))
            .map_err(|e| format!("Failed to load model: {}", e))
    } else {
        Err("Embedded LLM not initialized. Call init_embedded_llm first.".to_string())
    }
}

/// Unload a model
#[command]
pub async fn unload_model(
    state: tauri::State<'_, Arc<RwLock<EmbeddedLLMState>>>,
    model_name: String,
) -> Result<String, String> {
    let state = state.read().await;
    
    if let Some(ref engine) = state.engine {
        let mut engine = engine.write().await;
        engine.unload_model(&model_name).await
            .map(|_| format!("Model {} unloaded", model_name))
            .map_err(|e| format!("Failed to unload model: {}", e))
    } else {
        Err("Embedded LLM not initialized".to_string())
    }
}

/// List available models
#[command]
pub async fn list_local_models(
    state: tauri::State<'_, Arc<RwLock<EmbeddedLLMState>>>,
) -> Result<Vec<LocalModelInfo>, String> {
    let state = state.read().await;
    
    if let Some(ref engine) = state.engine {
        let engine = engine.read().await;
        let loaded = engine.loaded_models().await;
        
        // Return recommended models for the memory tier
        let recommended = state.hardware.recommended_tier.recommended_models();
        
        Ok(recommended.iter().map(|name| {
            let is_loaded = loaded.iter().any(|m| &m.name == name);
            LocalModelInfo {
                name: name.to_string(),
                size_mb: estimate_model_size(name),
                downloaded: true, // Would check actual download status
                loaded: is_loaded,
                quantization: "Q4_K_M".to_string(),
                min_memory_tier: get_min_tier(name),
            }
        }).collect())
    } else {
        // Return default models without loaded status
        let recommended = state.hardware.recommended_tier.recommended_models();
        Ok(recommended.iter().map(|name| {
            LocalModelInfo {
                name: name.to_string(),
                size_mb: estimate_model_size(name),
                downloaded: false,
                loaded: false,
                quantization: "Q4_K_M".to_string(),
                min_memory_tier: get_min_tier(name),
            }
        }).collect())
    }
}

/// Generate completion using embedded LLM
#[command]
pub async fn embedded_complete(
    state: tauri::State<'_, Arc<RwLock<EmbeddedLLMState>>>,
    prompt: String,
    options: Option<CompletionOptions>,
) -> Result<InferenceResponse, String> {
    let state = state.read().await;
    
    let opts = options.unwrap_or_default();
    
    if let Some(ref engine) = state.engine {
        let engine = engine.read().await;
        
        let request = InferenceRequest {
            prompt,
            max_tokens: opts.max_tokens.unwrap_or(512),
            temperature: opts.temperature.unwrap_or(0.7),
            top_p: opts.top_p.unwrap_or(0.9),
            top_k: opts.top_k.unwrap_or(40),
            repeat_penalty: 1.1,
            stop_sequences: opts.stop_sequences.unwrap_or_default(),
            stream: false,
            system_prompt: None,
            history: vec![],
        };
        
        engine.complete(&request).await
            .map_err(|e| format!("Completion failed: {}", e))
    } else {
        Err("Embedded LLM not initialized. Call init_embedded_llm first.".to_string())
    }
}

/// Chat completion with embedded LLM
#[command]
pub async fn embedded_chat(
    state: tauri::State<'_, Arc<RwLock<EmbeddedLLMState>>>,
    messages: Vec<crate::commands::ai::ChatMessage>,
    options: Option<CompletionOptions>,
) -> Result<String, String> {
    let state = state.read().await;
    let opts = options.unwrap_or_default();
    
    if let Some(ref engine) = state.engine {
        let engine = engine.read().await;
        
        // Convert messages to prompt
        let mut prompt = String::new();
        for msg in messages {
            prompt.push_str(&format!("{}: {}\n", msg.role.to_uppercase(), msg.content));
        }
        prompt.push_str("ASSISTANT:");
        
        let request = InferenceRequest {
            prompt,
            max_tokens: opts.max_tokens.unwrap_or(512),
            temperature: opts.temperature.unwrap_or(0.7),
            top_p: opts.top_p.unwrap_or(0.9),
            top_k: opts.top_k.unwrap_or(40),
            repeat_penalty: 1.1,
            stop_sequences: opts.stop_sequences.unwrap_or_else(|| vec!["USER:".to_string()]),
            stream: false,
            system_prompt: None,
            history: vec![],
        };
        
        let response = engine.complete(&request).await
            .map_err(|e| format!("Chat completion failed: {}", e))?;
        
        Ok(response.text)
    } else {
        Err("Embedded LLM not initialized. Call init_embedded_llm first.".to_string())
    }
}

/// Code completion with embedded LLM
#[command]
pub async fn embedded_code_complete(
    state: tauri::State<'_, Arc<RwLock<EmbeddedLLMState>>>,
    code: String,
    language: String,
    cursor_position: Option<usize>,
    options: Option<CompletionOptions>,
) -> Result<String, String> {
    let opts = options.unwrap_or_default();
    
    let system_prompt = "You are an expert code completion AI. Complete the code following best practices. Only output the completion, not the entire code.";
    
    let prompt = format!(
        "Complete this {} code at cursor position {}:\n\n```\n{}\n```\n\nCompletion:",
        language,
        cursor_position.unwrap_or(code.len()),
        code
    );
    
    let state = state.read().await;
    
    if let Some(ref engine) = state.engine {
        let engine = engine.read().await;
        
        let request = InferenceRequest {
            prompt,
            max_tokens: opts.max_tokens.unwrap_or(256),
            temperature: opts.temperature.unwrap_or(0.3), // Lower temp for code
            top_p: opts.top_p.unwrap_or(0.9),
            top_k: opts.top_k.unwrap_or(40),
            repeat_penalty: 1.1,
            stop_sequences: vec!["\n\n".to_string(), "```".to_string()],
            stream: false,
            system_prompt: Some(system_prompt.to_string()),
            history: vec![],
        };
        
        let response = engine.complete(&request).await
            .map_err(|e| format!("Code completion failed: {}", e))?;
        
        Ok(response.text.trim().to_string())
    } else {
        Err("Embedded LLM not initialized".to_string())
    }
}

/// Check if embedded LLM is available
#[command]
pub async fn is_embedded_llm_ready(
    state: tauri::State<'_, Arc<RwLock<EmbeddedLLMState>>>,
) -> Result<bool, String> {
    let state = state.read().await;
    Ok(state.engine.is_some())
}

/// Get loaded models
#[command]
pub async fn get_loaded_models(
    state: tauri::State<'_, Arc<RwLock<EmbeddedLLMState>>>,
) -> Result<Vec<ModelStatus>, String> {
    let state = state.read().await;
    
    if let Some(ref engine) = state.engine {
        let engine = engine.read().await;
        Ok(engine.loaded_models().await)
    } else {
        Ok(vec![])
    }
}

// Helper functions

fn estimate_model_size(name: &str) -> u64 {
    if name.contains("2b") || name.contains("1.1b") {
        1500 // ~1.5GB for 2B models
    } else if name.contains("4b") || name.contains("3b") {
        2500 // ~2.5GB for 4B models
    } else if name.contains("7b") || name.contains("8b") || name.contains("9b") {
        5000 // ~5GB for 7-9B models
    } else if name.contains("14b") || name.contains("13b") {
        8000 // ~8GB for 14B models
    } else {
        4000 // Default ~4GB
    }
}

fn get_min_tier(name: &str) -> String {
    if name.contains("2b") || name.contains("1.1b") {
        "CPU".to_string()
    } else if name.contains("4b") || name.contains("3b") {
        "4GB".to_string()
    } else if name.contains("7b") || name.contains("8b") || name.contains("9b") {
        "8GB".to_string()
    } else if name.contains("14b") || name.contains("13b") {
        "16GB".to_string()
    } else {
        "8GB".to_string()
    }
}
