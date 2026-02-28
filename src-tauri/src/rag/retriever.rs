//! RAG Retriever Module
//!
//! Retrieves relevant code chunks based on semantic similarity

use serde::{Deserialize, Serialize};
use super::indexer::TextChunk;

/// Retrieval result with relevance score
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetrievalResult {
    pub chunk: TextChunk,
    pub score: f32,
    pub file_path: String,
}

/// Retriever for finding relevant code chunks
pub struct Retriever {
    max_results: usize,
}

impl Retriever {
    pub fn new(max_results: usize) -> Self {
        Self { max_results }
    }

    /// Retrieve relevant chunks (simple keyword matching fallback)
    pub fn retrieve(&self, query: &str, chunks: &[(String, TextChunk)]) -> Vec<RetrievalResult> {
        let query_lower = query.to_lowercase();
        let query_words: Vec<&str> = query_lower.split_whitespace().collect();

        let mut results: Vec<RetrievalResult> = chunks
            .iter()
            .map(|(path, chunk)| {
                let text_lower = chunk.text.to_lowercase();
                let score: f32 = query_words
                    .iter()
                    .filter(|w| text_lower.contains(*w))
                    .count() as f32
                    / query_words.len().max(1) as f32;

                RetrievalResult {
                    chunk: chunk.clone(),
                    score,
                    file_path: path.clone(),
                }
            })
            .filter(|r| r.score > 0.0)
            .collect();

        results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        results.truncate(self.max_results);
        results
    }
}

impl Default for Retriever {
    fn default() -> Self {
        Self::new(10)
    }
}
