//! Embedded LLM Engine for KRO_IDE
//!
//! This module provides zero-dependency local AI inference by embedding
//! llama.cpp directly into the binary. No Ollama, no external services.
//!
//! ## Features
//! - Static linking with llama.cpp (no external dependencies)
//! - Multiple GPU backends: CUDA, Metal, Vulkan, CPU
//! - Automatic hardware detection and optimal backend selection
//! - Tiered model loading based on available VRAM
//! - Hot-swappable models without restart
//!
//! ## Memory Model (8GB VRAM constraint)
//! - Model weights (Q4_K_M): ~4.5GB
//! - KV cache (8K context): ~2GB
//! - System overhead: ~1GB
//! - Total: ~7.5GB (safe headroom)

pub mod engine;
pub mod backends;
pub mod model_manager;
pub mod memory_tiers;
pub mod context_cache;
pub mod real_inference;

pub use engine::EmbeddedLLMEngine;
pub use backends::{InferenceBackend, BackendCapabilities};
pub use model_manager::{ModelManager, ModelSpec, Quantization};
pub use memory_tiers::{MemoryTier, MemoryProfiler};
pub use context_cache::{ContextCache, CachedContext};
pub use real_inference::{RealLlamaBackend, ModelDownloader, DEFAULT_MODELS, get_recommended_model};

use serde::{Deserialize, Serialize};

/// Global configuration for embedded LLM
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddedLLMConfig {
    /// Enable GPU acceleration
    pub enable_gpu: bool,
    /// Preferred backend (auto-detected if None)
    pub preferred_backend: Option<String>,
    /// Maximum VRAM to use (in MB)
    pub max_vram_mb: u64,
    /// Context window size
    pub context_size: u32,
    /// Number of GPU layers to offload
    pub n_gpu_layers: i32,
    /// Number of threads for CPU inference
    pub n_threads: i32,
    /// Enable memory mapping for large models
    pub use_mmap: bool,
    /// Enable memory locking (prevent swap)
    pub use_mlock: bool,
    /// Model search paths
    pub model_paths: Vec<String>,
    /// Default model for code completion
    pub default_model: String,
    /// Enable speculative decoding
    pub enable_speculative: bool,
    /// Draft model for speculative decoding
    pub draft_model: Option<String>,
}

impl Default for EmbeddedLLMConfig {
    fn default() -> Self {
        Self {
            enable_gpu: true,
            preferred_backend: None,
            max_vram_mb: 6144, // 6GB safe limit
            context_size: 8192,
            n_gpu_layers: 35,
            n_threads: 4,
            use_mmap: true,
            use_mlock: false,
            model_paths: vec![
                "~/.local/share/kro_ide/models".to_string(),
                "./models".to_string(),
            ],
            default_model: "qwen3-4b-q4_k_m".to_string(),
            enable_speculative: true,
            draft_model: Some("phi-2b-q4_k_m".to_string()),
        }
    }
}

/// Inference request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceRequest {
    /// The prompt to complete
    pub prompt: String,
    /// Maximum tokens to generate
    pub max_tokens: u32,
    /// Temperature (0.0 - 2.0)
    pub temperature: f32,
    /// Top-p sampling
    pub top_p: f32,
    /// Top-k sampling
    pub top_k: u32,
    /// Repeat penalty
    pub repeat_penalty: f32,
    /// Stop sequences
    pub stop_sequences: Vec<String>,
    /// Whether to stream output
    pub stream: bool,
    /// System prompt (for chat models)
    pub system_prompt: Option<String>,
    /// Conversation history
    pub history: Vec<ConversationTurn>,
}

impl Default for InferenceRequest {
    fn default() -> Self {
        Self {
            prompt: String::new(),
            max_tokens: 512,
            temperature: 0.7,
            top_p: 0.9,
            top_k: 40,
            repeat_penalty: 1.1,
            stop_sequences: vec![],
            stream: false,
            system_prompt: None,
            history: vec![],
        }
    }
}

/// Inference response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceResponse {
    /// Generated text
    pub text: String,
    /// Number of tokens generated
    pub tokens_generated: u32,
    /// Time to first token (ms)
    pub time_to_first_token_ms: u64,
    /// Total inference time (ms)
    pub total_time_ms: u64,
    /// Tokens per second
    pub tokens_per_second: f32,
    /// Model used
    pub model: String,
    /// Whether response was from cache
    pub from_cache: bool,
    /// Memory used (bytes)
    pub memory_used: u64,
}

/// Conversation turn for chat models
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationTurn {
    pub role: String,
    pub content: String,
}

/// Model loading status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelStatus {
    pub name: String,
    pub loaded: bool,
    pub loading_progress: f32,
    pub memory_used_mb: u64,
    pub backend: String,
    pub context_size: u32,
}

/// Hardware capabilities detected at runtime
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareCapabilities {
    /// Available VRAM in bytes
    pub vram_bytes: u64,
    /// Available system RAM in bytes
    pub ram_bytes: u64,
    /// GPU name if available
    pub gpu_name: Option<String>,
    /// GPU compute capability
    pub gpu_compute_capability: Option<String>,
    /// Recommended backend
    pub recommended_backend: String,
    /// Recommended memory tier
    pub recommended_tier: MemoryTier,
    /// Number of CPU cores
    pub cpu_cores: usize,
    /// CPU features (AVX2, AVX512, etc.)
    pub cpu_features: Vec<String>,
}
