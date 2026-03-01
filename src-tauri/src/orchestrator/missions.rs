//! Mission types for the Kyro Orchestrator.
//! Represents user goals and agent workflows (plan → edit → test → review → deploy).

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// Phase of a mission in the build/test/deploy pipeline
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MissionPhase {
    Plan,
    Edit,
    Test,
    Review,
    Deploy,
}

/// Status of a mission
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MissionStatus {
    Running,
    Paused,
    Completed,
    Failed,
}

/// Artifact produced by an agent during a mission (diff, test result, screenshot, etc.)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MissionArtifact {
    pub kind: String,
    pub path: Option<String>,
    pub content: Option<String>,
}

/// A single mission: one user goal with phases and artifacts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Mission {
    pub id: String,
    pub goal: String,
    pub constraints: Vec<String>,
    pub phase: MissionPhase,
    pub status: MissionStatus,
    pub assigned_agents: Vec<String>,
    pub artifacts: Vec<MissionArtifact>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
