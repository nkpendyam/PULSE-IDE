//! LSP Backend Implementation using tower-lsp
//!
//! Implements the LanguageServer trait from tower-lsp

use anyhow::Result;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_lsp::jsonrpc::Result as LspResult;
use tower_lsp::lsp_types::*;
use tower_lsp::{LanguageServer, LspService, Server};

use super::{LspConfig, DocumentState, get_language_capabilities};

/// KYRO IDE LSP Backend
pub struct KyroLspBackend {
    /// Client handle for sending notifications
    client: tower_lsp::Client,
    /// Configuration
    config: LspConfig,
    /// Open documents
    documents: Arc<RwLock<HashMap<Url, DocumentState>>>,
    /// Workspace root
    root_uri: Arc<RwLock<Option<Url>>>,
}

impl KyroLspBackend {
    /// Create a new LSP backend
    pub fn new(client: tower_lsp::Client, config: LspConfig) -> Self {
        Self {
            client,
            config,
            documents: Arc::new(RwLock::new(HashMap::new())),
            root_uri: Arc::new(RwLock::new(None)),
        }
    }
    
    /// Get document content
    pub async fn get_document(&self, uri: &Url) -> Option<DocumentState> {
        let docs = self.documents.read().await;
        docs.get(uri).cloned()
    }
    
    /// Update document content
    pub async fn update_document(&self, uri: Url, content: String, version: i32) {
        let mut docs = self.documents.write().await;
        if let Some(doc) = docs.get_mut(&uri) {
            doc.content = content;
            doc.version = version;
        }
    }
    
    /// Publish diagnostics for a document
    pub async fn publish_diagnostics(&self, uri: Url, diagnostics: Vec<Diagnostic>) {
        self.client
            .publish_diagnostics(uri, diagnostics, None)
            .await;
    }
    
    /// Send a custom notification
    pub async fn send_notification(&self, method: &str, params: serde_json::Value) {
        self.client
            .send_notification::<CustomNotification>(method, params)
            .await;
    }
}

/// Custom notification type
#[derive(Debug)]
struct CustomNotification;

impl tower_lsp::notification::Notification for CustomNotification {
    type Params = serde_json::Value;
    const METHOD: &'static str = "custom";
}

#[tower_lsp::async_trait]
impl LanguageServer for KyroLspBackend {
    /// Initialize the language server
    async fn initialize(&self, params: InitializeParams) -> LspResult<InitializeResult> {
        // Store root URI
        if let Some(root_uri) = params.root_uri {
            *self.root_uri.write().await = Some(root_uri);
        }
        
        // Build server capabilities
        let capabilities = ServerCapabilities {
            text_document_sync: Some(TextDocumentSyncCapability::Kind(
                TextDocumentSyncKind::INCREMENTAL,
            )),
            completion_provider: Some(CompletionOptions {
                resolve_provider: Some(true),
                trigger_characters: Some(vec![
                    ".".to_string(),
                    ":".to_string(),
                    "<".to_string(),
                    "\"".to_string(),
                    "/".to_string(),
                ]),
                all_commit_characters: None,
                work_done_progress_options: WorkDoneProgressOptions {
                    work_done_progress: Some(false),
                },
                completion_item: None,
            }),
            hover_provider: Some(HoverProviderCapability::Simple(true)),
            definition_provider: Some(OneOf::Left(true)),
            references_provider: Some(OneOf::Left(true)),
            document_symbol_provider: Some(OneOf::Left(true)),
            workspace_symbol_provider: Some(OneOf::Left(true)),
            code_action_provider: Some(CodeActionProviderCapability::Simple(true)),
            document_formatting_provider: Some(OneOf::Left(true)),
            document_range_formatting_provider: Some(OneOf::Left(true)),
            rename_provider: Some(OneOf::Left(true)),
            signature_help_provider: Some(SignatureHelpOptions {
                trigger_characters: Some(vec!["(".to_string(), ",".to_string()]),
                retrigger_characters: None,
                work_done_progress_options: WorkDoneProgressOptions {
                    work_done_progress: Some(false),
                },
            }),
            execute_command_provider: Some(ExecuteCommandOptions {
                commands: vec![
                    "kyro.ai.complete".to_string(),
                    "kyro.ai.explain".to_string(),
                    "kyro.ai.review".to_string(),
                    "kyro.ai.refactor".to_string(),
                    "kyro.ai.generateTests".to_string(),
                ],
                work_done_progress_options: WorkDoneProgressOptions {
                    work_done_progress: Some(false),
                },
            }),
            semantic_tokens_provider: Some(
                SemanticTokensServerCapabilities::SemanticTokensOptions(
                    SemanticTokensOptions {
                        work_done_progress_options: WorkDoneProgressOptions {
                            work_done_progress: Some(false),
                        },
                        legend: SemanticTokensLegend {
                            token_types: vec![
                                SemanticTokenType::NAMESPACE,
                                SemanticTokenType::TYPE,
                                SemanticTokenType::CLASS,
                                SemanticTokenType::ENUM,
                                SemanticTokenType::INTERFACE,
                                SemanticTokenType::STRUCT,
                                SemanticTokenType::TYPE_PARAMETER,
                                SemanticTokenType::PARAMETER,
                                SemanticTokenType::VARIABLE,
                                SemanticTokenType::PROPERTY,
                                SemanticTokenType::ENUM_MEMBER,
                                SemanticTokenType::FUNCTION,
                                SemanticTokenType::METHOD,
                                SemanticTokenType::MACRO,
                                SemanticTokenType::KEYWORD,
                                SemanticTokenType::MODIFIER,
                                SemanticTokenType::COMMENT,
                                SemanticTokenType::STRING,
                                SemanticTokenType::NUMBER,
                                SemanticTokenType::REGEXP,
                                SemanticTokenType::OPERATOR,
                            ],
                            token_modifiers: vec![
                                SemanticTokenModifier::DECLARATION,
                                SemanticTokenModifier::DEFINITION,
                                SemanticTokenModifier::READONLY,
                                SemanticTokenModifier::STATIC,
                                SemanticTokenModifier::DEPRECATED,
                                SemanticTokenModifier::ABSTRACT,
                                SemanticTokenModifier::ASYNC,
                                SemanticTokenModifier::MODIFICATION,
                                SemanticTokenModifier::DOCUMENTATION,
                                SemanticTokenModifier::DEFAULT_LIBRARY,
                            ],
                        },
                        range: Some(true),
                        full: Some(SemanticTokensFullOptions::Delta { delta: Some(true) }),
                    },
                ),
            ),
            ..Default::default()
        };
        
        Ok(InitializeResult {
            capabilities,
            server_info: Some(ServerInfo {
                name: "KYRO IDE Language Server".to_string(),
                version: Some(env!("CARGO_PKG_VERSION").to_string()),
            }),
        })
    }
    
    /// Server initialized notification
    async fn initialized(&self, _params: InitializedParams) {
        log::info!("KYRO LSP server initialized");
    }
    
    /// Shutdown the language server
    async fn shutdown(&self) -> LspResult<()> {
        log::info!("KYRO LSP server shutting down");
        Ok(())
    }
    
    /// Document opened
    async fn did_open(&self, params: DidOpenTextDocumentParams) {
        let TextDocumentItem { uri, language_id, version, text } = params.text_document;
        
        log::info!("Document opened: {} ({})", uri, language_id);
        
        let doc = DocumentState {
            uri: uri.clone(),
            language_id: language_id.clone(),
            version,
            content: text.clone(),
            symbols: Vec::new(),
            diagnostics: Vec::new(),
        };
        
        self.documents.write().await.insert(uri.clone(), doc);
        
        // Trigger diagnostics
        if self.config.diagnostics {
            let diagnostics = self.compute_diagnostics(&uri, &text, &language_id).await;
            self.publish_diagnostics(uri, diagnostics).await;
        }
    }
    
    /// Document changed
    async fn did_change(&self, params: DidChangeTextDocumentParams) {
        let VersionedTextDocumentIdentifier { uri, version } = params.text_document;
        
        let mut docs = self.documents.write().await;
        if let Some(doc) = docs.get_mut(&uri) {
            // Apply content changes
            for change in params.content_changes {
                if let Some(range) = change.range {
                    // Incremental update
                    doc.content = apply_change(&doc.content, range, &change.text);
                } else {
                    // Full update
                    doc.content = change.text;
                }
            }
            doc.version = version;
            
            // Trigger diagnostics (debounced in production)
            if self.config.diagnostics {
                let diagnostics = self.compute_diagnostics(&uri, &doc.content, &doc.language_id).await;
                let uri_clone = uri.clone();
                drop(docs);
                self.publish_diagnostics(uri_clone, diagnostics).await;
            }
        }
    }
    
    /// Document saved
    async fn did_save(&self, params: DidSaveTextDocumentParams) {
        let TextDocumentIdentifier { uri } = params.text_document;
        log::info!("Document saved: {}", uri);
    }
    
    /// Document closed
    async fn did_close(&self, params: DidCloseTextDocumentParams) {
        let TextDocumentIdentifier { uri } = params.text_document;
        log::info!("Document closed: {}", uri);
        self.documents.write().await.remove(&uri);
    }
    
    /// Completion request
    async fn completion(&self, params: CompletionParams) -> LspResult<Option<CompletionResponse>> {
        let uri = params.text_document_position.text_document.uri;
        let position = params.text_document_position.position;
        
        let docs = self.documents.read().await;
        if let Some(doc) = docs.get(&uri) {
            let items = self.get_completions(&doc.content, &doc.language_id, position).await;
            
            return Ok(Some(CompletionResponse::Array(items)));
        }
        
        Ok(None)
    }
    
    /// Resolve completion item
    async fn completion_resolve(&self, item: CompletionItem) -> LspResult<CompletionItem> {
        // Add documentation, details, etc.
        Ok(item)
    }
    
    /// Hover request
    async fn hover(&self, params: HoverParams) -> LspResult<Option<Hover>> {
        let uri = params.text_document_position_params.text_document.uri;
        let position = params.text_document_position_params.position;
        
        let docs = self.documents.read().await;
        if let Some(doc) = docs.get(&uri) {
            if let Some(hover) = self.get_hover(&doc.content, &doc.language_id, position).await {
                return Ok(Some(hover));
            }
        }
        
        Ok(None)
    }
    
    /// Go to definition
    async fn goto_definition(
        &self,
        params: GotoDefinitionParams,
    ) -> LspResult<Option<GotoDefinitionResponse>> {
        let uri = params.text_document_position_params.text_document.uri;
        let position = params.text_document_position_params.position;
        
        let docs = self.documents.read().await;
        if let Some(doc) = docs.get(&uri) {
            if let Some(location) = self.get_definition(&doc.content, &doc.language_id, position).await {
                return Ok(Some(GotoDefinitionResponse::Scalar(location)));
            }
        }
        
        Ok(None)
    }
    
    /// Find references
    async fn references(&self, params: ReferenceParams) -> LspResult<Option<Vec<Location>>> {
        let uri = params.text_document_position.text_document.uri;
        let position = params.text_document_position.position;
        
        let docs = self.documents.read().await;
        if let Some(doc) = docs.get(&uri) {
            let references = self.get_references(&doc.content, &doc.language_id, position).await;
            return Ok(Some(references));
        }
        
        Ok(None)
    }
    
    /// Document symbols
    async fn document_symbol(
        &self,
        params: DocumentSymbolParams,
    ) -> LspResult<Option<DocumentSymbolResponse>> {
        let uri = params.text_document.uri;
        
        let docs = self.documents.read().await;
        if let Some(doc) = docs.get(&uri) {
            let symbols = self.get_document_symbols(&doc.content, &doc.language_id).await;
            return Ok(Some(DocumentSymbolResponse::Flat(symbols)));
        }
        
        Ok(None)
    }
    
    /// Execute command
    async fn execute_command(&self, params: ExecuteCommandParams) -> LspResult<Option<serde_json::Value>> {
        let command = params.command;
        let args = params.arguments;
        
        log::info!("Executing command: {} with {} args", command, args.len());
        
        match command.as_str() {
            "kyro.ai.complete" => {
                // AI-powered completion
                Ok(Some(serde_json::json!({ "status": "completed" })))
            }
            "kyro.ai.explain" => {
                // Explain code
                Ok(Some(serde_json::json!({ "status": "completed" })))
            }
            "kyro.ai.review" => {
                // Code review
                Ok(Some(serde_json::json!({ "status": "completed" })))
            }
            "kyro.ai.refactor" => {
                // Refactor
                Ok(Some(serde_json::json!({ "status": "completed" })))
            }
            "kyro.ai.generateTests" => {
                // Generate tests
                Ok(Some(serde_json::json!({ "status": "completed" })))
            }
            _ => Ok(None),
        }
    }
    
    /// Format document
    async fn formatting(&self, params: DocumentFormattingParams) -> LspResult<Option<Vec<TextEdit>>> {
        let uri = params.text_document.uri;
        
        let docs = self.documents.read().await;
        if let Some(doc) = docs.get(&uri) {
            let edits = self.format_document(&doc.content, &doc.language_id, &params.options).await;
            return Ok(Some(edits));
        }
        
        Ok(None)
    }
    
    /// Rename symbol
    async fn rename(&self, params: RenameParams) -> LspResult<Option<WorkspaceEdit>> {
        let uri = params.text_document_position.text_document.uri;
        let position = params.text_document_position.position;
        let new_name = params.new_name;
        
        let docs = self.documents.read().await;
        if let Some(doc) = docs.get(&uri) {
            let edits = self.get_rename_edits(&doc.content, &doc.language_id, position, &new_name).await;
            
            return Ok(Some(WorkspaceEdit {
                changes: Some(hashmap! { uri.clone() => edits }),
                document_changes: None,
                change_annotations: None,
            }));
        }
        
        Ok(None)
    }
}

// Helper implementations
impl KyroLspBackend {
    async fn compute_diagnostics(&self, _uri: &Url, content: &str, language_id: &str) -> Vec<Diagnostic> {
        // Use tree-sitter for syntax errors
        let mut diagnostics = Vec::new();
        
        // Basic bracket matching
        let lines: Vec<&str> = content.lines().collect();
        let mut bracket_stack = Vec::new();
        
        for (line_num, line) in lines.iter().enumerate() {
            for (col, ch) in line.chars().enumerate() {
                match ch {
                    '(' | '[' | '{' => bracket_stack.push((ch, line_num, col)),
                    ')' => {
                        if bracket_stack.last().map(|(c, _, _)| *c == '(').unwrap_or(false) {
                            bracket_stack.pop();
                        } else {
                            diagnostics.push(Diagnostic {
                                range: Range {
                                    start: Position { line: line_num as u32, character: col as u32 },
                                    end: Position { line: line_num as u32, character: col as u32 + 1 },
                                },
                                severity: Some(DiagnosticSeverity::ERROR),
                                message: "Unmatched closing parenthesis".to_string(),
                                source: Some("kyro-lsp".to_string()),
                                ..Default::default()
                            });
                        }
                    }
                    ']' => {
                        if bracket_stack.last().map(|(c, _, _)| *c == '[').unwrap_or(false) {
                            bracket_stack.pop();
                        } else {
                            diagnostics.push(Diagnostic {
                                range: Range {
                                    start: Position { line: line_num as u32, character: col as u32 },
                                    end: Position { line: line_num as u32, character: col as u32 + 1 },
                                },
                                severity: Some(DiagnosticSeverity::ERROR),
                                message: "Unmatched closing bracket".to_string(),
                                source: Some("kyro-lsp".to_string()),
                                ..Default::default()
                            });
                        }
                    }
                    '}' => {
                        if bracket_stack.last().map(|(c, _, _)| *c == '{').unwrap_or(false) {
                            bracket_stack.pop();
                        } else {
                            diagnostics.push(Diagnostic {
                                range: Range {
                                    start: Position { line: line_num as u32, character: col as u32 },
                                    end: Position { line: line_num as u32, character: col as u32 + 1 },
                                },
                                severity: Some(DiagnosticSeverity::ERROR),
                                message: "Unmatched closing brace".to_string(),
                                source: Some("kyro-lsp".to_string()),
                                ..Default::default()
                            });
                        }
                    }
                    _ => {}
                }
            }
        }
        
        // Check for unclosed brackets
        for (bracket, line, col) in bracket_stack {
            let closing = match bracket {
                '(' => ")",
                '[' => "]",
                '{' => "}",
                _ => continue,
            };
            diagnostics.push(Diagnostic {
                range: Range {
                    start: Position { line: line as u32, character: col as u32 },
                    end: Position { line: line as u32, character: col as u32 + 1 },
                },
                severity: Some(DiagnosticSeverity::ERROR),
                message: format!("Unclosed '{}', expected '{}'", bracket, closing),
                source: Some("kyro-lsp".to_string()),
                ..Default::default()
            });
        }
        
        diagnostics
    }
    
    async fn get_completions(
        &self,
        content: &str,
        language_id: &str,
        position: Position,
    ) -> Vec<CompletionItem> {
        let mut items = Vec::new();
        
        // Get current line
        let lines: Vec<&str> = content.lines().collect();
        let current_line = lines.get(position.line as usize).unwrap_or(&"");
        
        // Get text before cursor
        let text_before = if (position.character as usize) <= current_line.len() {
            &current_line[..position.character as usize]
        } else {
            current_line
        };
        
        // Language-specific completions
        match language_id {
            "rust" => {
                items.extend(self.rust_completions(text_before));
            }
            "python" => {
                items.extend(self.python_completions(text_before));
            }
            "typescript" | "javascript" => {
                items.extend(self.js_ts_completions(text_before));
            }
            "go" => {
                items.extend(self.go_completions(text_before));
            }
            _ => {}
        }
        
        items.truncate(self.config.max_completion_items);
        items
    }
    
    fn rust_completions(&self, text_before: &str) -> Vec<CompletionItem> {
        let keywords = vec![
            "fn", "let", "mut", "const", "static", "pub", "mod", "use",
            "struct", "enum", "impl", "trait", "type", "where", "for",
            "loop", "while", "if", "else", "match", "return", "async", "await",
        ];
        
        keywords.into_iter().map(|kw| CompletionItem {
            label: kw.to_string(),
            kind: Some(CompletionItemKind::KEYWORD),
            ..Default::default()
        }).collect()
    }
    
    fn python_completions(&self, text_before: &str) -> Vec<CompletionItem> {
        let keywords = vec![
            "def", "class", "if", "elif", "else", "for", "while", "try",
            "except", "finally", "with", "as", "import", "from", "return",
            "yield", "raise", "pass", "lambda", "async", "await",
        ];
        
        keywords.into_iter().map(|kw| CompletionItem {
            label: kw.to_string(),
            kind: Some(CompletionItemKind::KEYWORD),
            ..Default::default()
        }).collect()
    }
    
    fn js_ts_completions(&self, text_before: &str) -> Vec<CompletionItem> {
        let keywords = vec![
            "function", "const", "let", "var", "class", "interface", "type",
            "enum", "import", "export", "from", "async", "await", "return",
            "if", "else", "for", "while", "switch", "case", "break",
        ];
        
        keywords.into_iter().map(|kw| CompletionItem {
            label: kw.to_string(),
            kind: Some(CompletionItemKind::KEYWORD),
            ..Default::default()
        }).collect()
    }
    
    fn go_completions(&self, text_before: &str) -> Vec<CompletionItem> {
        let keywords = vec![
            "package", "import", "func", "var", "const", "type", "struct",
            "interface", "map", "chan", "if", "else", "for", "range",
            "switch", "case", "default", "return", "go", "defer", "select",
        ];
        
        keywords.into_iter().map(|kw| CompletionItem {
            label: kw.to_string(),
            kind: Some(CompletionItemKind::KEYWORD),
            ..Default::default()
        }).collect()
    }
    
    async fn get_hover(&self, content: &str, language_id: &str, position: Position) -> Option<Hover> {
        // TODO: Implement hover using tree-sitter
        None
    }
    
    async fn get_definition(&self, content: &str, language_id: &str, position: Position) -> Option<Location> {
        // TODO: Implement definition using tree-sitter
        None
    }
    
    async fn get_references(&self, content: &str, language_id: &str, position: Position) -> Vec<Location> {
        // TODO: Implement references using tree-sitter
        Vec::new()
    }
    
    async fn get_document_symbols(&self, content: &str, language_id: &str) -> Vec<SymbolInformation> {
        // TODO: Implement using tree-sitter
        Vec::new()
    }
    
    async fn format_document(&self, content: &str, language_id: &str, options: &FormattingOptions) -> Vec<TextEdit> {
        // TODO: Integrate with formatters (rustfmt, black, prettier, etc.)
        Vec::new()
    }
    
    async fn get_rename_edits(&self, content: &str, language_id: &str, position: Position, new_name: &str) -> Vec<TextEdit> {
        // TODO: Implement rename using tree-sitter
        Vec::new()
    }
}

/// Apply a text change to content
fn apply_change(content: &str, range: Range, text: &str) -> String {
    let lines: Vec<&str> = content.lines().collect();
    
    // Get text before and after the change
    let start_line = range.start.line as usize;
    let start_col = range.start.character as usize;
    let end_line = range.end.line as usize;
    let end_col = range.end.character as usize;
    
    // Reconstruct the content
    let mut result = String::new();
    
    // Add lines before the change
    for (i, line) in lines.iter().enumerate() {
        if i < start_line {
            result.push_str(line);
            result.push('\n');
        } else if i == start_line {
            // Add text before the change on the same line
            if start_col <= line.len() {
                result.push_str(&line[..start_col]);
            }
            // Add the new text
            result.push_str(text);
        }
    }
    
    // Add remaining lines after the change
    for (i, line) in lines.iter().enumerate() {
        if i > end_line {
            result.push('\n');
            result.push_str(line);
        } else if i == end_line && end_col <= line.len() {
            // Note: This is simplified, proper implementation would handle multi-line changes
            result.push_str(&line[end_col..]);
        }
    }
    
    result
}

/// Create the LSP service
pub fn create_lsp_service(config: LspConfig) -> (LspService<KyroLspBackend>, tower_lsp::ServerSocket) {
    LspService::new(|client| KyroLspBackend::new(client, config))
}

/// Start the LSP server on stdio
pub async fn start_stdio_server(config: LspConfig) {
    let (service, socket) = create_lsp_service(config);
    Server::new(tokio::io::stdin(), tokio::io::stdout(), socket)
        .serve(service)
        .await;
}
