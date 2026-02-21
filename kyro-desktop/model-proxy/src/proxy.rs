//! Model Proxy - Core proxy implementation

pub mod router;
pub mod memory;

use anyhow::Result;
use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, debug};

/// Proxy configuration
#[derive(Debug, Clone)]
pub struct ProxyConfig {
    pub ram_budget_mb: u64,
    pub model_dir: String,
    pub ollama_host: String,
    pub enable_external: bool,
}

/// Model status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ModelStatus {
    Unloaded,
    Loading,
    Loaded,
    Error,
}

/// Model information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    pub model_type: String,
    pub size_mb: u64,
    pub status: ModelStatus,
    pub loaded_at: Option<String>,
    pub memory_usage_mb: u64,
}

/// Inference request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceRequest {
    pub model: String,
    pub prompt: String,
    #[serde(default)]
    pub max_tokens: usize,
    #[serde(default = "default_temperature")]
    pub temperature: f32,
    #[serde(default)]
    pub stream: bool,
}

fn default_temperature() -> f32 { 0.7 }

/// Inference response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceResponse {
    pub model: String,
    pub content: String,
    pub tokens_used: usize,
    pub latency_ms: u64,
}

/// Model proxy
pub struct ModelProxy {
    config: ProxyConfig,
    models: Arc<RwLock<HashMap<String, ModelInfo>>>,
    memory: memory::MemoryGovernor,
    router: router::ModelRouter,
}

impl ModelProxy {
    pub fn new(config: ProxyConfig) -> Result<Self> {
        let memory = memory::MemoryGovernor::new(config.ram_budget_mb);
        let router = router::ModelRouter::new(&config);

        // Register default models
        let models = Arc::new(RwLock::new(HashMap::new()));
        
        {
            let mut m = models.blocking_write();
            
            // Router model (MobileBERT)
            m.insert("mobilebert".to_string(), ModelInfo {
                name: "mobilebert".to_string(),
                model_type: "router".to_string(),
                size_mb: 100,
                status: ModelStatus::Unloaded,
                loaded_at: None,
                memory_usage_mb: 0,
            });

            // Completion model (DistilGPT-2)
            m.insert("distilgpt2".to_string(), ModelInfo {
                name: "distilgpt2".to_string(),
                model_type: "completion".to_string(),
                size_mb: 250,
                status: ModelStatus::Unloaded,
                loaded_at: None,
                memory_usage_mb: 0,
            });

            // Reasoning model (TinyLlama 1.1B)
            m.insert("tinyllama-1.1b".to_string(), ModelInfo {
                name: "tinyllama-1.1b".to_string(),
                model_type: "reasoning".to_string(),
                size_mb: 1100,
                status: ModelStatus::Unloaded,
                loaded_at: None,
                memory_usage_mb: 0,
            });
        }

        Ok(Self {
            config,
            models,
            memory,
            router,
        })
    }

    /// Load a model
    pub async fn load_model(&self, name: &str) -> Result<()> {
        let mut models = self.models.write().await;
        
        if let Some(model) = models.get_mut(name) {
            if model.status == ModelStatus::Loaded {
                return Ok(());
            }

            // Check memory budget
            if !self.memory.can_allocate(model.size_mb).await {
                warn!(
                    model = %name,
                    size_mb = model.size_mb,
                    "Cannot load model - memory budget exceeded"
                );

                // Try to swap out less-used models
                self.memory.request_swap(model.size_mb).await?;
            }

            info!(model = %name, "Loading model");
            model.status = ModelStatus::Loading;

            // Simulate loading (would integrate with actual model runtime)
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

            model.status = ModelStatus::Loaded;
            model.loaded_at = Some(chrono::Utc::now().to_rfc3339());
            model.memory_usage_mb = model.size_mb;

            self.memory.allocate(model.size_mb).await?;

            info!(model = %name, memory_mb = model.size_mb, "Model loaded");
        }

        Ok(())
    }

    /// Unload a model
    pub async fn unload_model(&self, name: &str) -> Result<()> {
        let mut models = self.models.write().await;

        if let Some(model) = models.get_mut(name) {
            if model.status != ModelStatus::Loaded {
                return Ok(());
            }

            info!(model = %name, "Unloading model");
            
            self.memory.free(model.memory_usage_mb).await;
            
            model.status = ModelStatus::Unloaded;
            model.loaded_at = None;
            model.memory_usage_mb = 0;

            info!(model = %name, "Model unloaded");
        }

        Ok(())
    }

    /// Run inference
    pub async fn infer(&self, request: InferenceRequest) -> Result<InferenceResponse> {
        let start = std::time::Instant::now();

        // Route to appropriate model if not specified
        let model_name = if request.model.is_empty() {
            self.router.route(&request.prompt).await
        } else {
            request.model.clone()
        };

        // Ensure model is loaded
        {
            let models = self.models.read().await;
            if let Some(model) = models.get(&model_name) {
                if model.status != ModelStatus::Loaded {
                    drop(models);
                    self.load_model(&model_name).await?;
                }
            }
        }

        // Run inference (would integrate with actual model runtime)
        debug!(model = %model_name, prompt_len = request.prompt.len(), "Running inference");

        // Simulate inference
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

        let latency = start.elapsed().as_millis() as u64;

        Ok(InferenceResponse {
            model: model_name,
            content: format!("Response to: {}", request.prompt.chars().take(50).collect::<String>()),
            tokens_used: request.prompt.len() / 4 + 50,
            latency_ms: latency,
        })
    }

    /// Get model info
    pub async fn get_model_info(&self, name: &str) -> Option<ModelInfo> {
        let models = self.models.read().await;
        models.get(name).cloned()
    }

    /// List all models
    pub async fn list_models(&self) -> Vec<ModelInfo> {
        let models = self.models.read().await;
        models.values().cloned().collect()
    }

    /// Get memory status
    pub async fn memory_status(&self) -> memory::MemoryStatus {
        self.memory.status().await
    }
}
