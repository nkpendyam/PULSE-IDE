//! Debug Adapter Integration for KRO IDE
//!
//! Integrates LLDB-DAP and CodeLLDB for Rust debugging.
//! Provides "batteries included" debugging experience.

use anyhow::{Result, Context, bail};
use std::path::{Path, PathBuf};
use std::process::{Command, Child};
use std::collections::HashMap;
use serde::{Deserialize, Serialize};

/// Supported debug adapters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DebugAdapterType {
    LldbDap,
    CodeLldb,
    Gdb,
    Custom(String),
}

/// Debug adapter configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugAdapterConfig {
    /// Adapter type
    pub adapter_type: DebugAdapterType,
    /// Command to run
    pub command: String,
    /// Command arguments
    pub args: Vec<String>,
    /// Download URL if not bundled
    pub download_url: Option<String>,
    /// Whether bundled with IDE
    pub bundled: bool,
}

/// Debug adapter instance
pub struct DebugAdapterInstance {
    pub config: DebugAdapterConfig,
    pub process: Option<Child>,
    pub status: AdapterStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AdapterStatus {
    NotInstalled,
    Starting,
    Running,
    Stopped,
    Error(String),
}

/// Debug Adapter Manager
pub struct DebugAdapterManager {
    adapters: HashMap<String, DebugAdapterConfig>,
    instances: HashMap<String, DebugAdapterInstance>,
    bin_dir: PathBuf,
}

impl DebugAdapterManager {
    /// Create a new debug adapter manager
    pub fn new(bin_dir: PathBuf) -> Self {
        let mut adapters = HashMap::new();

        // LLDB-DAP (LLVM project)
        adapters.insert("lldb-dap".to_string(), DebugAdapterConfig {
            adapter_type: DebugAdapterType::LldbDap,
            command: "lldb-dap".to_string(),
            args: vec![],
            download_url: Some("https://github.com/llvm/llvm-project/releases/latest/download/lldb-dap-{platform}".to_string()),
            bundled: false,
        });

        // CodeLLDB (VS Code extension, works on all platforms)
        adapters.insert("codelldb".to_string(), DebugAdapterConfig {
            adapter_type: DebugAdapterType::CodeLldb,
            command: "codelldb".to_string(),
            args: vec!["--port".to_string(), "0".to_string()],
            download_url: Some("https://github.com/vadimcn/vscode-lldb/releases/latest/download/codelldb-{platform}.vsix".to_string()),
            bundled: false,
        });

        Self {
            adapters,
            instances: HashMap::new(),
            bin_dir,
        }
    }

    /// Check if adapter is installed
    pub fn is_adapter_installed(&self, adapter_name: &str) -> bool {
        if let Some(config) = self.adapters.get(adapter_name) {
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

    /// Get recommended adapter for platform
    pub fn get_recommended_adapter(&self) -> &'static str {
        #[cfg(target_os = "macos")]
        { "lldb-dap" }
        
        #[cfg(target_os = "linux")]
        { "lldb-dap" }
        
        #[cfg(target_os = "windows")]
        { "codelldb" }
        
        #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
        { "codelldb" }
    }

    /// Download a debug adapter
    pub async fn download_adapter(&self, adapter_name: &str) -> Result<PathBuf> {
        let config = self.adapters.get(adapter_name)
            .ok_or_else(|| anyhow::anyhow!("Unknown adapter: {}", adapter_name))?
            .clone();

        let url = config.download_url.as_ref()
            .ok_or_else(|| anyhow::anyhow!("No download URL for {}", adapter_name))?;

        // Replace platform placeholder
        let url = url.replace("{platform}", &Self::get_platform_suffix());

        log::info!("Downloading debug adapter {} from {}", adapter_name, url);

        // Create bin dir
        std::fs::create_dir_all(&self.bin_dir)?;

        let dest_path = self.bin_dir.join(&config.command);

        // Handle VSIX files for codelldb
        if url.ends_with(".vsix") {
            // Download VSIX
            let response = reqwest::get(&url).await?;
            let bytes = response.bytes().await?;
            
            // Extract the extension
            let vsix_path = self.bin_dir.join(format!("{}.vsix", adapter_name));
            std::fs::write(&vsix_path, &bytes)?;
            
            // Extract using unzip
            self.extract_vsix(&vsix_path, &dest_path)?;
        } else {
            // Direct download
            let response = reqwest::get(&url).await?;
            let bytes = response.bytes().await?;
            std::fs::write(&dest_path, &bytes)?;

            // Make executable on Unix
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(&dest_path, std::fs::Permissions::from_mode(0o755))?;
            }
        }

        log::info!("Downloaded {} to {:?}", adapter_name, dest_path);
        Ok(dest_path)
    }

    /// Extract VSIX and find adapter binary
    fn extract_vsix(&self, vsix_path: &Path, dest_path: &Path) -> Result<()> {
        use zip::ZipArchive;
        use std::fs::File;
        use std::io::Read;

        let file = File::open(vsix_path)?;
        let mut archive = ZipArchive::new(file)?;

        // Find the adapter binary in extension
        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let name = file.name().to_string();
            
            // Look for the adapter binary
            if name.contains("codelldb") || name.contains("lldb-dap") {
                let mut contents = Vec::new();
                file.read_to_end(&mut contents)?;
                std::fs::write(dest_path, &contents)?;

                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    std::fs::set_permissions(dest_path, std::fs::Permissions::from_mode(0o755))?;
                }

                break;
            }
        }

        // Clean up VSIX
        let _ = std::fs::remove_file(vsix_path);

        Ok(())
    }

    /// Get platform suffix for downloads
    fn get_platform_suffix() -> String {
        #[cfg(target_os = "linux")]
        {
            #[cfg(target_arch = "x86_64")]
            return "x86_64-linux".to_string();
            #[cfg(target_arch = "aarch64")]
            return "aarch64-linux".to_string();
        }
        #[cfg(target_os = "macos")]
        {
            #[cfg(target_arch = "x86_64")]
            return "x86_64-darwin".to_string();
            #[cfg(target_arch = "aarch64")]
            return "aarch64-darwin".to_string();
        }
        #[cfg(target_os = "windows")]
        {
            return "x86_64-windows".to_string();
        }
        "unknown".to_string()
    }

    /// Start a debug adapter
    pub fn start_adapter(&mut self, adapter_name: &str) -> Result<()> {
        let config = self.adapters.get(adapter_name)
            .ok_or_else(|| anyhow::anyhow!("Unknown adapter: {}", adapter_name))?
            .clone();

        // Check if already running
        if let Some(instance) = self.instances.get(adapter_name) {
            if instance.status == AdapterStatus::Running {
                log::info!("Adapter {} already running", adapter_name);
                return Ok(());
            }
        }

        // Check if installed
        if !self.is_adapter_installed(adapter_name) {
            bail!("Adapter {} not installed. Call download_adapter first.", adapter_name);
        }

        // Determine command path
        let command_path = if self.bin_dir.join(&config.command).exists() {
            self.bin_dir.join(&config.command)
        } else {
            which::which(&config.command)?
        };

        log::info!("Starting debug adapter: {} from {:?}", adapter_name, command_path);

        // Start process
        let child = Command::new(&command_path)
            .args(&config.args)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .with_context(|| format!("Failed to start {}", adapter_name))?;

        // Store instance
        let instance = DebugAdapterInstance {
            config,
            process: Some(child),
            status: AdapterStatus::Running,
        };

        self.instances.insert(adapter_name.to_string(), instance);

        log::info!("Debug adapter {} started successfully", adapter_name);
        Ok(())
    }

    /// Stop a debug adapter
    pub fn stop_adapter(&mut self, adapter_name: &str) -> Result<()> {
        if let Some(mut instance) = self.instances.remove(adapter_name) {
            if let Some(mut child) = instance.process.take() {
                child.kill()?;
                log::info!("Stopped debug adapter {}", adapter_name);
            }
        }
        Ok(())
    }

    /// Generate launch.json for Rust project
    pub fn generate_rust_launch_config(project_path: &Path, program_name: &str) -> LaunchConfig {
        LaunchConfig {
            version: "0.2.0".to_string(),
            configurations: vec![LaunchConfiguration {
                name: "Debug Rust".to_string(),
                config_type: "lldb".to_string(),
                request: "launch".to_string(),
                program: project_path.join("target")
                    .join("debug")
                    .join(program_name)
                    .to_string_lossy()
                    .to_string(),
                cwd: project_path.to_string_lossy().to_string(),
                stop_on_entry: false,
                args: vec![],
                env: HashMap::new(),
                pre_launch_task: Some("cargo build".to_string()),
            }],
        }
    }

    /// List registered adapters
    pub fn list_adapters(&self) -> Vec<DebugAdapterConfig> {
        self.adapters.values().cloned().collect()
    }
}

impl Default for DebugAdapterManager {
    fn default() -> Self {
        let bin_dir = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("kro_ide")
            .join("bin");
        
        Self::new(bin_dir)
    }
}

/// Launch configuration (launch.json)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchConfig {
    pub version: String,
    pub configurations: Vec<LaunchConfiguration>,
}

/// Single launch configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchConfiguration {
    pub name: String,
    #[serde(rename = "type")]
    pub config_type: String,
    pub request: String,
    pub program: String,
    pub cwd: String,
    pub stop_on_entry: bool,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
    pub pre_launch_task: Option<String>,
}
