//! Kyro AI - AI orchestrator and agent system
//!
//! Provides the AI orchestration layer for autonomous coding,
//! including mission control and agent coordination.

pub mod orchestrator;
pub mod agent;

pub use orchestrator::Orchestrator;
pub use agent::{Agent, AgentRole, AgentStatus};
