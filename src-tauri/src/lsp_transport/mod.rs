//! Real LSP Transport Layer
//!
//! Implements actual LSP client communication via stdio and socket transports.
//! Based on the LSP specification and tower-lsp patterns.

pub mod client;
pub mod code_lens;
pub mod dispatcher;
pub mod inlay_hints;
pub mod semantic_tokens;
pub mod transport;
