//! Memory Governor - Enforce RAM budgets and manage model swapping

use anyhow::Result;
use serde::{Serialize, Deserialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, debug};

/// Memory status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryStatus {
    pub budget_mb: u64,
    pub used_mb: u64,
    pub available_mb: u64,
    pub utilization_percent: f32,
}

/// Memory governor for RAM budget enforcement
pub struct MemoryGovernor {
    budget_mb: u64,
    used: Arc<RwLock<u64>>,
    allocations: Arc<RwLock<Vec<Allocation>>>,
}

#[derive(Debug, Clone)]
struct Allocation {
    model: String,
    size_mb: u64,
    timestamp: chrono::DateTime<chrono::Utc>,
}

impl MemoryGovernor {
    pub fn new(budget_mb: u64) -> Self {
        Self {
            budget_mb,
            used: Arc::new(RwLock::new(0)),
            allocations: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Check if we can allocate the requested amount
    pub async fn can_allocate(&self, size_mb: u64) -> bool {
        let used = *self.used.read().await;
        used + size_mb <= self.budget_mb
    }

    /// Allocate memory
    pub async fn allocate(&self, size_mb: u64) -> Result<()> {
        let mut used = self.used.write().await;
        *used += size_mb;

        debug!(allocated_mb = size_mb, total_used_mb = *used, "Memory allocated");
        Ok(())
    }

    /// Free memory
    pub async fn free(&self, size_mb: u64) {
        let mut used = self.used.write().await;
        *used = used.saturating_sub(size_mb);

        debug!(freed_mb = size_mb, total_used_mb = *used, "Memory freed");
    }

    /// Request a swap to make room for a model
    pub async fn request_swap(&self, required_mb: u64) -> Result<()> {
        let used = *self.used.read().await;
        let available = self.budget_mb.saturating_sub(used);

        if available >= required_mb {
            return Ok(());
        }

        let needed = required_mb - available;
        warn!(
            needed_mb = needed,
            used_mb = used,
            budget_mb = self.budget_mb,
            "Memory swap requested"
        );

        // In a real implementation, would identify least-recently-used models
        // and unload them to make room

        // For now, just simulate freeing
        self.free(needed).await;

        Ok(())
    }

    /// Get current memory status
    pub async fn status(&self) -> MemoryStatus {
        let used = *self.used.read().await;
        let available = self.budget_mb.saturating_sub(used);
        let utilization = if self.budget_mb > 0 {
            (used as f32 / self.budget_mb as f32) * 100.0
        } else {
            0.0
        };

        MemoryStatus {
            budget_mb: self.budget_mb,
            used_mb: used,
            available_mb: available,
            utilization_percent: utilization,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_allocation() {
        let gov = MemoryGovernor::new(1024);

        assert!(gov.can_allocate(512).await);
        gov.allocate(512).await.unwrap();

        assert!(gov.can_allocate(512).await);
        gov.allocate(512).await.unwrap();

        assert!(!gov.can_allocate(1).await);
    }

    #[tokio::test]
    async fn test_free() {
        let gov = MemoryGovernor::new(1024);
        gov.allocate(512).await.unwrap();

        gov.free(256).await;

        let status = gov.status().await;
        assert_eq!(status.used_mb, 256);
        assert_eq!(status.available_mb, 768);
    }
}
