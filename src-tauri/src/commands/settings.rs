//! Settings Persistence Commands
//!
//! Global user settings stored as JSON at `~/.kyro/settings.json`.
//! Settings are read on startup and written on every change.

use std::path::PathBuf;
use std::process::Stdio;
use tauri::command;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeCapabilityMatrix {
    pub supports_ssh: bool,
    pub supports_wsl: bool,
    pub supports_docker: bool,
    pub supports_debugpy: bool,
    pub supports_lldb_vscode: bool,
    pub supports_delve: bool,
    pub supports_ollama: bool,
    pub notes: Vec<String>,
}

fn binary_available(binary: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("where")
            .arg(binary)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("sh")
            .arg("-lc")
            .arg(format!("command -v {}", binary))
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    }
}

/// Get the settings file path: ~/.kyro/settings.json
fn settings_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".kyro")
        .join("settings.json")
}

/// Default settings
fn default_settings() -> serde_json::Value {
    serde_json::json!({
        "theme": "dark",
        "fontSize": 14,
        "fontFamily": "JetBrains Mono, Fira Code, monospace",
        "tabSize": 4,
        "insertSpaces": true,
        "wordWrap": "off",
        "minimap": true,
        "lineNumbers": true,
        "autoSave": true,
        "autoSaveDelay": 1000,
        "formatOnSave": false,
        "bracketPairColorization": true,
        "ai.model": "auto",
        "ai.backend": "auto",
        "ai.temperature": 0.7,
        "ai.maxTokens": 2048,
        "ai.contextWindow": 8192,
        "terminal.fontSize": 13,
        "terminal.shell": "auto",
        "collaboration.autoConnect": false,
        "git.autoStage": false,
        "git.confirmSync": true,
        "rag.backgroundIndexing": true,
        "rag.maxResults": 10
    })
}

/// Read settings from disk, merging with defaults
fn read_settings() -> serde_json::Value {
    let path = settings_path();
    let defaults = default_settings();

    if path.exists() {
        match std::fs::read_to_string(&path) {
            Ok(content) => match serde_json::from_str::<serde_json::Value>(&content) {
                Ok(saved) => merge_json(&defaults, &saved),
                Err(_) => defaults,
            },
            Err(_) => defaults,
        }
    } else {
        defaults
    }
}

/// Write settings to disk
fn write_settings(settings: &serde_json::Value) -> Result<(), String> {
    let path = settings_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create settings dir: {}", e))?;
    }
    let json = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    std::fs::write(&path, json).map_err(|e| format!("Failed to write settings: {}", e))
}

/// Merge saved settings over defaults (saved values win)
fn merge_json(defaults: &serde_json::Value, saved: &serde_json::Value) -> serde_json::Value {
    match (defaults, saved) {
        (serde_json::Value::Object(def_map), serde_json::Value::Object(saved_map)) => {
            let mut merged = def_map.clone();
            for (key, value) in saved_map {
                merged.insert(key.clone(), value.clone());
            }
            serde_json::Value::Object(merged)
        }
        _ => saved.clone(),
    }
}

// ============ Tauri Commands ============

#[command]
pub fn get_settings() -> Result<serde_json::Value, String> {
    Ok(read_settings())
}

#[command]
pub fn set_setting(key: String, value: serde_json::Value) -> Result<serde_json::Value, String> {
    let mut settings = read_settings();
    if let serde_json::Value::Object(ref mut map) = settings {
        map.insert(key, value);
    }
    write_settings(&settings)?;
    Ok(settings)
}

#[command]
pub fn reset_settings() -> Result<serde_json::Value, String> {
    let defaults = default_settings();
    write_settings(&defaults)?;
    Ok(defaults)
}

#[command]
pub fn export_settings() -> Result<String, String> {
    let settings = read_settings();
    serde_json::to_string_pretty(&settings).map_err(|e| format!("Failed to export: {}", e))
}

#[command]
pub fn import_settings(json_str: String) -> Result<serde_json::Value, String> {
    let imported: serde_json::Value =
        serde_json::from_str(&json_str).map_err(|e| format!("Invalid JSON: {}", e))?;
    let defaults = default_settings();
    let merged = merge_json(&defaults, &imported);
    write_settings(&merged)?;
    Ok(merged)
}

/// Check if first run has been completed
#[command]
pub fn is_first_run() -> Result<bool, String> {
    let settings = read_settings();
    Ok(!settings
        .get("firstRunComplete")
        .and_then(|v| v.as_bool())
        .unwrap_or(false))
}

#[command]
pub fn get_runtime_capability_matrix() -> Result<RuntimeCapabilityMatrix, String> {
    let supports_ssh = binary_available("ssh");
    let supports_docker = binary_available("docker");
    let supports_debugpy = binary_available("debugpy") || binary_available("python");
    let supports_lldb_vscode = binary_available("lldb-vscode");
    let supports_delve = binary_available("dlv");
    let supports_ollama = binary_available("ollama");

    let supports_wsl = {
        #[cfg(target_os = "windows")]
        {
            binary_available("wsl")
        }
        #[cfg(not(target_os = "windows"))]
        {
            false
        }
    };

    let mut notes = Vec::new();
    if !supports_ssh {
        notes.push("SSH client is not available on PATH.".to_string());
    }
    if !supports_docker {
        notes.push("Docker CLI is unavailable; devcontainer workflows are limited.".to_string());
    }
    if !supports_lldb_vscode && !supports_debugpy && !supports_delve {
        notes.push("No debug adapters detected (lldb-vscode/debugpy/dlv).".to_string());
    }
    if !supports_ollama {
        notes.push("Ollama not detected; local AI fallback requires embedded model/runtime only.".to_string());
    }

    Ok(RuntimeCapabilityMatrix {
        supports_ssh,
        supports_wsl,
        supports_docker,
        supports_debugpy,
        supports_lldb_vscode,
        supports_delve,
        supports_ollama,
        notes,
    })
}
