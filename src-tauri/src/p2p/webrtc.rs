//! P2P WebRTC Connection Manager
//!
//! Implements WebRTC-based peer connections for internet-based collaboration.
//! Uses tokio-tungstenite for signaling and manages peer connections.

use anyhow::{Result, Context, bail};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, Mutex, mpsc, broadcast};
use serde::{Deserialize, Serialize};
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::{WebSocketStream, connect_async, tungstenite::Message as WsMessage};
use tokio_tungstenite::tungstenite::protocol::frame::coding::CloseCode;

use super::{PeerId, Peer, PeerMessage, StateChange};

/// WebRTC signaling server URL
pub const DEFAULT_SIGNALING_SERVER: &str = "wss://signal.kyro.app";

/// WebRTC configuration
#[derive(Debug, Clone)]
pub struct WebRTCConfig {
    /// Signaling server URL
    pub signaling_server: String,
    /// Enable STUN servers for NAT traversal
    pub stun_servers: Vec<String>,
    /// Enable TURN servers for relay
    pub turn_servers: Vec<TurnServer>,
    /// Connection timeout in seconds
    pub timeout_secs: u64,
    /// Enable ICE candidate gathering
    pub ice_gathering: bool,
}

impl Default for WebRTCConfig {
    fn default() -> Self {
        Self {
            signaling_server: DEFAULT_SIGNALING_SERVER.to_string(),
            stun_servers: vec![
                "stun:stun.l.google.com:19302".to_string(),
                "stun:stun1.l.google.com:19302".to_string(),
            ],
            turn_servers: vec![],
            timeout_secs: 30,
            ice_gathering: true,
        }
    }
}

/// TURN server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurnServer {
    pub url: String,
    pub username: Option<String>,
    pub credential: Option<String>,
}

/// ICE candidate
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IceCandidate {
    pub candidate: String,
    pub sdp_mid: String,
    pub sdp_mline_index: u32,
}

/// SDP offer/answer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionDescription {
    pub sdp: String,
    pub r#type: String, // "offer" or "answer"
}

/// Signaling message types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SignalingMessage {
    /// Register with signaling server
    Register {
        peer_id: PeerId,
        display_name: String,
        public_key: Vec<u8>,
    },
    /// SDP offer
    Offer {
        from: PeerId,
        to: PeerId,
        sdp: SessionDescription,
    },
    /// SDP answer
    Answer {
        from: PeerId,
        to: PeerId,
        sdp: SessionDescription,
    },
    /// ICE candidate
    IceCandidate {
        from: PeerId,
        to: PeerId,
        candidate: IceCandidate,
    },
    /// Peer presence
    PeerJoined(Peer),
    /// Peer left
    PeerLeft(PeerId),
    /// Error
    Error { message: String },
    /// Heartbeat
    Heartbeat,
}

/// Connection state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConnectionState {
    New,
    Connecting,
    Connected,
    Disconnected,
    Failed,
    Closed,
}

/// Peer connection state
struct PeerConnection {
    peer_id: PeerId,
    state: ConnectionState,
    local_sdp: Option<SessionDescription>,
    remote_sdp: Option<SessionDescription>,
    ice_candidates: Vec<IceCandidate>,
    pending_messages: Vec<PeerMessage>,
}

/// WebRTC connection manager
pub struct WebRTCManager {
    config: WebRTCConfig,
    local_peer_id: PeerId,
    connections: Arc<RwLock<HashMap<PeerId, PeerConnection>>>,
    signaling_tx: Option<mpsc::Sender<SignalingMessage>>,
    message_tx: mpsc::Sender<PeerMessage>,
    event_tx: broadcast::Sender<ConnectionEvent>,
    running: Arc<Mutex<bool>>,
}

/// Connection events
#[derive(Debug, Clone)]
pub enum ConnectionEvent {
    PeerConnected(PeerId),
    PeerDisconnected(PeerId),
    MessageReceived { from: PeerId, message: PeerMessage },
    ConnectionFailed { peer: PeerId, reason: String },
    SignalingConnected,
    SignalingDisconnected,
}

impl WebRTCManager {
    /// Create a new WebRTC manager
    pub fn new(local_peer_id: PeerId, config: WebRTCConfig) -> (Self, mpsc::Receiver<PeerMessage>) {
        let (message_tx, message_rx) = mpsc::channel(100);
        let (event_tx, _) = broadcast::channel(64);
        
        (
            Self {
                config,
                local_peer_id,
                connections: Arc::new(RwLock::new(HashMap::new())),
                signaling_tx: None,
                message_tx,
                event_tx,
                running: Arc::new(Mutex::new(false)),
            },
            message_rx,
        )
    }
    
    /// Connect to signaling server
    pub async fn connect_signaling(&mut self, display_name: String, public_key: Vec<u8>) -> Result<()> {
        let url = self.config.signaling_server.clone();
        let (ws_stream, _) = connect_async(&url)
            .await
            .context("Failed to connect to signaling server")?;
        
        log::info!("Connected to signaling server: {}", url);
        
        let (write, mut read) = ws_stream.split();
        let write = Arc::new(Mutex::new(write));
        
        // Create signaling channel
        let (tx, mut rx) = mpsc::channel::<SignalingMessage>(64);
        self.signaling_tx = Some(tx);
        
        // Send registration
        let register = SignalingMessage::Register {
            peer_id: self.local_peer_id.clone(),
            display_name,
            public_key,
        };
        self.send_signaling_message(&register).await?;
        
        // Spawn message sender
        let write_clone = write.clone();
        let running = self.running.clone();
        tokio::spawn(async move {
            while let Some(msg) = rx.recv().await {
                let json = serde_json::to_string(&msg).unwrap_or_default();
                let ws_msg = WsMessage::Text(json);
                
                if let Err(e) = write_clone.lock().await.send(ws_msg).await {
                    log::error!("Failed to send signaling message: {}", e);
                    break;
                }
                
                if !*running.lock().await {
                    break;
                }
            }
        });
        
        // Spawn message receiver
        let connections = self.connections.clone();
        let event_tx = self.event_tx.clone();
        let message_tx = self.message_tx.clone();
        let running = self.running.clone();
        
        tokio::spawn(async move {
            while let Some(msg_result) = read.next().await {
                if !*running.lock().await {
                    break;
                }
                
                match msg_result {
                    Ok(WsMessage::Text(text)) => {
                        if let Ok(signaling_msg) = serde_json::from_str::<SignalingMessage>(&text) {
                            Self::handle_signaling_message(
                                signaling_msg,
                                &connections,
                                &event_tx,
                                &message_tx,
                            ).await;
                        }
                    }
                    Ok(WsMessage::Ping(data)) => {
                        // Respond with pong - handled automatically
                        log::debug!("Received ping");
                        let _ = data;
                    }
                    Ok(WsMessage::Close(_)) => {
                        log::info!("Signaling server closed connection");
                        let _ = event_tx.send(ConnectionEvent::SignalingDisconnected);
                        break;
                    }
                    Err(e) => {
                        log::error!("Signaling error: {}", e);
                        break;
                    }
                    _ => {}
                }
            }
        });
        
        *self.running.lock().await = true;
        let _ = self.event_tx.send(ConnectionEvent::SignalingConnected);
        
        Ok(())
    }
    
    /// Send signaling message
    async fn send_signaling_message(&self, msg: &SignalingMessage) -> Result<()> {
        if let Some(tx) = &self.signaling_tx {
            tx.send(msg.clone()).await
                .context("Failed to send signaling message")?;
        }
        Ok(())
    }
    
    /// Handle incoming signaling message
    async fn handle_signaling_message(
        msg: SignalingMessage,
        connections: &Arc<RwLock<HashMap<PeerId, PeerConnection>>>,
        event_tx: &broadcast::Sender<ConnectionEvent>,
        message_tx: &mpsc::Sender<PeerMessage>,
    ) {
        match msg {
            SignalingMessage::Offer { from, sdp, .. } => {
                log::info!("Received offer from peer: {}", from.as_str());
                
                // Store remote SDP and create answer
                let mut conns = connections.write().await;
                if let Some(conn) = conns.get_mut(&from) {
                    conn.remote_sdp = Some(sdp);
                    conn.state = ConnectionState::Connecting;
                }
            }
            SignalingMessage::Answer { from, sdp, .. } => {
                log::info!("Received answer from peer: {}", from.as_str());
                
                let mut conns = connections.write().await;
                if let Some(conn) = conns.get_mut(&from) {
                    conn.remote_sdp = Some(sdp);
                    conn.state = ConnectionState::Connected;
                }
                
                let _ = event_tx.send(ConnectionEvent::PeerConnected(from));
            }
            SignalingMessage::IceCandidate { from, candidate, .. } => {
                log::debug!("Received ICE candidate from peer: {}", from.as_str());
                
                let mut conns = connections.write().await;
                if let Some(conn) = conns.get_mut(&from) {
                    conn.ice_candidates.push(candidate);
                }
            }
            SignalingMessage::PeerJoined(peer) => {
                log::info!("Peer joined: {}", peer.name);
                
                // Create new connection entry
                let mut conns = connections.write().await;
                conns.insert(peer.id.clone(), PeerConnection {
                    peer_id: peer.id.clone(),
                    state: ConnectionState::New,
                    local_sdp: None,
                    remote_sdp: None,
                    ice_candidates: Vec::new(),
                    pending_messages: Vec::new(),
                });
            }
            SignalingMessage::PeerLeft(peer_id) => {
                log::info!("Peer left: {}", peer_id.as_str());
                
                let mut conns = connections.write().await;
                conns.remove(&peer_id);
                
                let _ = event_tx.send(ConnectionEvent::PeerDisconnected(peer_id));
            }
            SignalingMessage::Error { message } => {
                log::error!("Signaling error: {}", message);
            }
            SignalingMessage::Heartbeat => {
                // Keep-alive, no action needed
            }
            SignalingMessage::Register { .. } => {
                // Ignore registration messages (only sent by us)
            }
        }
    }
    
    /// Connect to a peer
    pub async fn connect_to_peer(&self, peer_id: PeerId) -> Result<()> {
        // Create new connection
        let conn = PeerConnection {
            peer_id: peer_id.clone(),
            state: ConnectionState::Connecting,
            local_sdp: None,
            remote_sdp: None,
            ice_candidates: Vec::new(),
            pending_messages: Vec::new(),
        };
        
        self.connections.write().await.insert(peer_id.clone(), conn);
        
        // For WebRTC, we would create an offer here
        // Since we're using WebSocket for signaling, we simulate the connection
        log::info!("Initiating connection to peer: {}", peer_id.as_str());
        
        // Simulate offer
        let offer = SessionDescription {
            sdp: format!("v=0\r\no=- {} 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n", 
                chrono::Utc::now().timestamp()),
            r#type: "offer".to_string(),
        };
        
        self.send_signaling_message(&SignalingMessage::Offer {
            from: self.local_peer_id.clone(),
            to: peer_id,
            sdp: offer,
        }).await?;
        
        Ok(())
    }
    
    /// Send message to peer
    pub async fn send_to(&self, peer_id: &PeerId, message: PeerMessage) -> Result<()> {
        let connections = self.connections.read().await;
        
        match connections.get(peer_id) {
            Some(conn) if conn.state == ConnectionState::Connected => {
                // Serialize and send via WebSocket
                let json = serde_json::to_string(&message)
                    .context("Failed to serialize message")?;
                
                // In a real WebRTC implementation, this would go through data channel
                // For now, we use the signaling channel for simplicity
                let signaling_msg = SignalingMessage::Offer {
                    from: self.local_peer_id.clone(),
                    to: peer_id.clone(),
                    sdp: SessionDescription {
                        sdp: json,
                        r#type: "data".to_string(),
                    },
                };
                
                self.send_signaling_message(&signaling_msg).await?;
                log::debug!("Sent message to peer {}", peer_id.as_str());
            }
            Some(conn) => {
                // Queue message for later
                log::debug!("Peer {} not connected (state: {:?}), queuing message", 
                    peer_id.as_str(), conn.state);
                drop(connections);
                
                let mut conns = self.connections.write().await;
                if let Some(c) = conns.get_mut(peer_id) {
                    c.pending_messages.push(message);
                }
            }
            None => {
                bail!("No connection to peer {}", peer_id.as_str());
            }
        }
        
        Ok(())
    }
    
    /// Broadcast message to all connected peers
    pub async fn broadcast(&self, message: PeerMessage) -> Result<()> {
        let connections = self.connections.read().await;
        let peer_ids: Vec<_> = connections
            .iter()
            .filter(|(_, c)| c.state == ConnectionState::Connected)
            .map(|(id, _)| id.clone())
            .collect();
        drop(connections);
        
        for peer_id in &peer_ids {
            self.send_to(peer_id, message.clone()).await?;
        }
        
        Ok(())
    }
    
    /// Disconnect from a peer
    pub async fn disconnect(&self, peer_id: &PeerId) -> Result<()> {
        let mut connections = self.connections.write().await;
        
        if let Some(mut conn) = connections.remove(peer_id) {
            conn.state = ConnectionState::Closed;
            log::info!("Disconnected from peer {}", peer_id.as_str());
        }
        
        let _ = self.event_tx.send(ConnectionEvent::PeerDisconnected(peer_id.clone()));
        
        Ok(())
    }
    
    /// Disconnect from all peers
    pub async fn disconnect_all(&self) -> Result<()> {
        let mut connections = self.connections.write().await;
        
        for (_, conn) in connections.iter_mut() {
            conn.state = ConnectionState::Closed;
        }
        
        connections.clear();
        log::info!("Disconnected from all peers");
        
        Ok(())
    }
    
    /// Get connected peers
    pub async fn get_connected_peers(&self) -> Vec<PeerId> {
        self.connections
            .read()
            .await
            .iter()
            .filter(|(_, c)| c.state == ConnectionState::Connected)
            .map(|(id, _)| id.clone())
            .collect()
    }
    
    /// Get connection state
    pub async fn get_connection_state(&self, peer_id: &PeerId) -> Option<ConnectionState> {
        self.connections
            .read()
            .await
            .get(peer_id)
            .map(|c| c.state)
    }
    
    /// Subscribe to connection events
    pub fn subscribe(&self) -> broadcast::Receiver<ConnectionEvent> {
        self.event_tx.subscribe()
    }
    
    /// Shutdown
    pub async fn shutdown(&self) -> Result<()> {
        *self.running.lock().await = false;
        self.disconnect_all().await?;
        log::info!("WebRTC manager shutdown complete");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_config_default() {
        let config = WebRTCConfig::default();
        assert!(!config.stun_servers.is_empty());
        assert!(config.ice_gathering);
    }
    
    #[tokio::test]
    async fn test_manager_creation() {
        let peer_id = PeerId::new();
        let (manager, _rx) = WebRTCManager::new(peer_id, WebRTCConfig::default());
        
        let peers = manager.get_connected_peers().await;
        assert!(peers.is_empty());
    }
    
    #[test]
    fn test_signaling_message_serialization() {
        let msg = SignalingMessage::Offer {
            from: PeerId::new(),
            to: PeerId::new(),
            sdp: SessionDescription {
                sdp: "test".to_string(),
                r#type: "offer".to_string(),
            },
        };
        
        let json = serde_json::to_string(&msg).unwrap();
        let decoded: SignalingMessage = serde_json::from_str(&json).unwrap();
        
        match decoded {
            SignalingMessage::Offer { .. } => (),
            _ => panic!("Wrong message type"),
        }
    }
}
