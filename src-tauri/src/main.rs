//! KYRO IDE - AI-Powered Code Editor
//! A lightweight, fast, and intelligent development environment
//!
//! Features:
//! - Molecular LSP: Tree-sitter based language support
//! - Swarm AI: Distributed AI inference with llama.cpp
//! - Git-CRDT: Real-time collaboration with Git persistence
//! - Virtual PICO: Mobile device as controller
//! - Symbolic Verify: Formal verification with Z3/Kani

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod ai;
mod terminal;
mod files;
mod git;
mod lsp;
mod swarm_ai;
mod git_crdt;
mod virtual_pico;
mod symbolic_verify;

use tauri::Manager;
use std::sync::Arc;
use tokio::sync::Mutex;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            
            // Initialize terminal manager
            let terminal_manager = terminal::TerminalManager::new();
            app.manage(Arc::new(Mutex::new(terminal_manager)));
            
            // Initialize AI client
            let ai_client = ai::AiClient::new();
            app.manage(Arc::new(Mutex::new(ai_client)));
            
            // Initialize file watcher
            let file_watcher = files::FileWatcher::new(window.clone());
            app.manage(Arc::new(Mutex::new(file_watcher)));
            
            // Initialize git manager
            let git_manager = git::GitManager::new();
            app.manage(Arc::new(Mutex::new(git_manager)));
            
            // Initialize molecular LSP
            let molecular_lsp = lsp::MolecularLsp::new();
            app.manage(Arc::new(Mutex::new(molecular_lsp)));
            
            // Initialize Swarm AI engine (async)
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let config = swarm_ai::SwarmConfig::default();
                if let Ok(engine) = swarm_ai::SwarmAIEngine::new(config).await {
                    app_handle.manage(Arc::new(Mutex::new(engine)));
                    log::info!("Swarm AI engine initialized");
                }
            });
            
            // Initialize Virtual PICO bridge
            let pico_bridge = virtual_pico::PicoBridge::default();
            app.manage(Arc::new(Mutex::new(pico_bridge)));
            
            // Initialize Collaboration manager
            let collab_config = git_crdt::CollaborationConfig::default();
            let collab_manager = git_crdt::CollaborationManager::new(collab_config);
            app.manage(Arc::new(Mutex::new(collab_manager)));
            
            // Initialize Verification manager
            let verify_config = symbolic_verify::VerificationConfig::default();
            if let Ok(verify_manager) = symbolic_verify::VerificationManager::new(verify_config) {
                app.manage(Arc::new(Mutex::new(verify_manager)));
            }
            
            log::info!("KYRO IDE initialized successfully");
            
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
            
            // LSP operations
            commands::lsp::detect_language,
            commands::lsp::extract_symbols,
            commands::lsp::get_completions,
            commands::lsp::get_diagnostics,
            commands::lsp::list_supported_languages,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
