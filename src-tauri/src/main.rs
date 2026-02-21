// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod error;
mod terminal;
mod git;
mod fs_watcher;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // File System Commands
            commands::fs::read_file,
            commands::fs::write_file,
            commands::fs::delete_file,
            commands::fs::create_dir,
            commands::fs::delete_dir,
            commands::fs::list_dir,
            commands::fs::file_exists,
            commands::fs::copy_file,
            commands::fs::move_file,
            commands::fs::rename_file,
            commands::fs::get_file_info,
            commands::fs::watch_directory,
            commands::fs::unwatch_directory,
            
            // Terminal Commands
            commands::terminal::create_terminal,
            commands::terminal::write_terminal,
            commands::terminal::resize_terminal,
            commands::terminal::destroy_terminal,
            
            // Git Commands
            commands::git::git_status,
            commands::git::git_log,
            commands::git::git_diff,
            commands::git::git_commit,
            commands::git::git_add,
            commands::git::git_reset,
            commands::git::git_branch,
            commands::git::git_checkout,
            commands::git::git_pull,
            commands::git::git_push,
            
            // AI Commands
            commands::ai::ollama_status,
            commands::ai::ollama_models,
            commands::ai::ollama_chat,
            commands::ai::ollama_pull,
            
            // System Commands
            commands::system::get_system_info,
            commands::system::open_external,
            commands::system::get_settings,
            commands::system::save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
