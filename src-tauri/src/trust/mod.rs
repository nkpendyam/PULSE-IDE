//! Agent Permission System - Trust Layer
//!
//! Granular permission system for AI agents.
//! Agents must request permission before performing operations.
//!
//! This addresses the critical gap: "If an AI agent runs rm -rf, the IDE is dead on arrival"

pub mod permissions;
pub mod requests;
pub mod audit;
pub mod sandbox;

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use chrono::{DateTime, Utc};

pub use permissions::*;
pub use requests::*;
pub use audit::*;
pub use sandbox::*;

/// Agent identity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentIdentity {
    pub id: String,
    pub name: String,
    pub version: String,
    pub publisher: String,
    pub trust_level: TrustLevel,
    pub granted_permissions: HashSet<Permission>,
    pub created_at: DateTime<Utc>,
}

/// Trust levels for agents
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TrustLevel {
    /// Untrusted - requires approval for every action
    Untrusted,
    /// Limited - can read files, requires approval for writes
    Limited,
    /// Trusted - can modify files, requires approval for dangerous ops
    Trusted,
    /// System - full access (only for built-in agents)
    System,
}

impl Default for TrustLevel {
    fn default() -> Self {
        Self::Untrusted
    }
}

/// Permission types
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Permission {
    // File operations
    ReadFile(PathPattern),
    WriteFile(PathPattern),
    DeleteFile(PathPattern),
    CreateFile(PathPattern),
    
    // Directory operations
    ListDirectory(PathPattern),
    CreateDirectory(PathPattern),
    DeleteDirectory(PathPattern),
    
    // Code operations
    EditCode(PathPattern),
    RunTests,
    ExecuteCommand(CommandPattern),
    
    // Git operations
    GitStatus,
    GitCommit,
    GitPush,
    GitPull,
    GitBranch,
    
    // Network operations
    NetworkRequest(UrlPattern),
    WebSocketConnection(UrlPattern),
    
    // AI operations
    GenerateCode,
    ModifyCode(PathPattern),
    ExecuteTerminal,
    
    // System operations
    AccessClipboard,
    AccessEnvironment,
    SpawnProcess,
}

/// Path pattern for permissions
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PathPattern {
    pub pattern: String,
    pub recursive: bool,
}

impl PathPattern {
    pub fn matches(&self, path: &str) -> bool {
        if self.pattern == "*" {
            return true;
        }
        
        if self.recursive {
            path.starts_with(&self.pattern) || glob_match::glob_match(&self.pattern, path)
        } else {
            path == self.pattern || glob_match::glob_match(&self.pattern, path)
        }
    }
}

/// Command pattern for permissions
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CommandPattern {
    pub command: String,
    pub allowed_args: Option<Vec<String>>,
}

/// URL pattern for network permissions
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct UrlPattern {
    pub pattern: String,
}

/// Permission request from an agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionRequest {
    pub id: String,
    pub agent_id: String,
    pub permission: Permission,
    pub context: String,
    pub risk_level: RiskLevel,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// Risk levels for operations
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RiskLevel {
    /// Safe operation (read-only)
    Safe,
    /// Low risk (write to non-critical files)
    Low,
    /// Medium risk (write to any file, run tests)
    Medium,
    /// High risk (delete files, run commands)
    High,
    /// Critical (system operations, network access)
    Critical,
}

/// Permission decision
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionDecision {
    pub request_id: String,
    pub granted: bool,
    pub scope: PermissionScope,
    pub expires_at: Option<DateTime<Utc>>,
    pub decided_at: DateTime<Utc>,
    pub reason: Option<String>,
}

/// Scope of granted permission
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PermissionScope {
    /// One-time only
    Once,
    /// For this session
    Session,
    /// For a duration
    Duration(chrono::Duration),
    /// Forever (until revoked)
    Permanent,
}

/// Permission manager
pub struct PermissionManager {
    agents: HashMap<String, AgentIdentity>,
    pending_requests: HashMap<String, PermissionRequest>,
    decisions: HashMap<String, PermissionDecision>,
    audit_log: Vec<AuditEntry>,
    auto_approve_safe: bool,
    require_approval_for: HashSet<RiskLevel>,
}

impl PermissionManager {
    pub fn new() -> Self {
        let mut require_approval_for = HashSet::new();
        require_approval_for.insert(RiskLevel::Medium);
        require_approval_for.insert(RiskLevel::High);
        require_approval_for.insert(RiskLevel::Critical);
        
        Self {
            agents: HashMap::new(),
            pending_requests: HashMap::new(),
            decisions: HashMap::new(),
            audit_log: Vec::new(),
            auto_approve_safe: true,
            require_approval_for,
        }
    }
    
    /// Register a new agent
    pub fn register_agent(&mut self, identity: AgentIdentity) {
        self.agents.insert(identity.id.clone(), identity);
        
        self.audit_log.push(AuditEntry {
            timestamp: Utc::now(),
            event: AuditEvent::AgentRegistered {
                agent_id: identity.id.clone(),
                name: identity.name.clone(),
            },
        });
    }
    
    /// Request permission for an operation
    pub fn request_permission(
        &mut self,
        agent_id: &str,
        permission: Permission,
        context: &str,
    ) -> PermissionResult {
        let agent = self.agents.get(agent_id)
            .ok_or_else(|| anyhow::anyhow!("Agent not registered: {}", agent_id))?;
        
        // Check if already granted
        if agent.granted_permissions.contains(&permission) {
            return PermissionResult::Granted {
                reason: "Permission already granted".to_string(),
            };
        }
        
        // Calculate risk level
        let risk_level = self.calculate_risk(&permission);
        
        // Auto-approve safe operations if configured
        if self.auto_approve_safe && risk_level == RiskLevel::Safe {
            self.audit_log.push(AuditEntry {
                timestamp: Utc::now(),
                event: AuditEvent::PermissionAutoApproved {
                    agent_id: agent_id.to_string(),
                    permission: format!("{:?}", permission),
                },
            });
            
            return PermissionResult::Granted {
                reason: "Safe operation auto-approved".to_string(),
            };
        }
        
        // Check trust level
        match agent.trust_level {
            TrustLevel::System => {
                return PermissionResult::Granted {
                    reason: "System agent has full access".to_string(),
                };
            }
            TrustLevel::Trusted if risk_level <= RiskLevel::Medium => {
                return PermissionResult::Granted {
                    reason: "Trusted agent with appropriate risk level".to_string(),
                };
            }
            TrustLevel::Limited if risk_level == RiskLevel::Safe => {
                return PermissionResult::Granted {
                    reason: "Limited agent, safe operation".to_string(),
                };
            }
            _ => {}
        }
        
        // Create permission request
        let request = PermissionRequest {
            id: uuid::Uuid::new_v4().to_string(),
            agent_id: agent_id.to_string(),
            permission,
            context: context.to_string(),
            risk_level,
            expires_at: Some(Utc::now() + chrono::Duration::minutes(5)),
            created_at: Utc::now(),
        };
        
        let request_id = request.id.clone();
        self.pending_requests.insert(request_id.clone(), request.clone());
        
        PermissionResult::PendingApproval { request }
    }
    
    /// Grant a permission request
    pub fn grant_request(&mut self, request_id: &str, scope: PermissionScope, reason: Option<String>) -> Result<()> {
        let request = self.pending_requests.remove(request_id)
            .ok_or_else(|| anyhow::anyhow!("Request not found: {}", request_id))?;
        
        let decision = PermissionDecision {
            request_id: request_id.to_string(),
            granted: true,
            scope,
            expires_at: None,
            decided_at: Utc::now(),
            reason,
        };
        
        // Add permission to agent
        if let Some(agent) = self.agents.get_mut(&request.agent_id) {
            agent.granted_permissions.insert(request.permission.clone());
        }
        
        self.decisions.insert(request_id.to_string(), decision.clone());
        
        self.audit_log.push(AuditEntry {
            timestamp: Utc::now(),
            event: AuditEvent::PermissionGranted {
                agent_id: request.agent_id,
                permission: format!("{:?}", request.permission),
            },
        });
        
        Ok(())
    }
    
    /// Deny a permission request
    pub fn deny_request(&mut self, request_id: &str, reason: &str) -> Result<()> {
        let request = self.pending_requests.remove(request_id)
            .ok_or_else(|| anyhow::anyhow!("Request not found: {}", request_id))?;
        
        let decision = PermissionDecision {
            request_id: request_id.to_string(),
            granted: false,
            scope: PermissionScope::Once,
            expires_at: None,
            decided_at: Utc::now(),
            reason: Some(reason.to_string()),
        };
        
        self.decisions.insert(request_id.to_string(), decision);
        
        self.audit_log.push(AuditEntry {
            timestamp: Utc::now(),
            event: AuditEvent::PermissionDenied {
                agent_id: request.agent_id,
                permission: format!("{:?}", request.permission),
                reason: reason.to_string(),
            },
        });
        
        Ok(())
    }
    
    /// Check if an operation is allowed
    pub fn is_allowed(&self, agent_id: &str, permission: &Permission) -> bool {
        if let Some(agent) = self.agents.get(agent_id) {
            if agent.granted_permissions.contains(permission) {
                return true;
            }
            
            // Check trust level for safe operations
            let risk = self.calculate_risk(permission);
            match agent.trust_level {
                TrustLevel::System => true,
                TrustLevel::Trusted => risk <= RiskLevel::Medium,
                TrustLevel::Limited => risk == RiskLevel::Safe,
                TrustLevel::Untrusted => false,
            }
        } else {
            false
        }
    }
    
    /// Calculate risk level for a permission
    fn calculate_risk(&self, permission: &Permission) -> RiskLevel {
        match permission {
            Permission::ReadFile(_) |
            Permission::ListDirectory(_) |
            Permission::GitStatus => RiskLevel::Safe,
            
            Permission::CreateFile(_) |
            Permission::CreateDirectory(_) |
            Permission::EditCode(_) |
            Permission::GenerateCode |
            Permission::GitPull |
            Permission::GitBranch => RiskLevel::Low,
            
            Permission::WriteFile(_) |
            Permission::ModifyCode(_) |
            Permission::RunTests |
            Permission::GitCommit => RiskLevel::Medium,
            
            Permission::DeleteFile(_) |
            Permission::DeleteDirectory(_) |
            Permission::ExecuteCommand(_) |
            Permission::ExecuteTerminal |
            Permission::GitPush => RiskLevel::High,
            
            Permission::NetworkRequest(_) |
            Permission::WebSocketConnection(_) |
            Permission::SpawnProcess |
            Permission::AccessEnvironment => RiskLevel::Critical,
            
            Permission::AccessClipboard => RiskLevel::Low,
        }
    }
    
    /// Revoke all permissions for an agent
    pub fn revoke_all(&mut self, agent_id: &str) {
        if let Some(agent) = self.agents.get_mut(agent_id) {
            agent.granted_permissions.clear();
            agent.trust_level = TrustLevel::Untrusted;
        }
        
        self.audit_log.push(AuditEntry {
            timestamp: Utc::now(),
            event: AuditEvent::PermissionsRevoked {
                agent_id: agent_id.to_string(),
            },
        });
    }
    
    /// Get pending requests for UI
    pub fn get_pending_requests(&self) -> Vec<&PermissionRequest> {
        self.pending_requests.values().collect()
    }
    
    /// Get audit log
    pub fn get_audit_log(&self, limit: usize) -> Vec<&AuditEntry> {
        self.audit_log.iter().rev().take(limit).collect()
    }
}

/// Result of a permission request
#[derive(Debug, Clone)]
pub enum PermissionResult {
    Granted { reason: String },
    PendingApproval { request: PermissionRequest },
    Denied { reason: String },
}

/// Audit entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub timestamp: DateTime<Utc>,
    pub event: AuditEvent,
}

/// Audit events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuditEvent {
    AgentRegistered { agent_id: String, name: String },
    PermissionRequested { agent_id: String, permission: String },
    PermissionGranted { agent_id: String, permission: String },
    PermissionDenied { agent_id: String, permission: String, reason: String },
    PermissionAutoApproved { agent_id: String, permission: String },
    PermissionsRevoked { agent_id: String },
    OperationBlocked { agent_id: String, permission: String, reason: String },
}

impl Default for PermissionManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_permission_flow() {
        let mut manager = PermissionManager::new();
        
        // Register agent
        let agent = AgentIdentity {
            id: "test-agent".to_string(),
            name: "Test Agent".to_string(),
            version: "1.0".to_string(),
            publisher: "Test".to_string(),
            trust_level: TrustLevel::Limited,
            granted_permissions: HashSet::new(),
            created_at: Utc::now(),
        };
        
        manager.register_agent(agent);
        
        // Request read permission (safe, auto-approved)
        let result = manager.request_permission(
            "test-agent",
            Permission::ReadFile(PathPattern {
                pattern: "/src/**/*.rs".to_string(),
                recursive: true,
            }),
            "Reading source files",
        );
        
        match result {
            PermissionResult::Granted { .. } => {}
            _ => panic!("Expected granted for safe operation"),
        }
        
        // Request write permission (needs approval)
        let result = manager.request_permission(
            "test-agent",
            Permission::WriteFile(PathPattern {
                pattern: "/src/main.rs".to_string(),
                recursive: false,
            }),
            "Modifying main.rs",
        );
        
        match result {
            PermissionResult::PendingApproval { .. } => {}
            _ => panic!("Expected pending approval"),
        }
    }
}
