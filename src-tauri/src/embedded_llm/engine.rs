//! Embedded LLM Engine Implementation
//!
//! Core inference engine that interfaces with llama.cpp static library

use super::*;
use anyhow::{Result, Context};
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;
use std::time::Instant;

/// Main embedded LLM engine
pub struct EmbeddedLLMEngine {
    config: EmbeddedLLMConfig,
    backend: Arc<RwLock<Box<dyn InferenceBackend>>>,
    model_manager: Arc<RwLock<ModelManager>>,
    memory_profiler: MemoryProfiler,
    context_cache: ContextCache,
    hardware: HardwareCapabilities,
    loaded_models: Arc<RwLock<HashMap<String, ModelStatus>>>,
}

impl EmbeddedLLMEngine {
    /// Create a new embedded LLM engine
    pub async fn new(config: EmbeddedLLMConfig) -> Result<Self> {
        // Detect hardware capabilities
        let hardware = Self::detect_hardware()?;
        
        // Adjust config based on hardware
        let config = Self::adjust_config_for_hardware(config, &hardware);
        
        // Initialize memory profiler
        let memory_profiler = MemoryProfiler::new(hardware.clone());
        
        // Select optimal backend
        let backend = Self::select_backend(&config, &hardware).await?;
        
        // Initialize model manager
        let model_manager = ModelManager::new(config.model_paths.clone())?;
        
        // Initialize context cache
        let context_cache = ContextCache::new(1000); // 1000 cached contexts
        
        Ok(Self {
            config,
            backend: Arc::new(RwLock::new(backend)),
            model_manager: Arc::new(RwLock::new(model_manager)),
            memory_profiler,
            context_cache,
            hardware,
            loaded_models: Arc::new(RwLock::new(HashMap::new())),
        })
    }
    
    /// Detect hardware capabilities
    fn detect_hardware() -> Result<HardwareCapabilities> {
        let cpu_cores = num_cpus::get();
        
        // Detect CPU features
        let mut cpu_features = vec![];
        #[cfg(target_arch = "x86_64")]
        {
            if is_x86_feature_detected!("avx2") {
                cpu_features.push("avx2".to_string());
            }
            if is_x86_feature_detected!("avx512f") {
                cpu_features.push("avx512".to_string());
            }
        }
        #[cfg(target_arch = "aarch64")]
        {
            cpu_features.push("neon".to_string());
        }
        
        // Get system memory
        let ram_bytes = sysinfo::System::new_all().total_memory() * 1024;
        
        // Detect GPU and VRAM
        let (gpu_name, vram_bytes, recommended_backend, recommended_tier) = 
            Self::detect_gpu_capabilities();
        
        Ok(HardwareCapabilities {
            vram_bytes,
            ram_bytes,
            gpu_name,
            gpu_compute_capability: None,
            recommended_backend,
            recommended_tier,
            cpu_cores,
            cpu_features,
        })
    }
    
    /// Detect GPU capabilities
    fn detect_gpu_capabilities() -> (Option<String>, u64, String, MemoryTier) {
        // Try CUDA first
        #[cfg(feature = "cuda")]
        {
            if let Ok(gpu_info) = Self::detect_cuda() {
                let tier = MemoryTier::from_vram(gpu_info.vram_bytes);
                return (Some(gpu_info.name), gpu_info.vram_bytes, "cuda".to_string(), tier);
            }
        }
        
        // Try Metal on macOS
        #[cfg(target_os = "macos")]
        {
            if let Ok(gpu_info) = Self::detect_metal() {
                // Metal uses unified memory - only ~75% is available for GPU
                let usable_vram = (gpu_info.vram_bytes as f64 * 0.75) as u64;
                let tier = MemoryTier::from_vram(usable_vram);
                return (Some(gpu_info.name), usable_vram, "metal".to_string(), tier);
            }
        }
        
        // Fallback to CPU
        let ram = sysinfo::System::new_all().total_memory() * 1024;
        let usable = (ram as f64 * 0.25) as u64; // Use 25% of RAM for CPU inference
        (None, usable, "cpu".to_string(), MemoryTier::Cpu)
    }
    
    /// Detect CUDA GPU
    #[cfg(feature = "cuda")]
    fn detect_cuda() -> Result<GpuInfo> {
        // Would use rust-cuda or similar
        // Placeholder - actual implementation would query CUDA
        Ok(GpuInfo {
            name: "NVIDIA GPU".to_string(),
            vram_bytes: 8_589_934_592, // 8GB default
        })
    }
    
    /// Detect Metal GPU on macOS
    #[cfg(target_os = "macos")]
    fn detect_metal() -> Result<GpuInfo> {
        use std::ffi::CString;
        use std::ptr;
        
        // Query Metal for recommended max working set size
        // This gives us ~75% of unified memory
        let ram = sysinfo::System::new_all().total_memory() * 1024;
        
        Ok(GpuInfo {
            name: "Apple Silicon".to_string(),
            vram_bytes: ram,
        })
    }
    
    /// Adjust configuration based on hardware
    fn adjust_config_for_hardware(
        mut config: EmbeddedLLMConfig, 
        hardware: &HardwareCapabilities
    ) -> EmbeddedLLMConfig {
        // Adjust GPU layers based on VRAM
        config.n_gpu_layers = match hardware.recommended_tier {
            MemoryTier::Cpu => 0,
            MemoryTier::Low4GB => 15,
            MemoryTier::Medium8GB => 35,
            MemoryTier::High16GB => 45,
            MemoryTier::Ultra32GB => 50,
        };
        
        // Adjust context size based on available memory
        config.context_size = match hardware.recommended_tier {
            MemoryTier::Cpu => 2048,
            MemoryTier::Low4GB => 4096,
            MemoryTier::Medium8GB => 8192,
            MemoryTier::High16GB => 16384,
            MemoryTier::Ultra32GB => 32768,
        };
        
        // Select optimal model
        config.default_model = match hardware.recommended_tier {
            MemoryTier::Cpu => "phi-2b-q4_k_m".to_string(),
            MemoryTier::Low4GB => "qwen3-4b-q4_k_m".to_string(),
            MemoryTier::Medium8GB => "qwen3-8b-q4_k_m".to_string(),
            MemoryTier::High16GB => "qwen3-14b-q4_k_m".to_string(),
            MemoryTier::Ultra32GB => "qwen3-32b-q4_k_m".to_string(),
        };
        
        config
    }
    
    /// Select optimal inference backend
    async fn select_backend(
        config: &EmbeddedLLMConfig, 
        hardware: &HardwareCapabilities
    ) -> Result<Box<dyn InferenceBackend>> {
        let backend_name = config.preferred_backend.as_ref()
            .unwrap_or(&hardware.recommended_backend);
        
        match backend_name.as_str() {
            #[cfg(feature = "cuda")]
            "cuda" => Ok(Box::new(backends::CudaBackend::new()?)),
            
            #[cfg(target_os = "macos")]
            "metal" => Ok(Box::new(backends::MetalBackend::new()?)),
            
            "vulkan" => Ok(Box::new(backends::VulkanBackend::new()?)),
            
            _ => Ok(Box::new(backends::CpuBackend::new(config.n_threads)?)),
        }
    }
    
    /// Load a model into memory
    pub async fn load_model(&self, model_name: &str) -> Result<()> {
        let mut loaded = self.loaded_models.write().await;
        
        // Check if already loaded
        if loaded.contains_key(model_name) {
            return Ok(());
        }
        
        // Check memory availability
        let model_spec = self.model_manager.read().await.get_spec(model_name)?;
        self.memory_profiler.check_available(model_spec.size_bytes)?;
        
        // Load model via backend
        let mut backend = self.backend.write().await;
        backend.load_model(&model_spec).await?;
        
        // Track loaded model
        loaded.insert(model_name.to_string(), ModelStatus {
            name: model_name.to_string(),
            loaded: true,
            loading_progress: 1.0,
            memory_used_mb: model_spec.size_bytes / (1024 * 1024),
            backend: self.hardware.recommended_backend.clone(),
            context_size: self.config.context_size,
        });
        
        log::info!("Model {} loaded successfully", model_name);
        Ok(())
    }
    
    /// Unload a model from memory
    pub async fn unload_model(&self, model_name: &str) -> Result<()> {
        let mut loaded = self.loaded_models.write().await;
        
        if let Some(status) = loaded.remove(model_name) {
            let mut backend = self.backend.write().await;
            backend.unload_model(model_name).await?;
            log::info!("Model {} unloaded (freed {} MB)", model_name, status.memory_used_mb);
        }
        
        Ok(())
    }
    
    /// Generate completion
    pub async fn complete(&self, request: &InferenceRequest) -> Result<InferenceResponse> {
        // Check cache first
        let cache_key = self.compute_cache_key(request);
        if let Some(cached) = self.context_cache.get(&cache_key) {
            return Ok(InferenceResponse {
                text: cached.response,
                tokens_generated: cached.tokens,
                time_to_first_token_ms: 0,
                total_time_ms: 0,
                tokens_per_second: f32::MAX,
                model: cached.model,
                from_cache: true,
                memory_used: 0,
            });
        }
        
        // Ensure model is loaded
        let model_name = &self.config.default_model;
        if !self.loaded_models.read().await.contains_key(model_name) {
            self.load_model(model_name).await?;
        }
        
        // Run inference
        let start = Instant::now();
        let mut backend = self.backend.write().await;
        let response = backend.infer(request).await?;
        let elapsed = start.elapsed();
        
        // Cache result
        self.context_cache.insert(cache_key, CachedContext {
            response: response.text.clone(),
            tokens: response.tokens_generated,
            model: model_name.clone(),
            timestamp: std::time::SystemTime::now(),
        });
        
        // Update response with timing
        Ok(InferenceResponse {
            time_to_first_token_ms: response.time_to_first_token_ms,
            total_time_ms: elapsed.as_millis() as u64,
            tokens_per_second: response.tokens_generated as f32 / elapsed.as_secs_f32(),
            from_cache: false,
            ..response
        })
    }
    
    /// Stream completion with callback
    pub async fn complete_stream(
        &self,
        request: &InferenceRequest,
        callback: impl FnMut(&str) + Send + 'static,
    ) -> Result<InferenceResponse> {
        // Ensure model is loaded
        let model_name = &self.config.default_model;
        if !self.loaded_models.read().await.contains_key(model_name) {
            self.load_model(model_name).await?;
        }

        let start = Instant::now();
        let mut backend = self.backend.write().await;
        let response = backend.infer_stream_boxed(request, Box::new(callback)).await?;
        let elapsed = start.elapsed();

        Ok(InferenceResponse {
            total_time_ms: elapsed.as_millis() as u64,
            tokens_per_second: response.tokens_generated as f32 / elapsed.as_secs_f32(),
            from_cache: false,
            ..response
        })
    }
    
    /// Get hardware capabilities
    pub fn hardware(&self) -> &HardwareCapabilities {
        &self.hardware
    }
    
    /// Get memory profiler
    pub fn memory_profiler(&self) -> &MemoryProfiler {
        &self.memory_profiler
    }
    
    /// Get loaded models
    pub async fn loaded_models(&self) -> Vec<ModelStatus> {
        self.loaded_models.read().await.values().cloned().collect()
    }
    
    /// Compute cache key for request
    fn compute_cache_key(&self, request: &InferenceRequest) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        request.prompt.hash(&mut hasher);
        request.max_tokens.hash(&mut hasher);
        request.temperature.to_bits().hash(&mut hasher);
        format!("{:x}", hasher.finish())
    }
}

/// GPU info structure
struct GpuInfo {
    name: String,
    vram_bytes: u64,
}

/// Backend trait for different inference backends
#[async_trait::async_trait]
pub trait InferenceBackend: Send + Sync {
    /// Load a model
    async fn load_model(&mut self, spec: &ModelSpec) -> Result<()>;

    /// Unload a model
    async fn unload_model(&mut self, name: &str) -> Result<()>;

    /// Run inference
    async fn infer(&mut self, request: &InferenceRequest) -> Result<InferenceResponse>;

    /// Stream inference with boxed callback (for trait object safety)
    async fn infer_stream_boxed(
        &mut self,
        request: &InferenceRequest,
        callback: Box<dyn FnMut(&str) + Send>,
    ) -> Result<InferenceResponse>;

    /// Get backend name
    fn name(&self) -> &str;

    /// Get backend capabilities
    fn capabilities(&self) -> BackendCapabilities;
}

/// Backend capabilities
#[derive(Debug, Clone)]
pub struct BackendCapabilities {
    pub supports_gpu: bool,
    pub supports_streaming: bool,
    pub supports_batching: bool,
    pub max_batch_size: usize,
    pub memory_bandwidth_gbps: f32,
}
