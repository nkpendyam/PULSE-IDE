//! KRO_IDE - GPU-Accelerated AI-Native Code Editor
//!
//! A zero-dependency, privacy-first IDE with embedded LLM, MCP agent swarm,
//! and real-time collaboration capabilities.

// ============ Core Modules ============
pub mod commands;
pub mod ai;
pub mod terminal;
pub mod files;
pub mod git;
pub mod lsp;

// ============ AI Modules ============
pub mod swarm_ai;
pub mod embedded_llm;
pub mod mcp;
pub mod rag;

// ============ Collaboration Modules ============
pub mod git_crdt;

// ============ Platform Modules ============
pub mod virtual_pico;
pub mod telegram;

// ============ Verification Modules ============
pub mod symbolic_verify;

// ============ Agent System ============
pub mod agents;

// ============ Infrastructure Modules ============
pub mod update;
pub mod plugin_sandbox;
pub mod telemetry;
pub mod accessibility;
pub mod benchmark;

// ============ VS Code Compatibility ============
pub mod vscode_compat;

// ============ Tower-LSP Integration ============
pub mod lsp_tower;

// ============ Collaboration (based on Conflux) ============
pub mod collaboration;

// ============ AI Inference (based on Candle) ============
pub mod inference;

// ============ Text Buffer (based on Ropey) ============
pub mod buffer;

// ============ Authentication (JWT + OAuth) ============
pub mod auth;

// ============ End-to-End Encryption (Signal Protocol) ============
pub mod e2ee;
