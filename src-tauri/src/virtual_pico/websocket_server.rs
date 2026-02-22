//! WebSocket server for PICO connections

use anyhow::{Result, Context};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{broadcast, RwLock};
use tokio_tungstenite::{accept_hdr_async, WebSocketStream};
use tokio_tungstenite::tungstenite::handshake::server::{Request, Response};
use tokio_tungstenite::tungstenite::Message;
use super::{PicoDevice, DeviceType, DeviceCapabilities};
use super::protocol::PicoMessage;

/// WebSocket server for PICO connections
pub struct PicoWebSocketServer {
    port: u16,
    connections: Arc<RwLock<HashMap<String, WebSocketStream<TcpStream>>>>,
    message_sender: broadcast::Sender<(String, PicoMessage)>,
    running: Arc<RwLock<bool>>,
}

impl PicoWebSocketServer {
    /// Create a new WebSocket server
    pub fn new(port: u16) -> Self {
        let (message_sender, _) = broadcast::channel(100);
        
        Self {
            port,
            connections: Arc::new(RwLock::new(HashMap::new())),
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
        println!("PICO WebSocket server listening on {}", addr);

        loop {
            let (stream, peer_addr) = listener.accept().await?;
            
            let connections = self.connections.clone();
            let message_sender = self.message_sender.clone();
            let running = self.running.clone();

            tokio::spawn(async move {
                if let Err(e) = Self::handle_connection(stream, peer_addr, connections, message_sender, running).await {
                    eprintln!("Connection error from {}: {}", peer_addr, e);
                }
            });
        }
    }

    /// Handle incoming WebSocket connection
    async fn handle_connection(
        stream: TcpStream,
        peer_addr: SocketAddr,
        connections: Arc<RwLock<HashMap<String, WebSocketStream<TcpStream>>>>,
        message_sender: broadcast::Sender<(String, PicoMessage)>,
        running: Arc<RwLock<bool>>,
    ) -> Result<()> {
        let mut device_id: Option<String> = None;

        // Accept WebSocket with header callback to get device info
        let callback = |req: &Request, mut response: Response| {
            // Extract device info from headers
            if let Some(user_agent) = req.headers().get("user-agent") {
                println!("Device user-agent: {:?}", user_agent);
            }
            response
        };

        let ws_stream = accept_hdr_async(stream, callback).await?;
        let (mut ws_sender, mut ws_receiver) = ws_stream.split();

        // Handle messages
        while *running.read().await {
            tokio::select! {
                msg = ws_receiver.next() => {
                    match msg {
                        Some(Ok(Message::Text(text))) => {
                            if let Ok(message) = serde_json::from_str::<PicoMessage>(&text) {
                                if let Some(ref id) = device_id {
                                    let _ = message_sender.send((id.clone(), message));
                                } else if let PicoMessage::Register { device } = message {
                                    device_id = Some(device.device_id.clone());
                                    connections.write().await.insert(device.device_id, ws_stream);
                                    println!("Device registered: {:?}", device.name);
                                }
                            }
                        }
                        Some(Ok(Message::Binary(data))) => {
                            if let Ok(message) = serde_json::from_slice::<PicoMessage>(&data) {
                                if let Some(ref id) = device_id {
                                    let _ = message_sender.send((id.clone(), message));
                                }
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
            }
        }

        // Cleanup
        if let Some(id) = device_id {
            connections.write().await.remove(&id);
            println!("Device disconnected: {}", id);
        }

        Ok(())
    }

    /// Send message to a specific device
    pub async fn send_to(&self, device_id: &str, message: &PicoMessage) -> Result<()> {
        let connections = self.connections.read().await;
        if let Some(ws) = connections.get(device_id) {
            let json = serde_json::to_string(message)?;
            let _ = ws.send(Message::Text(json)).await;
        }
        Ok(())
    }

    /// Subscribe to incoming messages
    pub fn subscribe(&self) -> broadcast::Receiver<(String, PicoMessage)> {
        self.message_sender.subscribe()
    }

    /// Stop the server
    pub async fn stop(&self) {
        *self.running.write().await = false;
    }

    /// Get connected device count
    pub async fn connection_count(&self) -> usize {
        self.connections.read().await.len()
    }
}

/// Connection request from device
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionRequest {
    pub device_id: String,
    pub device_name: String,
    pub device_type: DeviceType,
    pub capabilities: DeviceCapabilities,
    pub auth_token: Option<String>,
}

/// Connection response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionResponse {
    pub success: bool,
    pub session_id: String,
    pub server_time: u64,
    pub message: String,
}
