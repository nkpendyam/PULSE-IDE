//! PULSE Runtime Kernel - Policy Engine
//!
//! Enforces policy modes: Off, Review-Driven, Agent-Driven.

use crate::event::Event;
use anyhow::{Result, bail};
use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use tracing::{info, warn, debug};

/// Policy mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PolicyMode {
    /// No policy enforcement (dangerous)
    Off,
    /// All plans require review
    Review,
    /// Agents can auto-execute within bounds
    Agent,
}

impl std::fmt::Display for PolicyMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PolicyMode::Off => write!(f, "off"),
            PolicyMode::Review => write!(f, "review"),
            PolicyMode::Agent => write!(f, "agent"),
        }
    }
}

impl std::str::FromStr for PolicyMode {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self> {
        match s.to_lowercase().as_str() {
            "off" => Ok(Self::Off),
            "review" => Ok(Self::Review),
            "agent" => Ok(Self::Agent),
            _ => bail!("Invalid policy mode: {}", s),
        }
    }
}

/// Risk assessment for a plan
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

impl Default for RiskLevel {
    fn default() -> Self {
        Self::Low
    }
}

/// Plan validation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanValidation {
    /// Is the plan valid?
    pub valid: bool,
    /// Does it require manual review?
    pub requires_review: bool,
    /// Is it blocked entirely?
    pub blocked: bool,
    /// Reason for the decision
    pub reason: Option<String>,
}

/// Policy rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyRule {
    /// Rule name
    pub name: String,
    /// Rule description
    pub description: String,
    /// Entity type this applies to
    pub entity_type: Option<String>,
    /// Operation pattern to match
    pub operation_pattern: String,
    /// Maximum risk level allowed
    pub max_risk_level: RiskLevel,
    /// Auto-approve if within bounds
    pub auto_approve: bool,
    /// Require explicit review
    pub require_review: bool,
    /// Block entirely
    pub block: bool,
}

/// Policy engine for enforcing execution policies
pub struct PolicyEngine {
    /// Current policy mode
    mode: PolicyMode,
    /// Policy rules
    rules: Vec<PolicyRule>,
    /// Auto-approve thresholds
    auto_approve_thresholds: HashMap<String, RiskLevel>,
}

impl PolicyEngine {
    /// Create a new policy engine
    pub fn new(mode: PolicyMode) -> Self {
        let mut engine = Self {
            mode,
            rules: Vec::new(),
            auto_approve_thresholds: HashMap::new(),
        };

        engine.add_default_rules();
        engine
    }

    /// Add default policy rules
    fn add_default_rules(&mut self) {
        // File operations
        self.rules.push(PolicyRule {
            name: "file_read".to_string(),
            description: "Read files from workspace".to_string(),
            entity_type: None,
            operation_pattern: "filesystem:read".to_string(),
            max_risk_level: RiskLevel::Medium,
            auto_approve: true,
            require_review: false,
            block: false,
        });

        self.rules.push(PolicyRule {
            name: "file_write".to_string(),
            description: "Write files to workspace".to_string(),
            entity_type: None,
            operation_pattern: "filesystem:write".to_string(),
            max_risk_level: RiskLevel::Medium,
            auto_approve: false,
            require_review: true,
            block: false,
        });

        self.rules.push(PolicyRule {
            name: "file_delete".to_string(),
            description: "Delete files from workspace".to_string(),
            entity_type: None,
            operation_pattern: "filesystem:delete".to_string(),
            max_risk_level: RiskLevel::High,
            auto_approve: false,
            require_review: true,
            block: false,
        });

        // Network operations
        self.rules.push(PolicyRule {
            name: "network_connect".to_string(),
            description: "Make network connections".to_string(),
            entity_type: None,
            operation_pattern: "network:*".to_string(),
            max_risk_level: RiskLevel::High,
            auto_approve: false,
            require_review: true,
            block: false,
        });

        // System operations
        self.rules.push(PolicyRule {
            name: "system_admin".to_string(),
            description: "System administration".to_string(),
            entity_type: None,
            operation_pattern: "system:admin".to_string(),
            max_risk_level: RiskLevel::Critical,
            auto_approve: false,
            require_review: true,
            block: true, // Block in review mode
        });

        // Agent operations
        self.rules.push(PolicyRule {
            name: "agent_spawn".to_string(),
            description: "Spawn new agents".to_string(),
            entity_type: None,
            operation_pattern: "agent:spawn".to_string(),
            max_risk_level: RiskLevel::Medium,
            auto_approve: false,
            require_review: true,
            block: false,
        });
    }

    /// Get current policy mode
    pub fn mode(&self) -> PolicyMode {
        self.mode
    }

    /// Set policy mode
    pub fn set_mode(&mut self, mode: PolicyMode) {
        info!(mode = ?mode, "Policy mode changed");
        self.mode = mode;
    }

    /// Add a custom rule
    pub fn add_rule(&mut self, rule: PolicyRule) {
        self.rules.push(rule);
    }

    /// Validate a plan
    pub fn validate_plan(&self, event: &Event) -> Result<PlanValidation> {
        // Parse plan from event payload
        let plan: Option<serde_json::Value> = Some(event.payload.clone());

        // Determine risk level from plan
        let risk_level = self.assess_risk(&plan);
        
        debug!(
            mode = ?self.mode,
            risk_level = ?risk_level,
            "Validating plan"
        );

        match self.mode {
            PolicyMode::Off => {
                // No enforcement - auto-approve everything
                Ok(PlanValidation {
                    valid: true,
                    requires_review: false,
                    blocked: false,
                    reason: Some("Policy mode is OFF - all plans auto-approved".to_string()),
                })
            }
            PolicyMode::Review => {
                // All plans require review unless explicitly auto-approved
                if risk_level >= RiskLevel::Critical {
                    Ok(PlanValidation {
                        valid: true,
                        requires_review: true,
                        blocked: true,
                        reason: Some("Critical risk - requires explicit approval".to_string()),
                    })
                } else if risk_level <= RiskLevel::Low {
                    // Low risk can be auto-reviewed but still queued
                    Ok(PlanValidation {
                        valid: true,
                        requires_review: true,
                        blocked: false,
                        reason: Some("Low risk - queued for review".to_string()),
                    })
                } else {
                    Ok(PlanValidation {
                        valid: true,
                        requires_review: true,
                        blocked: false,
                        reason: Some("Medium/High risk - requires review".to_string()),
                    })
                }
            }
            PolicyMode::Agent => {
                // Agents can auto-execute within bounds
                if risk_level >= RiskLevel::Critical {
                    Ok(PlanValidation {
                        valid: true,
                        requires_review: true,
                        blocked: false,
                        reason: Some("Critical risk - requires review even in agent mode".to_string()),
                    })
                } else if risk_level <= RiskLevel::Medium {
                    Ok(PlanValidation {
                        valid: true,
                        requires_review: false,
                        blocked: false,
                        reason: Some("Within agent bounds - auto-approved".to_string()),
                    })
                } else {
                    Ok(PlanValidation {
                        valid: true,
                        requires_review: true,
                        blocked: false,
                        reason: Some("High risk - requires review".to_string()),
                    })
                }
            }
        }
    }

    /// Assess risk level of a plan
    fn assess_risk(&self, plan: &Option<serde_json::Value>) -> RiskLevel {
        let Some(plan) = plan else {
            return RiskLevel::Low;
        };

        // Check for high-risk operations
        if let Some(mods) = plan.get("file_modifications").and_then(|m| m.as_array()) {
            for m in mods {
                if let Some(op) = m.get("operation").and_then(|o| o.as_str()) {
                    if op == "delete" {
                        return RiskLevel::High;
                    }
                }
            }
        }

        // Check for network operations
        if let Some(net) = plan.get("network_operations").and_then(|n| n.as_array()) {
            if !net.is_empty() {
                return RiskLevel::High;
            }
        }

        // Check explicit risk level
        if let Some(risk) = plan.get("risk_level").and_then(|r| r.as_str()) {
            match risk.to_lowercase().as_str() {
                "critical" => return RiskLevel::Critical,
                "high" => return RiskLevel::High,
                "medium" => return RiskLevel::Medium,
                "low" => return RiskLevel::Low,
                _ => {}
            }
        }

        // Check number of steps
        if let Some(steps) = plan.get("steps").and_then(|s| s.as_array()) {
            if steps.len() > 10 {
                return RiskLevel::Medium;
            }
        }

        RiskLevel::Low
    }

    /// Check if operation is allowed
    pub fn is_operation_allowed(&self, operation: &str, risk: RiskLevel) -> bool {
        for rule in &self.rules {
            if operation.starts_with(&rule.operation_pattern.replace('*', "")) {
                if risk > rule.max_risk_level {
                    return false;
                }
                if rule.block && self.mode == PolicyMode::Review {
                    return false;
                }
                return true;
            }
        }

        // Default: require review for unknown operations
        self.mode != PolicyMode::Off
    }
}

impl Default for PolicyEngine {
    fn default() -> Self {
        Self::new(PolicyMode::Review)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_policy_mode_parsing() {
        assert_eq!(PolicyMode::from_str("review").unwrap(), PolicyMode::Review);
        assert_eq!(PolicyMode::from_str("agent").unwrap(), PolicyMode::Agent);
        assert_eq!(PolicyMode::from_str("off").unwrap(), PolicyMode::Off);
    }

    #[test]
    fn test_validation_review_mode() {
        let engine = PolicyEngine::new(PolicyMode::Review);
        let event = Event::new(
            crate::event::EventType::PlanProposed,
            "test",
            serde_json::json!({"steps": []}),
        );

        let result = engine.validate_plan(&event).unwrap();
        assert!(result.valid);
        assert!(result.requires_review);
    }

    #[test]
    fn test_validation_agent_mode() {
        let engine = PolicyEngine::new(PolicyMode::Agent);
        let event = Event::new(
            crate::event::EventType::PlanProposed,
            "test",
            serde_json::json!({"steps": [], "risk_level": "low"}),
        );

        let result = engine.validate_plan(&event).unwrap();
        assert!(result.valid);
        assert!(!result.requires_review);
    }

    #[test]
    fn test_risk_assessment() {
        let engine = PolicyEngine::new(PolicyMode::Review);

        let low_plan = Some(serde_json::json!({"steps": []}));
        assert_eq!(engine.assess_risk(&low_plan), RiskLevel::Low);

        let high_plan = Some(serde_json::json!({
            "file_modifications": [{"operation": "delete"}]
        }));
        assert_eq!(engine.assess_risk(&high_plan), RiskLevel::High);

        let critical_plan = Some(serde_json::json!({"risk_level": "critical"}));
        assert_eq!(engine.assess_risk(&critical_plan), RiskLevel::Critical);
    }
}
