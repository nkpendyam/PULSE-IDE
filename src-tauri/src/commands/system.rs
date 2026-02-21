//! System commands for Kyro IDE

use crate::error::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub os_version: String,
    pub arch: String,
    pub hostname: String,
    pub cpu_count: usize,
    pub total_memory: u64,
    pub free_memory: u64,
    pub home_dir: String,
    pub current_dir: String,
    pub shell: String,
    pub app_version: String,
    pub app_data_dir: String,
    pub app_config_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvVar {
    pub key: String,
    pub value: String,
}

/// Get system information
#[tauri::command]
pub async fn system_info() -> Result<SystemInfo> {
    let os_info = os_info::get();
    
    Ok(SystemInfo {
        os: os_info.os_type().to_string(),
        os_version: os_info.version().to_string(),
        arch: std::env::consts::ARCH.to_string(),
        hostname: hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "unknown".to_string()),
        cpu_count: num_cpus::get(),
        total_memory: sys_info::mem_info()
            .map(|m| m.total * 1024)
            .unwrap_or(0),
        free_memory: sys_info::mem_info()
            .map(|m| m.free * 1024)
            .unwrap_or(0),
        home_dir: dirs::home_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "/".to_string()),
        current_dir: std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| "/".to_string()),
        shell: std::env::var("SHELL")
            .unwrap_or_else(|_| {
                #[cfg(target_os = "windows")]
                { "powershell.exe".to_string() }
                #[cfg(not(target_os = "windows"))]
                { "/bin/bash".to_string() }
            }),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        app_data_dir: dirs::data_dir()
            .map(|p| p.join("kyro-ide").to_string_lossy().to_string())
            .unwrap_or_else(|| "/kyro-ide".to_string()),
        app_config_dir: dirs::config_dir()
            .map(|p| p.join("kyro-ide").to_string_lossy().to_string())
            .unwrap_or_else(|| "/kyro-ide".to_string()),
    })
}

/// Open URL in default browser
#[tauri::command]
pub async fn system_open_url(url: String) -> Result<()> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .ok();
    }
    
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", &url])
            .spawn()
            .ok();
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .ok();
    }
    
    Ok(())
}

/// Open file in default application
#[tauri::command]
pub async fn system_open_file(path: String) -> Result<()> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .ok();
    }
    
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn()
            .ok();
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .ok();
    }
    
    Ok(())
}

/// Get environment variable
#[tauri::command]
pub async fn system_get_env(key: String) -> Result<Option<String>> {
    Ok(std::env::var(&key).ok())
}

/// Set environment variable (for current process)
#[tauri::command]
pub async fn system_set_env(key: String, value: String) -> Result<()> {
    std::env::set_var(&key, &value);
    Ok(())
}

/// Get PATH environment variable as list
#[tauri::command]
pub async fn system_get_path() -> Result<Vec<String>> {
    let path = std::env::var("PATH").unwrap_or_default();
    let separator = if cfg!(windows) { ";" } else { ":" };
    
    Ok(path.split(separator)
        .map(String::from)
        .filter(|p| !p.is_empty())
        .collect())
}

/// Get application config directory
#[tauri::command]
pub async fn system_get_config_dir() -> Result<String> {
    Ok(dirs::config_dir()
        .map(|p| p.join("kyro-ide").to_string_lossy().to_string())
        .unwrap_or_else(|| "/kyro-ide".to_string()))
}

/// Get application data directory
#[tauri::command]
pub async fn system_get_data_dir() -> Result<String> {
    Ok(dirs::data_dir()
        .map(|p| p.join("kyro-ide").to_string_lossy().to_string())
        .unwrap_or_else(|| "/kyro-ide".to_string()))
}
