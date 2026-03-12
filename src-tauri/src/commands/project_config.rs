//! Project-Scoped Configuration Commands
//!
//! Per-project settings stored in `.kyro/config.json` inside the project root.
//! Overrides global settings for project-specific preferences.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::command;

/// Project config file path: <project_root>/.kyro/config.json
fn project_config_path(project_path: &str) -> PathBuf {
    Path::new(project_path).join(".kyro").join("config.json")
}

/// Default project config
fn default_project_config() -> serde_json::Value {
    serde_json::json!({
        "name": "",
        "preferredModel": "auto",
        "excludePaths": ["node_modules", "target", "dist", ".git", "build"],
        "testCommand": "",
        "buildCommand": "",
        "formatCommand": "",
        "lintCommand": "",
        "agentRules": [],
        "rag": {
            "enabled": true,
            "chunkSize": 512,
            "includePatterns": ["**/*.rs", "**/*.ts", "**/*.tsx", "**/*.py", "**/*.go", "**/*.java"]
        }
    })
}

/// Read project config, merging with defaults
fn read_project_config(project_path: &str) -> serde_json::Value {
    let path = project_config_path(project_path);
    let defaults = default_project_config();

    if path.exists() {
        match std::fs::read_to_string(&path) {
            Ok(content) => {
                match serde_json::from_str::<serde_json::Value>(&content) {
                    Ok(saved) => merge_json(&defaults, &saved),
                    Err(_) => defaults,
                }
            }
            Err(_) => defaults,
        }
    } else {
        defaults
    }
}

/// Write project config to disk
fn write_project_config(project_path: &str, config: &serde_json::Value) -> Result<(), String> {
    let path = project_config_path(project_path);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create .kyro dir: {}", e))?;
    }
    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    std::fs::write(&path, json).map_err(|e| format!("Failed to write config: {}", e))
}

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

/// Initialize a `.kyro/config.json` in the project root with defaults
#[command]
pub fn init_project_config(project_path: String) -> Result<serde_json::Value, String> {
    let path = project_config_path(&project_path);
    if path.exists() {
        return Ok(read_project_config(&project_path));
    }
    let defaults = default_project_config();
    write_project_config(&project_path, &defaults)?;
    Ok(defaults)
}

/// Get the full project config
#[command]
pub fn get_project_config(project_path: String) -> Result<serde_json::Value, String> {
    Ok(read_project_config(&project_path))
}

/// Set a single key in the project config
#[command]
pub fn set_project_config(project_path: String, key: String, value: serde_json::Value) -> Result<serde_json::Value, String> {
    let mut config = read_project_config(&project_path);
    if let serde_json::Value::Object(ref mut map) = config {
        map.insert(key, value);
    }
    write_project_config(&project_path, &config)?;
    Ok(config)
}
