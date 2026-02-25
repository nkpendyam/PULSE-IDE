//! Performance Benchmark Utilities for KRO_IDE
//!
//! This module provides comprehensive benchmarking capabilities for:
//! - Cold/warm startup times
//! - File operation performance
//! - AI inference latency
//! - LSP completion response times
//! - Memory usage tracking
//! - Collaboration sync latency

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

pub mod startup;
pub mod file_ops;
pub mod ai_latency;
pub mod lsp_perf;
pub mod memory;

pub use startup::StartupBenchmark;
pub use file_ops::FileOpsBenchmark;
pub use ai_latency::AILatencyBenchmark;
pub use lsp_perf::LSPPerfBenchmark;
pub use memory::MemoryBenchmark;

/// Benchmark configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkConfig {
    /// Number of iterations for each benchmark
    pub iterations: usize,
    /// Warmup iterations (not counted)
    pub warmup_iterations: usize,
    /// Enable detailed memory tracking
    pub track_memory: bool,
    /// Enable CPU profiling
    pub profile_cpu: bool,
    /// Output format
    pub output_format: OutputFormat,
    /// Save results to file
    pub save_results: bool,
    /// Results file path
    pub results_path: Option<String>,
}

impl Default for BenchmarkConfig {
    fn default() -> Self {
        Self {
            iterations: 100,
            warmup_iterations: 10,
            track_memory: true,
            profile_cpu: false,
            output_format: OutputFormat::Json,
            save_results: true,
            results_path: Some("benchmark_results.json".to_string()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OutputFormat {
    Json,
    Csv,
    Markdown,
    Html,
}

/// Single benchmark result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkResult {
    pub name: String,
    pub category: BenchmarkCategory,
    pub iterations: usize,
    pub total_duration_ms: f64,
    pub avg_duration_ms: f64,
    pub min_duration_ms: f64,
    pub max_duration_ms: f64,
    pub p50_duration_ms: f64,
    pub p95_duration_ms: f64,
    pub p99_duration_ms: f64,
    pub std_dev_ms: f64,
    pub operations_per_second: f64,
    pub memory_used_bytes: Option<u64>,
    pub timestamp: DateTime<Utc>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BenchmarkCategory {
    Startup,
    FileOperations,
    AIInference,
    LSPCompletion,
    Memory,
    Collaboration,
    Terminal,
    Plugin,
}

/// Benchmark suite results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkSuite {
    pub name: String,
    pub version: String,
    pub platform: String,
    pub timestamp: DateTime<Utc>,
    pub results: Vec<BenchmarkResult>,
    pub summary: BenchmarkSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkSummary {
    pub total_tests: usize,
    pub passed: usize,
    pub failed: usize,
    pub total_duration_secs: f64,
    pub critical_failures: Vec<String>,
}

/// Benchmark runner
pub struct BenchmarkRunner {
    config: BenchmarkConfig,
    results: Vec<BenchmarkResult>,
}

impl BenchmarkRunner {
    /// Create a new benchmark runner
    pub fn new(config: BenchmarkConfig) -> Self {
        Self {
            config,
            results: Vec::new(),
        }
    }

    /// Run a single benchmark
    pub fn run_benchmark<F>(
        &mut self,
        name: &str,
        category: BenchmarkCategory,
        mut benchmark_fn: F,
    ) -> Result<BenchmarkResult>
    where
        F: FnMut() -> Result<Duration>,
    {
        // Warmup
        for _ in 0..self.config.warmup_iterations {
            let _ = benchmark_fn();
        }

        // Actual benchmark
        let mut durations = Vec::with_capacity(self.config.iterations);
        let mut total_memory = 0u64;

        for _ in 0..self.config.iterations {
            let memory_before = if self.config.track_memory {
                get_memory_usage()
            } else {
                0
            };

            let duration = benchmark_fn()?;
            durations.push(duration);

            if self.config.track_memory {
                total_memory += get_memory_usage().saturating_sub(memory_before);
            }
        }

        // Calculate statistics
        let durations_ms: Vec<f64> = durations.iter()
            .map(|d| d.as_secs_f64() * 1000.0)
            .collect();

        let total_duration_ms: f64 = durations_ms.iter().sum();
        let avg_duration_ms = total_duration_ms / self.config.iterations as f64;
        let min_duration_ms = durations_ms.iter().cloned().fold(f64::INFINITY, f64::min);
        let max_duration_ms = durations_ms.iter().cloned().fold(0.0, f64::max);
        let std_dev_ms = calculate_std_dev(&durations_ms, avg_duration_ms);
        let p50_duration_ms = percentile(&durations_ms, 50.0);
        let p95_duration_ms = percentile(&durations_ms, 95.0);
        let p99_duration_ms = percentile(&durations_ms, 99.0);
        let operations_per_second = 1000.0 / avg_duration_ms;

        let result = BenchmarkResult {
            name: name.to_string(),
            category,
            iterations: self.config.iterations,
            total_duration_ms,
            avg_duration_ms,
            min_duration_ms,
            max_duration_ms,
            p50_duration_ms,
            p95_duration_ms,
            p99_duration_ms,
            std_dev_ms,
            operations_per_second,
            memory_used_bytes: if self.config.track_memory {
                Some(total_memory / self.config.iterations as u64)
            } else {
                None
            },
            timestamp: Utc::now(),
            metadata: HashMap::new(),
        };

        self.results.push(result.clone());
        Ok(result)
    }

    /// Run all benchmarks
    pub fn run_all(&mut self) -> Result<BenchmarkSuite> {
        let start = Instant::now();

        // Run startup benchmarks
        let startup = StartupBenchmark::new();
        startup.run(self)?;

        // Run file operation benchmarks
        let file_ops = FileOpsBenchmark::new();
        file_ops.run(self)?;

        // Run AI latency benchmarks
        let ai = AILatencyBenchmark::new();
        ai.run(self)?;

        // Run LSP performance benchmarks
        let lsp = LSPPerfBenchmark::new();
        lsp.run(self)?;

        // Run memory benchmarks
        let memory = MemoryBenchmark::new();
        memory.run(self)?;

        let total_duration = start.elapsed();

        // Create summary
        let summary = BenchmarkSummary {
            total_tests: self.results.len(),
            passed: self.results.iter().filter(|r| r.avg_duration_ms < 1000.0).count(),
            failed: self.results.iter().filter(|r| r.avg_duration_ms >= 1000.0).count(),
            total_duration_secs: total_duration.as_secs_f64(),
            critical_failures: self.results.iter()
                .filter(|r| r.avg_duration_ms >= 5000.0)
                .map(|r| r.name.clone())
                .collect(),
        };

        Ok(BenchmarkSuite {
            name: "KRO_IDE Performance Suite".to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            platform: get_platform_info(),
            timestamp: Utc::now(),
            results: self.results.clone(),
            summary,
        })
    }

    /// Save results to file
    pub fn save_results(&self, path: &str) -> Result<()> {
        let json = serde_json::to_string_pretty(&self.results)?;
        std::fs::write(path, json)?;
        Ok(())
    }

    /// Get all results
    pub fn get_results(&self) -> &[BenchmarkResult] {
        &self.results
    }
}

/// Trait for benchmark modules
pub trait BenchmarkModule {
    fn run(&self, runner: &mut BenchmarkRunner) -> Result<()>;
}

// Helper functions

fn get_memory_usage() -> u64 {
    // Use system info to get current process memory
    // This is a simplified version - real implementation would use platform-specific APIs
    #[cfg(target_os = "linux")]
    {
        if let Ok(contents) = std::fs::read_to_string("/proc/self/status") {
            for line in contents.lines() {
                if line.starts_with("VmRSS:") {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 2 {
                        return parts[1].parse().unwrap_or(0) * 1024;
                    }
                }
            }
        }
    }
    0
}

fn calculate_std_dev(values: &[f64], mean: f64) -> f64 {
    if values.is_empty() {
        return 0.0;
    }
    let variance = values.iter()
        .map(|x| (x - mean).powi(2))
        .sum::<f64>() / values.len() as f64;
    variance.sqrt()
}

fn percentile(values: &[f64], p: f64) -> f64 {
    if values.is_empty() {
        return 0.0;
    }
    let mut sorted = values.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let index = (p / 100.0 * (sorted.len() - 1) as f64).floor() as usize;
    sorted[index.min(sorted.len() - 1)]
}

fn get_platform_info() -> String {
    format!("{}-{}", std::env::consts::OS, std::env::consts::ARCH)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_benchmark_runner() {
        let config = BenchmarkConfig {
            iterations: 10,
            warmup_iterations: 2,
            ..Default::default()
        };
        let mut runner = BenchmarkRunner::new(config);
        
        let result = runner.run_benchmark(
            "test_benchmark",
            BenchmarkCategory::Startup,
            || Ok(Duration::from_millis(10)),
        ).unwrap();
        
        assert_eq!(result.iterations, 10);
        assert!(result.avg_duration_ms > 0.0);
    }

    #[test]
    fn test_percentile() {
        let values = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        assert_eq!(percentile(&values, 50.0), 3.0);
        assert_eq!(percentile(&values, 0.0), 1.0);
        assert_eq!(percentile(&values, 100.0), 5.0);
    }
}
