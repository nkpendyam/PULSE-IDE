//! Kyro IDE - The Open Source, Privacy-First AI-Powered Development Environment
//!
//! A Tauri-based desktop application providing a full-featured IDE with AI capabilities.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod error;
mod fs_watcher;

use commands::*;
use error::Result;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
            "kyro_ide=debug,tauri=info".into()
        }))
        .with(tracing_subscriber::fmt::layer())
        .init();

    tauri::Builder::default()
        // Plugins
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        
        // Setup
        .setup(|app| {
            let handle = app.handle();
            
            // Initialize file watcher
            fs_watcher::init(handle)?;
            
            // Setup menu bar
            setup_menu(handle)?;
            
            tracing::info!("Kyro IDE initialized successfully");
            Ok(())
        })
        
        // Register commands
        .invoke_handler(tauri::generate_handler![
            // File system commands
            fs_read_file,
            fs_write_file,
            fs_list_directory,
            fs_create_directory,
            fs_delete_file,
            fs_delete_directory,
            fs_copy_file,
            fs_move_file,
            fs_exists,
            fs_get_file_info,
            fs_search_files,
            
            // Git commands
            git_status,
            git_commit,
            git_push,
            git_pull,
            git_fetch,
            git_branch_list,
            git_branch_create,
            git_branch_switch,
            git_branch_delete,
            git_diff,
            git_log,
            git_blame,
            git_stash,
            git_stash_pop,
            
            // Terminal commands
            terminal_create,
            terminal_write,
            terminal_resize,
            terminal_kill,
            terminal_list_shells,
            
            // AI commands
            ai_chat,
            ai_complete,
            ai_get_models,
            ai_load_model,
            ai_unload_model,
            
            // System commands
            system_info,
            system_open_url,
            system_open_file,
            system_get_env,
            system_set_env,
            system_get_path,
            system_get_config_dir,
            system_get_data_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Setup application menu bar
fn setup_menu(app: &tauri::AppHandle) -> Result<()> {
    #[cfg(target_os = "macos")]
    {
        use tauri::menu::{Menu, MenuItem};
        
        let app_menu = Menu::new(app)?;
        let about_item = MenuItem::new(app, "About Kyro IDE", true, None::<&str>)?;
        let settings_item = MenuItem::new(app, "Settings...", true, Some("Cmd+,"))?;
        let quit_item = MenuItem::new(app, "Quit Kyro IDE", true, Some("Cmd+Q"))?;
        
        app_menu.append_items(&[&about_item, &settings_item, &quit_item])?;
        app.set_menu(app_menu)?;
    }
    
    Ok(())
}
