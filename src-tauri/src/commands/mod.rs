//! KRO IDE Tauri Commands Module
//!
//! Exposes all backend functionality to the frontend

// Core commands
pub mod fs;
pub mod terminal;
pub mod git;
pub mod lsp;

// AI commands
pub mod ai;
pub mod embedded_llm;

// Security commands
pub mod auth;
pub mod e2ee;

// Collaboration commands
pub mod collaboration;
pub mod websocket;

// Extension commands
pub mod vscode_compat;

// Agent commands
pub mod mcp;
pub mod swarm;

// Plugin commands
pub mod plugin;

// System commands
pub mod update;

// RAG commands
pub mod rag;

// Git CRDT commands  
pub mod gitcrdt;

// Enhanced LSP commands
pub mod lsp_real;

// Chat Sidebar and Agent Editor commands (Killer Features)
pub mod chat_agent;
