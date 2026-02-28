//! Memory Tier System for KRO_IDE
//!
//! Dynamically adjusts model selection and settings based on available VRAM

use super::*;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Memory tier based on available GPU memory
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MemoryTier {
    /// CPU-only inference (< 4GB VRAM)
    Cpu,
    /// Low-end GPU (4GB VRAM)
    Low4GB,
    /// Mid-range GPU (8GB VRAM) - Target for KRO_IDE
    Medium8GB,
    /// High-end GPU (16GB VRAM)
    High16GB,
    /// Ultra/Enthusiast GPU (32GB+ VRAM)
    Ultra32GB,
}

impl MemoryTier {
    /// Determine tier from available VRAM
    pub fn from_vram(vram_bytes: u64) -> Self {
        let vram_gb = vram_bytes as f64 / (1024.0 * 1024.0 * 1024.0);
        
        match vram_gb {
            v if v < 4.0 => Self::Cpu,
            v if v < 8.0 => Self::Low4GB,
            v if v < 16.0 => Self::Medium8GB,
            v if v < 32.0 => Self::High16GB,
            _ => Self::Ultra32GB,
        }
    }
    
    /// Get recommended model size for this tier
    pub fn recommended_model_size(&self) -> &'static str {
        match self {
            Self::Cpu => "2B",
            Self::Low4GB => "4B",
            Self::Medium8GB => "8B",
            Self::High16GB => "14B",
            Self::Ultra32GB => "32B",
        }
    }
    
    /// Get recommended context size for this tier
    pub fn recommended_context_size(&self) -> u32 {
        match self {
            Self::Cpu => 2048,
            Self::Low4GB => 4096,
            Self::Medium8GB => 8192,
            Self::High16GB => 16384,
            Self::Ultra32GB => 32768,
        }
    }
    
    /// Get maximum KV cache size in bytes
    pub fn max_kv_cache_bytes(&self) -> u64 {
        match self {
            Self::Cpu => 512 * 1024 * 1024,      // 512MB
            Self::Low4GB => 1 * 1024 * 1024 * 1024,   // 1GB
            Self::Medium8GB => 2 * 1024 * 1024 * 1024,   // 2GB
            Self::High16GB => 4 * 1024 * 1024 * 1024,   // 4GB
            Self::Ultra32GB => 8 * 1024 * 1024 * 1024,   // 8GB
        }
    }
    
    /// Get GPU layers to offload
    pub fn gpu_layers(&self) -> i32 {
        match self {
            Self::Cpu => 0,
            Self::Low4GB => 15,
            Self::Medium8GB => 35,
            Self::High16GB => 45,
            Self::Ultra32GB => 50,
        }
    }
    
    /// Get recommended models for this tier
    pub fn recommended_models(&self) -> Vec<&'static str> {
        match self {
            Self::Cpu => vec!["phi-2b-q4_k_m", "tinyllama-1.1b-q4_k_m"],
            Self::Low4GB => vec!["qwen3-4b-q4_k_m", "phi-3.5-3.8b-q4_k_m"],
            Self::Medium8GB => vec!["qwen3-8b-q4_k_m", "llama3-8b-q4_k_m", "nemotron-9b-q4_k_m"],
            Self::High16GB => vec!["qwen3-14b-q4_k_m", "codellama-13b-q4_k_m", "deepseek-coder-13b-q4_k_m"],
            Self::Ultra32GB => vec!["qwen3-32b-q4_k_m", "codellama-34b-q4_k_m", "deepseek-coder-33b-q4_k_m"],
        }
    }
}

impl std::fmt::Display for MemoryTier {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Cpu => write!(f, "CPU"),
            Self::Low4GB => write!(f, "4GB"),
            Self::Medium8GB => write!(f, "8GB"),
            Self::High16GB => write!(f, "16GB"),
            Self::Ultra32GB => write!(f, "32GB+"),
        }
    }
}

/// Memory profiler for runtime monitoring
pub struct MemoryProfiler {
    hardware: HardwareCapabilities,
    tier: MemoryTier,
    current_usage: Arc<std::sync::atomic::AtomicU64>,
}

impl MemoryProfiler {
    pub fn new(hardware: HardwareCapabilities) -> Self {
        let tier = hardware.recommended_tier;
        Self {
            hardware,
            tier,
            current_usage: Arc::new(std::sync::atomic::AtomicU64::new(0)),
        }
    }
    
    /// Check if enough memory is available for a model
    pub fn check_available(&self, required_bytes: u64) -> anyhow::Result<()> {
        let current = self.current_usage.load(std::sync::atomic::Ordering::Relaxed);
        let available = self.hardware.vram_bytes.saturating_sub(current);
        
        // Keep 20% headroom
        let safe_limit = (self.hardware.vram_bytes as f64 * 0.8) as u64;
        let projected = current + required_bytes;
        
        if projected > safe_limit {
            anyhow::bail!(
                "Insufficient memory: required {} MB, available {} MB (safe limit: {} MB)",
                required_bytes / (1024 * 1024),
                available / (1024 * 1024),
                safe_limit / (1024 * 1024)
            );
        }
        
        Ok(())
    }
    
    /// Allocate memory (track usage)
    pub fn allocate(&self, bytes: u64) {
        self.current_usage.fetch_add(bytes, std::sync::atomic::Ordering::Relaxed);
    }
    
    /// Free memory (track usage)
    pub fn free(&self, bytes: u64) {
        self.current_usage.fetch_sub(bytes, std::sync::atomic::Ordering::Relaxed);
    }
    
    /// Get current memory usage
    pub fn current_usage(&self) -> u64 {
        self.current_usage.load(std::sync::atomic::Ordering::Relaxed)
    }
    
    /// Get memory usage percentage
    pub fn usage_percent(&self) -> f32 {
        let current = self.current_usage() as f64;
        let total = self.hardware.vram_bytes as f64;
        (current / total * 100.0) as f32
    }
    
    /// Get current tier
    pub fn tier(&self) -> MemoryTier {
        self.tier
    }
    
    /// Get hardware info
    pub fn hardware(&self) -> &HardwareCapabilities {
        &self.hardware
    }
    
    /// Monitor memory and suggest model swap if needed
    pub fn suggest_model_for_memory(&self, available_bytes: u64) -> &'static str {
        let tier = MemoryTier::from_vram(available_bytes);
        tier.recommended_models().first().copied().unwrap_or("phi-2b-q4_k_m")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_memory_tier_from_vram() {
        assert_eq!(MemoryTier::from_vram(2 * 1024 * 1024 * 1024), MemoryTier::Cpu);
        assert_eq!(MemoryTier::from_vram(6 * 1024 * 1024 * 1024), MemoryTier::Low4GB);
        assert_eq!(MemoryTier::from_vram(10 * 1024 * 1024 * 1024), MemoryTier::Medium8GB);
        assert_eq!(MemoryTier::from_vram(20 * 1024 * 1024 * 1024), MemoryTier::High16GB);
        assert_eq!(MemoryTier::from_vram(40 * 1024 * 1024 * 1024), MemoryTier::Ultra32GB);
    }
    
    #[test]
    fn test_tier_models() {
        let tier = MemoryTier::Medium8GB;
        let models = tier.recommended_models();
        assert!(models.contains(&"qwen3-8b-q4_k_m"));
    }
}
