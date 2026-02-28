//! Git-backed CRDT for real-time collaboration
//!
//! This module provides:
//! - Real-time sync using Yjs (y-crdt Rust port)
//! - Git persistence for history storage
//! - AI-powered merge conflict resolution
//! - Time-limited collaboration windows (5 min default)
//! - WebSocket sync layer for peer communication

pub mod yjs_adapter;
pub mod git_persistence;
pub mod ai_merge;
pub mod awareness;
pub mod websocket_sync;

pub use yjs_adapter::YjsAdapter;
pub use git_persistence::GitPersistence;
pub use ai_merge::AiMergeResolver;
pub use awareness::AwarenessProtocol;
pub use websocket_sync::{CollaborationServer, CollaborationClient, CollaborationMessage};

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;

/// Collaboration session configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollaborationConfig {
    /// Session timeout in seconds (default: 5 minutes)
    pub session_timeout_secs: u64,
    /// Auto-commit interval in seconds
    pub auto_commit_interval_secs: u64,
    /// Enable AI merge resolution
    pub enable_ai_merge: bool,
    /// Maximum concurrent users
    pub max_users: usize,
}

impl Default for CollaborationConfig {
    fn default() -> Self {
        Self {
            session_timeout_secs: 300, // 5 minutes
            auto_commit_interval_secs: 30,
            enable_ai_merge: true,
            max_users: 10,
        }
    }
}

/// Active collaboration session
pub struct CollaborationSession {
    pub session_id: String,
    pub document_id: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub participants: HashMap<String, Participant>,
    pub yjs_adapter: Arc<RwLock<YjsAdapter>>,
    pub git_persistence: Arc<RwLock<GitPersistence>>,
    pub awareness: Arc<RwLock<AwarenessProtocol>>,
}

/// Participant in a collaboration session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Participant {
    pub user_id: String,
    pub name: String,
    pub color: String,
    pub cursor: Option<Cursor>,
    pub selection: Option<Selection>,
    pub last_seen: chrono::DateTime<chrono::Utc>,
}

/// Cursor position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cursor {
    pub line: u32,
    pub column: u32,
    pub file_path: String,
}

/// Selection range
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Selection {
    pub start: Cursor,
    pub end: Cursor,
}

/// Document update from Yjs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentUpdate {
    pub session_id: String,
    pub user_id: String,
    pub update: Vec<u8>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// Main collaboration manager
pub struct CollaborationManager {
    config: CollaborationConfig,
    sessions: Arc<RwLock<HashMap<String, CollaborationSession>>>,
    ai_resolver: Option<Arc<RwLock<AiMergeResolver>>>,
}

impl CollaborationManager {
    /// Create a new collaboration manager
    pub fn new(config: CollaborationConfig) -> Self {
        Self {
            config,
            sessions: Arc::new(RwLock::new(HashMap::new())),
            ai_resolver: None,
        }
    }

    /// Create a new collaboration session
    pub async fn create_session(&self, document_id: &str, user_id: &str) -> Result<String> {
        let session_id = uuid::Uuid::new_v4().to_string();
        
        let session = CollaborationSession {
            session_id: session_id.clone(),
            document_id: document_id.to_string(),
            created_at: chrono::Utc::now(),
            participants: HashMap::new(),
            yjs_adapter: Arc::new(RwLock::new(YjsAdapter::new()?)),
            git_persistence: Arc::new(RwLock::new(GitPersistence::new(document_id)?)),
            awareness: Arc::new(RwLock::new(AwarenessProtocol::new())),
        };

        self.sessions.write().await.insert(session_id.clone(), session);
        
        Ok(session_id)
    }

    /// Join a collaboration session
    pub async fn join_session(&self, session_id: &str, user: Participant) -> Result<()> {
        let mut sessions = self.sessions.write().await;
        let session = sessions.get_mut(session_id)
            .ok_or_else(|| anyhow::anyhow!("Session not found: {}", session_id))?;

        // Check user limit
        if session.participants.len() >= self.config.max_users {
            return Err(anyhow::anyhow!("Session is full"));
        }

        session.participants.insert(user.user_id.clone(), user);
        
        Ok(())
    }

    /// Leave a collaboration session
    pub async fn leave_session(&self, session_id: &str, user_id: &str) -> Result<()> {
        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.get_mut(session_id) {
            session.participants.remove(user_id);
            
            // End session if no participants
            if session.participants.is_empty() {
                // Commit final state to git
                session.git_persistence.write().await.commit("Session ended")?;
                sessions.remove(session_id);
            }
        }
        
        Ok(())
    }

    /// Apply a document update
    pub async fn apply_update(&self, update: DocumentUpdate) -> Result<Vec<u8>> {
        let sessions = self.sessions.read().await;
        let session = sessions.get(&update.session_id)
            .ok_or_else(|| anyhow::anyhow!("Session not found"))?;

        // Apply to Yjs document
        let mut adapter = session.yjs_adapter.write().await;
        adapter.apply_update(&update.update)?;

        // Broadcast to other participants
        let awareness_update = session.awareness.write().await.encode();
        
        Ok(awareness_update)
    }

    /// Get current document state
    pub async fn get_document_state(&self, session_id: &str) -> Result<Vec<u8>> {
        let sessions = self.sessions.read().await;
        let session = sessions.get(session_id)
            .ok_or_else(|| anyhow::anyhow!("Session not found"))?;

        let adapter = session.yjs_adapter.read().await;
        adapter.get_state()
    }

    /// Resolve a merge conflict
    pub async fn resolve_conflict(&self, session_id: &str, conflict: &MergeConflict) -> Result<String> {
        if let Some(ref resolver) = self.ai_resolver {
            let resolver = resolver.read().await;
            resolver.resolve(conflict).await
        } else {
            // Manual resolution required
            Err(anyhow::anyhow!("AI merge resolution not available"))
        }
    }

    /// Get active sessions
    pub async fn get_active_sessions(&self) -> Vec<String> {
        self.sessions.read().await.keys().cloned().collect()
    }

    /// Clean up expired sessions
    pub async fn cleanup_expired(&self) -> Result<()> {
        let mut sessions = self.sessions.write().await;
        let now = chrono::Utc::now();
        
        let expired: Vec<String> = sessions.iter()
            .filter(|(_, session)| {
                let elapsed = now.signed_duration_since(session.created_at);
                elapsed.num_seconds() as u64 > self.config.session_timeout_secs
            })
            .map(|(id, _)| id.clone())
            .collect();

        for session_id in expired {
            if let Some(session) = sessions.remove(&session_id) {
                // Final commit before removal
                session.git_persistence.write().await.commit("Session expired")?;
            }
        }

        Ok(())
    }
}

/// Merge conflict structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeConflict {
    pub file_path: String,
    pub our_version: String,
    pub their_version: String,
    pub base_version: String,
    pub conflict_markers: Vec<ConflictMarker>,
}

/// Conflict marker location
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictMarker {
    pub start_line: u32,
    pub middle_line: u32,
    pub end_line: u32,
}
