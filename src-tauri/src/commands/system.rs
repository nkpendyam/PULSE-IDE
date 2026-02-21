use serde::{Deserialize, Serialize};
use std::env;
use directories::{BaseDirs, ProjectDirs};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub os_version: String,
    pub arch: String,
    pub hostname: String,
    pub username: String,
    pub home_dir: String,
    pub total_memory: u64,
    pub available_memory: u64,
    pub cpu_cores: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub theme: String,
    pub font_size: u32,
    pub font_family: String,
    pub tab_size: u32,
    pub word_wrap: bool,
    pub minimap: bool,
    pub line_numbers: bool,
    pub auto_save: bool,
    pub auto_save_delay: u32,
    pub default_model: String,
    pub ollama_host: String,
    pub recent_projects: Vec<String>,
    pub recent_files: Vec<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            font_size: 14,
            font_family: "JetBrains Mono".to_string(),
            tab_size: 2,
            word_wrap: true,
            minimap: true,
            line_numbers: true,
            auto_save: true,
            auto_save_delay: 1000,
            default_model: "llama3.2".to_string(),
            ollama_host: "http://localhost:11434".to_string(),
            recent_projects: Vec::new(),
            recent_files: Vec::new(),
        }
    }
}

/// Get system information
#[tauri::command]
pub async fn get_system_info() -> Result<SystemInfo, String> {
    let os = env::consts::OS.to_string();
    let arch = env::consts::ARCH.to_string();
    
    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown".to_string());
    
    let username = whoami::username();
    
    let home_dir = BaseDirs::new()
        .map(|b| b.home_dir().to_string_lossy().to_string())
        .unwrap_or_else(|| "/".to_string());
    
    // Memory info (approximate)
    let (total_memory, available_memory) = get_memory_info();
    
    let cpu_cores = num_cpus::get();
    
    Ok(SystemInfo {
        os,
        os_version: get_os_version(),
        arch,
        hostname,
        username,
        home_dir,
        total_memory,
        available_memory,
        cpu_cores,
    })
}

fn get_os_version() -> String {
    #[cfg(windows)]
    {
        use std::process::Command;
        Command::new("cmd")
            .args(["/C", "ver"])
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_else(|_| "Windows".to_string())
    }
    
    #[cfg(target_os = "linux")]
    {
        std::fs::read_to_string("/etc/os-release")
            .ok()
            .and_then(|content| {
                content.lines()
                    .find(|line| line.starts_with("PRETTY_NAME="))
                    .map(|line| line.replace("PRETTY_NAME=", "").replace("\"", ""))
            })
            .unwrap_or_else(|| "Linux".to_string())
    }
    
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        Command::new("sw_vers")
            .arg("-productVersion")
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_else(|_| "macOS".to_string())
    }
}

fn get_memory_info() -> (u64, u64) {
    #[cfg(windows)]
    {
        use std::mem::size_of;
        use winapi::um::sysinfoapi::{GlobalMemoryStatusEx, MEMORYSTATUSEX};
        
        unsafe {
            let mut status: MEMORYSTATUSEX = std::mem::zeroed();
            status.dwLength = size_of::<MEMORYSTATUSEX>() as u32;
            GlobalMemoryStatusEx(&mut status);
            
            let total = status.ullTotalPhys / (1024 * 1024 * 1024); // GB
            let available = status.ullAvailPhys / (1024 * 1024 * 1024); // GB
            
            (total, available)
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        std::fs::read_to_string("/proc/meminfo")
            .ok()
            .and_then(|content| {
                let mut total = 0u64;
                let mut available = 0u64;
                
                for line in content.lines() {
                    if line.starts_with("MemTotal:") {
                        total = line.split_whitespace()
                            .nth(1)
                            .and_then(|s| s.parse().ok())
                            .unwrap_or(0) / (1024 * 1024);
                    }
                    if line.starts_with("MemAvailable:") {
                        available = line.split_whitespace()
                            .nth(1)
                            .and_then(|s| s.parse().ok())
                            .unwrap_or(0) / (1024 * 1024);
                    }
                }
                
                Some((total, available))
            })
            .unwrap_or((16, 8)) // Default fallback
    }
    
    #[cfg(target_os = "macos")]
    {
        // macOS memory is harder to get, use sysctl
        use std::process::Command;
        
        let total = Command::new("sysctl")
            .args(["-n", "hw.memsize"])
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .and_then(|s| s.trim().parse().ok())
            .map(|bytes: u64| bytes / (1024 * 1024 * 1024))
            .unwrap_or(16);
        
        (total, total / 2) // Approximate available as half
    }
}

/// Open URL in external browser
#[tauri::command]
pub async fn open_external(url: String) -> Result<(), String> {
    open::that(&url)
        .map_err(|e| format!("Failed to open URL: {}", e))
}

/// Get application settings
#[tauri::command]
pub async fn get_settings() -> Result<Settings, String> {
    let settings_path = get_settings_path();
    
    if settings_path.exists() {
        let content = fs::read_to_string(&settings_path)
            .map_err(|e| format!("Failed to read settings: {}", e))?;
        
        let settings: Settings = serde_json::from_str(&content)
            .unwrap_or_else(|_| Settings::default());
        
        Ok(settings)
    } else {
        Ok(Settings::default())
    }
}

/// Save application settings
#[tauri::command]
pub async fn save_settings(settings: Settings) -> Result<(), String> {
    let settings_path = get_settings_path();
    
    // Create parent directory if needed
    if let Some(parent) = settings_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create settings directory: {}", e))?;
    }
    
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    
    fs::write(&settings_path, content)
        .map_err(|e| format!("Failed to write settings: {}", e))?;
    
    Ok(())
}

fn get_settings_path() -> PathBuf {
    ProjectDirs::from("dev", "pulseide", "pulse-ide")
        .map(|dirs| dirs.config_dir().join("settings.json"))
        .unwrap_or_else(|| PathBuf::from("settings.json"))
}
