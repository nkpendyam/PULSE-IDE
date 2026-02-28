//! KV Cache for aggressive caching of LLM responses
//!
//! This module provides a key-value cache for storing LLM responses,
//! enabling instant retrieval for repeated or similar prompts.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use std::time::{Duration, Instant};
use sha2::{Sha256, Digest};

/// Cache entry with metadata
#[derive(Debug, Clone)]
struct CacheEntry {
    prompt_hash: String,
    response: String,
    created_at: Instant,
    last_accessed: Instant,
    access_count: u64,
    token_count: usize,
    model_name: String,
}

/// KV Cache for LLM responses
pub struct KVCache {
    entries: HashMap<String, CacheEntry>,
    max_entries: usize,
    max_age: Duration,
    hit_count: u64,
    miss_count: u64,
}

/// Cache statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    pub total_entries: usize,
    pub hit_rate: f32,
    pub total_hits: u64,
    pub total_misses: u64,
    pub memory_usage_estimate: usize,
    pub average_entry_age_secs: f64,
}

impl KVCache {
    /// Create a new KV cache
    pub fn new(max_entries: usize) -> Self {
        Self {
            entries: HashMap::new(),
            max_entries,
            max_age: Duration::from_secs(3600), // 1 hour default TTL
            hit_count: 0,
            miss_count: 0,
        }
    }

    /// Get a cached response
    pub fn get(&self, prompt: &str) -> Option<String> {
        let key = Self::hash_prompt(prompt);
        
        if let Some(entry) = self.entries.get(&key) {
            // Check if entry is still valid
            if entry.created_at.elapsed() < self.max_age {
                // This would mutate, so we return a clone
                return Some(entry.response.clone());
            }
        }

        None
    }

    /// Insert a response into the cache
    pub fn insert(&mut self, prompt: String, response: String) {
        // Evict old entries if at capacity
        if self.entries.len() >= self.max_entries {
            self.evict_oldest();
        }

        let key = Self::hash_prompt(&prompt);
        let token_count = response.split_whitespace().count();

        let entry = CacheEntry {
            prompt_hash: key.clone(),
            response,
            created_at: Instant::now(),
            last_accessed: Instant::now(),
            access_count: 1,
            token_count,
            model_name: "default".to_string(),
        };

        self.entries.insert(key, entry);
    }

    /// Get with prefix matching (for similar prompts)
    pub fn get_fuzzy(&self, prompt: &str, similarity_threshold: f32) -> Option<String> {
        // Hash prefix for fuzzy matching
        let prefix = Self::hash_prefix(prompt);
        
        for entry in self.entries.values() {
            if entry.prompt_hash.starts_with(&prefix) {
                return Some(entry.response.clone());
            }
        }

        None
    }

    /// Clear the cache
    pub fn clear(&mut self) {
        self.entries.clear();
        self.hit_count = 0;
        self.miss_count = 0;
    }

    /// Get cache statistics
    pub fn stats(&self) -> CacheStats {
        let total = self.hit_count + self.miss_count;
        let hit_rate = if total > 0 {
            self.hit_count as f32 / total as f32
        } else {
            0.0
        };

        let total_tokens: usize = self.entries.values()
            .map(|e| e.token_count)
            .sum();

        // Estimate memory usage (rough: 4 bytes per character + overhead)
        let memory_usage = total_tokens * 8; // Rough estimate

        let avg_age = self.entries.values()
            .map(|e| e.created_at.elapsed().as_secs() as f64)
            .sum::<f64>() / self.entries.len().max(1) as f64;

        CacheStats {
            total_entries: self.entries.len(),
            hit_rate,
            total_hits: self.hit_count,
            total_misses: self.miss_count,
            memory_usage_estimate: memory_usage,
            average_entry_age_secs: avg_age,
        }
    }

    /// Get number of entries
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// Check if cache is empty
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Record a cache hit
    pub fn record_hit(&mut self) {
        self.hit_count += 1;
    }

    /// Record a cache miss
    pub fn record_miss(&mut self) {
        self.miss_count += 1;
    }

    /// Evict oldest entries (LRU)
    fn evict_oldest(&mut self) {
        // Find and remove the oldest 10% of entries
        let to_remove = (self.max_entries as f32 * 0.1) as usize;
        
        let mut entries: Vec<_> = self.entries.iter()
            .collect();
        
        entries.sort_by_key(|(_, e)| e.last_accessed);

        for (key, _) in entries.into_iter().take(to_remove) {
            self.entries.remove(key);
        }
    }

    /// Hash a prompt for cache key
    fn hash_prompt(prompt: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(prompt.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    /// Hash prefix for fuzzy matching
    fn hash_prefix(prompt: &str) -> String {
        let normalized = prompt.to_lowercase();
        let words: Vec<&str> = normalized.split_whitespace().take(5).collect();
        words.join("_")
    }

    /// Set max age for entries
    pub fn set_max_age(&mut self, duration: Duration) {
        self.max_age = duration;
    }

    /// Prune expired entries
    pub fn prune_expired(&mut self) {
        self.entries.retain(|_, entry| {
            entry.created_at.elapsed() < self.max_age
        });
    }
}

/// Semantic cache using embeddings for similarity matching
pub struct SemanticCache {
    entries: Vec<SemanticCacheEntry>,
    max_entries: usize,
    similarity_threshold: f32,
}

#[derive(Debug, Clone)]
struct SemanticCacheEntry {
    prompt_embedding: Vec<f32>,
    prompt: String,
    response: String,
    created_at: Instant,
}

impl SemanticCache {
    /// Create a new semantic cache
    pub fn new(max_entries: usize, similarity_threshold: f32) -> Self {
        Self {
            entries: Vec::new(),
            max_entries,
            similarity_threshold,
        }
    }

    /// Add entry with embedding
    pub fn insert(&mut self, prompt: String, embedding: Vec<f32>, response: String) {
        if self.entries.len() >= self.max_entries {
            self.entries.remove(0); // Simple FIFO eviction
        }

        self.entries.push(SemanticCacheEntry {
            prompt_embedding: embedding,
            prompt,
            response,
            created_at: Instant::now(),
        });
    }

    /// Find similar cached response
    pub fn find_similar(&self, query_embedding: &[f32]) -> Option<String> {
        for entry in &self.entries {
            let similarity = Self::cosine_similarity(&entry.prompt_embedding, query_embedding);
            if similarity >= self.similarity_threshold {
                return Some(entry.response.clone());
            }
        }
        None
    }

    /// Calculate cosine similarity between two vectors
    fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
        if a.len() != b.len() {
            return 0.0;
        }

        let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
        let mag_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
        let mag_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

        if mag_a == 0.0 || mag_b == 0.0 {
            0.0
        } else {
            dot_product / (mag_a * mag_b)
        }
    }

    /// Clear the cache
    pub fn clear(&mut self) {
        self.entries.clear();
    }

    /// Get number of entries
    pub fn len(&self) -> usize {
        self.entries.len()
    }
}
