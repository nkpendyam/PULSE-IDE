//! File system commands for Kyro IDE

use crate::error::{Error, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use ignore::WalkBuilder;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_file: bool,
    pub size: u64,
    pub modified: Option<String>,
    pub created: Option<String>,
    pub readonly: bool,
    pub extension: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub line: Option<usize>,
    pub content: Option<String>,
}

/// Read file contents
#[tauri::command]
pub async fn fs_read_file(path: String) -> Result<String> {
    let path = PathBuf::from(&path);
    
    if !path.exists() {
        return Err(Error::NotFound(format!("File not found: {}", path.display())));
    }
    
    if !path.is_file() {
        return Err(Error::Path(format!("Path is not a file: {}", path.display())));
    }
    
    tokio::fs::read_to_string(&path)
        .await
        .map_err(Error::Io)
}

/// Write content to file
#[tauri::command]
pub async fn fs_write_file(path: String, content: String) -> Result<()> {
    let path = PathBuf::from(&path);
    
    // Create parent directories if they don't exist
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(Error::Io)?;
    }
    
    tokio::fs::write(&path, content)
        .await
        .map_err(Error::Io)
}

/// List directory contents
#[tauri::command]
pub async fn fs_list_directory(path: String) -> Result<Vec<FileInfo>> {
    let path = PathBuf::from(&path);
    
    if !path.exists() {
        return Err(Error::NotFound(format!("Directory not found: {}", path.display())));
    }
    
    if !path.is_dir() {
        return Err(Error::Path(format!("Path is not a directory: {}", path.display())));
    }
    
    let mut entries = Vec::new();
    let mut read_dir = tokio::fs::read_dir(&path)
        .await
        .map_err(Error::Io)?;
    
    while let Some(entry) = read_dir.next_entry().await.map_err(Error::Io)? {
        let entry_path = entry.path();
        let metadata = entry.metadata().await.ok();
        
        let info = FileInfo {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry_path.to_string_lossy().to_string(),
            is_dir: entry_path.is_dir(),
            is_file: entry_path.is_file(),
            size: metadata.as_ref().map(|m| m.len()).unwrap_or(0),
            modified: metadata.as_ref().and_then(|m| {
                m.modified().ok().map(|t| {
                    chrono::DateTime::from(t)
                        .format("%Y-%m-%d %H:%M:%S")
                        .to_string()
                })
            }),
            created: metadata.as_ref().and_then(|m| {
                m.created().ok().map(|t| {
                    chrono::DateTime::from(t)
                        .format("%Y-%m-%d %H:%M:%S")
                        .to_string()
                })
            }),
            readonly: metadata.as_ref().map(|m| m.permissions().readonly()).unwrap_or(false),
            extension: entry_path
                .extension()
                .map(|e| e.to_string_lossy().to_string()),
        };
        
        entries.push(info);
    }
    
    // Sort: directories first, then by name
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
    
    Ok(entries)
}

/// Create a directory
#[tauri::command]
pub async fn fs_create_directory(path: String) -> Result<()> {
    let path = PathBuf::from(&path);
    tokio::fs::create_dir_all(&path)
        .await
        .map_err(Error::Io)
}

/// Delete a file
#[tauri::command]
pub async fn fs_delete_file(path: String) -> Result<()> {
    let path = PathBuf::from(&path);
    
    if !path.exists() {
        return Err(Error::NotFound(format!("File not found: {}", path.display())));
    }
    
    tokio::fs::remove_file(&path)
        .await
        .map_err(Error::Io)
}

/// Delete a directory
#[tauri::command]
pub async fn fs_delete_directory(path: String, recursive: bool) -> Result<()> {
    let path = PathBuf::from(&path);
    
    if !path.exists() {
        return Err(Error::NotFound(format!("Directory not found: {}", path.display())));
    }
    
    if recursive {
        tokio::fs::remove_dir_all(&path)
            .await
            .map_err(Error::Io)
    } else {
        tokio::fs::remove_dir(&path)
            .await
            .map_err(Error::Io)
    }
}

/// Copy a file
#[tauri::command]
pub async fn fs_copy_file(source: String, destination: String) -> Result<()> {
    let src = PathBuf::from(&source);
    let dest = PathBuf::from(&destination);
    
    if !src.exists() {
        return Err(Error::NotFound(format!("Source file not found: {}", src.display())));
    }
    
    // Create parent directories
    if let Some(parent) = dest.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(Error::Io)?;
    }
    
    tokio::fs::copy(&src, &dest)
        .await
        .map(|_| ())
        .map_err(Error::Io)
}

/// Move/rename a file or directory
#[tauri::command]
pub async fn fs_move_file(source: String, destination: String) -> Result<()> {
    let src = PathBuf::from(&source);
    let dest = PathBuf::from(&destination);
    
    if !src.exists() {
        return Err(Error::NotFound(format!("Source not found: {}", src.display())));
    }
    
    // Create parent directories
    if let Some(parent) = dest.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(Error::Io)?;
    }
    
    tokio::fs::rename(&src, &dest)
        .await
        .map_err(Error::Io)
}

/// Check if a path exists
#[tauri::command]
pub async fn fs_exists(path: String) -> Result<bool> {
    Ok(PathBuf::from(&path).exists())
}

/// Get detailed file information
#[tauri::command]
pub async fn fs_get_file_info(path: String) -> Result<FileInfo> {
    let path = PathBuf::from(&path);
    
    if !path.exists() {
        return Err(Error::NotFound(format!("Path not found: {}", path.display())));
    }
    
    let metadata = tokio::fs::metadata(&path)
        .await
        .map_err(Error::Io)?;
    
    Ok(FileInfo {
        name: path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default(),
        path: path.to_string_lossy().to_string(),
        is_dir: path.is_dir(),
        is_file: path.is_file(),
        size: metadata.len(),
        modified: metadata.modified().ok().map(|t| {
            chrono::DateTime::from(t)
                .format("%Y-%m-%d %H:%M:%S")
                .to_string()
        }),
        created: metadata.created().ok().map(|t| {
            chrono::DateTime::from(t)
                .format("%Y-%m-%d %H:%M:%S")
                .to_string()
        }),
        readonly: metadata.permissions().readonly(),
        extension: path.extension().map(|e| e.to_string_lossy().to_string()),
    })
}

/// Search for files by name pattern
#[tauri::command]
pub async fn fs_search_files(
    path: String,
    pattern: String,
    recursive: bool,
    include_hidden: bool,
) -> Result<Vec<SearchResult>> {
    let root = PathBuf::from(&path);
    
    if !root.exists() {
        return Err(Error::NotFound(format!("Path not found: {}", root.display())));
    }
    
    let pattern_lower = pattern.to_lowercase();
    let mut results = Vec::new();
    
    let walker = if recursive {
        WalkBuilder::new(&root)
            .hidden(!include_hidden)
            .git_ignore(true)
            .git_global(true)
            .git_exclude(true)
            .build()
    } else {
        WalkBuilder::new(&root)
            .max_depth(1)
            .hidden(!include_hidden)
            .build()
    };
    
    for entry in walker.filter_map(|e| e.ok()) {
        let entry_path = entry.path();
        let name = entry_path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        
        if name.to_lowercase().contains(&pattern_lower) {
            results.push(SearchResult {
                path: entry_path.to_string_lossy().to_string(),
                name,
                is_dir: entry_path.is_dir(),
                line: None,
                content: None,
            });
        }
    }
    
    Ok(results)
}
