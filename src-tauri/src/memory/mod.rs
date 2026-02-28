//! Hierarchical Memory Architecture
//!
//! Multi-level memory for true codebase understanding.
//! Solves the "Context Window Illusion" problem.
//!
//! L1: Immediate context (current file)
//! L2: Recent files (LRU cache)
//! L3: Project summary (compressed)
//! L4: Dependency graph (symbol graph)
//! L5: External knowledge (docs, crates.io)

pub mod hierarchy;
pub mod compression;
pub mod symbol_graph;

use std::collections::{HashMap, VecDeque, HashSet};
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

pub use hierarchy::*;
pub use compression::*;
pub use symbol_graph::*;

/// Hierarchical memory system
pub struct HierarchicalMemory {
    /// L1: Current file context (8K tokens)
    l1_immediate: ImmediateContext,
    
    /// L2: Recently accessed files (10 files, ~50K tokens)
    l2_recent: LRUCache<String, FileContext>,
    
    /// L3: Project summary (compressed, ~20K tokens)
    l3_project: ProjectSummary,
    
    /// L4: Symbol dependency graph
    l4_symbols: SymbolGraph,
    
    /// L5: External knowledge index
    l5_external: ExternalIndex,
    
    /// Configuration
    config: MemoryConfig,
}

#[derive(Debug, Clone)]
pub struct MemoryConfig {
    pub l1_max_tokens: usize,
    pub l2_max_files: usize,
    pub l3_max_tokens: usize,
    pub enable_external: bool,
}

impl Default for MemoryConfig {
    fn default() -> Self {
        Self {
            l1_max_tokens: 8000,
            l2_max_files: 10,
            l3_max_tokens: 20000,
            enable_external: true,
        }
    }
}

/// L1: Immediate context
#[derive(Debug, Clone)]
pub struct ImmediateContext {
    pub file_path: Option<String>,
    pub content: String,
    pub cursor_position: (usize, usize),
    pub visible_range: (usize, usize),
    pub tokens: usize,
}

/// File context for L2
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileContext {
    pub path: String,
    pub content: String,
    pub summary: String,
    pub symbols: Vec<SymbolInfo>,
    pub imports: Vec<String>,
    pub exports: Vec<String>,
    pub last_accessed: DateTime<Utc>,
    pub access_count: u32,
    pub token_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymbolInfo {
    pub name: String,
    pub kind: SymbolKind,
    pub line: u32,
    pub signature: Option<String>,
    pub documentation: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SymbolKind {
    Function,
    Class,
    Struct,
    Interface,
    Enum,
    Constant,
    Variable,
    Module,
}

/// LRU Cache implementation
pub struct LRUCache<K, V> {
    capacity: usize,
    cache: HashMap<K, V>,
    order: VecDeque<K>,
}

impl<K: std::hash::Hash + Eq + Clone, V> LRUCache<K, V> {
    pub fn new(capacity: usize) -> Self {
        Self {
            capacity,
            cache: HashMap::new(),
            order: VecDeque::new(),
        }
    }
    
    pub fn get(&mut self, key: &K) -> Option<&V> {
        if self.cache.contains_key(key) {
            // Move to front
            self.order.retain(|k| k != key);
            self.order.push_front(key.clone());
            self.cache.get(key)
        } else {
            None
        }
    }
    
    pub fn put(&mut self, key: K, value: V) {
        if self.cache.contains_key(&key) {
            self.order.retain(|k| k != &key);
        } else if self.cache.len() >= self.capacity {
            if let Some(old_key) = self.order.pop_back() {
                self.cache.remove(&old_key);
            }
        }
        
        self.order.push_front(key.clone());
        self.cache.insert(key, value);
    }
    
    pub fn values(&self) -> impl Iterator<Item = &V> {
        self.cache.values()
    }
}

/// L3: Project summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSummary {
    pub name: String,
    pub language: String,
    pub framework: Option<String>,
    pub description: String,
    pub key_modules: Vec<ModuleSummary>,
    pub entry_points: Vec<String>,
    pub architecture: String,
    pub dependencies: Vec<DependencyInfo>,
    pub last_updated: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleSummary {
    pub path: String,
    pub name: String,
    pub purpose: String,
    pub key_types: Vec<String>,
    pub key_functions: Vec<String>,
    pub complexity_score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyInfo {
    pub name: String,
    pub version: String,
    pub purpose: String,
}


/// L5: External knowledge
#[derive(Debug, Clone, Default)]
pub struct ExternalIndex {
    pub doc_index: HashMap<String, DocEntry>,
    pub api_index: HashMap<String, ApiEntry>,
    pub snippet_index: HashMap<String, CodeSnippet>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocEntry {
    pub name: String,
    pub source: String, // mdn, crates.io, etc.
    pub url: String,
    pub summary: String,
    pub examples: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiEntry {
    pub name: String,
    pub signature: String,
    pub module: String,
    pub documentation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeSnippet {
    pub id: String,
    pub description: String,
    pub code: String,
    pub language: String,
    pub tags: Vec<String>,
}

impl HierarchicalMemory {
    pub fn new(config: MemoryConfig) -> Self {
        Self {
            l1_immediate: ImmediateContext {
                file_path: None,
                content: String::new(),
                cursor_position: (0, 0),
                visible_range: (0, 0),
                tokens: 0,
            },
            l2_recent: LRUCache::new(config.l2_max_files),
            l3_project: ProjectSummary {
                name: String::new(),
                language: String::new(),
                framework: None,
                description: String::new(),
                key_modules: Vec::new(),
                entry_points: Vec::new(),
                architecture: String::new(),
                dependencies: Vec::new(),
                last_updated: Utc::now(),
            },
            l4_symbols: SymbolGraph::default(),
            l5_external: ExternalIndex::default(),
            config,
        }
    }
    
    /// Set current file context (L1)
    pub fn set_current_file(&mut self, path: &str, content: &str) {
        self.l1_immediate.file_path = Some(path.to_string());
        self.l1_immediate.content = content.to_string();
        self.l1_immediate.tokens = self.count_tokens(content);
        
        // Also add to L2
        let file_context = FileContext {
            path: path.to_string(),
            content: content.to_string(),
            summary: self.summarize_file(content),
            symbols: self.extract_symbols(content),
            imports: self.extract_imports(content),
            exports: self.extract_exports(content),
            last_accessed: Utc::now(),
            access_count: 1,
            token_count: self.count_tokens(content),
        };
        
        self.l2_recent.put(path.to_string(), file_context);
    }
    
    /// Update cursor position
    pub fn set_cursor(&mut self, line: usize, column: usize) {
        self.l1_immediate.cursor_position = (line, column);
    }
    
    /// Resolve a symbol across all levels
    pub fn resolve_symbol(&self, name: &str) -> Option<SymbolContext> {
        // L1: Check current file
        if let Some(ref path) = self.l1_immediate.file_path {
            if let Some(symbol) = self.find_in_content(&self.l1_immediate.content, name) {
                return Some(SymbolContext {
                    symbol,
                    source: ContextSource::L1Current,
                });
            }
        }
        
        // L2: Check recent files
        // (In real impl, would iterate L2 cache)
        
        // L4: Check symbol graph
        if let Some(node) = self.l4_symbols.nodes.get(name) {
            return Some(SymbolContext {
                symbol: node.clone(),
                source: ContextSource::L4Graph,
            });
        }
        
        // L5: Check external docs
        if let Some(entry) = self.l5_external.doc_index.get(name) {
            return Some(SymbolContext {
                symbol: entry.clone(),
                source: ContextSource::L5External,
            });
        }
        
        None
    }
    
    /// Get context for AI prompt
    pub fn build_context(&self, max_tokens: usize) -> String {
        let mut context = String::new();
        let mut tokens_used = 0;
        
        // L1: Current file (highest priority)
        if self.l1_immediate.tokens > 0 {
            context.push_str("=== CURRENT FILE ===\n");
            context.push_str(&format!("File: {:?}\n\n", self.l1_immediate.file_path));
            context.push_str(&self.l1_immediate.content);
            context.push_str("\n\n");
            tokens_used += self.l1_immediate.tokens;
        }
        
        // L3: Project summary
        if tokens_used < max_tokens {
            let summary = self.format_project_summary();
            let summary_tokens = self.count_tokens(&summary);
            if tokens_used + summary_tokens < max_tokens {
                context.push_str("=== PROJECT SUMMARY ===\n");
                context.push_str(&summary);
                context.push_str("\n\n");
                tokens_used += summary_tokens;
            }
        }
        
        // L4: Relevant symbols
        if tokens_used < max_tokens {
            let symbols = self.format_relevant_symbols();
            let symbol_tokens = self.count_tokens(&symbols);
            if tokens_used + symbol_tokens < max_tokens {
                context.push_str("=== RELEVANT SYMBOLS ===\n");
                context.push_str(&symbols);
                context.push_str("\n");
            }
        }
        
        context
    }
    
    /// Add symbol to graph
    pub fn add_symbol(&mut self, node: SymbolNode) {
        self.l4_symbols.nodes.insert(node.id.clone(), node);
    }
    
    /// Add symbol relationship
    pub fn add_relationship(&mut self, from: &str, to: &str, edge_type: EdgeType) {
        self.l4_symbols.edges.push(SymbolEdge {
            from: from.to_string(),
            to: to.to_string(),
            edge_type,
        });
        
        // Update reverse index
        self.l4_symbols.reverse_index
            .entry(to.to_string())
            .or_default()
            .insert(from.to_string());
    }
    
    /// Find references to a symbol
    pub fn find_references(&self, symbol_id: &str) -> Vec<&SymbolNode> {
        self.l4_symbols.reverse_index
            .get(symbol_id)
            .map(|ids| ids.iter()
                .filter_map(|id| self.l4_symbols.nodes.get(id))
                .collect())
            .unwrap_or_default()
    }
    
    // Helper methods
    fn count_tokens(&self, text: &str) -> usize {
        // Rough approximation: ~4 chars per token
        text.len() / 4
    }
    
    fn summarize_file(&self, content: &str) -> String {
        // Simple summary: first few non-empty lines
        content.lines()
            .filter(|l| !l.trim().is_empty())
            .take(5)
            .collect::<Vec<_>>()
            .join("\n")
    }
    
    fn extract_symbols(&self, _content: &str) -> Vec<SymbolInfo> {
        // Would use tree-sitter in real impl
        Vec::new()
    }
    
    fn extract_imports(&self, _content: &str) -> Vec<String> {
        Vec::new()
    }
    
    fn extract_exports(&self, _content: &str) -> Vec<String> {
        Vec::new()
    }
    
    fn find_in_content(&self, content: &str, name: &str) -> Option<SymbolInfo> {
        // Simple search - would use tree-sitter in real impl
        for (i, line) in content.lines().enumerate() {
            if line.contains(name) {
                return Some(SymbolInfo {
                    name: name.to_string(),
                    kind: SymbolKind::Variable,
                    line: i as u32 + 1,
                    signature: None,
                    documentation: None,
                });
            }
        }
        None
    }
    
    fn format_project_summary(&self) -> String {
        format!(
            "Project: {} ({})\nFramework: {:?}\n{}\nModules: {}",
            self.l3_project.name,
            self.l3_project.language,
            self.l3_project.framework,
            self.l3_project.description,
            self.l3_project.key_modules.len()
        )
    }
    
    fn format_relevant_symbols(&self) -> String {
        self.l4_symbols.nodes.values()
            .take(20)
            .map(|n| format!("{}: {} ({:?})", n.qualified_name, n.signature.as_deref().unwrap_or(""), n.kind))
            .collect::<Vec<_>>()
            .join("\n")
    }
}

/// Context source
#[derive(Debug, Clone)]
pub enum ContextSource {
    L1Current,
    L2Recent,
    L3Project,
    L4Graph,
    L5External,
}

/// Symbol context with source
#[derive(Debug, Clone)]
pub struct SymbolContext {
    pub symbol: serde_json::Value,
    pub source: ContextSource,
}

impl Default for HierarchicalMemory {
    fn default() -> Self {
        Self::new(MemoryConfig::default())
    }
}
