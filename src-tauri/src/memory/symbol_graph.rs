//! Symbol Graph Module
//!
//! Builds and queries code symbol relationships using AST extracted metadata
//! to provide the LLM with a structural map of the workspace. This is the 
//! Logic Toon's implementation for Phase 2.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use super::SymbolKind;

/// Symbol graph for maintaining local workspace structural awareness
#[derive(Debug, Clone, Default)]
pub struct SymbolGraph {
    pub nodes: HashMap<String, SymbolNode>,
    pub edges: Vec<SymbolEdge>,
    pub reverse_index: HashMap<String, HashSet<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymbolNode {
    pub id: String,
    pub name: String,
    pub qualified_name: String,
    pub kind: SymbolKind,
    pub file_path: String,
    pub line: u32,
    pub signature: Option<String>,
    pub documentation: Option<String>,
    pub references: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymbolEdge {
    pub from: String,
    pub to: String,
    pub edge_type: EdgeType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EdgeType {
    Calls,
    Implements,
    Extends,
    Imports,
    Uses,
    Contains,
}

impl SymbolGraph {
    pub fn new() -> Self { Self::default() }
    
    pub fn add_symbol(&mut self, node: SymbolNode) {
        self.nodes.insert(node.id.clone(), node);
    }
    
    pub fn add_edge(&mut self, from: &str, to: &str, edge_type: EdgeType) {
        self.edges.push(SymbolEdge {
            from: from.to_string(),
            to: to.to_string(),
            edge_type,
        });
        self.reverse_index.entry(to.to_string()).or_default().insert(from.to_string());
    }

    pub fn get_symbol(&self, id: &str) -> Option<&SymbolNode> {
        self.nodes.get(id)
    }
    
    pub fn find_references(&self, symbol_id: &str) -> Vec<&SymbolNode> {
        self.reverse_index
            .get(symbol_id)
            .map(|ids| ids.iter().filter_map(|id| self.nodes.get(id)).collect())
            .unwrap_or_default()
    }
}
