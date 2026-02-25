//! AI Integration for KYRO IDE

use reqwest::Client;
use serde::{Deserialize, Serialize};

pub mod quality_gate;

pub use quality_gate::{AiQualityGate, QualityGateConfig, QualityGateResult, QualityContext};

pub struct AiClient {
    client: Client,
    base_url: String,
}

impl AiClient {
    pub fn new() -> Self {
        Self { client: Client::new(), base_url: "http://localhost:11434".to_string() }
    }
    
    pub async fn is_available(&self) -> bool {
        self.client.get(format!("{}/api/tags", self.base_url)).timeout(std::time::Duration::from_secs(2)).send().await.map(|r| r.status().is_success()).unwrap_or(false)
    }
}

impl Default for AiClient {
    fn default() -> Self { Self::new() }
}
