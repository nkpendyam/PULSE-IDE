//! Model Registry for managing available models
//!
//! This module handles model discovery, download, and management
//! for both local and distributed inference.

use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::fs;

/// Model registry for discovering and managing models
pub struct ModelRegistry {
    models_dir: PathBuf,
    registered_models: HashMap<String, ModelMetadata>,
    recommended_models: Vec<RecommendedModel>,
}

/// Model metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelMetadata {
    pub name: String,
    pub display_name: String,
    pub description: String,
    pub size_bytes: u64,
    pub quantization: String,
    pub context_length: u32,
    pub recommended_memory_gb: f32,
    pub supports_gpu: bool,
    pub supports_cpu: bool,
    pub huggingface_url: Option<String>,
    pub ollama_name: Option<String>,
    pub is_downloaded: bool,
    pub local_path: Option<PathBuf>,
    pub tags: Vec<String>,
    pub benchmark_results: Option<BenchmarkResults>,
}

/// Benchmark results for a model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkResults {
    pub tokens_per_second: f32,
    pub first_token_latency_ms: u32,
    pub memory_usage_gb: f32,
    pub quality_score: f32,
}

/// Recommended model configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecommendedModel {
    pub model_name: String,
    pub use_case: String,
    pub min_ram_gb: f32,
    pub min_gpu_ram_gb: Option<f32>,
    pub priority: u8,
}

impl ModelRegistry {
    /// Create a new model registry
    pub fn new() -> Result<Self> {
        let models_dir = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("kyro-ide")
            .join("models");

        let mut registry = Self {
            models_dir,
            registered_models: HashMap::new(),
            recommended_models: Vec::new(),
        };

        registry.load_registered_models();
        registry.load_recommended_models();

        Ok(registry)
    }

    /// Load registered models
    fn load_registered_models(&mut self) {
        // Pre-registered models with HuggingFace URLs
        let models = vec![
            ModelMetadata {
                name: "codellama-7b-instruct-q4".to_string(),
                display_name: "CodeLlama 7B Instruct (Q4)".to_string(),
                description: "Code-specialized Llama model, 7B parameters, 4-bit quantization. Great for code completion and generation.".to_string(),
                size_bytes: 4_000_000_000,
                quantization: "Q4_K_M".to_string(),
                context_length: 16384,
                recommended_memory_gb: 5.0,
                supports_gpu: true,
                supports_cpu: true,
                huggingface_url: Some("https://huggingface.co/TheBloke/CodeLlama-7B-Instruct-GGUF/resolve/main/codellama-7b-instruct.Q4_K_M.gguf".to_string()),
                ollama_name: Some("codellama:7b-instruct".to_string()),
                is_downloaded: false,
                local_path: None,
                tags: vec!["code".to_string(), "python".to_string(), "javascript".to_string()],
                benchmark_results: Some(BenchmarkResults {
                    tokens_per_second: 25.0,
                    first_token_latency_ms: 500,
                    memory_usage_gb: 4.5,
                    quality_score: 0.85,
                }),
            },
            ModelMetadata {
                name: "codellama-13b-instruct-q4".to_string(),
                display_name: "CodeLlama 13B Instruct (Q4)".to_string(),
                description: "Larger CodeLlama with better quality, 13B parameters. Requires more RAM.".to_string(),
                size_bytes: 8_000_000_000,
                quantization: "Q4_K_M".to_string(),
                context_length: 16384,
                recommended_memory_gb: 10.0,
                supports_gpu: true,
                supports_cpu: true,
                huggingface_url: Some("https://huggingface.co/TheBloke/CodeLlama-13B-Instruct-GGUF/resolve/main/codellama-13b-instruct.Q4_K_M.gguf".to_string()),
                ollama_name: Some("codellama:13b-instruct".to_string()),
                is_downloaded: false,
                local_path: None,
                tags: vec!["code".to_string(), "quality".to_string()],
                benchmark_results: Some(BenchmarkResults {
                    tokens_per_second: 15.0,
                    first_token_latency_ms: 700,
                    memory_usage_gb: 9.0,
                    quality_score: 0.90,
                }),
            },
            ModelMetadata {
                name: "mistral-7b-instruct-q4".to_string(),
                display_name: "Mistral 7B Instruct (Q4)".to_string(),
                description: "General-purpose instruction model with excellent quality for its size. Fast and efficient.".to_string(),
                size_bytes: 4_000_000_000,
                quantization: "Q4_K_M".to_string(),
                context_length: 8192,
                recommended_memory_gb: 5.0,
                supports_gpu: true,
                supports_cpu: true,
                huggingface_url: Some("https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf".to_string()),
                ollama_name: Some("mistral:7b-instruct".to_string()),
                is_downloaded: false,
                local_path: None,
                tags: vec!["general".to_string(), "fast".to_string()],
                benchmark_results: Some(BenchmarkResults {
                    tokens_per_second: 30.0,
                    first_token_latency_ms: 400,
                    memory_usage_gb: 4.5,
                    quality_score: 0.88,
                }),
            },
            ModelMetadata {
                name: "deepseek-coder-6.7b-instruct-q4".to_string(),
                display_name: "DeepSeek Coder 6.7B (Q4)".to_string(),
                description: "Specialized code model with excellent programming capabilities. Optimized for code understanding.".to_string(),
                size_bytes: 4_000_000_000,
                quantization: "Q4_K_M".to_string(),
                context_length: 16384,
                recommended_memory_gb: 5.0,
                supports_gpu: true,
                supports_cpu: true,
                huggingface_url: Some("https://huggingface.co/TheBloke/deepseek-coder-6.7B-instruct-GGUF/resolve/main/deepseek-coder-6.7b-instruct.Q4_K_M.gguf".to_string()),
                ollama_name: Some("deepseek-coder:6.7b-instruct-q4_K_M".to_string()),
                is_downloaded: false,
                local_path: None,
                tags: vec!["code".to_string(), "specialized".to_string()],
                benchmark_results: Some(BenchmarkResults {
                    tokens_per_second: 28.0,
                    first_token_latency_ms: 450,
                    memory_usage_gb: 4.5,
                    quality_score: 0.92,
                }),
            },
            ModelMetadata {
                name: "tinyllama-1.1b-q4".to_string(),
                display_name: "TinyLlama 1.1B (Q4)".to_string(),
                description: "Ultra-fast tiny model for speculative decoding. Perfect as draft model.".to_string(),
                size_bytes: 700_000_000,
                quantization: "Q4_K_M".to_string(),
                context_length: 2048,
                recommended_memory_gb: 1.0,
                supports_gpu: true,
                supports_cpu: true,
                huggingface_url: Some("https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf".to_string()),
                ollama_name: Some("tinyllama:1.1b".to_string()),
                is_downloaded: false,
                local_path: None,
                tags: vec!["draft".to_string(), "fast".to_string()],
                benchmark_results: Some(BenchmarkResults {
                    tokens_per_second: 80.0,
                    first_token_latency_ms: 100,
                    memory_usage_gb: 0.8,
                    quality_score: 0.65,
                }),
            },
            ModelMetadata {
                name: "phi-3-mini-4k-q4".to_string(),
                display_name: "Phi-3 Mini 4K (Q4)".to_string(),
                description: "Microsoft's compact model with impressive capabilities. Great for resource-constrained environments.".to_string(),
                size_bytes: 2_500_000_000,
                quantization: "Q4_K_M".to_string(),
                context_length: 4096,
                recommended_memory_gb: 3.0,
                supports_gpu: true,
                supports_cpu: true,
                huggingface_url: Some("https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf".to_string()),
                ollama_name: Some("phi3:mini".to_string()),
                is_downloaded: false,
                local_path: None,
                tags: vec!["general".to_string(), "efficient".to_string()],
                benchmark_results: Some(BenchmarkResults {
                    tokens_per_second: 40.0,
                    first_token_latency_ms: 300,
                    memory_usage_gb: 2.5,
                    quality_score: 0.82,
                }),
            },
        ];

        for model in models {
            self.registered_models.insert(model.name.clone(), model);
        }
    }

    /// Load recommended models configuration
    fn load_recommended_models(&mut self) {
        self.recommended_models = vec![
            RecommendedModel {
                model_name: "tinyllama-1.1b-q4".to_string(),
                use_case: "speculative_decoding_draft".to_string(),
                min_ram_gb: 2.0,
                min_gpu_ram_gb: None,
                priority: 1,
            },
            RecommendedModel {
                model_name: "codellama-7b-instruct-q4".to_string(),
                use_case: "code_completion".to_string(),
                min_ram_gb: 6.0,
                min_gpu_ram_gb: Some(5.0),
                priority: 1,
            },
            RecommendedModel {
                model_name: "deepseek-coder-6.7b-instruct-q4".to_string(),
                use_case: "code_generation".to_string(),
                min_ram_gb: 6.0,
                min_gpu_ram_gb: Some(5.0),
                priority: 2,
            },
            RecommendedModel {
                model_name: "mistral-7b-instruct-q4".to_string(),
                use_case: "general_chat".to_string(),
                min_ram_gb: 6.0,
                min_gpu_ram_gb: Some(5.0),
                priority: 1,
            },
            RecommendedModel {
                model_name: "codellama-13b-instruct-q4".to_string(),
                use_case: "high_quality_code".to_string(),
                min_ram_gb: 12.0,
                min_gpu_ram_gb: Some(10.0),
                priority: 2,
            },
        ];
    }

    /// List all available models
    pub async fn list_models(&self) -> Result<Vec<ModelMetadata>> {
        let mut models: Vec<ModelMetadata> = self.registered_models.values().cloned().collect();
        
        // Check which models are downloaded
        for model in &mut models {
            let local_path = self.models_dir.join(format!("{}.gguf", model.name));
            if local_path.exists() {
                model.is_downloaded = true;
                model.local_path = Some(local_path);
            }
        }

        // Sort by quality score
        models.sort_by(|a, b| {
            let score_a = a.benchmark_results.as_ref().map(|b| b.quality_score).unwrap_or(0.0);
            let score_b = b.benchmark_results.as_ref().map(|b| b.quality_score).unwrap_or(0.0);
            score_b.partial_cmp(&score_a).unwrap_or(std::cmp::Ordering::Equal)
        });

        Ok(models)
    }

    /// Get models by use case
    pub fn get_by_use_case(&self, use_case: &str) -> Vec<&ModelMetadata> {
        self.recommended_models
            .iter()
            .filter(|r| r.use_case == use_case)
            .filter_map(|r| self.registered_models.get(&r.model_name))
            .collect()
    }

    /// Get recommended models for system specs
    pub fn get_recommended_for_specs(&self, available_ram_gb: f32, has_gpu: bool) -> Vec<&ModelMetadata> {
        self.recommended_models
            .iter()
            .filter(|r| {
                if r.min_ram_gb > available_ram_gb {
                    return false;
                }
                if let Some(min_gpu) = r.min_gpu_ram_gb {
                    if !has_gpu && min_gpu > 0.0 {
                        return false;
                    }
                }
                true
            })
            .filter_map(|r| self.registered_models.get(&r.model_name))
            .collect()
    }

    /// Get a specific model
    pub fn get_model(&self, name: &str) -> Option<&ModelMetadata> {
        self.registered_models.get(name)
    }

    /// Mark a model as downloaded
    pub async fn mark_downloaded(&mut self, name: &str, path: PathBuf) -> Result<()> {
        if let Some(model) = self.registered_models.get_mut(name) {
            model.is_downloaded = true;
            model.local_path = Some(path);
        }
        Ok(())
    }

    /// Delete a downloaded model
    pub async fn delete_model(&mut self, name: &str) -> Result<()> {
        if let Some(model) = self.registered_models.get_mut(name) {
            if let Some(ref path) = model.local_path {
                fs::remove_file(path).await?;
            }
            model.is_downloaded = false;
            model.local_path = None;
        }
        Ok(())
    }

    /// Get model directory
    pub fn models_dir(&self) -> &PathBuf {
        &self.models_dir
    }
}

impl Default for ModelRegistry {
    fn default() -> Self {
        Self::new().expect("Failed to create model registry")
    }
}
