//! AI Agent - Individual agent implementation

use uuid::Uuid;

/// Agent ID
pub type AgentId = Uuid;

/// Agent role
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AgentRole {
    Planner,
    Researcher,
    Coder,
    Tester,
    Reviewer,
    Deployer,
}

/// Agent status
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AgentStatus {
    Idle,
    Working,
    Waiting,
    Failed(String),
}

/// AI Agent
#[derive(Debug, Clone)]
pub struct Agent {
    pub id: AgentId,
    pub role: AgentRole,
    pub status: AgentStatus,
}

impl Agent {
    /// Create a new agent with a specific role
    pub fn new(role: AgentRole) -> Self {
        Self {
            id: Uuid::new_v4(),
            role,
            status: AgentStatus::Idle,
        }
    }

    /// Get the agent's role
    pub fn role(&self) -> AgentRole {
        self.role
    }

    /// Get the agent's status
    pub fn status(&self) -> &AgentStatus {
        &self.status
    }

    /// Set the agent's status
    pub fn set_status(&mut self, status: AgentStatus) {
        self.status = status;
    }
}

#[cfg(all(test, feature = "fixme_tests"))]
mod tests {
    use super::*;

    #[test]
    fn test_agent_creation() {
        let agent = Agent::new(AgentRole::Coder);
        assert_eq!(agent.role(), AgentRole::Coder);
        assert_eq!(agent.status(), &AgentStatus::Idle);
    }

    #[test]
    fn test_agent_status_update() {
        let mut agent = Agent::new(AgentRole::Tester);
        agent.set_status(AgentStatus::Working);
        assert_eq!(agent.status(), &AgentStatus::Working);
    }
}
