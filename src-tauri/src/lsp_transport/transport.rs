//! LSP Transport Implementation
//!
//! Implements LSP message transport over stdio and TCP sockets.
//! Based on: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/

use std::io::{self, BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::Arc;
use std::collections::HashMap;
use tokio::sync::{mpsc, RwLock, oneshot};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use anyhow::{Result, Context};
use log::{debug, error, info, warn};

/// LSP Message types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum LspMessage {
    Request(LspRequest),
    Response(LspResponse),
    Notification(LspNotification),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspRequest {
    pub jsonrpc: String,
    pub id: u64,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspResponse {
    pub jsonrpc: String,
    pub id: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<LspError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspError {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspNotification {
    pub jsonrpc: String,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<Value>,
}

/// LSP Transport configuration
#[derive(Debug, Clone)]
pub struct TransportConfig {
    pub command: String,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
    pub cwd: Option<String>,
    pub initialization_timeout_ms: u64,
}

impl Default for TransportConfig {
    fn default() -> Self {
        Self {
            command: String::new(),
            args: Vec::new(),
            env: HashMap::new(),
            cwd: None,
            initialization_timeout_ms: 10000,
        }
    }
}

/// Language server configurations
pub fn get_language_server_config(language: &str) -> Option<TransportConfig> {
    match language {
        "rust" => Some(TransportConfig {
            command: "rust-analyzer".to_string(),
            args: vec![],
            env: HashMap::new(),
            cwd: None,
            initialization_timeout_ms: 30000,
        }),
        "typescript" | "javascript" => Some(TransportConfig {
            command: "typescript-language-server".to_string(),
            args: vec!["--stdio".to_string()],
            env: HashMap::new(),
            cwd: None,
            initialization_timeout_ms: 10000,
        }),
        "python" => Some(TransportConfig {
            command: "pylsp".to_string(),
            args: vec![],
            env: HashMap::new(),
            cwd: None,
            initialization_timeout_ms: 10000,
        }),
        "go" => Some(TransportConfig {
            command: "gopls".to_string(),
            args: vec!["serve".to_string()],
            env: HashMap::new(),
            cwd: None,
            initialization_timeout_ms: 15000,
        }),
        "c" | "cpp" => Some(TransportConfig {
            command: "clangd".to_string(),
            args: vec![],
            env: HashMap::new(),
            cwd: None,
            initialization_timeout_ms: 10000,
        }),
        "java" => Some(TransportConfig {
            command: "jdtls".to_string(),
            args: vec![],
            env: HashMap::new(),
            cwd: None,
            initialization_timeout_ms: 30000,
        }),
        "ruby" => Some(TransportConfig {
            command: "solargraph".to_string(),
            args: vec!["stdio".to_string()],
            env: HashMap::new(),
            cwd: None,
            initialization_timeout_ms: 15000,
        }),
        "php" => Some(TransportConfig {
            command: "intelephense".to_string(),
            args: vec!["--stdio".to_string()],
            env: HashMap::new(),
            cwd: None,
            initialization_timeout_ms: 10000,
        }),
        _ => None,
    }
}

/// Pending request tracker
type PendingRequests = Arc<RwLock<HashMap<u64, oneshot::Sender<Result<Value>>>>>;

/// LSP Transport handle
pub struct LspTransport {
    process: Option<Child>,
    stdin: Option<ChildStdin>,
    request_id: Arc<RwLock<u64>>,
    pending: PendingRequests,
    shutdown_tx: Option<mpsc::Sender<()>>,
    capabilities: Arc<RwLock<Option<Value>>>,
}

impl LspTransport {
    /// Create a new LSP transport
    pub fn new(config: TransportConfig) -> Result<Self> {
        let mut cmd = Command::new(&config.command);
        cmd.args(&config.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        
        for (key, value) in &config.env {
            cmd.env(key, value);
        }
        
        if let Some(cwd) = &config.cwd {
            cmd.current_dir(cwd);
        }
        
        let mut process = cmd.spawn()
            .with_context(|| format!("Failed to start language server: {}", config.command))?;
        
        let stdin = process.stdin.take().context("Failed to get stdin")?;
        let stdout = process.stdout.take().context("Failed to get stdout")?;
        
        let pending: PendingRequests = Arc::new(RwLock::new(HashMap::new()));
        let capabilities = Arc::new(RwLock::new(None));
        let (shutdown_tx, shutdown_rx) = mpsc::channel(1);
        
        // Spawn reader task
        let pending_clone = pending.clone();
        let capabilities_clone = capabilities.clone();
        tokio::spawn(async move {
            Self::read_loop(stdout, pending_clone, capabilities_clone, shutdown_rx).await;
        });
        
        info!("LSP transport started for {}", config.command);
        
        Ok(Self {
            process: Some(process),
            stdin: Some(stdin),
            request_id: Arc::new(RwLock::new(0)),
            pending,
            shutdown_tx: Some(shutdown_tx),
            capabilities,
        })
    }
    
    /// Read loop for handling incoming messages
    async fn read_loop(
        stdout: std::process::ChildStdout,
        pending: PendingRequests,
        capabilities: Arc<RwLock<Option<Value>>>,
        mut shutdown_rx: mpsc::Receiver<()>,
    ) {
        let reader = BufReader::new(stdout);
        let mut content_length = 0;
        
        'outer: loop {
            // Check for shutdown
            if shutdown_rx.try_recv().is_ok() {
                break;
            }
            
            // Read headers
            for line in reader.lines() {
                match line {
                    Ok(l) if l.is_empty() => break,
                    Ok(l) if l.starts_with("Content-Length:") => {
                        content_length = l[15..].trim().parse().unwrap_or(0);
                    }
                    Ok(l) if l.starts_with("Content-Type:") => {
                        // Usually application/json, we can ignore
                    }
                    _ => {}
                }
            }
            
            if content_length == 0 {
                continue;
            }
            
            // Read content
            let mut buffer = vec![0u8; content_length];
            if let Err(e) = reader.read_exact(&mut buffer) {
                error!("Failed to read LSP message: {}", e);
                break;
            }
            
            let content = String::from_utf8_lossy(&buffer);
            debug!("LSP received: {}", content);
            
            // Parse message
            if let Ok(msg) = serde_json::from_str::<LspMessage>(&content) {
                match msg {
                    LspMessage::Response(response) => {
                        let mut pending_guard = pending.write().await;
                        if let Some(tx) = pending_guard.remove(&response.id) {
                            let result = if let Some(error) = response.error {
                                Err(anyhow::anyhow!("LSP error: {} - {}", error.code, error.message))
                            } else {
                                Ok(response.result.unwrap_or(Value::Null))
                            };
                            let _ = tx.send(result);
                        }
                    }
                    LspMessage::Notification(notif) => {
                        // Handle notifications like textDocument/publishDiagnostics
                        debug!("LSP notification: {} ", notif.method);
                    }
                    LspMessage::Request(req) => {
                        // Handle server-initiated requests
                        debug!("LSP server request: {}", req.method);
                    }
                }
            }
            
            content_length = 0;
        }
    }
    
    /// Send a request and wait for response
    pub async fn send_request(&mut self, method: &str, params: Option<Value>) -> Result<Value> {
        let id = {
            let mut id = self.request_id.write().await;
            *id += 1;
            *id
        };
        
        let request = LspRequest {
            jsonrpc: "2.0".to_string(),
            id,
            method: method.to_string(),
            params,
        };
        
        let (tx, rx) = oneshot::channel();
        {
            let mut pending = self.pending.write().await;
            pending.insert(id, tx);
        }
        
        // Send request
        let content = serde_json::to_string(&request)?;
        self.send_message(&content)?;
        
        // Wait for response
        rx.await.context("Request cancelled")?
    }
    
    /// Send a notification (no response expected)
    pub fn send_notification(&mut self, method: &str, params: Option<Value>) -> Result<()> {
        let notification = LspNotification {
            jsonrpc: "2.0".to_string(),
            method: method.to_string(),
            params,
        };
        
        let content = serde_json::to_string(&notification)?;
        self.send_message(&content)
    }
    
    /// Send raw message with Content-Length header
    fn send_message(&mut self, content: &str) -> Result<()> {
        let stdin = self.stdin.as_mut().context("stdin not available")?;
        let header = format!("Content-Length: {}\r\n\r\n", content.len());
        stdin.write_all(header.as_bytes())?;
        stdin.write_all(content.as_bytes())?;
        stdin.flush()?;
        debug!("LSP sent: {}", content);
        Ok(())
    }
    
    /// Initialize the language server
    pub async fn initialize(&mut self, root_uri: &str, capabilities: Value) -> Result<Value> {
        let params = json!({
            "processId": std::process::id(),
            "rootUri": root_uri,
            "capabilities": capabilities,
            "trace": "verbose",
        });
        
        let result = self.send_request("initialize", Some(params)).await?;
        
        // Store capabilities
        {
            let mut caps = self.capabilities.write().await;
            *caps = Some(result.clone());
        }
        
        // Send initialized notification
        self.send_notification("initialized", Some(json!({})))?;
        
        info!("LSP initialized: {}", root_uri);
        Ok(result)
    }
    
    /// Shutdown the language server
    pub async fn shutdown(&mut self) -> Result<()> {
        // Send shutdown request
        let _ = self.send_request("shutdown", None).await;
        
        // Send exit notification
        self.send_notification("exit", None)?;
        
        // Signal reader to stop
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(()).await;
        }
        
        // Wait for process to exit
        if let Some(mut process) = self.process.take() {
            let _ = process.wait();
        }
        
        info!("LSP transport shutdown complete");
        Ok(())
    }
    
    /// Get server capabilities
    pub async fn get_capabilities(&self) -> Option<Value> {
        self.capabilities.read().await.clone()
    }
}

impl Drop for LspTransport {
    fn drop(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.blocking_send(());
        }
        if let Some(mut process) = self.process.take() {
            let _ = process.kill();
        }
    }
}
