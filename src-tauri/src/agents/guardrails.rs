//! Agent Resource Guardrails
//! 
//! Enforces memory, CPU, and runtime limits on agent processes.

use std::time::{Duration, Instant};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;

use crate::agents::{AgentError, AgentConfig};

/// Resource monitor for agent processes
pub struct AgentGuardrails {
    max_memory: usize,
    max_cpu: f32,
    max_duration: Duration,
    monitoring_active: Arc<AtomicBool>,
}

impl AgentGuardrails {
    /// Create new guardrails with specified limits
    pub fn new(config: &AgentConfig) -> Self {
        Self {
            max_memory: config.max_memory_mb * 1024 * 1024, // Convert MB to bytes
            max_cpu: config.max_cpu_percent,
            max_duration: Duration::from_secs(config.max_runtime_secs),
            monitoring_active: Arc::new(AtomicBool::new(false)),
        }
    }
    
    /// Create with default limits (2GB, 50% CPU, 10min)
    pub fn default_limits() -> Self {
        Self {
            max_memory: 2 * 1024 * 1024 * 1024, // 2GB
            max_cpu: 50.0,
            max_duration: Duration::from_secs(600),
            monitoring_active: Arc::new(AtomicBool::new(false)),
        }
    }
    
    /// Check if a process is within resource limits
    pub fn check_limits(&self, memory_usage: usize, cpu_usage: f32) -> Result<(), AgentError> {
        // Memory check
        if memory_usage > self.max_memory {
            return Err(AgentError::MemoryLimitExceeded {
                used: memory_usage,
                limit: self.max_memory,
            });
        }
        
        // CPU check (warning only, don't error)
        if cpu_usage > self.max_cpu {
            log::warn!(
                "Agent CPU usage {:.1}% exceeds limit {:.1}%",
                cpu_usage, self.max_cpu
            );
        }
        
        Ok(())
    }
    
    /// Start monitoring a process
    pub fn start_monitoring(&self, start_time: Instant) -> Arc<AtomicBool> {
        let active = Arc::new(AtomicBool::new(true));
        let active_clone = active.clone();
        let max_duration = self.max_duration;
        
        thread::spawn(move || {
            while active_clone.load(Ordering::Relaxed) {
                let elapsed = start_time.elapsed();
                
                if elapsed > max_duration {
                    log::error!(
                        "Agent runtime exceeded: {:?} > {:?}",
                        elapsed, max_duration
                    );
                    active_clone.store(false, Ordering::Relaxed);
                    break;
                }
                
                thread::sleep(Duration::from_secs(1));
            }
        });
        
        active
    }
    
    /// Check if runtime has been exceeded
    pub fn check_runtime(&self, start_time: Instant) -> Result<(), AgentError> {
        let elapsed = start_time.elapsed();
        if elapsed > self.max_duration {
            return Err(AgentError::RuntimeExceeded {
                elapsed,
                limit: self.max_duration,
            });
        }
        Ok(())
    }
    
    /// Stop monitoring
    pub fn stop_monitoring(&self) {
        self.monitoring_active.store(false, Ordering::Relaxed);
    }
    
    /// Get memory limit in bytes
    pub fn memory_limit(&self) -> usize {
        self.max_memory
    }
    
    /// Get CPU limit as percentage
    pub fn cpu_limit(&self) -> f32 {
        self.max_cpu
    }
    
    /// Get runtime limit
    pub fn runtime_limit(&self) -> Duration {
        self.max_duration
    }
    
    /// Format limits for display
    pub fn format_limits(&self) -> String {
        format!(
            "Memory: {} MB, CPU: {}%, Runtime: {:?}",
            self.max_memory / 1024 / 1024,
            self.max_cpu,
            self.max_duration
        )
    }
}

/// Resource usage snapshot
#[derive(Debug, Clone)]
pub struct ResourceUsage {
    pub memory_bytes: usize,
    pub cpu_percent: f32,
    pub runtime_secs: u64,
}

impl ResourceUsage {
    /// Check if usage exceeds guardrails
    pub fn check(&self, guardrails: &AgentGuardrails) -> Result<(), AgentError> {
        guardrails.check_limits(self.memory_bytes, self.cpu_percent)?;
        guardrails.check_runtime(Instant::now() - Duration::from_secs(self.runtime_secs))
    }
    
    /// Format for display
    pub fn format(&self) -> String {
        format!(
            "Memory: {:.1} MB, CPU: {:.1}%, Runtime: {:?}",
            self.memory_bytes as f64 / 1024.0 / 1024.0,
            self.cpu_percent,
            Duration::from_secs(self.runtime_secs)
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_default_limits() {
        let guardrails = AgentGuardrails::default_limits();
        assert_eq!(guardrails.memory_limit(), 2 * 1024 * 1024 * 1024);
        assert_eq!(guardrails.cpu_limit(), 50.0);
    }
    
    #[test]
    fn test_memory_limit_exceeded() {
        let guardrails = AgentGuardrails::default_limits();
        let result = guardrails.check_limits(3 * 1024 * 1024 * 1024, 30.0);
        assert!(result.is_err());
    }
    
    #[test]
    fn test_within_limits() {
        let guardrails = AgentGuardrails::default_limits();
        let result = guardrails.check_limits(1024 * 1024 * 1024, 30.0); // 1GB, 30% CPU
        assert!(result.is_ok());
    }
}
