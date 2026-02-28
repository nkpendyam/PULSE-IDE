//! DAP Debug Client
//!
//! Client implementation for connecting to debug adapters

use std::collections::HashMap;
use std::process::{Child, Command, Stdio};
use tokio::sync::mpsc;
use serde_json::json;
use anyhow::{Result, Context, bail};
use log::{debug, info};

use super::types::*;

/// Debug adapter configuration
#[derive(Debug, Clone)]
pub struct DebugAdapterConfig {
    pub adapter_type: String,
    pub command: String,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
}

impl DebugAdapterConfig {
    /// Get configurations for common debug adapters
    pub fn for_language(language: &str) -> Option<Self> {
        match language {
            "rust" => Some(Self {
                adapter_type: "lldb".to_string(),
                command: "lldb-vscode".to_string(),
                args: vec![],
                env: HashMap::new(),
            }),
            "python" => Some(Self {
                adapter_type: "debugpy".to_string(),
                command: "python".to_string(),
                args: vec!["-m", "debugpy.adapter".to_string()],
                env: HashMap::new(),
            }),
            "go" => Some(Self {
                adapter_type: "delve".to_string(),
                command: "dlv".to_string(),
                args: vec!["dap".to_string()],
                env: HashMap::new(),
            }),
            "javascript" | "typescript" => Some(Self {
                adapter_type: "node".to_string(),
                command: "node".to_string(),
                args: vec![],
                env: HashMap::new(),
            }),
            "c" | "cpp" => Some(Self {
                adapter_type: "lldb".to_string(),
                command: "lldb-vscode".to_string(),
                args: vec![],
                env: HashMap::new(),
            }),
            "java" => Some(Self {
                adapter_type: "jdtls".to_string(),
                command: "jdtls".to_string(),
                args: vec![],
                env: HashMap::new(),
            }),
            _ => None,
        }
    }
}

/// Debug client state
#[derive(Debug, Clone, PartialEq)]
pub enum DebugState {
    Disconnected,
    Connecting,
    Connected,
    Initializing,
    Initialized,
    Launching,
    Running,
    Stopped,
    Terminated,
}

/// Debug client
pub struct DebugClient {
    adapter_process: Option<Child>,
    state: DebugState,
    seq: u64,
    capabilities: Option<Capabilities>,
    current_threads: Vec<Thread>,
    active_thread_id: Option<u64>,
    breakpoints: HashMap<String, Vec<Breakpoint>>,
    message_tx: mpsc::Sender<ProtocolMessage>,
}

impl DebugClient {
    pub fn new(message_tx: mpsc::Sender<ProtocolMessage>) -> Self {
        Self {
            adapter_process: None,
            state: DebugState::Disconnected,
            seq: 0,
            capabilities: None,
            current_threads: Vec::new(),
            active_thread_id: None,
            breakpoints: HashMap::new(),
            message_tx,
        }
    }
    
    /// Connect to a debug adapter
    pub fn connect(&mut self, config: &DebugAdapterConfig) -> Result<()> {
        info!("Starting debug adapter: {} {}", config.command, config.args.join(" "));
        
        let mut cmd = Command::new(&config.command);
        cmd.args(&config.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        
        for (key, value) in &config.env {
            cmd.env(key, value);
        }
        
        let process = cmd.spawn()
            .with_context(|| format!("Failed to start debug adapter: {}", config.command))?;
        
        self.adapter_process = Some(process);
        self.state = DebugState::Connected;
        
        info!("Debug adapter connected");
        Ok(())
    }
    
    /// Initialize the debug session
    pub async fn initialize(&mut self) -> Result<Capabilities> {
        self.state = DebugState::Initializing;
        
        let response = self.send_request("initialize", Some(json!({
            "clientID": "kro-ide",
            "clientName": "KRO IDE",
            "adapterID": "default",
            "locale": "en-us",
            "linesStartAt1": true,
            "columnsStartAt1": true,
            "pathFormat": "path",
            "supportsVariableType": true,
            "supportsVariablePaging": true,
            "supportsRunInTerminalRequest": true,
            "supportsMemoryReferences": true,
            "supportsProgressReporting": true,
            "supportsInvalidatedEvent": true,
            "supportsMemoryEvent": true,
        }))).await?;
        
        let capabilities: Capabilities = serde_json::from_value(
            response.body.unwrap_or(json!({}))
        ).unwrap_or_default();
        
        self.capabilities = Some(capabilities.clone());
        self.state = DebugState::Initialized;
        
        info!("Debug adapter initialized with capabilities: {:?}", capabilities.supports_conditional_breakpoints);
        Ok(capabilities)
    }
    
    /// Launch the debug target
    pub async fn launch(&mut self, args: LaunchRequestArguments) -> Result<()> {
        self.state = DebugState::Launching;
        
        let _ = self.send_request("launch", Some(serde_json::to_value(args)?)).await?;
        self.state = DebugState::Running;
        
        info!("Debug target launched");
        Ok(())
    }
    
    /// Attach to a running process
    pub async fn attach(&mut self, args: serde_json::Value) -> Result<()> {
        self.state = DebugState::Launching;
        
        let _ = self.send_request("attach", Some(args)).await?;
        self.state = DebugState::Running;
        
        info!("Attached to process");
        Ok(())
    }
    
    /// Continue execution
    pub async fn continue_execution(&mut self, thread_id: u64) -> Result<bool> {
        let response = self.send_request("continue", Some(json!({
            "threadId": thread_id,
            "singleThread": false
        }))).await?;
        
        let all_threads_continued = response.body
            .and_then(|b| b.get("allThreadsContinued")?.as_bool())
            .unwrap_or(true);
        
        self.state = DebugState::Running;
        debug!("Continued execution, all threads: {}", all_threads_continued);
        Ok(all_threads_continued)
    }
    
    /// Step over
    pub async fn step_over(&mut self, thread_id: u64) -> Result<()> {
        self.send_request("next", Some(json!({
            "threadId": thread_id,
            "singleThread": false,
            "granularity": "statement"
        }))).await?;
        
        debug!("Step over on thread {}", thread_id);
        Ok(())
    }
    
    /// Step into
    pub async fn step_into(&mut self, thread_id: u64) -> Result<()> {
        self.send_request("stepIn", Some(json!({
            "threadId": thread_id,
            "singleThread": false,
            "granularity": "statement"
        }))).await?;
        
        debug!("Step into on thread {}", thread_id);
        Ok(())
    }
    
    /// Step out
    pub async fn step_out(&mut self, thread_id: u64) -> Result<()> {
        self.send_request("stepOut", Some(json!({
            "threadId": thread_id,
            "singleThread": false,
            "granularity": "statement"
        }))).await?;
        
        debug!("Step out on thread {}", thread_id);
        Ok(())
    }
    
    /// Pause execution
    pub async fn pause(&mut self, thread_id: u64) -> Result<()> {
        self.send_request("pause", Some(json!({
            "threadId": thread_id
        }))).await?;
        
        self.state = DebugState::Stopped;
        debug!("Paused thread {}", thread_id);
        Ok(())
    }
    
    /// Set breakpoints
    pub async fn set_breakpoints(&mut self, source_path: &str, breakpoints: Vec<SourceBreakpoint>) -> Result<Vec<Breakpoint>> {
        let response = self.send_request("setBreakpoints", Some(json!({
            "source": {
                "path": source_path
            },
            "breakpoints": breakpoints,
            "lines": breakpoints.iter().map(|b| b.line).collect::<Vec<_>>()
        }))).await?;
        
        let bps: Vec<Breakpoint> = response.body
            .and_then(|b| b.get("breakpoints").cloned())
            .and_then(|v| serde_json::from_value(v).ok())
            .unwrap_or_default();
        
        self.breakpoints.insert(source_path.to_string(), bps.clone());
        debug!("Set {} breakpoints in {}", bps.len(), source_path);
        Ok(bps)
    }
    
    /// Get stack trace
    pub async fn get_stack_trace(&mut self, thread_id: u64) -> Result<Vec<StackFrame>> {
        let response = self.send_request("stackTrace", Some(json!({
            "threadId": thread_id,
            "startFrame": 0,
            "levels": 20
        }))).await?;
        
        let frames: Vec<StackFrame> = response.body
            .and_then(|b| b.get("stackFrames").cloned())
            .and_then(|v| serde_json::from_value(v).ok())
            .unwrap_or_default();
        
        debug!("Got {} stack frames for thread {}", frames.len(), thread_id);
        Ok(frames)
    }
    
    /// Get scopes
    pub async fn get_scopes(&mut self, frame_id: u64) -> Result<Vec<Scope>> {
        let response = self.send_request("scopes", Some(json!({
            "frameId": frame_id
        }))).await?;
        
        let scopes: Vec<Scope> = response.body
            .and_then(|b| b.get("scopes").cloned())
            .and_then(|v| serde_json::from_value(v).ok())
            .unwrap_or_default();
        
        debug!("Got {} scopes for frame {}", scopes.len(), frame_id);
        Ok(scopes)
    }
    
    /// Get variables
    pub async fn get_variables(&mut self, variables_ref: u64) -> Result<Vec<Variable>> {
        let response = self.send_request("variables", Some(json!({
            "variablesReference": variables_ref
        }))).await?;
        
        let variables: Vec<Variable> = response.body
            .and_then(|b| b.get("variables").cloned())
            .and_then(|v| serde_json::from_value(v).ok())
            .unwrap_or_default();
        
        debug!("Got {} variables", variables.len());
        Ok(variables)
    }
    
    /// Evaluate expression
    pub async fn evaluate(&mut self, expression: &str, frame_id: Option<u64>, context: &str) -> Result<String> {
        let mut args = json!({
            "expression": expression,
            "context": context
        });
        
        if let Some(fid) = frame_id {
            args["frameId"] = json!(fid);
        }
        
        let response = self.send_request("evaluate", Some(args)).await?;
        
        let result = response.body
            .and_then(|b| b.get("result").cloned())
            .and_then(|v| v.as_str().map(|s| s.to_string()))
            .unwrap_or_else(|| "No result".to_string());
        
        debug!("Evaluated '{}' = '{}'", expression, result);
        Ok(result)
    }
    
    /// Disconnect from debug adapter
    pub async fn disconnect(&mut self) -> Result<()> {
        if self.state == DebugState::Disconnected {
            return Ok(());
        }
        
        let _ = self.send_request("disconnect", Some(json!({
            "restart": false,
            "terminateDebuggee": true
        }))).await;
        
        if let Some(mut process) = self.adapter_process.take() {
            let _ = process.kill();
        }
        
        self.state = DebugState::Disconnected;
        self.capabilities = None;
        self.breakpoints.clear();
        
        info!("Disconnected from debug adapter");
        Ok(())
    }
    
    /// Send a request to the debug adapter via stdio
    async fn send_request(&mut self, command: &str, arguments: Option<serde_json::Value>) -> Result<Response> {
        self.seq += 1;
        
        let request = Request {
            seq: self.seq,
            command: command.to_string(),
            arguments,
        };
        
        // Serialize request to JSON
        let json = serde_json::to_string(&request)
            .context("Failed to serialize request")?;
        
        // Format as DAP message with Content-Length header
        let message = format!("Content-Length: {}\r\n\r\n{}", json.len(), json);
        
        // Send to debug adapter process
        if let Some(ref mut process) = self.adapter_process {
            use std::io::Write;
            
            let stdin = process.stdin.as_mut()
                .ok_or_else(|| anyhow::anyhow!("No stdin available"))?;
            
            stdin.write_all(message.as_bytes())
                .context("Failed to write to debug adapter stdin")?;
            stdin.flush()
                .context("Failed to flush stdin")?;
            
            debug!("Sent request: {} (seq={})", command, self.seq);
        } else {
            bail!("Debug adapter process not running");
        }
        
        // Read response
        self.read_response().await
    }
    
    /// Read response from debug adapter
    async fn read_response(&mut self) -> Result<Response> {
        if let Some(ref mut process) = self.adapter_process {
            use std::io::{BufRead, Read};
            
            let stdout = process.stdout.as_mut()
                .ok_or_else(|| anyhow::anyhow!("No stdout available"))?;
            
            // Read Content-Length header
            let mut header_line = String::new();
            let mut byte = [0u8; 1];
            
            loop {
                stdout.read_exact(&mut byte)
                    .context("Failed to read from debug adapter stdout")?;
                header_line.push(byte[0] as char);
                
                if header_line.ends_with("\r\n\r\n") {
                    break;
                }
                
                if header_line.len() > 1024 {
                    bail!("Header too long");
                }
            }
            
            // Parse Content-Length
            let content_length: usize = header_line
                .lines()
                .find(|l| l.starts_with("Content-Length:"))
                .and_then(|l| l.split(':').nth(1))
                .and_then(|v| v.trim().parse().ok())
                .ok_or_else(|| anyhow::anyhow!("Missing Content-Length header"))?;
            
            // Read body
            let mut body = vec![0u8; content_length];
            stdout.read_exact(&mut body)
                .context("Failed to read response body")?;
            
            let json_str = String::from_utf8(body)
                .context("Response body is not valid UTF-8")?;
            
            // Parse response
            let response: Response = serde_json::from_str(&json_str)
                .context("Failed to parse response JSON")?;
            
            debug!("Received response: seq={}, success={}", response.request_seq, response.success);
            
            return Ok(response);
        }
        
        bail!("Debug adapter process not running")
    }
    
    /// Read events from debug adapter
    pub async fn read_event(&mut self) -> Result<Event> {
        if let Some(ref mut process) = self.adapter_process {
            use std::io::Read;
            
            let stdout = process.stdout.as_mut()
                .ok_or_else(|| anyhow::anyhow!("No stdout available"))?;
            
            // Read Content-Length header (non-blocking check would be ideal)
            let mut header_line = String::new();
            let mut byte = [0u8; 1];
            
            loop {
                match stdout.read(&mut byte) {
                    Ok(0) => bail!("EOF from debug adapter"),
                    Ok(_) => {
                        header_line.push(byte[0] as char);
                        if header_line.ends_with("\r\n\r\n") {
                            break;
                        }
                    }
                    Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        // No data available yet
                        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
                        continue;
                    }
                    Err(e) => return Err(e).context("Failed to read from debug adapter"),
                }
            }
            
            let content_length: usize = header_line
                .lines()
                .find(|l| l.starts_with("Content-Length:"))
                .and_then(|l| l.split(':').nth(1))
                .and_then(|v| v.trim().parse().ok())
                .ok_or_else(|| anyhow::anyhow!("Missing Content-Length header"))?;
            
            let mut body = vec![0u8; content_length];
            stdout.read_exact(&mut body)?;
            
            let event: Event = serde_json::from_slice(&body)
                .context("Failed to parse event JSON")?;
            
            Ok(event)
        } else {
            bail!("Debug adapter process not running")
        }
    }
    
    /// Get current state
    pub fn state(&self) -> &DebugState {
        &self.state
    }
    
    /// Get capabilities
    pub fn capabilities(&self) -> Option<&Capabilities> {
        self.capabilities.as_ref()
    }
    
    /// Get active thread
    pub fn active_thread(&self) -> Option<u64> {
        self.active_thread_id
    }
    
    /// Set active thread
    pub fn set_active_thread(&mut self, thread_id: u64) {
        self.active_thread_id = Some(thread_id);
    }
}
