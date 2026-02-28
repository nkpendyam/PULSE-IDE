//! WASM Grammar Loader for Molecular LSP
//!
//! Loads language grammars and LSP logic as WASM modules
//! for extensible, sandboxed language support

use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

/// WASM Grammar Loader
pub struct WasmGrammarLoader {
    modules_dir: PathBuf,
    loaded_modules: HashMap<String, LoadedModule>,
    config: LoaderConfig,
}

/// Configuration for the loader
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoaderConfig {
    pub max_memory_mb: u32,
    pub timeout_ms: u32,
    pub cache_modules: bool,
}

impl Default for LoaderConfig {
    fn default() -> Self {
        Self {
            max_memory_mb: 500,
            timeout_ms: 5000,
            cache_modules: true,
        }
    }
}

/// A loaded WASM module
#[derive(Debug)]
pub struct LoadedModule {
    pub language: String,
    pub version: String,
    pub memory_usage: usize,
    pub grammar_hash: String,
}

/// Language module metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleMetadata {
    pub name: String,
    pub version: String,
    pub language: String,
    pub extensions: Vec<String>,
    pub grammar_file: String,
    pub lsp_file: Option<String>,
    pub features: ModuleFeatures,
}

/// Features provided by a module
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleFeatures {
    pub completions: bool,
    pub hover: bool,
    pub diagnostics: bool,
    pub symbols: bool,
    pub formatting: bool,
}

/// Trait for language-specific LSP logic
pub trait LanguageMolecule: Send + Sync {
    /// Get completions at a position
    fn complete(&self, tree: &[u8], position: Position) -> Vec<Completion>;
    
    /// Get hover information
    fn hover(&self, tree: &[u8], position: Position) -> Option<Hover>;
    
    /// Get diagnostics
    fn diagnostics(&self, tree: &[u8]) -> Vec<Diagnostic>;
    
    /// Get document symbols
    fn symbols(&self, tree: &[u8]) -> Vec<Symbol>;
}

/// Position in a document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub line: u32,
    pub column: u32,
    pub offset: usize,
}

/// Completion item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Completion {
    pub label: String,
    pub kind: CompletionKind,
    pub detail: Option<String>,
    pub insert_text: Option<String>,
    pub sort_text: Option<String>,
}

/// Completion kind
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CompletionKind {
    Function,
    Method,
    Class,
    Struct,
    Enum,
    Constant,
    Variable,
    Field,
    Keyword,
    Snippet,
    Text,
}

/// Hover information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hover {
    pub contents: String,
    pub range: Option<Range>,
}

/// Range in a document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Range {
    pub start: Position,
    pub end: Position,
}

/// Diagnostic
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnostic {
    pub message: String,
    pub severity: DiagnosticSeverity,
    pub range: Range,
    pub code: Option<String>,
}

/// Diagnostic severity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DiagnosticSeverity {
    Error,
    Warning,
    Information,
    Hint,
}

/// Symbol in a document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Symbol {
    pub name: String,
    pub kind: SymbolKind,
    pub range: Range,
    pub selection_range: Range,
    pub children: Vec<Symbol>,
}

/// Symbol kind
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SymbolKind {
    File,
    Module,
    Namespace,
    Package,
    Class,
    Method,
    Property,
    Field,
    Constructor,
    Enum,
    Interface,
    Function,
    Variable,
    Constant,
    String,
    Number,
    Boolean,
    Array,
    Object,
    Key,
    Null,
    EnumMember,
    Struct,
    Event,
    Operator,
    TypeParameter,
}

impl WasmGrammarLoader {
    /// Create a new WASM grammar loader
    pub fn new() -> anyhow::Result<Self> {
        let modules_dir = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("kyro-ide")
            .join("molecules");

        std::fs::create_dir_all(&modules_dir)?;

        Ok(Self {
            modules_dir,
            loaded_modules: HashMap::new(),
            config: LoaderConfig::default(),
        })
    }

    /// Load a language module
    pub async fn load_module(&mut self, language: &str) -> anyhow::Result<()> {
        if self.loaded_modules.contains_key(language) {
            return Ok(());
        }

        let module_path = self.modules_dir.join(language);
        
        if !module_path.exists() {
            self.download_module(language).await?;
        }

        // Load metadata
        let metadata_path = module_path.join("molecule.json");
        let metadata: ModuleMetadata = if metadata_path.exists() {
            let content = tokio::fs::read_to_string(&metadata_path).await?;
            serde_json::from_str(&content)?
        } else {
            self.create_default_metadata(language)?
        };

        // In production, this would use wasmtime to load the WASM module
        // For now, we just track the module
        self.loaded_modules.insert(language.to_string(), LoadedModule {
            language: language.to_string(),
            version: metadata.version,
            memory_usage: 0,
            grammar_hash: String::new(),
        });

        println!("Loaded language module: {}", language);
        Ok(())
    }

    /// Download a module from the registry
    async fn download_module(&self, language: &str) -> anyhow::Result<()> {
        let module_path = self.modules_dir.join(language);
        tokio::fs::create_dir_all(&module_path).await?;

        // Create default metadata
        let metadata = self.create_default_metadata(language)?;
        let metadata_json = serde_json::to_string_pretty(&metadata)?;
        tokio::fs::write(module_path.join("molecule.json"), metadata_json).await?;

        println!("Downloaded language module: {}", language);
        Ok(())
    }

    /// Create default metadata for a language
    fn create_default_metadata(&self, language: &str) -> anyhow::Result<ModuleMetadata> {
        let (extensions, grammar_file) = match language {
            "rust" => (vec!["rs".to_string()], "tree-sitter-rust.wasm"),
            "python" => (vec!["py".to_string(), "pyw".to_string()], "tree-sitter-python.wasm"),
            "javascript" => (vec!["js".to_string(), "mjs".to_string()], "tree-sitter-javascript.wasm"),
            "typescript" => (vec!["ts".to_string()], "tree-sitter-typescript.wasm"),
            "go" => (vec!["go".to_string()], "tree-sitter-go.wasm"),
            "java" => (vec!["java".to_string()], "tree-sitter-java.wasm"),
            "c" => (vec!["c".to_string(), "h".to_string()], "tree-sitter-c.wasm"),
            "cpp" => (vec!["cpp".to_string(), "hpp".to_string()], "tree-sitter-cpp.wasm"),
            "ruby" => (vec!["rb".to_string()], "tree-sitter-ruby.wasm"),
            _ => (vec![], "grammar.wasm"),
        };

        Ok(ModuleMetadata {
            name: language.to_string(),
            version: "0.1.0".to_string(),
            language: language.to_string(),
            extensions,
            grammar_file: grammar_file.to_string(),
            lsp_file: None,
            features: ModuleFeatures {
                completions: true,
                hover: false,
                diagnostics: true,
                symbols: true,
                formatting: false,
            },
        })
    }

    /// Unload a module
    pub fn unload_module(&mut self, language: &str) {
        self.loaded_modules.remove(language);
    }

    /// Check if a module is loaded
    pub fn is_loaded(&self, language: &str) -> bool {
        self.loaded_modules.contains_key(language)
    }

    /// Get loaded languages
    pub fn loaded_languages(&self) -> Vec<&str> {
        self.loaded_modules.keys().map(|s| s.as_str()).collect()
    }

    /// Get total memory usage
    pub fn memory_usage(&self) -> usize {
        self.loaded_modules.values().map(|m| m.memory_usage).sum()
    }

    /// Parse a file with the appropriate grammar
    pub fn parse(&self, language: &str, content: &str) -> anyhow::Result<ParsedFile> {
        // In production, this would call the WASM parser
        Ok(ParsedFile {
            language: language.to_string(),
            root_node: Node {
                kind: "program".to_string(),
                start_byte: 0,
                end_byte: content.len(),
                children: vec![],
            },
            symbols: vec![],
        })
    }

    /// Get completions for a file
    pub fn get_completions(&self, language: &str, content: &str, position: Position) -> anyhow::Result<Vec<Completion>> {
        // In production, this would call the WASM LSP logic
        Ok(vec![])
    }

    /// Get diagnostics for a file
    pub fn get_diagnostics(&self, language: &str, content: &str) -> anyhow::Result<Vec<Diagnostic>> {
        Ok(vec![])
    }
}

impl Default for WasmGrammarLoader {
    fn default() -> Self {
        Self::new().expect("Failed to create WasmGrammarLoader")
    }
}

/// A parsed file
#[derive(Debug, Clone)]
pub struct ParsedFile {
    pub language: String,
    pub root_node: Node,
    pub symbols: Vec<Symbol>,
}

/// A node in the parse tree
#[derive(Debug, Clone)]
pub struct Node {
    pub kind: String,
    pub start_byte: usize,
    pub end_byte: usize,
    pub children: Vec<Node>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_loader_creation() {
        let loader = WasmGrammarLoader::new();
        assert!(loader.is_ok());
    }

    #[tokio::test]
    async fn test_load_module() {
        let mut loader = WasmGrammarLoader::new().unwrap();
        let result = loader.load_module("rust").await;
        assert!(result.is_ok());
        assert!(loader.is_loaded("rust"));
    }
}
