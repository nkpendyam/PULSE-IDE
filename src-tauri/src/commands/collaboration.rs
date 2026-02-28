// Collaboration Tauri Commands — Self-contained implementation
use tauri::command;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

lazy_static::lazy_static! {
    static ref COLLAB_STATE: Arc<RwLock<CollaborationState>> = Arc::new(RwLock::new(CollaborationState::new()));
}

#[derive(Debug)]
pub struct CollaborationState {
    rooms: HashMap<String, RoomInfo>,
    current_room: Option<String>,
    connected: bool,
}

impl CollaborationState {
    pub fn new() -> Self {
        Self { rooms: HashMap::new(), current_room: None, connected: false }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomInfo {
    pub id: String,
    pub name: String,
    pub users: Vec<CollaboratorInfo>,
    pub created_at: String,
    pub max_users: usize,
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
    pub username: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollaboratorInfo {
    pub id: String,
    pub name: String,
    pub color: String,
    pub cursor_line: Option<u32>,
    pub cursor_col: Option<u32>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresenceUpdate {
    pub user_id: String,
    pub cursor_line: Option<u32>,
    pub cursor_col: Option<u32>,
    pub selection_start: Option<u32>,
    pub selection_end: Option<u32>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextOperation {
    pub op_type: String,
    pub position: u64,
    pub text: Option<String>,
    pub length: Option<u64>,
    pub user_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomStats {
    pub user_count: usize,
    pub operation_count: u64,
    pub uptime_secs: u64,
}

#[command]
pub async fn create_room(request: CreateRoomRequest) -> Result<RoomInfo, String> {
    let mut state = COLLAB_STATE.write().await;
    let id = uuid::Uuid::new_v4().to_string();
    let room = RoomInfo {
        id: id.clone(), name: request.name,
        users: vec![], created_at: chrono::Utc::now().to_rfc3339(),
        max_users: request.max_users.unwrap_or(50),
        is_encrypted: request.enable_e2ee.unwrap_or(false),
    };
    state.rooms.insert(id, room.clone());
    Ok(room)
}

#[command]
pub async fn join_room(request: JoinRoomRequest) -> Result<RoomInfo, String> {
    let mut state = COLLAB_STATE.write().await;
    let room = state.rooms.get_mut(&request.room_id).ok_or("Room not found")?;
    room.users.push(CollaboratorInfo {
        id: uuid::Uuid::new_v4().to_string(), name: request.username,
        color: format!("#{:06x}", rand::random::<u32>() & 0xFFFFFF),
        cursor_line: None, cursor_col: None, status: "active".to_string(),
    });
    state.current_room = Some(request.room_id.clone());
    state.connected = true;
    Ok(room.clone())
}

#[command]
pub async fn leave_room(room_id: String) -> Result<(), String> {
    let mut state = COLLAB_STATE.write().await;
    if state.current_room.as_deref() == Some(&room_id) {
        state.current_room = None;
        state.connected = false;
    }
    Ok(())
}

#[command]
pub async fn get_room_users(room_id: String) -> Result<Vec<CollaboratorInfo>, String> {
    let state = COLLAB_STATE.read().await;
    let room = state.rooms.get(&room_id).ok_or("Room not found")?;
    Ok(room.users.clone())
}

#[command]
pub async fn update_presence(room_id: String, presence: PresenceUpdate) -> Result<(), String> {
    let mut state = COLLAB_STATE.write().await;
    let room = state.rooms.get_mut(&room_id).ok_or("Room not found")?;
    let user_idx = room.users.iter().position(|u| u.id == presence.user_id);
    if let Some(idx) = user_idx {
        room.users[idx].cursor_line = presence.cursor_line;
        room.users[idx].cursor_col = presence.cursor_col;
        room.users[idx].status = presence.status;
    }
    Ok(())
}

#[command]
pub async fn get_room_presence(room_id: String) -> Result<Vec<PresenceUpdate>, String> {
    let state = COLLAB_STATE.read().await;
    let room = state.rooms.get(&room_id).ok_or("Room not found")?;
    Ok(room.users.iter().map(|u| PresenceUpdate {
        user_id: u.id.clone(), cursor_line: u.cursor_line, cursor_col: u.cursor_col,
        selection_start: None, selection_end: None, status: u.status.clone(),
    }).collect())
}

#[command]
pub async fn send_operation(room_id: String, operation: TextOperation) -> Result<(), String> {
    let state = COLLAB_STATE.read().await;
    let _room = state.rooms.get(&room_id).ok_or("Room not found")?;
    log::info!("Operation in {}: {:?}", room_id, operation);
    Ok(())
}

#[command]
pub async fn send_chat_message(room_id: String, message: String) -> Result<(), String> {
    let state = COLLAB_STATE.read().await;
    let _room = state.rooms.get(&room_id).ok_or("Room not found")?;
    log::info!("Chat in {}: {}", room_id, message);
    Ok(())
}

#[command]
pub async fn get_collab_stats(room_id: String) -> Result<RoomStats, String> {
    let state = COLLAB_STATE.read().await;
    let room = state.rooms.get(&room_id).ok_or("Room not found")?;
    Ok(RoomStats { user_count: room.users.len(), operation_count: 0, uptime_secs: 0 })
}

#[command]
pub async fn is_connected_to_room() -> Result<bool, String> {
    let state = COLLAB_STATE.read().await;
    Ok(state.connected)
}

#[command]
pub async fn get_current_room() -> Result<Option<RoomInfo>, String> {
    let state = COLLAB_STATE.read().await;
    if let Some(ref room_id) = state.current_room {
        Ok(state.rooms.get(room_id).cloned())
    } else {
        Ok(None)
    }
}

#[command]
pub async fn list_rooms() -> Result<Vec<RoomInfo>, String> {
    let state = COLLAB_STATE.read().await;
    Ok(state.rooms.values().cloned().collect())
}
