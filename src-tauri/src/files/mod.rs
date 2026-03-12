//! File system operations and watching for KYRO IDE
//!
//! This module provides:
//! - File read/write operations
//! - Directory traversal and listing
//! - File tree generation
//! - Real-time file change detection using notify crate
//! - File permission and error handling

pub mod local_history;

use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::mpsc::{channel, Receiver};
use tauri::{Emitter, WebviewWindow};

/// File watcher that monitors file system changes and emits events to the frontend
pub struct FileWatcher {
    watcher: RecommendedWatcher,
    window: WebviewWindow,
    _receiver: Receiver<Result<Event, notify::Error>>,
}

impl FileWatcher {
    /// Create a new file watcher
    pub fn new(window: WebviewWindow) -> Result<Self, String> {
        let (tx, rx) = channel();
        let window_clone = window.clone();

        let watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                if let Ok(event) = &res {
                    // Emit event to frontend
                    let _ = window_clone.emit("file-changed", FileChangeEvent::from(event));
                }
                let _ = tx.send(res);
            },
            Config::default(),
        )
        .map_err(|e| format!("Failed to create file watcher: {}", e))?;

        Ok(Self {
            watcher,
            window,
            _receiver: rx,
        })
    }

    /// Watch a path for changes
    pub fn watch(&mut self, path: impl AsRef<Path>) -> Result<(), String> {
        self.watcher
            .watch(path.as_ref(), RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch path: {}", e))
    }

    /// Stop watching a path
    pub fn unwatch(&mut self, path: impl AsRef<Path>) -> Result<(), String> {
        self.watcher
            .unwatch(path.as_ref())
            .map_err(|e| format!("Failed to unwatch path: {}", e))
    }
}

/// File change event sent to the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChangeEvent {
    pub kind: FileChangeKind,
    pub paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FileChangeKind {
    Create,
    Modify,
    Delete,
    Rename,
    Other,
}

impl From<&Event> for FileChangeEvent {
    fn from(event: &Event) -> Self {
        use notify::EventKind;

        let kind = match event.kind {
            EventKind::Create(_) => FileChangeKind::Create,
            EventKind::Modify(_) => FileChangeKind::Modify,
            EventKind::Remove(_) => FileChangeKind::Delete,
            EventKind::Other => FileChangeKind::Other,
            _ => FileChangeKind::Other,
        };

        let paths = event
            .paths
            .iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect();

        Self { kind, paths }
    }
}
