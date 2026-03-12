//! Multi-Model Router for KYRO IDE
//!
//! Routes requests to the optimal model based on task type, latency
//! requirements, and available models. Inspired by LiteLLM routing.

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Task categories for model routing
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskKind {
    /// Inline code completion (fast, small context)
    Autocomplete,
    /// Chat / Q&A with the user
    Chat,
    /// Planning a multi-step quest
    Plan,
    /// Reviewing code changes
    Review,
    /// Generating test cases
    Test,
    /// Embedding text for RAG
    Embed,
    /// Generic / uncategorised
    Generic,
}

/// A model endpoint known to the router
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelEndpoint {
    /// Unique id, e.g. "ollama/codellama:7b-instruct"
    pub id: String,
    /// Provider label (ollama, openai, anthropic, local)
    pub provider: String,
    /// Ollama model name or API model id
    pub model_name: String,
    /// Base URL for inference (e.g. "http://localhost:11434")
    pub base_url: String,
    /// Maximum context window in tokens
    pub context_length: u32,
    /// Rough tokens-per-second on this machine
    pub tokens_per_second: f32,
    /// Quality score [0.0, 1.0] from benchmarks
    pub quality_score: f32,
    /// Which task kinds this model is allowed for
    pub allowed_tasks: Vec<TaskKind>,
    /// If true, the model is known to be reachable right now
    pub healthy: bool,
}

/// Routing preference
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RouteStrategy {
    /// Lowest latency first
    Speed,
    /// Highest quality first
    Quality,
    /// Balance speed and quality
    Balanced,
}

/// Per-task routing rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutingRule {
    pub task: TaskKind,
    pub strategy: RouteStrategy,
    /// Optional: force a specific model id
    pub pinned_model: Option<String>,
    /// Max acceptable latency in ms (0 = no limit)
    pub max_latency_ms: u32,
}

/// Router configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouterConfig {
    pub rules: Vec<RoutingRule>,
    pub fallback_strategy: RouteStrategy,
}

impl Default for RouterConfig {
    fn default() -> Self {
        Self {
            rules: vec![
                RoutingRule {
                    task: TaskKind::Autocomplete,
                    strategy: RouteStrategy::Speed,
                    pinned_model: None,
                    max_latency_ms: 200,
                },
                RoutingRule {
                    task: TaskKind::Chat,
                    strategy: RouteStrategy::Balanced,
                    pinned_model: None,
                    max_latency_ms: 0,
                },
                RoutingRule {
                    task: TaskKind::Plan,
                    strategy: RouteStrategy::Quality,
                    pinned_model: None,
                    max_latency_ms: 0,
                },
                RoutingRule {
                    task: TaskKind::Review,
                    strategy: RouteStrategy::Quality,
                    pinned_model: None,
                    max_latency_ms: 0,
                },
                RoutingRule {
                    task: TaskKind::Test,
                    strategy: RouteStrategy::Balanced,
                    pinned_model: None,
                    max_latency_ms: 0,
                },
                RoutingRule {
                    task: TaskKind::Embed,
                    strategy: RouteStrategy::Speed,
                    pinned_model: None,
                    max_latency_ms: 0,
                },
            ],
            fallback_strategy: RouteStrategy::Balanced,
        }
    }
}

/// The multi-model router
pub struct ModelRouter {
    endpoints: Arc<RwLock<Vec<ModelEndpoint>>>,
    config: Arc<RwLock<RouterConfig>>,
}

impl ModelRouter {
    /// Create a new router with default config and built-in Ollama endpoints
    pub fn new() -> Self {
        let endpoints = default_endpoints();
        Self {
            endpoints: Arc::new(RwLock::new(endpoints)),
            config: Arc::new(RwLock::new(RouterConfig::default())),
        }
    }

    /// Register an additional model endpoint
    pub async fn register(&self, ep: ModelEndpoint) {
        let mut eps = self.endpoints.write().await;
        // Replace if same id exists
        eps.retain(|e| e.id != ep.id);
        eps.push(ep);
    }

    /// Remove an endpoint
    pub async fn unregister(&self, id: &str) {
        let mut eps = self.endpoints.write().await;
        eps.retain(|e| e.id != id);
    }

    /// Select the best model for a given task kind
    pub async fn route(&self, task: TaskKind) -> Option<ModelEndpoint> {
        let eps = self.endpoints.read().await;
        let cfg = self.config.read().await;

        // Find rule for the task
        let rule = cfg.rules.iter().find(|r| r.task == task);
        let strategy = rule.map(|r| r.strategy).unwrap_or(cfg.fallback_strategy);

        // If a model is pinned, return it directly
        if let Some(pinned_id) = rule.and_then(|r| r.pinned_model.as_ref()) {
            if let Some(ep) = eps.iter().find(|e| &e.id == pinned_id && e.healthy) {
                return Some(ep.clone());
            }
        }

        // Filter candidates: healthy + task allowed
        let mut candidates: Vec<&ModelEndpoint> = eps
            .iter()
            .filter(|e| e.healthy && e.allowed_tasks.contains(&task))
            .collect();

        if candidates.is_empty() {
            // Fallback: any healthy model
            candidates = eps.iter().filter(|e| e.healthy).collect();
        }
        if candidates.is_empty() {
            return None;
        }

        // Sort by strategy
        match strategy {
            RouteStrategy::Speed => {
                candidates.sort_by(|a, b| {
                    b.tokens_per_second
                        .partial_cmp(&a.tokens_per_second)
                        .unwrap_or(std::cmp::Ordering::Equal)
                });
            }
            RouteStrategy::Quality => {
                candidates.sort_by(|a, b| {
                    b.quality_score
                        .partial_cmp(&a.quality_score)
                        .unwrap_or(std::cmp::Ordering::Equal)
                });
            }
            RouteStrategy::Balanced => {
                // Score = quality * 0.6 + speed_norm * 0.4
                let max_tps = candidates
                    .iter()
                    .map(|c| c.tokens_per_second)
                    .fold(1.0f32, f32::max);
                candidates.sort_by(|a, b| {
                    let score_a = a.quality_score * 0.6 + (a.tokens_per_second / max_tps) * 0.4;
                    let score_b = b.quality_score * 0.6 + (b.tokens_per_second / max_tps) * 0.4;
                    score_b
                        .partial_cmp(&score_a)
                        .unwrap_or(std::cmp::Ordering::Equal)
                });
            }
        }

        Some(candidates[0].clone())
    }

    /// Health-check all endpoints by pinging Ollama /api/tags
    pub async fn refresh_health(&self) {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(3))
            .build()
            .unwrap_or_default();

        let mut eps = self.endpoints.write().await;
        // Group by base_url so we only ping each server once
        let urls: Vec<String> = eps
            .iter()
            .map(|e| e.base_url.clone())
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();
        let mut healthy_urls: std::collections::HashSet<String> = std::collections::HashSet::new();
        for url in &urls {
            if let Ok(resp) = client.get(format!("{}/api/tags", url)).send().await {
                if resp.status().is_success() {
                    healthy_urls.insert(url.clone());
                }
            }
        }
        for ep in eps.iter_mut() {
            ep.healthy = healthy_urls.contains(&ep.base_url);
        }
    }

    /// Update routing config
    pub async fn set_config(&self, config: RouterConfig) {
        let mut cfg = self.config.write().await;
        *cfg = config;
    }

    /// Get current config
    pub async fn get_config(&self) -> RouterConfig {
        self.config.read().await.clone()
    }

    /// List all registered endpoints
    pub async fn list_endpoints(&self) -> Vec<ModelEndpoint> {
        self.endpoints.read().await.clone()
    }
}

/// Default set of Ollama-based model endpoints
fn default_endpoints() -> Vec<ModelEndpoint> {
    let base = "http://localhost:11434".to_string();
    vec![
        ModelEndpoint {
            id: "ollama/tinyllama:1.1b".into(),
            provider: "ollama".into(),
            model_name: "tinyllama:1.1b".into(),
            base_url: base.clone(),
            context_length: 2048,
            tokens_per_second: 80.0,
            quality_score: 0.55,
            allowed_tasks: vec![TaskKind::Autocomplete],
            healthy: false,
        },
        ModelEndpoint {
            id: "ollama/deepseek-coder:6.7b".into(),
            provider: "ollama".into(),
            model_name: "deepseek-coder:6.7b-instruct-q4_K_M".into(),
            base_url: base.clone(),
            context_length: 16384,
            tokens_per_second: 28.0,
            quality_score: 0.92,
            allowed_tasks: vec![
                TaskKind::Autocomplete,
                TaskKind::Chat,
                TaskKind::Plan,
                TaskKind::Review,
                TaskKind::Test,
                TaskKind::Generic,
            ],
            healthy: false,
        },
        ModelEndpoint {
            id: "ollama/codellama:7b-instruct".into(),
            provider: "ollama".into(),
            model_name: "codellama:7b-instruct".into(),
            base_url: base.clone(),
            context_length: 16384,
            tokens_per_second: 25.0,
            quality_score: 0.85,
            allowed_tasks: vec![
                TaskKind::Autocomplete,
                TaskKind::Chat,
                TaskKind::Plan,
                TaskKind::Review,
                TaskKind::Test,
                TaskKind::Generic,
            ],
            healthy: false,
        },
        ModelEndpoint {
            id: "ollama/codellama:13b-instruct".into(),
            provider: "ollama".into(),
            model_name: "codellama:13b-instruct".into(),
            base_url: base.clone(),
            context_length: 16384,
            tokens_per_second: 15.0,
            quality_score: 0.90,
            allowed_tasks: vec![
                TaskKind::Chat,
                TaskKind::Plan,
                TaskKind::Review,
                TaskKind::Test,
                TaskKind::Generic,
            ],
            healthy: false,
        },
        ModelEndpoint {
            id: "ollama/mistral:7b-instruct".into(),
            provider: "ollama".into(),
            model_name: "mistral:7b-instruct".into(),
            base_url: base.clone(),
            context_length: 8192,
            tokens_per_second: 30.0,
            quality_score: 0.88,
            allowed_tasks: vec![
                TaskKind::Chat,
                TaskKind::Plan,
                TaskKind::Review,
                TaskKind::Generic,
            ],
            healthy: false,
        },
        ModelEndpoint {
            id: "ollama/nomic-embed-text".into(),
            provider: "ollama".into(),
            model_name: "nomic-embed-text:v1.5".into(),
            base_url: base,
            context_length: 8192,
            tokens_per_second: 100.0,
            quality_score: 0.80,
            allowed_tasks: vec![TaskKind::Embed],
            healthy: false,
        },
    ]
}
