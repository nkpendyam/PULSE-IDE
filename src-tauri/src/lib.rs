//! KRO_IDE - GPU-Accelerated AI-Native Code Editor
//!
//! A zero-dependency, privacy-first IDE with embedded LLM, MCP agent swarm,
//! and real-time collaboration capabilities.
//!
//! ## Strategic Vision
//! "AI that happens to have an IDE attached"
//!
//! ## Differentiation
//! - Local-First AI: Completely offline, privacy-respecting
//! - Agent Permission System: Trust layer for AI operations
//! - Hierarchical Memory: True codebase understanding
//! - Autonomous Coding: "Describe feature → get code in 30s"

// Early-stage project: many modules are stubs/scaffolding.
// These allows will be incrementally removed as modules mature.
#![allow(dead_code, unused_variables, unused_imports, unused_mut)]

// ============ Core Modules ============
pub mod ai;
pub mod commands;
pub mod files;
pub mod git;
pub mod lsp;
pub mod terminal;

// ============ AI Modules ============
pub mod embedded_llm;
pub mod mcp;
pub mod rag;
pub mod swarm_ai;

// ============ Collaboration Modules ============
pub mod git_crdt;

// ============ Platform Modules ============
pub mod telegram;

// ============ Verification Modules ============
// symbolic_verify module removed - incomplete feature

// ============ Agent System ============
pub mod agents;

// ============ Infrastructure Modules ============
pub mod accessibility;
pub mod benchmark;
pub mod plugin_sandbox;
pub mod telemetry;
pub mod update;

// ============ VS Code Compatibility ============
pub mod vscode_compat;

// ============ Extension System (Open VSX) ============
pub mod extensions;

// ============ Tower-LSP Integration ============
pub mod lsp_tower;

// ============ LSP Transport (Real Implementation) ============
pub mod lsp_transport;

// ============ Collaboration (CRDT-based) ============
pub mod collab;

// ============ Debug Adapter Protocol ============
pub mod debug;

// ============ Trust Layer (Critical) ============
pub mod trust;

// ============ Hierarchical Memory ============
pub mod memory;

// ============ Quality Control ============
pub mod quality;

// ============ Business Model ============
pub mod business;

// ============ Autonomous Agent ============
pub mod autonomous;

// ============ AI Inference (based on Candle) ============
pub mod inference;

// ============ Text Buffer (based on Ropey) ============
pub mod buffer;

// ============ Authentication (JWT + OAuth) ============
pub mod auth;

// ============ End-to-End Encryption (Signal Protocol) ============
pub mod e2ee;

// ============ Chat Sidebar with RAG (Killer Feature #1) ============
pub mod chat_sidebar;

// ============ MCP Agent Editor (Killer Feature #2) ============
pub mod agent_editor;

// ============ Agent Store (VECTOR_3: User-Controlled Agents) ============
pub mod agent_store;

// ============ P2P Collaboration (Phase 5) ============
pub mod p2p;

// ============ AirLLM Integration (Layer-wise Inference) ============
pub mod airllm;

// ============ PicoClaw Integration (Ultra-lightweight AI) ============
pub mod picoclaw;

// ============ Atoms of Thought (AoT Reasoning) ============
pub mod aot;

// ============ Orchestrator (Mission Control) ============
pub mod orchestrator;

// ============ Learning Flywheel (Feedback DB) ============
pub mod feedback;

// ============ RepoWiki (Auto-Documentation) ============
pub mod repowiki;
