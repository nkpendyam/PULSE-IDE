//! LSP Server - Individual language server instance

use kyro_core::{KyroError, KyroResult};
use lsp_types::{
    InitializeParams, InitializedParams, ServerCapabilities, Url,
};
use serde_json::Value;
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use tokio::sync::{Mutex, RwLock};
use std::time::{Duration, Instant};

/// LSP Server instance for a specific language
pub struct LspServer {
    language: String,
    process: Arc<Mutex<Option<ServerProcess>>>,
    capabilities: Arc<RwLock<Option<ServerCapabilities>>>,
    config: ServerConfig,
    state: Arc<RwLock<ServerState>>,
}

/// Server process handle
struct ServerProcess {
    child: tokio::process::Child,
    stdin: Arc<Mutex<tokio::process::ChildStdin>>,
    message_id: Arc<Mutex<i64>>,
    #[allow(dead_code)]
    last_heartbeat: Arc<RwLock<Instant>>,
}

/// Server configuration
#[derive(Clone)]
pub struct ServerConfig {
    pub command: String,
    pub args: Vec<String>,
    pub root_uri: Option<Url>,
    pub restart_on_crash: bool,
    pub max_restart_attempts: u32,
    pub heartbeat_interval: Duration,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            command: String::new(),
            args: Vec::new(),
            root_uri: None,
            restart_on_crash: true,
            max_restart_attempts: 3,
            heartbeat_interval: Duration::from_secs(30),
        }
    }
}

/// Server state
#[derive(Debug, Clone, PartialEq)]
pub enum ServerState {
    Stopped,
    Starting,
    Running,
    Crashed,
    Restarting,
}

impl LspServer {
    /// Create a new LSP server for a language
    pub fn new(language: String) -> Self {
        Self {
            language: language.clone(),
            process: Arc::new(Mutex::new(None)),
            capabilities: Arc::new(RwLock::new(None)),
            config: Self::get_default_config(&language),
            state: Arc::new(RwLock::new(ServerState::Stopped)),
        }
    }

    /// Create a new LSP server with custom configuration
    pub fn with_config(language: String, config: ServerConfig) -> Self {
        Self {
            language,
            process: Arc::new(Mutex::new(None)),
            capabilities: Arc::new(RwLock::new(None)),
            config,
            state: Arc::new(RwLock::new(ServerState::Stopped)),
        }
    }

    /// Get default configuration for a language
    fn get_default_config(language: &str) -> ServerConfig {
        let (command, args) = match language {
            "rust" => ("rust-analyzer", vec![]),
            "typescript" | "javascript" => (
                "typescript-language-server",
                vec!["--stdio".to_string()],
            ),
            "python" => ("pylsp", vec![]),
            "go" => ("gopls", vec![]),
            "java" => ("jdtls", vec![]),
            "c" | "cpp" => ("clangd", vec![]),
            "csharp" => ("omnisharp", vec!["--lsp".to_string()]),
            "html" | "css" => ("vscode-html-language-server", vec!["--stdio".to_string()]),
            "json" => ("vscode-json-language-server", vec!["--stdio".to_string()]),
            _ => ("", vec![]),
        };

        ServerConfig {
            command: command.to_string(),
            args: args.iter().map(|s| s.to_string()).collect(),
            ..Default::default()
        }
    }

    /// Get the language this server handles
    pub fn language(&self) -> &str {
        &self.language
    }

    /// Get the current server state
    pub async fn state(&self) -> ServerState {
        self.state.read().await.clone()
    }

    /// Start the LSP server process
    pub async fn start(&self) -> KyroResult<()> {
        let mut state = self.state.write().await;
        if *state == ServerState::Running {
            return Ok(());
        }

        *state = ServerState::Starting;
        drop(state);

        if self.config.command.is_empty() {
            return Err(KyroError::lsp(format!(
                "No LSP server configured for language: {}",
                self.language
            )));
        }

        log::info!(
            "Starting LSP server for {}: {} {:?}",
            self.language,
            self.config.command,
            self.config.args
        );

        // Spawn the LSP server process
        let mut cmd = tokio::process::Command::new(&self.config.command);
        cmd.args(&self.config.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);

        let mut child = cmd.spawn().map_err(|e| {
            KyroError::lsp(format!(
                "Failed to spawn LSP server for {}: {}",
                self.language, e
            ))
        })?;

        let stdin = child.stdin.take().ok_or_else(|| {
            KyroError::lsp("Failed to get stdin handle".to_string())
        })?;

        let _stdout = child.stdout.take().ok_or_else(|| {
            KyroError::lsp("Failed to get stdout handle".to_string())
        })?;

        let server_process = ServerProcess {
            child,
            stdin: Arc::new(Mutex::new(stdin)),
            message_id: Arc::new(Mutex::new(0)),
            last_heartbeat: Arc::new(RwLock::new(Instant::now())),
        };

        *self.process.lock().await = Some(server_process);

        // Initialize the LSP server
        self.initialize().await?;

        // Start monitoring for crashes
        self.start_crash_monitor();

        let mut state = self.state.write().await;
        *state = ServerState::Running;

        log::info!("LSP server started successfully for {}", self.language);
        Ok(())
    }

    /// Stop the LSP server process
    pub async fn stop(&self) -> KyroResult<()> {
        let mut state = self.state.write().await;
        *state = ServerState::Stopped;
        drop(state);

        let mut process_guard = self.process.lock().await;
        if let Some(mut server_process) = process_guard.take() {
            // Send shutdown request
            let _ = self.send_shutdown_request(&server_process).await;

            // Kill the process
            let _ = server_process.child.kill().await;

            log::info!("LSP server stopped for {}", self.language);
        }

        Ok(())
    }

    /// Restart the LSP server
    pub async fn restart(&self) -> KyroResult<()> {
        log::info!("Restarting LSP server for {}", self.language);
        
        let mut state = self.state.write().await;
        *state = ServerState::Restarting;
        drop(state);

        self.stop().await?;
        tokio::time::sleep(Duration::from_millis(500)).await;
        self.start().await?;

        Ok(())
    }

    /// Initialize the LSP server with initialize request
    async fn initialize(&self) -> KyroResult<()> {
        let process_guard = self.process.lock().await;
        let server_process = process_guard
            .as_ref()
            .ok_or_else(|| KyroError::lsp("Server process not running".to_string()))?;

        let init_params = InitializeParams {
            process_id: Some(std::process::id()),
            root_uri: self.config.root_uri.clone(),
            capabilities: lsp_types::ClientCapabilities::default(),
            ..Default::default()
        };

        let response = self
            .send_request(server_process, "initialize", init_params)
            .await?;

        // Parse server capabilities
        if let Some(result) = response.get("result") {
            if let Some(caps) = result.get("capabilities") {
                let capabilities: ServerCapabilities =
                    serde_json::from_value(caps.clone()).unwrap_or_default();
                *self.capabilities.write().await = Some(capabilities);
            }
        }

        // Send initialized notification
        self.send_notification(server_process, "initialized", InitializedParams {})
            .await?;

        Ok(())
    }

    /// Send a shutdown request to the server
    async fn send_shutdown_request(&self, server_process: &ServerProcess) -> KyroResult<()> {
        let _ = self
            .send_request(server_process, "shutdown", Value::Null)
            .await;
        let _ = self
            .send_notification(server_process, "exit", Value::Null)
            .await;
        Ok(())
    }

    /// Send a JSON-RPC request to the server
    async fn send_request(
        &self,
        server_process: &ServerProcess,
        method: &str,
        params: impl serde::Serialize,
    ) -> KyroResult<Value> {
        let mut id = server_process.message_id.lock().await;
        *id += 1;
        let message_id = *id;
        drop(id);

        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": message_id,
            "method": method,
            "params": params,
        });

        let content = serde_json::to_string(&request)?;
        let message = format!("Content-Length: {}\r\n\r\n{}", content.len(), content);

        let mut stdin = server_process.stdin.lock().await;
        stdin
            .write_all(message.as_bytes())
            .await
            .map_err(|e| KyroError::lsp(format!("Failed to write to stdin: {}", e)))?;
        stdin
            .flush()
            .await
            .map_err(|e| KyroError::lsp(format!("Failed to flush stdin: {}", e)))?;

        // For now, return a placeholder response
        // In a full implementation, we'd read the response from stdout
        Ok(serde_json::json!({
            "jsonrpc": "2.0",
            "id": message_id,
            "result": {}
        }))
    }

    /// Send a JSON-RPC notification to the server
    async fn send_notification(
        &self,
        server_process: &ServerProcess,
        method: &str,
        params: impl serde::Serialize,
    ) -> KyroResult<()> {
        let notification = serde_json::json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
        });

        let content = serde_json::to_string(&notification)?;
        let message = format!("Content-Length: {}\r\n\r\n{}", content.len(), content);

        let mut stdin = server_process.stdin.lock().await;
        stdin
            .write_all(message.as_bytes())
            .await
            .map_err(|e| KyroError::lsp(format!("Failed to write to stdin: {}", e)))?;
        stdin
            .flush()
            .await
            .map_err(|e| KyroError::lsp(format!("Failed to flush stdin: {}", e)))?;

        Ok(())
    }

    /// Start monitoring for server crashes
    fn start_crash_monitor(&self) {
        let process = self.process.clone();
        let state = self.state.clone();
        let config = self.config.clone();
        let language = self.language.clone();
        let server = Arc::new(self.clone());

        tokio::spawn(async move {
            let mut restart_attempts = 0;

            loop {
                tokio::time::sleep(Duration::from_secs(5)).await;

                let current_state = state.read().await.clone();
                if current_state == ServerState::Stopped {
                    break;
                }

                let mut process_guard = process.lock().await;
                if let Some(server_process) = process_guard.as_mut() {
                    // Check if process is still alive
                    match server_process.child.try_wait() {
                        Ok(Some(status)) => {
                            log::error!(
                                "LSP server for {} crashed with status: {:?}",
                                language,
                                status
                            );

                            *state.write().await = ServerState::Crashed;

                            if config.restart_on_crash
                                && restart_attempts < config.max_restart_attempts
                            {
                                restart_attempts += 1;
                                log::info!(
                                    "Attempting to restart LSP server for {} (attempt {}/{})",
                                    language,
                                    restart_attempts,
                                    config.max_restart_attempts
                                );

                                drop(process_guard);
                                if let Err(e) = server.restart().await {
                                    log::error!("Failed to restart LSP server: {}", e);
                                } else {
                                    restart_attempts = 0; // Reset on successful restart
                                }
                            } else {
                                log::error!(
                                    "LSP server for {} will not be restarted (max attempts reached or disabled)",
                                    language
                                );
                                break;
                            }
                        }
                        Ok(None) => {
                            // Process is still running
                            restart_attempts = 0; // Reset counter when healthy
                        }
                        Err(e) => {
                            log::error!("Error checking LSP server status: {}", e);
                        }
                    }
                }
            }
        });
    }

    /// Get completions at a position
    pub async fn get_completions(
        &self,
        _uri: &str,
        _line: u32,
        _character: u32,
    ) -> KyroResult<Vec<String>> {
        // Placeholder implementation
        Ok(vec![])
    }

    /// Get hover information
    pub async fn get_hover(
        &self,
        _uri: &str,
        _line: u32,
        _character: u32,
    ) -> KyroResult<Option<String>> {
        // Placeholder implementation
        Ok(None)
    }

    /// Get diagnostics for a document
    pub async fn get_diagnostics(&self, _uri: &str) -> KyroResult<Vec<String>> {
        // Placeholder implementation
        Ok(vec![])
    }

    /// Get server capabilities
    pub async fn capabilities(&self) -> Option<ServerCapabilities> {
        self.capabilities.read().await.clone()
    }
}

// Implement Clone for LspServer to support Arc wrapping
impl Clone for LspServer {
    fn clone(&self) -> Self {
        Self {
            language: self.language.clone(),
            process: self.process.clone(),
            capabilities: self.capabilities.clone(),
            config: self.config.clone(),
            state: self.state.clone(),
        }
    }
}

#[cfg(all(test, feature = "fixme_tests"))]
mod tests {
    use super::*;

    #[test]
    fn test_lsp_server_creation() {
        let server = LspServer::new("rust".to_string());
        assert_eq!(server.language(), "rust");
    }

    #[tokio::test]
    async fn test_server_state() {
        let server = LspServer::new("rust".to_string());
        assert_eq!(server.state().await, ServerState::Stopped);
    }

    #[test]
    fn test_default_config() {
        let config = LspServer::get_default_config("rust");
        assert_eq!(config.command, "rust-analyzer");

        let config = LspServer::get_default_config("typescript");
        assert_eq!(config.command, "typescript-language-server");
    }
}
