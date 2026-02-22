//! KYRO IDE - AI-Powered Code Editor
//! A lightweight, fast, and intelligent development environment

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod ai;
mod terminal;
mod files;
mod git;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            
            let terminal_manager = terminal::TerminalManager::new();
            app.manage(std::sync::Arc::new(tokio::sync::Mutex::new(terminal_manager)));
            
            let ai_client = ai::AiClient::new();
            app.manage(std::sync::Arc::new(tokio::sync::Mutex::new(ai_client)));
            
            let file_watcher = files::FileWatcher::new(window.clone());
            app.manage(std::sync::Arc::new(tokio::sync::Mutex::new(file_watcher)));
            
            let git_manager = git::GitManager::new();
            app.manage(std::sync::Arc::new(tokio::sync::Mutex::new(git_manager)));
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::fs::read_file,
            commands::fs::write_file,
            commands::fs::list_directory,
            commands::fs::create_file,
            commands::fs::create_directory,
            commands::fs::delete_file,
            commands::fs::delete_directory,
            commands::fs::rename_file,
            commands::fs::get_file_tree,
            commands::terminal::create_terminal,
            commands::terminal::write_to_terminal,
            commands::terminal::resize_terminal,
            commands::terminal::kill_terminal,
            commands::ai::chat_completion,
            commands::ai::code_completion,
            commands::ai::code_review,
            commands::ai::generate_tests,
            commands::ai::explain_code,
            commands::ai::refactor_code,
            commands::ai::fix_code,
            commands::ai::check_ollama_status,
            commands::ai::list_models,
            commands::git::git_status,
            commands::git::git_commit,
            commands::git::git_diff,
            commands::git::git_log,
            commands::git::git_branch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
