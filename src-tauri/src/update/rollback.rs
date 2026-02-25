//! Rollback System for KRO_IDE
//!
//! Provides safe rollback capabilities for failed updates

use super::*;
use anyhow::{Result, Context};
use std::path::PathBuf;
use std::collections::VecDeque;

/// Rollback manager
pub struct RollbackManager {
    versions_dir: PathBuf,
    max_versions: usize,
    restore_points: VecDeque<RestorePoint>,
}

/// Restore point for rollback
#[derive(Debug, Clone)]
pub struct RestorePoint {
    pub id: String,
    pub version: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub path: PathBuf,
    pub reason: String,
}

impl RollbackManager {
    pub fn new(versions_dir: PathBuf) -> Result<Self> {
        std::fs::create_dir_all(&versions_dir)?;
        
        Ok(Self {
            versions_dir,
            max_versions: 5,
            restore_points: VecDeque::new(),
        })
    }
    
    /// Create a restore point before update
    pub fn create_restore_point(&mut self) -> Result<String> {
        let current_version = env!("CARGO_PKG_VERSION").to_string();
        let id = uuid::Uuid::new_v4().to_string();
        let timestamp = chrono::Utc::now();
        
        let restore_dir = self.versions_dir.join("restore_points").join(&id);
        std::fs::create_dir_all(&restore_dir)?;
        
        // Copy current version to restore point
        let current_dir = self.versions_dir.join("current");
        if current_dir.exists() {
            self.copy_dir_recursive(&current_dir, &restore_dir)?;
        }
        
        let point = RestorePoint {
            id: id.clone(),
            version: current_version,
            timestamp,
            path: restore_dir,
            reason: "Pre-update backup".to_string(),
        };
        
        self.restore_points.push_back(point);
        
        // Clean up old restore points
        while self.restore_points.len() > self.max_versions {
            if let Some(old) = self.restore_points.pop_front() {
                let _ = std::fs::remove_dir_all(&old.path);
            }
        }
        
        log::info!("Created restore point: {}", id);
        Ok(id)
    }
    
    /// Rollback to previous version
    pub fn rollback(&self) -> Result<()> {
        // Find most recent restore point
        let restore_points_dir = self.versions_dir.join("restore_points");
        
        if !restore_points_dir.exists() {
            anyhow::bail!("No restore points available");
        }
        
        // Get most recent restore point
        let mut restore_points: Vec<_> = std::fs::read_dir(&restore_points_dir)?
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_dir())
            .collect();
        
        if restore_points.is_empty() {
            anyhow::bail!("No restore points available");
        }
        
        // Sort by modification time (most recent first)
        restore_points.sort_by(|a, b| {
            b.metadata().and_then(|m| m.modified()).unwrap_or(std::time::SystemTime::UNIX_EPOCH)
                .cmp(&a.metadata().and_then(|m| m.modified()).unwrap_or(std::time::SystemTime::UNIX_EPOCH))
        });
        
        let latest = restore_points.first()
            .ok_or_else(|| anyhow::anyhow!("No restore points available"))?;
        
        let restore_path = latest.path();
        let current_dir = self.versions_dir.join("current");
        
        // Move current to failed
        let failed_dir = self.versions_dir.join("failed_updates")
            .join(chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string());
        std::fs::create_dir_all(&failed_dir)?;
        
        if current_dir.exists() {
            std::fs::rename(&current_dir, &failed_dir)?;
        }
        
        // Restore from backup
        self.copy_dir_recursive(&restore_path, &current_dir)?;
        
        log::info!("Rollback completed successfully");
        Ok(())
    }
    
    /// Rollback to specific restore point
    pub fn rollback_to(&self, point_id: &str) -> Result<()> {
        let restore_path = self.versions_dir.join("restore_points").join(point_id);
        
        if !restore_path.exists() {
            anyhow::bail!("Restore point not found: {}", point_id);
        }
        
        let current_dir = self.versions_dir.join("current");
        
        // Move current to failed
        let failed_dir = self.versions_dir.join("failed_updates")
            .join(chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string());
        std::fs::create_dir_all(&failed_dir)?;
        
        if current_dir.exists() {
            std::fs::rename(&current_dir, &failed_dir)?;
        }
        
        // Restore from backup
        self.copy_dir_recursive(&restore_path, &current_dir)?;
        
        log::info!("Rollback to {} completed successfully", point_id);
        Ok(())
    }
    
    /// List available restore points
    pub fn list_restore_points(&self) -> Vec<RestorePoint> {
        self.restore_points.iter().cloned().collect()
    }
    
    /// Copy directory recursively
    fn copy_dir_recursive(&self, src: &PathBuf, dst: &PathBuf) -> Result<()> {
        std::fs::create_dir_all(dst)?;
        
        for entry in std::fs::read_dir(src)? {
            let entry = entry?;
            let ty = entry.file_type()?;
            let src_path = entry.path();
            let dst_path = dst.join(entry.file_name());
            
            if ty.is_dir() {
                self.copy_dir_recursive(&src_path, &dst_path)?;
            } else {
                std::fs::copy(&src_path, &dst_path)?;
            }
        }
        
        Ok(())
    }
}

/// Health monitor for detecting update failures
pub struct HealthMonitor {
    crash_count: std::sync::atomic::AtomicU32,
    last_check: std::sync::Mutex<Option<std::time::Instant>>,
    health_status: std::sync::atomic::AtomicU8,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum HealthStatus {
    Healthy = 0,
    Degraded = 1,
    Unhealthy = 2,
    Critical = 3,
}

impl HealthMonitor {
    pub fn new() -> Self {
        Self {
            crash_count: std::sync::atomic::AtomicU32::new(0),
            last_check: std::sync::Mutex::new(None),
            health_status: std::sync::atomic::AtomicU8::new(HealthStatus::Healthy as u8),
        }
    }
    
    /// Report a crash
    pub fn report_crash(&self) {
        self.crash_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        self.update_health_status();
    }
    
    /// Check if rollback is needed
    pub fn should_rollback(&self) -> bool {
        let crashes = self.crash_count.load(std::sync::atomic::Ordering::Relaxed);
        crashes >= 3
    }
    
    /// Get current health status
    pub fn health(&self) -> HealthStatus {
        match self.health_status.load(std::sync::atomic::Ordering::Relaxed) {
            0 => HealthStatus::Healthy,
            1 => HealthStatus::Degraded,
            2 => HealthStatus::Unhealthy,
            _ => HealthStatus::Critical,
        }
    }
    
    /// Update health status based on crash count
    fn update_health_status(&self) {
        let crashes = self.crash_count.load(std::sync::atomic::Ordering::Relaxed);
        
        let status = match crashes {
            0 => HealthStatus::Healthy,
            1 => HealthStatus::Degraded,
            2 => HealthStatus::Unhealthy,
            _ => HealthStatus::Critical,
        };
        
        self.health_status.store(status as u8, std::sync::atomic::Ordering::Relaxed);
    }
    
    /// Reset crash count (after successful operation)
    pub fn reset(&self) {
        self.crash_count.store(0, std::sync::atomic::Ordering::Relaxed);
        self.health_status.store(HealthStatus::Healthy as u8, std::sync::atomic::Ordering::Relaxed);
    }
    
    /// Perform health check
    pub fn check(&self) -> HealthReport {
        HealthReport {
            status: self.health(),
            crash_count: self.crash_count.load(std::sync::atomic::Ordering::Relaxed),
            memory_usage: self.get_memory_usage(),
            should_rollback: self.should_rollback(),
        }
    }
    
    fn get_memory_usage(&self) -> u64 {
        // Would query actual memory usage
        0
    }
}

/// Health report
#[derive(Debug, Clone)]
pub struct HealthReport {
    pub status: HealthStatus,
    pub crash_count: u32,
    pub memory_usage: u64,
    pub should_rollback: bool,
}

impl Default for HealthMonitor {
    fn default() -> Self {
        Self::new()
    }
}
