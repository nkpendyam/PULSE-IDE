//! Room Management
//!
//! Room-based collaboration with CRDT synchronization

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use yrs::{Doc, Transact, Text, ReadTxn};

use super::{UserInfo, Operation, UserPresence, DocumentState};

/// Room identifier
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct RoomId(pub String);

impl std::fmt::Display for RoomId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Room configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomConfig {
    pub name: String,
    pub max_users: Option<usize>,
    pub enable_chat: bool,
    pub enable_persistence: bool,
    pub readonly: bool,
}

impl Default for RoomConfig {
    fn default() -> Self {
        Self {
            name: "Untitled Room".to_string(),
            max_users: None,
            enable_chat: true,
            enable_persistence: true,
            readonly: false,
        }
    }
}

/// User session in room
#[derive(Debug, Clone)]
pub struct UserSession {
    pub user: UserInfo,
    pub joined_at: chrono::DateTime<chrono::Utc>,
    pub last_activity: chrono::DateTime<chrono::Utc>,
    pub cursor_position: Option<CursorPosition>,
}

/// Cursor position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorPosition {
    pub line: u32,
    pub column: u32,
    pub file_path: Option<String>,
}

/// Collaboration room
#[derive(Debug)]
pub struct Room {
    pub id: RoomId,
    pub config: RoomConfig,
    pub created_at: chrono::DateTime<chrono::Utc>,
    max_users: usize,
    users: Arc<RwLock<HashMap<String, UserSession>>>,
    doc: Arc<Doc>,
    text: Text,
}

impl Room {
    /// Create a new room
    pub fn new(id: RoomId, config: RoomConfig, max_users: usize) -> Result<Self> {
        let doc = Doc::new();
        let text = doc.get_or_insert_text("content");
        
        Ok(Self {
            id,
            config,
            created_at: chrono::Utc::now(),
            max_users: config.max_users.unwrap_or(max_users),
            users: Arc::new(RwLock::new(HashMap::new())),
            doc: Arc::new(doc),
            text,
        })
    }
    
    /// Add user to room
    pub fn add_user(&mut self, user: UserInfo) -> Result<()> {
        let mut users = self.users.try_write()
            .map_err(|_| anyhow::anyhow!("Lock error"))?;
        
        if users.len() >= self.max_users {
            anyhow::bail!("Room is full (max {} users)", self.max_users);
        }
        
        let session = UserSession {
            user: user.clone(),
            joined_at: chrono::Utc::now(),
            last_activity: chrono::Utc::now(),
            cursor_position: None,
        };
        
        users.insert(user.id, session);
        Ok(())
    }
    
    /// Remove user from room
    pub fn remove_user(&mut self, user_id: &str) -> Result<()> {
        let mut users = self.users.try_write()
            .map_err(|_| anyhow::anyhow!("Lock error"))?;
        users.remove(user_id);
        Ok(())
    }
    
    /// Get user count
    pub fn user_count(&self) -> usize {
        self.users.try_read().map(|u| u.len()).unwrap_or(0)
    }
    
    /// Get document state
    pub fn get_document_state(&self) -> Result<DocumentState> {
        let txn = self.doc.transact();
        let content = self.text.get_string(&txn);
        
        Ok(DocumentState {
            content,
            version: 0, // Would track actual version
            users: self.users.try_read()
                .map(|u| u.values().map(|s| s.user.clone()).collect())
                .unwrap_or_default(),
        })
    }
    
    /// Get presence info
    pub fn get_presence(&self) -> Result<Vec<UserPresence>> {
        let users = self.users.try_read()
            .map_err(|_| anyhow::anyhow!("Lock error"))?;
        
        Ok(users.values().map(|session| UserPresence {
            user_id: session.user.id.clone(),
            name: session.user.name.clone(),
            color: session.user.color.clone(),
            cursor: session.cursor_position.clone(),
            status: super::UserStatus::Active,
        }).collect())
    }
    
    /// Apply operations
    pub fn apply_operations(&self, _user_id: &str, operations: Vec<Operation>) -> Result<()> {
        let mut txn = self.doc.transact_mut();
        
        for op in operations {
            match op.kind {
                super::OperationKind::Insert { position, text } => {
                    self.text.insert(&mut txn, position as usize, &text)?;
                }
                super::OperationKind::Delete { position, length } => {
                    self.text.remove_range(&mut txn, position as usize, length as usize)?;
                }
                _ => {}
            }
        }
        
        Ok(())
    }
    
    /// Update user cursor
    pub fn update_cursor(&self, user_id: &str, cursor: CursorPosition) -> Result<()> {
        let mut users = self.users.try_write()
            .map_err(|_| anyhow::anyhow!("Lock error"))?;
        
        if let Some(session) = users.get_mut(user_id) {
            session.cursor_position = Some(cursor);
            session.last_activity = chrono::Utc::now();
        }
        
        Ok(())
    }
}

impl Clone for Room {
    fn clone(&self) -> Self {
        Self {
            id: self.id.clone(),
            config: self.config.clone(),
            created_at: self.created_at,
            max_users: self.max_users,
            users: self.users.clone(),
            doc: self.doc.clone(),
            text: self.text.clone(),
        }
    }
}
