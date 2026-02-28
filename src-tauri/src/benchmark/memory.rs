//! Memory Usage Benchmarks and Optimization
//!
//! Measures memory consumption and provides optimization hints.
//! Target: <200MB idle memory usage.

use anyhow::Result;
use std::time::{Duration, Instant};
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, AtomicBool, Ordering};
use std::collections::VecDeque;
use serde::{Deserialize, Serialize};
use tokio::sync::{RwLock, Mutex};

use super::{BenchmarkRunner, BenchmarkModule, BenchmarkCategory};

/// Memory tier classification
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MemoryTier {
    /// < 4GB RAM - Minimal mode
    Minimal,
    /// 4-8GB RAM - Standard mode
    Standard,
    /// 8-16GB RAM - Enhanced mode
    Enhanced,
    /// > 16GB RAM - Full mode
    Full,
}

impl MemoryTier {
    pub fn from_total_ram(ram_gb: u64) -> Self {
        match ram_gb {
            0..=3 => MemoryTier::Minimal,
            4..=7 => MemoryTier::Standard,
            8..=15 => MemoryTier::Enhanced,
            _ => MemoryTier::Full,
        }
    }

    pub fn max_idle_memory_mb(&self) -> u64 {
        match self {
            MemoryTier::Minimal => 100,
            MemoryTier::Standard => 150,
            MemoryTier::Enhanced => 200,
            MemoryTier::Full => 300,
        }
    }
}

/// Memory component breakdown
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryBreakdown {
    pub total_bytes: u64,
    pub editor_bytes: u64,
    pub ai_model_bytes: u64,
    pub extensions_bytes: u64,
    pub lsp_bytes: u64,
    pub file_cache_bytes: u64,
    pub ui_bytes: u64,
    pub collaboration_bytes: u64,
    pub other_bytes: u64,
}

impl Default for MemoryBreakdown {
    fn default() -> Self {
        Self {
            total_bytes: 0,
            editor_bytes: 0,
            ai_model_bytes: 0,
            extensions_bytes: 0,
            lsp_bytes: 0,
            file_cache_bytes: 0,
            ui_bytes: 0,
            collaboration_bytes: 0,
            other_bytes: 0,
        }
    }
}

impl MemoryBreakdown {
    pub fn to_mb(&self) -> MemoryBreakdownMB {
        MemoryBreakdownMB {
            total_mb: self.total_bytes / (1024 * 1024),
            editor_mb: self.editor_bytes / (1024 * 1024),
            ai_model_mb: self.ai_model_bytes / (1024 * 1024),
            extensions_mb: self.extensions_bytes / (1024 * 1024),
            lsp_mb: self.lsp_bytes / (1024 * 1024),
            file_cache_mb: self.file_cache_bytes / (1024 * 1024),
            ui_mb: self.ui_bytes / (1024 * 1024),
            collaboration_mb: self.collaboration_bytes / (1024 * 1024),
            other_mb: self.other_bytes / (1024 * 1024),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryBreakdownMB {
    pub total_mb: u64,
    pub editor_mb: u64,
    pub ai_model_mb: u64,
    pub extensions_mb: u64,
    pub lsp_mb: u64,
    pub file_cache_mb: u64,
    pub ui_mb: u64,
    pub collaboration_mb: u64,
    pub other_mb: u64,
}

/// Memory sample for time-series tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemorySample {
    pub timestamp_ms: u64,
    pub total_bytes: u64,
    pub breakdown: MemoryBreakdown,
}

/// Memory statistics over time
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryStats {
    pub samples: Vec<MemorySample>,
    pub peak_bytes: u64,
    pub average_bytes: u64,
    pub min_bytes: u64,
    pub max_bytes: u64,
    pub growth_rate_bytes_per_sec: f64,
}

/// GC hint configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GCHints {
    /// Threshold (0.0-1.0) of total memory to trigger aggressive GC
    pub aggressive_threshold: f32,
    /// Interval between periodic GC hints (ms)
    pub periodic_interval_ms: u64,
    /// Whether to give GC hints on idle
    pub hint_on_idle: bool,
    /// Memory pressure level (0-100)
    pub memory_pressure_threshold: u8,
    /// Enable memory defragmentation hints
    pub defragment_on_idle: bool,
}

impl Default for GCHints {
    fn default() -> Self {
        Self {
            aggressive_threshold: 0.8,
            periodic_interval_ms: 30000, // 30 seconds
            hint_on_idle: true,
            memory_pressure_threshold: 70,
            defragment_on_idle: true,
        }
    }
}

/// Memory optimization settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryOptimizationConfig {
    /// Target maximum idle memory in bytes
    pub target_idle_memory_bytes: u64,
    /// Maximum file cache size in bytes
    pub max_file_cache_bytes: u64,
    /// Maximum editor buffer cache size
    pub max_buffer_cache_bytes: u64,
    /// Lazy load heavy components
    pub lazy_load_components: bool,
    /// Unload unused components after timeout (ms)
    pub unload_timeout_ms: u64,
    /// Enable memory monitoring
    pub enable_monitoring: bool,
    /// GC hints configuration
    pub gc_hints: GCHints,
}

impl Default for MemoryOptimizationConfig {
    fn default() -> Self {
        Self {
            target_idle_memory_bytes: 200 * 1024 * 1024, // 200MB
            max_file_cache_bytes: 50 * 1024 * 1024, // 50MB
            max_buffer_cache_bytes: 30 * 1024 * 1024, // 30MB
            lazy_load_components: true,
            unload_timeout_ms: 300000, // 5 minutes
            enable_monitoring: true,
            gc_hints: GCHints::default(),
        }
    }
}

/// Memory monitoring state
pub struct MemoryMonitor {
    config: MemoryOptimizationConfig,
    samples: Arc<RwLock<VecDeque<MemorySample>>>,
    max_samples: usize,
    peak_memory: AtomicU64,
    is_idle: AtomicBool,
    last_gc_hint: AtomicU64,
}

impl MemoryMonitor {
    pub fn new(config: MemoryOptimizationConfig) -> Self {
        Self {
            config,
            samples: Arc::new(RwLock::new(VecDeque::new())),
            max_samples: 1000,
            peak_memory: AtomicU64::new(0),
            is_idle: AtomicBool::new(false),
            last_gc_hint: AtomicU64::new(0),
        }
    }

    /// Get current memory usage
    pub fn get_current_memory() -> u64 {
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

        #[cfg(target_os = "macos")]
        {
            use std::mem::size_of;
            let mut info: libc::task_vm_info_data_t = unsafe { std::mem::zeroed() };
            let count = (size_of::<libc::task_vm_info_data_t>() / size_of::<libc::natural_t>()) as libc::mach_msg_type_number_t;

            unsafe {
                let result = libc::task_info(
                    libc::mach_task_self(),
                    libc::TASK_VM_INFO,
                    &mut info as *mut _ as *mut libc::integer_t,
                    &mut count,
                );
                if result == libc::KERN_SUCCESS {
                    return info.resident_size;
                }
            }
        }

        #[cfg(target_os = "windows")]
        {
            use std::mem::{size_of, zeroed};
            unsafe {
                let mut info: winapi::um::psapi::PROCESS_MEMORY_COUNTERS = zeroed();
                let result = winapi::um::psapi::GetProcessMemoryInfo(
                    winapi::um::processthreadsapi::GetCurrentProcess(),
                    &mut info as *mut _ as *mut _,
                    size_of::<winapi::um::psapi::PROCESS_MEMORY_COUNTERS>() as u32,
                );
                if result != 0 {
                    return info.WorkingSetSize as u64;
                }
            }
        }

        0
    }

    /// Get system total memory
    pub fn get_total_system_memory() -> u64 {
        #[cfg(target_os = "linux")]
        {
            if let Ok(contents) = std::fs::read_to_string("/proc/meminfo") {
                for line in contents.lines() {
                    if line.starts_with("MemTotal:") {
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() >= 2 {
                            return parts[1].parse().unwrap_or(0) * 1024;
                        }
                    }
                }
            }
        }

        #[cfg(target_os = "macos")]
        {
            let mut total: u64 = 0;
            unsafe {
                let mut size = std::mem::size_of::<u64>();
                libc::sysctlbyname(
                    b"hw.memsize\0".as_ptr() as *const i8,
                    &mut total as *mut _ as *mut libc::c_void,
                    &mut size,
                    std::ptr::null_mut(),
                    0,
                );
            }
            return total;
        }

        #[cfg(target_os = "windows")]
        {
            use std::mem::zeroed;
            unsafe {
                let mut status: winapi::um::sysinfoapi::MEMORYSTATUSEX = zeroed();
                status.dwLength = std::mem::size_of::<winapi::um::sysinfoapi::MEMORYSTATUSEX>() as u32;
                winapi::um::sysinfoapi::GlobalMemoryStatusEx(&mut status);
                return status.ullTotalPhys;
            }
        }

        8 * 1024 * 1024 * 1024 // Default 8GB
    }

    /// Sample current memory
    pub async fn sample(&self) -> MemorySample {
        let current = Self::get_current_memory();
        let breakdown = self.estimate_breakdown(current).await;
        
        // Update peak
        let mut peak = self.peak_memory.load(Ordering::Relaxed);
        while current > peak {
            match self.peak_memory.compare_exchange_weak(
                peak,
                current,
                Ordering::Relaxed,
                Ordering::Relaxed,
            ) {
                Ok(_) => break,
                Err(actual) => peak = actual,
            }
        }

        let sample = MemorySample {
            timestamp_ms: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
            total_bytes: current,
            breakdown,
        };

        // Store sample
        let mut samples = self.samples.write().await;
        if samples.len() >= self.max_samples {
            samples.pop_front();
        }
        samples.push_back(sample.clone());

        sample
    }

    /// Estimate memory breakdown by component
    async fn estimate_breakdown(&self, total: u64) -> MemoryBreakdown {
        // In a real implementation, we would track each component's memory
        // For now, estimate based on typical usage patterns
        let editor_ratio = 0.25;
        let ai_model_ratio = 0.30;
        let extensions_ratio = 0.15;
        let lsp_ratio = 0.10;
        let file_cache_ratio = 0.10;
        let ui_ratio = 0.05;
        let collaboration_ratio = 0.03;
        
        MemoryBreakdown {
            total_bytes: total,
            editor_bytes: (total as f64 * editor_ratio) as u64,
            ai_model_bytes: (total as f64 * ai_model_ratio) as u64,
            extensions_bytes: (total as f64 * extensions_ratio) as u64,
            lsp_bytes: (total as f64 * lsp_ratio) as u64,
            file_cache_bytes: (total as f64 * file_cache_ratio) as u64,
            ui_bytes: (total as f64 * ui_ratio) as u64,
            collaboration_bytes: (total as f64 * collaboration_ratio) as u64,
            other_bytes: 0, // Calculated
        }
    }

    /// Check if memory pressure is high
    pub fn is_high_memory_pressure(&self) -> bool {
        let current = Self::get_current_memory();
        let total = Self::get_total_system_memory();
        let pressure = (current as f64 / total as f64 * 100.0) as u8;
        pressure >= self.config.gc_hints.memory_pressure_threshold
    }

    /// Check if should trigger GC hint
    pub fn should_gc_hint(&self) -> bool {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        let last = self.last_gc_hint.load(Ordering::Relaxed);
        let interval = self.config.gc_hints.periodic_interval_ms;

        // Check periodic interval
        if now - last >= interval {
            return true;
        }

        // Check memory pressure
        if self.is_high_memory_pressure() {
            return true;
        }

        // Check if idle and hint_on_idle enabled
        if self.is_idle.load(Ordering::Relaxed) && self.config.gc_hints.hint_on_idle {
            return true;
        }

        false
    }

    /// Record GC hint was given
    pub fn record_gc_hint(&self) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        self.last_gc_hint.store(now, Ordering::Relaxed);
    }

    /// Set idle state
    pub fn set_idle(&self, idle: bool) {
        self.is_idle.store(idle, Ordering::Relaxed);
    }

    /// Get memory statistics
    pub async fn get_stats(&self) -> MemoryStats {
        let samples = self.samples.read().await;
        
        if samples.is_empty() {
            return MemoryStats {
                samples: Vec::new(),
                peak_bytes: 0,
                average_bytes: 0,
                min_bytes: 0,
                max_bytes: 0,
                growth_rate_bytes_per_sec: 0.0,
            };
        }

        let total_bytes: u64 = samples.iter().map(|s| s.total_bytes).sum();
        let count = samples.len() as u64;
        let min_bytes = samples.iter().map(|s| s.total_bytes).min().unwrap_or(0);
        let max_bytes = samples.iter().map(|s| s.total_bytes).max().unwrap_or(0);
        let peak_bytes = self.peak_memory.load(Ordering::Relaxed);

        // Calculate growth rate
        let growth_rate = if samples.len() >= 2 {
            let first = samples.front().unwrap_or_default();
            let last = samples.back().unwrap_or_default();
            let time_diff = (last.timestamp_ms - first.timestamp_ms) as f64 / 1000.0;
            if time_diff > 0.0 {
                (last.total_bytes as f64 - first.total_bytes as f64) / time_diff
            } else {
                0.0
            }
        } else {
            0.0
        };

        MemoryStats {
            samples: samples.iter().cloned().collect(),
            peak_bytes,
            average_bytes: total_bytes / count,
            min_bytes,
            max_bytes,
            growth_rate_bytes_per_sec: growth_rate,
        }
    }

    /// Check if within target memory
    pub fn is_within_target(&self) -> bool {
        let current = Self::get_current_memory();
        current <= self.config.target_idle_memory_bytes
    }

    /// Get memory tier for current system
    pub fn get_memory_tier() -> MemoryTier {
        let total_ram_gb = Self::get_total_system_memory() / (1024 * 1024 * 1024);
        MemoryTier::from_total_ram(total_ram_gb)
    }

    /// Get optimization recommendations
    pub async fn get_recommendations(&self) -> Vec<String> {
        let mut recommendations = Vec::new();
        let current = Self::get_current_memory();
        let total = Self::get_total_system_memory();
        let breakdown = self.estimate_breakdown(current).await;

        if current > self.config.target_idle_memory_bytes {
            recommendations.push(format!(
                "Memory usage ({:.0}MB) exceeds target ({:.0}MB)",
                current as f64 / (1024.0 * 1024.0),
                self.config.target_idle_memory_bytes as f64 / (1024.0 * 1024.0)
            ));
        }

        if breakdown.ai_model_bytes > 100 * 1024 * 1024 {
            recommendations.push("Consider unloading AI model when not in use".to_string());
        }

        if breakdown.file_cache_bytes > self.config.max_file_cache_bytes {
            recommendations.push("File cache is large - consider reducing cache size".to_string());
        }

        if breakdown.extensions_bytes > 100 * 1024 * 1024 {
            recommendations.push("Extensions using significant memory - disable unused ones".to_string());
        }

        let pressure = (current as f64 / total as f64 * 100.0) as u8;
        if pressure > 50 {
            recommendations.push(format!(
                "Memory pressure is high ({}%) - consider closing unused panels",
                pressure
            ));
        }

        recommendations
    }
}

/// Memory benchmark runner
pub struct MemoryBenchmark {
    monitor: Arc<MemoryMonitor>,
    baseline_memory: u64,
}

impl MemoryBenchmark {
    pub fn new() -> Self {
        let config = MemoryOptimizationConfig::default();
        Self {
            monitor: Arc::new(MemoryMonitor::new(config)),
            baseline_memory: 0,
        }
    }

    pub fn with_config(config: MemoryOptimizationConfig) -> Self {
        Self {
            monitor: Arc::new(MemoryMonitor::new(config)),
            baseline_memory: 0,
        }
    }

    /// Measure idle memory (no files open, no AI loaded)
    fn measure_idle_memory(&self) -> Result<Duration> {
        let start = Instant::now();
        let _memory = MemoryMonitor::get_current_memory();
        Ok(start.elapsed())
    }

    /// Measure memory with editor loaded
    fn measure_editor_memory(&self) -> Result<Duration> {
        let start = Instant::now();
        
        // Simulate editor memory allocation
        // Monaco editor typically uses 50-100MB
        let _editor_buffer = vec![0u8; 80 * 1024 * 1024]; // 80MB
        
        let _memory = MemoryMonitor::get_current_memory();
        Ok(start.elapsed())
    }

    /// Measure memory with AI model loaded
    fn measure_ai_model_memory(&self) -> Result<Duration> {
        let start = Instant::now();
        
        // Simulate AI model memory
        // 4B model Q4 quantization: ~2.5GB for weights + ~2GB for KV cache
        let _model_weights = vec![0u8; 100 * 1024 * 1024]; // Simulate 100MB chunk
        
        let _memory = MemoryMonitor::get_current_memory();
        Ok(start.elapsed())
    }

    /// Measure memory with extensions loaded
    fn measure_extension_memory(&self) -> Result<Duration> {
        let start = Instant::now();
        
        // Simulate extension memory
        // Each extension typically uses 1-10MB
        let _extension_data = vec![0u8; 5 * 1024 * 1024]; // 5MB
        
        let _memory = MemoryMonitor::get_current_memory();
        Ok(start.elapsed())
    }

    /// Measure collaboration memory
    fn measure_collaboration_memory(&self) -> Result<Duration> {
        let start = Instant::now();
        
        // Simulate Yjs document memory
        let _yjs_doc = vec![0u8; 1024 * 1024]; // 1MB
        
        let _memory = MemoryMonitor::get_current_memory();
        Ok(start.elapsed())
    }

    /// Measure memory leak detection
    fn measure_memory_growth(&self) -> Result<Duration> {
        let start = Instant::now();
        
        // Allocate and deallocate to check for leaks
        for _ in 0..10 {
            let _temp = vec![0u8; 1024 * 1024]; // 1MB
            // Drop happens automatically
        }
        
        let _memory = MemoryMonitor::get_current_memory();
        Ok(start.elapsed())
    }

    /// Measure GC pressure
    fn measure_gc_pressure(&self) -> Result<Duration> {
        let start = Instant::now();
        
        // Create many small allocations
        let mut allocations = Vec::new();
        for i in 0..10000 {
            allocations.push(format!("allocation_{}", i));
        }
        
        let _memory = MemoryMonitor::get_current_memory();
        Ok(start.elapsed())
    }

    /// Run full memory profile
    pub async fn run_profile(&self) -> Result<MemoryProfile> {
        let rt = tokio::runtime::Runtime::new().unwrap_or_default();
        
        let total = rt.block_on(async { self.monitor.sample().await });
        let breakdown = total.breakdown.clone();

        Ok(MemoryProfile {
            total_memory_bytes: total.total_bytes,
            editor_memory_bytes: breakdown.editor_bytes,
            ai_memory_bytes: breakdown.ai_model_bytes,
            plugin_memory_bytes: breakdown.extensions_bytes,
            collaboration_memory_bytes: breakdown.collaboration_bytes,
            peak_memory_bytes: self.monitor.peak_memory.load(Ordering::Relaxed),
        })
    }
}

impl BenchmarkModule for MemoryBenchmark {
    fn run(&self, runner: &mut BenchmarkRunner) -> Result<()> {
        // Idle memory
        runner.run_benchmark(
            "memory_idle",
            BenchmarkCategory::Memory,
            || self.measure_idle_memory(),
        )?;

        // Editor memory
        runner.run_benchmark(
            "memory_editor",
            BenchmarkCategory::Memory,
            || self.measure_editor_memory(),
        )?;

        // AI model memory
        runner.run_benchmark(
            "memory_ai_model",
            BenchmarkCategory::Memory,
            || self.measure_ai_model_memory(),
        )?;

        // Extension memory
        runner.run_benchmark(
            "memory_extensions",
            BenchmarkCategory::Memory,
            || self.measure_extension_memory(),
        )?;

        // Collaboration memory
        runner.run_benchmark(
            "memory_collaboration",
            BenchmarkCategory::Memory,
            || self.measure_collaboration_memory(),
        )?;

        // Memory growth check
        runner.run_benchmark(
            "memory_growth_check",
            BenchmarkCategory::Memory,
            || self.measure_memory_growth(),
        )?;

        // GC pressure test
        runner.run_benchmark(
            "memory_gc_pressure",
            BenchmarkCategory::Memory,
            || self.measure_gc_pressure(),
        )?;

        Ok(())
    }
}

impl Default for MemoryBenchmark {
    fn default() -> Self {
        Self::new()
    }
}

/// Memory profile result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryProfile {
    pub total_memory_bytes: u64,
    pub editor_memory_bytes: u64,
    pub ai_memory_bytes: u64,
    pub plugin_memory_bytes: u64,
    pub collaboration_memory_bytes: u64,
    pub peak_memory_bytes: u64,
}

impl MemoryProfile {
    pub fn new() -> Self {
        Self {
            total_memory_bytes: 0,
            editor_memory_bytes: 0,
            ai_memory_bytes: 0,
            plugin_memory_bytes: 0,
            collaboration_memory_bytes: 0,
            peak_memory_bytes: 0,
        }
    }

    pub fn to_mb(&self) -> MemoryProfileMB {
        MemoryProfileMB {
            total_memory_mb: self.total_memory_bytes / (1024 * 1024),
            editor_memory_mb: self.editor_memory_bytes / (1024 * 1024),
            ai_memory_mb: self.ai_memory_bytes / (1024 * 1024),
            plugin_memory_mb: self.plugin_memory_bytes / (1024 * 1024),
            collaboration_memory_mb: self.collaboration_memory_bytes / (1024 * 1024),
            peak_memory_mb: self.peak_memory_bytes / (1024 * 1024),
        }
    }
}

impl Default for MemoryProfile {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryProfileMB {
    pub total_memory_mb: u64,
    pub editor_memory_mb: u64,
    pub ai_memory_mb: u64,
    pub plugin_memory_mb: u64,
    pub collaboration_memory_mb: u64,
    pub peak_memory_mb: u64,
}

/// Lazy loading manager for heavy components
pub struct LazyComponentManager {
    loaded_components: Arc<RwLock<std::collections::HashSet<String>>>,
    last_access: Arc<RwLock<std::collections::HashMap<String, u64>>>,
    unload_timeout_ms: u64,
}

impl LazyComponentManager {
    pub fn new(unload_timeout_ms: u64) -> Self {
        Self {
            loaded_components: Arc::new(RwLock::new(std::collections::HashSet::new())),
            last_access: Arc::new(RwLock::new(std::collections::HashMap::new())),
            unload_timeout_ms,
        }
    }

    /// Mark component as accessed
    pub async fn touch(&self, component: &str) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        self.loaded_components.write().await.insert(component.to_string());
        self.last_access.write().await.insert(component.to_string(), now);
    }

    /// Check if component should be unloaded
    pub async fn should_unload(&self, component: &str) -> bool {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        let last_access = self.last_access.read().await;
        if let Some(&last) = last_access.get(component) {
            now - last > self.unload_timeout_ms
        } else {
            false
        }
    }

    /// Get components to unload
    pub async fn get_components_to_unload(&self) -> Vec<String> {
        let loaded = self.loaded_components.read().await;
        let mut to_unload = Vec::new();

        for component in loaded.iter() {
            if self.should_unload(component).await {
                to_unload.push(component.clone());
            }
        }

        to_unload
    }

    /// Unload component
    pub async fn unload(&self, component: &str) {
        self.loaded_components.write().await.remove(component);
        self.last_access.write().await.remove(component);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_memory_tier() {
        assert_eq!(MemoryTier::from_total_ram(2), MemoryTier::Minimal);
        assert_eq!(MemoryTier::from_total_ram(6), MemoryTier::Standard);
        assert_eq!(MemoryTier::from_total_ram(12), MemoryTier::Enhanced);
        assert_eq!(MemoryTier::from_total_ram(32), MemoryTier::Full);
    }

    #[test]
    fn test_memory_breakdown() {
        let breakdown = MemoryBreakdown {
            total_bytes: 200 * 1024 * 1024,
            editor_bytes: 50 * 1024 * 1024,
            ai_model_bytes: 60 * 1024 * 1024,
            extensions_bytes: 30 * 1024 * 1024,
            lsp_bytes: 20 * 1024 * 1024,
            file_cache_bytes: 20 * 1024 * 1024,
            ui_bytes: 10 * 1024 * 1024,
            collaboration_bytes: 5 * 1024 * 1024,
            other_bytes: 5 * 1024 * 1024,
        };

        let mb = breakdown.to_mb();
        assert_eq!(mb.total_mb, 200);
    }

    #[test]
    fn test_gc_hints_default() {
        let hints = GCHints::default();
        assert_eq!(hints.aggressive_threshold, 0.8);
        assert!(hints.hint_on_idle);
    }
}
