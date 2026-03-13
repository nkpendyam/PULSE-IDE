use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Seek, SeekFrom, Write};
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
    static ref TRANSFER_STATE: Arc<RwLock<HashMap<String, RemoteTransferStatus>>> =
        Arc::new(RwLock::new(HashMap::new()));
    static ref TRANSFER_CANCEL: Arc<RwLock<HashMap<String, bool>>> =
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteTransferStatus {
    pub transfer_id: String,
    pub direction: String,
    pub source_path: String,
    pub destination_path: String,
    pub status: String,
    pub total_bytes: u64,
    pub transferred_bytes: u64,
    pub started_at: String,
    pub updated_at: String,
    pub error_class: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteTransferResult {
    pub transfer_id: String,
    pub status: String,
    pub transferred_bytes: u64,
    pub total_bytes: u64,
}

fn classify_error(error: &str) -> String {
    let lowered = error.to_lowercase();
    if lowered.contains("permission denied") || lowered.contains("access is denied") {
        return "permission_denied".to_string();
    }
    if lowered.contains("file exists") || lowered.contains("already exists") {
        return "conflict".to_string();
    }
    if lowered.contains("no such file") || lowered.contains("not found") {
        return "not_found".to_string();
    }
    if lowered.contains("timed out") || lowered.contains("timeout") {
        return "timeout".to_string();
    }
    if lowered.contains("cancel") {
        return "cancelled".to_string();
    }
    "unknown".to_string()
}

fn error_with_class(error: &str) -> String {
    format!("[{}] {}", classify_error(error), error)
}

async fn set_transfer_status(status: RemoteTransferStatus) {
    let mut state = TRANSFER_STATE.write().await;
    state.insert(status.transfer_id.clone(), status);
}

async fn mark_transfer_cancelled(transfer_id: &str) {
    let mut state = TRANSFER_STATE.write().await;
    if let Some(current) = state.get_mut(transfer_id) {
        current.status = "cancelled".to_string();
        current.updated_at = chrono::Utc::now().to_rfc3339();
        current.error_class = Some("cancelled".to_string());
        current.error_message = Some("Transfer cancelled by user".to_string());
    }
}

async fn mark_transfer_failed(transfer_id: &str, error: &str) {
    let mut state = TRANSFER_STATE.write().await;
    if let Some(current) = state.get_mut(transfer_id) {
        current.status = "failed".to_string();
        current.updated_at = chrono::Utc::now().to_rfc3339();
        current.error_class = Some(classify_error(error));
        current.error_message = Some(error.to_string());
    }
}

async fn mark_transfer_completed(transfer_id: &str, transferred_bytes: u64, total_bytes: u64) {
    let mut state = TRANSFER_STATE.write().await;
    if let Some(current) = state.get_mut(transfer_id) {
        current.status = "completed".to_string();
        current.transferred_bytes = transferred_bytes;
        current.total_bytes = total_bytes;
        current.updated_at = chrono::Utc::now().to_rfc3339();
        current.error_class = None;
        current.error_message = None;
    }
}

async fn update_transfer_progress(transfer_id: &str, transferred_bytes: u64, total_bytes: u64) {
    let mut state = TRANSFER_STATE.write().await;
    if let Some(current) = state.get_mut(transfer_id) {
        current.status = "running".to_string();
        current.transferred_bytes = transferred_bytes;
        current.total_bytes = total_bytes;
        current.updated_at = chrono::Utc::now().to_rfc3339();
    }
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

async fn run_remote_shell_output(
    connection: &RemoteConnection,
    command: &str,
    cwd: Option<String>,
) -> Result<std::process::Output, String> {
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

    process.stdout(Stdio::piped()).stderr(Stdio::piped());
    timeout(Duration::from_secs(45), process.output())
        .await
        .map_err(|_| "Remote command timed out after 45 seconds".to_string())?
        .map_err(|e| format!("Failed to execute remote command: {}", e))
}

async fn get_remote_connection(connection_id: &str) -> Result<RemoteConnection, String> {
    let state = REMOTE_STATE.read().await;
    let connection = state
        .get(connection_id)
        .cloned()
        .ok_or_else(|| "Remote connection not found".to_string())?;
    drop(state);
    Ok(connection)
}

async fn remote_path_exists(connection: &RemoteConnection, path: &str) -> Result<bool, String> {
    let escaped_path = shell_escape(path);
    let cmd = format!("if [ -e \"{}\" ]; then echo exists; else echo missing; fi", escaped_path);
    let result = run_remote_shell(connection, &cmd, None).await?;
    Ok(result.stdout.trim() == "exists")
}

async fn remote_file_size(connection: &RemoteConnection, path: &str) -> Result<u64, String> {
    let escaped_path = shell_escape(path);
    let cmd = format!("wc -c < \"{}\"", escaped_path);
    let result = run_remote_shell(connection, &cmd, None).await?;
    if result.exit_code != 0 {
        return Err(error_with_class(&format!("Failed to query remote file size: {}", result.stderr)));
    }
    result
        .stdout
        .trim()
        .parse::<u64>()
        .map_err(|e| error_with_class(&format!("Invalid remote file size output: {}", e)))
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
    overwrite: Option<bool>,
) -> Result<bool, String> {
    let content = remote_read_file(connection_id, remote_path).await?;

    let target_path = PathBuf::from(local_path);
    let should_overwrite = overwrite.unwrap_or(true);
    if target_path.exists() && !should_overwrite {
        return Err(error_with_class("Local destination already exists"));
    }
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
    let connection = get_remote_connection(&connection_id).await?;

    let escaped_path = shell_escape(&path);
    let delete_flag = if recursive.unwrap_or(true) { "-rf" } else { "-f" };
    let cmd = format!("rm {} \"{}\"", delete_flag, escaped_path);
    let result = run_remote_shell(&connection, &cmd, None).await?;

    if result.exit_code != 0 {
        return Err(error_with_class(&format!(
            "Failed to delete remote path: {}",
            result.stderr
        )));
    }

    Ok(true)
}

#[command]
pub async fn remote_rename_path(
    connection_id: String,
    old_path: String,
    new_path: String,
    overwrite: Option<bool>,
) -> Result<bool, String> {
    let connection = get_remote_connection(&connection_id).await?;
    let should_overwrite = overwrite.unwrap_or(true);
    if !should_overwrite && remote_path_exists(&connection, &new_path).await? {
        return Err(error_with_class(&format!(
            "Destination already exists: {}",
            new_path
        )));
    }

    let escaped_old = shell_escape(&old_path);
    let escaped_new = shell_escape(&new_path);
    let force_flag = if should_overwrite { "-f " } else { "" };
    let cmd = format!("mv {}\"{}\" \"{}\"", force_flag, escaped_old, escaped_new);
    let result = run_remote_shell(&connection, &cmd, None).await?;

    if result.exit_code != 0 {
        return Err(error_with_class(&format!(
            "Failed to rename remote path: {}",
            result.stderr
        )));
    }

    Ok(true)
}

#[command]
pub async fn remote_copy_path(
    connection_id: String,
    source_path: String,
    destination_path: String,
    overwrite: Option<bool>,
) -> Result<bool, String> {
    let connection = get_remote_connection(&connection_id).await?;
    let should_overwrite = overwrite.unwrap_or(true);
    if !should_overwrite && remote_path_exists(&connection, &destination_path).await? {
        return Err(error_with_class(&format!(
            "Destination already exists: {}",
            destination_path
        )));
    }

    let escaped_source = shell_escape(&source_path);
    let escaped_destination = shell_escape(&destination_path);
    let no_clobber = if should_overwrite { "" } else { "-n " };
    let cmd = format!(
        "cp -r {}\"{}\" \"{}\"",
        no_clobber, escaped_source, escaped_destination
    );
    let result = run_remote_shell(&connection, &cmd, None).await?;

    if result.exit_code != 0 {
        return Err(error_with_class(&format!(
            "Failed to copy remote path: {}",
            result.stderr
        )));
    }

    Ok(true)
}

#[command]
pub async fn remote_move_path(
    connection_id: String,
    source_path: String,
    destination_path: String,
    overwrite: Option<bool>,
) -> Result<bool, String> {
    remote_rename_path(connection_id, source_path, destination_path, overwrite).await
}

#[command]
pub async fn remote_read_file_chunk_base64(
    connection_id: String,
    path: String,
    offset: u64,
    length: u64,
) -> Result<String, String> {
    let connection = get_remote_connection(&connection_id).await?;
    let escaped_path = shell_escape(&path);
    let cmd = format!(
        "dd if=\"{}\" bs=1 skip={} count={} 2>/dev/null",
        escaped_path, offset, length
    );
    let output = run_remote_shell_output(&connection, &cmd, None).await?;
    if !output.status.success() {
        return Err(error_with_class(&format!(
            "Failed to read remote file chunk: {}",
            String::from_utf8_lossy(&output.stderr)
        )));
    }
    Ok(general_purpose::STANDARD.encode(output.stdout))
}

#[command]
pub async fn remote_write_file_chunk_base64(
    connection_id: String,
    path: String,
    chunk_base64: String,
    append: bool,
) -> Result<bool, String> {
    let connection = get_remote_connection(&connection_id).await?;
    let escaped_path = shell_escape(&path);
    let redirect = if append { ">>" } else { ">" };
    let cmd = format!(
        "printf '%s' '{}' | base64 -d {} \"{}\"",
        chunk_base64, redirect, escaped_path
    );
    let result = run_remote_shell(&connection, &cmd, None).await?;
    if result.exit_code != 0 {
        return Err(error_with_class(&format!(
            "Failed to write remote file chunk: {}",
            result.stderr
        )));
    }
    Ok(true)
}

#[command]
pub async fn remote_start_download_to_local(
    connection_id: String,
    remote_path: String,
    local_path: String,
    overwrite: Option<bool>,
    resume: Option<bool>,
    transfer_id: Option<String>,
) -> Result<RemoteTransferResult, String> {
    let connection = get_remote_connection(&connection_id).await?;
    let transfer_id = transfer_id
        .unwrap_or_else(|| format!("download:{}", chrono::Utc::now().timestamp_millis()));
    let total_bytes = remote_file_size(&connection, &remote_path).await?;
    let should_overwrite = overwrite.unwrap_or(true);
    let should_resume = resume.unwrap_or(false);

    let target_path = PathBuf::from(&local_path);
    if target_path.exists() && !should_overwrite && !should_resume {
        let error = error_with_class(&format!("Local file already exists: {}", local_path));
        return Err(error);
    }

    if let Some(parent) = target_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| error_with_class(&format!("Failed to create local directory: {}", e)))?;
    }

    let mut local_file = std::fs::OpenOptions::new()
        .create(true)
        .read(true)
        .write(true)
        .open(&target_path)
        .map_err(|e| error_with_class(&format!("Failed to open local output file: {}", e)))?;

    let existing_len = local_file.metadata().map(|m| m.len()).unwrap_or(0);
    let mut transferred = if should_resume {
        existing_len.min(total_bytes)
    } else {
        if should_overwrite {
            local_file
                .set_len(0)
                .map_err(|e| error_with_class(&format!("Failed to truncate local file: {}", e)))?;
        }
        0
    };

    local_file
        .seek(SeekFrom::Start(transferred))
        .map_err(|e| error_with_class(&format!("Failed to seek local file: {}", e)))?;

    let now = chrono::Utc::now().to_rfc3339();
    set_transfer_status(RemoteTransferStatus {
        transfer_id: transfer_id.clone(),
        direction: "download".to_string(),
        source_path: remote_path.clone(),
        destination_path: local_path.clone(),
        status: "running".to_string(),
        total_bytes,
        transferred_bytes: transferred,
        started_at: now.clone(),
        updated_at: now,
        error_class: None,
        error_message: None,
    })
    .await;
    {
        let mut cancel = TRANSFER_CANCEL.write().await;
        cancel.insert(transfer_id.clone(), false);
    }

    let chunk_size: u64 = 256 * 1024;
    while transferred < total_bytes {
        {
            let cancel = TRANSFER_CANCEL.read().await;
            if *cancel.get(&transfer_id).unwrap_or(&false) {
                mark_transfer_cancelled(&transfer_id).await;
                return Ok(RemoteTransferResult {
                    transfer_id,
                    status: "cancelled".to_string(),
                    transferred_bytes: transferred,
                    total_bytes,
                });
            }
        }

        let remaining = total_bytes - transferred;
        let current_chunk = remaining.min(chunk_size);
        let encoded = remote_read_file_chunk_base64(
            connection_id.clone(),
            remote_path.clone(),
            transferred,
            current_chunk,
        )
        .await?;
        let bytes = general_purpose::STANDARD
            .decode(encoded)
            .map_err(|e| error_with_class(&format!("Failed to decode transfer chunk: {}", e)))?;
        local_file
            .write_all(&bytes)
            .map_err(|e| error_with_class(&format!("Failed writing local transfer chunk: {}", e)))?;

        transferred += bytes.len() as u64;
        update_transfer_progress(&transfer_id, transferred, total_bytes).await;
    }

    mark_transfer_completed(&transfer_id, transferred, total_bytes).await;
    Ok(RemoteTransferResult {
        transfer_id,
        status: "completed".to_string(),
        transferred_bytes: transferred,
        total_bytes,
    })
}

#[command]
pub async fn remote_start_upload_from_local(
    connection_id: String,
    local_path: String,
    remote_path: String,
    overwrite: Option<bool>,
    resume: Option<bool>,
    transfer_id: Option<String>,
) -> Result<RemoteTransferResult, String> {
    let connection = get_remote_connection(&connection_id).await?;
    let transfer_id = transfer_id
        .unwrap_or_else(|| format!("upload:{}", chrono::Utc::now().timestamp_millis()));
    let should_overwrite = overwrite.unwrap_or(true);
    let should_resume = resume.unwrap_or(false);

    let source_path = PathBuf::from(&local_path);
    let total_bytes = source_path
        .metadata()
        .map_err(|e| error_with_class(&format!("Failed to stat local source file: {}", e)))?
        .len();

    let remote_exists = remote_path_exists(&connection, &remote_path).await?;
    if remote_exists && !should_overwrite && !should_resume {
        return Err(error_with_class(&format!(
            "Remote destination already exists: {}",
            remote_path
        )));
    }

    let now = chrono::Utc::now().to_rfc3339();
    set_transfer_status(RemoteTransferStatus {
        transfer_id: transfer_id.clone(),
        direction: "upload".to_string(),
        source_path: local_path.clone(),
        destination_path: remote_path.clone(),
        status: "running".to_string(),
        total_bytes,
        transferred_bytes: 0,
        started_at: now.clone(),
        updated_at: now,
        error_class: None,
        error_message: None,
    })
    .await;
    {
        let mut cancel = TRANSFER_CANCEL.write().await;
        cancel.insert(transfer_id.clone(), false);
    }

    let mut input = std::fs::OpenOptions::new()
        .read(true)
        .open(&source_path)
        .map_err(|e| error_with_class(&format!("Failed to open local input file: {}", e)))?;

    let mut transferred: u64 = 0;
    if should_resume && remote_exists {
        transferred = remote_file_size(&connection, &remote_path)
            .await
            .unwrap_or(0)
            .min(total_bytes);
        input
            .seek(SeekFrom::Start(transferred))
            .map_err(|e| error_with_class(&format!("Failed to seek local input file: {}", e)))?;
    } else if should_overwrite {
        let escaped_path = shell_escape(&remote_path);
        let truncate_cmd = format!(": > \"{}\"", escaped_path);
        let truncate_result = run_remote_shell(&connection, &truncate_cmd, None).await?;
        if truncate_result.exit_code != 0 {
            return Err(error_with_class(&format!(
                "Failed to prepare remote file for upload: {}",
                truncate_result.stderr
            )));
        }
    }

    update_transfer_progress(&transfer_id, transferred, total_bytes).await;

    let chunk_size: usize = 256 * 1024;
    let mut buffer = vec![0u8; chunk_size];
    loop {
        {
            let cancel = TRANSFER_CANCEL.read().await;
            if *cancel.get(&transfer_id).unwrap_or(&false) {
                mark_transfer_cancelled(&transfer_id).await;
                return Ok(RemoteTransferResult {
                    transfer_id,
                    status: "cancelled".to_string(),
                    transferred_bytes: transferred,
                    total_bytes,
                });
            }
        }

        let read = std::io::Read::read(&mut input, &mut buffer)
            .map_err(|e| error_with_class(&format!("Failed to read local upload chunk: {}", e)))?;
        if read == 0 {
            break;
        }

        let encoded = general_purpose::STANDARD.encode(&buffer[..read]);
        remote_write_file_chunk_base64(
            connection_id.clone(),
            remote_path.clone(),
            encoded,
            true,
        )
        .await?;

        transferred += read as u64;
        update_transfer_progress(&transfer_id, transferred, total_bytes).await;
    }

    mark_transfer_completed(&transfer_id, transferred, total_bytes).await;
    Ok(RemoteTransferResult {
        transfer_id,
        status: "completed".to_string(),
        transferred_bytes: transferred,
        total_bytes,
    })
}

#[command]
pub async fn remote_get_transfer_status(
    transfer_id: String,
) -> Result<Option<RemoteTransferStatus>, String> {
    let state = TRANSFER_STATE.read().await;
    Ok(state.get(&transfer_id).cloned())
}

#[command]
pub async fn remote_cancel_transfer(transfer_id: String) -> Result<bool, String> {
    let mut cancel = TRANSFER_CANCEL.write().await;
    cancel.insert(transfer_id.clone(), true);
    drop(cancel);
    mark_transfer_cancelled(&transfer_id).await;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::{classify_error, shell_escape};

    #[test]
    fn classify_permission_error() {
        assert_eq!(
            classify_error("Permission denied while writing file"),
            "permission_denied"
        );
    }

    #[test]
    fn classify_conflict_error() {
        assert_eq!(
            classify_error("destination already exists"),
            "conflict"
        );
    }

    #[test]
    fn escapes_double_quotes() {
        assert_eq!(shell_escape("a\"b"), "a\\\"b");
    }
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
    overwrite: Option<bool>,
) -> Result<bool, String> {
    let connection = get_remote_connection(&connection_id).await?;
    let should_overwrite = overwrite.unwrap_or(true);
    if !should_overwrite && remote_path_exists(&connection, &remote_path).await? {
        return Err(error_with_class("Remote destination already exists"));
    }

    let bytes = std::fs::read(&local_path)
        .map_err(|e| format!("Failed to read local file for upload: {}", e))?;

    let content = String::from_utf8(bytes).map_err(|_| {
        "Local file is not valid UTF-8 text. Binary upload is not supported yet.".to_string()
    })?;

    remote_write_file(connection_id, remote_path, content).await
}
