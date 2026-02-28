//! RAG-Enhanced Chat Engine
//!
//! Combines embedded LLM with RAG vector store for code-aware conversations

use super::*;
use crate::embedded_llm::{EmbeddedLLMEngine, InferenceRequest, ConversationTurn};
use crate::rag::vector_store::{HnswVectorStore, VectorSearchResult, VectorMetadata};
use anyhow::{Result, Context};
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;
use std::time::Instant;

/// RAG-enhanced chat engine
pub struct RAGChatEngine {
    llm: Arc<RwLock<EmbeddedLLMEngine>>,
    vector_store: Arc<RwLock<HnswVectorStore>>,
    config: ChatConfig,
    sessions: Arc<RwLock<HashMap<String, ChatSession>>>,
}

impl RAGChatEngine {
    /// Create a new RAG chat engine
    pub fn new(
        llm: Arc<RwLock<EmbeddedLLMEngine>>,
        vector_store: Arc<RwLock<HnswVectorStore>>,
        config: ChatConfig,
    ) -> Self {
        Self {
            llm,
            vector_store,
            config,
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Create a new chat session
    pub async fn create_session(&self, project_path: String) -> Result<ChatSession> {
        let session = ChatSession {
            project_path,
            ..Default::default()
        };

        self.sessions.write().await.insert(session.id.clone(), session.clone());
        Ok(session)
    }

    /// Get existing session
    pub async fn get_session(&self, session_id: &str) -> Option<ChatSession> {
        self.sessions.read().await.get(session_id).cloned()
    }

    /// Send a message and get a response with RAG context
    pub async fn chat(
        &self,
        session_id: &str,
        user_message: &str,
        current_file: Option<&CodeSnippet>,
        open_files: &[CodeSnippet],
    ) -> Result<ChatResponse> {
        let start = Instant::now();

        // Get or create session
        let mut session = self.sessions.read().await
            .get(session_id)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("Session not found: {}", session_id))?;

        // Build context with RAG
        let (context, rag_sources) = self.build_context(user_message, current_file, open_files).await?;

        // Create user message with context
        let user_msg = ChatMessage {
            id: uuid::Uuid::new_v4().to_string(),
            role: ChatRole::User,
            content: user_message.to_string(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            code_context: Some(CodeContext {
                files: open_files.iter().map(|f| f.file_path.clone()).collect(),
                snippets: open_files.to_vec(),
                symbols: vec![],
                rag_sources: rag_sources.clone(),
            }),
            metadata: HashMap::new(),
        };

        session.messages.push(user_msg.clone());

        // Build conversation for LLM
        let conversation = self.build_conversation(&session, &context);

        // Create inference request
        let request = InferenceRequest {
            prompt: conversation,
            max_tokens: 1024,
            temperature: session.temperature,
            top_p: 0.9,
            top_k: 40,
            repeat_penalty: 1.1,
            stop_sequences: vec!["USER:".to_string(), "###".to_string()],
            stream: false,
            system_prompt: Some(self.config.system_prompt.clone()),
            history: session.messages.iter()
                .filter(|m| m.role != ChatRole::System)
                .map(|m| ConversationTurn {
                    role: match m.role {
                        ChatRole::User => "user".to_string(),
                        ChatRole::Assistant => "assistant".to_string(),
                        ChatRole::System => "system".to_string(),
                    },
                    content: m.content.clone(),
                })
                .collect(),
        };

        // Get LLM response
        let llm = self.llm.read().await;
        let response = llm.complete(&request).await?;
        drop(llm);

        let time_to_first_token = response.time_to_first_token_ms;

        // Create assistant message
        let assistant_msg = ChatMessage {
            id: uuid::Uuid::new_v4().to_string(),
            role: ChatRole::Assistant,
            content: response.text.clone(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            code_context: Some(CodeContext {
                files: vec![],
                snippets: vec![],
                symbols: vec![],
                rag_sources: rag_sources.clone(),
            }),
            metadata: HashMap::new(),
        };

        session.messages.push(assistant_msg.clone());
        session.updated_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        // Update session
        self.sessions.write().await.insert(session_id.to_string(), session);

        Ok(ChatResponse {
            message: assistant_msg,
            rag_sources,
            tokens_used: response.tokens_generated as usize,
            time_to_first_token_ms: time_to_first_token,
            total_time_ms: start.elapsed().as_millis() as u64,
            from_cache: response.from_cache,
        })
    }

    /// Stream a response with RAG context
    pub async fn chat_stream(
        &self,
        session_id: &str,
        user_message: &str,
        current_file: Option<&CodeSnippet>,
        open_files: &[CodeSnippet],
        mut callback: impl FnMut(StreamChunk) + Send + 'static,
    ) -> Result<ChatResponse> {
        let start = Instant::now();

        // Get or create session
        let mut session = self.sessions.read().await
            .get(session_id)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("Session not found: {}", session_id))?;

        // Build context with RAG
        let (context, rag_sources) = self.build_context(user_message, current_file, open_files).await?;

        // Create user message
        let user_msg = ChatMessage {
            id: uuid::Uuid::new_v4().to_string(),
            role: ChatRole::User,
            content: user_message.to_string(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            code_context: Some(CodeContext {
                files: open_files.iter().map(|f| f.file_path.clone()).collect(),
                snippets: open_files.to_vec(),
                symbols: vec![],
                rag_sources: rag_sources.clone(),
            }),
            metadata: HashMap::new(),
        };

        session.messages.push(user_msg.clone());

        // Create message ID for streaming
        let message_id = uuid::Uuid::new_v4().to_string();

        // Build conversation
        let conversation = self.build_conversation(&session, &context);

        // Create inference request
        let request = InferenceRequest {
            prompt: conversation,
            max_tokens: 1024,
            temperature: session.temperature,
            top_p: 0.9,
            top_k: 40,
            repeat_penalty: 1.1,
            stop_sequences: vec!["USER:".to_string(), "###".to_string()],
            stream: true,
            system_prompt: Some(self.config.system_prompt.clone()),
            history: session.messages.iter()
                .filter(|m| m.role != ChatRole::System)
                .map(|m| ConversationTurn {
                    role: match m.role {
                        ChatRole::User => "user".to_string(),
                        ChatRole::Assistant => "assistant".to_string(),
                        ChatRole::System => "system".to_string(),
                    },
                    content: m.content.clone(),
                })
                .collect(),
        };

        // Stream response
        let session_id_owned = session_id.to_string();
        let message_id_clone = message_id.clone();
        let rag_sources_clone = rag_sources.clone();

        let llm = self.llm.read().await;
        let response = llm.complete_stream(&request, move |token: &str| {
            callback(StreamChunk {
                session_id: session_id_owned.clone(),
                message_id: message_id_clone.clone(),
                delta: token.to_string(),
                is_thinking: false,
                is_done: false,
                rag_sources: vec![],
            });
        }).await?;
        drop(llm);

        // Send final chunk
        callback(StreamChunk {
            session_id: session_id.to_string(),
            message_id: message_id.clone(),
            delta: String::new(),
            is_thinking: false,
            is_done: true,
            rag_sources: rag_sources_clone,
        });

        // Create assistant message
        let assistant_msg = ChatMessage {
            id: message_id,
            role: ChatRole::Assistant,
            content: response.text.clone(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            code_context: Some(CodeContext {
                files: vec![],
                snippets: vec![],
                symbols: vec![],
                rag_sources: rag_sources.clone(),
            }),
            metadata: HashMap::new(),
        };

        session.messages.push(assistant_msg.clone());
        session.updated_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        // Update session
        self.sessions.write().await.insert(session_id.to_string(), session);

        Ok(ChatResponse {
            message: assistant_msg,
            rag_sources,
            tokens_used: response.tokens_generated as usize,
            time_to_first_token_ms: response.time_to_first_token_ms,
            total_time_ms: start.elapsed().as_millis() as u64,
            from_cache: false,
        })
    }

    /// Build context from RAG and open files
    async fn build_context(
        &self,
        query: &str,
        current_file: Option<&CodeSnippet>,
        open_files: &[CodeSnippet],
    ) -> Result<(String, Vec<RagSource>)> {
        let mut context_parts = Vec::new();
        let mut rag_sources = Vec::new();

        // Add current file context
        if let Some(file) = current_file {
            context_parts.push(format!(
                "[CURRENT FILE: {}]\n```\n{}\n```",
                file.file_path, file.content
            ));
        }

        // Add open files context
        if self.config.include_open_files && !open_files.is_empty() {
            let files_context: Vec<String> = open_files.iter()
                .filter(|f| current_file.map_or(true, |cf| f.file_path != cf.file_path))
                .map(|f| format!("{}:{}", f.file_path, f.content))
                .collect();

            if !files_context.is_empty() {
                context_parts.push(format!("[OPEN FILES]\n{}", files_context.join("\n\n")));
            }
        }

        // Add RAG context
        if self.config.enable_rag {
            let vector_store = self.vector_store.read().await;
            let results = vector_store.search(
                &self.generate_query_embedding(query).await?,
                self.config.rag_results_count,
            )?;

            if !results.is_empty() {
                let rag_context: Vec<String> = results.iter()
                    .map(|r| {
                        rag_sources.push(RagSource {
                            file_path: r.metadata.file_path.clone(),
                            start_line: r.metadata.start_line,
                            end_line: r.metadata.end_line,
                            score: r.score,
                            preview: r.metadata.content.chars().take(200).collect(),
                        });
                        format!(
                            "[{}:{}-{} (score: {:.2})]\n```\n{}\n```",
                            r.metadata.file_path,
                            r.metadata.start_line,
                            r.metadata.end_line,
                            r.score,
                            r.metadata.content
                        )
                    })
                    .collect();

                context_parts.push(format!("[RELEVANT CODE FROM PROJECT]\n{}", rag_context.join("\n\n")));
            }
        }

        let context = context_parts.join("\n\n---\n\n");
        Ok((context, rag_sources))
    }

    /// Build full conversation string for LLM
    fn build_conversation(&self, session: &ChatSession, context: &str) -> String {
        let mut conversation = String::new();

        // Add context
        if !context.is_empty() {
            conversation.push_str(&format!("CONTEXT:\n{}\n\n", context));
        }

        // Add conversation history (last N messages)
        let history_start = session.messages.len().saturating_sub(10);
        for msg in session.messages.iter().skip(history_start) {
            match msg.role {
                ChatRole::User => conversation.push_str(&format!("USER: {}\n", msg.content)),
                ChatRole::Assistant => conversation.push_str(&format!("ASSISTANT: {}\n", msg.content)),
                ChatRole::System => conversation.push_str(&format!("SYSTEM: {}\n", msg.content)),
            }
        }

        conversation.push_str("ASSISTANT: ");
        conversation
    }

    /// Generate embedding for query (placeholder - uses real embeddings in production)
    async fn generate_query_embedding(&self, _query: &str) -> Result<Vec<f32>> {
        // In production, this would use the embedding model
        // For now, return a deterministic embedding based on hash
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        _query.hash(&mut hasher);
        let hash = hasher.finish();

        // Generate pseudo-embedding (768 dimensions for nomic-embed-text)
        let mut embedding = vec![0.0f32; 768];
        for (i, val) in embedding.iter_mut().enumerate() {
            *val = ((hash.wrapping_add(i as u64)) as f32 % 2.0) - 1.0;
        }

        Ok(embedding)
    }

    /// Clear session history
    pub async fn clear_session(&self, session_id: &str) -> Result<()> {
        if let Some(session) = self.sessions.write().await.get_mut(session_id) {
            session.messages.clear();
            session.updated_at = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
        }
        Ok(())
    }

    /// Delete a session
    pub async fn delete_session(&self, session_id: &str) -> Result<()> {
        self.sessions.write().await.remove(session_id);
        Ok(())
    }

    /// List all sessions
    pub async fn list_sessions(&self) -> Vec<ChatSession> {
        self.sessions.read().await.values().cloned().collect()
    }

    /// Update session settings
    pub async fn update_session_settings(
        &self,
        session_id: &str,
        temperature: Option<f32>,
        model: Option<String>,
    ) -> Result<()> {
        if let Some(session) = self.sessions.write().await.get_mut(session_id) {
            if let Some(temp) = temperature {
                session.temperature = temp;
            }
            if let Some(model) = model {
                session.model = model;
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chat_session_default() {
        let session = ChatSession::default();
        assert!(!session.id.is_empty());
        assert!(session.messages.is_empty());
    }

    #[test]
    fn test_chat_config_default() {
        let config = ChatConfig::default();
        assert!(config.enable_rag);
        assert!(config.streaming);
        assert_eq!(config.rag_results_count, 5);
    }
}
