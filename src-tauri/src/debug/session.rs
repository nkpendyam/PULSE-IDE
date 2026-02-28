//! Debug Session Management
//!
//! Manages debug sessions and coordinates between client and UI

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, broadcast};
use serde::{Deserialize, Serialize};
use anyhow::Result;
use log::info;

use super::client::{DebugClient, DebugAdapterConfig, DebugState};
use super::types::*;

/// Debug session event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DebugEvent {
    SessionStarted { session_id: String },
    SessionEnded { session_id: String },
    Stopped { session_id: String, thread_id: u64, reason: String },
    Continued { session_id: String, thread_id: u64 },
    Output { session_id: String, category: String, output: String },
    BreakpointChanged { session_id: String, breakpoint: Breakpoint },
    ThreadStarted { session_id: String, thread_id: u64 },
    ThreadExited { session_id: String, thread_id: u64 },
    ProcessExited { session_id: String, exit_code: i32 },
}

/// Debug session
pub struct DebugSession {
    pub id: String,
    pub name: String,
    pub client: DebugClient,
    pub config: DebugAdapterConfig,
    pub threads: Vec<Thread>,
    pub call_stack: HashMap<u64, Vec<StackFrame>>,
    pub variables: HashMap<u64, Vec<Variable>>,
    pub output: Vec<OutputEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputEntry {
    pub timestamp: u64,
    pub category: String,
    pub output: String,
}

/// Debug session manager
pub struct DebugSessionManager {
    sessions: HashMap<String, DebugSession>,
    active_session: Option<String>,
    event_tx: broadcast::Sender<DebugEvent>,
}

impl DebugSessionManager {
    pub fn new() -> Self {
        let (event_tx, _) = broadcast::channel(256);
        Self {
            sessions: HashMap::new(),
            active_session: None,
            event_tx,
        }
    }
    
    /// Create a new debug session
    pub async fn create_session(&mut self, name: &str, language: &str) -> Result<String> {
        let config = DebugAdapterConfig::for_language(language)
            .ok_or_else(|| anyhow::anyhow!("No debug adapter for language: {}", language))?;
        
        let session_id = uuid::Uuid::new_v4().to_string();
        let (tx, _rx) = mpsc::channel(256);
        let client = DebugClient::new(tx);
        
        let session = DebugSession {
            id: session_id.clone(),
            name: name.to_string(),
            client,
            config,
            threads: Vec::new(),
            call_stack: HashMap::new(),
            variables: HashMap::new(),
            output: Vec::new(),
        };
        
        self.sessions.insert(session_id.clone(), session);
        self.active_session = Some(session_id.clone());
        
        let _ = self.event_tx.send(DebugEvent::SessionStarted {
            session_id: session_id.clone(),
        });
        
        info!("Created debug session: {}", session_id);
        Ok(session_id)
    }
    
    /// Start debugging
    pub async fn start_debug(&mut self, session_id: &str, launch_args: LaunchRequestArguments) -> Result<()> {
        let session = self.sessions.get_mut(session_id)
            .ok_or_else(|| anyhow::anyhow!("Session not found: {}", session_id))?;
        
        // Connect to adapter
        session.client.connect(&session.config)?;
        
        // Initialize
        session.client.initialize().await?;
        
        // Launch
        session.client.launch(launch_args).await?;
        
        info!("Started debugging session: {}", session_id);
        Ok(())
    }
    
    /// Stop debugging
    pub async fn stop_debug(&mut self, session_id: &str) -> Result<()> {
        let session = self.sessions.get_mut(session_id)
            .ok_or_else(|| anyhow::anyhow!("Session not found: {}", session_id))?;
        
        session.client.disconnect().await?;
        
        let _ = self.event_tx.send(DebugEvent::SessionEnded {
            session_id: session_id.to_string(),
        });
        
        info!("Stopped debugging session: {}", session_id);
        Ok(())
    }
    
    /// Continue execution
    pub async fn continue_execution(&mut self, session_id: &str, thread_id: u64) -> Result<()> {
        let session = self.sessions.get_mut(session_id)
            .ok_or_else(|| anyhow::anyhow!("Session not found: {}", session_id))?;
        
        session.client.continue_execution(thread_id).await?;
        
        let _ = self.event_tx.send(DebugEvent::Continued {
            session_id: session_id.to_string(),
            thread_id,
        });
        
        Ok(())
    }
    
    /// Step over
    pub async fn step_over(&mut self, session_id: &str, thread_id: u64) -> Result<()> {
        let session = self.sessions.get_mut(session_id)
            .ok_or_else(|| anyhow::anyhow!("Session not found: {}", session_id))?;
        
        session.client.step_over(thread_id).await?;
        Ok(())
    }
    
    /// Step into
    pub async fn step_into(&mut self, session_id: &str, thread_id: u64) -> Result<()> {
        let session = self.sessions.get_mut(session_id)
            .ok_or_else(|| anyhow::anyhow!("Session not found: {}", session_id))?;
        
        session.client.step_into(thread_id).await?;
        Ok(())
    }
    
    /// Step out
    pub async fn step_out(&mut self, session_id: &str, thread_id: u64) -> Result<()> {
        let session = self.sessions.get_mut(session_id)
            .ok_or_else(|| anyhow::anyhow!("Session not found: {}", session_id))?;
        
        session.client.step_out(thread_id).await?;
        Ok(())
    }
    
    /// Set breakpoint
    pub async fn set_breakpoint(&mut self, session_id: &str, path: &str, line: u32, condition: Option<String>) -> Result<Breakpoint> {
        let session = self.sessions.get_mut(session_id)
            .ok_or_else(|| anyhow::anyhow!("Session not found: {}", session_id))?;
        
        let source_bp = SourceBreakpoint {
            line,
            column: None,
            condition,
            hit_condition: None,
            log_message: None,
        };
        
        let breakpoints = session.client.set_breakpoints(path, vec![source_bp]).await?;
        
        let bp = breakpoints.into_iter().next()
            .ok_or_else(|| anyhow::anyhow!("No breakpoint returned"))?;
        
        let _ = self.event_tx.send(DebugEvent::BreakpointChanged {
            session_id: session_id.to_string(),
            breakpoint: bp.clone(),
        });
        
        Ok(bp)
    }
    
    /// Get stack trace
    pub async fn get_stack_trace(&mut self, session_id: &str, thread_id: u64) -> Result<Vec<StackFrame>> {
        let session = self.sessions.get_mut(session_id)
            .ok_or_else(|| anyhow::anyhow!("Session not found: {}", session_id))?;
        
        let frames = session.client.get_stack_trace(thread_id).await?;
        session.call_stack.insert(thread_id, frames.clone());
        
        Ok(frames)
    }
    
    /// Get variables
    pub async fn get_variables(&mut self, session_id: &str, frame_id: u64) -> Result<Vec<Variable>> {
        let session = self.sessions.get_mut(session_id)
            .ok_or_else(|| anyhow::anyhow!("Session not found: {}", session_id))?;
        
        // Get scopes first
        let scopes = session.client.get_scopes(frame_id).await?;
        
        let mut all_variables = Vec::new();
        for scope in scopes {
            let vars = session.client.get_variables(scope.variables_reference).await?;
            all_variables.extend(vars);
        }
        
        session.variables.insert(frame_id, all_variables.clone());
        
        Ok(all_variables)
    }
    
    /// Evaluate expression
    pub async fn evaluate(&mut self, session_id: &str, expression: &str, frame_id: Option<u64>) -> Result<String> {
        let session = self.sessions.get_mut(session_id)
            .ok_or_else(|| anyhow::anyhow!("Session not found: {}", session_id))?;
        
        session.client.evaluate(expression, frame_id, "repl").await
    }
    
    /// Subscribe to events
    pub fn subscribe(&self) -> broadcast::Receiver<DebugEvent> {
        self.event_tx.subscribe()
    }
    
    /// Get active session
    pub fn active_session(&self) -> Option<&str> {
        self.active_session.as_deref()
    }
    
    /// Get session state
    pub fn session_state(&self, session_id: &str) -> Option<&DebugState> {
        self.sessions.get(session_id).map(|s| s.client.state())
    }
    
    /// Remove session
    pub fn remove_session(&mut self, session_id: &str) {
        self.sessions.remove(session_id);
        if self.active_session.as_deref() == Some(session_id) {
            self.active_session = None;
        }
    }
}

impl Default for DebugSessionManager {
    fn default() -> Self {
        Self::new()
    }
}
