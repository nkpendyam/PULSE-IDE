//! RAG (Retrieval-Augmented Generation) System for KRO_IDE
//!
//! Local vector database for code semantic search and context retrieval

pub mod indexer;
pub mod embedder;
pub mod retriever;
pub mod vector_store;
pub mod embeddings;
pub mod file_watcher;
pub mod graph_rag;

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
    pub async fn index_file(&mut self, path: &std::path::Path) -> Result<usize> {
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
    
    /// Split code into AST-aware chunks using tree-sitter.
    /// Extracts functions, classes, impl blocks, and struct definitions as individual chunks.
    /// Falls back to line-based chunking for unsupported languages.
    fn chunk_code(&self, content: &str, file_path: String, language: &str) -> Vec<CodeChunk> {
        // Try AST-aware chunking first
        if let Some(chunks) = self.ast_chunk(content, &file_path, language) {
            if !chunks.is_empty() {
                return chunks;
            }
        }
        // Fallback: line-based chunking with overlap
        self.line_chunk(content, file_path, language)
    }

    /// AST-aware chunking via tree-sitter
    fn ast_chunk(&self, content: &str, file_path: &str, language: &str) -> Option<Vec<CodeChunk>> {
        let ts_lang = match language {
            "rust"       => tree_sitter_rust::LANGUAGE,
            "typescript" => tree_sitter_typescript::LANGUAGE_TYPESCRIPT,
            "javascript" => tree_sitter_typescript::LANGUAGE_TSX,
            "python"     => tree_sitter_python::LANGUAGE,
            "go"         => tree_sitter_go::LANGUAGE,
            "java"       => tree_sitter_java::LANGUAGE,
            "c"          => tree_sitter_c::LANGUAGE,
            "cpp"        => tree_sitter_cpp::LANGUAGE,
            _            => return None,
        };

        let mut parser = tree_sitter::Parser::new();
        parser.set_language(&ts_lang.into()).ok()?;
        let tree = parser.parse(content, None)?;
        let root = tree.root_node();
        let bytes = content.as_bytes();
        let mut chunks = Vec::new();

        // Node kinds that represent top-level semantic units per language
        let semantic_kinds: &[&str] = match language {
            "rust"       => &["function_item", "impl_item", "struct_item", "enum_item", "trait_item", "mod_item", "macro_definition"],
            "typescript" | "javascript" => &["function_declaration", "class_declaration", "lexical_declaration", "export_statement", "interface_declaration", "type_alias_declaration"],
            "python"     => &["function_definition", "class_definition", "decorated_definition"],
            "go"         => &["function_declaration", "method_declaration", "type_declaration"],
            "java"       => &["class_declaration", "method_declaration", "interface_declaration", "enum_declaration"],
            "c" | "cpp"  => &["function_definition", "struct_specifier", "class_specifier", "enum_specifier"],
            _            => &[],
        };

        self.collect_semantic_nodes(root, bytes, file_path, language, semantic_kinds, &mut chunks);

        // If file has content outside semantic chunks (imports, top-level statements), add them
        if chunks.is_empty() {
            return None; // fall back to line-based
        }

        Some(chunks)
    }

    /// Recursively collect semantic AST nodes as chunks
    fn collect_semantic_nodes(
        &self,
        node: tree_sitter::Node,
        source: &[u8],
        file_path: &str,
        language: &str,
        semantic_kinds: &[&str],
        chunks: &mut Vec<CodeChunk>,
    ) {
        let kind = node.kind();
        if semantic_kinds.contains(&kind) {
            let start_line = node.start_position().row;
            let end_line = node.end_position().row;
            let node_text = &source[node.start_byte()..node.end_byte()];
            let content = String::from_utf8_lossy(node_text).to_string();

            // Extract symbol name from first named child (usually the identifier)
            let symbol_name = self.extract_symbol_name(node, source);
            let symbol_type = match kind {
                k if k.contains("function") || k.contains("method") => Some("function".to_string()),
                k if k.contains("class") => Some("class".to_string()),
                k if k.contains("struct") || k.contains("interface") => Some("struct".to_string()),
                k if k.contains("enum") => Some("enum".to_string()),
                k if k.contains("impl") => Some("impl".to_string()),
                k if k.contains("trait") => Some("trait".to_string()),
                k if k.contains("mod") => Some("module".to_string()),
                _ => Some(kind.to_string()),
            };

            let id = format!("{}:{}:{}:{}", file_path, start_line, end_line,
                             symbol_name.as_deref().unwrap_or("anon"));

            // If chunk exceeds max size, split it
            if content.lines().count() > self.config.chunk_size * 2 {
                let sub_chunks = self.line_chunk(&content, file_path.to_string(), language);
                for mut sc in sub_chunks {
                    sc.start_line += start_line;
                    sc.end_line += start_line;
                    sc.symbol_type = symbol_type.clone();
                    sc.symbol_name = symbol_name.clone();
                    chunks.push(sc);
                }
            } else {
                chunks.push(CodeChunk {
                    id,
                    file_path: file_path.to_string(),
                    start_line,
                    end_line,
                    content,
                    language: language.to_string(),
                    symbol_type,
                    symbol_name,
                    embedding: None,
                });
            }
            return; // don't recurse into children of a captured node
        }

        // Recurse into children
        let child_count = node.child_count();
        for i in 0..child_count {
            if let Some(child) = node.child(i) {
                self.collect_semantic_nodes(child, source, file_path, language, semantic_kinds, chunks);
            }
        }
    }

    /// Extract symbol name from an AST node (looks for identifier / name child)
    fn extract_symbol_name(&self, node: tree_sitter::Node, source: &[u8]) -> Option<String> {
        for i in 0..node.named_child_count() {
            if let Some(child) = node.named_child(i) {
                let kind = child.kind();
                if kind == "identifier" || kind == "name" || kind == "type_identifier" || kind == "property_identifier" {
                    let text = &source[child.start_byte()..child.end_byte()];
                    return Some(String::from_utf8_lossy(text).to_string());
                }
            }
        }
        None
    }

    /// Line-based chunking fallback with overlap
    fn line_chunk(&self, content: &str, file_path: String, language: &str) -> Vec<CodeChunk> {
        let lines: Vec<&str> = content.lines().collect();
        let chunk_size = self.config.chunk_size;
        let overlap = self.config.chunk_overlap;
        let mut chunks = Vec::new();
        let mut start = 0usize;

        while start < lines.len() {
            let end = (start + chunk_size).min(lines.len());
            let chunk_content = lines[start..end].join("\n");
            let id = format!("{}:{}:{}", file_path, start, end);

            chunks.push(CodeChunk {
                id,
                file_path: file_path.clone(),
                start_line: start,
                end_line: end,
                content: chunk_content,
                language: language.to_string(),
                symbol_type: None,
                symbol_name: None,
                embedding: None,
            });

            if end >= lines.len() { break; }
            start = end.saturating_sub(overlap);
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
    
    /// Generate embedding for text via Ollama /api/embeddings
    async fn generate_embedding(&self, text: &str) -> Result<Vec<f32>> {
        let client = reqwest::Client::new();
        let body = serde_json::json!({
            "model": self.config.embedding_model,
            "prompt": text,
        });

        let resp = client
            .post("http://localhost:11434/api/embeddings")
            .json(&body)
            .send()
            .await;

        match resp {
            Ok(r) if r.status().is_success() => {
                #[derive(Deserialize)]
                struct EmbeddingResponse {
                    embedding: Vec<f32>,
                }
                let parsed: EmbeddingResponse = r.json().await
                    .context("Failed to parse Ollama embedding response")?;
                Ok(parsed.embedding)
            }
            Ok(r) => {
                log::warn!("Ollama embeddings returned {}, falling back to hash-based", r.status());
                Ok(self.hash_embedding(text))
            }
            Err(e) => {
                log::warn!("Ollama not reachable ({}), falling back to hash-based embedding", e);
                Ok(self.hash_embedding(text))
            }
        }
    }

    /// Deterministic hash-based embedding fallback (when Ollama is unavailable)
    fn hash_embedding(&self, text: &str) -> Vec<f32> {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let dim = 384;
        let mut embedding = vec![0.0f32; dim];
        // Produce a crude but deterministic vector from token trigrams
        for (i, word) in text.split_whitespace().enumerate() {
            let mut hasher = DefaultHasher::new();
            word.to_lowercase().hash(&mut hasher);
            let h = hasher.finish();
            let idx = (h as usize) % dim;
            embedding[idx] += 1.0;
            // Cross-dim spread
            embedding[(idx + 1) % dim] += 0.5;
            embedding[(idx.wrapping_sub(1)) % dim] += 0.5;
        }
        // L2-normalize
        let mag: f32 = embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
        if mag > 0.0 {
            for v in &mut embedding { *v /= mag; }
        }
        embedding
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
