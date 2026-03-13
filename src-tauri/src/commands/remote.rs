use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use tauri::command;
use tokio::process::Command;
use tokio::sync::RwLock;
use tokio::time::{timeout, Duration};

lazy_static::lazy_static! {
    static ref REMOTE_STATE: Arc<RwLock<HashMap<String, RemoteConnection>>> =
        Arc::new(RwLock::new(HashMap::new()));
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteConnection {
    pub connection_id: String,
    pub connection_type: String,
    pub host: String,
    pub status: String,
    pub connected_at: String,
    pub config: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteCapabilities {
    pub supports_ssh: bool,
    pub supports_wsl: bool,
    pub supports_devcontainer: bool,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteExecResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub duration_ms: u128,
}

fn binary_available(binary: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("where")
            .arg(binary)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("sh")
            .arg("-lc")
            .arg(format!("command -v {}", binary))
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    }
}

fn wrap_with_cwd(command: &str, cwd: Option<&str>) -> String {
    match cwd {
        Some(path) if !path.trim().is_empty() => format!("cd '{}' && {}", path, command),
        _ => command.to_string(),
    }
}

#[command]
pub async fn remote_connect(
    connection_type: String,
    host: String,
    config: HashMap<String, String>,
) -> Result<RemoteConnection, String> {
    let connection_id = format!(
        "{}:{}:{}",
        connection_type,
        host,
        chrono::Utc::now().timestamp_millis()
    );

    let connection = RemoteConnection {
        connection_id: connection_id.clone(),
        connection_type,
        host,
        status: "connected".to_string(),
        connected_at: chrono::Utc::now().to_rfc3339(),
        config,
    };

    let mut state = REMOTE_STATE.write().await;
    state.insert(connection_id, connection.clone());

    Ok(connection)
}

#[command]
pub async fn remote_disconnect(connection_id: String) -> Result<bool, String> {
    let mut state = REMOTE_STATE.write().await;
    Ok(state.remove(&connection_id).is_some())
}

#[command]
pub async fn list_remote_connections() -> Result<Vec<RemoteConnection>, String> {
    let state = REMOTE_STATE.read().await;
    Ok(state.values().cloned().collect())
}

#[command]
pub async fn remote_get_capabilities() -> Result<RemoteCapabilities, String> {
    let supports_ssh = binary_available("ssh");
    let supports_wsl = {
        #[cfg(target_os = "windows")]
        {
            binary_available("wsl")
        }
        #[cfg(not(target_os = "windows"))]
        {
            false
        }
    };
    let supports_devcontainer = binary_available("docker");

    let mut notes = Vec::new();
    if !supports_ssh {
        notes.push("SSH client was not detected on PATH.".to_string());
    }
    if !supports_wsl {
        notes.push("WSL runtime was not detected (or not available on this OS).".to_string());
    }
    if !supports_devcontainer {
        notes.push("Docker CLI was not detected; devcontainer execution is unavailable.".to_string());
    }

    Ok(RemoteCapabilities {
        supports_ssh,
        supports_wsl,
        supports_devcontainer,
        notes,
    })
}

#[command]
pub async fn remote_execute_command(
    connection_id: String,
    command: String,
    cwd: Option<String>,
) -> Result<RemoteExecResult, String> {
    let state = REMOTE_STATE.read().await;
    let connection = state
        .get(&connection_id)
        .cloned()
        .ok_or_else(|| "Remote connection not found".to_string())?;
    drop(state);

    if connection.status != "connected" {
        return Err("Remote connection is not in connected state".to_string());
    }

    let cmd_with_cwd = wrap_with_cwd(&command, cwd.as_deref());
    let mut process = match connection.connection_type.as_str() {
        "ssh" => {
            if !binary_available("ssh") {
                return Err("SSH client not available on PATH".to_string());
            }

            if connection.host.trim().is_empty() {
                return Err("SSH host is empty".to_string());
            }

            let mut proc = Command::new("ssh");
            proc.arg(connection.host).arg(cmd_with_cwd);
            proc
        }
        "wsl" => {
            #[cfg(target_os = "windows")]
            {
                if !binary_available("wsl") {
                    return Err("WSL is not available on this machine".to_string());
                }

                let mut proc = Command::new("wsl");
                if !connection.host.trim().is_empty() {
                    proc.arg("-d").arg(connection.host);
                }
                proc.arg("--").arg("sh").arg("-lc").arg(cmd_with_cwd);
                proc
            }

            #[cfg(not(target_os = "windows"))]
            {
                return Err("WSL execution is only available on Windows hosts".to_string());
            }
        }
        "devcontainer" => {
            if !binary_available("docker") {
                return Err("Docker CLI is not available on PATH".to_string());
            }

            if connection.host.trim().is_empty() {
                return Err(
                    "Devcontainer host must be a running container name or id".to_string(),
                );
            }

            let mut proc = Command::new("docker");
            proc.arg("exec")
                .arg(connection.host)
                .arg("sh")
                .arg("-lc")
                .arg(cmd_with_cwd);
            proc
        }
        other => {
            return Err(format!(
                "Unsupported remote connection type '{}'. Supported: ssh, wsl, devcontainer",
                other
            ))
        }
    };

    let started = std::time::Instant::now();
    process.stdout(Stdio::piped()).stderr(Stdio::piped());

    let output = timeout(Duration::from_secs(45), process.output())
        .await
        .map_err(|_| "Remote command timed out after 45 seconds".to_string())?
        .map_err(|e| format!("Failed to execute remote command: {}", e))?;

    Ok(RemoteExecResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
        duration_ms: started.elapsed().as_millis(),
    })
}
