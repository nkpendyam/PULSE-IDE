//! VS Code Languages API
//! Implements vscode.languages namespace

use serde::{Deserialize, Serialize};

/// Language filter for extension registration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentFilter {
    pub language: Option<String>,
    pub scheme: Option<String>,
    pub pattern: Option<String>,
}

/// Completion item kind
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum CompletionItemKind {
    Text = 0, Method = 1, Function = 2, Constructor = 3, Field = 4,
    Variable = 5, Class = 6, Interface = 7, Module = 8, Property = 9,
    Unit = 10, Value = 11, Enum = 12, Keyword = 13, Snippet = 14,
    Color = 15, File = 16, Reference = 17, Folder = 18,
}

/// Completion item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionItem {
    pub label: String,
    pub kind: Option<CompletionItemKind>,
    pub detail: Option<String>,
    pub documentation: Option<String>,
    pub insert_text: Option<String>,
}
