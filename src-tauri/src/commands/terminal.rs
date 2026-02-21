use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use portable_pty::{native_pty_system, PtySize, CommandBuilder};

#[derive(Debug, Serialize, Deserialize)]
pub struct TerminalSession {
    pub id: String,
    pub cwd: String,
    pub shell: String,
}

// Active terminal sessions
pub type TerminalSessions = Mutex<HashMap<String, Box<dyn portable_pty::PtyReader + Send>>>;

/// Create a new terminal session
#[tauri::command]
pub async fn create_terminal(
    id: String,
    cwd: Option<String>,
    shell: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<TerminalSession, String> {
    let pty_system = native_pty_system();
    
    let pair = pty_system.openpty(PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    }).map_err(|e| format!("Failed to create PTY: {}", e))?;
    
    let shell_cmd = shell.unwrap_or_else(|| {
        if cfg!(windows) {
            "cmd.exe".to_string()
        } else {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
        }
    });
    
    let mut cmd = CommandBuilder::new(&shell_cmd);
    
    if let Some(dir) = cwd {
        cmd.cwd(dir);
    }
    
    let _child = pair.slave.spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;
    
    let reader = pair.master.try_clone_reader()
        .map_err(|e| format!("Failed to clone reader: {}", e))?;
    
    Ok(TerminalSession {
        id,
        cwd: cwd.unwrap_or_else(|| std::env::current_dir().unwrap().to_string_lossy().to_string()),
        shell: shell_cmd,
    })
}

/// Write to terminal
#[tauri::command]
pub async fn write_terminal(id: String, data: String, sessions: tauri::State<'_, TerminalSessions>) -> Result<(), String> {
    // Write data to the terminal
    // This would need proper implementation with the master PTY writer
    Ok(())
}

/// Resize terminal
#[tauri::command]
pub async fn resize_terminal(id: String, cols: u16, rows: u16) -> Result<(), String> {
    // Resize the PTY
    Ok(())
}

/// Destroy terminal session
#[tauri::command]
pub async fn destroy_terminal(id: String, sessions: tauri::State<'_, TerminalSessions>) -> Result<(), String> {
    let mut sessions_map = sessions.lock().unwrap();
    sessions_map.remove(&id);
    Ok(())
}
