//! LSP commands for KYRO IDE

use serde::{Deserialize, Serialize};
use tauri::command;
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::lsp::{MolecularLsp, Symbol, CompletionItem, Diagnostic};

#[derive(Debug, Serialize, Deserialize)]
pub struct SymbolsResponse {
    pub symbols: Vec<Symbol>,
    pub language: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CompletionsResponse {
    pub completions: Vec<CompletionItem>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiagnosticsResponse {
    pub diagnostics: Vec<Diagnostic>,
}

#[command]
pub async fn detect_language(lsp: Arc<Mutex<MolecularLsp>>, path: String) -> String {
    let lsp = lsp.lock().await;
    lsp.detect_language(&path)
}

#[command]
pub async fn extract_symbols(lsp: Arc<Mutex<MolecularLsp>>, language: String, code: String) -> SymbolsResponse {
    let lsp = lsp.lock().await;
    let symbols = lsp.extract_symbols(&language, &code);
    SymbolsResponse { symbols, language }
}

#[command]
pub async fn get_completions(lsp: Arc<Mutex<MolecularLsp>>, language: String, code: String, line: usize, col: usize) -> CompletionsResponse {
    let lsp = lsp.lock().await;
    let completions = lsp.get_completions(&language, &code, line, col);
    CompletionsResponse { completions }
}

#[command]
pub async fn get_diagnostics(lsp: Arc<Mutex<MolecularLsp>>, language: String, code: String) -> DiagnosticsResponse {
    let lsp = lsp.lock().await;
    let diagnostics = lsp.get_diagnostics(&language, &code);
    DiagnosticsResponse { diagnostics }
}

#[command]
pub async fn list_supported_languages(lsp: Arc<Mutex<MolecularLsp>>) -> Vec<String> {
    let lsp = lsp.lock().await;
    lsp.list_languages()
}
