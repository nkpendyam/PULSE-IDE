//! File Operations Benchmarks
//!
//! Measures file I/O performance for KRO_IDE

use anyhow::Result;
use std::time::Duration;
use super::{BenchmarkRunner, BenchmarkModule, BenchmarkCategory};

pub struct FileOpsBenchmark {
    test_dir: std::path::PathBuf,
}

impl FileOpsBenchmark {
    pub fn new() -> Self {
        Self {
            test_dir: std::env::temp_dir().join("kro_benchmark_files"),
        }
    }

    fn setup(&self) -> Result<()> {
        std::fs::create_dir_all(&self.test_dir)?;
        Ok(())
    }

    fn cleanup(&self) -> Result<()> {
        if self.test_dir.exists() {
            std::fs::remove_dir_all(&self.test_dir)?;
        }
        Ok(())
    }

    fn measure_small_file_read(&self) -> Result<Duration> {
        let file_path = self.test_dir.join("small_test.txt");
        let content = "Hello, World!".repeat(100); // ~1.3 KB
        
        std::fs::write(&file_path, &content)?;
        
        let start = std::time::Instant::now();
        let _ = std::fs::read(&file_path)?;
        let elapsed = start.elapsed();
        
        std::fs::remove_file(&file_path)?;
        Ok(elapsed)
    }

    fn measure_large_file_read(&self) -> Result<Duration> {
        let file_path = self.test_dir.join("large_test.txt");
        let content = "x".repeat(1_000_000); // 1 MB
        
        std::fs::write(&file_path, &content)?;
        
        let start = std::time::Instant::now();
        let _ = std::fs::read(&file_path)?;
        let elapsed = start.elapsed();
        
        std::fs::remove_file(&file_path)?;
        Ok(elapsed)
    }

    fn measure_file_write(&self) -> Result<Duration> {
        let file_path = self.test_dir.join("write_test.txt");
        let content = "x".repeat(100_000); // 100 KB
        
        let start = std::time::Instant::now();
        std::fs::write(&file_path, &content)?;
        let elapsed = start.elapsed();
        
        std::fs::remove_file(&file_path)?;
        Ok(elapsed)
    }

    fn measure_directory_listing(&self) -> Result<Duration> {
        // Create test directory structure
        for i in 0..100 {
            let file_path = self.test_dir.join(format!("file_{}.txt", i));
            std::fs::write(&file_path, "test")?;
        }
        
        let start = std::time::Instant::now();
        let _entries: Vec<_> = std::fs::read_dir(&self.test_dir)?.collect();
        let elapsed = start.elapsed();
        
        // Cleanup
        for i in 0..100 {
                let file_path = self.test_dir.join(format!("file_{}.txt", i));
                std::fs::remove_file(&file_path)?;
            }
        
        Ok(elapsed)
    }

    fn measure_file_tree_generation(&self) -> Result<Duration> {
        // Create nested directory structure
        for i in 0..10 {
            let dir = self.test_dir.join(format!("dir_{}", i));
            std::fs::create_dir_all(&dir)?;
            for j in 0..10 {
                let file = dir.join(format!("file_{}.txt", j));
                std::fs::write(&file, "test")?;
            }
        }
        
        let start = std::time::Instant::now();
        let _ = self.walk_directory(&self.test_dir)?;
        let elapsed = start.elapsed();
        
        // Cleanup
        for i in 0..10 {
            let dir = self.test_dir.join(format!("dir_{}", i));
            std::fs::remove_dir_all(&dir)?;
        }
        
        Ok(elapsed)
    }

    fn walk_directory(&self, path: &std::path::Path) -> Result<Vec<std::path::PathBuf>> {
        let mut files = Vec::new();
        if path.is_dir() {
            for entry in std::fs::read_dir(path)? {
                let entry = entry?;
                let path = entry.path();
                if path.is_dir() {
                    files.extend(self.walk_directory(&path)?);
                } else {
                    files.push(path);
                }
            }
        }
        Ok(files)
    }
}

impl BenchmarkModule for FileOpsBenchmark {
    fn run(&self, runner: &mut BenchmarkRunner) -> Result<()> {
        self.setup()?;

        // Small file read benchmark
        runner.run_benchmark(
            "small_file_read",
            BenchmarkCategory::FileOperations,
            || self.measure_small_file_read(),
        )?;

        // Large file read benchmark
        runner.run_benchmark(
            "large_file_read",
            BenchmarkCategory::FileOperations,
            || self.measure_large_file_read(),
        )?;

        // File write benchmark
        runner.run_benchmark(
            "file_write",
            BenchmarkCategory::FileOperations,
            || self.measure_file_write(),
        )?;

        // Directory listing benchmark
        runner.run_benchmark(
            "directory_listing",
            BenchmarkCategory::FileOperations,
            || self.measure_directory_listing(),
        )?;

        // File tree generation benchmark
        runner.run_benchmark(
            "file_tree_generation",
            BenchmarkCategory::FileOperations,
            || self.measure_file_tree_generation(),
        )?;

        self.cleanup()?;
        Ok(())
    }
}

impl Default for FileOpsBenchmark {
    fn default() -> Self {
        Self::new()
    }
}
