//! File system commands for KYRO IDE

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;
use tauri::command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub children: Option<Vec<FileNode>>,
    pub extension: Option<String>,
    pub size: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileContent {
    pub path: String,
    pub content: String,
    pub language: String,
}

#[command]
pub async fn read_file(path: String) -> Result<FileContent, String> {
    let path = PathBuf::from(&path);
    let content = fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))?;
    let language = detect_language(&path);
    Ok(FileContent { path: path.to_string_lossy().to_string(), content, language })
}

#[command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    let path = PathBuf::from(&path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {}", e))?;
    }
    fs::write(&path, content).map_err(|e| format!("Failed to write file: {}", e))
}

#[command]
pub async fn list_directory(path: String) -> Result<Vec<FileNode>, String> {
    let path = PathBuf::from(&path);
    let entries = fs::read_dir(&path).map_err(|e| format!("Failed to read directory: {}", e))?;
    let mut nodes = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let entry_path = entry.path();
        let metadata = entry.metadata().ok();
        let node = FileNode {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry_path.to_string_lossy().to_string(),
            is_directory: entry_path.is_dir(),
            children: None,
            extension: entry_path.extension().map(|e| e.to_string_lossy().to_string()),
            size: metadata.as_ref().map(|m| m.len()),
        };
        nodes.push(node);
    }
    nodes.sort_by(|a, b| match (a.is_directory, b.is_directory) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    Ok(nodes)
}

#[command]
pub async fn create_file(path: String) -> Result<(), String> {
    let path = PathBuf::from(&path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {}", e))?;
    }
    fs::write(&path, "").map_err(|e| format!("Failed to create file: {}", e))
}

#[command]
pub async fn create_directory(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| format!("Failed to create directory: {}", e))
}

#[command]
pub async fn delete_file(path: String) -> Result<(), String> {
    fs::remove_file(&path).map_err(|e| format!("Failed to delete file: {}", e))
}

#[command]
pub async fn delete_directory(path: String) -> Result<(), String> {
    fs::remove_dir_all(&path).map_err(|e| format!("Failed to delete directory: {}", e))
}

#[command]
pub async fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path).map_err(|e| format!("Failed to rename: {}", e))
}

#[command]
pub async fn get_file_tree(path: String, max_depth: Option<usize>) -> Result<FileNode, String> {
    build_file_tree(&PathBuf::from(&path), max_depth.unwrap_or(10))
}

fn build_file_tree(path: &PathBuf, depth: usize) -> Result<FileNode, String> {
    let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
    let is_dir = path.is_dir();
    let metadata = path.metadata().ok();
    let children = if is_dir && depth > 0 {
        let entries = fs::read_dir(path).map_err(|e| format!("Failed to read directory: {}", e))?;
        let mut child_nodes: Vec<FileNode> = entries.filter_map(|e| e.ok())
            .filter_map(|e| build_file_tree(&e.path(), depth - 1).ok()).collect();
        child_nodes.sort_by(|a, b| match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        });
        Some(child_nodes)
    } else { None };
    Ok(FileNode { name, path: path.to_string_lossy().to_string(), is_directory: is_dir, children, extension: path.extension().map(|e| e.to_string_lossy().to_string()), size: metadata.as_ref().map(|m| m.len()) })
}

pub fn detect_language(path: &PathBuf) -> String {
    let ext = path.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    match ext.as_str() {
        "rs" => "rust", "py" => "python", "js" => "javascript", "jsx" => "javascript",
        "ts" => "typescript", "tsx" => "typescript", "go" => "go", "java" => "java",
        "kt" => "kotlin", "swift" => "swift", "c" => "c", "cpp" | "cc" | "cxx" => "cpp",
        "h" | "hpp" => "cpp", "cs" => "csharp", "rb" => "ruby", "php" => "php",
        "sh" => "shell", "html" | "htm" => "html", "css" => "css", "scss" | "sass" => "scss",
        "json" => "json", "yaml" | "yml" => "yaml", "xml" => "xml", "toml" => "toml",
        "md" => "markdown", "sql" => "sql", "vue" => "vue", "svelte" => "svelte",
        _ => "plaintext",
    }.to_string()
}

// ============ First-Run Experience Commands ============

/// Get the config directory for KYRO IDE
fn get_config_dir() -> Result<PathBuf, String> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| "Could not find config directory".to_string())?
        .join("kyro-ide");
    
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
    
    Ok(config_dir)
}

/// Check if first run experience has been completed
#[command]
pub async fn is_first_run_complete() -> Result<bool, String> {
    let config_dir = get_config_dir()?;
    let first_run_file = config_dir.join(".first_run_complete");
    
    Ok(first_run_file.exists())
}

/// Mark first run experience as complete
#[command]
pub async fn save_first_run_complete() -> Result<(), String> {
    let config_dir = get_config_dir()?;
    let first_run_file = config_dir.join(".first_run_complete");
    
    // Write current timestamp
    let content = chrono::Utc::now().to_rfc3339();
    fs::write(&first_run_file, content)
        .map_err(|e| format!("Failed to save first run status: {}", e))?;
    
    Ok(())
}

/// Get list of supported languages
#[command]
pub async fn list_supported_languages() -> Result<Vec<String>, String> {
    Ok(vec![
        "Rust".to_string(),
        "TypeScript".to_string(),
        "JavaScript".to_string(),
        "Python".to_string(),
        "Go".to_string(),
        "Java".to_string(),
        "C++".to_string(),
        "C".to_string(),
        "C#".to_string(),
        "Ruby".to_string(),
        "PHP".to_string(),
        "Swift".to_string(),
        "Kotlin".to_string(),
        "Scala".to_string(),
        "Lua".to_string(),
        "Shell".to_string(),
        "HTML".to_string(),
        "CSS".to_string(),
        "SCSS".to_string(),
        "JSON".to_string(),
        "YAML".to_string(),
        "TOML".to_string(),
        "Markdown".to_string(),
        "SQL".to_string(),
        "Vue".to_string(),
        "Svelte".to_string(),
        "XML".to_string(),
    ])
}
