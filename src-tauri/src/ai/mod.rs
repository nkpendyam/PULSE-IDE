//! AI Integration for KYRO IDE
//!
//! This module provides multiple AI backends:
//! - Local inference via llama.cpp
//! - HTTP-based inference (Ollama, LM Studio, vLLM)
//! - Cloud API fallback
//!
//! Priority: Local > HTTP Local > Cloud API

use reqwest::Client;

pub mod quality_gate;
pub mod real_ai_service;

pub use quality_gate::{AiQualityGate, QualityGateConfig, QualityGateResult, QualityContext};
pub use real_ai_service::{AiService, AiBackendConfig, CompletionRequest, CompletionResponse, ConversationMessage};

pub struct AiClient {
    pub client: Client,
    pub base_url: String,
}

impl AiClient {
    pub fn new() -> Self {
        Self { client: Client::new(), base_url: "http://localhost:11434".to_string() }
    }
    
    pub async fn is_available(&self) -> bool {
        self.client.get(format!("{}/api/tags", self.base_url)).timeout(std::time::Duration::from_secs(2)).send().await.map(|r| r.status().is_success()).unwrap_or(false)
    }
    
    /// Generate completion using Ollama
    pub async fn generate(&self, prompt: &str, max_tokens: usize) -> Option<String> {
        let request_body = serde_json::json!({
            "model": "qwen2.5-coder:latest",
            "prompt": prompt,
            "stream": false,
            "options": {
                "num_predict": max_tokens,
                "temperature": 0.3
            }
        });
        
        let response = self.client
            .post(format!("{}/api/generate", self.base_url))
            .json(&request_body)
            .timeout(std::time::Duration::from_secs(30))
            .send()
            .await
            .ok()?;
        
        if response.status().is_success() {
            let json: serde_json::Value = response.json().await.ok()?;
            json.get("response")?.as_str().map(|s| s.to_string())
        } else {
            None
        }
    }
}

impl Default for AiClient {
    fn default() -> Self { Self::new() }
}
