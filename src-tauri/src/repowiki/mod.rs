//! RepoWiki — Automatic, local-first documentation generator
//!
//! Scans a project with tree-sitter AST extraction, builds a dependency graph,
//! feeds chunks to Ollama for LLM-powered wiki pages with Mermaid diagrams,
//! and writes structured Markdown output to `.ide/repowiki/`.
//!
//! Living sync keeps the wiki up-to-date whenever source files change.

pub mod scanner;
pub mod graph;
pub mod generator;
pub mod writer;
pub mod sync;

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::collections::HashMap;

// ─── Configuration ──────────────────────────────────────────────────────

/// RepoWiki configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoWikiConfig {
    /// Root project path
    pub project_path: PathBuf,
    /// Ollama endpoint (default: http://localhost:11434)
    pub ollama_url: String,
    /// Model to use for documentation generation
    pub model: String,
    /// Output directory (relative to project root, default: .ide/repowiki)
    pub output_dir: String,
    /// Maximum tokens per LLM call
    pub max_tokens: usize,
    /// Include Mermaid diagrams
    pub mermaid_diagrams: bool,
    /// File extensions to scan
    pub extensions: Vec<String>,
    /// Directories to ignore
    pub ignore_dirs: Vec<String>,
}

impl Default for RepoWikiConfig {
    fn default() -> Self {
        Self {
            project_path: PathBuf::new(),
            ollama_url: "http://localhost:11434".to_string(),
            model: "codellama:7b-instruct".to_string(),
            output_dir: ".ide/repowiki".to_string(),
            max_tokens: 2048,
            mermaid_diagrams: true,
            extensions: vec![
                "rs", "ts", "tsx", "js", "jsx", "py", "go", "java", "c", "cpp", "h", "hpp",
            ]
            .into_iter()
            .map(String::from)
            .collect(),
            ignore_dirs: vec![
                "node_modules", "target", ".git", "dist", "build", "__pycache__",
                ".next", ".ide", "vendor", ".venv",
            ]
            .into_iter()
            .map(String::from)
            .collect(),
        }
    }
}

// ─── Extracted Types ────────────────────────────────────────────────────

/// A scanned source file with its extracted metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    /// Relative path from project root
    pub rel_path: String,
    /// Detected language
    pub language: String,
    /// Lines of code (excluding blanks/comments is best-effort)
    pub line_count: usize,
    /// Symbols extracted from AST
    pub symbols: Vec<SymbolInfo>,
    /// Import / use / include statements
    pub imports: Vec<ImportInfo>,
    /// Export / pub statements
    pub exports: Vec<ExportInfo>,
    /// SHA-256 hash of file contents (for change detection)
    pub content_hash: String,
}

/// A symbol extracted from tree-sitter AST
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymbolInfo {
    /// Symbol name (e.g. "MyStruct", "handle_request")
    pub name: String,
    /// Kind of symbol
    pub kind: SymbolKind,
    /// Start line (0-indexed)
    pub start_line: usize,
    /// End line (0-indexed)
    pub end_line: usize,
    /// Signature (function signature, struct fields summary)
    pub signature: Option<String>,
    /// Doc comment if present
    pub doc_comment: Option<String>,
    /// Visibility (pub, private, etc.)
    pub visibility: Visibility,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum SymbolKind {
    Function,
    Method,
    Struct,
    Class,
    Enum,
    Trait,
    Interface,
    Module,
    Constant,
    TypeAlias,
    Macro,
    Other(String),
}

impl std::fmt::Display for SymbolKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Function => write!(f, "function"),
            Self::Method => write!(f, "method"),
            Self::Struct => write!(f, "struct"),
            Self::Class => write!(f, "class"),
            Self::Enum => write!(f, "enum"),
            Self::Trait => write!(f, "trait"),
            Self::Interface => write!(f, "interface"),
            Self::Module => write!(f, "module"),
            Self::Constant => write!(f, "constant"),
            Self::TypeAlias => write!(f, "type_alias"),
            Self::Macro => write!(f, "macro"),
            Self::Other(s) => write!(f, "{}", s),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Visibility {
    Public,
    Private,
    Internal, // crate-level or package-level
}

/// An import / use / include / require statement
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportInfo {
    /// The module path or specifier (e.g. "std::collections::HashMap", "./utils")
    pub path: String,
    /// Specific items imported (e.g. ["HashMap", "HashSet"])
    pub items: Vec<String>,
    /// Line number
    pub line: usize,
}

/// An export / pub declaration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportInfo {
    /// Exported name
    pub name: String,
    /// Kind (function, struct, etc.)
    pub kind: SymbolKind,
    /// Line number
    pub line: usize,
}

// ─── Dependency Graph Types ─────────────────────────────────────────────

/// A node in the dependency graph (represents a file)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNode {
    /// Relative file path (unique ID)
    pub path: String,
    /// Language
    pub language: String,
    /// Number of symbols
    pub symbol_count: usize,
    /// LOC
    pub line_count: usize,
    /// Module / directory grouping
    pub module_group: String,
}

/// An edge: file A depends on file B
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdge {
    pub from: String,
    pub to: String,
    pub edge_type: DepEdgeType,
    /// Import items (what's imported)
    pub items: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DepEdgeType {
    Imports,
    ReExports,
}

/// Full dependency graph
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DependencyGraph {
    pub nodes: HashMap<String, GraphNode>,
    pub edges: Vec<GraphEdge>,
}

// ─── Wiki Output Types ──────────────────────────────────────────────────

/// A generated wiki page
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WikiPage {
    /// Output file relative path (e.g. "01-overview.md")
    pub rel_path: String,
    /// Page title
    pub title: String,
    /// Markdown content
    pub content: String,
}

/// Generation status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WikiStatus {
    pub phase: WikiPhase,
    pub files_scanned: usize,
    pub symbols_extracted: usize,
    pub edges_found: usize,
    pub pages_generated: usize,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WikiPhase {
    Idle,
    Scanning,
    BuildingGraph,
    Generating,
    Writing,
    Done,
    Error,
}

impl Default for WikiStatus {
    fn default() -> Self {
        Self {
            phase: WikiPhase::Idle,
            files_scanned: 0,
            symbols_extracted: 0,
            edges_found: 0,
            pages_generated: 0,
            errors: vec![],
        }
    }
}

// ─── Top-Level API ──────────────────────────────────────────────────────

/// The main RepoWiki engine that coordinates all phases
pub struct RepoWikiEngine {
    pub config: RepoWikiConfig,
    pub status: WikiStatus,
    pub files: Vec<FileEntry>,
    pub graph: DependencyGraph,
    pub pages: Vec<WikiPage>,
    http: reqwest::Client,
}

impl RepoWikiEngine {
    pub fn new(config: RepoWikiConfig) -> Self {
        Self {
            config,
            status: WikiStatus::default(),
            files: Vec::new(),
            graph: DependencyGraph::default(),
            pages: Vec::new(),
            http: reqwest::Client::new(),
        }
    }

    /// Run the full pipeline: scan → graph → generate → write
    pub async fn generate_wiki(&mut self) -> Result<WikiStatus, String> {
        // Phase 1: Scan & extract
        self.status.phase = WikiPhase::Scanning;
        self.files = scanner::scan_project(&self.config)
            .map_err(|e| format!("Scan failed: {}", e))?;
        self.status.files_scanned = self.files.len();
        self.status.symbols_extracted = self.files.iter().map(|f| f.symbols.len()).sum();

        // Phase 2: Build dependency graph
        self.status.phase = WikiPhase::BuildingGraph;
        self.graph = graph::build_graph(&self.files, &self.config);
        self.status.edges_found = self.graph.edges.len();

        // Phase 3: Generate wiki pages via LLM
        self.status.phase = WikiPhase::Generating;
        match generator::generate_pages(
            &self.files,
            &self.graph,
            &self.config,
            &self.http,
        )
        .await
        {
            Ok(pages) => {
                self.status.pages_generated = pages.len();
                self.pages = pages;
            }
            Err(e) => {
                self.status.errors.push(format!("Generation error: {}", e));
                // Still write whatever we have
            }
        }

        // Phase 4: Write output
        self.status.phase = WikiPhase::Writing;
        writer::write_wiki(&self.pages, &self.config)
            .map_err(|e| format!("Write failed: {}", e))?;

        self.status.phase = WikiPhase::Done;
        Ok(self.status.clone())
    }

    /// Re-generate only the pages affected by changed files
    pub async fn update_wiki(&mut self, changed_paths: &[String]) -> Result<WikiStatus, String> {
        // Re-scan only the changed files
        let mut updated_files = Vec::new();
        for path in changed_paths {
            let full_path = self.config.project_path.join(path);
            if full_path.exists() {
                if let Ok(entry) = scanner::scan_single_file(&full_path, &self.config) {
                    updated_files.push(entry);
                }
            }
        }

        // Merge into existing file list
        for updated in &updated_files {
            if let Some(existing) = self.files.iter_mut().find(|f| f.rel_path == updated.rel_path) {
                *existing = updated.clone();
            } else {
                self.files.push(updated.clone());
            }
        }

        // Remove files that no longer exist
        self.files.retain(|f| self.config.project_path.join(&f.rel_path).exists());

        // Rebuild graph
        self.graph = graph::build_graph(&self.files, &self.config);

        // Regenerate all pages (incremental generation is complex, full regen is simpler)
        match generator::generate_pages(&self.files, &self.graph, &self.config, &self.http).await {
            Ok(pages) => {
                self.pages = pages;
                self.status.pages_generated = self.pages.len();
            }
            Err(e) => {
                self.status.errors.push(format!("Update error: {}", e));
            }
        }

        writer::write_wiki(&self.pages, &self.config)
            .map_err(|e| format!("Write failed: {}", e))?;

        self.status.phase = WikiPhase::Done;
        Ok(self.status.clone())
    }
}

/// Convenience: call Ollama `/api/chat` (non-streaming)
pub(crate) async fn llm_chat(
    http: &reqwest::Client,
    ollama_url: &str,
    model: &str,
    system: &str,
    prompt: &str,
) -> Result<String, String> {
    let body = serde_json::json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": prompt },
        ],
        "stream": false,
        "options": { "temperature": 0.3, "num_predict": 4096 }
    });

    let resp = http
        .post(format!("{}/api/chat", ollama_url))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Ollama returned status {}", resp.status()));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    json["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "No content in Ollama response".to_string())
}
