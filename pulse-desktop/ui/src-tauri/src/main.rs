//! PULSE Desktop UI - Tauri Backend

#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod kernel;
mod state;

use state::AppState;
use tauri::Manager;

fn main() {
    // Initialize logging
    tracing_subscriber::fmt::init();

    tauri::Builder::default()
        .setup(|app| {
            // Initialize app state
            let state = AppState::new();
            app.manage(state);

            // Spawn kernel process
            let handle = app.handle();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = kernel::start_kernel(&handle).await {
                    tracing::error!("Failed to start kernel: {}", e);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_kernel_status,
            commands::pause_kernel,
            commands::resume_kernel,
            commands::submit_task,
            commands::get_task_status,
            commands::list_agents,
            commands::list_modules,
            commands::get_memory_usage,
            commands::get_logs,
            commands::approve_plan,
            commands::reject_plan,
            commands::chat,
            commands::execute_sandbox,
            commands::open_file,
            commands::save_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
