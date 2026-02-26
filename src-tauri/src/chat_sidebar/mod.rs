//! Chat Sidebar with Code-Aware AI
//!
//! This is the "Killer Feature" - a chat sidebar that knows your code.
//! Uses embedded llama.cpp for offline inference + RAG for code awareness.
//!
//! ## Features
//! - Works completely offline (no internet required)
//! - Knows your entire codebase via RAG
//! - Context-aware responses based on current file
//! - Streaming responses for real-time feedback
//! - Code suggestions with diffs

pub mod rag_chat;
pub mod context_builder;
pub mod code_aware;
pub mod streaming;

pub use rag_chat::RAGChatEngine;
pub use context_builder::ContextBuilder;
pub use code_aware::CodeAwareChat;
pub use streaming::StreamingResponder;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Chat message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub role: ChatRole,
    pub content: String,
    pub timestamp: u64,
    pub code_context: Option<CodeContext>,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Chat role
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ChatRole {
    User,
    Assistant,
    System,
}

/// Code context attached to messages
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeContext {
    /// File paths mentioned
    pub files: Vec<String>,
    /// Code snippets
    pub snippets: Vec<CodeSnippet>,
    /// Symbols referenced
    pub symbols: Vec<SymbolReference>,
    /// RAG search results used
    pub rag_sources: Vec<RagSource>,
}

/// Code snippet
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeSnippet {
    pub file_path: String,
    pub start_line: usize,
    pub end_line: usize,
    pub content: String,
    pub language: String,
}

/// Symbol reference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymbolReference {
    pub name: String,
    pub kind: String,
    pub file_path: String,
    pub line: usize,
}

/// RAG source citation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RagSource {
    pub file_path: String,
    pub start_line: usize,
    pub end_line: usize,
    pub score: f32,
    pub preview: String,
}

/// Chat session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSession {
    pub id: String,
    pub created_at: u64,
    pub updated_at: u64,
    pub messages: Vec<ChatMessage>,
    pub project_path: String,
    pub model: String,
    pub temperature: f32,
    pub max_context_files: usize,
}

impl Default for ChatSession {
    fn default() -> Self {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            created_at: timestamp,
            updated_at: timestamp,
            messages: Vec::new(),
            project_path: String::new(),
            model: "qwen3-4b-q4_k_m".to_string(),
            temperature: 0.7,
            max_context_files: 10,
        }
    }
}

/// Chat configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatConfig {
    /// Enable RAG context retrieval
    pub enable_rag: bool,
    /// Number of RAG results to include
    pub rag_results_count: usize,
    /// Include current file in context
    pub include_current_file: bool,
    /// Include open files in context
    pub include_open_files: bool,
    /// Max context tokens
    pub max_context_tokens: usize,
    /// System prompt for code assistant
    pub system_prompt: String,
    /// Enable streaming responses
    pub streaming: bool,
    /// Show thinking process
    pub show_thinking: bool,
}

impl Default for ChatConfig {
    fn default() -> Self {
        Self {
            enable_rag: true,
            rag_results_count: 5,
            include_current_file: true,
            include_open_files: true,
            max_context_tokens: 4096,
            system_prompt: include_str!("prompts/code_assistant.txt").to_string(),
            streaming: true,
            show_thinking: false,
        }
    }
}

/// Chat response with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    pub message: ChatMessage,
    pub rag_sources: Vec<RagSource>,
    pub tokens_used: usize,
    pub time_to_first_token_ms: u64,
    pub total_time_ms: u64,
    pub from_cache: bool,
}

/// Streaming chunk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamChunk {
    pub session_id: String,
    pub message_id: String,
    pub delta: String,
    pub is_thinking: bool,
    pub is_done: bool,
    pub rag_sources: Vec<RagSource>,
}
