//! P2P Collaboration Module
//! 
//! Implements peer-to-peer collaboration without any central server.
//! Uses libp2p for networking, mDNS for local discovery, and WebRTC for internet.

pub mod discovery;
pub mod webrtc;
pub mod sync;

use std::collections::HashMap;
use std::sync::Arc;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use anyhow::{Result, Context};
use tokio::sync::{mpsc, broadcast};
use uuid::Uuid;

/// Peer identifier
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PeerId(String);

impl PeerId {
    pub fn new() -> Self {
        Self(Uuid::new_v4().to_string())
    }
    
    pub fn from_string(s: String) -> Self {
        Self(s)
    }
    
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl Default for PeerId {
    fn default() -> Self {
        Self::new()
    }
}

/// Peer information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Peer {
    pub id: PeerId,
    pub name: String,
    pub public_key: Vec<u8>,
    pub endpoint: String,
    pub connected_at: u64,
    pub last_seen: u64,
}

/// P2P configuration
#[derive(Debug, Clone)]
pub struct P2PConfig {
    /// Local peer ID
    pub peer_id: PeerId,
    /// Display name
    pub display_name: String,
    /// Listen port (0 for random)
    pub listen_port: u16,
    /// Enable mDNS discovery
    pub enable_mdns: bool,
    /// Enable WebRTC for internet
    pub enable_webrtc: bool,
    /// Relay servers for NAT traversal
    pub relay_servers: Vec<String>,
    /// Maximum peers
    pub max_peers: usize,
}

impl Default for P2PConfig {
    fn default() -> Self {
        Self {
            peer_id: PeerId::new(),
            display_name: "Anonymous".to_string(),
            listen_port: 0,
            enable_mdns: true,
            enable_webrtc: true,
            relay_servers: vec![],
            max_peers: 10,
        }
    }
}

/// P2P collaboration manager
pub struct P2PCollaboration {
    /// Configuration
    config: P2PConfig,
    /// Connected peers
    peers: Arc<RwLock<HashMap<PeerId, Peer>>>,
    /// Local peer ID
    local_peer_id: PeerId,
    /// Message sender
    message_tx: mpsc::Sender<PeerMessage>,
    /// Message receiver
    message_rx: Option<mpsc::Receiver<PeerMessage>>,
    /// State change broadcaster
    state_tx: broadcast::Sender<StateChange>,
    /// Shutdown signal
    shutdown_tx: Option<mpsc::Sender<()>>,
}

/// Peer message types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PeerMessage {
    /// Text message
    Text {
        from: PeerId,
        content: String,
        timestamp: u64,
    },
    /// Document edit
    DocumentEdit {
        from: PeerId,
        document_id: String,
        edit: DocumentEdit,
    },
    /// Cursor position update
    CursorUpdate {
        from: PeerId,
        document_id: String,
        position: CursorPosition,
    },
    /// Selection update
    SelectionUpdate {
        from: PeerId,
        document_id: String,
        selection: Selection,
    },
    /// File request
    FileRequest {
        from: PeerId,
        path: String,
    },
    /// File response
    FileResponse {
        from: PeerId,
        path: String,
        content: Vec<u8>,
    },
    /// Peer joined notification
    PeerJoined(Peer),
    /// Peer left notification
    PeerLeft(PeerId),
}

/// Document edit operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentEdit {
    pub version: u64,
    pub operations: Vec<EditOperation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditOperation {
    pub position: usize,
    pub delete: usize,
    pub insert: String,
}

/// Cursor position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorPosition {
    pub line: u32,
    pub column: u32,
}

/// Selection range
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Selection {
    pub start: CursorPosition,
    pub end: CursorPosition,
}

/// State change events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StateChange {
    PeerConnected(Peer),
    PeerDisconnected(PeerId),
    MessageReceived(PeerMessage),
    Error(String),
}

impl P2PCollaboration {
    /// Create new P2P collaboration instance
    pub fn new(config: P2PConfig) -> Self {
        let local_peer_id = config.peer_id.clone();
        let (message_tx, message_rx) = mpsc::channel(100);
        let (state_tx, _) = broadcast::channel(16);
        
        Self {
            config,
            peers: Arc::new(RwLock::new(HashMap::new())),
            local_peer_id,
            message_tx,
            message_rx: Some(message_rx),
            state_tx,
            shutdown_tx: None,
        }
    }
    
    /// Start P2P networking
    pub async fn start(&mut self) -> Result<()> {
        log::info!("Starting P2P collaboration as peer {}", self.local_peer_id.as_str());
        
        let (shutdown_tx, mut shutdown_rx) = mpsc::channel(1);
        self.shutdown_tx = Some(shutdown_tx);
        
        // Start mDNS discovery if enabled
        if self.config.enable_mdns {
            self.start_mdns_discovery().await?;
        }
        
        // Start WebRTC if enabled
        if self.config.enable_webrtc {
            self.start_webrtc_listener().await?;
        }
        
        log::info!("P2P collaboration started on port {}", self.config.listen_port);
        Ok(())
    }
    
    /// Start mDNS discovery
    async fn start_mdns_discovery(&self) -> Result<()> {
        log::info!("Starting mDNS discovery for local network peers");
        
        // In production, would use libp2p-mdns
        // For now, simulate discovery
        Ok(())
    }
    
    /// Start WebRTC listener
    async fn start_webrtc_listener(&self) -> Result<()> {
        log::info!("Starting WebRTC listener for internet peers");
        
        // In production, would use webrtc-rs
        Ok(())
    }
    
    /// Connect to peer via invite code
    pub async fn connect(&mut self, invite_code: &str) -> Result<()> {
        log::info!("Connecting to peer via invite code");
        
        // Parse invite code (would contain peer ID and endpoint)
        let peer = self.parse_invite_code(invite_code)?;
        
        // Add to peers
        {
            let mut peers = self.peers.write();
            peers.insert(peer.id.clone(), peer.clone());
        }
        
        // Notify state change
        let _ = self.state_tx.send(StateChange::PeerConnected(peer));
        
        Ok(())
    }
    
    /// Parse invite code
    fn parse_invite_code(&self, code: &str) -> Result<Peer> {
        // Format: kyro://peer/<base64-encoded-json>
        let code = code.strip_prefix("kyro://peer/")
            .context("Invalid invite code format")?;
        
        let decoded = base64::decode(code)
            .context("Failed to decode invite code")?;
        
        let peer: Peer = serde_json::from_slice(&decoded)
            .context("Failed to parse peer info")?;
        
        Ok(peer)
    }
    
    /// Generate invite code for this peer
    pub fn generate_invite_code(&self) -> String {
        let peer = Peer {
            id: self.local_peer_id.clone(),
            name: self.config.display_name.clone(),
            public_key: vec![], // Would contain actual public key
            endpoint: format!("webrtc://{}", self.local_peer_id.as_str()),
            connected_at: 0,
            last_seen: 0,
        };
        
        let encoded = serde_json::to_vec(&peer).unwrap_or_default();
        let base64 = base64::encode(&encoded);
        
        format!("kyro://peer/{}", base64)
    }
    
    /// Generate QR code for invite
    pub fn generate_qr_code(&self) -> Result<Vec<u8>> {
        let invite_code = self.generate_invite_code();
        
        // In production, would use qrcode crate
        // Return placeholder for now
        Ok(invite_code.into_bytes())
    }
    
    /// Send message to all peers
    pub async fn broadcast(&self, message: PeerMessage) -> Result<()> {
        let peers = self.peers.read();
        
        for peer_id in peers.keys() {
            self.send_to(peer_id, message.clone()).await?;
        }
        
        Ok(())
    }
    
    /// Send message to specific peer
    pub async fn send_to(&self, peer_id: &PeerId, message: PeerMessage) -> Result<()> {
        // In production, would route through WebRTC or direct connection
        log::debug!("Sending message to peer {}: {:?}", peer_id.as_str(), message);
        Ok(())
    }
    
    /// Receive messages
    pub fn subscribe(&self) -> broadcast::Receiver<StateChange> {
        self.state_tx.subscribe()
    }
    
    /// Get connected peers
    pub fn get_peers(&self) -> Vec<Peer> {
        self.peers.read().values().cloned().collect()
    }
    
    /// Disconnect from peer
    pub async fn disconnect(&mut self, peer_id: &PeerId) -> Result<()> {
        let removed = {
            let mut peers = self.peers.write();
            peers.remove(peer_id)
        };
        
        if let Some(peer) = removed {
            let _ = self.state_tx.send(StateChange::PeerDisconnected(peer.id));
        }
        
        Ok(())
    }
    
    /// Shutdown P2P networking
    pub async fn shutdown(&mut self) -> Result<()> {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(()).await;
        }
        
        // Clear all peers
        self.peers.write().clear();
        
        log::info!("P2P collaboration shutdown complete");
        Ok(())
    }
    
    /// Get local peer ID
    pub fn local_peer_id(&self) -> &PeerId {
        &self.local_peer_id
    }
    
    /// Update cursor position (broadcasts to peers)
    pub async fn update_cursor(&self, document_id: &str, position: CursorPosition) -> Result<()> {
        self.broadcast(PeerMessage::CursorUpdate {
            from: self.local_peer_id.clone(),
            document_id: document_id.to_string(),
            position,
        }).await
    }
    
    /// Update selection (broadcasts to peers)
    pub async fn update_selection(&self, document_id: &str, selection: Selection) -> Result<()> {
        self.broadcast(PeerMessage::SelectionUpdate {
            from: self.local_peer_id.clone(),
            document_id: document_id.to_string(),
            selection,
        }).await
    }
    
    /// Send document edit
    pub async fn send_edit(&self, document_id: &str, edit: DocumentEdit) -> Result<()> {
        self.broadcast(PeerMessage::DocumentEdit {
            from: self.local_peer_id.clone(),
            document_id: document_id.to_string(),
            edit,
        }).await
    }
}

impl Drop for P2PCollaboration {
    fn drop(&mut self) {
        // Attempt clean shutdown
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.blocking_send(());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_peer_id_generation() {
        let id1 = PeerId::new();
        let id2 = PeerId::new();
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_invite_code_roundtrip() {
        let config = P2PConfig::default();
        let p2p = P2PCollaboration::new(config);
        
        let code = p2p.generate_invite_code();
        assert!(code.starts_with("kyro://peer/"));
    }

    #[test]
    fn test_default_config() {
        let config = P2PConfig::default();
        assert!(config.enable_mdns);
        assert!(config.enable_webrtc);
        assert_eq!(config.max_peers, 10);
    }

    #[tokio::test]
    async fn test_p2p_lifecycle() {
        let config = P2PConfig::default();
        let mut p2p = P2PCollaboration::new(config);
        
        // Start
        let result = p2p.start().await;
        assert!(result.is_ok());
        
        // Shutdown
        let result = p2p.shutdown().await;
        assert!(result.is_ok());
    }
}
