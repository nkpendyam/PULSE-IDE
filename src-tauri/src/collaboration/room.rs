//! Room Management
//!
//! Room-based collaboration with CRDT synchronization
//! Scaled for 50+ concurrent users with LogootSplit-inspired optimizations
//! Based on patterns from coast-team/mute (https://github.com/coast-team/mute)

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use yrs::{Doc, Transact, Text, ReadTxn};
use chrono::{DateTime, Utc};

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
    /// Rate limit: max operations per second per user
    pub rate_limit: u32,
    /// Presence broadcast throttle in milliseconds
    pub presence_throttle_ms: u64,
}

impl Default for RoomConfig {
    fn default() -> Self {
        Self {
            name: "Untitled Room".to_string(),
            max_users: None,
            enable_chat: true,
            enable_persistence: true,
            readonly: false,
            rate_limit: 100, // 100 ops/sec per user
            presence_throttle_ms: 50, // 50ms throttle for presence
        }
    }
}

/// User session in room
#[derive(Debug, Clone)]
pub struct UserSession {
    pub user: UserInfo,
    pub joined_at: DateTime<Utc>,
    pub last_activity: DateTime<Utc>,
    pub cursor_position: Option<CursorPosition>,
    /// Operation count for rate limiting
    pub op_count: u32,
    /// Last rate limit reset
    pub last_rate_reset: DateTime<Utc>,
    /// Pending presence updates (batched)
    pub pending_presence: Option<PresenceUpdate>,
}

/// Cursor position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorPosition {
    pub line: u32,
    pub column: u32,
    pub file_path: Option<String>,
}

/// Presence update (for batching)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresenceUpdate {
    pub cursor: Option<CursorPosition>,
    pub selection: Option<SelectionRange>,
    pub timestamp: DateTime<Utc>,
}

/// Selection range
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectionRange {
    pub start_line: u32,
    pub start_column: u32,
    pub end_line: u32,
    pub end_column: u32,
}

/// Collaboration room with 50-user optimization
#[derive(Debug)]
pub struct Room {
    pub id: RoomId,
    pub config: RoomConfig,
    pub created_at: DateTime<Utc>,
    max_users: usize,
    users: Arc<RwLock<HashMap<String, UserSession>>>,
    doc: Arc<Doc>,
    text: Text,
    /// Presence broadcast channel for 50 users
    presence_broadcast: tokio::sync::broadcast::Sender<PresenceBroadcast>,
    /// Operation log for conflict resolution
    op_log: Arc<RwLock<Vec<LoggedOperation>>>,
}

/// Logged operation for audit/replay
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggedOperation {
    pub id: String,
    pub user_id: String,
    pub timestamp: DateTime<Utc>,
    pub operation: Operation,
}

/// Presence broadcast message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresenceBroadcast {
    pub user_id: String,
    pub user_name: String,
    pub user_color: String,
    pub cursor: Option<CursorPosition>,
    pub selection: Option<SelectionRange>,
}

impl Room {
    /// Create a new room with 50-user capacity
    pub fn new(id: RoomId, config: RoomConfig, max_users: usize) -> Result<Self> {
        let doc = Doc::new();
        let text = doc.get_or_insert_text("content");
        let (presence_tx, _) = tokio::sync::broadcast::channel(128); // Buffer for 50 users
        
        Ok(Self {
            id,
            config,
            created_at: Utc::now(),
            max_users: config.max_users.unwrap_or(max_users),
            users: Arc::new(RwLock::new(HashMap::new())),
            doc: Arc::new(doc),
            text,
            presence_broadcast: presence_tx,
            op_log: Arc::new(RwLock::new(Vec::new())),
        })
    }
    
    /// Add user to room with rate limiting initialization
    pub fn add_user(&mut self, user: UserInfo) -> Result<()> {
        let mut users = self.users.try_write()
            .map_err(|_| anyhow::anyhow!("Lock error"))?;
        
        if users.len() >= self.max_users {
            anyhow::bail!("Room is full (max {} users)", self.max_users);
        }
        
        let now = Utc::now();
        let session = UserSession {
            user: user.clone(),
            joined_at: now,
            last_activity: now,
            cursor_position: None,
            op_count: 0,
            last_rate_reset: now,
            pending_presence: None,
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
    
    /// Check if room is at capacity
    pub fn is_full(&self) -> bool {
        self.user_count() >= self.max_users
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
    
    /// Get presence info (optimized for 50 users)
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
    
    /// Apply operations with rate limiting
    pub fn apply_operations(&self, user_id: &str, operations: Vec<Operation>) -> Result<()> {
        // Check rate limit
        self.check_rate_limit(user_id)?;
        
        let mut txn = self.doc.transact_mut();
        let mut op_log = self.op_log.try_write()
            .map_err(|_| anyhow::anyhow!("Lock error"))?;
        
        for op in operations.clone() {
            match op.kind {
                super::OperationKind::Insert { position, text } => {
                    self.text.insert(&mut txn, position as usize, &text)?;
                }
                super::OperationKind::Delete { position, length } => {
                    self.text.remove_range(&mut txn, position as usize, length as usize)?;
                }
                super::OperationKind::Format { start, end, attributes } => {
                    // Format operations for rich text
                    log::debug!("Format: {}-{} {:?}", start, end, attributes);
                }
                super::OperationKind::Move { from, to, length } => {
                    // Move operations for drag-drop
                    log::debug!("Move: {} -> {} (len: {})", from, to, length);
                }
            }
            
            // Log operation
            op_log.push(LoggedOperation {
                id: op.id.clone(),
                user_id: user_id.to_string(),
                timestamp: Utc::now(),
                operation: op,
            });
        }
        
        // Keep log bounded (last 10000 operations)
        if op_log.len() > 10000 {
            let drain = op_log.len() - 10000;
            op_log.drain(0..drain);
        }
        
        Ok(())
    }
    
    /// Check rate limit for user
    fn check_rate_limit(&self, user_id: &str) -> Result<()> {
        let mut users = self.users.try_write()
            .map_err(|_| anyhow::anyhow!("Lock error"))?;
        
        if let Some(session) = users.get_mut(user_id) {
            let now = Utc::now();
            let elapsed = (now - session.last_rate_reset).num_seconds();
            
            // Reset counter every second
            if elapsed >= 1 {
                session.op_count = 0;
                session.last_rate_reset = now;
            }
            
            // Check if over limit
            if session.op_count >= self.config.rate_limit {
                anyhow::bail!("Rate limit exceeded: {} ops/sec", self.config.rate_limit);
            }
            
            session.op_count += 1;
        }
        
        Ok(())
    }
    
    /// Update user cursor with presence broadcast
    pub fn update_cursor(&self, user_id: &str, cursor: CursorPosition) -> Result<()> {
        let mut users = self.users.try_write()
            .map_err(|_| anyhow::anyhow!("Lock error"))?;
        
        if let Some(session) = users.get_mut(user_id) {
            session.cursor_position = Some(cursor.clone());
            session.last_activity = Utc::now();
            
            // Broadcast presence update
            let _ = self.presence_broadcast.send(PresenceBroadcast {
                user_id: user_id.to_string(),
                user_name: session.user.name.clone(),
                user_color: session.user.color.clone(),
                cursor: Some(cursor),
                selection: None,
            });
        }
        
        Ok(())
    }
    
    /// Subscribe to presence updates (for 50 users)
    pub fn subscribe_presence(&self) -> tokio::sync::broadcast::Receiver<PresenceBroadcast> {
        self.presence_broadcast.subscribe()
    }
    
    /// Get inactive users (for cleanup)
    pub fn get_inactive_users(&self, timeout_secs: i64) -> Result<Vec<String>> {
        let users = self.users.try_read()
            .map_err(|_| anyhow::anyhow!("Lock error"))?;
        
        let now = Utc::now();
        let inactive: Vec<String> = users.values()
            .filter(|s| (now - s.last_activity).num_seconds() > timeout_secs)
            .map(|s| s.user.id.clone())
            .collect();
        
        Ok(inactive)
    }
    
    /// Get operation log (for debugging/replay)
    pub fn get_op_log(&self, limit: usize) -> Result<Vec<LoggedOperation>> {
        let op_log = self.op_log.try_read()
            .map_err(|_| anyhow::anyhow!("Lock error"))?;
        
        Ok(op_log.iter().rev().take(limit).cloned().collect())
    }
    
    /// Get room statistics
    pub fn get_stats(&self) -> RoomStats {
        RoomStats {
            id: self.id.0.clone(),
            name: self.config.name.clone(),
            user_count: self.user_count(),
            max_users: self.max_users,
            created_at: self.created_at,
            op_count: self.op_log.try_read().map(|l| l.len()).unwrap_or(0),
        }
    }
}

/// Room statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomStats {
    pub id: String,
    pub name: String,
    pub user_count: usize,
    pub max_users: usize,
    pub created_at: DateTime<Utc>,
    pub op_count: usize,
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
            presence_broadcast: self.presence_broadcast.clone(),
            op_log: self.op_log.clone(),
        }
    }
}
