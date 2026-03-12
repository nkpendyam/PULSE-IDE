//! Kyro AI - AI orchestrator and agent system
//!
//! Provides the AI orchestration layer for autonomous coding,
//! including mission control and agent coordination.

#![allow(dead_code, unused_variables, unused_imports)]

pub mod agent;
pub mod orchestrator;

pub use agent::{Agent, AgentRole, AgentStatus};
pub use orchestrator::Orchestrator;
