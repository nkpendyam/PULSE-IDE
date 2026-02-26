//! Tauri Commands for Chat Sidebar and Agent Editor
//!
//! Exposes chat and agent functionality to the frontend

use crate::chat_sidebar::{
    ChatConfig, ChatMessage, ChatResponse, ChatSession, CodeSnippet,
    RAGChatEngine, StreamChunk, ChatRole,
};
use crate::agent_editor::{
    AgentConfig, AgentContext, AgentResult, MCPAgent, AgentAction,
    ApprovalStatus, EditOperation, FileEdit,
};
use crate::embedded_llm::EmbeddedLLMEngine;
use crate::rag::vector_store::HnswVectorStore;

use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use tauri::State;
use anyhow::Result;

/// Global state for chat and agent
pub struct ChatAgentState {
    pub chat_engine: Option<Arc<RwLock<RAGChatEngine>>>,
    pub agent: Option<Arc<RwLock<MCPAgent>>>,
    pub llm: Option<Arc<RwLock<EmbeddedLLMEngine>>>,
    pub vector_store: Option<Arc<RwLock<HnswVectorStore>>>,
    pub sessions: Arc<RwLock<HashMap<String, ChatSession>>>,
}

impl Default for ChatAgentState {
    fn default() -> Self {
        Self {
            chat_engine: None,
            agent: None,
            llm: None,
            vector_store: None,
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

// ============== Chat Commands ==============

/// Create a new chat session
#[tauri::command]
pub async fn create_chat_session(
    project_path: String,
    state: State<'_, ChatAgentState>,
) -> Result<String, String> {
    let session = ChatSession {
        project_path,
        ..Default::default()
    };

    let id = session.id.clone();
    state.sessions.write().await.insert(id.clone(), session);

    Ok(id)
}

/// Get chat session
#[tauri::command]
pub async fn get_chat_session(
    session_id: String,
    state: State<'_, ChatAgentState>,
) -> Result<ChatSession, String> {
    state.sessions.read().await
        .get(&session_id)
        .cloned()
        .ok_or_else(|| "Session not found".to_string())
}

/// Send a message with RAG context
#[tauri::command]
pub async fn rag_chat(
    session_id: String,
    message: String,
    context: ChatContextInput,
    state: State<'_, ChatAgentState>,
) -> Result<ChatResponseData, String> {
    // Get or create session
    let mut sessions = state.sessions.write().await;
    let session = sessions.get_mut(&session_id)
        .ok_or_else(|| "Session not found".to_string())?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    // Create user message
    let user_msg = ChatMessage {
        id: uuid::Uuid::new_v4().to_string(),
        role: ChatRole::User,
        content: message.clone(),
        timestamp,
        code_context: None,
        metadata: HashMap::new(),
    };
    session.messages.push(user_msg);

    // Build context
    let current_file = context.current_file.map(|f| CodeSnippet {
        file_path: f.file_path,
        start_line: f.start_line.unwrap_or(1),
        end_line: f.end_line.unwrap_or(1),
        content: f.content,
        language: f.language.unwrap_or_else(|| "text".to_string()),
    });

    let open_files: Vec<CodeSnippet> = context.open_files.into_iter()
        .map(|f| CodeSnippet {
            file_path: f.file_path,
            start_line: f.start_line.unwrap_or(1),
            end_line: f.end_line.unwrap_or(1),
            content: f.content,
            language: f.language.unwrap_or_else(|| "text".to_string()),
        })
        .collect();

    // Simulate RAG-enhanced response
    // In production, this would call the actual RAG engine
    let response_text = generate_response(&message, &current_file, &open_files);

    // Create assistant message
    let assistant_msg = ChatMessage {
        id: uuid::Uuid::new_v4().to_string(),
        role: ChatRole::Assistant,
        content: response_text.clone(),
        timestamp,
        code_context: None,
        metadata: HashMap::new(),
    };
    session.messages.push(assistant_msg.clone());

    Ok(ChatResponseData {
        message: ChatMessageData::from(assistant_msg),
        rag_sources: vec![],
        tokens_used: 100,
        time_to_first_token_ms: 50,
        total_time_ms: 500,
        from_cache: false,
    })
}

/// Clear chat session
#[tauri::command]
pub async fn clear_chat_session(
    session_id: String,
    state: State<'_, ChatAgentState>,
) -> Result<(), String> {
    let mut sessions = state.sessions.write().await;
    if let Some(session) = sessions.get_mut(&session_id) {
        session.messages.clear();
    }
    Ok(())
}

// ============== Agent Commands ==============

/// Send agent command
#[tauri::command]
pub async fn agent_command(
    command: String,
    context: AgentContextInput,
    state: State<'_, ChatAgentState>,
) -> Result<AgentResultData, String> {
    // Parse command and create actions
    let actions = parse_agent_command(&command, &context);

    let requires_approval = actions.iter().any(|a| {
        matches!(a.action_type, "write_file" | "edit_file" | "delete_file" | "create_file")
    });

    let approval_id = if requires_approval {
        Some(uuid::Uuid::new_v4().to_string())
    } else {
        None
    };

    let files_changed: Vec<String> = actions.iter()
        .filter_map(|a| a.target_file.clone())
        .collect();

    Ok(AgentResultData {
        success: true,
        action: actions.first().cloned().unwrap_or_else(|| AgentActionData {
            id: uuid::Uuid::new_v4().to_string(),
            action_type: "read_file".to_string(),
            description: "No action needed".to_string(),
            target_file: None,
            edits: vec![],
            confidence: 1.0,
            reasoning: "Command processed".to_string(),
        }),
        message: format!("Processed command: {}", command),
        files_changed,
        requires_approval,
        approval_id,
    })
}

/// Approve pending edit
#[tauri::command]
pub async fn agent_approve(
    approval_id: String,
    state: State<'_, ChatAgentState>,
) -> Result<(), String> {
    // In production, this would execute the pending actions
    log::info!("Approved edit: {}", approval_id);
    Ok(())
}

/// Reject pending edit
#[tauri::command]
pub async fn agent_reject(
    approval_id: String,
    state: State<'_, ChatAgentState>,
) -> Result<(), String> {
    log::info!("Rejected edit: {}", approval_id);
    Ok(())
}

/// Quick fix command
#[tauri::command]
pub async fn agent_quick_fix(
    file_path: String,
    description: String,
    state: State<'_, ChatAgentState>,
) -> Result<AgentResultData, String> {
    let command = format!("Fix in {}: {}", file_path, description);

    let actions = vec![
        AgentActionData {
            id: uuid::Uuid::new_v4().to_string(),
            action_type: "read_file".to_string(),
            description: format!("Read {}", file_path),
            target_file: Some(file_path.clone()),
            edits: vec![],
            confidence: 1.0,
            reasoning: "Reading file before fix".to_string(),
        },
        AgentActionData {
            id: uuid::Uuid::new_v4().to_string(),
            action_type: "edit_file".to_string(),
            description: description.clone(),
            target_file: Some(file_path.clone()),
            edits: vec![],
            confidence: 0.85,
            reasoning: "Applying fix".to_string(),
        },
    ];

    Ok(AgentResultData {
        success: true,
        action: actions[1].clone(),
        message: format!("Quick fix planned for {}", file_path),
        files_changed: vec![file_path],
        requires_approval: true,
        approval_id: Some(uuid::Uuid::new_v4().to_string()),
    })
}

// ============== Helper Functions ==============

/// Generate a simulated response (in production, uses actual LLM)
fn generate_response(message: &str, current_file: &Option<CodeSnippet>, open_files: &[CodeSnippet]) -> String {
    let mut response = String::new();

    // Add context awareness
    if let Some(file) = current_file {
        response.push_str(&format!(
            "I can see you're working on `{}`. ",
            file.file_path
        ));
    }

    if !open_files.is_empty() {
        response.push_str(&format!(
            "I have access to {} open file(s) for context. ",
            open_files.len()
        ));
    }

    // Analyze message
    let message_lower = message.to_lowercase();

    if message_lower.contains("fix") || message_lower.contains("bug") {
        response.push_str("\n\nTo help fix this issue, I can:\n");
        response.push_str("1. Analyze the code for potential bugs\n");
        response.push_str("2. Suggest fixes with explanations\n");
        response.push_str("3. Apply the fix (with your approval)\n\n");
        response.push_str("What specific issue are you experiencing?");
    } else if message_lower.contains("explain") {
        response.push_str("\n\nLet me explain the code:\n\n");
        if let Some(file) = current_file {
            response.push_str(&format!("In `{}`:\n", file.file_path));
            response.push_str("The code implements functionality that can be broken down into key components.\n");
            response.push_str("Would you like me to explain a specific part in detail?");
        }
    } else if message_lower.contains("refactor") {
        response.push_str("\n\nFor refactoring, I can help you:\n");
        response.push_str("1. Identify code smells and improvement opportunities\n");
        response.push_str("2. Suggest cleaner patterns and better structure\n");
        response.push_str("3. Apply refactoring changes safely\n\n");
        response.push_str("What would you like to improve?");
    } else if message_lower.contains("test") {
        response.push_str("\n\nI can help you write tests:\n");
        response.push_str("1. Unit tests for individual functions\n");
        response.push_str("2. Integration tests for component interactions\n");
        response.push_str("3. Edge case coverage\n\n");
        response.push_str("Which type of tests would you like?");
    } else {
        response.push_str("\n\nHow can I help you with your code? I can:\n");
        response.push_str("- Fix bugs and errors\n");
        response.push_str("- Explain code behavior\n");
        response.push_str("- Refactor for better quality\n");
        response.push_str("- Add tests and documentation\n");
        response.push_str("- Search for relevant code across your project");
    }

    response
}

/// Parse agent command into actions
fn parse_agent_command(command: &str, context: &AgentContextInput) -> Vec<AgentActionData> {
    let mut actions = Vec::new();

    let command_lower = command.to_lowercase();

    if command_lower.contains("fix") {
        if let Some(file) = &context.current_file {
            actions.push(AgentActionData {
                id: uuid::Uuid::new_v4().to_string(),
                action_type: "read_file".to_string(),
                description: format!("Read {}", file),
                target_file: Some(file.clone()),
                edits: vec![],
                confidence: 1.0,
                reasoning: "Reading file to understand context".to_string(),
            });

            actions.push(AgentActionData {
                id: uuid::Uuid::new_v4().to_string(),
                action_type: "edit_file".to_string(),
                description: "Apply fix".to_string(),
                target_file: Some(file.clone()),
                edits: vec![],
                confidence: 0.85,
                reasoning: "Applying bug fix".to_string(),
            });
        }
    } else if command_lower.contains("add") || command_lower.contains("implement") {
        if let Some(file) = &context.current_file {
            actions.push(AgentActionData {
                id: uuid::Uuid::new_v4().to_string(),
                action_type: "edit_file".to_string(),
                description: "Add new functionality".to_string(),
                target_file: Some(file.clone()),
                edits: vec![],
                confidence: 0.9,
                reasoning: "Adding requested feature".to_string(),
            });
        }
    } else if command_lower.contains("refactor") {
        if let Some(file) = &context.current_file {
            actions.push(AgentActionData {
                id: uuid::Uuid::new_v4().to_string(),
                action_type: "edit_file".to_string(),
                description: "Refactor code".to_string(),
                target_file: Some(file.clone()),
                edits: vec![],
                confidence: 0.85,
                reasoning: "Improving code structure".to_string(),
            });
        }
    } else if command_lower.contains("create") || command_lower.contains("new") {
        actions.push(AgentActionData {
            id: uuid::Uuid::new_v4().to_string(),
            action_type: "create_file".to_string(),
            description: "Create new file".to_string(),
            target_file: None,
            edits: vec![],
            confidence: 0.9,
            reasoning: "Creating new file".to_string(),
        });
    }

    if actions.is_empty() {
        actions.push(AgentActionData {
            id: uuid::Uuid::new_v4().to_string(),
            action_type: "open_file".to_string(),
            description: "Open file for review".to_string(),
            target_file: context.current_file.clone(),
            edits: vec![],
            confidence: 0.5,
            reasoning: "Need more information to proceed".to_string(),
        });
    }

    actions
}

// ============== Data Transfer Objects ==============

/// Chat context input from frontend
#[derive(Debug, Deserialize)]
pub struct ChatContextInput {
    pub current_file: Option<FileInput>,
    pub open_files: Vec<FileInput>,
}

/// File input from frontend
#[derive(Debug, Deserialize)]
pub struct FileInput {
    pub file_path: String,
    pub content: String,
    pub language: Option<String>,
    pub start_line: Option<usize>,
    pub end_line: Option<usize>,
}

/// Agent context input from frontend
#[derive(Debug, Deserialize)]
pub struct AgentContextInput {
    pub project_path: String,
    pub current_file: Option<String>,
    pub open_files: Vec<String>,
}

/// Chat response data for frontend
#[derive(Debug, Serialize)]
pub struct ChatResponseData {
    pub message: ChatMessageData,
    pub rag_sources: Vec<RagSourceData>,
    pub tokens_used: usize,
    pub time_to_first_token_ms: u64,
    pub total_time_ms: u64,
    pub from_cache: bool,
}

/// Chat message data for frontend
#[derive(Debug, Serialize)]
pub struct ChatMessageData {
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: u64,
}

impl From<ChatMessage> for ChatMessageData {
    fn from(msg: ChatMessage) -> Self {
        Self {
            id: msg.id,
            role: match msg.role {
                ChatRole::User => "user",
                ChatRole::Assistant => "assistant",
                ChatRole::System => "system",
            }.to_string(),
            content: msg.content,
            timestamp: msg.timestamp,
        }
    }
}

/// RAG source data for frontend
#[derive(Debug, Serialize)]
pub struct RagSourceData {
    pub file_path: String,
    pub start_line: usize,
    pub end_line: usize,
    pub score: f32,
    pub preview: String,
}

/// Agent result data for frontend
#[derive(Debug, Serialize)]
pub struct AgentResultData {
    pub success: bool,
    pub action: AgentActionData,
    pub message: String,
    pub files_changed: Vec<String>,
    pub requires_approval: bool,
    pub approval_id: Option<String>,
}

/// Agent action data for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentActionData {
    pub id: String,
    pub action_type: String,
    pub description: String,
    pub target_file: Option<String>,
    pub edits: Vec<EditOperationData>,
    pub confidence: f32,
    pub reasoning: String,
}

/// Edit operation data for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditOperationData {
    pub start_line: usize,
    pub end_line: usize,
    pub new_content: String,
}
