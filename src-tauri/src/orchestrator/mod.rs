//! Kyro Orchestrator
//!
//! Unified service that routes user prompts to AirLLM, Ollama, PicoClaw,
//! and coordinates missions across agents. Acts as the central "mission control"
//! for the IDE.

mod missions;

pub use missions::{Mission, MissionArtifact, MissionPhase, MissionStatus};

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Orchestrator configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestratorConfig {
    /// Preferred model backend: "airllm", "ollama", "embedded", "auto"
    pub preferred_backend: String,
    /// VRAM profile: "4gb", "8gb", "16gb"
    pub vram_profile: String,
    /// Max concurrent missions
    pub max_concurrent_missions: usize,
}

impl Default for OrchestratorConfig {
    fn default() -> Self {
        Self {
            preferred_backend: "auto".to_string(),
            vram_profile: "8gb".to_string(),
            max_concurrent_missions: 5,
        }
    }
}

/// Model info for orchestrator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub backend: String,
    pub vram_mb: Option<u32>,
    pub available: bool,
}

/// Agent info for orchestrator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInfo {
    pub id: String,
    pub name: String,
    pub role: String,
    pub status: String,
    pub model: Option<String>,
}

/// Kyro Orchestrator - central mission control
pub struct KyroOrchestrator {
    config: OrchestratorConfig,
    missions: Arc<RwLock<HashMap<String, Mission>>>,
}

impl KyroOrchestrator {
    pub fn new(config: OrchestratorConfig) -> Self {
        Self {
            config,
            missions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Start a new mission
    pub async fn start_mission(&self, goal: String, constraints: Option<Vec<String>>) -> Mission {
        let id = Uuid::new_v4().to_string();
        let mission = Mission {
            id: id.clone(),
            goal,
            constraints: constraints.unwrap_or_default(),
            phase: MissionPhase::Plan,
            status: MissionStatus::Running,
            assigned_agents: Vec::new(),
            artifacts: Vec::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        let mut missions = self.missions.write().await;
        missions.insert(id.clone(), mission.clone());
        mission
    }

    /// Get mission by ID
    pub async fn get_mission(&self, id: &str) -> Option<Mission> {
        let missions = self.missions.read().await;
        missions.get(id).cloned()
    }

    /// List all missions
    pub async fn list_missions(&self) -> Vec<Mission> {
        let missions = self.missions.read().await;
        missions.values().cloned().collect()
    }

    /// Update mission phase
    pub async fn update_mission_phase(&self, id: &str, phase: MissionPhase) -> Option<Mission> {
        let mut missions = self.missions.write().await;
        if let Some(m) = missions.get_mut(id) {
            m.phase = phase;
            m.updated_at = chrono::Utc::now();
            if phase == MissionPhase::Deploy {
                m.status = MissionStatus::Completed;
            }
            return Some(m.clone());
        }
        None
    }

    /// Get config
    pub fn config(&self) -> &OrchestratorConfig {
        &self.config
    }
}
