use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteProfile {
    pub id: String,
    pub name: String,
    pub connection_type: String,
    pub host: String,
    pub config: HashMap<String, String>,
    pub last_connected: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteFileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: Option<u64>,
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

fn shell_escape(value: &str) -> String {
    value.replace('"', "\\\"")
}

fn remote_profiles_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".kyro")
        .join("remote_profiles.json")
}

fn read_profiles_from_disk() -> Vec<RemoteProfile> {
    let path = remote_profiles_path();
    if !path.exists() {
        return vec![];
    }

    match std::fs::read_to_string(path) {
        Ok(content) => serde_json::from_str::<Vec<RemoteProfile>>(&content).unwrap_or_default(),
        Err(_) => vec![],
    }
}

fn write_profiles_to_disk(profiles: &[RemoteProfile]) -> Result<(), String> {
    let path = remote_profiles_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create remote profile dir: {}", e))?;
    }

    let payload = serde_json::to_string_pretty(profiles)
        .map_err(|e| format!("Failed to serialize remote profiles: {}", e))?;

    std::fs::write(path, payload).map_err(|e| format!("Failed to write remote profiles: {}", e))
}

async fn run_remote_shell(
    connection: &RemoteConnection,
    command: &str,
    cwd: Option<String>,
) -> Result<RemoteExecResult, String> {
    let cmd_with_cwd = wrap_with_cwd(command, cwd.as_deref());
    let mut process = match connection.connection_type.as_str() {
        "ssh" => {
            if !binary_available("ssh") {
                return Err("SSH client not available on PATH".to_string());
            }

            if connection.host.trim().is_empty() {
                return Err("SSH host is empty".to_string());
            }

            let mut proc = Command::new("ssh");
            proc.arg(&connection.host).arg(cmd_with_cwd);
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
                    proc.arg("-d").arg(&connection.host);
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
                .arg(&connection.host)
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

#[command]
pub async fn remote_connect(
    connection_id: Option<String>,
    connection_type: String,
    host: String,
    config: HashMap<String, String>,
) -> Result<RemoteConnection, String> {
    let connection_id = connection_id.unwrap_or_else(|| {
        format!(
            "{}:{}:{}",
            connection_type,
            host,
            chrono::Utc::now().timestamp_millis()
        )
    });

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

    run_remote_shell(&connection, &command, cwd).await
}

#[command]
pub async fn remote_list_profiles() -> Result<Vec<RemoteProfile>, String> {
    Ok(read_profiles_from_disk())
}

#[command]
pub async fn remote_save_profile(
    id: String,
    name: String,
    connection_type: String,
    host: String,
    config: HashMap<String, String>,
    last_connected: Option<i64>,
) -> Result<RemoteProfile, String> {
    let mut profiles = read_profiles_from_disk();

    let profile = RemoteProfile {
        id: id.clone(),
        name,
        connection_type,
        host,
        config,
        last_connected,
    };

    if let Some(existing) = profiles.iter_mut().find(|p| p.id == id) {
        *existing = profile.clone();
    } else {
        profiles.push(profile.clone());
    }

    write_profiles_to_disk(&profiles)?;
    Ok(profile)
}

#[command]
pub async fn remote_remove_profile(id: String) -> Result<bool, String> {
    let mut profiles = read_profiles_from_disk();
    let before = profiles.len();
    profiles.retain(|p| p.id != id);
    write_profiles_to_disk(&profiles)?;
    Ok(before != profiles.len())
}

#[command]
pub async fn remote_list_files(
    connection_id: String,
    path: Option<String>,
) -> Result<Vec<RemoteFileEntry>, String> {
    let state = REMOTE_STATE.read().await;
    let connection = state
        .get(&connection_id)
        .cloned()
        .ok_or_else(|| "Remote connection not found".to_string())?;
    drop(state);

    let base_path = path.unwrap_or_else(|| ".".to_string());
    let escaped = shell_escape(&base_path);
    let cmd = format!("ls -la \"{}\"", escaped);
    let result = run_remote_shell(&connection, &cmd, None).await?;

    if result.exit_code != 0 {
        return Err(format!("Failed to list files: {}", result.stderr));
    }

    let mut entries = Vec::new();
    for line in result.stdout.lines().skip(1) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.len() < 9 {
            continue;
        }

        let permissions = parts[0];
        let is_directory = permissions.starts_with('d');
        let size = parts[4].parse::<u64>().ok();
        let name = parts[8..].join(" ");

        if name == "." || name == ".." {
            continue;
        }

        let normalized_base = base_path.trim_end_matches('/');
        let full_path = if normalized_base.is_empty() || normalized_base == "." {
            name.clone()
        } else {
            format!("{}/{}", normalized_base, name)
        };

        entries.push(RemoteFileEntry {
            name,
            path: full_path,
            is_directory,
            size,
        });
    }

    Ok(entries)
}

#[command]
pub async fn remote_read_file(
    connection_id: String,
    path: String,
) -> Result<String, String> {
    let state = REMOTE_STATE.read().await;
    let connection = state
        .get(&connection_id)
        .cloned()
        .ok_or_else(|| "Remote connection not found".to_string())?;
    drop(state);

    let escaped = shell_escape(&path);
    let cmd = format!("cat \"{}\"", escaped);
    let result = run_remote_shell(&connection, &cmd, None).await?;

    if result.exit_code != 0 {
        return Err(format!("Failed to read file: {}", result.stderr));
    }

    if result.stdout.len() > 200_000 {
        return Ok(result.stdout.chars().take(200_000).collect());
    }

    Ok(result.stdout)
}

#[command]
pub async fn remote_write_file(
    connection_id: String,
    path: String,
    content: String,
) -> Result<bool, String> {
    let state = REMOTE_STATE.read().await;
    let connection = state
        .get(&connection_id)
        .cloned()
        .ok_or_else(|| "Remote connection not found".to_string())?;
    drop(state);

    let escaped_path = shell_escape(&path);
    let marker = format!("__KYRO_EOF_{}__", chrono::Utc::now().timestamp_millis());
    let cmd = format!(
        "cat > \"{}\" <<'{}'\n{}\n{}",
        escaped_path, marker, content, marker
    );

    let result = run_remote_shell(&connection, &cmd, None).await?;
    if result.exit_code != 0 {
        return Err(format!("Failed to write remote file: {}", result.stderr));
    }

    Ok(true)
}

#[command]
pub async fn remote_export_file_to_local(
    connection_id: String,
    remote_path: String,
    local_path: String,
) -> Result<bool, String> {
    let content = remote_read_file(connection_id, remote_path).await?;

    let target_path = PathBuf::from(local_path);
    if let Some(parent) = target_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create local export directory: {}", e))?;
    }

    std::fs::write(&target_path, content)
        .map_err(|e| format!("Failed to write exported file: {}", e))?;

    Ok(true)
}

#[command]
pub async fn remote_delete_path(
    connection_id: String,
    path: String,
    recursive: Option<bool>,
) -> Result<bool, String> {
    let state = REMOTE_STATE.read().await;
    let connection = state
        .get(&connection_id)
        .cloned()
        .ok_or_else(|| "Remote connection not found".to_string())?;
    drop(state);

    let escaped_path = shell_escape(&path);
    let delete_flag = if recursive.unwrap_or(true) { "-rf" } else { "-f" };
    let cmd = format!("rm {} \"{}\"", delete_flag, escaped_path);
    let result = run_remote_shell(&connection, &cmd, None).await?;

    if result.exit_code != 0 {
        return Err(format!("Failed to delete remote path: {}", result.stderr));
    }

    Ok(true)
}

#[command]
pub async fn remote_rename_path(
    connection_id: String,
    old_path: String,
    new_path: String,
) -> Result<bool, String> {
    let state = REMOTE_STATE.read().await;
    let connection = state
        .get(&connection_id)
        .cloned()
        .ok_or_else(|| "Remote connection not found".to_string())?;
    drop(state);

    let escaped_old = shell_escape(&old_path);
    let escaped_new = shell_escape(&new_path);
    let cmd = format!("mv \"{}\" \"{}\"", escaped_old, escaped_new);
    let result = run_remote_shell(&connection, &cmd, None).await?;

    if result.exit_code != 0 {
        return Err(format!("Failed to rename remote path: {}", result.stderr));
    }

    Ok(true)
}

#[command]
pub async fn remote_copy_path(
    connection_id: String,
    source_path: String,
    destination_path: String,
) -> Result<bool, String> {
    let state = REMOTE_STATE.read().await;
    let connection = state
        .get(&connection_id)
        .cloned()
        .ok_or_else(|| "Remote connection not found".to_string())?;
    drop(state);

    let escaped_source = shell_escape(&source_path);
    let escaped_destination = shell_escape(&destination_path);
    let cmd = format!("cp -r \"{}\" \"{}\"", escaped_source, escaped_destination);
    let result = run_remote_shell(&connection, &cmd, None).await?;

    if result.exit_code != 0 {
        return Err(format!("Failed to copy remote path: {}", result.stderr));
    }

    Ok(true)
}

#[command]
pub async fn remote_move_path(
    connection_id: String,
    source_path: String,
    destination_path: String,
) -> Result<bool, String> {
    remote_rename_path(connection_id, source_path, destination_path).await
}

#[command]
pub async fn remote_create_directory(connection_id: String, path: String) -> Result<bool, String> {
    let state = REMOTE_STATE.read().await;
    let connection = state
        .get(&connection_id)
        .cloned()
        .ok_or_else(|| "Remote connection not found".to_string())?;
    drop(state);

    let escaped_path = shell_escape(&path);
    let cmd = format!("mkdir -p \"{}\"", escaped_path);
    let result = run_remote_shell(&connection, &cmd, None).await?;

    if result.exit_code != 0 {
        return Err(format!(
            "Failed to create remote directory: {}",
            result.stderr
        ));
    }

    Ok(true)
}

#[command]
pub async fn remote_create_file(connection_id: String, path: String) -> Result<bool, String> {
    let state = REMOTE_STATE.read().await;
    let connection = state
        .get(&connection_id)
        .cloned()
        .ok_or_else(|| "Remote connection not found".to_string())?;
    drop(state);

    let escaped_path = shell_escape(&path);
    let cmd = format!("touch \"{}\"", escaped_path);
    let result = run_remote_shell(&connection, &cmd, None).await?;

    if result.exit_code != 0 {
        return Err(format!("Failed to create remote file: {}", result.stderr));
    }

    Ok(true)
}

#[command]
pub async fn remote_upload_local_file(
    connection_id: String,
    local_path: String,
    remote_path: String,
) -> Result<bool, String> {
    let bytes = std::fs::read(&local_path)
        .map_err(|e| format!("Failed to read local file for upload: {}", e))?;

    let content = String::from_utf8(bytes).map_err(|_| {
        "Local file is not valid UTF-8 text. Binary upload is not supported yet.".to_string()
    })?;

    remote_write_file(connection_id, remote_path, content).await
}
