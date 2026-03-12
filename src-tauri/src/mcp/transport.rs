//! MCP Transport Layer for KRO_IDE
//!
//! Provides transport implementations for MCP communication.
//! StdioTransport spawns a subprocess and communicates via
//! Content-Length framed JSON-RPC over stdin/stdout.

use anyhow::Result;
use async_trait::async_trait;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::RwLock;
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

/// Stdio transport for local MCP servers.
///
/// Spawns a child process (e.g. `npx @modelcontextprotocol/server-xyz`)
/// and communicates via Content-Length–framed JSON-RPC on stdin/stdout.
pub struct StdioTransport {
    child: Arc<RwLock<Option<Child>>>,
    stdin_tx: tokio::sync::mpsc::Sender<String>,
    stdout_rx: Arc<tokio::sync::Mutex<tokio::sync::mpsc::Receiver<String>>>,
}

impl StdioTransport {
    /// Spawn a new MCP server process.
    /// `command` is the executable, `args` are its arguments.
    pub fn spawn(command: &str, args: &[&str]) -> Result<Self> {
        let mut child = Command::new(command)
            .args(args)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .kill_on_drop(true)
            .spawn()?;

        let stdin = child.stdin.take().ok_or_else(|| anyhow::anyhow!("No stdin"))?;
        let stdout = child.stdout.take().ok_or_else(|| anyhow::anyhow!("No stdout"))?;

        let (stdin_tx, mut stdin_rx) = tokio::sync::mpsc::channel::<String>(64);
        let (stdout_tx, stdout_rx) = tokio::sync::mpsc::channel::<String>(64);

        // Writer task: reads from channel, writes Content-Length framed messages to stdin
        tokio::spawn(async move {
            let mut stdin = stdin;
            while let Some(msg) = stdin_rx.recv().await {
                let header = format!("Content-Length: {}\r\n\r\n", msg.len());
                if stdin.write_all(header.as_bytes()).await.is_err() { break; }
                if stdin.write_all(msg.as_bytes()).await.is_err() { break; }
                if stdin.flush().await.is_err() { break; }
            }
        });

        // Reader task: reads Content-Length framed messages from stdout
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout);
            loop {
                // Read headers until empty line
                let mut content_length: Option<usize> = None;
                loop {
                    let mut header_line = String::new();
                    match reader.read_line(&mut header_line).await {
                        Ok(0) => return, // EOF
                        Err(_) => return,
                        Ok(_) => {}
                    }
                    let trimmed = header_line.trim();
                    if trimmed.is_empty() {
                        break; // end of headers
                    }
                    if let Some(val) = trimmed.strip_prefix("Content-Length:") {
                        if let Ok(len) = val.trim().parse::<usize>() {
                            content_length = Some(len);
                        }
                    }
                }
                let len = match content_length {
                    Some(l) => l,
                    None => continue,
                };
                // Read exactly `len` bytes of body
                let mut body = vec![0u8; len];
                if tokio::io::AsyncReadExt::read_exact(&mut reader, &mut body).await.is_err() {
                    return;
                }
                if let Ok(s) = String::from_utf8(body) {
                    if stdout_tx.send(s).await.is_err() {
                        return;
                    }
                }
            }
        });

        Ok(Self {
            child: Arc::new(RwLock::new(Some(child))),
            stdin_tx,
            stdout_rx: Arc::new(tokio::sync::Mutex::new(stdout_rx)),
        })
    }

    /// Create a no-op transport (for testing)
    pub fn new() -> Self {
        let (stdin_tx, _) = tokio::sync::mpsc::channel(1);
        let (_, stdout_rx) = tokio::sync::mpsc::channel(1);
        Self {
            child: Arc::new(RwLock::new(None)),
            stdin_tx,
            stdout_rx: Arc::new(tokio::sync::Mutex::new(stdout_rx)),
        }
    }
}

#[async_trait]
impl Transport for StdioTransport {
    async fn send(&self, message: &Value) -> Result<()> {
        let json = serde_json::to_string(message)?;
        self.stdin_tx.send(json).await
            .map_err(|e| anyhow::anyhow!("Failed to send to stdin: {}", e))
    }

    async fn recv(&self) -> Result<Option<Value>> {
        let mut rx = self.stdout_rx.lock().await;
        match rx.recv().await {
            Some(s) => {
                let val: Value = serde_json::from_str(&s)?;
                Ok(Some(val))
            }
            None => Ok(None),
        }
    }

    async fn close(&self) -> Result<()> {
        let mut child_opt = self.child.write().await;
        if let Some(mut child) = child_opt.take() {
            let _ = child.kill().await;
        }
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
        // SSE receives via event stream — not implemented yet
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
        let _ = message;
        Ok(())
    }

    async fn recv(&self) -> Result<Option<Value>> {
        if !*self.connected.read().await {
            return Ok(None);
        }
        Ok(None)
    }

    async fn close(&self) -> Result<()> {
        let mut connected = self.connected.write().await;
        *connected = false;
        Ok(())
    }
}
