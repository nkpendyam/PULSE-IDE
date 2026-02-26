//! KRO IDE Unit Tests Module
//!
//! Comprehensive test coverage for all major components:
//! - Authentication & Security
//! - End-to-End Encryption
//! - Collaboration (50 users)
//! - VS Code Compatibility
//! - LSP Integration
//! - AI/LLM Features
//! - Performance & Load Testing

// Auth module tests
mod auth_test;

// E2E encryption tests
mod e2ee_test;

// Collaboration tests
mod collaboration_test;

// VS Code compatibility tests
mod vscode_compat_test;

// LSP and AI tests
mod lsp_test;

// Performance and load tests
mod performance_test;

// Security tests
mod security_test;

/// Test utilities and helpers
pub mod utils {
    use std::time::Duration;

    /// Wait for a condition to be true, with timeout
    pub async fn wait_for<F, Fut>(condition: F, timeout: Duration) -> bool
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = bool>,
    {
        let start = std::time::Instant::now();
        
        while start.elapsed() < timeout {
            if condition().await {
                return true;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
        
        false
    }

    /// Generate random test data
    pub fn random_string(length: usize) -> String {
        use std::iter;
        use rand::Rng;
        
        let mut rng = rand::thread_rng();
        iter::repeat_with(|| rng.sample(rand::distributions::Alphanumeric))
            .map(char::from)
            .take(length)
            .collect()
    }

    /// Generate test user info
    pub fn test_user(id: &str) -> kyro_ide::collaboration::UserInfo {
        kyro_ide::collaboration::UserInfo {
            id: id.to_string(),
            name: format!("Test User {}", id),
            email: Some(format!("{}@test.com", id)),
            avatar: None,
            color: "#FF5733".to_string(),
        }
    }
}

/// Test fixtures
pub mod fixtures {
    use kyro_ide::vscode_compat::*;

    /// Create a test extension manifest
    pub fn test_extension_manifest() -> ExtensionManifest {
        ExtensionManifest {
            name: "test-extension".to_string(),
            version: "1.0.0".to_string(),
            display_name: "Test Extension".to_string(),
            description: Some("A test extension for unit tests".to_string()),
            engines: std::collections::HashMap::from([
                ("vscode".to_string(), "^1.80.0".to_string())
            ]),
            activation_events: vec!["onLanguage:rust".to_string()],
            main: Some("./out/extension.js".to_string()),
            contributes: None,
        }
    }

    /// Create a test text document
    pub fn test_document(content: &str) -> kyro_ide::vscode_compat::TextDocument {
        kyro_ide::vscode_compat::TextDocument::new(
            "file:///test.rs",
            "rust",
            content,
        )
    }
}

/// Performance benchmarks
pub mod benchmark {
    use std::time::{Duration, Instant};

    /// Benchmark result
    pub struct BenchmarkResult {
        pub iterations: u64,
        pub total_duration: Duration,
        pub min_duration: Duration,
        pub max_duration: Duration,
        pub avg_duration: Duration,
        pub p50_duration: Duration,
        pub p99_duration: Duration,
    }

    impl BenchmarkResult {
        pub fn ops_per_second(&self) -> f64 {
            self.iterations as f64 / self.total_duration.as_secs_f64()
        }
    }

    /// Run a benchmark
    pub fn run_benchmark<F>(iterations: u64, mut f: F) -> BenchmarkResult
    where
        F: FnMut(),
    {
        let mut durations = Vec::with_capacity(iterations as usize);
        let start = Instant::now();

        for _ in 0..iterations {
            let iter_start = Instant::now();
            f();
            durations.push(iter_start.elapsed());
        }

        let total_duration = start.elapsed();
        durations.sort();

        let min_duration = *durations.first().unwrap();
        let max_duration = *durations.last().unwrap();
        let avg_duration = Duration::from_nanos(
            durations.iter().map(|d| d.as_nanos() as u64).sum::<u64>() / iterations
        );
        let p50_duration = durations[(iterations as usize * 50) / 100];
        let p99_duration = durations[(iterations as usize * 99) / 100];

        BenchmarkResult {
            iterations,
            total_duration,
            min_duration,
            max_duration,
            avg_duration,
            p50_duration,
            p99_duration,
        }
    }
}

#[cfg(test)]
mod integration_test_harness {
    use super::*;

    /// Test harness for integration tests
    pub struct TestHarness {
        pub temp_dir: tempfile::TempDir,
    }

    impl TestHarness {
        pub fn new() -> Self {
            Self {
                temp_dir: tempfile::tempdir().unwrap(),
            }
        }

        pub fn temp_path(&self) -> &std::path::Path {
            self.temp_dir.path()
        }
    }
}
