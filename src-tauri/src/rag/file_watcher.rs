//! RAG File Watcher — auto-reindex on file changes
//!
//! Uses the `notify` crate to watch project directories and trigger
//! incremental re-indexing when source files are created/modified/deleted.

use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};

/// Events the RAG watcher sends to the indexing loop
#[derive(Debug, Clone)]
pub enum RagFileEvent {
    /// A source file was created or modified — reindex it
    Upsert(PathBuf),
    /// A source file was deleted — remove from index
    Removed(PathBuf),
}

/// Source extensions eligible for RAG indexing
const SOURCE_EXTENSIONS: &[&str] = &[
    "rs", "ts", "tsx", "js", "jsx", "py", "go", "java", "c", "cpp", "h", "hpp",
    "cs", "rb", "php", "swift", "kt", "scala", "vue", "svelte",
];

fn is_source_file(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|ext| SOURCE_EXTENSIONS.contains(&ext))
        .unwrap_or(false)
}

fn is_ignored(path: &Path) -> bool {
    let s = path.to_string_lossy();
    s.contains("node_modules")
        || s.contains(".git")
        || s.contains("target")
        || s.contains("dist")
        || s.contains("build")
        || s.contains("__pycache__")
}

/// Start watching a directory for source file changes.
/// Returns a receiver for `RagFileEvent`s and a handle to stop watching.
pub fn start_watching(
    root: PathBuf,
) -> Result<(mpsc::UnboundedReceiver<RagFileEvent>, RecommendedWatcher), String> {
    let (tx, rx) = mpsc::unbounded_channel();

    let watcher = RecommendedWatcher::new(
        move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                for path in &event.paths {
                    if is_ignored(path) || !is_source_file(path) {
                        continue;
                    }
                    let evt = match event.kind {
                        EventKind::Create(_) | EventKind::Modify(_) => {
                            Some(RagFileEvent::Upsert(path.clone()))
                        }
                        EventKind::Remove(_) => Some(RagFileEvent::Removed(path.clone())),
                        _ => None,
                    };
                    if let Some(e) = evt {
                        let _ = tx.send(e);
                    }
                }
            }
        },
        Config::default(),
    )
    .map_err(|e| format!("Failed to create RAG file watcher: {}", e))?;

    Ok((rx, watcher))
}

/// Spawn the background indexing loop that drains `RagFileEvent`s and
/// incrementally updates the RAG index.
///
/// Call this once at startup after managing the RAG state.
pub fn spawn_reindex_loop(
    root: PathBuf,
    rag_state: Arc<RwLock<super::RAGManager>>,
) -> Option<RecommendedWatcher> {
    let (mut rx, mut watcher) = match start_watching(root.clone()) {
        Ok(pair) => pair,
        Err(e) => {
            log::warn!("RAG file watcher failed to start: {}", e);
            return None;
        }
    };

    if let Err(e) = watcher.watch(&root, RecursiveMode::Recursive) {
        log::warn!("RAG file watcher could not watch {}: {}", root.display(), e);
        return None;
    }

    // Spawn the async consumer
    tokio::spawn(async move {
        use tokio::time::{sleep, Duration};

        // Debounce: collect events for 500ms then process in batch
        loop {
            let mut batch: Vec<RagFileEvent> = Vec::new();
            // Wait for the first event
            match rx.recv().await {
                Some(evt) => batch.push(evt),
                None => break, // channel closed
            }
            // Drain for 500ms to debounce rapid saves
            sleep(Duration::from_millis(500)).await;
            while let Ok(evt) = rx.try_recv() {
                batch.push(evt);
            }

            // Process batch
            let mut manager = rag_state.write().await;
            for evt in batch {
                match evt {
                    RagFileEvent::Upsert(path) => {
                        // Remove old chunks for this file, then re-index
                        let path_str = path.to_string_lossy().to_string();
                        manager.remove_file(&path_str);
                        if let Err(e) = manager.index_file(&path).await {
                            log::warn!("RAG reindex failed for {}: {}", path.display(), e);
                        } else {
                            log::debug!("RAG reindexed: {}", path.display());
                        }
                    }
                    RagFileEvent::Removed(path) => {
                        let path_str = path.to_string_lossy().to_string();
                        manager.remove_file(&path_str);
                        log::debug!("RAG removed: {}", path.display());
                    }
                }
            }
        }
        log::info!("RAG file watcher loop exited");
    });

    Some(watcher)
}
