// Plugin Tauri Commands — Real plugin system with ZIP extraction and manifest loading
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::command;
use tokio::sync::RwLock;

lazy_static::lazy_static! {
    static ref PLUGIN_STATE: Arc<RwLock<PluginState>> = Arc::new(RwLock::new(PluginState::new()));
}

fn plugins_dir() -> PathBuf {
    let base = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("kyro-ide").join("plugins")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub author: Option<String>,
    pub capabilities: Vec<String>,
    pub main: Option<String>,
    pub commands: Option<HashMap<String, String>>,
}

#[derive(Debug)]
pub struct PluginState {
    plugins: HashMap<String, PluginInfo>,
    plugin_dirs: HashMap<String, PathBuf>,
    manifests: HashMap<String, PluginManifest>,
}

impl Default for PluginState {
    fn default() -> Self {
        Self::new()
    }
}

impl PluginState {
    pub fn new() -> Self {
        Self {
            plugins: HashMap::new(),
            plugin_dirs: HashMap::new(),
            manifests: HashMap::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub enabled: bool,
    pub description: Option<String>,
    pub capabilities: Vec<String>,
    pub memory_usage: u64,
}

fn read_manifest(dir: &std::path::Path) -> Result<PluginManifest, String> {
    let manifest_path = dir.join("manifest.json");
    let content = std::fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read manifest.json: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("Invalid manifest.json: {}", e))
}

fn estimate_dir_size(dir: &std::path::Path) -> u64 {
    walkdir::WalkDir::new(dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter_map(|e| e.metadata().ok())
        .map(|m| m.len())
        .sum()
}

#[command]
pub async fn list_plugins() -> Result<Vec<PluginInfo>, String> {
    let state = PLUGIN_STATE.read().await;
    Ok(state.plugins.values().cloned().collect())
}

#[command]
pub async fn install_plugin(path: String) -> Result<PluginInfo, String> {
    let src = PathBuf::from(&path);
    if !src.exists() {
        return Err(format!("Plugin path does not exist: {}", path));
    }

    let id = uuid::Uuid::new_v4().to_string();
    let dest = plugins_dir().join(&id);
    std::fs::create_dir_all(&dest).map_err(|e| format!("Create dir failed: {}", e))?;

    // Handle ZIP files — extract to plugin dir
    if path.ends_with(".zip") {
        let file = std::fs::File::open(&src).map_err(|e| format!("Open zip: {}", e))?;
        let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Invalid zip: {}", e))?;
        for i in 0..archive.len() {
            let mut entry = archive
                .by_index(i)
                .map_err(|e| format!("Zip entry: {}", e))?;
            let name = entry.name().to_string();
            // Prevent zip slip
            let out_path = dest.join(&name);
            if !out_path.starts_with(&dest) {
                return Err("Invalid zip entry path".to_string());
            }
            if entry.is_dir() {
                std::fs::create_dir_all(&out_path).ok();
            } else {
                if let Some(parent) = out_path.parent() {
                    std::fs::create_dir_all(parent).ok();
                }
                let mut outfile =
                    std::fs::File::create(&out_path).map_err(|e| format!("Create file: {}", e))?;
                std::io::copy(&mut entry, &mut outfile)
                    .map_err(|e| format!("Extract file: {}", e))?;
            }
        }
    } else if src.is_dir() {
        // Copy directory contents
        for entry in walkdir::WalkDir::new(&src)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let relative = entry.path().strip_prefix(&src).unwrap_or(entry.path());
            let target = dest.join(relative);
            if entry.file_type().is_dir() {
                std::fs::create_dir_all(&target).ok();
            } else {
                if let Some(parent) = target.parent() {
                    std::fs::create_dir_all(parent).ok();
                }
                std::fs::copy(entry.path(), &target).ok();
            }
        }
    } else {
        // Single file — create minimal manifest
        let fname = src
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        std::fs::copy(&src, dest.join(&fname)).ok();
        let manifest = serde_json::json!({
            "name": fname,
            "version": "1.0.0",
            "capabilities": ["execute"],
        });
        std::fs::write(dest.join("manifest.json"), manifest.to_string()).ok();
    }

    // Read manifest
    let manifest = read_manifest(&dest).unwrap_or(PluginManifest {
        name: path.split('/').next_back().unwrap_or("plugin").to_string(),
        version: "1.0.0".to_string(),
        description: None,
        author: None,
        capabilities: vec!["execute".to_string()],
        main: None,
        commands: None,
    });

    let mem = estimate_dir_size(&dest);
    let plugin = PluginInfo {
        id: id.clone(),
        name: manifest.name.clone(),
        version: manifest.version.clone(),
        enabled: true,
        description: manifest.description.clone(),
        capabilities: manifest.capabilities.clone(),
        memory_usage: mem,
    };

    let mut state = PLUGIN_STATE.write().await;
    state.plugins.insert(id.clone(), plugin.clone());
    state.plugin_dirs.insert(id.clone(), dest);
    state.manifests.insert(id, manifest);
    Ok(plugin)
}

#[command]
pub async fn uninstall_plugin(plugin_id: String) -> Result<(), String> {
    let mut state = PLUGIN_STATE.write().await;
    state.plugins.remove(&plugin_id);
    if let Some(dir) = state.plugin_dirs.remove(&plugin_id) {
        std::fs::remove_dir_all(&dir).ok();
    }
    state.manifests.remove(&plugin_id);
    Ok(())
}

#[command]
pub async fn enable_plugin(plugin_id: String) -> Result<(), String> {
    let mut state = PLUGIN_STATE.write().await;
    if let Some(p) = state.plugins.get_mut(&plugin_id) {
        p.enabled = true;
    }
    Ok(())
}

#[command]
pub async fn disable_plugin(plugin_id: String) -> Result<(), String> {
    let mut state = PLUGIN_STATE.write().await;
    if let Some(p) = state.plugins.get_mut(&plugin_id) {
        p.enabled = false;
    }
    Ok(())
}

#[command]
pub async fn execute_plugin_function(
    plugin_id: String,
    function: String,
    args: Option<String>,
) -> Result<String, String> {
    let state = PLUGIN_STATE.read().await;
    let plugin = state.plugins.get(&plugin_id).ok_or("Plugin not found")?;
    if !plugin.enabled {
        return Err("Plugin is disabled".to_string());
    }
    let manifest = state.manifests.get(&plugin_id).ok_or("No manifest")?;
    let dir = state
        .plugin_dirs
        .get(&plugin_id)
        .ok_or("Plugin directory not found")?;

    // Look up the function in manifest commands
    if let Some(commands) = &manifest.commands {
        if let Some(script) = commands.get(&function) {
            let script_path = dir.join(script);
            if script_path.exists() {
                // Execute script with args
                let mut cmd = tokio::process::Command::new("node");
                cmd.arg(&script_path);
                if let Some(ref a) = args {
                    cmd.arg(a);
                }
                cmd.current_dir(dir);
                let output = cmd
                    .output()
                    .await
                    .map_err(|e| format!("Execute failed: {}", e))?;
                return Ok(String::from_utf8_lossy(&output.stdout).to_string());
            }
        }
    }

    // Fallback: try to run main entry point with function as argument
    if let Some(main) = &manifest.main {
        let main_path = dir.join(main);
        if main_path.exists() {
            let mut cmd = tokio::process::Command::new("node");
            cmd.arg(&main_path).arg(&function);
            if let Some(ref a) = args {
                cmd.arg(a);
            }
            cmd.current_dir(dir);
            let output = cmd
                .output()
                .await
                .map_err(|e| format!("Execute failed: {}", e))?;
            return Ok(String::from_utf8_lossy(&output.stdout).to_string());
        }
    }

    Err(format!(
        "Function '{}' not found in plugin manifest",
        function
    ))
}

#[command]
pub async fn get_plugin_capabilities(plugin_id: String) -> Result<Vec<String>, String> {
    let state = PLUGIN_STATE.read().await;
    let plugin = state.plugins.get(&plugin_id).ok_or("Plugin not found")?;
    Ok(plugin.capabilities.clone())
}

#[command]
pub async fn plugin_has_capability(plugin_id: String, capability: String) -> Result<bool, String> {
    let state = PLUGIN_STATE.read().await;
    let plugin = state.plugins.get(&plugin_id).ok_or("Plugin not found")?;
    Ok(plugin.capabilities.contains(&capability))
}

#[command]
pub async fn get_plugin_status(plugin_id: String) -> Result<PluginInfo, String> {
    let state = PLUGIN_STATE.read().await;
    state
        .plugins
        .get(&plugin_id)
        .cloned()
        .ok_or_else(|| "Plugin not found".to_string())
}

#[command]
pub async fn reload_plugins() -> Result<usize, String> {
    let pdir = plugins_dir();
    if !pdir.exists() {
        return Ok(0);
    }
    let mut state = PLUGIN_STATE.write().await;
    // Scan plugins directory for installed plugins
    let entries = std::fs::read_dir(&pdir).map_err(|e| format!("Read plugins dir: {}", e))?;
    for entry in entries.filter_map(|e| e.ok()) {
        let dir = entry.path();
        if !dir.is_dir() {
            continue;
        }
        let id = dir
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        if state.plugins.contains_key(&id) {
            continue;
        }
        if let Ok(manifest) = read_manifest(&dir) {
            let mem = estimate_dir_size(&dir);
            let plugin = PluginInfo {
                id: id.clone(),
                name: manifest.name.clone(),
                version: manifest.version.clone(),
                enabled: true,
                description: manifest.description.clone(),
                capabilities: manifest.capabilities.clone(),
                memory_usage: mem,
            };
            state.plugins.insert(id.clone(), plugin);
            state.plugin_dirs.insert(id.clone(), dir);
            state.manifests.insert(id, manifest);
        }
    }
    Ok(state.plugins.len())
}

#[command]
pub async fn get_plugin_memory_usage(plugin_id: String) -> Result<u64, String> {
    let state = PLUGIN_STATE.read().await;
    let plugin = state.plugins.get(&plugin_id).ok_or("Plugin not found")?;
    Ok(plugin.memory_usage)
}
