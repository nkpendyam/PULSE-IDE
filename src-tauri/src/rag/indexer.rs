//! RAG Indexer Module
//! 
//! Indexes code files for Retrieval-Augmented Generation

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Document to be indexed
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexedDocument {
    pub path: PathBuf,
    pub content: String,
    pub language: String,
    pub chunks: Vec<TextChunk>,
}

/// A chunk of text from a document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextChunk {
    pub text: String,
    pub start_line: usize,
    pub end_line: usize,
    pub embedding: Option<Vec<f32>>,
}

/// Indexer for RAG system
pub struct Indexer {
    documents: Vec<IndexedDocument>,
}

impl Indexer {
    pub fn new() -> Self {
        Self {
            documents: Vec::new(),
        }
    }

    /// Index a file
    pub fn index_file(&mut self, path: PathBuf, content: String, language: String) {
        let chunks = self.chunk_text(&content);
        self.documents.push(IndexedDocument {
            path,
            content,
            language,
            chunks,
        });
    }

    /// Simple text chunking
    fn chunk_text(&self, content: &str) -> Vec<TextChunk> {
        let lines: Vec<&str> = content.lines().collect();
        let chunk_size = 50; // lines per chunk
        let mut chunks = Vec::new();

        for (i, chunk) in lines.chunks(chunk_size).enumerate() {
            chunks.push(TextChunk {
                text: chunk.join("\n"),
                start_line: i * chunk_size,
                end_line: i * chunk_size + chunk.len(),
                embedding: None,
            });
        }
        chunks
    }

    /// Get all indexed documents
    pub fn documents(&self) -> &[IndexedDocument] {
        &self.documents
    }

    /// Clear index
    pub fn clear(&mut self) {
        self.documents.clear();
    }
}

impl Default for Indexer {
    fn default() -> Self {
        Self::new()
    }
}
