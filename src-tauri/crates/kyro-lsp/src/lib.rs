//! Kyro LSP - Language Server Protocol manager
//!
//! Provides LSP integration for 165+ programming languages using
//! tower-lsp and tree-sitter.

#![allow(dead_code, unused_variables, unused_imports)]
//!
//! # Features
//!
//! - Process lifecycle management (start, stop, restart)
//! - Automatic crash detection and recovery
//! - Support for 165+ languages via LSP servers
//! - Thread-safe server instance management with DashMap
//! - Cross-platform support (Windows, macOS, Linux)
//!
//! # Example
//!
//! ```no_run
//! use kyro_lsp::LspManager;
//! use lsp_types::Url;
//!
//! #[tokio::main]
//! async fn main() {
//!     let manager = LspManager::new();
//!     
//!     // Start a Rust LSP server
//!     let root_uri = Url::parse("file:///path/to/project").ok();
//!     manager.start_server("rust", root_uri).await.unwrap();
//!     
//!     // Get the server instance
//!     if let Some(server) = manager.get_server("rust") {
//!         println!("Server state: {:?}", server.state().await);
//!     }
//!     
//!     // Stop the server
//!     manager.stop_server("rust").await.unwrap();
//! }
//! ```

pub mod manager;
pub mod server;

pub use manager::LspManager;
pub use server::{LspServer, ServerConfig, ServerState};

// Re-export commonly used types from lsp-types
pub use lsp_types::{
    CompletionItem, CompletionParams, Diagnostic, GotoDefinitionParams, Hover, HoverParams,
    Location, Position, ServerCapabilities, TextDocumentIdentifier, TextEdit, Url,
};
