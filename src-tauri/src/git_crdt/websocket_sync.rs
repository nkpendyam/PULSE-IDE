//! WebSocket Sync Layer for Git-CRDT Collaboration
//!
//! Provides real-time synchronization between KYRO IDE instances

use anyhow::{Result, Context};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{broadcast, RwLock, mpsc};
use tokio_tungstenite::{accept_async, WebSocketStream};
use tokio_tungstenite::tungstenite::Message;

/// Collaboration WebSocket Server
pub struct CollaborationServer {
    port: u16,
    sessions: Arc<RwLock<HashMap<String, CollaborationSession>>>,
    message_sender: broadcast::Sender<CollaborationMessage>,
    running: Arc<RwLock<bool>>,
}

/// Active collaboration session
#[derive(Debug, Clone)]
pub struct CollaborationSession {
    pub session_id: String,
    pub document_id: String,
    pub user_id: String,
    pub connected_at: chrono::DateTime<chrono::Utc>,
    pub last_activity: chrono::DateTime<chrono::Utc>,
}

/// Messages for collaboration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CollaborationMessage {
    /// Join a document session
    JoinDocument {
        document_id: String,
        user_id: String,
        user_name: String,
        user_color: String,
    },
    
    /// Leave document session
    LeaveDocument {
        document_id: String,
        user_id: String,
    },
    
    /// Yjs document update
    DocumentUpdate {
        document_id: String,
        user_id: String,
        update: Vec<u8>,
        timestamp: u64,
    },
    
    /// Awareness update (cursor, selection)
    AwarenessUpdate {
        document_id: String,
        user_id: String,
        cursor: Option<CursorPosition>,
        selection: Option<SelectionRange>,
    },
    
    /// Request full document state
    RequestState {
        document_id: String,
        user_id: String,
    },
    
    /// Full document state response
    FullState {
        document_id: String,
        state: Vec<u8>,
        version: u64,
    },
    
    /// Chat message
    Chat {
        document_id: String,
        user_id: String,
        user_name: String,
        message: String,
        timestamp: u64,
    },
    
    /// Heartbeat
    Heartbeat {
        user_id: String,
    },
}

/// Cursor position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorPosition {
    pub line: u32,
    pub column: u32,
    pub file_path: Option<String>,
}

/// Selection range
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectionRange {
    pub start: CursorPosition,
    pub end: CursorPosition,
}

impl CollaborationServer {
    /// Create a new collaboration server
    pub fn new(port: u16) -> Self {
        let (message_sender, _) = broadcast::channel(1000);
        
        Self {
            port,
            sessions: Arc::new(RwLock::new(HashMap::new())),
            message_sender,
            running: Arc::new(RwLock::new(false)),
        }
    }

    /// Start the server
    pub async fn start(&self) -> Result<()> {
        let addr: SocketAddr = format!("0.0.0.0:{}", self.port).parse()
            .context("Invalid address")?;

        let listener = TcpListener::bind(addr).await
            .context("Failed to bind server")?;

        *self.running.write().await = true;
        println!("Collaboration server listening on {}", addr);

        loop {
            // Check if still running
            if !*self.running.read().await {
                break;
            }

            let (stream, peer_addr) = listener.accept().await?;
            
            let sessions = self.sessions.clone();
            let message_sender = self.message_sender.clone();
            let running = self.running.clone();

            tokio::spawn(async move {
                if let Err(e) = Self::handle_connection(stream, peer_addr, sessions, message_sender, running).await {
                    eprintln!("Connection error from {}: {}", peer_addr, e);
                }
            });
        }

        Ok(())
    }

    /// Handle incoming WebSocket connection
    async fn handle_connection(
        stream: TcpStream,
        peer_addr: SocketAddr,
        sessions: Arc<RwLock<HashMap<String, CollaborationSession>>>,
        message_sender: broadcast::Sender<CollaborationMessage>,
        running: Arc<RwLock<bool>>,
    ) -> Result<()> {
        let ws_stream = accept_async(stream).await
            .context("Failed to accept WebSocket")?;

        let (mut ws_sender, mut ws_receiver) = ws_stream.split();
        let session_id = uuid::Uuid::new_v4().to_string();
        let mut current_user_id: Option<String> = None;
        let mut current_document_id: Option<String> = None;

        // Subscribe to messages
        let mut message_receiver = message_sender.subscribe();

        println!("New collaboration connection from {}", peer_addr);

        loop {
            if !*running.read().await {
                break;
            }

            tokio::select! {
                // Handle incoming messages from client
                msg = ws_receiver.next() => {
                    match msg {
                        Some(Ok(Message::Text(text))) => {
                            if let Ok(collab_msg) = serde_json::from_str::<CollaborationMessage>(&text) {
                                // Track session
                                match &collab_msg {
                                    CollaborationMessage::JoinDocument { document_id, user_id, .. } => {
                                        current_user_id = Some(user_id.clone());
                                        current_document_id = Some(document_id.clone());
                                        
                                        let session = CollaborationSession {
                                            session_id: session_id.clone(),
                                            document_id: document_id.clone(),
                                            user_id: user_id.clone(),
                                            connected_at: chrono::Utc::now(),
                                            last_activity: chrono::Utc::now(),
                                        };
                                        
                                        sessions.write().await.insert(session_id.clone(), session);
                                    }
                                    CollaborationMessage::LeaveDocument { .. } => {
                                        sessions.write().await.remove(&session_id);
                                    }
                                    _ => {}
                                }
                                
                                // Broadcast to other clients
                                let _ = message_sender.send(collab_msg);
                            }
                        }
                        Some(Ok(Message::Binary(data))) => {
                            if let Ok(collab_msg) = serde_json::from_slice::<CollaborationMessage>(&data) {
                                let _ = message_sender.send(collab_msg);
                            }
                        }
                        Some(Ok(Message::Ping(data))) => {
                            let _ = ws_sender.send(Message::Pong(data)).await;
                        }
                        Some(Ok(Message::Close(_))) => {
                            break;
                        }
                        _ => {}
                    }
                }

                // Handle messages from other clients
                msg = message_receiver.recv() => {
                    if let Ok(collab_msg) = msg {
                        // Don't echo back to sender
                        let should_forward = match &collab_msg {
                            CollaborationMessage::DocumentUpdate { user_id, .. } => {
                                Some(user_id.as_str()) != current_user_id.as_deref()
                            }
                            CollaborationMessage::AwarenessUpdate { user_id, .. } => {
                                Some(user_id.as_str()) != current_user_id.as_deref()
                            }
                            CollaborationMessage::Chat { user_id, .. } => {
                                Some(user_id.as_str()) != current_user_id.as_deref()
                            }
                            _ => true,
                        };

                        if should_forward {
                            let json = serde_json::to_string(&collab_msg)?;
                            let _ = ws_sender.send(Message::Text(json)).await;
                        }
                    }
                }
            }
        }

        // Cleanup
        if let (Some(user_id), Some(document_id)) = (&current_user_id, &current_document_id) {
            let leave_msg = CollaborationMessage::LeaveDocument {
                document_id: document_id.clone(),
                user_id: user_id.clone(),
            };
            let _ = message_sender.send(leave_msg);
        }
        
        sessions.write().await.remove(&session_id);
        println!("Collaboration connection closed: {}", peer_addr);

        Ok(())
    }

    /// Stop the server
    pub async fn stop(&self) {
        *self.running.write().await = false;
    }

    /// Get active sessions
    pub async fn get_sessions(&self) -> Vec<CollaborationSession> {
        self.sessions.read().await.values().cloned().collect()
    }

    /// Get sessions for a document
    pub async fn get_document_sessions(&self, document_id: &str) -> Vec<CollaborationSession> {
        self.sessions.read().await.values()
            .filter(|s| s.document_id == document_id)
            .cloned()
            .collect()
    }

    /// Broadcast a message to all clients
    pub fn broadcast(&self, message: CollaborationMessage) -> Result<()> {
        self.message_sender.send(message)?;
        Ok(())
    }

    /// Get session count
    pub async fn session_count(&self) -> usize {
        self.sessions.read().await.len()
    }
}

/// Collaboration client for connecting to remote servers
pub struct CollaborationClient {
    server_url: String,
    user_id: String,
    user_name: String,
    user_color: String,
    message_sender: mpsc::Sender<CollaborationMessage>,
    message_receiver: Option<mpsc::Receiver<CollaborationMessage>>,
}

impl CollaborationClient {
    /// Create a new collaboration client
    pub fn new(server_url: String, user_id: String, user_name: String, user_color: String) -> Self {
        let (sender, receiver) = mpsc::channel(100);
        
        Self {
            server_url,
            user_id,
            user_name,
            user_color,
            message_sender: sender,
            message_receiver: Some(receiver),
        }
    }

    /// Connect to the server
    pub async fn connect(&mut self) -> Result<()> {
        // In production, this would establish WebSocket connection
        println!("Connecting to collaboration server: {}", self.server_url);
        Ok(())
    }

    /// Join a document
    pub async fn join_document(&self, document_id: &str) -> Result<()> {
        let msg = CollaborationMessage::JoinDocument {
            document_id: document_id.to_string(),
            user_id: self.user_id.clone(),
            user_name: self.user_name.clone(),
            user_color: self.user_color.clone(),
        };
        
        self.message_sender.send(msg).await?;
        Ok(())
    }

    /// Send document update
    pub async fn send_update(&self, document_id: &str, update: Vec<u8>) -> Result<()> {
        let msg = CollaborationMessage::DocumentUpdate {
            document_id: document_id.to_string(),
            user_id: self.user_id.clone(),
            update,
            timestamp: chrono::Utc::now().timestamp() as u64,
        };
        
        self.message_sender.send(msg).await?;
        Ok(())
    }

    /// Send awareness update
    pub async fn send_awareness(&self, document_id: &str, cursor: Option<CursorPosition>, selection: Option<SelectionRange>) -> Result<()> {
        let msg = CollaborationMessage::AwarenessUpdate {
            document_id: document_id.to_string(),
            user_id: self.user_id.clone(),
            cursor,
            selection,
        };
        
        self.message_sender.send(msg).await?;
        Ok(())
    }

    /// Get message receiver
    pub fn take_receiver(&mut self) -> Option<mpsc::Receiver<CollaborationMessage>> {
        self.message_receiver.take()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_server_creation() {
        let server = CollaborationServer::new(9174);
        assert_eq!(server.port, 9174);
    }

    #[test]
    fn test_message_serialization() {
        let msg = CollaborationMessage::JoinDocument {
            document_id: "doc1".to_string(),
            user_id: "user1".to_string(),
            user_name: "Alice".to_string(),
            user_color: "#ff0000".to_string(),
        };
        
        let json = serde_json::to_string(&msg).unwrap();
        let decoded: CollaborationMessage = serde_json::from_str(&json).unwrap();
        
        match decoded {
            CollaborationMessage::JoinDocument { document_id, .. } => {
                assert_eq!(document_id, "doc1");
            }
            _ => panic!("Wrong message type"),
        }
    }
}
