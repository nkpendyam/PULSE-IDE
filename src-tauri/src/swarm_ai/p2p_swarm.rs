//! P2P Swarm for distributed model inference
//!
//! This module enables running large models (70B+) across multiple devices
//! by distributing model layers across peers in a P2P network.

use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::{RwLock, Mutex, broadcast};
use tokio::net::{TcpListener, TcpStream};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use sha2::{Sha256, Digest};

/// P2P Swarm for distributed inference
pub struct P2PSwarm {
    peers: Arc<RwLock<HashMap<PeerId, PeerInfo>>>,
    local_peer_id: PeerId,
    layer_assignments: Arc<RwLock<HashMap<usize, PeerId>>>,
    min_peers: usize,
    event_sender: broadcast::Sender<SwarmEvent>,
    server_running: Arc<Mutex<bool>>,
}

/// Unique peer identifier
#[derive(Debug, Clone, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct PeerId(String);

impl PeerId {
    pub fn new() -> Self {
        Self(uuid::Uuid::new_v4().to_string())
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
pub struct PeerInfo {
    pub id: PeerId,
    pub address: SocketAddr,
    pub capabilities: PeerCapabilities,
    pub last_seen: u64,
    pub latency_ms: u32,
    pub layers_assigned: Vec<usize>,
}

/// Peer capabilities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerCapabilities {
    pub gpu_memory_gb: f32,
    pub cpu_cores: u32,
    pub supports_cuda: bool,
    pub supports_metal: bool,
    pub max_layers: usize,
}

/// Swarm events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SwarmEvent {
    PeerJoined(PeerInfo),
    PeerLeft(PeerId),
    LayerAssigned { layer: usize, peer: PeerId },
    InferenceRequest { request_id: String, layer: usize, input: Vec<f32> },
    InferenceResponse { request_id: String, layer: usize, output: Vec<f32> },
    Error(String),
}

/// Distributed inference request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DistributedRequest {
    pub request_id: String,
    pub prompt: String,
    pub max_tokens: u32,
    pub model_name: String,
}

/// Layer computation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayerRequest {
    pub request_id: String,
    pub layer_index: usize,
    pub input_tensor: Vec<f32>,
    pub input_shape: Vec<usize>,
}

/// Layer computation response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayerResponse {
    pub request_id: String,
    pub layer_index: usize,
    pub output_tensor: Vec<f32>,
    pub output_shape: Vec<usize>,
    pub compute_time_ms: u64,
}

impl P2PSwarm {
    /// Create a new P2P swarm
    pub async fn new(min_peers: usize) -> Result<Self> {
        let (event_sender, _) = broadcast::channel(100);
        
        Ok(Self {
            peers: Arc::new(RwLock::new(HashMap::new())),
            local_peer_id: PeerId::new(),
            layer_assignments: Arc::new(RwLock::new(HashMap::new())),
            min_peers,
            event_sender,
            server_running: Arc::new(Mutex::new(false)),
        })
    }

    /// Start the P2P server
    pub async fn start_server(&self, port: u16) -> Result<()> {
        let addr: SocketAddr = format!("0.0.0.0:{}", port).parse()
            .context("Invalid address")?;
        
        let listener = TcpListener::bind(addr).await
            .context("Failed to bind server")?;

        *self.server_running.lock().await = true;

        println!("P2P Swarm server listening on {}", addr);

        loop {
            let (socket, peer_addr) = listener.accept().await?;
            
            let peers = self.peers.clone();
            let event_sender = self.event_sender.clone();

            tokio::spawn(async move {
                if let Err(e) = Self::handle_connection(socket, peers, event_sender).await {
                    eprintln!("Connection error from {}: {}", peer_addr, e);
                }
            });
        }
    }

    /// Handle incoming connection
    async fn handle_connection(
        mut socket: TcpStream,
        peers: Arc<RwLock<HashMap<PeerId, PeerInfo>>>,
        event_sender: broadcast::Sender<SwarmEvent>,
    ) -> Result<()> {
        let mut buffer = vec![0u8; 4096];
        
        loop {
            let n = socket.read(&mut buffer).await?;
            if n == 0 {
                break;
            }

            // Parse message
            let message: SwarmMessage = serde_json::from_slice(&buffer[..n])
                .context("Failed to parse message")?;

            match message {
                SwarmMessage::Handshake(peer_info) => {
                    // Add peer
                    peers.write().await.insert(peer_info.id.clone(), peer_info.clone());
                    
                    let _ = event_sender.send(SwarmEvent::PeerJoined(peer_info));
                }
                SwarmMessage::LayerRequest(request) => {
                    // Process layer request
                    let response = Self::process_layer_request(request).await?;
                    
                    let response_bytes = serde_json::to_vec(&SwarmMessage::LayerResponse(response))?;
                    socket.write_all(&response_bytes).await?;
                }
                SwarmMessage::LayerResponse(response) => {
                    let _ = event_sender.send(SwarmEvent::InferenceResponse {
                        request_id: response.request_id,
                        layer: response.layer_index,
                        output: response.output_tensor,
                    });
                }
                _ => {}
            }
        }

        Ok(())
    }

    /// Process a layer computation request locally
    async fn process_layer_request(request: LayerRequest) -> Result<LayerResponse> {
        let start = std::time::Instant::now();
        
        // Simulate layer computation
        // In real implementation, this would use actual model weights
        let output = request.input_tensor.iter()
            .map(|x| x * 0.5) // Placeholder transformation
            .collect();

        Ok(LayerResponse {
            request_id: request.request_id,
            layer_index: request.layer_index,
            output_tensor: output,
            output_shape: request.input_shape,
            compute_time_ms: start.elapsed().as_millis() as u64,
        })
    }

    /// Connect to a peer
    pub async fn connect_to_peer(&self, addr: SocketAddr) -> Result<()> {
        let socket = TcpStream::connect(addr).await
            .context("Failed to connect to peer")?;

        let peer_info = PeerInfo {
            id: PeerId::new(),
            address: addr,
            capabilities: PeerCapabilities::default(),
            last_seen: chrono::Utc::now().timestamp() as u64,
            latency_ms: 0,
            layers_assigned: vec![],
        };

        let message = SwarmMessage::Handshake(peer_info);
        let bytes = serde_json::to_vec(&message)?;
        
        let (mut reader, mut writer) = socket.into_split();
        tokio::spawn(async move {
            let _ = writer.write_all(&bytes).await;
        });

        Ok(())
    }

    /// Discover peers on local network
    pub async fn discover_peers(&self) -> Result<Vec<PeerInfo>> {
        // Simple UDP discovery
        let discovered = Vec::new();

        // In production, would use mDNS or DHT for discovery
        // For now, return empty list

        Ok(discovered)
    }

    /// Assign layers to peers
    pub async fn assign_layers(&self, total_layers: usize) -> Result<HashMap<usize, PeerId>> {
        let peers = self.peers.read().await;
        
        if peers.len() < self.min_peers {
            return Err(anyhow::anyhow!(
                "Not enough peers: need {}, have {}",
                self.min_peers,
                peers.len()
            ));
        }

        let mut assignments = HashMap::new();
        let peer_list: Vec<_> = peers.keys().cloned().collect();

        // Round-robin assignment
        for (layer_idx, peer_id) in (0..total_layers).zip(peer_list.iter().cycle()) {
            assignments.insert(layer_idx, peer_id.clone());
        }

        // Store assignments
        *self.layer_assignments.write().await = assignments.clone();

        Ok(assignments)
    }

    /// Run distributed inference
    pub async fn complete(&self, prompt: &str, max_tokens: u32) -> Result<String> {
        // Check if we have enough peers
        let peers = self.peers.read().await;
        if peers.len() < self.min_peers {
            return Err(anyhow::anyhow!(
                "Not enough peers for distributed inference"
            ));
        }

        // For now, return a placeholder
        // Real implementation would:
        // 1. Tokenize prompt
        // 2. Send layer 0 input to peer with layer 0
        // 3. Chain outputs through layers
        // 4. Detokenize final output

        Ok(format!("[Distributed inference result for: {}]", prompt))
    }

    /// Get peer count
    pub async fn peer_count(&self) -> usize {
        self.peers.read().await.len()
    }

    /// Subscribe to swarm events
    pub fn subscribe(&self) -> broadcast::Receiver<SwarmEvent> {
        self.event_sender.subscribe()
    }

    /// Get local peer ID
    pub fn local_peer_id(&self) -> &PeerId {
        &self.local_peer_id
    }
}

impl Default for PeerCapabilities {
    fn default() -> Self {
        Self {
            gpu_memory_gb: 8.0,
            cpu_cores: 8,
            supports_cuda: false,
            supports_metal: false,
            max_layers: 16,
        }
    }
}

/// Swarm message types
#[derive(Debug, Clone, Serialize, Deserialize)]
enum SwarmMessage {
    Handshake(PeerInfo),
    Disconnect(PeerId),
    LayerRequest(LayerRequest),
    LayerResponse(LayerResponse),
    Heartbeat(PeerId),
    LayerAssignment { layer: usize, peer: PeerId },
}

/// Cryptographic verification for remote computations
pub struct CryptoVerifier {
    signing_key: [u8; 32],
}

impl CryptoVerifier {
    pub fn new() -> Self {
        Self {
            signing_key: rand_key(),
        }
    }

    /// Sign a computation result
    pub fn sign(&self, data: &[u8]) -> Vec<u8> {
        let mut hasher = Sha256::new();
        hasher.update(&self.signing_key);
        hasher.update(data);
        hasher.finalize().to_vec()
    }

    /// Verify a computation result
    pub fn verify(&self, data: &[u8], signature: &[u8]) -> bool {
        let expected = self.sign(data);
        expected == signature
    }
}

impl Default for CryptoVerifier {
    fn default() -> Self {
        Self::new()
    }
}

fn rand_key() -> [u8; 32] {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    
    let mut key = [0u8; 32];
    let bytes = now.to_le_bytes();
    key[..8].copy_from_slice(&bytes);
    key
}
