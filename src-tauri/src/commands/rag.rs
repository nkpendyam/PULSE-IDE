//! RAG (Retrieval-Augmented Generation) Commands
//! 
//! Commands for semantic code search and AI-enhanced retrieval

use tauri::State;
use std::sync::Arc;
use tokio::sync::RwLock;

/// RAG index status
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RagIndexStatus {
    pub indexed_files: u64,
    pub total_chunks: u64,
    pub index_size_mb: f64,
    pub last_indexed: Option<String>,
    pub is_indexing: bool,
}

/// Search result from RAG
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RagSearchResult {
    pub file_path: String,
    pub content: String,
    pub score: f32,
    pub line_start: u32,
    pub line_end: u32,
    pub context: String,
}

/// Index request
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct IndexRequest {
    pub path: String,
    pub recursive: bool,
    pub file_types: Option<Vec<String>>,
}

/// Search request
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SearchRequest {
    pub query: String,
    pub max_results: Option<u32>,
    pub file_filter: Option<Vec<String>>,
    pub min_score: Option<f32>,
}

/// RAG configuration
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RagConfig {
    pub chunk_size: u32,
    pub chunk_overlap: u32,
    pub embedding_model: String,
    pub max_results: u32,
}

impl Default for RagConfig {
    fn default() -> Self {
        Self {
            chunk_size: 512,
            chunk_overlap: 50,
            embedding_model: "all-MiniLM-L6-v2".to_string(),
            max_results: 10,
        }
    }
}

/// RAG State
pub struct RagState {
    pub status: RagIndexStatus,
    pub config: RagConfig,
    pub indexed_paths: Vec<String>,
}

impl Default for RagState {
    fn default() -> Self {
        Self {
            status: RagIndexStatus {
                indexed_files: 0,
                total_chunks: 0,
                index_size_mb: 0.0,
                last_indexed: None,
                is_indexing: false,
            },
            config: RagConfig::default(),
            indexed_paths: Vec::new(),
        }
    }
}

// ============ Tauri Commands ============

#[tauri::command]
pub async fn get_rag_status(
    state: State<'_, Arc<RwLock<RagState>>>,
) -> Result<RagIndexStatus, String> {
    let rag = state.read().await;
    Ok(rag.status.clone())
}

#[tauri::command]
pub async fn index_project(
    request: IndexRequest,
    state: State<'_, Arc<RwLock<RagState>>>,
) -> Result<RagIndexStatus, String> {
    let mut rag = state.write().await;
    rag.status.is_indexing = true;
    
    // Simulate indexing (in real impl, would use vector DB)
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    
    rag.status.indexed_files += 100;
    rag.status.total_chunks += 500;
    rag.status.index_size_mb += 5.0;
    rag.status.last_indexed = Some(chrono::Utc::now().to_rfc3339());
    rag.status.is_indexing = false;
    rag.indexed_paths.push(request.path);
    
    Ok(rag.status.clone())
}

#[tauri::command]
pub async fn semantic_search(
    request: SearchRequest,
    state: State<'_, Arc<RwLock<RagState>>>,
) -> Result<Vec<RagSearchResult>, String> {
    let rag = state.read().await;
    let max = request.max_results.unwrap_or(rag.config.max_results);
    
    // Simulate search results
    let results: Vec<RagSearchResult> = (0..max)
        .map(|i| RagSearchResult {
            file_path: format!("/src/file{}.rs", i),
            content: format!("Match {} for query: {}", i, request.query),
            score: 0.95 - (i as f32 * 0.05),
            line_start: i * 10,
            line_end: i * 10 + 5,
            context: format!("Context around match {}", i),
        })
        .collect();
    
    Ok(results)
}

#[tauri::command]
pub async fn clear_rag_index(
    state: State<'_, Arc<RwLock<RagState>>>,
) -> Result<(), String> {
    let mut rag = state.write().await;
    rag.status = RagIndexStatus {
        indexed_files: 0,
        total_chunks: 0,
        index_size_mb: 0.0,
        last_indexed: None,
        is_indexing: false,
    };
    rag.indexed_paths.clear();
    Ok(())
}

#[tauri::command]
pub async fn get_rag_config(
    state: State<'_, Arc<RwLock<RagState>>>,
) -> Result<RagConfig, String> {
    let rag = state.read().await;
    Ok(rag.config.clone())
}

#[tauri::command]
pub async fn set_rag_config(
    config: RagConfig,
    state: State<'_, Arc<RwLock<RagState>>>,
) -> Result<RagConfig, String> {
    let mut rag = state.write().await;
    rag.config = config;
    Ok(rag.config.clone())
}

#[tauri::command]
pub async fn get_indexed_paths(
    state: State<'_, Arc<RwLock<RagState>>>,
) -> Result<Vec<String>, String> {
    let rag = state.read().await;
    Ok(rag.indexed_paths.clone())
}

#[tauri::command]
pub async fn remove_indexed_path(
    path: String,
    state: State<'_, Arc<RwLock<RagState>>>,
) -> Result<(), String> {
    let mut rag = state.write().await;
    rag.indexed_paths.retain(|p| p != &path);
    Ok(())
}
