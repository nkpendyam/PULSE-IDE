//! Real WebSocket Collaboration with CRDT
//!
//! Implements real-time collaborative editing using:
//! - Yrs (Yjs Rust port) for CRDT-based conflict resolution
//! - WebSocket for real-time communication
//! - Awareness protocol for presence

pub mod sync;
pub mod awareness;
pub mod document;

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock, broadcast};
use serde::{Deserialize, Serialize};
use anyhow::{Result, Context};
use log::{debug, info, warn, error};

pub use sync::*;
pub use awareness::*;


/// Collaboration room
#[derive(Debug, Clone)]
pub struct CollabRoom {
    pub id: String,
    pub document: Arc<RwLock<CollabDocument>>,
    pub awareness: Arc<RwLock<AwarenessState>>,
    pub users: HashMap<String, CollabUser>,
    pub created_at: u64,
}

impl CollabRoom {
    pub fn new(id: String) -> Self {
        Self {
            id: id.clone(),
            document: Arc::new(RwLock::new(CollabDocument::new(&id))),
            awareness: Arc::new(RwLock::new(AwarenessState::new())),
            users: HashMap::new(),
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0),
        }
    }
}

/// Collaborative user
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollabUser {
    pub id: String,
    pub name: String,
    pub color: String,
    pub cursor: Option<CursorPosition>,
    pub selection: Option<SelectionRange>,
    pub last_seen: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorPosition {
    pub line: u32,
    pub column: u32,
    pub file: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectionRange {
    pub start: CursorPosition,
    pub end: CursorPosition,
}

/// Collaboration message types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CollabMessage {
    #[serde(rename = "sync")]
    Sync { room_id: String, data: SyncMessage },
    #[serde(rename = "awareness")]
    Awareness { room_id: String, data: AwarenessMessage },
    #[serde(rename = "join")]
    Join { room_id: String, user: CollabUser },
    #[serde(rename = "leave")]
    Leave { room_id: String, user_id: String },
    #[serde(rename = "cursor")]
    Cursor { room_id: String, user_id: String, cursor: CursorPosition },
    #[serde(rename = "selection")]
    Selection { room_id: String, user_id: String, selection: SelectionRange },
    #[serde(rename = "chat")]
    Chat { room_id: String, user_id: String, message: String, timestamp: u64 },
}

/// Sync message from Yjs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncMessage {
    pub update: Vec<u8>,
    pub vector_clock: HashMap<String, u64>,
}

/// Awareness message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AwarenessMessage {
    pub user_id: String,
    pub state: HashMap<String, serde_json::Value>,
}

/// Collaboration manager
pub struct CollabManager {
    rooms: HashMap<String, CollabRoom>,
    local_user: CollabUser,
    message_tx: mpsc::Sender<CollabMessage>,
    message_rx: Option<mpsc::Receiver<CollabMessage>>,
    broadcast_tx: broadcast::Sender<CollabMessage>,
}

impl CollabManager {
    pub fn new(user_id: String, user_name: String) -> Self {
        let (message_tx, message_rx) = mpsc::channel(256);
        let (broadcast_tx, _) = broadcast::channel(256);
        
        let local_user = CollabUser {
            id: user_id,
            name: user_name,
            color: Self::generate_user_color(),
            cursor: None,
            selection: None,
            last_seen: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0),
        };
        
        Self {
            rooms: HashMap::new(),
            local_user,
            message_tx,
            message_rx: Some(message_rx),
            broadcast_tx,
        }
    }
    
    fn generate_user_color() -> String {
        let colors = [
            "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
            "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
            "#BB8FCE", "#85C1E9", "#F8B500", "#00CED1",
        ];
        use std::hash::{Hash, Hasher, DefaultHasher};
        let mut hasher = DefaultHasher::new();
        std::time::SystemTime::now().hash(&mut hasher);
        let idx = hasher.finish() as usize % colors.len();
        colors[idx].to_string()
    }
    
    /// Create or join a room
    pub async fn join_room(&mut self, room_id: &str) -> Result<&CollabRoom> {
        if !self.rooms.contains_key(room_id) {
            let room = CollabRoom::new(room_id.to_string());
            self.rooms.insert(room_id.to_string(), room);
            info!("Created room: {}", room_id);
        }
        
        let room = self.rooms.get_mut(room_id)
            .ok_or_else(|| anyhow::anyhow!("Failed to get room after creation"))?;
        room.users.insert(self.local_user.id.clone(), self.local_user.clone());
        
        // Broadcast join
        let _ = self.broadcast_tx.send(CollabMessage::Join {
            room_id: room_id.to_string(),
            user: self.local_user.clone(),
        });
        
        self.rooms.get(room_id)
            .ok_or_else(|| anyhow::anyhow!("Room not found after join"))
    }
    
    /// Leave a room
    pub async fn leave_room(&mut self, room_id: &str) -> Result<()> {
        if let Some(room) = self.rooms.get_mut(room_id) {
            room.users.remove(&self.local_user.id);
            
            // Broadcast leave
            let _ = self.broadcast_tx.send(CollabMessage::Leave {
                room_id: room_id.to_string(),
                user_id: self.local_user.id.clone(),
            });
        }
        
        if let Some(room) = self.rooms.get(room_id) {
            if room.users.is_empty() {
                self.rooms.remove(room_id);
                info!("Removed empty room: {}", room_id);
            }
        }
        
        Ok(())
    }
    
    /// Update cursor position
    pub async fn update_cursor(&mut self, room_id: &str, cursor: CursorPosition) -> Result<()> {
        if let Some(room) = self.rooms.get_mut(room_id) {
            if let Some(user) = room.users.get_mut(&self.local_user.id) {
                user.cursor = Some(cursor.clone());
                user.last_seen = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_secs())
                    .unwrap_or(0);
            }
            
            // Update awareness
            let mut awareness = room.awareness.write().await;
            awareness.set_local_state_field("cursor", serde_json::to_value(&cursor)?);
        }
        
        // Broadcast cursor update
        let _ = self.broadcast_tx.send(CollabMessage::Cursor {
            room_id: room_id.to_string(),
            user_id: self.local_user.id.clone(),
            cursor,
        });
        
        Ok(())
    }
    
    /// Update selection
    pub async fn update_selection(&mut self, room_id: &str, selection: SelectionRange) -> Result<()> {
        if let Some(room) = self.rooms.get_mut(room_id) {
            if let Some(user) = room.users.get_mut(&self.local_user.id) {
                user.selection = Some(selection.clone());
            }
            
            // Update awareness
            let mut awareness = room.awareness.write().await;
            awareness.set_local_state_field("selection", serde_json::to_value(&selection)?);
        }
        
        // Broadcast selection update
        let _ = self.broadcast_tx.send(CollabMessage::Selection {
            room_id: room_id.to_string(),
            user_id: self.local_user.id.clone(),
            selection,
        });
        
        Ok(())
    }
    
    /// Apply text update to document
    pub async fn apply_update(&mut self, room_id: &str, update: &[u8]) -> Result<()> {
        if let Some(room) = self.rooms.get(room_id) {
            let mut doc = room.document.write().await;
            doc.apply_update(update)?;
            
            // Broadcast sync
            let _ = self.message_tx.send(CollabMessage::Sync {
                room_id: room_id.to_string(),
                data: SyncMessage {
                    update: update.to_vec(),
                    vector_clock: doc.get_vector_clock(),
                },
            });
        }
        
        Ok(())
    }
    
    /// Get document content
    pub async fn get_document_content(&self, room_id: &str) -> Option<String> {
        if let Some(room) = self.rooms.get(room_id) {
            let doc = room.document.read().await;
            Some(doc.get_content())
        } else {
            None
        }
    }
    
    /// Get room users
    pub fn get_room_users(&self, room_id: &str) -> Option<Vec<CollabUser>> {
        self.rooms.get(room_id).map(|r| r.users.values().cloned().collect())
    }
    
    /// Get message receiver
    pub fn take_message_receiver(&mut self) -> Option<mpsc::Receiver<CollabMessage>> {
        self.message_rx.take()
    }
    
    /// Subscribe to broadcast messages
    pub fn subscribe(&self) -> broadcast::Receiver<CollabMessage> {
        self.broadcast_tx.subscribe()
    }
    
    /// Handle incoming message
    pub async fn handle_message(&mut self, msg: CollabMessage) -> Result<()> {
        match msg {
            CollabMessage::Sync { room_id, data } => {
                if let Some(room) = self.rooms.get(&room_id) {
                    let mut doc = room.document.write().await;
                    doc.apply_update(&data.update)?;
                }
            }
            CollabMessage::Awareness { room_id, data } => {
                if let Some(room) = self.rooms.get(&room_id) {
                    let mut awareness = room.awareness.write().await;
                    awareness.set_state(data.user_id, data.state);
                }
            }
            CollabMessage::Join { room_id, user } => {
                if let Some(room) = self.rooms.get_mut(&room_id) {
                    room.users.insert(user.id.clone(), user);
                }
            }
            CollabMessage::Leave { room_id, user_id } => {
                if let Some(room) = self.rooms.get_mut(&room_id) {
                    room.users.remove(&user_id);
                    
                    let mut awareness = room.awareness.write().await;
                    awareness.remove_state(&user_id);
                }
            }
            CollabMessage::Cursor { room_id, user_id, cursor } => {
                if let Some(room) = self.rooms.get_mut(&room_id) {
                    if let Some(user) = room.users.get_mut(&user_id) {
                        user.cursor = Some(cursor);
                    }
                }
            }
            CollabMessage::Selection { room_id, user_id, selection } => {
                if let Some(room) = self.rooms.get_mut(&room_id) {
                    if let Some(user) = room.users.get_mut(&user_id) {
                        user.selection = Some(selection);
                    }
                }
            }
            CollabMessage::Chat { .. } => {
                // Handle chat messages
            }
        }
        
        Ok(())
    }
}

/// Shared collaboration manager
pub type SharedCollabManager = Arc<RwLock<CollabManager>>;

