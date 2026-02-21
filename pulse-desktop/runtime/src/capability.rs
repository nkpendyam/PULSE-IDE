//! PULSE Runtime Kernel - Capability Manager
//!
//! Manages permissions and capability tokens for secure access control.

use anyhow::{Result, bail};
use serde::{Serialize, Deserialize};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, debug};

/// Capability identifier
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CapabilityId(String);

impl CapabilityId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for CapabilityId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Capability risk levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum RiskLevel {
    Low = 0,
    Medium = 1,
    High = 2,
    Critical = 3,
}

impl Default for RiskLevel {
    fn default() -> Self {
        Self::Low
    }
}

/// Capability definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Capability {
    /// Unique capability identifier
    pub id: CapabilityId,
    /// Human-readable name
    pub name: String,
    /// Description
    pub description: String,
    /// Risk level
    pub risk_level: RiskLevel,
    /// Category (e.g., "filesystem", "network", "system")
    pub category: String,
}

/// Capability token granted to an entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapabilityToken {
    /// Entity this token belongs to
    pub entity_id: String,
    /// Entity type (agent, module, user)
    pub entity_type: EntityType,
    /// Granted capabilities
    pub capabilities: HashSet<String>,
    /// Token creation time
    pub created_at: chrono::DateTime<chrono::Utc>,
    /// Token expiration (if any)
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
    /// Constraints applied to this token
    pub constraints: HashMap<String, serde_json::Value>,
}

/// Entity types that can have capabilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum EntityType {
    Agent,
    Module,
    User,
    System,
}

/// Capability manager
pub struct CapabilityManager {
    /// Registered capability definitions
    capabilities: HashMap<String, Capability>,
    /// Tokens by entity ID
    tokens: HashMap<String, CapabilityToken>,
    /// Policy rules for auto-granting
    policies: Vec<CapabilityPolicy>,
}

/// Policy for automatic capability granting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapabilityPolicy {
    /// Entity type this policy applies to
    pub entity_type: EntityType,
    /// Pattern to match entity IDs
    pub entity_pattern: String,
    /// Capabilities to grant
    pub grant: Vec<String>,
    /// Maximum risk level allowed
    pub max_risk_level: RiskLevel,
}

impl CapabilityManager {
    /// Create a new capability manager
    pub fn new() -> Self {
        Self {
            capabilities: HashMap::new(),
            tokens: HashMap::new(),
            policies: Vec::new(),
        }
    }

    /// Register default system capabilities
    pub fn register_default_capabilities(&mut self) {
        // System capabilities
        self.register(Capability {
            id: CapabilityId::new("system:read"),
            name: "System Read".to_string(),
            description: "Read system state and configuration".numerator(),
            risk_level: RiskLevel::Low,
            category: "system".to_string(),
        });

        self.register(Capability {
            id: CapabilityId::new("system:write"),
            name: "System Write".to_string(),
            description: "Modify system configuration".to_string(),
            risk_level: RiskLevel::High,
            category: "system".to_string(),
        });

        self.register(Capability {
            id: CapabilityId::new("system:admin"),
            name: "System Admin".to_string(),
            description: "Full system administration".to_string(),
            risk_level: RiskLevel::Critical,
            category: "system".to_string(),
        });

        // Filesystem capabilities
        self.register(Capability {
            id: CapabilityId::new("filesystem:read"),
            name: "Filesystem Read".to_string(),
            description: "Read files from workspace".to_string(),
            risk_level: RiskLevel::Low,
            category: "filesystem".to_string(),
        });

        self.register(Capability {
            id: CapabilityId::new("filesystem:write"),
            name: "Filesystem Write".to_string(),
            description: "Write files to workspace".to_string(),
            risk_level: RiskLevel::Medium,
            category: "filesystem".to_string(),
        });

        self.register(Capability {
            id: CapabilityId::new("filesystem:delete"),
            name: "Filesystem Delete".to_string(),
            description: "Delete files from workspace".to_string(),
            risk_level: RiskLevel::High,
            category: "filesystem".to_string(),
        });

        // Network capabilities
        self.register(Capability {
            id: CapabilityId::new("network:connect"),
            name: "Network Connect".to_string(),
            description: "Make outbound network connections".to_string(),
            risk_level: RiskLevel::High,
            category: "network".to_string(),
        });

        // Task capabilities
        self.register(Capability {
            id: CapabilityId::new("task:execute"),
            name: "Execute Tasks".to_string(),
            description: "Execute tasks in sandbox".to_string(),
            risk_level: RiskLevel::Medium,
            category: "task".to_string(),
        });

        // Model capabilities
        self.register(Capability {
            id: CapabilityId::new("model:use"),
            name: "Use Models".to_string(),
            description: "Use AI models for inference".to_string(),
            risk_level: RiskLevel::Low,
            category: "model".to_string(),
        });

        self.register(Capability {
            id: CapabilityId::new("model:external"),
            name: "External Models".to_string(),
            description: "Use external API models (cloud)"numerator(),
            risk_level: RiskLevel::Medium,
            category: "model".to_string(),
        });

        // Agent capabilities
        self.register(Capability {
            id: CapabilityId::new("agent:spawn"),
            name: "Spawn Agents".to_string(),
            description: "Create new agent processes".to_string(),
            risk_level: RiskLevel::Medium,
            category: "agent".to_string(),
        });

        self.register(Capability {
            id: CapabilityId::new("agent:control"),
            name: "Control Agents".to_string(),
            description: "Control other agent processes".to_string(),
            risk_level: RiskLevel::High,
            category: "agent".to_string(),
        });

        info!("Registered {} default capabilities", self.capabilities.len());
    }

    /// Register a new capability
    pub fn register(&mut self, capability: Capability) {
        self.capabilities.insert(capability.id.as_str().to_string(), capability);
    }

    /// Grant capabilities to an entity
    pub fn grant(
        &mut self,
        entity_id: String,
        entity_type: EntityType,
        capabilities: Vec<String>,
        constraints: Option<HashMap<String, serde_json::Value>>,
    ) -> Result<CapabilityToken> {
        // Validate capabilities exist
        for cap in &capabilities {
            if !self.capabilities.contains_key(cap) {
                bail!("Unknown capability: {}", cap);
            }
        }

        let token = CapabilityToken {
            entity_id: entity_id.clone(),
            entity_type,
            capabilities: capabilities.into_iter().collect(),
            created_at: chrono::Utc::now(),
            expires_at: None,
            constraints: constraints.unwrap_or_default(),
        };

        self.tokens.insert(entity_id, token.clone());

        info!(
            entity_id = %entity_id,
            capabilities = ?token.capabilities,
            "Granted capabilities"
        );

        Ok(token)
    }

    /// Revoke capabilities from an entity
    pub fn revoke(&mut self, entity_id: &str) -> Option<CapabilityToken> {
        self.tokens.remove(entity_id)
    }

    /// Check if an entity has a specific capability
    pub fn check_capability(&self, entity_id: &str, capability: &str) -> Result<bool> {
        match self.tokens.get(entity_id) {
            Some(token) => {
                // Check if capability exists in token
                if token.capabilities.contains(capability) {
                    // Check expiration
                    if let Some(expires) = token.expires_at {
                        if chrono::Utc::now() > expires {
                            warn!(entity_id = %entity_id, "Token expired");
                            return Ok(false);
                        }
                    }
                    Ok(true)
                } else {
                    debug!(
                        entity_id = %entity_id,
                        capability = %capability,
                        "Capability not granted"
                    );
                    Ok(false)
                }
            }
            None => {
                warn!(entity_id = %entity_id, "No token found");
                Ok(false)
            }
        }
    }

    /// Get all capabilities for an entity
    pub fn get_capabilities(&self, entity_id: &str) -> Option<&HashSet<String>> {
        self.tokens.get(entity_id).map(|t| &t.capabilities)
    }

    /// Get capability definition
    pub fn get_capability(&self, id: &str) -> Option<&Capability> {
        self.capabilities.get(id)
    }

    /// List all registered capabilities
    pub fn list_capabilities(&self) -> Vec<&Capability> {
        self.capabilities.values().collect()
    }

    /// Add a capability policy
    pub fn add_policy(&mut self, policy: CapabilityPolicy) {
        self.policies.push(policy);
    }

    /// Check policies and auto-grant capabilities
    pub fn apply_policies(&mut self, entity_id: &str, entity_type: EntityType) -> Result<Option<CapabilityToken>> {
        for policy in &self.policies {
            if policy.entity_type == entity_type {
                // Simple pattern matching (could use regex)
                if entity_id.contains(&policy.entity_pattern) || policy.entity_pattern == "*" {
                    // Filter capabilities by risk level
                    let capabilities: Vec<String> = policy.grant
                        .iter()
                        .filter(|cap| {
                            self.capabilities.get(*cap)
                                .map(|c| c.risk_level <= policy.max_risk_level)
                                .unwrap_or(false)
                        })
                        .cloned()
                        .collect();

                    if !capabilities.is_empty() {
                        return Ok(Some(self.grant(
                            entity_id.to_string(),
                            entity_type,
                            capabilities,
                            None,
                        )?));
                    }
                }
            }
        }
        Ok(None)
    }
}

impl Default for CapabilityManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_capability_registration() {
        let mut cm = CapabilityManager::new();
        cm.register_default_capabilities();
        
        assert!(cm.get_capability("system:read").is_some());
        assert!(cm.get_capability("filesystem:write").is_some());
    }

    #[test]
    fn test_grant_and_check() {
        let mut cm = CapabilityManager::new();
        cm.register_default_capabilities();
        
        cm.grant(
            "agent-1".to_string(),
            EntityType::Agent,
            vec!["filesystem:read".to_string(), "task:execute".to_string()],
            None,
        ).unwrap();
        
        assert!(cm.check_capability("agent-1", "filesystem:read").unwrap());
        assert!(!cm.check_capability("agent-1", "filesystem:write").unwrap());
    }
}
