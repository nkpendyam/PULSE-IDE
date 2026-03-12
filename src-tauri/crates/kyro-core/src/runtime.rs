//! Tokio async runtime configuration
//!
//! Provides configuration for the tokio async runtime with
//! optimized thread pool settings for Kyro IDE.

use crate::error::{KyroError, KyroResult};
use std::time::Duration;

/// Runtime configuration for tokio
#[derive(Debug, Clone)]
pub struct RuntimeConfig {
    /// Number of worker threads (defaults to CPU cores)
    pub worker_threads: usize,

    /// Maximum number of blocking threads
    pub max_blocking_threads: usize,

    /// Thread stack size in bytes
    pub thread_stack_size: usize,

    /// Thread name prefix
    pub thread_name: String,

    /// Enable thread keep-alive
    pub thread_keep_alive: Option<Duration>,

    /// Enable time driver
    pub enable_time: bool,

    /// Enable IO driver
    pub enable_io: bool,
}

impl RuntimeConfig {
    /// Create a new runtime configuration with defaults
    pub fn new() -> Self {
        Self::default()
    }

    /// Set the number of worker threads
    pub fn with_worker_threads(mut self, threads: usize) -> Self {
        self.worker_threads = threads;
        self
    }

    /// Set the maximum number of blocking threads
    pub fn with_max_blocking_threads(mut self, threads: usize) -> Self {
        self.max_blocking_threads = threads;
        self
    }

    /// Set the thread stack size
    pub fn with_thread_stack_size(mut self, size: usize) -> Self {
        self.thread_stack_size = size;
        self
    }

    /// Set the thread name prefix
    pub fn with_thread_name(mut self, name: impl Into<String>) -> Self {
        self.thread_name = name.into();
        self
    }

    /// Set thread keep-alive duration
    pub fn with_thread_keep_alive(mut self, duration: Duration) -> Self {
        self.thread_keep_alive = Some(duration);
        self
    }

    /// Build a tokio runtime with this configuration
    pub fn build_runtime(&self) -> KyroResult<tokio::runtime::Runtime> {
        let mut builder = tokio::runtime::Builder::new_multi_thread();

        builder
            .worker_threads(self.worker_threads)
            .max_blocking_threads(self.max_blocking_threads)
            .thread_stack_size(self.thread_stack_size)
            .thread_name(&self.thread_name);

        if let Some(keep_alive) = self.thread_keep_alive {
            builder.thread_keep_alive(keep_alive);
        }

        if self.enable_time {
            builder.enable_time();
        }

        if self.enable_io {
            builder.enable_io();
        }

        builder
            .build()
            .map_err(|e| KyroError::config(format!("Failed to build runtime: {}", e)))
    }

    /// Get recommended configuration for the current system
    pub fn recommended() -> Self {
        let cpu_cores = num_cpus::get();

        Self {
            worker_threads: cpu_cores,
            max_blocking_threads: cpu_cores * 4,
            thread_stack_size: 2 * 1024 * 1024, // 2MB
            thread_name: "kyro-worker".to_string(),
            thread_keep_alive: Some(Duration::from_secs(10)),
            enable_time: true,
            enable_io: true,
        }
    }

    /// Get configuration optimized for low-resource systems
    pub fn low_resource() -> Self {
        Self {
            worker_threads: 2,
            max_blocking_threads: 4,
            thread_stack_size: 1024 * 1024, // 1MB
            thread_name: "kyro-worker".to_string(),
            thread_keep_alive: Some(Duration::from_secs(5)),
            enable_time: true,
            enable_io: true,
        }
    }

    /// Get configuration optimized for high-performance systems
    pub fn high_performance() -> Self {
        let cpu_cores = num_cpus::get();

        Self {
            worker_threads: cpu_cores * 2,
            max_blocking_threads: cpu_cores * 8,
            thread_stack_size: 4 * 1024 * 1024, // 4MB
            thread_name: "kyro-worker".to_string(),
            thread_keep_alive: Some(Duration::from_secs(30)),
            enable_time: true,
            enable_io: true,
        }
    }
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        let cpu_cores = num_cpus::get();

        Self {
            worker_threads: cpu_cores,
            max_blocking_threads: 512,
            thread_stack_size: 2 * 1024 * 1024, // 2MB
            thread_name: "kyro-worker".to_string(),
            thread_keep_alive: None,
            enable_time: true,
            enable_io: true,
        }
    }
}

#[cfg(all(test, feature = "fixme_tests"))]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = RuntimeConfig::default();
        assert!(config.worker_threads > 0);
        assert!(config.max_blocking_threads > 0);
        assert_eq!(config.thread_name, "kyro-worker");
    }

    #[test]
    fn test_builder_pattern() {
        let config = RuntimeConfig::new()
            .with_worker_threads(4)
            .with_max_blocking_threads(16)
            .with_thread_name("test-worker");

        assert_eq!(config.worker_threads, 4);
        assert_eq!(config.max_blocking_threads, 16);
        assert_eq!(config.thread_name, "test-worker");
    }

    #[test]
    fn test_recommended_config() {
        let config = RuntimeConfig::recommended();
        assert!(config.worker_threads > 0);
        assert!(config.thread_keep_alive.is_some());
    }

    #[test]
    fn test_low_resource_config() {
        let config = RuntimeConfig::low_resource();
        assert_eq!(config.worker_threads, 2);
        assert_eq!(config.max_blocking_threads, 4);
    }

    #[test]
    fn test_high_performance_config() {
        let config = RuntimeConfig::high_performance();
        assert!(config.worker_threads >= num_cpus::get());
    }
}
