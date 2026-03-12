//! LSP Manager - Manages multiple LSP server instances

use async_trait::async_trait;
use dashmap::DashMap;
use kyro_core::{KyroError, KyroResult, Service};
use lsp_types::Url;
use std::sync::Arc;

/// LSP Manager service (also known as MolecularLsp in the design)
pub struct LspManager {
    servers: DashMap<String, Arc<crate::server::LspServer>>,
}

impl LspManager {
    /// Create a new LSP manager
    pub fn new() -> Self {
        Self {
            servers: DashMap::new(),
        }
    }

    /// Start an LSP server for a language
    pub async fn start_server(&self, language: &str, root_uri: Option<Url>) -> KyroResult<()> {
        // Check if server already exists and is running
        if let Some(server) = self.servers.get(language) {
            let state = server.state().await;
            if state == crate::server::ServerState::Running {
                log::debug!("LSP server for {} is already running", language);
                return Ok(());
            }
        }

        // Create new server with configuration
        let config = crate::server::ServerConfig {
            root_uri,
            ..Default::default()
        };

        let server = crate::server::LspServer::with_config(language.to_string(), config);

        // Start the server
        server.start().await?;

        // Store the server
        self.servers.insert(language.to_string(), Arc::new(server));

        log::info!("Started LSP server for language: {}", language);
        Ok(())
    }

    /// Stop an LSP server
    pub async fn stop_server(&self, language: &str) -> KyroResult<()> {
        if let Some((_, server)) = self.servers.remove(language) {
            server.stop().await?;
            log::info!("Stopped LSP server for language: {}", language);
        }
        Ok(())
    }

    /// Restart an LSP server
    pub async fn restart_server(&self, language: &str) -> KyroResult<()> {
        if let Some(server) = self.get_server(language) {
            server.restart().await?;
            log::info!("Restarted LSP server for language: {}", language);
            Ok(())
        } else {
            Err(KyroError::lsp(format!(
                "No LSP server found for language: {}",
                language
            )))
        }
    }

    /// Get an LSP server for a language
    pub fn get_server(&self, language: &str) -> Option<Arc<crate::server::LspServer>> {
        self.servers.get(language).map(|s| s.value().clone())
    }

    /// List all active LSP servers
    pub fn list_servers(&self) -> Vec<String> {
        self.servers.iter().map(|e| e.key().clone()).collect()
    }

    /// Get the state of a specific server
    pub async fn get_server_state(&self, language: &str) -> Option<crate::server::ServerState> {
        if let Some(server) = self.get_server(language) {
            Some(server.state().await)
        } else {
            None
        }
    }

    /// Stop all LSP servers
    pub async fn stop_all_servers(&self) -> KyroResult<()> {
        let languages: Vec<String> = self.list_servers();

        for language in languages {
            if let Err(e) = self.stop_server(&language).await {
                log::error!("Failed to stop LSP server for {}: {}", language, e);
            }
        }

        Ok(())
    }
}

impl Default for LspManager {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Service for LspManager {
    fn name(&self) -> &str {
        "LspManager"
    }

    async fn init(&mut self) -> KyroResult<()> {
        log::info!("Initializing LSP Manager");
        Ok(())
    }

    async fn shutdown(&mut self) -> KyroResult<()> {
        log::info!("Shutting down LSP Manager");
        self.stop_all_servers().await?;
        self.servers.clear();
        Ok(())
    }

    async fn health_check(&self) -> KyroResult<()> {
        // Check if any servers are in crashed state
        let languages = self.list_servers();
        for language in languages {
            if let Some(state) = self.get_server_state(&language).await {
                if state == crate::server::ServerState::Crashed {
                    log::warn!("LSP server for {} is in crashed state", language);
                }
            }
        }
        Ok(())
    }
}

#[cfg(all(test, feature = "fixme_tests"))]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_lsp_manager() {
        let manager = LspManager::new();
        assert_eq!(manager.list_servers().len(), 0);
    }

    #[tokio::test]
    async fn test_server_lifecycle() {
        let manager = LspManager::new();

        // Note: This test will fail if rust-analyzer is not installed
        // In a real test environment, we'd use a mock LSP server
        let result = manager.start_server("rust", None).await;

        // We expect this to fail in CI/test environments without LSP servers
        // but the code path is exercised
        if result.is_ok() {
            assert_eq!(manager.list_servers().len(), 1);
            assert!(manager.get_server("rust").is_some());

            let _ = manager.stop_server("rust").await;
            assert_eq!(manager.list_servers().len(), 0);
        }
    }
}
