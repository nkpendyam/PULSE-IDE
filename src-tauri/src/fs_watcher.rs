//! File system watcher for Kyro IDE

use crate::error::Result;
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Runtime};
use tokio::sync::RwLock;

lazy_static::lazy_static! {
    static ref WATCHERS: Arc<RwLock<HashMap<String, RecommendedWatcher>>> = 
        Arc::new(RwLock::new(HashMap::new()));
}

pub fn init<R: Runtime>(_app: &AppHandle<R>) -> Result<()> {
    tracing::info!("File system watcher initialized");
    Ok(())
}

pub async fn watch_directory<R: Runtime>(
    app: AppHandle<R>,
    path: &str,
    recursive: bool,
) -> Result<()> {
    let mut watchers = WATCHERS.write().await;
    
    // Don't duplicate watchers
    if watchers.contains_key(path) {
        return Ok(());
    }
    
    let path_owned = path.to_string();
    let app_handle = app.clone();
    
    let mut watcher = RecommendedWatcher::new(
        move |res: Result<Event, notify::Error>| {
            match res {
                Ok(event) => {
                    let kind = match event.kind {
                        EventKind::Create(_) => "create",
                        EventKind::Modify(_) => "modify",
                        EventKind::Remove(_) => "remove",
                        EventKind::Access(_) => "access",
                        EventKind::Any => "any",
                        _ => "other",
                    };
                    
                    let paths: Vec<String> = event.paths
                        .iter()
                        .map(|p| p.to_string_lossy().to_string())
                        .collect();
                    
                    let _ = app_handle.emit("fs:change", serde_json::json!({
                        "kind": kind,
                        "paths": paths,
                        "directory": &path_owned,
                    }));
                }
                Err(e) => {
                    tracing::error!("Watch error: {}", e);
                }
            }
        },
        notify::Config::default(),
    ).map_err(|e| crate::error::Error::Unexpected(e.to_string()))?;
    
    let mode = if recursive {
        RecursiveMode::Recursive
    } else {
        RecursiveMode::NonRecursive
    };
    
    watcher.watch(Path::new(path), mode)
        .map_err(|e| crate::error::Error::Unexpected(e.to_string()))?;
    
    watchers.insert(path.to_string(), watcher);
    
    Ok(())
}

pub async fn unwatch_directory(path: &str) -> Result<()> {
    let mut watchers = WATCHERS.write().await;
    
    if let Some(mut watcher) = watchers.remove(path) {
        watcher.unwatch(Path::new(path))
            .map_err(|e| crate::error::Error::Unexpected(e.to_string()))?;
    }
    
    Ok(())
}
