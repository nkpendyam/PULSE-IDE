//! Memory Hierarchy Module
//!
//! Multi-level memory management for AI agents, including Lazy Semantic Resolution 
//! for targeted RAG retrieval of symbols and definitions.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Memory level
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum MemoryLevel {
    ShortTerm,
    WorkingMemory,
    LongTerm,
    Episodic,
}

/// Memory entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub key: String,
    pub value: String,
    pub level: MemoryLevel,
    pub timestamp: String,
    pub relevance: f32,
}

/// A resolved semantic symbol (from Lazy Semantic Resolution)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedSymbol {
    pub symbol_name: String,
    pub file_path: String,
    pub definition_content: String, // The exact struct/interface definition
}

/// Memory hierarchy manager  
#[derive(Debug, Serialize, Deserialize)]
pub struct MemoryHierarchy {
    pub entries: Vec<MemoryEntry>,
    /// Cache for lazily resolved semantic symbols (RAG)
    pub semantic_cache: HashMap<String, ResolvedSymbol>,
}

impl MemoryHierarchy {
    pub fn new() -> Self { 
        Self { 
            entries: Vec::new(),
            semantic_cache: HashMap::new(),
        } 
    }
    
    pub fn store(&mut self, entry: MemoryEntry) {
        self.entries.push(entry);
    }
    
    pub fn retrieve(&self, key: &str) -> Option<&MemoryEntry> {
        self.entries.iter().find(|e| e.key == key)
    }
    
    pub fn search(&self, query: &str) -> Vec<&MemoryEntry> {
        self.entries.iter().filter(|e| e.value.contains(query)).collect()
    }

    /// Stores a recently resolved symbol so the LLM doesn't have to fetch it again
    pub fn cache_semantic_symbol(&mut self, symbol_name: &str, symbol: ResolvedSymbol) {
        self.semantic_cache.insert(symbol_name.to_string(), symbol);
    }

    /// Retrieves a cached symbol if it was already resolved
    pub fn get_cached_symbol(&self, symbol_name: &str) -> Option<&ResolvedSymbol> {
        self.semantic_cache.get(symbol_name)
    }
}

impl Default for MemoryHierarchy {
    fn default() -> Self { Self::new() }
}
