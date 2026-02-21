//! Terminal commands for Kyro IDE

use crate::error::{Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSession {
    pub id: String,
    pub name: String,
    pub shell: String,
    pub cwd: String,
    pub created_at: String,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellInfo {
    pub name: String,
    pub path: String,
    pub is_default: bool,
}

// Global terminal sessions storage
lazy_static::lazy_static! {
    static ref TERMINALS: Arc<RwLock<HashMap<String, TerminalSession>>> = 
        Arc::new(RwLock::new(HashMap::new()));
}

/// Create a new terminal session
#[tauri::command]
pub async fn terminal_create(
    shell: Option<String>,
    cwd: Option<String>,
    name: Option<String>,
) -> Result<TerminalSession> {
    let id = Uuid::new_v4().to_string();
    let shell_path = shell.unwrap_or_else(|| default_shell());
    let cwd_path = cwd.unwrap_or_else(|| dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "/".to_string()));
    
    let session = TerminalSession {
        id: id.clone(),
        name: name.unwrap_or_else(|| format!("Terminal {}", &id[..8])),
        shell: shell_path,
        cwd: cwd_path,
        created_at: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        is_active: true,
    };
    
    TERMINALS.write().await.insert(id, session.clone());
    
    Ok(session)
}

/// Write to terminal
#[tauri::command]
pub async fn terminal_write(id: String, data: String) -> Result<()> {
    let terminals = TERMINALS.read().await;
    
    if !terminals.contains_key(&id) {
        return Err(Error::NotFound(format!("Terminal not found: {}", id)));
    }
    
    // In a full implementation, this would write to the actual PTY
    Ok(())
}

/// Resize terminal
#[tauri::command]
pub async fn terminal_resize(id: String, cols: u16, rows: u16) -> Result<()> {
    let terminals = TERMINALS.read().await;
    
    if !terminals.contains_key(&id) {
        return Err(Error::NotFound(format!("Terminal not found: {}", id)));
    }
    
    // In a full implementation, this would resize the PTY
    Ok(())
}

/// Kill terminal
#[tauri::command]
pub async fn terminal_kill(id: String) -> Result<()> {
    let mut terminals = TERMINALS.write().await;
    
    if terminals.remove(&id).is_none() {
        return Err(Error::NotFound(format!("Terminal not found: {}", id)));
    }
    
    Ok(())
}

/// List available shells
#[tauri::command]
pub async fn terminal_list_shells() -> Result<Vec<ShellInfo>> {
    let mut shells = Vec::new();
    
    // Check for common shells
    let shell_paths = vec![
        ("bash", "/bin/bash"),
        ("zsh", "/bin/zsh"),
        ("sh", "/bin/sh"),
        ("fish", "/usr/bin/fish"),
        ("dash", "/bin/dash"),
        ("pwsh", "/usr/bin/pwsh"),
    ];
    
    #[cfg(target_os = "windows")]
    let shell_paths = vec![
        ("PowerShell", "powershell.exe"),
        ("Command Prompt", "cmd.exe"),
        ("Git Bash", "C:\\Program Files\\Git\\bin\\bash.exe"),
    ];
    
    let default_shell_name = default_shell_name();
    
    for (name, path) in shell_paths {
        let exists = which::which(&path).is_ok() || std::path::Path::new(path).exists();
        
        if exists {
            shells.push(ShellInfo {
                name: name.to_string(),
                path: path.to_string(),
                is_default: name == default_shell_name,
            });
        }
    }
    
    Ok(shells)
}

fn default_shell() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| {
        #[cfg(target_os = "windows")]
        { "powershell.exe".to_string() }
        #[cfg(not(target_os = "windows"))]
        { "/bin/bash".to_string() }
    })
}

fn default_shell_name() -> &'static str {
    #[cfg(target_os = "windows")]
    { "PowerShell" }
    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("SHELL")
            .map(|s| {
                if s.contains("zsh") { "zsh" }
                else if s.contains("fish") { "fish" }
                else { "bash" }
            })
            .unwrap_or("bash")
    }
}
