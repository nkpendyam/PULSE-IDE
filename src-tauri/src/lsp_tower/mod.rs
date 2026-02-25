//! Tower-LSP Integration for KYRO IDE
//! 
//! Based on tower-lsp (https://github.com/ebkalderon/tower-lsp)
//! Provides a standards-compliant LSP server implementation

pub mod backend;

pub use backend::KyroLspBackend;

use serde::{Deserialize, Serialize};
use tower_lsp::lsp_types::*;

/// Language server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspConfig {
    /// Enable AI-powered completions
    pub ai_completions: bool,
    /// Maximum completion items per request
    pub max_completion_items: usize,
    /// Enable diagnostics
    pub diagnostics: bool,
    /// Diagnostic debounce time in ms
    pub diagnostic_debounce_ms: u64,
    /// Enable semantic highlighting
    pub semantic_highlighting: bool,
    /// Enable document symbols
    pub document_symbols: bool,
    /// Enable workspace symbols
    pub workspace_symbols: bool,
    /// Enable code actions
    pub code_actions: bool,
    /// Enable hover
    pub hover: bool,
    /// Enable go to definition
    pub definition: bool,
    /// Enable find references
    pub references: bool,
    /// Enable rename
    pub rename: bool,
}

impl Default for LspConfig {
    fn default() -> Self {
        Self {
            ai_completions: true,
            max_completion_items: 100,
            diagnostics: true,
            diagnostic_debounce_ms: 300,
            semantic_highlighting: true,
            document_symbols: true,
            workspace_symbols: true,
            code_actions: true,
            hover: true,
            definition: true,
            references: true,
            rename: true,
        }
    }
}

/// Document state tracked by the language server
#[derive(Debug, Clone)]
pub struct DocumentState {
    /// Document URI
    pub uri: Url,
    /// Language ID
    pub language_id: String,
    /// Document version
    pub version: i32,
    /// Document content
    pub content: String,
    /// Parsed symbols
    pub symbols: Vec<SymbolInformation>,
    /// Cached diagnostics
    pub diagnostics: Vec<Diagnostic>,
}

/// Language capabilities
#[derive(Debug, Clone)]
pub struct LanguageCapabilities {
    /// Supports completion
    pub completion: bool,
    /// Supports hover
    pub hover: bool,
    /// Supports definition
    pub definition: bool,
    /// Supports references
    pub references: bool,
    /// Supports document symbols
    pub document_symbol: bool,
    /// Supports workspace symbols
    pub workspace_symbol: bool,
    /// Supports code actions
    pub code_action: bool,
    /// Supports rename
    pub rename: bool,
    /// Supports formatting
    pub formatting: bool,
    /// Supports semantic tokens
    pub semantic_tokens: bool,
}

impl Default for LanguageCapabilities {
    fn default() -> Self {
        Self {
            completion: true,
            hover: true,
            definition: true,
            references: true,
            document_symbol: true,
            workspace_symbol: false,
            code_action: true,
            rename: true,
            formatting: true,
            semantic_tokens: true,
        }
    }
}

/// Language server feature set
pub fn get_language_capabilities(language_id: &str) -> LanguageCapabilities {
    match language_id {
        "rust" => LanguageCapabilities {
            completion: true,
            hover: true,
            definition: true,
            references: true,
            document_symbol: true,
            workspace_symbol: true,
            code_action: true,
            rename: true,
            formatting: true,
            semantic_tokens: true,
        },
        "python" => LanguageCapabilities {
            completion: true,
            hover: true,
            definition: true,
            references: true,
            document_symbol: true,
            workspace_symbol: false,
            code_action: true,
            rename: true,
            formatting: true,
            semantic_tokens: true,
        },
        "typescript" | "javascript" => LanguageCapabilities {
            completion: true,
            hover: true,
            definition: true,
            references: true,
            document_symbol: true,
            workspace_symbol: false,
            code_action: true,
            rename: true,
            formatting: true,
            semantic_tokens: true,
        },
        "go" => LanguageCapabilities {
            completion: true,
            hover: true,
            definition: true,
            references: true,
            document_symbol: true,
            workspace_symbol: true,
            code_action: true,
            rename: true,
            formatting: true,
            semantic_tokens: true,
        },
        _ => LanguageCapabilities::default(),
    }
}
