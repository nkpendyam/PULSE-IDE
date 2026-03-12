//! Graph-enhanced RAG (Retrieval-Augmented Generation)
//!
//! Augments standard BM25/vector search results with dependency-graph neighbors
//! from the RepoWiki dependency graph. When a search hits file A, we also pull
//! 1-hop neighbors (files that import A, or files A imports) and re-rank by
//! a combined score: (BM25_score × 0.7) + (graph_centrality × 0.3).

use crate::repowiki::{DependencyGraph, GraphEdge};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

/// A graph-enhanced search result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphSearchResult {
    pub file_path: String,
    pub content: String,
    pub bm25_score: f32,
    pub graph_score: f32,
    pub combined_score: f32,
    pub line_start: u32,
    pub line_end: u32,
    pub context: String,
    /// How this result was found
    pub source: ResultSource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ResultSource {
    /// Found directly by BM25 search
    Direct,
    /// Found as a dependency neighbor of a direct hit
    GraphNeighbor,
}

/// Expand BM25 search results with graph neighbors and re-rank
pub fn graph_enhanced_search(
    bm25_results: Vec<(String, f32, String, u32, u32, String)>, // (file_path, score, content, start, end, context)
    graph: &DependencyGraph,
    max_results: usize,
) -> Vec<GraphSearchResult> {
    if bm25_results.is_empty() {
        return Vec::new();
    }

    let centrality = compute_degree_centrality(graph);
    let max_centrality = centrality.values().cloned().fold(1.0f32, f32::max);

    let mut results: Vec<GraphSearchResult> = Vec::new();
    let mut seen_files: HashSet<String> = HashSet::new();

    // 1. Add direct BM25 hits with combined scoring
    for (file_path, bm25_score, content, start, end, context) in &bm25_results {
        let norm_centrality = centrality.get(file_path.as_str()).copied().unwrap_or(0.0) / max_centrality;
        let combined = bm25_score * 0.7 + norm_centrality * 0.3;
        seen_files.insert(file_path.clone());
        results.push(GraphSearchResult {
            file_path: file_path.clone(),
            content: content.clone(),
            bm25_score: *bm25_score,
            graph_score: norm_centrality,
            combined_score: combined,
            line_start: *start,
            line_end: *end,
            context: context.clone(),
            source: ResultSource::Direct,
        });
    }

    // 2. Expand: find 1-hop neighbors of direct hits
    let hit_files: HashSet<&str> = bm25_results.iter().map(|(f, ..)| f.as_str()).collect();
    for edge in &graph.edges {
        let neighbor = if hit_files.contains(edge.from.as_str()) {
            Some(&edge.to)
        } else if hit_files.contains(edge.to.as_str()) {
            Some(&edge.from)
        } else {
            None
        };

        if let Some(neighbor_path) = neighbor {
            if !seen_files.contains(neighbor_path) {
                seen_files.insert(neighbor_path.clone());
                let norm_centrality = centrality.get(neighbor_path.as_str()).copied().unwrap_or(0.0) / max_centrality;
                // Graph neighbors get a base BM25 score of 0 but centrality boost
                results.push(GraphSearchResult {
                    file_path: neighbor_path.clone(),
                    content: String::new(), // caller can lazy-load content
                    bm25_score: 0.0,
                    graph_score: norm_centrality,
                    combined_score: norm_centrality * 0.3,
                    line_start: 0,
                    line_end: 0,
                    context: format!("Graph neighbor via dependency edge"),
                    source: ResultSource::GraphNeighbor,
                });
            }
        }
    }

    // 3. Sort by combined score descending, truncate
    results.sort_by(|a, b| b.combined_score.partial_cmp(&a.combined_score).unwrap_or(std::cmp::Ordering::Equal));
    results.truncate(max_results);
    results
}

/// Compute degree centrality: count of edges touching each node, normalized
fn compute_degree_centrality(graph: &DependencyGraph) -> HashMap<&str, f32> {
    let mut degree: HashMap<&str, f32> = HashMap::new();
    for edge in &graph.edges {
        *degree.entry(edge.from.as_str()).or_insert(0.0) += 1.0;
        *degree.entry(edge.to.as_str()).or_insert(0.0) += 1.0;
    }
    degree
}

/// Get immediate dependency neighbors for a given file path
pub fn get_neighbors(graph: &DependencyGraph, file_path: &str) -> Vec<String> {
    let mut neighbors = HashSet::new();
    for edge in &graph.edges {
        if edge.from == file_path {
            neighbors.insert(edge.to.clone());
        } else if edge.to == file_path {
            neighbors.insert(edge.from.clone());
        }
    }
    neighbors.into_iter().collect()
}
