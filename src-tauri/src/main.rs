//! KRO_IDE - GPU-Accelerated AI-Native Code Editor
//!
//! A zero-dependency, privacy-first IDE with embedded LLM, MCP agent swarm,
//! and real-time collaboration capabilities.
//!
//! ## Architecture
//! - **UI Layer**: Tauri v2 (WebView Shell) + GPUI Canvas (Rust)
//! - **AI Engine**: Embedded llama.cpp with Metal/CUDA/Vulkan backends
//! - **Agent Framework**: MCP (Model Context Protocol) with FastMCP patterns
//! - **Collaboration**: Yjs CRDT with Git persistence
//! - **Plugin System**: WASM sandbox with capability-based security
//!
//! ## Memory Model (8GB VRAM Target)
//! - Model weights (Q4_K_M): ~4.5GB
//! - KV cache (8K context): ~2GB
//! - System overhead: ~1GB
//! - Total: ~7.5GB (safe headroom)
//!
//! ## Zero-Dependency Promise
//! - No Ollama installation required
//! - No VC++ redistributables (Windows)
//! - No Python/Node.js runtime
//! - Single static binary per platform

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// ============ Core Modules ============
mod commands;
mod ai;
mod terminal;
mod files;
mod git;
mod lsp;

// ============ AI Modules ============
mod swarm_ai;
mod embedded_llm;
mod mcp;
mod rag;

// ============ Collaboration Modules ============
mod git_crdt;

// ============ Platform Modules ============
mod virtual_pico;

// ============ Verification Modules ============
mod symbolic_verify;

// ============ Agent System ============
mod agents;

// ============ Infrastructure Modules ============
mod update;
mod plugin_sandbox;
mod telemetry;
mod accessibility;

use tauri::Manager;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock as AsyncRwLock};
use parking_lot::RwLock;

fn main() {
    // Initialize logging
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format(|buf, record| {
            use std::io::Write;
            writeln!(
                buf,
                "[{} {}] {}",
                chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
                record.level(),
                record.args()
            )
        })
        .init();
    
    log::info!("=================================");
    log::info!("  KRO_IDE v{} Starting", env!("CARGO_PKG_VERSION"));
    log::info!("=================================");
    
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            
            // ============ Hardware Detection ============
            log::info!("Detecting hardware capabilities...");
            let hardware_caps = detect_hardware_capabilities();
            log::info!("GPU: {:?}", hardware_caps.gpu_name);
            log::info!("VRAM: {} GB", hardware_caps.vram_bytes / (1024*1024*1024));
            log::info!("Memory Tier: {:?}", hardware_caps.recommended_tier);
            log::info!("Backend: {}", hardware_caps.recommended_backend);
            
            // ============ Initialize Core Services ============
            
            // Terminal manager
            let terminal_manager = terminal::TerminalManager::new();
            app.manage(Arc::new(Mutex::new(terminal_manager)));
            
            // AI client (Ollama fallback)
            let ai_client = ai::AiClient::new();
            let ai_client_arc = Arc::new(Mutex::new(ai_client));
            app.manage(ai_client_arc.clone());
            
            // File watcher
            let file_watcher = files::FileWatcher::new(window.clone());
            app.manage(Arc::new(Mutex::new(file_watcher)));
            
            // Git manager
            let git_manager = git::GitManager::new();
            app.manage(Arc::new(Mutex::new(git_manager)));
            
            // ============ Initialize LSP System ============
            
            let molecular_lsp = lsp::MolecularLsp::new();
            let molecular_lsp_arc = Arc::new(RwLock::new(molecular_lsp));
            app.manage(Arc::new(Mutex::new(lsp::MolecularLsp::new())));
            
            // AI completion engine
            let completion_engine = lsp::completion_engine::AiCompletionEngine::new(molecular_lsp_arc);
            app.manage(Arc::new(Mutex::new(completion_engine)));
            
            // ============ Initialize Swarm AI Engine ============
            
            let app_handle = app.handle().clone();
            let hardware_caps_clone = hardware_caps.clone();
            tauri::async_runtime::spawn(async move {
                let config = swarm_ai::SwarmConfig {
                    max_memory_gb: hardware_caps_clone.vram_bytes as f32 / (1024.0*1024.0*1024.0),
                    ..Default::default()
                };
                
                if let Ok(engine) = swarm_ai::SwarmAIEngine::new(config).await {
                    app_handle.manage(Arc::new(AsyncRwLock::new(engine)));
                    log::info!("✓ Swarm AI engine initialized");
                } else {
                    log::warn!("⚠ Swarm AI engine initialization failed, using fallback");
                }
            });
            
            // ============ Initialize Embedded LLM ============
            
            // Initialize embedded LLM state (for commands to access)
            let embedded_llm_state = commands::embedded_llm::EmbeddedLLMState {
                engine: None,
                hardware: hardware_caps.clone(),
            };
            app.manage(Arc::new(AsyncRwLock::new(embedded_llm_state)));
            log::info!("✓ Embedded LLM state initialized");
            
            #[cfg(feature = "embedded-llm")]
            {
                let app_handle = app.handle().clone();
                let hardware_caps = hardware_caps.clone();
                tauri::async_runtime::spawn(async move {
                    let config = embedded_llm::EmbeddedLLMConfig {
                        max_vram_mb: (hardware_caps.vram_bytes / (1024*1024)) as u64 * 80 / 100, // 80% of VRAM
                        context_size: hardware_caps.recommended_tier.recommended_context_size(),
                        n_gpu_layers: hardware_caps.recommended_tier.gpu_layers(),
                        default_model: hardware_caps.recommended_tier.recommended_models()
                            .first().unwrap_or(&"phi-2b-q4_k_m").to_string(),
                        ..Default::default()
                    };
                    
                    match embedded_llm::EmbeddedLLMEngine::new(config).await {
                        Ok(engine) => {
                            app_handle.manage(Arc::new(AsyncRwLock::new(engine)));
                            log::info!("✓ Embedded LLM engine initialized");
                        }
                        Err(e) => {
                            log::warn!("⚠ Embedded LLM initialization failed: {}", e);
                        }
                    }
                });
            }
            
            // ============ Initialize MCP Server ============
            
            let mcp_server = mcp::MCPServer::new(mcp::MCPConfig::default());
            app.manage(Arc::new(AsyncRwLock::new(mcp_server)));
            log::info!("✓ MCP server initialized");
            
            // ============ Initialize Virtual PICO Bridge ============
            
            let pico_bridge = virtual_pico::PicoBridge::default();
            app.manage(Arc::new(Mutex::new(pico_bridge)));
            
            // ============ Initialize Collaboration ============
            
            let collab_config = git_crdt::CollaborationConfig::default();
            let collab_manager = git_crdt::CollaborationManager::new(collab_config);
            app.manage(Arc::new(Mutex::new(collab_manager)));
            log::info!("✓ Collaboration manager initialized");
            
            // ============ Initialize Verification ============
            
            let verify_config = symbolic_verify::VerificationConfig::default();
            if let Ok(verify_manager) = symbolic_verify::VerificationManager::new(verify_config) {
                app.manage(Arc::new(Mutex::new(verify_manager)));
                log::info!("✓ Verification manager initialized");
            }
            
            // ============ Initialize Plugin Manager ============
            
            let plugins_dir = dirs::data_dir()
                .unwrap_or_else(|| std::path::PathBuf::from("."))
                .join("kro_ide")
                .join("plugins");
            
            let plugin_manager = plugin_sandbox::PluginManager::new(plugins_dir);
            app.manage(Arc::new(Mutex::new(plugin_manager)));
            log::info!("✓ Plugin manager initialized");
            
            // ============ Initialize Update Manager ============
            
            let update_config = update::UpdateConfig::default();
            if let Ok(update_manager) = update::UpdateManager::new(update_config) {
                app.manage(Arc::new(AsyncRwLock::new(update_manager)));
                log::info!("✓ Update manager initialized");
            }
            
            // ============ Initialize Telemetry ============
            
            let telemetry = telemetry::TelemetryManager::new(telemetry::TelemetryConfig::default());
            app.manage(Arc::new(Mutex::new(telemetry)));
            log::info!("✓ Telemetry initialized");
            
            // ============ Startup Complete ============
            
            log::info!("=================================");
            log::info!("  KRO_IDE Ready");
            log::info!("  - Languages: 25+ (Tree-sitter)");
            log::info!("  - AI Agents: 8 specialized");
            log::info!("  - Memory Tier: {:?}", hardware_caps.recommended_tier);
            log::info!("=================================");
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // File operations
            commands::fs::read_file,
            commands::fs::write_file,
            commands::fs::list_directory,
            commands::fs::create_file,
            commands::fs::create_directory,
            commands::fs::delete_file,
            commands::fs::delete_directory,
            commands::fs::rename_file,
            commands::fs::get_file_tree,
            
            // Terminal operations
            commands::terminal::create_terminal,
            commands::terminal::write_to_terminal,
            commands::terminal::resize_terminal,
            commands::terminal::kill_terminal,
            
            // AI operations
            commands::ai::chat_completion,
            commands::ai::code_completion,
            commands::ai::code_review,
            commands::ai::generate_tests,
            commands::ai::explain_code,
            commands::ai::refactor_code,
            commands::ai::fix_code,
            commands::ai::check_ollama_status,
            commands::ai::list_models,
            
            // Git operations
            commands::git::git_status,
            commands::git::git_commit,
            commands::git::git_diff,
            commands::git::git_log,
            commands::git::git_branch,
            
            // LSP operations (basic)
            commands::lsp::detect_language,
            commands::lsp::extract_symbols,
            commands::lsp::get_completions,
            commands::lsp::get_diagnostics,
            commands::lsp::list_supported_languages,
            
            // LSP operations (AI-powered)
            commands::lsp::get_ai_completions,
            commands::lsp::update_file_symbols,
            commands::lsp::get_completion_stats,
            commands::lsp::get_completion_budget,
            
            // Embedded LLM operations
            commands::embedded_llm::get_hardware_info,
            commands::embedded_llm::init_embedded_llm,
            commands::embedded_llm::load_model,
            commands::embedded_llm::unload_model,
            commands::embedded_llm::list_local_models,
            commands::embedded_llm::embedded_complete,
            commands::embedded_llm::embedded_chat,
            commands::embedded_llm::embedded_code_complete,
            commands::embedded_llm::is_embedded_llm_ready,
            commands::embedded_llm::get_loaded_models,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Detect hardware capabilities at startup
fn detect_hardware_capabilities() -> embedded_llm::HardwareCapabilities {
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
    let mut sys = sysinfo::System::new_all();
    sys.refresh_memory();
    let ram_bytes = sys.total_memory() * 1024;
    
    // Detect GPU and VRAM
    let (gpu_name, vram_bytes, recommended_backend, recommended_tier) = detect_gpu();
    
    embedded_llm::HardwareCapabilities {
        vram_bytes,
        ram_bytes,
        gpu_name,
        gpu_compute_capability: None,
        recommended_backend,
        recommended_tier,
        cpu_cores,
        cpu_features,
    }
}

/// Detect GPU capabilities
fn detect_gpu() -> (Option<String>, u64, String, embedded_llm::MemoryTier) {
    // Try CUDA first
    #[cfg(feature = "cuda")]
    {
        // Would query CUDA
        return (Some("NVIDIA GPU".to_string()), 8_589_934_592, "cuda".to_string(), embedded_llm::MemoryTier::Medium8GB);
    }
    
    // Try Metal on macOS
    #[cfg(target_os = "macos")]
    {
        let mut sys = sysinfo::System::new_all();
        sys.refresh_memory();
        let ram = sys.total_memory() * 1024;
        let usable_vram = (ram as f64 * 0.75) as u64; // Metal gives ~75% of unified memory
        let tier = embedded_llm::MemoryTier::from_vram(usable_vram);
        return (Some("Apple Silicon".to_string()), usable_vram, "metal".to_string(), tier);
    }
    
    // Fallback to CPU
    let mut sys = sysinfo::System::new_all();
    sys.refresh_memory();
    let ram = sys.total_memory() * 1024;
    let usable = (ram as f64 * 0.25) as u64;
    (None, usable, "cpu".to_string(), embedded_llm::MemoryTier::Cpu)
}
