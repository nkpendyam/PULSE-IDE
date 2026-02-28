// Enhanced LSP Commands — Self-contained with lazy_static state
use tauri::command;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

lazy_static::lazy_static! {
    static ref LSP_STATE: Arc<RwLock<LspState>> = Arc::new(RwLock::new(LspState::default()));
}

/// LSP capabilities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspCapabilities {
    pub completion: bool,
    pub hover: bool,
    pub definition: bool,
    pub references: bool,
    pub formatting: bool,
    pub diagnostics: bool,
    pub code_actions: bool,
    pub rename: bool,
    pub signature_help: bool,
}

impl Default for LspCapabilities {
    fn default() -> Self {
        Self {
            completion: true, hover: true, definition: true,
            references: true, formatting: true, diagnostics: true,
            code_actions: true, rename: true, signature_help: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspServerStatus {
    pub language: String,
    pub running: bool,
    pub server_name: String,
    pub capabilities: LspCapabilities,
    pub pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionItem {
    pub label: String,
    pub kind: String,
    pub detail: Option<String>,
    pub documentation: Option<String>,
    pub insert_text: Option<String>,
    pub sort_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    pub uri: String,
    pub range: Range,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Range {
    pub start: Position,
    pub end: Position,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub line: u32,
    pub character: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnostic {
    pub range: Range,
    pub severity: String,
    pub message: String,
    pub source: Option<String>,
    pub code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HoverResult {
    pub contents: String,
    pub range: Option<Range>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextEdit {
    pub range: Range,
    pub new_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeAction {
    pub title: String,
    pub kind: Option<String>,
    pub diagnostics: Vec<Diagnostic>,
    pub is_preferred: bool,
}

#[derive(Debug, Default)]
pub struct LspState {
    servers: HashMap<String, LspServerStatus>,
    diagnostics: HashMap<String, Vec<Diagnostic>>,
}

#[command]
pub async fn lsp_start_server(language: String, root_uri: String) -> Result<LspServerStatus, String> {
    let mut state = LSP_STATE.write().await;
    let status = LspServerStatus {
        language: language.clone(), running: true,
        server_name: format!("{}-language-server", language),
        capabilities: LspCapabilities::default(),
        pid: Some(std::process::id()),
    };
    state.servers.insert(language, status.clone());
    Ok(status)
}

#[command]
pub async fn lsp_stop_server(language: String) -> Result<(), String> {
    let mut state = LSP_STATE.write().await;
    state.servers.remove(&language);
    Ok(())
}

#[command]
pub async fn lsp_get_servers() -> Result<Vec<LspServerStatus>, String> {
    let state = LSP_STATE.read().await;
    Ok(state.servers.values().cloned().collect())
}

#[command]
pub async fn lsp_get_completions(uri: String, line: u32, character: u32) -> Result<Vec<CompletionItem>, String> {
    Ok(vec![CompletionItem {
        label: "println!".to_string(), kind: "function".to_string(),
        detail: Some("Print to stdout".to_string()),
        documentation: Some("Macro for printing to stdout with newline".to_string()),
        insert_text: Some("println!(\"$1\")".to_string()),
        sort_text: Some("0001".to_string()),
    }])
}

#[command]
pub async fn lsp_goto_definition(uri: String, line: u32, character: u32) -> Result<Option<Location>, String> {
    Ok(None)
}

#[command]
pub async fn lsp_hover(uri: String, line: u32, character: u32) -> Result<Option<HoverResult>, String> {
    Ok(None)
}

#[command]
pub async fn lsp_get_diagnostics(uri: String) -> Result<Vec<Diagnostic>, String> {
    let state = LSP_STATE.read().await;
    Ok(state.diagnostics.get(&uri).cloned().unwrap_or_default())
}

#[command]
pub async fn lsp_format_document(uri: String) -> Result<Vec<TextEdit>, String> {
    Ok(vec![])
}

#[command]
pub async fn lsp_code_actions(uri: String, start_line: u32, end_line: u32) -> Result<Vec<CodeAction>, String> {
    Ok(vec![])
}

#[command]
pub async fn lsp_find_references(uri: String, line: u32, character: u32) -> Result<Vec<Location>, String> {
    Ok(vec![])
}

#[command]
pub async fn lsp_rename(uri: String, line: u32, character: u32, new_name: String) -> Result<Vec<TextEdit>, String> {
    Ok(vec![])
}

#[command]
pub async fn lsp_signature_help(uri: String, line: u32, character: u32) -> Result<Option<String>, String> {
    Ok(None)
}
