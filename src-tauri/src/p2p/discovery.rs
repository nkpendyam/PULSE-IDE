//! P2P Discovery using mDNS and UDP broadcast
//!
//! Implements peer discovery on local network without central server.

use anyhow::{Result, Context};
use std::net::{UdpSocket, SocketAddr, IpAddr, Ipv4Addr};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use std::sync::Arc;
use tokio::sync::{RwLock, broadcast};
use serde::{Deserialize, Serialize};

use super::{PeerId, Peer};

/// mDNS service name for Kyro IDE
pub const KYRO_SERVICE_NAME: &str = "_kyro-ide._tcp.local.";
pub const DISCOVERY_PORT: u16 = 57689;
pub const MULTICAST_ADDR: Ipv4Addr = Ipv4Addr::new(224, 0, 0, 251);

/// Discovery configuration
#[derive(Debug, Clone)]
pub struct DiscoveryConfig {
    /// Service name to advertise
    pub service_name: String,
    /// Port to advertise
    pub port: u16,
    /// Discovery interval in seconds
    pub interval_secs: u64,
    /// Peer timeout in seconds
    pub peer_timeout_secs: u64,
    /// Enable mDNS discovery
    pub enable_mdns: bool,
    /// Enable UDP broadcast discovery
    pub enable_broadcast: bool,
}

impl Default for DiscoveryConfig {
    fn default() -> Self {
        Self {
            service_name: KYRO_SERVICE_NAME.to_string(),
            port: DISCOVERY_PORT,
            interval_secs: 5,
            peer_timeout_secs: 30,
            enable_mdns: true,
            enable_broadcast: true,
        }
    }
}

/// Peer discovery message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveryMessage {
    /// Protocol version
    pub version: u32,
    /// Peer ID
    pub peer_id: PeerId,
    /// Display name
    pub display_name: String,
    /// Listening port
    pub port: u16,
    /// Timestamp
    pub timestamp: u64,
    /// Capabilities
    pub capabilities: PeerCapabilities,
}

/// Peer capabilities advertised during discovery
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PeerCapabilities {
    pub supports_crdt: bool,
    pub supports_e2ee: bool,
    pub max_file_size_mb: u64,
}

/// Discovered peer info
#[derive(Debug, Clone)]
pub struct DiscoveredPeer {
    pub peer: Peer,
    pub last_seen: Instant,
    pub source: DiscoverySource,
}

/// How the peer was discovered
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DiscoverySource {
    MDns,
    Broadcast,
    Manual,
}

/// P2P Discovery service
pub struct PeerDiscovery {
    config: DiscoveryConfig,
    local_peer_id: PeerId,
    display_name: String,
    discovered_peers: Arc<RwLock<HashMap<PeerId, DiscoveredPeer>>>,
    event_tx: broadcast::Sender<DiscoveryEvent>,
    running: Arc<RwLock<bool>>,
}

/// Discovery events
#[derive(Debug, Clone)]
pub enum DiscoveryEvent {
    PeerDiscovered(Peer, DiscoverySource),
    PeerLost(PeerId),
    DiscoveryError(String),
}

impl PeerDiscovery {
    /// Create a new discovery service
    pub fn new(local_peer_id: PeerId, display_name: String, config: DiscoveryConfig) -> Self {
        let (event_tx, _) = broadcast::channel(64);
        
        Self {
            config,
            local_peer_id,
            display_name,
            discovered_peers: Arc::new(RwLock::new(HashMap::new())),
            event_tx,
            running: Arc::new(RwLock::new(false)),
        }
    }
    
    /// Start the discovery service
    pub async fn start(&self) -> Result<()> {
        let mut running = self.running.write().await;
        if *running {
            return Ok(());
        }
        *running = true;
        drop(running);
        
        log::info!("Starting P2P discovery on port {}", self.config.port);
        
        // Start UDP broadcast discovery
        if self.config.enable_broadcast {
            self.start_broadcast_discovery().await?;
        }
        
        // Start mDNS discovery
        if self.config.enable_mdns {
            self.start_mdns_discovery().await?;
        }
        
        // Start peer timeout checker
        self.start_peer_timeout_checker().await;
        
        Ok(())
    }
    
    /// Start UDP broadcast discovery
    async fn start_broadcast_discovery(&self) -> Result<()> {
        let socket = self.create_broadcast_socket()?;
        let socket = Arc::new(socket);
        
        // Spawn listener task
        let socket_clone = socket.clone();
        let discovered_peers = self.discovered_peers.clone();
        let event_tx = self.event_tx.clone();
        let local_peer_id = self.local_peer_id.clone();
        let running = self.running.clone();
        
        tokio::spawn(async move {
            let mut buf = [0u8; 4096];
            
            while *running.read().await {
                match socket_clone.recv_from(&mut buf) {
                    Ok((len, addr)) => {
                        if let Ok(msg) = serde_json::from_slice::<DiscoveryMessage>(&buf[..len]) {
                            // Ignore own messages
                            if msg.peer_id != local_peer_id {
                                let peer = Peer {
                                    id: msg.peer_id.clone(),
                                    name: msg.display_name.clone(),
                                    public_key: vec![],
                                    endpoint: format!("{}:{}", addr.ip(), msg.port),
                                    connected_at: msg.timestamp,
                                    last_seen: chrono::Utc::now().timestamp() as u64,
                                };
                                
                                discovered_peers.write().await.insert(
                                    msg.peer_id.clone(),
                                    DiscoveredPeer {
                                        peer: peer.clone(),
                                        last_seen: Instant::now(),
                                        source: DiscoverySource::Broadcast,
                                    },
                                );
                                
                                let _ = event_tx.send(DiscoveryEvent::PeerDiscovered(
                                    peer,
                                    DiscoverySource::Broadcast,
                                ));
                            }
                        }
                    }
                    Err(e) => {
                        log::debug!("Discovery receive error: {}", e);
                    }
                }
            }
        });
        
        // Spawn broadcaster task
        let socket_clone = socket.clone();
        let config = self.config.clone();
        let local_peer_id = self.local_peer_id.clone();
        let display_name = self.display_name.clone();
        let running = self.running.clone();
        
        tokio::spawn(async move {
            let announce = DiscoveryMessage {
                version: 1,
                peer_id: local_peer_id,
                display_name,
                port: config.port,
                timestamp: chrono::Utc::now().timestamp() as u64,
                capabilities: PeerCapabilities::default(),
            };
            
            let announce_bytes = serde_json::to_vec(&announce).unwrap_or_default();
            let broadcast_addr: SocketAddr = format!("255.255.255.255:{}", config.port)
                .parse()
                .unwrap_or_else(|_| SocketAddr::new(IpAddr::V4(Ipv4Addr::new(255,255,255,255)), config.port));
            
            while *running.read().await {
                if let Err(e) = socket_clone.send_to(&announce_bytes, broadcast_addr) {
                    log::debug!("Broadcast send error: {}", e);
                }
                
                tokio::time::sleep(Duration::from_secs(config.interval_secs)).await;
            }
        });
        
        Ok(())
    }
    
    /// Create UDP socket for broadcast
    fn create_broadcast_socket(&self) -> Result<UdpSocket> {
        let socket = UdpSocket::bind(format!("0.0.0.0:{}", self.config.port))
            .context("Failed to bind discovery socket")?;
        
        socket.set_broadcast(true)
            .context("Failed to enable broadcast")?;
        
        socket.set_nonblocking(true)
            .context("Failed to set non-blocking")?;
        
        Ok(socket)
    }
    
    /// Start mDNS discovery (simplified implementation)
    async fn start_mdns_discovery(&self) -> Result<()> {
        // mDNS uses multicast DNS on port 5353
        // This is a simplified implementation that uses UDP multicast
        // For full mDNS support, consider using libmdns or avahi
        
        log::info!("mDNS discovery enabled - advertising as {}", self.config.service_name);
        
        // Create multicast socket
        let socket = UdpSocket::bind("0.0.0.0:5353")
            .context("Failed to bind mDNS socket")?;
        
        // Join multicast group
        let multicast = Ipv4Addr::new(224, 0, 0, 251);
        socket.join_multicast_v4(&multicast, &Ipv4Addr::UNSPECIFIED)
            .context("Failed to join multicast group")?;
        
        socket.set_nonblocking(true)
            .context("Failed to set non-blocking")?;
        
        let socket = Arc::new(socket);
        
        // Spawn mDNS listener
        let socket_clone = socket.clone();
        let discovered_peers = self.discovered_peers.clone();
        let event_tx = self.event_tx.clone();
        let local_peer_id = self.local_peer_id.clone();
        let running = self.running.clone();
        
        tokio::spawn(async move {
            let mut buf = [0u8; 4096];
            
            while *running.read().await {
                match socket_clone.recv_from(&mut buf) {
                    Ok((len, addr)) => {
                        // Try to parse as discovery message
                        if let Ok(msg) = serde_json::from_slice::<DiscoveryMessage>(&buf[..len]) {
                            if msg.peer_id != local_peer_id {
                                let peer = Peer {
                                    id: msg.peer_id.clone(),
                                    name: msg.display_name.clone(),
                                    public_key: vec![],
                                    endpoint: format!("{}:{}", addr.ip(), msg.port),
                                    connected_at: msg.timestamp,
                                    last_seen: chrono::Utc::now().timestamp() as u64,
                                };
                                
                                discovered_peers.write().await.insert(
                                    msg.peer_id.clone(),
                                    DiscoveredPeer {
                                        peer: peer.clone(),
                                        last_seen: Instant::now(),
                                        source: DiscoverySource::MDns,
                                    },
                                );
                                
                                let _ = event_tx.send(DiscoveryEvent::PeerDiscovered(
                                    peer,
                                    DiscoverySource::MDns,
                                ));
                            }
                        }
                    }
                    Err(e) => {
                        log::debug!("mDNS receive error: {}", e);
                    }
                }
            }
        });
        
        // Spawn mDNS announcer
        let socket_clone = socket;
        let config = self.config.clone();
        let local_peer_id = self.local_peer_id.clone();
        let display_name = self.display_name.clone();
        let running = self.running.clone();
        
        tokio::spawn(async move {
            let announce = DiscoveryMessage {
                version: 1,
                peer_id: local_peer_id,
                display_name,
                port: config.port,
                timestamp: chrono::Utc::now().timestamp() as u64,
                capabilities: PeerCapabilities::default(),
            };
            
            let announce_bytes = serde_json::to_vec(&announce).unwrap_or_default();
            let multicast_addr = SocketAddr::new(
                IpAddr::V4(Ipv4Addr::new(224, 0, 0, 251)),
                5353
            );
            
            while *running.read().await {
                if let Err(e) = socket_clone.send_to(&announce_bytes, multicast_addr) {
                    log::debug!("mDNS send error: {}", e);
                }
                
                tokio::time::sleep(Duration::from_secs(config.interval_secs)).await;
            }
        });
        
        Ok(())
    }
    
    /// Start peer timeout checker
    async fn start_peer_timeout_checker(&self) {
        let discovered_peers = self.discovered_peers.clone();
        let event_tx = self.event_tx.clone();
        let running = self.running.clone();
        let timeout_secs = self.config.peer_timeout_secs;
        
        tokio::spawn(async move {
            while *running.read().await {
                let now = Instant::now();
                let timeout = Duration::from_secs(timeout_secs);
                
                let mut peers = discovered_peers.write().await;
                let timed_out: Vec<_> = peers
                    .iter()
                    .filter(|(_, p)| now.duration_since(p.last_seen) > timeout)
                    .map(|(id, _)| id.clone())
                    .collect();
                
                for peer_id in timed_out {
                    peers.remove(&peer_id);
                    let _ = event_tx.send(DiscoveryEvent::PeerLost(peer_id));
                }
                
                drop(peers);
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
        });
    }
    
    /// Stop discovery service
    pub async fn stop(&self) {
        let mut running = self.running.write().await;
        *running = false;
        log::info!("P2P discovery stopped");
    }
    
    /// Subscribe to discovery events
    pub fn subscribe(&self) -> broadcast::Receiver<DiscoveryEvent> {
        self.event_tx.subscribe()
    }
    
    /// Get discovered peers
    pub async fn get_peers(&self) -> Vec<Peer> {
        self.discovered_peers
            .read()
            .await
            .values()
            .map(|p| p.peer.clone())
            .collect()
    }
    
    /// Get peer by ID
    pub async fn get_peer(&self, peer_id: &PeerId) -> Option<Peer> {
        self.discovered_peers
            .read()
            .await
            .get(peer_id)
            .map(|p| p.peer.clone())
    }
    
    /// Add a peer manually (from invite code)
    pub async fn add_peer(&self, peer: Peer) {
        self.discovered_peers.write().await.insert(
            peer.id.clone(),
            DiscoveredPeer {
                peer: peer.clone(),
                last_seen: Instant::now(),
                source: DiscoverySource::Manual,
            },
        );
        
        let _ = self.event_tx.send(DiscoveryEvent::PeerDiscovered(
            peer,
            DiscoverySource::Manual,
        ));
    }
    
    /// Remove a peer
    pub async fn remove_peer(&self, peer_id: &PeerId) {
        self.discovered_peers.write().await.remove(peer_id);
        let _ = self.event_tx.send(DiscoveryEvent::PeerLost(peer_id.clone()));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_discovery_message_serialization() {
        let msg = DiscoveryMessage {
            version: 1,
            peer_id: PeerId::new(),
            display_name: "Test Peer".to_string(),
            port: 57689,
            timestamp: 12345,
            capabilities: PeerCapabilities::default(),
        };
        
        let bytes = serde_json::to_vec(&msg).unwrap();
        let decoded: DiscoveryMessage = serde_json::from_slice(&bytes).unwrap();
        
        assert_eq!(msg.version, decoded.version);
        assert_eq!(msg.peer_id, decoded.peer_id);
    }
    
    #[tokio::test]
    async fn test_discovery_creation() {
        let peer_id = PeerId::new();
        let discovery = PeerDiscovery::new(
            peer_id,
            "Test".to_string(),
            DiscoveryConfig::default(),
        );
        
        let peers = discovery.get_peers().await;
        assert!(peers.is_empty());
    }
}
