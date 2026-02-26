//! Collaboration Tauri Commands
//!
//! Exposes real-time collaboration functionality to the frontend

use tauri::command;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::collaboration::{CollaborationServer, RoomId, UserInfo, UserPresence, Operation, CollaborationServerConfig};

/// Global collaboration state
lazy_static::lazy_static! {
    static ref COLLAB_STATE: Arc<RwLock<CollaborationState>> = Arc::new(RwLock::new(CollaborationState::new()));
}

#[derive(Debug)]
pub struct CollaborationState {
    server: CollaborationServer,
    current_room: Option<String>,
    current_user: Option<UserInfo>,
    connected: bool,
}

impl CollaborationState {
    pub fn new() -> Self {
        let config = CollaborationServerConfig::default();
        Self {
            server: CollaborationServer::new(config)
                .unwrap_or_else(|e| {
                    log::warn!("Failed to create collaboration server: {}, using default", e);
                    CollaborationServer::default()
                }),
            current_room: None,
            current_user: None,
            connected: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomInfo {
    pub id: String,
    pub name: String,
    pub owner_id: String,
    pub user_count: usize,
    pub max_users: usize,
    pub created_at: String,
    pub is_encrypted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateRoomRequest {
    pub name: String,
    pub max_users: Option<usize>,
    pub enable_e2ee: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JoinRoomRequest {
    pub room_id: String,
    pub user: CollaboratorInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollaboratorInfo {
    pub id: String,
    pub name: String,
    pub email: Option<String>,
    pub avatar: Option<String>,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresenceUpdate {
    pub user_id: String,
    pub cursor_line: u32,
    pub cursor_column: u32,
    pub active_file: Option<String>,
    pub selection: Option<SelectionRange>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectionRange {
    pub start_line: u32,
    pub start_column: u32,
    pub end_line: u32,
    pub end_column: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextOperation {
    pub operation_type: String, // "insert" | "delete"
    pub position: u32,
    pub text: Option<String>,
    pub length: Option<u32>,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomStats {
    pub total_rooms: usize,
    pub total_users: usize,
    pub active_operations: u64,
    pub messages_sent: u64,
}

/// Create a new collaboration room
#[command]
pub async fn create_room(request: CreateRoomRequest) -> Result<RoomInfo, String> {
    let mut state = COLLAB_STATE.write().await;
    
    let room_id = uuid::Uuid::new_v4().to_string();
    let owner_id = state.current_user.as_ref()
        .map(|u| u.id.clone())
        .unwrap_or_else(|| "anonymous".to_string());
    
    let config = crate::collaboration::RoomConfig {
        max_users: request.max_users.unwrap_or(50),
        enable_e2ee: request.enable_e2ee.unwrap_or(true),
        ..Default::default()
    };
    
    state.server.create_room(RoomId(room_id.clone()), config)
        .await
        .map_err(|e| format!("Failed to create room: {}", e))?;
    
    Ok(RoomInfo {
        id: room_id,
        name: request.name,
        owner_id,
        user_count: 0,
        max_users: request.max_users.unwrap_or(50),
        created_at: chrono::Utc::now().to_rfc3339(),
        is_encrypted: request.enable_e2ee.unwrap_or(true),
    })
}

/// Join a collaboration room
#[command]
pub async fn join_room(request: JoinRoomRequest) -> Result<RoomInfo, String> {
    let mut state = COLLAB_STATE.write().await;
    
    let user = UserInfo {
        id: request.user.id,
        name: request.user.name,
        email: request.user.email,
        avatar: request.user.avatar,
        color: request.user.color,
    };
    
    state.server.join_room(&RoomId(request.room_id.clone()), user.clone())
        .await
        .map_err(|e| format!("Failed to join room: {}", e))?;
    
    state.current_room = Some(request.room_id.clone());
    state.current_user = Some(user);
    state.connected = true;
    
    let users = state.server.get_room_users(&RoomId(request.room_id))
        .await
        .unwrap_or_default();
    
    Ok(RoomInfo {
        id: request.room_id,
        name: "Active Room".to_string(),
        owner_id: "owner".to_string(),
        user_count: users.len(),
        max_users: 50,
        created_at: chrono::Utc::now().to_rfc3339(),
        is_encrypted: true,
    })
}

/// Leave current room
#[command]
pub async fn leave_room(room_id: String) -> Result<(), String> {
    let mut state = COLLAB_STATE.write().await;
    
    if let Some(user) = &state.current_user {
        state.server.leave_room(&RoomId(room_id), &user.id)
            .await
            .map_err(|e| format!("Failed to leave room: {}", e))?;
    }
    
    state.current_room = None;
    state.connected = false;
    
    Ok(())
}

/// Get users in a room
#[command]
pub async fn get_room_users(room_id: String) -> Result<Vec<CollaboratorInfo>, String> {
    let state = COLLAB_STATE.read().await;
    
    let users = state.server.get_room_users(&RoomId(room_id))
        .await
        .map_err(|e| format!("Failed to get users: {}", e))?;
    
    Ok(users.into_iter().map(|u| CollaboratorInfo {
        id: u.id,
        name: u.name,
        email: u.email,
        avatar: u.avatar,
        color: u.color,
    }).collect())
}

/// Update user presence
#[command]
pub async fn update_presence(room_id: String, presence: PresenceUpdate) -> Result<(), String> {
    let state = COLLAB_STATE.read().await;
    
    let user_presence = UserPresence {
        user_id: presence.user_id,
        cursor_position: Some(crate::collaboration::CursorPosition {
            line: presence.cursor_line,
            column: presence.cursor_column,
        }),
        selection: presence.selection.map(|s| crate::collaboration::Selection {
            start: crate::collaboration::CursorPosition {
                line: s.start_line,
                column: s.start_column,
            },
            end: crate::collaboration::CursorPosition {
                line: s.end_line,
                column: s.end_column,
            },
        }),
        active_file: presence.active_file,
    };
    
    state.server.update_presence(&RoomId(room_id), user_presence)
        .await
        .map_err(|e| format!("Failed to update presence: {}", e))?;
    
    Ok(())
}

/// Get presence for all users in room
#[command]
pub async fn get_room_presence(room_id: String) -> Result<Vec<PresenceUpdate>, String> {
    let state = COLLAB_STATE.read().await;
    
    let presence = state.server.get_room_presence(&RoomId(room_id))
        .await
        .map_err(|e| format!("Failed to get presence: {}", e))?;
    
    Ok(presence.into_iter().map(|(user_id, p)| PresenceUpdate {
        user_id,
        cursor_line: p.cursor_position.map(|c| c.line).unwrap_or(0),
        cursor_column: p.cursor_position.map(|c| c.column).unwrap_or(0),
        active_file: p.active_file,
        selection: p.selection.map(|s| SelectionRange {
            start_line: s.start.line,
            start_column: s.start.column,
            end_line: s.end.line,
            end_column: s.end.column,
        }),
    }).collect())
}

/// Send a text operation
#[command]
pub async fn send_operation(room_id: String, operation: TextOperation) -> Result<(), String> {
    let state = COLLAB_STATE.read().await;
    
    let op = match operation.operation_type.as_str() {
        "insert" => Operation::Insert {
            client_id: state.current_user.as_ref().map(|u| u.id.clone()).unwrap_or_default(),
            position: operation.position,
            text: operation.text.unwrap_or_default(),
            timestamp: operation.timestamp,
        },
        "delete" => Operation::Delete {
            client_id: state.current_user.as_ref().map(|u| u.id.clone()).unwrap_or_default(),
            position: operation.position,
            length: operation.length.unwrap_or(0),
            timestamp: operation.timestamp,
        },
        _ => return Err("Invalid operation type".to_string()),
    };
    
    state.server.submit_operation(&RoomId(room_id), op)
        .await
        .map_err(|e| format!("Failed to send operation: {}", e))?;
    
    Ok(())
}

/// Send a chat message
#[command]
pub async fn send_chat_message(room_id: String, message: String) -> Result<(), String> {
    let state = COLLAB_STATE.read().await;
    
    state.server.send_chat(&RoomId(room_id), message)
        .await
        .map_err(|e| format!("Failed to send message: {}", e))?;
    
    Ok(())
}

/// Get collaboration statistics
#[command]
pub async fn get_collab_stats() -> Result<RoomStats, String> {
    let state = COLLAB_STATE.read().await;
    let stats = state.server.get_stats().await;
    
    Ok(RoomStats {
        total_rooms: stats.total_rooms,
        total_users: stats.total_users,
        active_operations: stats.active_operations,
        messages_sent: stats.messages_sent,
    })
}

/// Check if connected to a room
#[command]
pub async fn is_connected_to_room() -> Result<bool, String> {
    let state = COLLAB_STATE.read().await;
    Ok(state.connected)
}

/// Get current room ID
#[command]
pub async fn get_current_room() -> Result<Option<String>, String> {
    let state = COLLAB_STATE.read().await;
    Ok(state.current_room.clone())
}

/// List all available rooms
#[command]
pub async fn list_rooms() -> Result<Vec<RoomInfo>, String> {
    let state = COLLAB_STATE.read().await;
    let rooms = state.server.list_rooms()
        .await
        .map_err(|e| format!("Failed to list rooms: {}", e))?;
    
    Ok(rooms.into_iter().map(|r| RoomInfo {
        id: r.id.0,
        name: r.name,
        owner_id: r.owner_id,
        user_count: r.user_count,
        max_users: r.max_users,
        created_at: r.created_at.to_rfc3339(),
        is_encrypted: r.is_encrypted,
    }).collect())
}
