//! LSP Server Manager for KRO IDE
//!
//! Automatically detects project type and starts appropriate language servers.
//! Bundles common servers for "batteries included" experience.

use anyhow::{Result, Context, bail};
use std::path::{Path, PathBuf};
use std::process::{Command, Child};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};

/// LSP Server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspServerConfig {
    /// Server name
    pub name: String,
    /// Command to run
    pub command: String,
    /// Command arguments
    pub args: Vec<String>,
    /// File patterns to detect (glob)
    pub detect_patterns: Vec<String>,
    /// File extensions this server handles
    pub extensions: Vec<String>,
    /// Download URL if not bundled
    pub download_url: Option<String>,
    /// Whether bundled with IDE
    pub bundled: bool,
}

/// Running LSP server instance
#[derive(Debug)]
pub struct LspServerInstance {
    pub config: LspServerConfig,
    pub process: Option<Child>,
    pub status: ServerStatus,
    pub project_root: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ServerStatus {
    NotInstalled,
    Starting,
    Running,
    Stopped,
    Error(String),
}

/// LSP Manager handling server lifecycle
pub struct LspManager {
    servers: HashMap<String, LspServerConfig>,
    instances: Arc<RwLock<HashMap<String, LspServerInstance>>>,
    bin_dir: PathBuf,
}

impl LspManager {
    /// Create a new LSP manager
    pub fn new(bin_dir: PathBuf) -> Self {
        let mut servers = HashMap::new();
        
        // Register known language servers
        servers.insert("rust-analyzer".to_string(), LspServerConfig {
            name: "rust-analyzer".to_string(),
            command: "rust-analyzer".to_string(),
            args: vec![],
            detect_patterns: vec!["Cargo.toml".to_string()],
            extensions: vec!["rs".to_string()],
            download_url: Some("https://github.com/rust-lang/rust-analyzer/releases/latest/download/rust-analyzer-{platform}".to_string()),
            bundled: false,
        });

        servers.insert("typescript-language-server".to_string(), LspServerConfig {
            name: "typescript-language-server".to_string(),
            command: "typescript-language-server".to_string(),
            args: vec!["--stdio".to_string()],
            detect_patterns: vec!["package.json".to_string(), "tsconfig.json".to_string()],
            extensions: vec!["ts".to_string(), "tsx".to_string(), "js".to_string(), "jsx".to_string()],
            download_url: None,
            bundled: false,
        });

        servers.insert("pylsp".to_string(), LspServerConfig {
            name: "pylsp".to_string(),
            command: "pylsp".to_string(),
            args: vec![],
            detect_patterns: vec!["requirements.txt".to_string(), "pyproject.toml".to_string(), "setup.py".to_string()],
            extensions: vec!["py".to_string()],
            download_url: None,
            bundled: false,
        });

        servers.insert("gopls".to_string(), LspServerConfig {
            name: "gopls".to_string(),
            command: "gopls".to_string(),
            args: vec!["serve".to_string()],
            detect_patterns: vec!["go.mod".to_string()],
            extensions: vec!["go".to_string()],
            download_url: None,
            bundled: false,
        });

        servers.insert("clangd".to_string(), LspServerConfig {
            name: "clangd".to_string(),
            command: "clangd".to_string(),
            args: vec![],
            detect_patterns: vec!["compile_commands.json".to_string(), "CMakeLists.txt".to_string()],
            extensions: vec!["c".to_string(), "cpp".to_string(), "h".to_string(), "hpp".to_string()],
            download_url: None,
            bundled: false,
        });

        Self {
            servers,
            instances: Arc::new(RwLock::new(HashMap::new())),
            bin_dir,
        }
    }

    /// Detect project type from root directory
    pub fn detect_project_types(&self, project_root: &Path) -> Vec<String> {
        let mut detected = Vec::new();
        
        for (name, config) in &self.servers {
            for pattern in &config.detect_patterns {
                if project_root.join(pattern).exists() {
                    detected.push(name.clone());
                    break;
                }
            }
        }
        
        detected
    }

    /// Get server for file extension
    pub fn get_server_for_extension(&self, ext: &str) -> Option<&LspServerConfig> {
        self.servers.values()
            .find(|s| s.extensions.iter().any(|e| e == ext))
    }

    /// Check if a server is installed
    pub fn is_server_installed(&self, server_name: &str) -> bool {
        if let Some(config) = self.servers.get(server_name) {
            // Check bundled first
            let bundled_path = self.bin_dir.join(&config.command);
            if bundled_path.exists() {
                return true;
            }
            
            // Check system PATH
            which::which(&config.command).is_ok()
        } else {
            false
        }
    }

    /// Download a language server
    pub async fn download_server(&self, server_name: &str) -> Result<PathBuf> {
        let config = self.servers.get(server_name)
            .ok_or_else(|| anyhow::anyhow!("Unknown server: {}", server_name))?
            .clone();

        let url = config.download_url.as_ref()
            .ok_or_else(|| anyhow::anyhow!("No download URL for {}", server_name))?;

        // Replace platform placeholder
        let url = url.replace("{platform}", &Self::get_platform_suffix());

        log::info!("Downloading {} from {}", server_name, url);

        // Create bin dir
        std::fs::create_dir_all(&self.bin_dir)?;

        let dest_path = self.bin_dir.join(&config.command);

        // Download
        let response = reqwest::get(&url).await?;
        let bytes = response.bytes().await?;

        // Handle gzip if needed
        if url.ends_with(".gz") {
            use flate2::read::GzDecoder;
            use std::io::Read;
            
            let mut decoder = GzDecoder::new(&bytes[..]);
            let mut decompressed = Vec::new();
            decoder.read_to_end(&mut decompressed)?;
            std::fs::write(&dest_path, decompressed)?;
        } else {
            std::fs::write(&dest_path, &bytes)?;
        }

        // Make executable on Unix
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&dest_path, std::fs::Permissions::from_mode(0o755))?;
        }

        log::info!("Downloaded {} to {:?}", server_name, dest_path);
        Ok(dest_path)
    }

    /// Get platform suffix for downloads
    fn get_platform_suffix() -> String {
        #[cfg(target_os = "linux")]
        {
            #[cfg(target_arch = "x86_64")]
            return "x86_64-unknown-linux-gnu.gz".to_string();
            #[cfg(target_arch = "aarch64")]
            return "aarch64-unknown-linux-gnu.gz".to_string();
        }
        #[cfg(target_os = "macos")]
        {
            #[cfg(target_arch = "x86_64")]
            return "x86_64-apple-darwin.gz".to_string();
            #[cfg(target_arch = "aarch64")]
            return "aarch64-apple-darwin.gz".to_string();
        }
        #[cfg(target_os = "windows")]
        {
            return "x86_64-pc-windows-msvc.exe".to_string();
        }
        "unknown".to_string()
    }

    /// Start a language server for a project
    pub async fn start_server(&self, server_name: &str, project_root: PathBuf) -> Result<()> {
        let config = self.servers.get(server_name)
            .ok_or_else(|| anyhow::anyhow!("Unknown server: {}", server_name))?
            .clone();

        // Check if already running
        let instances = self.instances.read().await;
        if let Some(instance) = instances.get(server_name) {
            if instance.status == ServerStatus::Running {
                log::info!("Server {} already running", server_name);
                return Ok(());
            }
        }
        drop(instances);

        // Check if installed
        if !self.is_server_installed(server_name) {
            // Try to download
            if config.download_url.is_some() {
                self.download_server(server_name).await?;
            } else {
                bail!("Server {} not installed and no download URL", server_name);
            }
        }

        // Determine command path
        let command_path = if self.bin_dir.join(&config.command).exists() {
            self.bin_dir.join(&config.command)
        } else {
            which::which(&config.command)?
        };

        log::info!("Starting LSP server: {} from {:?}", server_name, command_path);

        // Start process
        let mut cmd = Command::new(&command_path);
        cmd.args(&config.args)
            .current_dir(&project_root)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        let child = cmd.spawn()
            .with_context(|| format!("Failed to start {}", server_name))?;

        // Store instance
        let instance = LspServerInstance {
            config: config.clone(),
            process: Some(child),
            status: ServerStatus::Running,
            project_root,
        };

        let mut instances = self.instances.write().await;
        instances.insert(server_name.to_string(), instance);

        log::info!("LSP server {} started successfully", server_name);
        Ok(())
    }

    /// Stop a language server
    pub async fn stop_server(&self, server_name: &str) -> Result<()> {
        let mut instances = self.instances.write().await;
        
        if let Some(mut instance) = instances.remove(server_name) {
            if let Some(mut child) = instance.process.take() {
                child.kill()?;
                log::info!("Stopped LSP server {}", server_name);
            }
        }
        
        Ok(())
    }

    /// Stop all servers
    pub async fn stop_all(&self) -> Result<()> {
        let mut instances = self.instances.write().await;
        
        for (name, mut instance) in instances.drain() {
            if let Some(mut child) = instance.process.take() {
                let _ = child.kill();
                log::info!("Stopped LSP server {}", name);
            }
        }
        
        Ok(())
    }

    /// Get server status
    pub async fn get_status(&self, server_name: &str) -> ServerStatus {
        let instances = self.instances.read().await;
        
        if let Some(instance) = instances.get(server_name) {
            instance.status.clone()
        } else if self.is_server_installed(server_name) {
            ServerStatus::Stopped
        } else {
            ServerStatus::NotInstalled
        }
    }

    /// List all registered servers
    pub fn list_servers(&self) -> Vec<LspServerConfig> {
        self.servers.values().cloned().collect()
    }
}

impl Default for LspManager {
    fn default() -> Self {
        let bin_dir = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("kro_ide")
            .join("bin");
        
        Self::new(bin_dir)
    }
}

/// Auto-start appropriate LSP servers based on project
pub async fn auto_start_lsp_servers(project_root: &Path) -> Result<Arc<LspManager>> {
    let manager = Arc::new(LspManager::default());
    
    let project_types = manager.detect_project_types(project_root);
    log::info!("Detected project types: {:?}", project_types);
    
    for server_name in project_types {
        match manager.start_server(&server_name, project_root.to_path_buf()).await {
            Ok(_) => log::info!("Started {}", server_name),
            Err(e) => log::warn!("Failed to start {}: {}", server_name, e),
        }
    }
    
    Ok(manager)
}
