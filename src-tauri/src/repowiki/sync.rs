//! Sync — watches for file changes and triggers incremental wiki updates.
//!
//! Reuses the notify crate (already a dependency) to watch the project tree,
//! debounces change events, and calls `RepoWikiEngine::update_wiki()`.

use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::mpsc;

use super::RepoWikiConfig;

/// Source extensions that should trigger a wiki update (must match scanner)
const WATCH_EXTENSIONS: &[&str] = &[
    "rs", "ts", "tsx", "js", "jsx", "py", "go", "java", "c", "cpp", "h", "hpp",
];

/// Start watching the project directory for changes.
/// Returns a receiver of changed file paths (relative to project root) and the watcher handle.
pub fn start_watching(
    config: &RepoWikiConfig,
) -> Result<(mpsc::UnboundedReceiver<Vec<String>>, RecommendedWatcher), String> {
    let (tx, rx) = mpsc::unbounded_channel::<Vec<String>>();
    let project_root = config.project_path.clone();
    let ignore_dirs = config.ignore_dirs.clone();
    let output_dir = config.output_dir.clone();

    let debounce_tx = tx.clone();
    let (raw_tx, mut raw_rx) = mpsc::unbounded_channel::<PathBuf>();

    // Debounce: collect changes over 1 second, then emit batch
    tokio::spawn(async move {
        let mut pending: Vec<String> = Vec::new();
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(1));

        loop {
            tokio::select! {
                Some(path) = raw_rx.recv() => {
                    if let Ok(rel) = path.strip_prefix(&project_root) {
                        let rel_str = rel.to_string_lossy().replace('\\', "/");
                        if !pending.contains(&rel_str) {
                            pending.push(rel_str);
                        }
                    }
                }
                _ = interval.tick() => {
                    if !pending.is_empty() {
                        let batch = std::mem::take(&mut pending);
                        let _ = debounce_tx.send(batch);
                    }
                }
            }
        }
    });

    let project_root_clone = config.project_path.clone();
    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        if let Ok(event) = res {
            for path in &event.paths {
                if !path.is_file() {
                    continue;
                }
                if should_ignore_path(path, &project_root_clone, &ignore_dirs, &output_dir) {
                    continue;
                }
                if !is_watched_extension(path) {
                    continue;
                }
                let _ = raw_tx.send(path.clone());
            }
        }
    })
    .map_err(|e| format!("Failed to create file watcher: {}", e))?;

    watcher
        .watch(&config.project_path, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to start watching: {}", e))?;

    Ok((rx, watcher))
}

/// Spawn a background task that listens for file changes and triggers wiki updates
pub fn spawn_sync_loop(
    engine: Arc<tokio::sync::Mutex<Option<super::RepoWikiEngine>>>,
    mut rx: mpsc::UnboundedReceiver<Vec<String>>,
) {
    tokio::spawn(async move {
        while let Some(changed_paths) = rx.recv().await {
            log::info!(
                "RepoWiki sync: {} files changed, updating wiki...",
                changed_paths.len()
            );
            let mut guard = engine.lock().await;
            if let Some(eng) = guard.as_mut() {
                match eng.update_wiki(&changed_paths).await {
                    Ok(status) => {
                        log::info!(
                            "RepoWiki sync complete: {} pages updated",
                            status.pages_generated
                        );
                    }
                    Err(e) => {
                        log::warn!("RepoWiki sync failed: {}", e);
                    }
                }
            }
        }
    });
}

fn should_ignore_path(
    path: &PathBuf,
    root: &PathBuf,
    ignore_dirs: &[String],
    output_dir: &str,
) -> bool {
    let rel = path.strip_prefix(root).unwrap_or(path);
    for component in rel.components() {
        let s = component.as_os_str().to_string_lossy();
        if ignore_dirs.iter().any(|d| d == s.as_ref()) {
            return true;
        }
    }
    // Also ignore the output directory itself
    let rel_str = rel.to_string_lossy().replace('\\', "/");
    if rel_str.starts_with(output_dir) {
        return true;
    }
    false
}

fn is_watched_extension(path: &PathBuf) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|ext| WATCH_EXTENSIONS.contains(&ext))
        .unwrap_or(false)
}
