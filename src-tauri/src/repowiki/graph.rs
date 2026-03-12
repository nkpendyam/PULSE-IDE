//! Graph — builds a file-level dependency graph from extracted imports/exports.
//!
//! Nodes are files, edges represent "A imports from B".
//! Also groups files into module clusters by directory.

use super::{DepEdgeType, DependencyGraph, FileEntry, GraphEdge, GraphNode, RepoWikiConfig};
use std::collections::HashMap;

/// Build the dependency graph from scanned file entries
pub fn build_graph(files: &[FileEntry], config: &RepoWikiConfig) -> DependencyGraph {
    let mut graph = DependencyGraph::default();

    // Build a lookup: basename / module path → rel_path
    let file_index = build_file_index(files);

    // Add nodes
    for file in files {
        let module_group = derive_module_group(&file.rel_path);
        graph.nodes.insert(
            file.rel_path.clone(),
            GraphNode {
                path: file.rel_path.clone(),
                language: file.language.clone(),
                symbol_count: file.symbols.len(),
                line_count: file.line_count,
                module_group,
            },
        );
    }

    // Add edges from imports
    for file in files {
        for imp in &file.imports {
            if let Some(target) = resolve_import(
                &imp.path,
                &file.rel_path,
                &file.language,
                &file_index,
                config,
            ) {
                // Don't add self-edges
                if target != file.rel_path {
                    graph.edges.push(GraphEdge {
                        from: file.rel_path.clone(),
                        to: target,
                        edge_type: DepEdgeType::Imports,
                        items: imp.items.clone(),
                    });
                }
            }
        }
    }

    graph
}

/// Generate a Mermaid flowchart from the dependency graph
pub fn graph_to_mermaid(graph: &DependencyGraph) -> String {
    let mut lines = Vec::new();
    lines.push("```mermaid".to_string());
    lines.push("graph LR".to_string());

    // Group nodes by module
    let mut modules: HashMap<String, Vec<String>> = HashMap::new();
    for (path, node) in &graph.nodes {
        modules
            .entry(node.module_group.clone())
            .or_default()
            .push(path.clone());
    }

    // Render subgraphs for each module group
    for (module, paths) in &modules {
        let safe_id = sanitize_mermaid_id(module);
        lines.push(format!("  subgraph {}[\"{}\"]", safe_id, module));
        for path in paths {
            let node_id = sanitize_mermaid_id(path);
            let label = short_name(path);
            lines.push(format!("    {}[\"{}\"]", node_id, label));
        }
        lines.push("  end".to_string());
    }

    // Render edges
    for edge in &graph.edges {
        let from_id = sanitize_mermaid_id(&edge.from);
        let to_id = sanitize_mermaid_id(&edge.to);
        let label = if edge.items.is_empty() {
            String::new()
        } else if edge.items.len() <= 3 {
            format!("|{}|", edge.items.join(", "))
        } else {
            format!("|{} + {} more|", edge.items[..2].join(", "), edge.items.len() - 2)
        };
        lines.push(format!("  {} -->{}  {}", from_id, label, to_id));
    }

    lines.push("```".to_string());
    lines.join("\n")
}

/// Compute simple stats for the graph
pub fn graph_stats(graph: &DependencyGraph) -> GraphStats {
    let mut in_degree: HashMap<String, usize> = HashMap::new();
    let mut out_degree: HashMap<String, usize> = HashMap::new();

    for edge in &graph.edges {
        *out_degree.entry(edge.from.clone()).or_default() += 1;
        *in_degree.entry(edge.to.clone()).or_default() += 1;
    }

    // Find hub files (highest in_degree — most depended-upon)
    let mut hub_files: Vec<(String, usize)> = in_degree.into_iter().collect();
    hub_files.sort_by(|a, b| b.1.cmp(&a.1));
    hub_files.truncate(10);

    // Find leaf files (no outgoing deps)
    let leaf_files: Vec<String> = graph
        .nodes
        .keys()
        .filter(|p| out_degree.get(*p).copied().unwrap_or(0) == 0)
        .cloned()
        .collect();

    // Module groups
    let mut module_sizes: HashMap<String, usize> = HashMap::new();
    for node in graph.nodes.values() {
        *module_sizes.entry(node.module_group.clone()).or_default() += 1;
    }

    GraphStats {
        total_files: graph.nodes.len(),
        total_edges: graph.edges.len(),
        hub_files,
        leaf_count: leaf_files.len(),
        module_count: module_sizes.len(),
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct GraphStats {
    pub total_files: usize,
    pub total_edges: usize,
    pub hub_files: Vec<(String, usize)>,
    pub leaf_count: usize,
    pub module_count: usize,
}

// ─── Import Resolution ──────────────────────────────────────────────────

/// Build a lookup from various name forms → rel_path
fn build_file_index(files: &[FileEntry]) -> HashMap<String, String> {
    let mut index = HashMap::new();
    for file in files {
        // Full relative path (canonical key)
        index.insert(file.rel_path.clone(), file.rel_path.clone());

        // Without extension
        if let Some(no_ext) = strip_extension(&file.rel_path) {
            index.insert(no_ext, file.rel_path.clone());
        }

        // Basename without extension
        if let Some(basename) = basename_no_ext(&file.rel_path) {
            // Only insert if not ambiguous (first wins)
            index
                .entry(basename)
                .or_insert_with(|| file.rel_path.clone());
        }

        // Rust module path form (e.g. "src/foo/mod.rs" → "foo", "src/foo/bar.rs" → "foo::bar")
        if file.language == "rust" {
            if let Some(mod_path) = rust_module_path(&file.rel_path) {
                index.insert(mod_path, file.rel_path.clone());
            }
        }
    }
    index
}

fn strip_extension(path: &str) -> Option<String> {
    let p = std::path::Path::new(path);
    let stem = p.file_stem()?.to_str()?;
    let parent = p.parent().map(|p| p.to_string_lossy().replace('\\', "/"));
    match parent {
        Some(par) if !par.is_empty() => Some(format!("{}/{}", par, stem)),
        _ => Some(stem.to_string()),
    }
}

fn basename_no_ext(path: &str) -> Option<String> {
    let p = std::path::Path::new(path);
    p.file_stem()?.to_str().map(|s| s.to_string())
}

fn rust_module_path(rel_path: &str) -> Option<String> {
    let path = rel_path
        .strip_prefix("src/")
        .or_else(|| rel_path.strip_prefix("src-tauri/src/"))?;
    let path = path.strip_suffix(".rs")?;

    // mod.rs → parent module
    let path = if path.ends_with("/mod") {
        &path[..path.len() - 4]
    } else {
        path
    };

    if path.is_empty() || path == "lib" || path == "main" {
        return None; // root module
    }

    Some(path.replace('/', "::"))
}

/// Try to resolve an import path to a file's rel_path
fn resolve_import(
    import_path: &str,
    from_file: &str,
    language: &str,
    index: &HashMap<String, String>,
    _config: &RepoWikiConfig,
) -> Option<String> {
    match language {
        "rust" => {
            // Try crate:: prefix → strip and look up
            let mod_path = import_path
                .strip_prefix("crate::")
                .or_else(|| import_path.strip_prefix("super::"))
                .unwrap_or(import_path);
            // Try exact module path
            if let Some(found) = index.get(mod_path) {
                return Some(found.clone());
            }
            // Try the first segment (top-level module)
            let first_seg = mod_path.split("::").next()?;
            index.get(first_seg).cloned()
        }
        "typescript" | "javascript" => {
            // Relative imports: "./foo" or "../bar"
            if import_path.starts_with('.') {
                let from_dir = std::path::Path::new(from_file).parent()?.to_string_lossy();
                let joined = format!("{}/{}", from_dir, import_path.trim_start_matches("./"));
                let normalized = normalize_path(&joined);
                // Try with common extensions
                for ext in &["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"] {
                    let candidate = format!("{}{}", normalized, ext);
                    if let Some(found) = index.get(&candidate) {
                        return Some(found.clone());
                    }
                }
            }
            // Package imports → skip (external deps)
            None
        }
        "python" => {
            // Relative: ".module" → look up
            let mod_name = import_path
                .trim_start_matches('.')
                .replace('.', "/");
            if let Some(found) = index.get(&mod_name) {
                return Some(found.clone());
            }
            let with_py = format!("{}.py", mod_name);
            index.get(&with_py).cloned()
        }
        "go" => {
            // Go uses full module paths; we can match by last segment
            let last = import_path.rsplit('/').next()?;
            index.get(last).cloned()
        }
        "java" => {
            // Java: com.example.MyClass → look for MyClass
            let last = import_path.rsplit('.').next()?;
            index.get(last).cloned()
        }
        _ => None,
    }
}

/// Normalize relative path (handle ../)
fn normalize_path(path: &str) -> String {
    let parts: Vec<&str> = path.split('/').collect();
    let mut stack = Vec::new();
    for part in parts {
        match part {
            ".." => {
                stack.pop();
            }
            "." | "" => {}
            _ => stack.push(part),
        }
    }
    stack.join("/")
}

// ─── Helpers ────────────────────────────────────────────────────────────

/// Derive a module group from a file's relative path (first directory segment)
fn derive_module_group(rel_path: &str) -> String {
    let parts: Vec<&str> = rel_path.split('/').collect();
    if parts.len() > 1 {
        // Use first two directory levels
        let depth = std::cmp::min(2, parts.len() - 1);
        parts[..depth].join("/")
    } else {
        "root".to_string()
    }
}

fn short_name(path: &str) -> String {
    path.rsplit('/').next().unwrap_or(path).to_string()
}

fn sanitize_mermaid_id(s: &str) -> String {
    s.replace('/', "_")
        .replace('.', "_")
        .replace('-', "_")
        .replace(':', "_")
        .replace(' ', "_")
}
