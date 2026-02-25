//! Extension Runtime for executing VS Code extensions
//!
//! Uses a Node.js subprocess to run extension JavaScript code.
//! Provides RPC bridge for VS Code API surface.

use anyhow::{Result, Context, bail};
use std::path::{Path, PathBuf};
use std::process::{Command, Child, Stdio};
use std::io::{BufRead, BufReader, Write};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, Mutex};
use serde::{Deserialize, Serialize};

/// Extension runtime managing a Node.js subprocess
pub struct ExtensionRuntime {
    /// Node.js process running extension host
    process: Option<Child>,
    /// Extensions directory
    extensions_dir: PathBuf,
    /// Node.js binary path
    node_path: PathBuf,
    /// Active extensions in this runtime
    active_extensions: HashMap<String, ExtensionState>,
    /// RPC message ID counter
    message_id: Arc<Mutex<u64>>,
    /// Pending RPC responses
    pending_responses: Arc<RwLock<HashMap<u64, tokio::sync::oneshot::Sender<RpcResponse>>>>,
}

/// Extension state in runtime
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionState {
    pub id: String,
    pub name: String,
    pub version: String,
    pub active: bool,
    pub error: Option<String>,
}

/// RPC Request to extension host
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcRequest {
    pub id: u64,
    pub method: String,
    pub params: serde_json::Value,
}

/// RPC Response from extension host
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcResponse {
    pub id: u64,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
}

/// VS Code API call from extension
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VsCodeApiCall {
    pub extension_id: String,
    pub api: String,
    pub method: String,
    pub args: serde_json::Value,
}

impl ExtensionRuntime {
    /// Create a new extension runtime
    pub fn new(extensions_dir: PathBuf) -> Self {
        // Find Node.js
        let node_path = which::which("node")
            .unwrap_or_else(|_| PathBuf::from("node"));

        Self {
            process: None,
            extensions_dir,
            node_path,
            active_extensions: HashMap::new(),
            message_id: Arc::new(Mutex::new(0)),
            pending_responses: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Start the extension runtime (spawn Node.js process)
    pub async fn start(&mut self) -> Result<()> {
        // Create the extension host script
        let host_script = self.create_extension_host_script()?;
        let script_path = self.extensions_dir.join(".extension_host.js");
        std::fs::write(&script_path, host_script)?;

        log::info!("Starting extension runtime with Node.js: {:?}", self.node_path);

        // Spawn Node.js process
        let mut child = Command::new(&self.node_path)
            .arg(&script_path)
            .current_dir(&self.extensions_dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .context("Failed to spawn Node.js extension host")?;

        // Handle stderr in background
        if let Some(stderr) = child.stderr.take() {
            tokio::spawn(async move {
                let reader = BufReader::new(stderr);
                for line in reader.lines().filter_map(|l| l.ok()) {
                    log::warn!("[Extension Host] {}", line);
                }
            });
        }

        // Handle stdout for RPC responses
        if let Some(stdout) = child.stdout.take() {
            let pending = self.pending_responses.clone();
            tokio::spawn(async move {
                let reader = BufReader::new(stdout);
                for line in reader.lines().filter_map(|l| l.ok()) {
                    if let Ok(response) = serde_json::from_str::<RpcResponse>(&line) {
                        let mut pending_guard = pending.write().await;
                        if let Some(tx) = pending_guard.remove(&response.id) {
                            let _ = tx.send(response);
                        }
                    }
                }
            });
        }

        self.process = Some(child);
        log::info!("Extension runtime started");

        Ok(())
    }

    /// Stop the extension runtime
    pub async fn stop(&mut self) -> Result<()> {
        if let Some(mut child) = self.process.take() {
            // Send shutdown message
            if let Some(stdin) = child.stdin.as_mut() {
                let shutdown = RpcRequest {
                    id: 0,
                    method: "shutdown".to_string(),
                    params: serde_json::json!({}),
                };
                let _ = writeln!(stdin, "{}", serde_json::to_string(&shutdown)?);
            }

            // Wait for graceful shutdown
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            
            // Force kill if still running
            let _ = child.kill();
            log::info!("Extension runtime stopped");
        }
        Ok(())
    }

    /// Load an extension
    pub async fn load_extension(&mut self, extension_path: &Path) -> Result<String> {
        let package_json = extension_path.join("package.json");
        let content = std::fs::read_to_string(&package_json)
            .context("Failed to read package.json")?;
        
        let manifest: serde_json::Value = serde_json::from_str(&content)?;
        let id = format!("{}.{}", 
            manifest["publisher"].as_str().unwrap_or("unknown"),
            manifest["name"].as_str().unwrap_or("unknown")
        );

        // Send load request to extension host
        let response = self.rpc_call("loadExtension", serde_json::json!({
            "extensionPath": extension_path.to_string_lossy(),
            "manifest": manifest
        })).await?;

        if let Some(result) = response.result {
            let name = result["name"].as_str().unwrap_or(&id).to_string();
            let version = result["version"].as_str().unwrap_or("0.0.0").to_string();
            
            self.active_extensions.insert(id.clone(), ExtensionState {
                id: id.clone(),
                name,
                version,
                active: true,
                error: None,
            });
        }

        Ok(id)
    }

    /// Activate an extension
    pub async fn activate_extension(&mut self, extension_id: &str) -> Result<()> {
        let response = self.rpc_call("activateExtension", serde_json::json!({
            "extensionId": extension_id
        })).await?;

        if response.error.is_some() {
            if let Some(state) = self.active_extensions.get_mut(extension_id) {
                state.error = response.error;
                state.active = false;
            }
            bail!("Failed to activate extension: {}", extension_id);
        }

        if let Some(state) = self.active_extensions.get_mut(extension_id) {
            state.active = true;
        }

        Ok(())
    }

    /// Execute a command from an extension
    pub async fn execute_command(&mut self, command: &str, args: Vec<serde_json::Value>) -> Result<Option<serde_json::Value>> {
        let response = self.rpc_call("executeCommand", serde_json::json!({
            "command": command,
            "args": args
        })).await?;

        if let Some(error) = response.error {
            bail!("Command execution failed: {}", error);
        }

        Ok(response.result)
    }

    /// Get extension state
    pub fn get_extension_state(&self, extension_id: &str) -> Option<&ExtensionState> {
        self.active_extensions.get(extension_id)
    }

    /// List all loaded extensions
    pub fn list_extensions(&self) -> Vec<&ExtensionState> {
        self.active_extensions.values().collect()
    }

    /// Make an RPC call to the extension host
    async fn rpc_call(&self, method: &str, params: serde_json::Value) -> Result<RpcResponse> {
        let process = self.process.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Extension runtime not started"))?;

        // Get next message ID
        let id = {
            let mut id_guard = self.message_id.lock().await;
            *id_guard += 1;
            *id_guard
        };

        // Create oneshot channel for response
        let (tx, rx) = tokio::sync::oneshot::channel();
        {
            let mut pending = self.pending_responses.write().await;
            pending.insert(id, tx);
        }

        // Send request
        let request = RpcRequest {
            id,
            method: method.to_string(),
            params,
        };

        if let Some(stdin) = process.stdin.as_ref() {
            let mut stdin = stdin.try_clone()?;
            writeln!(stdin, "{}", serde_json::to_string(&request)?)?;
        }

        // Wait for response with timeout
        let response = tokio::time::timeout(
            tokio::time::Duration::from_secs(30),
            rx
        ).await
            .context("RPC call timeout")?
            .context("RPC response channel closed")?;

        Ok(response)
    }

    /// Create the Node.js extension host script
    fn create_extension_host_script(&self) -> Result<String> {
        Ok(r#"
// KRO IDE Extension Host
// Provides VS Code API surface for extensions

const readline = require('readline');
const path = require('path');
const fs = require('fs');

// Store loaded extensions
const extensions = new Map();
const commands = new Map();

// VS Code API implementation
const vscode = {
    // Commands
    commands: {
        registerCommand(id, handler) {
            commands.set(id, handler);
            return { dispose: () => commands.delete(id) };
        },
        executeCommand(id, ...args) {
            const handler = commands.get(id);
            if (handler) {
                return Promise.resolve(handler(...args));
            }
            return Promise.reject(new Error(`Command not found: ${id}`));
        }
    },
    
    // Window
    window: {
        showInformationMessage(message) {
            console.error('[INFO]', message);
            return Promise.resolve();
        },
        showWarningMessage(message) {
            console.error('[WARN]', message);
            return Promise.resolve();
        },
        showErrorMessage(message) {
            console.error('[ERROR]', message);
            return Promise.resolve();
        },
        showInputBox(options) {
            return Promise.resolve('');
        },
        showQuickPick(items) {
            return Promise.resolve(items[0]);
        },
        createOutputChannel(name) {
            return {
                appendLine: (line) => console.error(`[${name}]`, line),
                show: () => {},
                dispose: () => {}
            };
        },
        activeTextEditor: null
    },
    
    // Workspace
    workspace: {
        workspaceFolders: [],
        getConfiguration(section) {
            return {
                get: (key, defaultValue) => defaultValue,
                update: () => Promise.resolve()
            };
        },
        openTextDocument(uri) {
            return Promise.resolve({ getText: () => '', uri });
        },
        onDidChangeTextDocument: () => ({ dispose: () => {} }),
        onDidSaveTextDocument: () => ({ dispose: () => {} })
    },
    
    // Languages
    languages: {
        registerCompletionItemProvider(selector, provider) {
            return { dispose: () => {} };
        },
        registerHoverProvider(selector, provider) {
            return { dispose: () => {} };
        }
    },
    
    // Text documents
    TextEdit: class {
        constructor(range, newText) {
            this.range = range;
            this.newText = newText;
        }
    },
    
    Position: class {
        constructor(line, character) {
            this.line = line;
            this.character = character;
        }
    },
    
    Range: class {
        constructor(start, end) {
            this.start = start;
            this.end = end;
        }
    }
};

// Handle RPC requests
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

rl.on('line', async (line) => {
    try {
        const request = JSON.parse(line);
        const { id, method, params } = request;
        
        let result = null;
        let error = null;
        
        try {
            switch (method) {
                case 'loadExtension':
                    result = await loadExtension(params.extensionPath, params.manifest);
                    break;
                    
                case 'activateExtension':
                    result = await activateExtension(params.extensionId);
                    break;
                    
                case 'executeCommand':
                    result = await executeCommand(params.command, params.args);
                    break;
                    
                case 'shutdown':
                    process.exit(0);
                    break;
                    
                default:
                    error = `Unknown method: ${method}`;
            }
        } catch (e) {
            error = e.message;
        }
        
        const response = { id, result, error };
        console.log(JSON.stringify(response));
        
    } catch (e) {
        console.error('Failed to parse request:', e);
    }
});

// Load extension
async function loadExtension(extensionPath, manifest) {
    const id = `${manifest.publisher}.${manifest.name}`;
    
    // Store extension info
    extensions.set(id, {
        path: extensionPath,
        manifest,
        module: null,
        active: false
    });
    
    return {
        id,
        name: manifest.name,
        version: manifest.version
    };
}

// Activate extension
async function activateExtension(extensionId) {
    const ext = extensions.get(extensionId);
    if (!ext) {
        throw new Error(`Extension not found: ${extensionId}`);
    }
    
    // Load the extension module
    const mainPath = path.join(ext.path, ext.manifest.main || 'extension.js');
    
    try {
        // Create extension context
        const context = {
            subscriptions: [],
            extensionPath: ext.path,
            globalState: {
                get: () => undefined,
                update: () => Promise.resolve()
            },
            workspaceState: {
                get: () => undefined,
                update: () => Promise.resolve()
            }
        };
        
        // Load and activate
        const module = require(mainPath);
        if (module.activate) {
            await module.activate(context);
        }
        
        ext.module = module;
        ext.active = true;
        
        return { activated: true };
        
    } catch (e) {
        throw new Error(`Failed to activate: ${e.message}`);
    }
}

// Execute command
async function executeCommand(commandId, args) {
    const handler = commands.get(commandId);
    if (handler) {
        return await handler(...args);
    }
    throw new Error(`Command not found: ${commandId}`);
}

// Ready signal
console.error('[Extension Host] Ready');
"#.to_string())
    }
}

impl Drop for ExtensionRuntime {
    fn drop(&mut self) {
        if let Some(mut child) = self.process.take() {
            let _ = child.kill();
        }
    }
}
