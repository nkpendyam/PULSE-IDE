//! AI Orchestrator - Mission control for AI agents

use async_trait::async_trait;
use dashmap::DashMap;
use kyro_core::{KyroError, KyroResult, Service};
use std::sync::Arc;
use uuid::Uuid;

/// Mission ID
pub type MissionId = Uuid;

/// AI Orchestrator service
pub struct Orchestrator {
    missions: DashMap<MissionId, Mission>,
}

/// Mission status
#[derive(Debug, Clone)]
pub enum MissionStatus {
    Planning,
    Executing,
    Testing,
    Reviewing,
    Completed,
    Failed(String),
}

/// Mission
#[derive(Debug, Clone)]
pub struct Mission {
    pub id: MissionId,
    pub prompt: String,
    pub status: MissionStatus,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl Orchestrator {
    /// Create a new orchestrator
    pub fn new() -> Self {
        Self {
            missions: DashMap::new(),
        }
    }

    /// Start a new mission
    pub async fn start_mission(&self, prompt: String) -> KyroResult<MissionId> {
        let id = Uuid::new_v4();
        let mission = Mission {
            id,
            prompt,
            status: MissionStatus::Planning,
            created_at: chrono::Utc::now(),
        };

        self.missions.insert(id, mission);
        log::info!("Started mission: {}", id);

        Ok(id)
    }

    /// Get a mission by ID
    pub fn get_mission(&self, id: MissionId) -> Option<Mission> {
        self.missions.get(&id).map(|m| m.value().clone())
    }

    /// List all missions
    pub fn list_missions(&self) -> Vec<Mission> {
        self.missions.iter().map(|e| e.value().clone()).collect()
    }

    /// Cancel a mission
    pub async fn cancel_mission(&self, id: MissionId) -> KyroResult<()> {
        if let Some(mut mission) = self.missions.get_mut(&id) {
            mission.status = MissionStatus::Failed("Cancelled".to_string());
            log::info!("Cancelled mission: {}", id);
        }
        Ok(())
    }
}

impl Default for Orchestrator {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Service for Orchestrator {
    fn name(&self) -> &str {
        "Orchestrator"
    }

    async fn init(&mut self) -> KyroResult<()> {
        log::info!("Initializing AI Orchestrator");
        Ok(())
    }

    async fn shutdown(&mut self) -> KyroResult<()> {
        log::info!("Shutting down AI Orchestrator");
        self.missions.clear();
        Ok(())
    }

    async fn health_check(&self) -> KyroResult<()> {
        Ok(())
    }
}

#[cfg(all(test, feature = "fixme_tests"))]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_orchestrator() {
        let orchestrator = Orchestrator::new();
        let id = orchestrator
            .start_mission("Test mission".to_string())
            .await
            .unwrap();

        let mission = orchestrator.get_mission(id).unwrap();
        assert_eq!(mission.prompt, "Test mission");
    }
}
