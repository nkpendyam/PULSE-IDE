//! LSP Dispatcher - Event dispatcher for LSP messages
//!
//! Routes LSP notifications and responses to appropriate handlers

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use serde_json::Value;
use log::{debug, info, warn};

/// LSP event types
#[derive(Debug, Clone)]
pub enum LspEvent {
    /// Diagnostics published
    Diagnostics { uri: String, diagnostics: Value },
    /// Log message from server
    LogMessage { level: String, message: String },
    /// Show message from server
    ShowMessage { level: String, message: String },
    /// Server status changed
    ServerStatus { language: String, status: String },
    /// Semantic tokens refresh
    SemanticTokensRefresh,
    /// Inlay hints refresh
    InlayHintsRefresh,
    /// Code lens refresh
    CodeLensRefresh,
    /// Configuration changed
    ConfigurationChanged { section: String },
    /// Workspace folders changed
    WorkspaceFoldersChanged,
    /// Custom event
    Custom { event_type: String, data: Value },
}

/// LSP event handler trait
pub trait LspEventHandler: Send + Sync {
    fn handle(&self, event: LspEvent);
}

/// Type-erased handler
type BoxedHandler = Box<dyn LspEventHandler>;

/// Function handler wrapper
struct FnHandler<F>(F);

impl<F: Fn(LspEvent) + Send + Sync> LspEventHandler for FnHandler<F> {
    fn handle(&self, event: LspEvent) {
        (self.0)(event);
    }
}

/// LSP Event Dispatcher
pub struct LspDispatcher {
    handlers: HashMap<String, Vec<BoxedHandler>>,
    broadcast_tx: broadcast::Sender<LspEvent>,
}

impl LspDispatcher {
    pub fn new() -> Self {
        let (broadcast_tx, _) = broadcast::channel(256);
        Self {
            handlers: HashMap::new(),
            broadcast_tx,
        }
    }
    
    /// Subscribe to all events via broadcast channel
    pub fn subscribe(&self) -> broadcast::Receiver<LspEvent> {
        self.broadcast_tx.subscribe()
    }
    
    /// Register handler for specific event type
    pub fn on<F: Fn(LspEvent) + Send + Sync + 'static>(&mut self, event_type: &str, handler: F) {
        let handlers = self.handlers.entry(event_type.to_string()).or_default();
        handlers.push(Box::new(FnHandler(handler)));
    }
    
    /// Dispatch an event to all registered handlers
    pub fn dispatch(&self, event: LspEvent) {
        let event_type = match &event {
            LspEvent::Diagnostics { .. } => "diagnostics",
            LspEvent::LogMessage { .. } => "logMessage",
            LspEvent::ShowMessage { .. } => "showMessage",
            LspEvent::ServerStatus { .. } => "serverStatus",
            LspEvent::SemanticTokensRefresh => "semanticTokensRefresh",
            LspEvent::InlayHintsRefresh => "inlayHintsRefresh",
            LspEvent::CodeLensRefresh => "codeLensRefresh",
            LspEvent::ConfigurationChanged { .. } => "configurationChanged",
            LspEvent::WorkspaceFoldersChanged => "workspaceFoldersChanged",
            LspEvent::Custom { event_type, .. } => event_type.as_str(),
        };
        
        // Broadcast to subscribers
        let _ = self.broadcast_tx.send(event.clone());
        
        // Call specific handlers
        if let Some(handlers) = self.handlers.get(event_type) {
            for handler in handlers {
                handler.handle(event.clone());
            }
        }
        
        // Call global handlers
        if let Some(handlers) = self.handlers.get("*") {
            for handler in handlers {
                handler.handle(event.clone());
            }
        }
    }
    
    /// Handle LSP notification
    pub fn handle_notification(&self, method: &str, params: Value) {
        debug!("Handling LSP notification: {}", method);
        
        match method {
            "textDocument/publishDiagnostics" => {
                if let Some(uri) = params.get("uri").and_then(|u| u.as_str()) {
                    if let Some(diagnostics) = params.get("diagnostics").cloned() {
                        self.dispatch(LspEvent::Diagnostics {
                            uri: uri.to_string(),
                            diagnostics,
                        });
                    }
                }
            }
            "window/logMessage" => {
                let level = params.get("type")
                    .and_then(|t| t.as_u64())
                    .map(|t| match t {
                        1 => "error",
                        2 => "warning",
                        3 => "info",
                        _ => "log",
                    })
                    .unwrap_or("log")
                    .to_string();
                let message = params.get("message")
                    .and_then(|m| m.as_str())
                    .unwrap_or("")
                    .to_string();
                self.dispatch(LspEvent::LogMessage { level, message });
            }
            "window/showMessage" => {
                let level = params.get("type")
                    .and_then(|t| t.as_u64())
                    .map(|t| match t {
                        1 => "error",
                        2 => "warning",
                        3 => "info",
                        _ => "log",
                    })
                    .unwrap_or("log")
                    .to_string();
                let message = params.get("message")
                    .and_then(|m| m.as_str())
                    .unwrap_or("")
                    .to_string();
                self.dispatch(LspEvent::ShowMessage { level, message });
            }
            "workspace/semanticTokens/refresh" => {
                self.dispatch(LspEvent::SemanticTokensRefresh);
            }
            "workspace/inlayHint/refresh" => {
                self.dispatch(LspEvent::InlayHintsRefresh);
            }
            "workspace/codeLens/refresh" => {
                self.dispatch(LspEvent::CodeLensRefresh);
            }
            "workspace/didChangeConfiguration" => {
                let section = params.get("section")
                    .and_then(|s| s.as_str())
                    .unwrap_or("")
                    .to_string();
                self.dispatch(LspEvent::ConfigurationChanged { section });
            }
            "workspace/didChangeWorkspaceFolders" => {
                self.dispatch(LspEvent::WorkspaceFoldersChanged);
            }
            _ => {
                self.dispatch(LspEvent::Custom {
                    event_type: method.to_string(),
                    data: params,
                });
            }
        }
    }
}

impl Default for LspDispatcher {
    fn default() -> Self {
        Self::new()
    }
}

/// Shared dispatcher type
pub type SharedDispatcher = Arc<RwLock<LspDispatcher>>;

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_dispatcher_routes_diagnostics() {
        let mut dispatcher = LspDispatcher::new();
        let mut received = Vec::new();
        
        let received_clone = Arc::new(RwLock::new(Vec::new()));
        let received_clone2 = received_clone.clone();
        
        dispatcher.on("diagnostics", move |event| {
            if let LspEvent::Diagnostics { uri, .. } = event {
                received_clone2.try_write().unwrap().push(uri);
            }
        });
        
        dispatcher.handle_notification("textDocument/publishDiagnostics", serde_json::json!({
            "uri": "file:///test.rs",
            "diagnostics": []
        }));
        
        assert!(received_clone.try_read().unwrap().contains(&"file:///test.rs".to_string()));
    }
}
