//! RAG (Retrieval-Augmented Generation) System for KRO_IDE
//!
//! Local vector database for code semantic search and context retrieval

pub mod indexer;
pub mod embedder;
pub mod retriever;
pub mod vector_store;
pub mod embeddings;

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::collections::HashMap;
use anyhow::{Result, Context};

/// RAG configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RAGConfig {
    /// Vector database path
    pub db_path: PathBuf,
    /// Embedding model to use
    pub embedding_model: String,
    /// Chunk size for code splitting
    pub chunk_size: usize,
    /// Chunk overlap
    pub chunk_overlap: usize,
    /// Maximum results to return
    pub max_results: usize,
    /// Enable background indexing
    pub background_indexing: bool,
    /// File patterns to include
    pub include_patterns: Vec<String>,
    /// File patterns to exclude
    pub exclude_patterns: Vec<String>,
}

impl Default for RAGConfig {
    fn default() -> Self {
        Self {
            db_path: dirs::data_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("kro_ide")
                .join("rag_index"),
            embedding_model: "nomic-embed-text-v1.5".to_string(),
            chunk_size: 512,
            chunk_overlap: 50,
            max_results: 5,
            background_indexing: true,
            include_patterns: vec![
                "**/*.rs".to_string(),
                "**/*.py".to_string(),
                "**/*.js".to_string(),
                "**/*.ts".to_string(),
                "**/*.go".to_string(),
                "**/*.java".to_string(),
            ],
            exclude_patterns: vec![
                "**/node_modules/**".to_string(),
                "**/target/**".to_string(),
                "**/.git/**".to_string(),
                "**/dist/**".to_string(),
            ],
        }
    }
}

/// Code chunk for indexing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeChunk {
    /// Unique ID
    pub id: String,
    /// File path
    pub file_path: String,
    /// Start line
    pub start_line: usize,
    /// End line
    pub end_line: usize,
    /// Code content
    pub content: String,
    /// Language
    pub language: String,
    /// Symbol type (function, class, etc.)
    pub symbol_type: Option<String>,
    /// Symbol name
    pub symbol_name: Option<String>,
    /// Embedding vector
    pub embedding: Option<Vec<f32>>,
}

/// Search result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    /// Code chunk
    pub chunk: CodeChunk,
    /// Similarity score (0-1)
    pub score: f32,
    /// Context around the match
    pub context: Option<String>,
}

/// RAG manager
pub struct RAGManager {
    config: RAGConfig,
    index: HashMap<String, CodeChunk>,
    embeddings: HashMap<String, Vec<f32>>,
    is_indexing: bool,
}

impl RAGManager {
    pub fn new(config: RAGConfig) -> Result<Self> {
        std::fs::create_dir_all(&config.db_path)?;
        
        Ok(Self {
            config,
            index: HashMap::new(),
            embeddings: HashMap::new(),
            is_indexing: false,
        })
    }
    
    /// Index a project directory
    pub async fn index_project(&mut self, project_path: &PathBuf) -> Result<usize> {
        self.is_indexing = true;
        let mut indexed_count = 0;
        
        // Walk directory and index files
        for entry in walkdir::WalkDir::new(project_path)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            
            // Check if file matches patterns
            if !self.should_index(path) {
                continue;
            }
            
            // Index file
            match self.index_file(path).await {
                Ok(count) => indexed_count += count,
                Err(e) => log::warn!("Failed to index {:?}: {}", path, e),
            }
        }
        
        self.is_indexing = false;
        log::info!("Indexed {} chunks", indexed_count);
        Ok(indexed_count)
    }
    
    /// Index a single file
    async fn index_file(&mut self, path: &std::path::Path) -> Result<usize> {
        let content = std::fs::read_to_string(path)?;
        let language = self.detect_language(path);
        
        // Split into chunks
        let chunks = self.chunk_code(&content, path.to_string_lossy().to_string(), &language);
        
        // Generate embeddings for each chunk
        for mut chunk in chunks {
            let embedding = self.generate_embedding(&chunk.content).await?;
            chunk.embedding = Some(embedding.clone());
            
            let id = chunk.id.clone();
            self.index.insert(id.clone(), chunk);
            self.embeddings.insert(id, embedding);
        }
        
        Ok(self.index.len())
    }
    
    /// Check if file should be indexed
    fn should_index(&self, path: &std::path::Path) -> bool {
        let path_str = path.to_string_lossy();
        
        // Check exclude patterns first
        for pattern in &self.config.exclude_patterns {
            if glob_match::glob_match(pattern, &path_str) {
                return false;
            }
        }
        
        // Check include patterns
        for pattern in &self.config.include_patterns {
            if glob_match::glob_match(pattern, &path_str) {
                return true;
            }
        }
        
        false
    }
    
    /// Split code into chunks
    fn chunk_code(&self, content: &str, file_path: String, language: &str) -> Vec<CodeChunk> {
        let lines: Vec<&str> = content.lines().collect();
        let mut chunks = Vec::new();
        
        // Simple line-based chunking (would use AST-aware chunking in production)
        for (i, chunk_lines) in lines.chunks(self.config.chunk_size).enumerate() {
            let start_line = i * self.config.chunk_size;
            let end_line = start_line + chunk_lines.len();
            
            let chunk_content = chunk_lines.join("\n");
            let id = format!("{}:{}:{}", file_path, start_line, end_line);
            
            chunks.push(CodeChunk {
                id,
                file_path: file_path.clone(),
                start_line,
                end_line,
                content: chunk_content,
                language: language.to_string(),
                symbol_type: None,
                symbol_name: None,
                embedding: None,
            });
        }
        
        chunks
    }
    
    /// Detect language from file extension
    fn detect_language(&self, path: &std::path::Path) -> String {
        path.extension()
            .and_then(|e| e.to_str())
            .map(|e| match e {
                "rs" => "rust",
                "py" => "python",
                "js" => "javascript",
                "ts" => "typescript",
                "go" => "go",
                "java" => "java",
                "cpp" | "cc" | "cxx" => "cpp",
                "c" => "c",
                "rb" => "ruby",
                "php" => "php",
                _ => "plaintext",
            })
            .unwrap_or("plaintext")
            .to_string()
    }
    
    /// Generate embedding for text
    async fn generate_embedding(&self, text: &str) -> Result<Vec<f32>> {
        // In production, this would call a local embedding model
        // For now, return a dummy embedding
        let dim = 384; // nomic-embed-text dimension
        Ok(vec![0.0; dim])
    }
    
    /// Search for similar code
    pub async fn search(&self, query: &str, n_results: usize) -> Result<Vec<SearchResult>> {
        let query_embedding = self.generate_embedding(query).await?;
        
        // Calculate similarity with all chunks
        let mut results: Vec<(String, f32)> = self.embeddings.iter()
            .map(|(id, embedding)| {
                let score = self.cosine_similarity(&query_embedding, embedding);
                (id.clone(), score)
            })
            .collect();
        
        // Sort by similarity
        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        
        // Return top N
        results.into_iter()
            .take(n_results)
            .filter_map(|(id, score)| {
                self.index.get(&id).map(|chunk| SearchResult {
                    chunk: chunk.clone(),
                    score,
                    context: None,
                })
            })
            .collect::<Vec<_>>()
            .into_iter()
            .map(Ok)
            .collect()
    }
    
    /// Calculate cosine similarity
    fn cosine_similarity(&self, a: &[f32], b: &[f32]) -> f32 {
        if a.len() != b.len() {
            return 0.0;
        }
        
        let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
        let mag_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
        let mag_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
        
        if mag_a == 0.0 || mag_b == 0.0 {
            return 0.0;
        }
        
        dot / (mag_a * mag_b)
    }
    
    /// Get chunk by ID
    pub fn get_chunk(&self, id: &str) -> Option<&CodeChunk> {
        self.index.get(id)
    }
    
    /// Remove file from index
    pub fn remove_file(&mut self, file_path: &str) {
        let ids_to_remove: Vec<String> = self.index.iter()
            .filter(|(_, chunk)| chunk.file_path == file_path)
            .map(|(id, _)| id.clone())
            .collect();
        
        for id in ids_to_remove {
            self.index.remove(&id);
            self.embeddings.remove(&id);
        }
    }
    
    /// Clear entire index
    pub fn clear_index(&mut self) {
        self.index.clear();
        self.embeddings.clear();
    }
    
    /// Get index statistics
    pub fn stats(&self) -> RAGStats {
        RAGStats {
            total_chunks: self.index.len(),
            total_files: self.index.values()
                .map(|c| c.file_path.clone())
                .collect::<std::collections::HashSet<_>>()
                .len(),
            total_embeddings: self.embeddings.len(),
            is_indexing: self.is_indexing,
        }
    }
}

/// RAG statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RAGStats {
    pub total_chunks: usize,
    pub total_files: usize,
    pub total_embeddings: usize,
    pub is_indexing: bool,
}
