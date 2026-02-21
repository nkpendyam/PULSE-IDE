//! Model Router - Route prompts to appropriate models

use anyhow::Result;
use serde::{Serialize, Deserialize};

/// Router configuration
pub struct ModelRouter {
    models: Vec<RouteRule>,
}

/// Routing rule
#[derive(Debug, Clone)]
pub struct RouteRule {
    pub model: String,
    pub keywords: Vec<String>,
    pub max_prompt_length: Option<usize>,
    pub priority: i32,
}

impl ModelRouter {
    pub fn new(config: &super::ProxyConfig) -> Self {
        Self {
            models: vec![
                // MobileBERT for intent routing
                RouteRule {
                    model: "mobilebert".to_string(),
                    keywords: vec!["classify", "categorize", "route", "intent"],
                    max_prompt_length: Some(512),
                    priority: 10,
                },
                // DistilGPT-2 for short completions
                RouteRule {
                    model: "distilgpt2".to_string(),
                    keywords: vec!["complete", "finish", "suggest"],
                    max_prompt_length: Some(1024),
                    priority: 5,
                },
                // TinyLlama for reasoning
                RouteRule {
                    model: "tinyllama-1.1b".to_string(),
                    keywords: vec!["explain", "analyze", "reason", "think", "why", "how"],
                    max_prompt_length: None,
                    priority: 3,
                },
            ],
        }
    }

    /// Route a prompt to the best model
    pub async fn route(&self, prompt: &str) -> String {
        let prompt_lower = prompt.to_lowercase();

        // Score each model
        let mut scores: Vec<(String, i32)> = self.models
            .iter()
            .map(|rule| {
                let mut score = 0;

                // Keyword matching
                for keyword in &rule.keywords {
                    if prompt_lower.contains(keyword) {
                        score += 10;
                    }
                }

                // Length consideration
                if let Some(max_len) = rule.max_prompt_length {
                    if prompt.len() <= max_len {
                        score += 5;
                    } else {
                        score -= 10;
                    }
                }

                // Priority
                score += rule.priority;

                (rule.model.clone(), score)
            })
            .collect();

        // Sort by score descending
        scores.sort_by(|a, b| b.1.cmp(&a.1));

        // Return best model
        scores.first()
            .map(|(model, _)| model.clone())
            .unwrap_or_else(|| "tinyllama-1.1b".to_string())
    }

    /// Estimate complexity of a prompt
    pub fn estimate_complexity(&self, prompt: &str) -> f32 {
        let mut complexity = 0.0;

        // Length factor
        complexity += (prompt.len() as f32 / 1000.0).min(1.0) * 0.3;

        // Keyword complexity
        let complex_keywords = [
            "explain", "analyze", "compare", "evaluate", "design",
            "implement", "refactor", "debug", "optimize", "architect",
        ];

        for keyword in &complex_keywords {
            if prompt.to_lowercase().contains(keyword) {
                complexity += 0.15;
            }
        }

        // Question marks indicate multi-step
        let question_count = prompt.matches('?').count();
        complexity += (question_count as f32 * 0.1).min(0.3);

        // Code presence
        if prompt.contains("```") || prompt.contains("fn ") || prompt.contains("def ") {
            complexity += 0.2;
        }

        complexity.min(1.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_routing() {
        let router = ModelRouter::new(&super::ProxyConfig {
            ram_budget_mb: 4096,
            model_dir: "./models".to_string(),
            ollama_host: "http://localhost:11434".to_string(),
            enable_external: false,
        });

        let model = router.route("explain how this works").await;
        // Should route to tinyllama for explanation
        assert!(model.contains("llama") || model.contains("tinyllama"));
    }

    #[test]
    fn test_complexity() {
        let router = ModelRouter::new(&super::ProxyConfig {
            ram_budget_mb: 4096,
            model_dir: "./models".to_string(),
            ollama_host: "http://localhost:11434".to_string(),
            enable_external: false,
        });

        let simple = router.estimate_complexity("hello world");
        let complex = router.estimate_complexity("Explain how to implement a distributed system");

        assert!(simple < complex);
    }
}
