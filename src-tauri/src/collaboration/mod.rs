//! Real-time Collaboration Engine
//!
//! Based on Conflux (https://github.com/Kayleexx/conflux)
//! A modular, actor-based real-time collaboration engine written in Rust.
//! Provides room-based CRDT synchronization, presence/awareness broadcasting,
//! and text chat over WebSockets with JWT authentication.

pub mod room;
pub mod actor;
pub mod presence;
pub mod sync;
pub mod auth;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc, broadcast};

pub use room::{Room, RoomId, RoomConfig};
pub use actor::{CollaborationActor, ActorMessage, ActorResponse};
pub use presence::{Presence, UserPresence, CursorPosition};
pub use sync::{SyncEngine, SyncMessage, DocumentState};
pub use auth::{JwtAuth, AuthConfig, Claims};

/// Maximum concurrent users per room
pub const MAX_USERS_PER_ROOM: usize = 50;

/// Collaboration server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollaborationServerConfig {
    pub max_rooms: usize,
    pub max_users_per_room: usize,
    pub heartbeat_interval_secs: u64,
    pub session_timeout_secs: u64,
    pub enable_presence: bool,
    pub enable_chat: bool,
    pub jwt_secret: String,
    pub enable_persistence: bool,
    pub persistence_path: Option<String>,
}

impl Default for CollaborationServerConfig {
    fn default() -> Self {
        Self {
            max_rooms: 100,
            max_users_per_room: MAX_USERS_PER_ROOM,
            heartbeat_interval_secs: 30,
            session_timeout_secs: 300,
            enable_presence: true,
            enable_chat: true,
            jwt_secret: "your-secret-key-change-in-production".to_string(),
            enable_persistence: true,
            persistence_path: None,
        }
    }
}

/// WebSocket message types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum WsMessage {
    Join { room_id: String, user: UserInfo },
    Leave,
    Sync(SyncPayload),
    Presence(PresenceUpdate),
    Chat { content: String },
    Heartbeat { timestamp: u64 },
    Ack { message_id: String },
    Error { code: i32, message: String },
}

/// User information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: String,
    pub name: String,
    pub email: Option<String>,
    pub avatar: Option<String>,
    pub color: String,
}

/// Sync payload for CRDT operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPayload {
    pub document_id: String,
    pub version: u64,
    pub operations: Vec<Operation>,
}

/// CRDT operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Operation {
    pub id: String,
    pub timestamp: u64,
    pub user_id: String,
    pub kind: OperationKind,
}

/// Operation types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum OperationKind {
    Insert { position: u64, text: String },
    Delete { position: u64, length: u64 },
    Format { start: u64, end: u64, attributes: HashMap<String, String> },
    Move { from: u64, to: u64, length: u64 },
}

/// Presence update
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresenceUpdate {
    pub user_id: String,
    pub cursor: Option<CursorPosition>,
    pub selection: Option<SelectionRange>,
    pub status: UserStatus,
}

/// User status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum UserStatus {
    Active,
    Idle,
    Away,
    Offline,
}

/// Selection range
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectionRange {
    pub start: u64,
    pub end: u64,
}

/// Collaboration server
pub struct CollaborationServer {
    config: CollaborationServerConfig,
    rooms: Arc<RwLock<HashMap<RoomId, Room>>>,
    actors: Vec<mpsc::Sender<ActorMessage>>,
    auth: JwtAuth,
    shutdown: broadcast::Sender<()>,
}

impl CollaborationServer {
    pub fn new(config: CollaborationServerConfig) -> Result<Self> {
        let auth = JwtAuth::new(&config.jwt_secret)?;
        let (shutdown_tx, _) = broadcast::channel(1);
        
        let num_actors = num_cpus::get();
        let actors = (0..num_actors)
            .map(|id| CollaborationActor::spawn(id))
            .collect();
        
        Ok(Self {
            config,
            rooms: Arc::new(RwLock::new(HashMap::new())),
            actors,
            auth,
            shutdown: shutdown_tx,
        })
    }
    
    pub async fn create_room(&self, room_id: RoomId, config: RoomConfig) -> Result<()> {
        let mut rooms = self.rooms.write().await;
        if rooms.len() >= self.config.max_rooms {
            anyhow::bail!("Maximum number of rooms reached");
        }
        let room = Room::new(room_id.clone(), config, self.config.max_users_per_room)?;
        rooms.insert(room_id, room);
        Ok(())
    }
    
    pub async fn join_room(&self, room_id: &RoomId, user: UserInfo) -> Result<JoinResult> {
        let mut rooms = self.rooms.write().await;
        let room = rooms.get_mut(room_id)
            .ok_or_else(|| anyhow::anyhow!("Room not found"))?;
        room.add_user(user.clone())?;
        Ok(JoinResult {
            room_id: room_id.clone(),
            user_id: user.id,
            document_state: room.get_document_state()?,
            presence: room.get_presence()?,
        })
    }
    
    pub async fn get_stats(&self) -> ServerStats {
        let rooms = self.rooms.read().await;
        let total_users: usize = rooms.values().map(|r| r.user_count()).sum();
        ServerStats {
            total_rooms: rooms.len(),
            total_users,
            max_rooms: self.config.max_rooms,
            max_users_per_room: self.config.max_users_per_room,
        }
    }
}

/// Join result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JoinResult {
    pub room_id: RoomId,
    pub user_id: String,
    pub document_state: DocumentState,
    pub presence: Vec<UserPresence>,
}

/// Server stats
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStats {
    pub total_rooms: usize,
    pub total_users: usize,
    pub max_rooms: usize,
    pub max_users_per_room: usize,
}
