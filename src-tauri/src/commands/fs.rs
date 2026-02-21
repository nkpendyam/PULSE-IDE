use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::State;
use std::collections::HashMap;
use std::sync::Mutex;
use notify::{Watcher, RecursiveMode, watcher};
use std::sync::mpsc::channel;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_file: bool,
    pub size: u64,
    pub modified: Option<u64>,
    pub created: Option<u64>,
    pub extension: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirectoryListing {
    pub path: String,
    pub entries: Vec<FileInfo>,
}

// Active watchers storage
pub type Watchers = Mutex<HashMap<String, notify::RecommendedWatcher>>;

/// Read file contents
#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file '{}': {}", path, e))
}

/// Write content to file
#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    // Create parent directories if they don't exist
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write file '{}': {}", path, e))
}

/// Delete a file
#[tauri::command]
pub async fn delete_file(path: String) -> Result<(), String> {
    fs::remove_file(&path)
        .map_err(|e| format!("Failed to delete file '{}': {}", path, e))
}

/// Create a directory
#[tauri::command]
pub async fn create_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path)
        .map_err(|e| format!("Failed to create directory '{}': {}", path, e))
}

/// Delete a directory (and its contents if recursive)
#[tauri::command]
pub async fn delete_dir(path: String, recursive: bool) -> Result<(), String> {
    if recursive {
        fs::remove_dir_all(&path)
            .map_err(|e| format!("Failed to delete directory '{}': {}", path, e))
    } else {
        fs::remove_dir(&path)
            .map_err(|e| format!("Failed to delete directory '{}': {}", path, e))
    }
}

/// List directory contents
#[tauri::command]
pub async fn list_dir(path: String, show_hidden: bool) -> Result<DirectoryListing, String> {
    let entries = fs::read_dir(&path)
        .map_err(|e| format!("Failed to read directory '{}': {}", path, e))?;
    
    let mut file_infos = Vec::new();
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path_buf = entry.path();
        
        // Skip hidden files if not requested
        if !show_hidden {
            if let Some(name) = path_buf.file_name() {
                if name.to_string_lossy().starts_with('.') {
                    continue;
                }
            }
        }
        
        let metadata = entry.metadata().ok();
        
        let info = FileInfo {
            name: path_buf.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default(),
            path: path_buf.to_string_lossy().to_string(),
            is_dir: metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false),
            is_file: metadata.as_ref().map(|m| m.is_file()).unwrap_or(false),
            size: metadata.as_ref().map(|m| m.len()).unwrap_or(0),
            modified: metadata.as_ref().and_then(|m| 
                m.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            ).map(|d| d.as_secs()),
            created: metadata.as_ref().and_then(|m| 
                m.created().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            ).map(|d| d.as_secs()),
            extension: path_buf.extension().map(|e| e.to_string_lossy().to_string()),
        };
        
        file_infos.push(info);
    }
    
    // Sort: directories first, then by name
    file_infos.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
    
    Ok(DirectoryListing {
        path,
        entries: file_infos,
    })
}

/// Check if file exists
#[tauri::command]
pub async fn file_exists(path: String) -> Result<bool, String> {
    Ok(Path::new(&path).exists())
}

/// Copy a file
#[tauri::command]
pub async fn copy_file(source: String, destination: String) -> Result<(), String> {
    fs::copy(&source, &destination)
        .map_err(|e| format!("Failed to copy '{}' to '{}': {}", source, destination, e))?;
    Ok(())
}

/// Move a file
#[tauri::command]
pub async fn move_file(source: String, destination: String) -> Result<(), String> {
    fs::rename(&source, &destination)
        .map_err(|e| format!("Failed to move '{}' to '{}': {}", source, destination, e))?;
    Ok(())
}

/// Rename a file or directory
#[tauri::command]
pub async fn rename_file(path: String, new_name: String) -> Result<(), String> {
    let parent = Path::new(&path).parent()
        .ok_or_else(|| "Invalid path".to_string())?;
    let new_path = parent.join(new_name);
    
    fs::rename(&path, &new_path)
        .map_err(|e| format!("Failed to rename '{}': {}", path, e))?;
    Ok(())
}

/// Get detailed file information
#[tauri::command]
pub async fn get_file_info(path: String) -> Result<FileInfo, String> {
    let path_buf = PathBuf::from(&path);
    let metadata = fs::metadata(&path)
        .map_err(|e| format!("Failed to get metadata for '{}': {}", path, e))?;
    
    Ok(FileInfo {
        name: path_buf.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default(),
        path: path.clone(),
        is_dir: metadata.is_dir(),
        is_file: metadata.is_file(),
        size: metadata.len(),
        modified: metadata.modified().ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs()),
        created: metadata.created().ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs()),
        extension: path_buf.extension().map(|e| e.to_string_lossy().to_string()),
    })
}

/// Watch a directory for changes
#[tauri::command]
pub async fn watch_directory(
    path: String,
    app_handle: tauri::AppHandle,
    watchers: State<'_, Watchers>,
) -> Result<String, String> {
    let (tx, rx) = channel();
    
    let mut watcher = watcher(tx, std::time::Duration::from_millis(200))
        .map_err(|e| format!("Failed to create watcher: {}", e))?;
    
    watcher.watch(&path, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch directory: {}", e))?;
    
    let watcher_id = format!("watch-{}", chrono::Utc::now().timestamp_millis());
    
    // Store the watcher
    {
        let mut watchers_map = watchers.lock().unwrap();
        watchers_map.insert(watcher_id.clone(), watcher);
    }
    
    // Spawn a task to handle events
    let watcher_id_clone = watcher_id.clone();
    tokio::spawn(async move {
        while let Ok(event) = rx.recv() {
            match event {
                notify::DebouncedEvent::Create(path) |
                notify::DebouncedEvent::Write(path) |
                notify::DebouncedEvent::Remove(path) |
                notify::DebouncedEvent::Rename(_, path) => {
                    let _ = app_handle.emit(&format!("fs:change:{}", watcher_id_clone), path.to_string_lossy().to_string());
                }
                _ => {}
            }
        }
    });
    
    Ok(watcher_id)
}

/// Stop watching a directory
#[tauri::command]
pub async fn unwatch_directory(
    watcher_id: String,
    watchers: State<'_, Watchers>,
) -> Result<(), String> {
    let mut watchers_map = watchers.lock().unwrap();
    watchers_map.remove(&watcher_id);
    Ok(())
}
