//! LSP Client Implementation
//!
//! High-level LSP client that wraps the transport layer.

use std::collections::HashMap;
use serde_json::{json, Value};
use anyhow::{Result, Context};
use log::{debug, info};

use super::transport::{LspTransport, get_language_server_config};

/// LSP Client state
pub struct LspClient {
    language: String,
    transport: Option<LspTransport>,
    root_uri: Option<String>,
    initialized: bool,
}

impl LspClient {
    pub fn new(language: &str) -> Self {
        Self {
            language: language.to_string(),
            transport: None,
            root_uri: None,
            initialized: false,
        }
    }
    
    /// Start the language server
    pub async fn start(&mut self, root_uri: &str) -> Result<()> {
        let config = get_language_server_config(&self.language)
            .context(format!("No language server configured for: {}", self.language))?;
        
        let mut transport = LspTransport::new(config)?;
        
        // Initialize with full capabilities
        let capabilities = json!({
            "textDocument": {
                "synchronization": {
                    "dynamicRegistration": true,
                    "willSave": true,
                    "willSaveWaitUntil": true,
                    "didSave": true
                },
                "completion": {
                    "dynamicRegistration": true,
                    "completionItem": {
                        "snippetSupport": true,
                        "commitCharactersSupport": true,
                        "documentationFormat": ["markdown", "plaintext"],
                        "deprecatedSupport": true,
                        "preselectSupport": true,
                        "insertReplaceSupport": true,
                        "resolveSupport": {
                            "properties": ["documentation", "detail", "additionalTextEdits"]
                        },
                        "insertTextModeSupport": {
                            "valueSet": [1, 2]
                        }
                    },
                    "completionItemKind": {
                        "valueSet": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]
                    }
                },
                "hover": {
                    "dynamicRegistration": true,
                    "contentFormat": ["markdown", "plaintext"]
                },
                "signatureHelp": {
                    "dynamicRegistration": true,
                    "signatureInformation": {
                        "documentationFormat": ["markdown", "plaintext"],
                        "parameterInformation": {
                            "labelOffsetSupport": true
                        }
                    }
                },
                "definition": {
                    "dynamicRegistration": true,
                    "linkSupport": true
                },
                "references": {
                    "dynamicRegistration": true
                },
                "documentHighlight": {
                    "dynamicRegistration": true
                },
                "documentSymbol": {
                    "dynamicRegistration": true,
                    "symbolKind": {
                        "valueSet": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]
                    },
                    "hierarchicalDocumentSymbolSupport": true
                },
                "formatting": {
                    "dynamicRegistration": true
                },
                "rangeFormatting": {
                    "dynamicRegistration": true
                },
                "onTypeFormatting": {
                    "dynamicRegistration": true
                },
                "declaration": {
                    "dynamicRegistration": true,
                    "linkSupport": true
                },
                "implementation": {
                    "dynamicRegistration": true,
                    "linkSupport": true
                },
                "typeDefinition": {
                    "dynamicRegistration": true,
                    "linkSupport": true
                },
                "rename": {
                    "dynamicRegistration": true,
                    "prepareSupport": true
                },
                "codeAction": {
                    "dynamicRegistration": true,
                    "codeActionLiteralSupport": {
                        "codeActionKind": {
                            "valueSet": ["", "quickfix", "refactor", "refactor.extract", "refactor.inline", "refactor.rewrite", "source", "source.organizeImports"]
                        }
                    }
                },
                "codeLens": {
                    "dynamicRegistration": true
                },
                "semanticTokens": {
                    "dynamicRegistration": true,
                    "tokenTypes": [
                        "namespace", "type", "class", "enum", "interface",
                        "struct", "typeParameter", "parameter", "variable", "property",
                        "enumMember", "event", "function", "method", "macro",
                        "keyword", "modifier", "comment", "string", "number",
                        "regexp", "operator"
                    ],
                    "tokenModifiers": [
                        "declaration", "definition", "readonly", "static",
                        "deprecated", "abstract", "async", "modification",
                        "documentation", "defaultLibrary"
                    ],
                    "formats": ["relative"],
                    "requests": {
                        "range": true,
                        "full": {
                            "delta": true
                        }
                    }
                },
                "inlayHint": {
                    "dynamicRegistration": true,
                    "resolveSupport": {
                        "properties": ["textEdits", "tooltip", "label.command"]
                    }
                }
            },
            "workspace": {
                "symbol": {
                    "dynamicRegistration": true,
                    "symbolKind": {
                        "valueSet": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]
                    }
                },
                "workspaceFolders": true,
                "configuration": true
            }
        });
        
        transport.initialize(root_uri, capabilities).await?;
        
        self.transport = Some(transport);
        self.root_uri = Some(root_uri.to_string());
        self.initialized = true;
        
        info!("LSP client started for {} at {}", self.language, root_uri);
        Ok(())
    }
    
    /// Open a text document
    pub async fn open_document(&mut self, uri: &str, language_id: &str, text: &str) -> Result<()> {
        let transport = self.transport.as_mut().context("LSP not initialized")?;
        
        transport.send_notification("textDocument/didOpen", Some(json!({
            "textDocument": {
                "uri": uri,
                "languageId": language_id,
                "version": 1,
                "text": text
            }
        })))?;
        
        debug!("Opened document: {}", uri);
        Ok(())
    }
    
    /// Update document content
    pub async fn change_document(&mut self, uri: &str, version: u32, changes: Vec<Value>) -> Result<()> {
        let transport = self.transport.as_mut().context("LSP not initialized")?;
        
        transport.send_notification("textDocument/didChange", Some(json!({
            "textDocument": {
                "uri": uri,
                "version": version
            },
            "contentChanges": changes
        })))?;
        
        Ok(())
    }
    
    /// Save document
    pub async fn save_document(&mut self, uri: &str) -> Result<()> {
        let transport = self.transport.as_mut().context("LSP not initialized")?;
        
        transport.send_notification("textDocument/didSave", Some(json!({
            "textDocument": {
                "uri": uri
            }
        })))?;
        
        Ok(())
    }
    
    /// Close document
    pub async fn close_document(&mut self, uri: &str) -> Result<()> {
        let transport = self.transport.as_mut().context("LSP not initialized")?;
        
        transport.send_notification("textDocument/didClose", Some(json!({
            "textDocument": {
                "uri": uri
            }
        })))?;
        
        debug!("Closed document: {}", uri);
        Ok(())
    }
    
    /// Get completions
    pub async fn get_completions(&mut self, uri: &str, line: u32, character: u32) -> Result<Value> {
        let transport = self.transport.as_mut().context("LSP not initialized")?;
        
        transport.send_request("textDocument/completion", Some(json!({
            "textDocument": {
                "uri": uri
            },
            "position": {
                "line": line,
                "character": character
            }
        }))).await
    }
    
    /// Get hover info
    pub async fn get_hover(&mut self, uri: &str, line: u32, character: u32) -> Result<Value> {
        let transport = self.transport.as_mut().context("LSP not initialized")?;
        
        transport.send_request("textDocument/hover", Some(json!({
            "textDocument": {
                "uri": uri
            },
            "position": {
                "line": line,
                "character": character
            }
        }))).await
    }
    
    /// Go to definition
    pub async fn goto_definition(&mut self, uri: &str, line: u32, character: u32) -> Result<Value> {
        let transport = self.transport.as_mut().context("LSP not initialized")?;
        
        transport.send_request("textDocument/definition", Some(json!({
            "textDocument": {
                "uri": uri
            },
            "position": {
                "line": line,
                "character": character
            }
        }))).await
    }
    
    /// Find references
    pub async fn find_references(&mut self, uri: &str, line: u32, character: u32, include_declaration: bool) -> Result<Value> {
        let transport = self.transport.as_mut().context("LSP not initialized")?;
        
        transport.send_request("textDocument/references", Some(json!({
            "textDocument": {
                "uri": uri
            },
            "position": {
                "line": line,
                "character": character
            },
            "context": {
                "includeDeclaration": include_declaration
            }
        }))).await
    }
    
    /// Rename symbol
    pub async fn rename(&mut self, uri: &str, line: u32, character: u32, new_name: &str) -> Result<Value> {
        let transport = self.transport.as_mut().context("LSP not initialized")?;
        
        transport.send_request("textDocument/rename", Some(json!({
            "textDocument": {
                "uri": uri
            },
            "position": {
                "line": line,
                "character": character
            },
            "newName": new_name
        }))).await
    }
    
    /// Format document
    pub async fn format_document(&mut self, uri: &str, tab_size: u32, insert_spaces: bool) -> Result<Value> {
        let transport = self.transport.as_mut().context("LSP not initialized")?;
        
        transport.send_request("textDocument/formatting", Some(json!({
            "textDocument": {
                "uri": uri
            },
            "options": {
                "tabSize": tab_size,
                "insertSpaces": insert_spaces
            }
        }))).await
    }
    
    /// Get code actions
    pub async fn get_code_actions(&mut self, uri: &str, start_line: u32, start_char: u32, end_line: u32, end_char: u32) -> Result<Value> {
        let transport = self.transport.as_mut().context("LSP not initialized")?;
        
        transport.send_request("textDocument/codeAction", Some(json!({
            "textDocument": {
                "uri": uri
            },
            "range": {
                "start": {
                    "line": start_line,
                    "character": start_char
                },
                "end": {
                    "line": end_line,
                    "character": end_char
                }
            }
        }))).await
    }
    
    /// Get semantic tokens
    pub async fn get_semantic_tokens(&mut self, uri: &str) -> Result<Value> {
        let transport = self.transport.as_mut().context("LSP not initialized")?;
        
        transport.send_request("textDocument/semanticTokens/full", Some(json!({
            "textDocument": {
                "uri": uri
            }
        }))).await
    }
    
    /// Get semantic tokens delta
    pub async fn get_semantic_tokens_delta(&mut self, uri: &str, previous_result_id: &str) -> Result<Value> {
        let transport = self.transport.as_mut().context("LSP not initialized")?;
        
        transport.send_request("textDocument/semanticTokens/full/delta", Some(json!({
            "textDocument": {
                "uri": uri
            },
            "previousResultId": previous_result_id
        }))).await
    }
    
    /// Get inlay hints
    pub async fn get_inlay_hints(&mut self, uri: &str, start_line: u32, end_line: u32) -> Result<Value> {
        let transport = self.transport.as_mut().context("LSP not initialized")?;
        
        transport.send_request("textDocument/inlayHint", Some(json!({
            "textDocument": {
                "uri": uri
            },
            "range": {
                "start": {
                    "line": start_line,
                    "character": 0
                },
                "end": {
                    "line": end_line,
                    "character": 0
                }
            }
        }))).await
    }
    
    /// Get code lens
    pub async fn get_code_lens(&mut self, uri: &str) -> Result<Value> {
        let transport = self.transport.as_mut().context("LSP not initialized")?;
        
        transport.send_request("textDocument/codeLens", Some(json!({
            "textDocument": {
                "uri": uri
            }
        }))).await
    }
    
    /// Shutdown the client
    pub async fn shutdown(&mut self) -> Result<()> {
        if let Some(mut transport) = self.transport.take() {
            transport.shutdown().await?;
        }
        self.initialized = false;
        Ok(())
    }
    
    /// Check if initialized
    pub fn is_initialized(&self) -> bool {
        self.initialized
    }
    
    /// Get language
    pub fn language(&self) -> &str {
        &self.language
    }
}

/// LSP Client Manager - manages multiple language servers
pub struct LspClientManager {
    clients: HashMap<String, LspClient>,
}

impl LspClientManager {
    pub fn new() -> Self {
        Self {
            clients: HashMap::new(),
        }
    }
    
    pub async fn get_or_create(&mut self, language: &str, root_uri: &str) -> Result<&mut LspClient> {
        if !self.clients.contains_key(language) {
            let mut client = LspClient::new(language);
            client.start(root_uri).await?;
            self.clients.insert(language.to_string(), client);
        }
        self.clients.get_mut(language)
            .ok_or_else(|| anyhow::anyhow!("Failed to get LSP client for language: {}", language))
    }
    
    pub async fn shutdown_all(&mut self) {
        for (_, client) in self.clients.iter_mut() {
            let _ = client.shutdown().await;
        }
        self.clients.clear();
    }
}
