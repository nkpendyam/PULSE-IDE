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

// Extension commands
pub mod vscode_compat;

// Agent commands
pub mod mcp;
pub mod swarm;

// Plugin commands
pub mod plugin;

// System commands
pub mod update;
