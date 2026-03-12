//! Tauri commands for the RepoWiki system.
//!
//! Exposes wiki generation, status, sync control, and config to the frontend.

use lazy_static::lazy_static;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::repowiki::{RepoWikiConfig, RepoWikiEngine, WikiPhase, WikiStatus};

lazy_static! {
    static ref WIKI_ENGINE: Arc<Mutex<Option<RepoWikiEngine>>> = Arc::new(Mutex::new(None));
    static ref WIKI_WATCHER: Arc<Mutex<Option<notify::RecommendedWatcher>>> =
        Arc::new(Mutex::new(None));
}

/// Expose the wiki engine handle so other commands (e.g. graph-enhanced RAG) can access it
pub fn get_wiki_engine() -> Arc<Mutex<Option<RepoWikiEngine>>> {
    WIKI_ENGINE.clone()
}

/// Initialize the RepoWiki engine with a project path
#[tauri::command]
pub async fn repowiki_init(project_path: String) -> Result<String, String> {
    let mut config = RepoWikiConfig::default();
    config.project_path = std::path::PathBuf::from(&project_path);

    let engine = RepoWikiEngine::new(config);
    *WIKI_ENGINE.lock().await = Some(engine);

    Ok(format!("RepoWiki initialized for {}", project_path))
}

/// Generate the full wiki (scan → graph → LLM generate → write)
#[tauri::command]
pub async fn repowiki_generate(project_path: String) -> Result<WikiStatus, String> {
    let mut guard = WIKI_ENGINE.lock().await;

    // Auto-init if not already initialized
    if guard.is_none() {
        let mut config = RepoWikiConfig::default();
        config.project_path = std::path::PathBuf::from(&project_path);
        *guard = Some(RepoWikiEngine::new(config));
    }

    let engine = guard.as_mut().ok_or("Engine not initialized")?;
    engine.config.project_path = std::path::PathBuf::from(&project_path);
    engine.generate_wiki().await
}

/// Get current wiki generation status
#[tauri::command]
pub async fn repowiki_status() -> Result<WikiStatus, String> {
    let guard = WIKI_ENGINE.lock().await;
    match guard.as_ref() {
        Some(engine) => Ok(engine.status.clone()),
        None => Ok(WikiStatus::default()),
    }
}

/// Get the current RepoWiki config
#[tauri::command]
pub async fn repowiki_get_config() -> Result<RepoWikiConfig, String> {
    let guard = WIKI_ENGINE.lock().await;
    match guard.as_ref() {
        Some(engine) => Ok(engine.config.clone()),
        None => Ok(RepoWikiConfig::default()),
    }
}

/// Update RepoWiki config
#[tauri::command]
pub async fn repowiki_set_config(config: RepoWikiConfig) -> Result<String, String> {
    let mut guard = WIKI_ENGINE.lock().await;
    match guard.as_mut() {
        Some(engine) => {
            engine.config = config;
            Ok("Config updated".to_string())
        }
        None => {
            *guard = Some(RepoWikiEngine::new(config));
            Ok("Engine initialized with new config".to_string())
        }
    }
}

/// Start living sync — watch for file changes and auto-update wiki
#[tauri::command]
pub async fn repowiki_start_sync(project_path: String) -> Result<String, String> {
    // Ensure engine exists
    {
        let mut guard = WIKI_ENGINE.lock().await;
        if guard.is_none() {
            let mut config = RepoWikiConfig::default();
            config.project_path = std::path::PathBuf::from(&project_path);
            *guard = Some(RepoWikiEngine::new(config));
        }
    }

    let engine_arc = WIKI_ENGINE.clone();
    let config = {
        let guard = engine_arc.lock().await;
        guard.as_ref().ok_or("Engine not initialized")?.config.clone()
    };

    let (rx, watcher) = crate::repowiki::sync::start_watching(&config)?;

    // Store watcher handle
    *WIKI_WATCHER.lock().await = Some(watcher);

    // Spawn the sync loop
    crate::repowiki::sync::spawn_sync_loop(engine_arc, rx);

    Ok("RepoWiki sync started".to_string())
}

/// Stop living sync
#[tauri::command]
pub async fn repowiki_stop_sync() -> Result<String, String> {
    let mut guard = WIKI_WATCHER.lock().await;
    if guard.is_some() {
        *guard = None; // Dropping the watcher stops it
        Ok("RepoWiki sync stopped".to_string())
    } else {
        Ok("Sync was not running".to_string())
    }
}

/// Clean (delete) the generated wiki output
#[tauri::command]
pub async fn repowiki_clean(project_path: String) -> Result<String, String> {
    let mut config = RepoWikiConfig::default();
    config.project_path = std::path::PathBuf::from(&project_path);
    crate::repowiki::writer::clean_wiki(&config)?;
    Ok("RepoWiki output cleaned".to_string())
}

/// Get the dependency graph as JSON
#[tauri::command]
pub async fn repowiki_get_graph() -> Result<crate::repowiki::DependencyGraph, String> {
    let guard = WIKI_ENGINE.lock().await;
    match guard.as_ref() {
        Some(engine) => Ok(engine.graph.clone()),
        None => Err("Engine not initialized — run generate first".to_string()),
    }
}

/// Get the dependency graph as a Mermaid diagram string
#[tauri::command]
pub async fn repowiki_get_mermaid() -> Result<String, String> {
    let guard = WIKI_ENGINE.lock().await;
    match guard.as_ref() {
        Some(engine) => Ok(crate::repowiki::graph::graph_to_mermaid(&engine.graph)),
        None => Err("Engine not initialized — run generate first".to_string()),
    }
}

/// Get graph statistics
#[tauri::command]
pub async fn repowiki_graph_stats() -> Result<crate::repowiki::graph::GraphStats, String> {
    let guard = WIKI_ENGINE.lock().await;
    match guard.as_ref() {
        Some(engine) => Ok(crate::repowiki::graph::graph_stats(&engine.graph)),
        None => Err("Engine not initialized — run generate first".to_string()),
    }
}

/// List all generated wiki pages
#[tauri::command]
pub async fn repowiki_list_pages() -> Result<Vec<String>, String> {
    let guard = WIKI_ENGINE.lock().await;
    match guard.as_ref() {
        Some(engine) => Ok(engine.pages.iter().map(|p| p.rel_path.clone()).collect()),
        None => Ok(vec![]),
    }
}
