//! PULSE Runtime Kernel - PicoClaw Bridge
//!
//! Integration bridge for PicoClaw cognitive controller.

use crate::event::{Event, EventBus, EventType};
use crate::policy::{PolicyEngine, PolicyMode, PlanValidation};

use anyhow::Result;
use serde::{Serialize, Deserialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, debug};

/// Plan artifact from PicoClaw
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanArtifact {
    /// Unique plan identifier
    pub id: String,
    /// Plan name/description
    pub name: String,
    /// Plan steps
    pub steps: Vec<PlanStep>,
    /// Required capabilities
    pub required_capabilities: Vec<String>,
    /// Risk assessment
    pub risk_level: String,
    /// Estimated duration in seconds
    pub estimated_duration_secs: u64,
    /// File modifications (if any)
    pub file_modifications: Vec<FileModification>,
    /// Network operations (if any)
    pub network_operations: Vec<NetworkOperation>,
    /// Metadata
    pub metadata: serde_json::Value,
}

/// A single step in a plan
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanStep {
    pub id: String,
    pub action: String,
    pub description: String,
    pub parameters: serde_json::Value,
    pub dependencies: Vec<String>,
}

/// File modification descriptor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileModification {
    pub path: String,
    pub operation: String, // create, modify, delete
    pub diff: Option<String>,
    pub risk: String,
}

/// Network operation descriptor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkOperation {
    pub url: String,
    pub method: String,
    pub purpose: String,
}

/// Plan status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PlanStatus {
    Proposed,
    Queued,
    Approved,
    Rejected,
    Executing,
    Completed,
    Failed,
}

/// Bridge to PicoClaw cognitive controller
pub struct PicoClawBridge {
    /// WebSocket port
    port: u16,
    /// Connected state
    connected: Arc<RwLock<bool>>,
    /// Event bus reference
    event_bus: Option<Arc<EventBus>>,
    /// Policy engine reference
    policy_engine: Option<Arc<RwLock<PolicyEngine>>>,
}

impl PicoClawBridge {
    /// Create a new PicoClaw bridge
    pub fn new(port: u16) -> Self {
        Self {
            port,
            connected: Arc::new(RwLock::new(false)),
            event_bus: None,
            policy_engine: None,
        }
    }

    /// Connect to event bus and policy engine
    pub fn connect(
        &mut self,
        event_bus: Arc<EventBus>,
        policy_engine: Arc<RwLock<PolicyEngine>>,
    ) {
        self.event_bus = Some(event_bus);
        self.policy_engine = Some(policy_engine);
    }

    /// Start the bridge server
    pub async fn start(&self) -> Result<()> {
        info!("Starting PicoClaw bridge on port {}", self.port);

        // Mark as connected
        let mut connected = self.connected.write().await;
        *connected = true;

        // In a real implementation, would start WebSocket server
        // and handle JSON-RPC messages from PicoClaw

        info!("PicoClaw bridge ready");
        Ok(())
    }

    /// Handle incoming plan from PicoClaw
    pub async fn handle_plan(&self, plan: PlanArtifact) -> Result<PlanStatus> {
        info!(
            plan_id = %plan.id,
            plan_name = %plan.name,
            steps = plan.steps.len(),
            "Received plan from PicoClaw"
        );

        // Validate plan with policy engine
        let validation = if let Some(policy) = &self.policy_engine {
            let policy = policy.read().await;
            policy.validate_plan(&Event::new(
                EventType::PlanProposed,
                "picoclaw",
                serde_json::to_value(&plan)?,
            ))?
        } else {
            PlanValidation {
                valid: true,
                requires_review: true,
                blocked: false,
                reason: None,
            }
        };

        if validation.blocked {
            warn!(plan_id = %plan.id, reason = ?validation.reason, "Plan blocked");
            return Ok(PlanStatus::Rejected);
        }

        // Publish plan proposed event
        if let Some(event_bus) = &self.event_bus {
            event_bus.publish(Event::new(
                EventType::PlanProposed,
                "picoclaw",
                serde_json::to_value(&plan)?,
            ).with_metadata(serde_json::to_value(&validation)?))?;
        }

        if validation.requires_review {
            info!(plan_id = %plan.id, "Plan queued for review");
            Ok(PlanStatus::Queued)
        } else {
            info!(plan_id = %plan.id, "Plan auto-approved");
            Ok(PlanStatus::Approved)
        }
    }

    /// Send execution result to PicoClaw
    pub async fn send_result(&self, plan_id: &str, status: PlanStatus, result: serde_json::Value) -> Result<()> {
        info!(
            plan_id = %plan_id,
            status = ?status,
            "Sending execution result to PicoClaw"
        );

        // In a real implementation, would send via WebSocket

        Ok(())
    }

    /// Request plan approval from user
    pub async fn request_approval(&self, plan: &PlanArtifact) -> Result<()> {
        info!(
            plan_id = %plan.id,
            plan_name = %plan.name,
            risk_level = %plan.risk_level,
            "Requesting plan approval"
        );

        // Publish event for UI to handle
        if let Some(event_bus) = &self.event_bus {
            event_bus.publish_with_priority(
                Event::new(
                    EventType::PlanQueued,
                    "picoclaw-bridge",
                    serde_json::to_value(plan)?,
                ),
                crate::event::Priority::High,
            )?;
        }

        Ok(())
    }

    /// Notify PicoClaw of kernel state change
    pub async fn notify_state_change(&self, state: &str) -> Result<()> {
        debug!(state = %state, "Notifying PicoClaw of state change");
        Ok(())
    }

    /// Check if PicoClaw is connected
    pub async fn is_connected(&self) -> bool {
        *self.connected.read().await
    }

    /// Disconnect PicoClaw
    pub async fn disconnect(&self) {
        let mut connected = self.connected.write().await;
        *connected = false;
        info!("PicoClaw disconnected");
    }
}

/// PicoClaw message types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum PicoClawMessage {
    /// Plan proposal
    PlanProposed { plan: PlanArtifact },
    /// Plan approved by user
    PlanApproved { plan_id: String },
    /// Plan rejected by user
    PlanRejected { plan_id: String, reason: String },
    /// Request for context
    ContextRequest { query: String },
    /// Heartbeat
    Heartbeat { timestamp: i64 },
}

/// PicoClaw response types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum PicoClawResponse {
    /// Plan received
    PlanReceived { plan_id: String, status: PlanStatus },
    /// Context response
    ContextResponse { context: String },
    /// Execution result
    ExecutionResult { plan_id: String, status: PlanStatus, result: serde_json::Value },
    /// Error
    Error { message: String },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_plan_artifact() {
        let plan = PlanArtifact {
            id: "plan-1".to_string(),
            name: "Test Plan".to_string(),
            steps: vec![PlanStep {
                id: "step-1".to_string(),
                action: "create_file".to_string(),
                description: "Create a test file".to_string(),
                parameters: serde_json::json!({"path": "/tmp/test.txt"}),
                dependencies: vec![],
            }],
            required_capabilities: vec!["filesystem:write".to_string()],
            risk_level: "low".to_string(),
            estimated_duration_secs: 10,
            file_modifications: vec![],
            network_operations: vec![],
            metadata: serde_json::Value::Null,
        };

        assert_eq!(plan.steps.len(), 1);
    }

    #[tokio::test]
    async fn test_bridge_creation() {
        let bridge = PicoClawBridge::new(9876);
        assert_eq!(bridge.port, 9876);
        assert!(!bridge.is_connected().await);
    }
}
