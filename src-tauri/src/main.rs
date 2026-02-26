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
mod telegram;

// ============ Verification Modules ============
// symbolic_verify - removed (incomplete)

// ============ Agent System ============
mod agents;

// ============ Infrastructure Modules ============
mod update;
mod plugin_sandbox;
mod telemetry;
mod accessibility;
mod benchmark;

// ============ VS Code Compatibility ============
mod vscode_compat;

// ============ Tower-LSP Integration ============
mod lsp_tower;

// ============ LSP Transport (Real Implementation) ============
mod lsp_transport;

// ============ Collaboration (CRDT-based) ============
mod collab;

// ============ Debug Adapter Protocol ============
mod debug;

// ============ AI Inference (based on Candle) ============
mod inference;

// ============ Text Buffer (based on Ropey) ============
mod buffer;

// ============ Authentication (JWT + OAuth) ============
mod auth;

// ============ End-to-End Encryption (Signal Protocol) ============
mod e2ee;

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
            let window = app.get_webview_window("main")
                .expect("Failed to get main webview window");
            
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
            
            // ============ Virtual PICO Bridge ============
            // virtual_pico module removed - incomplete feature
            
            // ============ Initialize Collaboration ============
            
            let collab_config = git_crdt::CollaborationConfig::default();
            let collab_manager = git_crdt::CollaborationManager::new(collab_config);
            app.manage(Arc::new(Mutex::new(collab_manager)));
            log::info!("✓ Collaboration manager initialized");
            
            // ============ Verification ============
            // symbolic_verify module removed - incomplete feature
            
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
            
            // ============ Initialize RAG State ============
            
            let rag_state = commands::rag::RagState::default();
            app.manage(Arc::new(AsyncRwLock::new(rag_state)));
            log::info!("✓ RAG state initialized");
            
            // ============ Initialize WebSocket State ============
            
            let ws_state = commands::websocket::WsState::default();
            app.manage(Arc::new(AsyncRwLock::new(ws_state)));
            log::info!("✓ WebSocket state initialized");
            
            // ============ Initialize Git CRDT State ============
            
            let git_crdt_state = commands::gitcrdt::GitCrdtState::default();
            app.manage(Arc::new(AsyncRwLock::new(git_crdt_state)));
            log::info!("✓ Git CRDT state initialized");
            
            // ============ Initialize Enhanced LSP State ============
            
            let lsp_state = commands::lsp_real::LspState::default();
            app.manage(Arc::new(AsyncRwLock::new(lsp_state)));
            log::info!("✓ Enhanced LSP state initialized");
            
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
            // ============ File Operations ============
            commands::fs::read_file,
            commands::fs::write_file,
            commands::fs::list_directory,
            commands::fs::create_file,
            commands::fs::create_directory,
            commands::fs::delete_file,
            commands::fs::delete_directory,
            commands::fs::rename_file,
            commands::fs::get_file_tree,
            commands::fs::is_first_run_complete,
            commands::fs::save_first_run_complete,
            commands::fs::list_supported_languages,
            
            // ============ Terminal Operations ============
            commands::terminal::create_terminal,
            commands::terminal::write_to_terminal,
            commands::terminal::resize_terminal,
            commands::terminal::kill_terminal,
            
            // ============ AI Operations ============
            commands::ai::chat_completion,
            commands::ai::code_completion,
            commands::ai::code_review,
            commands::ai::generate_tests,
            commands::ai::explain_code,
            commands::ai::refactor_code,
            commands::ai::fix_code,
            commands::ai::check_ollama_status,
            commands::ai::list_models,
            commands::ai::ai_code_completion,
            commands::ai::ai_stream_completion,
            commands::ai::ai_inline_chat,
            
            // ============ Git Operations ============
            commands::git::git_status,
            commands::git::git_commit,
            commands::git::git_diff,
            commands::git::git_log,
            commands::git::git_branch,
            
            // ============ LSP Operations ============
            commands::lsp::detect_language,
            commands::lsp::extract_symbols,
            commands::lsp::get_completions,
            commands::lsp::get_diagnostics,
            commands::lsp::list_supported_languages,
            commands::lsp::get_ai_completions,
            commands::lsp::update_file_symbols,
            commands::lsp::get_completion_stats,
            commands::lsp::get_completion_budget,
            
            // ============ Embedded LLM Operations ============
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
            
            // ============ Authentication Operations ============
            commands::auth::login_user,
            commands::auth::logout_user,
            commands::auth::register_user,
            commands::auth::get_current_user,
            commands::auth::is_authenticated,
            commands::auth::update_user_role,
            commands::auth::validate_session,
            commands::auth::get_oauth_url,
            commands::auth::handle_oauth_callback,
            
            // ============ Collaboration Operations ============
            commands::collaboration::create_room,
            commands::collaboration::join_room,
            commands::collaboration::leave_room,
            commands::collaboration::get_room_users,
            commands::collaboration::update_presence,
            commands::collaboration::get_room_presence,
            commands::collaboration::send_operation,
            commands::collaboration::send_chat_message,
            commands::collaboration::get_collab_stats,
            commands::collaboration::is_connected_to_room,
            commands::collaboration::get_current_room,
            commands::collaboration::list_rooms,
            
            // ============ E2E Encryption Operations ============
            commands::e2ee::generate_key_pair,
            commands::e2ee::get_public_key,
            commands::e2ee::create_key_bundle,
            commands::e2ee::init_encrypted_channel,
            commands::e2ee::encrypt_message,
            commands::e2ee::decrypt_message,
            commands::e2ee::has_e2ee_session,
            commands::e2ee::has_encrypted_channel,
            commands::e2ee::rotate_keys,
            commands::e2ee::get_prekey_count,
            commands::e2ee::delete_e2ee_session,
            
            // ============ VS Code Compatibility Operations ============
            commands::vscode_compat::search_extensions,
            commands::vscode_compat::get_extension_details,
            commands::vscode_compat::install_extension,
            commands::vscode_compat::uninstall_extension,
            commands::vscode_compat::enable_extension,
            commands::vscode_compat::disable_extension,
            commands::vscode_compat::list_installed_extensions,
            commands::vscode_compat::get_extension_status,
            commands::vscode_compat::reload_extensions,
            commands::vscode_compat::get_extension_recommendations,
            commands::vscode_compat::get_popular_extensions,
            commands::vscode_compat::search_extensions_unified,
            commands::vscode_compat::install_extension_unified,
            commands::vscode_compat::get_openvsx_popular,
            commands::vscode_compat::get_extension_readme,
            
            // ============ MCP/Agent Operations ============
            commands::mcp::list_agents,
            commands::mcp::create_agent,
            commands::mcp::run_agent,
            commands::mcp::get_agent_status,
            commands::mcp::delete_agent,
            commands::mcp::list_mcp_tools,
            commands::mcp::execute_tool,
            commands::mcp::list_mcp_resources,
            commands::mcp::read_mcp_resource,
            commands::mcp::register_tool,
            commands::mcp::unregister_tool,
            
            // ============ Swarm AI Operations ============
            commands::swarm::list_swarm_agents,
            commands::swarm::create_swarm_agent,
            commands::swarm::submit_swarm_task,
            commands::swarm::execute_swarm_task,
            commands::swarm::get_swarm_task_status,
            commands::swarm::list_swarm_tasks,
            commands::swarm::cancel_swarm_task,
            commands::swarm::get_swarm_stats,
            commands::swarm::delete_swarm_agent,
            commands::swarm::send_agent_message,
            
            // ============ Plugin Operations ============
            commands::plugin::list_plugins,
            commands::plugin::install_plugin,
            commands::plugin::uninstall_plugin,
            commands::plugin::enable_plugin,
            commands::plugin::disable_plugin,
            commands::plugin::execute_plugin_function,
            commands::plugin::get_plugin_capabilities,
            commands::plugin::plugin_has_capability,
            commands::plugin::get_plugin_status,
            commands::plugin::reload_plugins,
            commands::plugin::get_plugin_memory_usage,
            
            // ============ Update Operations ============
            commands::update::check_for_updates,
            commands::update::download_update,
            commands::update::get_download_progress,
            commands::update::install_update,
            commands::update::cancel_update,
            commands::update::get_update_channel,
            commands::update::set_update_channel,
            commands::update::get_update_history,
            commands::update::set_auto_update,
            commands::update::is_auto_update_enabled,
            commands::update::skip_update,
            commands::update::get_last_update_check,
            
            // ============ RAG Operations ============
            commands::rag::get_rag_status,
            commands::rag::index_project,
            commands::rag::semantic_search,
            commands::rag::clear_rag_index,
            commands::rag::get_rag_config,
            commands::rag::set_rag_config,
            commands::rag::get_indexed_paths,
            commands::rag::remove_indexed_path,
            
            // ============ WebSocket Operations ============
            commands::websocket::ws_connect,
            commands::websocket::ws_disconnect,
            commands::websocket::ws_get_status,
            commands::websocket::ws_join_room,
            commands::websocket::ws_leave_room,
            commands::websocket::ws_send_message,
            commands::websocket::ws_send_presence,
            commands::websocket::ws_send_operation,
            commands::websocket::ws_get_server_url,
            commands::websocket::ws_set_reconnect_handler,
            
            // ============ Git CRDT Operations ============
            commands::gitcrdt::git_crdt_status,
            commands::gitcrdt::git_crdt_sync,
            commands::gitcrdt::git_crdt_commit,
            commands::gitcrdt::git_crdt_auto_commit,
            commands::gitcrdt::git_crdt_auto_push,
            commands::gitcrdt::git_crdt_resolve_conflict,
            commands::gitcrdt::git_crdt_get_history,
            commands::gitcrdt::git_crdt_create_branch,
            commands::gitcrdt::git_crdt_switch_branch,
            
            // ============ Enhanced LSP Operations ============
            commands::lsp_real::lsp_start_server,
            commands::lsp_real::lsp_stop_server,
            commands::lsp_real::lsp_get_servers,
            commands::lsp_real::lsp_get_completions,
            commands::lsp_real::lsp_get_hover,
            commands::lsp_real::lsp_goto_definition,
            commands::lsp_real::lsp_goto_references,
            commands::lsp_real::lsp_get_diagnostics,
            commands::lsp_real::lsp_rename,
            commands::lsp_real::lsp_format_document,
            commands::lsp_real::lsp_code_actions,
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
