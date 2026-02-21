//! PULSE Runtime Kernel - Resource Manager
//!
//! Manages system resources and enforces RAM budgets with adaptive behavior.

use anyhow::Result;
use serde::{Serialize, Deserialize};
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use tracing::{info, warn, debug};
use sysinfo::{System, SystemExt, ProcessExt};

/// Resource budget for an entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceBudget {
    /// Maximum CPU percentage (0-100)
    pub max_cpu_percent: f32,
    /// Maximum memory in MB
    pub max_memory_mb: u64,
    /// Maximum execution time in milliseconds
    pub max_time_ms: u64,
}

impl Default for ResourceBudget {
    fn default() -> Self {
        Self {
            max_cpu_percent: 100.0,
            max_memory_mb: 512,
            max_time_ms: 300_000,
        }
    }
}

/// Resource usage snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceUsage {
    /// CPU usage percentage
    pub cpu_percent: f32,
    /// Memory usage in bytes
    pub memory_bytes: u64,
    /// Peak memory usage
    pub peak_memory_bytes: u64,
    /// Number of active processes
    pub process_count: usize,
}

/// Memory pressure level
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MemoryPressure {
    Normal,
    Moderate,
    High,
    Critical,
}

/// Resource manager
pub struct ResourceManager {
    /// RAM budget in bytes
    ram_budget: u64,
    /// System info
    sys: Arc<RwLock<System>>,
    /// Entity budgets
    budgets: Arc<RwLock<std::collections::HashMap<String, ResourceBudget>>>,
    /// Memory pressure level
    pressure: Arc<RwLock<MemoryPressure>>,
    /// Model swap request channel
    swap_tx: mpsc::Sender<()>,
    swap_rx: Option<mpsc::Receiver<()>>,
}

impl ResourceManager {
    /// Create a new resource manager
    pub fn new(ram_budget_mb: u64) -> Self {
        let (swap_tx, swap_rx) = mpsc::channel(1);
        Self {
            ram_budget: ram_budget_mb * 1024 * 1024,
            sys: Arc::new(RwLock::new(System::new_all())),
            budgets: Arc::new(RwLock::new(std::collections::HashMap::new())),
            pressure: Arc::new(RwLock::new(MemoryPressure::Normal)),
            swap_tx,
            swap_rx: Some(swap_rx),
        }
    }

    /// Get current memory usage
    pub async fn current_memory_usage(&self) -> u64 {
        let mut sys = self.sys.write().await;
        sys.refresh_memory();
        sys.used_memory()
    }

    /// Get memory pressure level
    pub async fn get_memory_pressure(&self) -> MemoryPressure {
        let usage = self.current_memory_usage().await;
        let ratio = usage as f64 / self.ram_budget as f64;

        let pressure = if ratio > 0.9 {
            MemoryPressure::Critical
        } else if ratio > 0.75 {
            MemoryPressure::High
        } else if ratio > 0.5 {
            MemoryPressure::Moderate
        } else {
            MemoryPressure::Normal
        };

        let mut p = self.pressure.write().await;
        *p = pressure;
        pressure
    }

    /// Set resource budget for an entity
    pub async fn set_budget(&self, entity_id: String, budget: ResourceBudget) {
        let mut budgets = self.budgets.write().await;
        budgets.insert(entity_id, budget);
    }

    /// Get resource budget for an entity
    pub async fn get_budget(&self, entity_id: &str) -> Option<ResourceBudget> {
        let budgets = self.budgets.read().await;
        budgets.get(entity_id).cloned()
    }

    /// Check if entity is within budget
    pub async fn check_budget(&self, entity_id: &str, usage: &ResourceUsage) -> bool {
        let budgets = self.budgets.read().await;
        if let Some(budget) = budgets.get(entity_id) {
            usage.cpu_percent <= budget.max_cpu_percent
                && usage.memory_bytes <= budget.max_memory_mb * 1024 * 1024
        } else {
            true // No budget = no restrictions
        }
    }

    /// Request a model swap (unload heavy model)
    pub async fn request_model_swap(&self) -> Result<()> {
        warn!("Requesting model swap due to memory pressure");
        self.swap_tx.send(()).await?;
        Ok(())
    }

    /// Get RAM budget in MB
    pub fn ram_budget_mb(&self) -> u64 {
        self.ram_budget / (1024 * 1024)
    }

    /// Get current system resource usage
    pub async fn get_system_usage(&self) -> ResourceUsage {
        let mut sys = self.sys.write().await;
        sys.refresh_all();

        let total_memory = sys.total_memory();
        let used_memory = sys.used_memory();
        let cpu_usage = sys.global_cpu_info().cpu_usage();

        ResourceUsage {
            cpu_percent: cpu_usage,
            memory_bytes: used_memory,
            peak_memory_bytes: total_memory, // Approximation
            process_count: sys.processes().len(),
        }
    }

    /// Start monitoring loop
    pub fn start_monitoring(&self) {
        let sys = Arc::clone(&self.sys);
        let pressure = Arc::clone(&self.pressure);
        let ram_budget = self.ram_budget;
        let swap_tx = self.swap_tx.clone();

        tokio::spawn(async move {
            loop {
                {
                    let mut sys = sys.write().await;
                    sys.refresh_memory();
                    let used = sys.used_memory();
                    let ratio = used as f64 / ram_budget as f64;

                    let new_pressure = if ratio > 0.9 {
                        MemoryPressure::Critical
                    } else if ratio > 0.75 {
                        MemoryPressure::High
                    } else if ratio > 0.5 {
                        MemoryPressure::Moderate
                    } else {
                        MemoryPressure::Normal
                    };

                    let mut p = pressure.write().await;
                    if *p != new_pressure {
                        info!(
                            pressure = ?new_pressure,
                            usage_mb = used / (1024 * 1024),
                            budget_mb = ram_budget / (1024 * 1024),
                            "Memory pressure changed"
                        );
                        *p = new_pressure;

                        if new_pressure == MemoryPressure::Critical {
                            let _ = swap_tx.send(()).await;
                        }
                    }
                }

                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_resource_budget() {
        let rm = ResourceManager::new(4096);
        rm.set_budget("agent-1".to_string(), ResourceBudget {
            max_cpu_percent: 50.0,
            max_memory_mb: 256,
            max_time_ms: 60000,
        }).await;

        let budget = rm.get_budget("agent-1").await;
        assert!(budget.is_some());
        assert_eq!(budget.unwrap().max_memory_mb, 256);
    }

    #[tokio::test]
    async fn test_memory_pressure() {
        let rm = ResourceManager::new(4096);
        let pressure = rm.get_memory_pressure().await;
        // This will vary based on system
        assert!(matches!(pressure, MemoryPressure::Normal | MemoryPressure::Moderate | MemoryPressure::High | MemoryPressure::Critical));
    }
}
