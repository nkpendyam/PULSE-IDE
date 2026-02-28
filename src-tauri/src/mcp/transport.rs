//! MCP Transport Layer for KRO_IDE
//!
//! Provides transport implementations for MCP communication

use anyhow::Result;
use async_trait::async_trait;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use serde_json::Value;

/// Transport trait for MCP communication
#[async_trait]
pub trait Transport: Send + Sync {
    /// Send a message
    async fn send(&self, message: &Value) -> Result<()>;

    /// Receive a message
    async fn recv(&self) -> Result<Option<Value>>;

    /// Close the transport
    async fn close(&self) -> Result<()>;
}

/// Stdio transport for local MCP servers
pub struct StdioTransport {
    stdin_tx: mpsc::Sender<String>,
    stdout_rx: mpsc::Receiver<String>,
}

impl StdioTransport {
    pub fn new() -> Self {
        let (stdin_tx, _stdin_rx) = mpsc::channel(100);
        let (_stdout_tx, stdout_rx) = mpsc::channel(100);

        Self {
            stdin_tx,
            stdout_rx,
        }
    }
}

#[async_trait]
impl Transport for StdioTransport {
    async fn send(&self, message: &Value) -> Result<()> {
        let line = serde_json::to_string(message)?;
        self.stdin_tx.send(line).await?;
        Ok(())
    }

    async fn recv(&self) -> Result<Option<Value>> {
        // In production, this would read from stdout
        Ok(None)
    }

    async fn close(&self) -> Result<()> {
        Ok(())
    }
}

/// SSE (Server-Sent Events) transport for remote MCP servers
pub struct SseTransport {
    url: String,
    client: reqwest::Client,
}

impl SseTransport {
    pub fn new(url: impl Into<String>) -> Self {
        Self {
            url: url.into(),
            client: reqwest::Client::new(),
        }
    }
}

#[async_trait]
impl Transport for SseTransport {
    async fn send(&self, message: &Value) -> Result<()> {
        let response = self.client
            .post(&self.url)
            .json(message)
            .send()
            .await?;

        if !response.status().is_success() {
            anyhow::bail!("SSE send failed: {}", response.status());
        }

        Ok(())
    }

    async fn recv(&self) -> Result<Option<Value>> {
        // SSE receives via event stream
        Ok(None)
    }

    async fn close(&self) -> Result<()> {
        Ok(())
    }
}

/// WebSocket transport for real-time MCP
pub struct WebSocketTransport {
    url: String,
    connected: Arc<RwLock<bool>>,
}

impl WebSocketTransport {
    pub fn new(url: impl Into<String>) -> Self {
        Self {
            url: url.into(),
            connected: Arc::new(RwLock::new(false)),
        }
    }

    pub async fn connect(&self) -> Result<()> {
        // In production, would establish WebSocket connection
        let mut connected = self.connected.write().await;
        *connected = true;
        Ok(())
    }
}

#[async_trait]
impl Transport for WebSocketTransport {
    async fn send(&self, message: &Value) -> Result<()> {
        if !*self.connected.read().await {
            anyhow::bail!("WebSocket not connected");
        }

        // In production, would send via WebSocket
        let _ = message;
        Ok(())
    }

    async fn recv(&self) -> Result<Option<Value>> {
        if !*self.connected.read().await {
            return Ok(None);
        }

        // In production, would receive via WebSocket
        Ok(None)
    }

    async fn close(&self) -> Result<()> {
        let mut connected = self.connected.write().await;
        *connected = false;
        Ok(())
    }
}
