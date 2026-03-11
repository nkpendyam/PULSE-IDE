//! WebSocket Client for Real-time Collaboration
//!
//! Real WebSocket connections using tokio-tungstenite

use tauri::State;
use std::sync::Arc;
use tokio::sync::RwLock;
use futures_util::{SinkExt, StreamExt};

/// WebSocket connection status
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
pub enum WsStatus {
    Disconnected,
    Connecting,
    Connected,
    Reconnecting,
    Error,
}

/// WebSocket message types
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type")]
pub enum WsMessage {
    #[serde(rename = "join")]
    Join { room_id: String, user_id: String },
    #[serde(rename = "leave")]
    Leave { room_id: String, user_id: String },
    #[serde(rename = "presence")]
    Presence { user_id: String, cursor: CursorPosition },
    #[serde(rename = "operation")]
    Operation { room_id: String, operation: TextOperation },
    #[serde(rename = "chat")]
    Chat { room_id: String, user_id: String, message: String },
    #[serde(rename = "encrypted")]
    Encrypted { room_id: String, data: Vec<u8> },
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CursorPosition {
    pub line: u32,
    pub column: u32,
    pub file: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TextOperation {
    pub operation_type: String,
    pub position: u32,
    pub content: String,
    pub length: u32,
    pub user_id: String,
    pub timestamp: u64,
}

type WsSink = futures_util::stream::SplitSink<
    tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>,
    tokio_tungstenite::tungstenite::Message,
>;

/// WebSocket state
pub struct WsState {
    pub status: WsStatus,
    pub server_url: Option<String>,
    pub connected_room: Option<String>,
    pub reconnect_attempts: u32,
    pub max_reconnect_attempts: u32,
    sender: Option<WsSink>,
}

impl Default for WsState {
    fn default() -> Self {
        Self {
            status: WsStatus::Disconnected,
            server_url: None,
            connected_room: None,
            reconnect_attempts: 0,
            max_reconnect_attempts: 5,
            sender: None,
        }
    }
}

// ============ Tauri Commands ============

#[tauri::command]
pub async fn ws_connect(
    server_url: String,
    state: State<'_, Arc<RwLock<WsState>>>,
) -> Result<String, String> {
    {
        let mut ws = state.write().await;
        ws.status = WsStatus::Connecting;
        ws.server_url = Some(server_url.clone());
    }
    
    // Real WebSocket connection via tokio-tungstenite
    match tokio_tungstenite::connect_async(&server_url).await {
        Ok((ws_stream, _response)) => {
            let (write, mut read) = ws_stream.split();
            let mut ws = state.write().await;
            ws.sender = Some(write);
            ws.status = WsStatus::Connected;
            ws.reconnect_attempts = 0;

            // Spawn a reader task that drains incoming messages
            let state_clone = Arc::clone(&state.inner());
            tokio::spawn(async move {
                while let Some(msg) = read.next().await {
                    match msg {
                        Ok(_) => { /* Messages received from server — can emit Tauri events in future */ }
                        Err(e) => {
                            log::warn!("WebSocket read error: {}", e);
                            let mut ws = state_clone.write().await;
                            ws.status = WsStatus::Disconnected;
                            ws.sender = None;
                            break;
                        }
                    }
                }
            });

            Ok("Connected successfully".to_string())
        }
        Err(e) => {
            let mut ws = state.write().await;
            ws.status = WsStatus::Error;
            Err(format!("WebSocket connection failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn ws_disconnect(
    state: State<'_, Arc<RwLock<WsState>>>,
) -> Result<(), String> {
    let mut ws = state.write().await;
    // Close the sender (which drops the connection)
    if let Some(mut sink) = ws.sender.take() {
        let _ = sink.close().await;
    }
    ws.status = WsStatus::Disconnected;
    ws.connected_room = None;
    Ok(())
}

#[tauri::command]
pub async fn ws_get_status(
    state: State<'_, Arc<RwLock<WsState>>>,
) -> Result<WsStatus, String> {
    let ws = state.read().await;
    Ok(ws.status.clone())
}

#[tauri::command]
pub async fn ws_join_room(
    room_id: String,
    state: State<'_, Arc<RwLock<WsState>>>,
) -> Result<(), String> {
    let mut ws = state.write().await;
    if ws.status != WsStatus::Connected {
        return Err("Not connected to WebSocket server".to_string());
    }
    // Send join message over WebSocket
    let msg = WsMessage::Join { room_id: room_id.clone(), user_id: "local".to_string() };
    if let Some(ref mut sink) = ws.sender {
        let json = serde_json::to_string(&msg).map_err(|e| e.to_string())?;
        sink.send(tokio_tungstenite::tungstenite::Message::Text(json))
            .await.map_err(|e| format!("Failed to send join: {}", e))?;
    }
    ws.connected_room = Some(room_id);
    Ok(())
}

#[tauri::command]
pub async fn ws_leave_room(
    state: State<'_, Arc<RwLock<WsState>>>,
) -> Result<(), String> {
    let mut ws = state.write().await;
    if let Some(room_id) = ws.connected_room.take() {
        let msg = WsMessage::Leave { room_id, user_id: "local".to_string() };
        if let Some(ref mut sink) = ws.sender {
            let json = serde_json::to_string(&msg).map_err(|e| e.to_string())?;
            let _ = sink.send(tokio_tungstenite::tungstenite::Message::Text(json)).await;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn ws_send_message(
    message: WsMessage,
    state: State<'_, Arc<RwLock<WsState>>>,
) -> Result<(), String> {
    let mut ws = state.write().await;
    if ws.status != WsStatus::Connected {
        return Err("Not connected to WebSocket server".to_string());
    }
    
    let json = serde_json::to_string(&message).map_err(|e| e.to_string())?;
    if let Some(ref mut sink) = ws.sender {
        sink.send(tokio_tungstenite::tungstenite::Message::Text(json))
            .await.map_err(|e| format!("Failed to send message: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn ws_send_presence(
    cursor: CursorPosition,
    state: State<'_, Arc<RwLock<WsState>>>,
) -> Result<(), String> {
    let mut ws = state.write().await;
    if ws.status != WsStatus::Connected {
        return Err("Not connected".to_string());
    }
    
    let msg = WsMessage::Presence { user_id: "local".to_string(), cursor };
    let json = serde_json::to_string(&msg).map_err(|e| e.to_string())?;
    if let Some(ref mut sink) = ws.sender {
        sink.send(tokio_tungstenite::tungstenite::Message::Text(json))
            .await.map_err(|e| format!("Failed to send presence: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn ws_send_operation(
    operation: TextOperation,
    state: State<'_, Arc<RwLock<WsState>>>,
) -> Result<(), String> {
    let mut ws = state.write().await;
    if ws.status != WsStatus::Connected {
        return Err("Not connected".to_string());
    }
    
    let msg = WsMessage::Operation {
        room_id: ws.connected_room.clone().unwrap_or_default(),
        operation,
    };
    let json = serde_json::to_string(&msg).map_err(|e| e.to_string())?;
    if let Some(ref mut sink) = ws.sender {
        sink.send(tokio_tungstenite::tungstenite::Message::Text(json))
            .await.map_err(|e| format!("Failed to send operation: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn ws_get_server_url(
    state: State<'_, Arc<RwLock<WsState>>>,
) -> Result<Option<String>, String> {
    let ws = state.read().await;
    Ok(ws.server_url.clone())
}

#[tauri::command]
pub async fn ws_set_reconnect_handler(
    max_attempts: u32,
    state: State<'_, Arc<RwLock<WsState>>>,
) -> Result<(), String> {
    let mut ws = state.write().await;
    ws.max_reconnect_attempts = max_attempts;
    Ok(())
}
