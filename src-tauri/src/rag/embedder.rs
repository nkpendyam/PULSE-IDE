//! RAG Embedder Module
//!
//! Generates embeddings and semantic search indices for text chunks using
//! local, dependency-free models (BM25 / N-Gram Hashing) to keep Kyro IDE
//! lightweight and blazing fast.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Embedding result containing term-frequency mappings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingResult {
    pub text: String,
    /// Sparse vector representation (Term -> Frequency)
    pub sparse_embedding: HashMap<String, f32>,
    pub model: String,
}

/// Embedder for converting text to sparse vectors for local RAG
pub struct Embedder {
    model_name: String,
    stop_words: Vec<&'static str>,
}

impl Embedder {
    pub fn new(model_name: &str) -> Self {
        Self {
            model_name: model_name.to_string(),
            stop_words: vec!["the", "is", "in", "and", "a", "to", "for", "of", "with", "this", "function", "const", "let", "var", "pub", "fn", "impl"],
        }
    }

    /// Generate sparse embedding using Term Frequency (TF)
    /// This acts as a blazing fast local RAG mechanism without huge ML weights.
    pub fn embed(&self, text: &str) -> EmbeddingResult {
        let mut term_freqs: HashMap<String, f32> = HashMap::new();
        let tokens: Vec<String> = text
            .to_lowercase()
            .split(|c: char| !c.is_alphanumeric())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .collect();

        let total_tokens = tokens.len() as f32;

        if total_tokens > 0.0 {
            for token in tokens {
                if !self.stop_words.contains(&token.as_str()) {
                    *term_freqs.entry(token).or_insert(0.0) += 1.0;
                }
            }
            
            // Normalize TF
            for (_, freq) in term_freqs.iter_mut() {
                *freq /= total_tokens;
            }
        }

        EmbeddingResult {
            text: text.to_string(),
            sparse_embedding: term_freqs,
            model: self.model_name.clone(),
        }
    }

    /// Compute cosine similarity between two sparse embeddings (BM25 style matching)
    pub fn similarity(&self, a: &EmbeddingResult, b: &EmbeddingResult) -> f32 {
        let mut dot_product = 0.0;
        let mut norm_a = 0.0;
        let mut norm_b = 0.0;

        for (term, freq_a) in &a.sparse_embedding {
            if let Some(freq_b) = b.sparse_embedding.get(term) {
                dot_product += freq_a * freq_b;
            }
            norm_a += freq_a * freq_a;
        }

        for freq_b in b.sparse_embedding.values() {
            norm_b += freq_b * freq_b;
        }

        if norm_a == 0.0 || norm_b == 0.0 {
            return 0.0;
        }

        dot_product / (norm_a.sqrt() * norm_b.sqrt())
    }
}

impl Default for Embedder {
    fn default() -> Self {
        Self::new("kyro-sparse-tfidf-v1")
    }
}
