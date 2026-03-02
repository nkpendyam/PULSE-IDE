//! Common types used across Kyro IDE
//!
//! Provides shared type definitions for IDs, configurations, and other
//! common data structures.

use serde::{Deserialize, Serialize};
use std::fmt;
use uuid::Uuid;

/// Unique identifier for services
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ServiceId(Uuid);

impl ServiceId {
    /// Create a new random service ID
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }

    /// Create a service ID from a UUID
    pub fn from_uuid(uuid: Uuid) -> Self {
        Self(uuid)
    }

    /// Get the inner UUID
    pub fn as_uuid(&self) -> &Uuid {
        &self.0
    }
}

impl Default for ServiceId {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Display for ServiceId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Service status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ServiceStatus {
    /// Service is not initialized
    Uninitialized,
    /// Service is initializing
    Initializing,
    /// Service is running normally
    Running,
    /// Service is paused
    Paused,
    /// Service is shutting down
    ShuttingDown,
    /// Service has stopped
    Stopped,
    /// Service encountered an error
    Error,
}

impl fmt::Display for ServiceStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Uninitialized => write!(f, "Uninitialized"),
            Self::Initializing => write!(f, "Initializing"),
            Self::Running => write!(f, "Running"),
            Self::Paused => write!(f, "Paused"),
            Self::ShuttingDown => write!(f, "Shutting Down"),
            Self::Stopped => write!(f, "Stopped"),
            Self::Error => write!(f, "Error"),
        }
    }
}

/// Service health status
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HealthStatus {
    /// Whether the service is healthy
    pub healthy: bool,
    /// Optional message describing the health status
    pub message: Option<String>,
    /// Timestamp of the health check
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

impl HealthStatus {
    /// Create a healthy status
    pub fn healthy() -> Self {
        Self {
            healthy: true,
            message: None,
            timestamp: chrono::Utc::now(),
        }
    }

    /// Create an unhealthy status with a message
    pub fn unhealthy(message: impl Into<String>) -> Self {
        Self {
            healthy: false,
            message: Some(message.into()),
            timestamp: chrono::Utc::now(),
        }
    }
}

/// Configuration trait for services
pub trait Config: Send + Sync + Clone + fmt::Debug {
    /// Validate the configuration
    fn validate(&self) -> crate::error::KyroResult<()> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_service_id() {
        let id1 = ServiceId::new();
        let id2 = ServiceId::new();
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_service_status_display() {
        assert_eq!(ServiceStatus::Running.to_string(), "Running");
        assert_eq!(ServiceStatus::Error.to_string(), "Error");
    }

    #[test]
    fn test_health_status() {
        let healthy = HealthStatus::healthy();
        assert!(healthy.healthy);
        assert!(healthy.message.is_none());

        let unhealthy = HealthStatus::unhealthy("Service down");
        assert!(!unhealthy.healthy);
        assert_eq!(unhealthy.message.as_deref(), Some("Service down"));
    }
}
