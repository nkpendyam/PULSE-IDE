//! Swarm AI Engine for KYRO IDE
//!
//! This module provides distributed AI inference capabilities:
//! - Local LLM inference via llama.cpp integration
//! - Speculative decoding (tiny model drafts, big model verifies)
//! - P2P layer sharing for running 70B models across devices
//! - Aggressive KV caching for fast responses

pub mod local_inference;
pub mod speculative_decoder;
pub mod kv_cache;
pub mod p2p_swarm;
pub mod model_registry;
pub mod agents;

pub use local_inference::LocalInferenceEngine;
pub use speculative_decoder::SpeculativeDecoder;
pub use kv_cache::KVCache;
pub use p2p_swarm::P2PSwarm;
pub use model_registry::ModelRegistry;
pub use agents::AgentOrchestrator;

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use anyhow::Result;

/// Configuration for the Swarm AI engine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwarmConfig {
    /// Enable local inference (llama.cpp)
    pub enable_local: bool,
    /// Enable speculative decoding
    pub enable_speculative: bool,
    /// Enable P2P layer sharing
    pub enable_p2p: bool,
    /// Maximum memory for models (in GB)
    pub max_memory_gb: f32,
    /// Default model for code completion
    pub default_model: String,
    /// Draft model for speculative decoding
    pub draft_model: Option<String>,
    /// Number of P2P peers required for distributed inference
    pub min_p2p_peers: usize,
}

impl Default for SwarmConfig {
    fn default() -> Self {
        Self {
            enable_local: true,
            enable_speculative: true,
            enable_p2p: false,
            max_memory_gb: 8.0,
            default_model: "codellama:7b-instruct-q4_K_M".to_string(),
            draft_model: Some("tinyllama:1.1b-q4_K_M".to_string()),
            min_p2p_peers: 2,
        }
    }
}

/// Main Swarm AI Engine
pub struct SwarmAIEngine {
    config: SwarmConfig,
    local_engine: Option<Arc<RwLock<LocalInferenceEngine>>>,
    speculative_decoder: Option<Arc<RwLock<SpeculativeDecoder>>>,
    kv_cache: Arc<RwLock<KVCache>>,
    p2p_swarm: Option<Arc<RwLock<P2PSwarm>>>,
    model_registry: Arc<RwLock<ModelRegistry>>,
    agent_orchestrator: Arc<RwLock<AgentOrchestrator>>,
}

impl SwarmAIEngine {
    /// Create a new Swarm AI engine
    pub async fn new(config: SwarmConfig) -> Result<Self> {
        let kv_cache = Arc::new(RwLock::new(KVCache::new(1000))); // 1000 entries max
        let model_registry = Arc::new(RwLock::new(ModelRegistry::new()?));
        let agent_orchestrator = Arc::new(RwLock::new(AgentOrchestrator::new()));

        // Initialize local inference engine if enabled
        let local_engine = if config.enable_local {
            let engine = LocalInferenceEngine::new(
                config.default_model.clone(),
                config.max_memory_gb,
            ).await?;
            Some(Arc::new(RwLock::new(engine)))
        } else {
            None
        };

        // Initialize speculative decoder if enabled
        let speculative_decoder = if config.enable_speculative && local_engine.is_some() {
            if let Some(ref draft_model) = config.draft_model {
                let decoder = SpeculativeDecoder::new(
                    draft_model.clone(),
                    config.default_model.clone(),
                ).await?;
                Some(Arc::new(RwLock::new(decoder)))
            } else {
                None
            }
        } else {
            None
        };

        // Initialize P2P swarm if enabled
        let p2p_swarm = if config.enable_p2p {
            let swarm = P2PSwarm::new(config.min_p2p_peers).await?;
            Some(Arc::new(RwLock::new(swarm)))
        } else {
            None
        };

        Ok(Self {
            config,
            local_engine,
            speculative_decoder,
            kv_cache,
            p2p_swarm,
            model_registry,
            agent_orchestrator,
        })
    }

    /// Generate completion using the best available method
    pub async fn complete(&self, prompt: &str, max_tokens: u32) -> Result<String> {
        // Check KV cache first
        {
            let cache = self.kv_cache.read().await;
            if let Some(cached) = cache.get(prompt) {
                return Ok(cached);
            }
        }

        // Try speculative decoding first (fastest)
        if let Some(ref decoder) = self.speculative_decoder {
            let mut decoder = decoder.write().await;
            let result = decoder.complete(prompt, max_tokens).await?;
            
            // Cache the result
            self.kv_cache.write().await.insert(prompt.to_string(), result.clone());
            return Ok(result);
        }

        // Fall back to local inference
        if let Some(ref engine) = self.local_engine {
            let mut engine = engine.write().await;
            let result = engine.complete(prompt, max_tokens).await?;
            
            // Cache the result
            self.kv_cache.write().await.insert(prompt.to_string(), result.clone());
            return Ok(result);
        }

        // Fall back to P2P distributed inference
        if let Some(ref swarm) = self.p2p_swarm {
            let mut swarm = swarm.write().await;
            let result = swarm.complete(prompt, max_tokens).await?;
            
            // Cache the result
            self.kv_cache.write().await.insert(prompt.to_string(), result.clone());
            return Ok(result);
        }

        Err(anyhow::anyhow!("No inference backend available"))
    }

    /// Generate streaming completion
    pub async fn complete_stream(
        &self,
        prompt: &str,
        max_tokens: u32,
        mut callback: impl FnMut(String) + Send + 'static,
    ) -> Result<String> {
        if let Some(ref engine) = self.local_engine {
            let mut engine = engine.write().await;
            return engine.complete_stream(prompt, max_tokens, callback).await;
        }

        // Fall back to non-streaming
        let result = self.complete(prompt, max_tokens).await?;
        callback(result.clone());
        Ok(result)
    }

    /// Run a specialized agent
    pub async fn run_agent(&self, agent_type: &str, input: &str) -> Result<String> {
        let orchestrator = self.agent_orchestrator.read().await;
        orchestrator.run(agent_type, input, self).await
    }

    /// Get available models
    pub async fn list_models(&self) -> Result<Vec<ModelInfo>> {
        let registry = self.model_registry.read().await;
        registry.list_models().await
    }

    /// Load a model
    pub async fn load_model(&self, model_name: &str) -> Result<()> {
        if let Some(ref engine) = self.local_engine {
            let mut engine = engine.write().await;
            engine.load_model(model_name).await?;
        }
        Ok(())
    }

    /// Get engine status
    pub async fn status(&self) -> SwarmStatus {
        SwarmStatus {
            local_available: self.local_engine.is_some(),
            speculative_available: self.speculative_decoder.is_some(),
            p2p_available: self.p2p_swarm.is_some(),
            cache_size: self.kv_cache.read().await.len(),
            models_loaded: if self.local_engine.is_some() {
                self.local_engine.as_ref().unwrap().read().await.models_loaded()
            } else {
                0
            },
        }
    }
}

/// Model information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    pub size_bytes: u64,
    pub quantization: String,
    pub context_length: u32,
    pub supports_gpu: bool,
    pub recommended_memory_gb: f32,
}

/// Status of the Swarm AI engine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwarmStatus {
    pub local_available: bool,
    pub speculative_available: bool,
    pub p2p_available: bool,
    pub cache_size: usize,
    pub models_loaded: usize,
}
