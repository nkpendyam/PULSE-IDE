//! Terminal management for KYRO IDE

use portable_pty::{native_pty_system, PtySize, CommandBuilder};
use std::io::{Read, Write};
use std::collections::HashMap;
use tauri::{WebviewWindow, Emitter};

pub struct TerminalManager {
    terminals: HashMap<String, TerminalSession>,
}

struct TerminalSession {
    pair: portable_pty::PtyPair,
    writer: Box<dyn Write + Send>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self { terminals: HashMap::new() }
    }
    
    pub fn create_terminal(&mut self, id: &str, cwd: &str) -> Result<(), String> {
        let pty_system = native_pty_system();
        let pair = pty_system.openpty(PtySize { rows: 24, cols: 80, pixel_width: 0, pixel_height: 0 }).map_err(|e| format!("Failed to create PTY: {}", e))?;
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        let mut cmd = CommandBuilder::new(shell);
        cmd.cwd(cwd);
        let _child = pair.slave.spawn_command(cmd).map_err(|e| format!("Failed to spawn shell: {}", e))?;
        let writer = pair.master.take_writer().map_err(|e| format!("Failed to get writer: {}", e))?;
        self.terminals.insert(id.to_string(), TerminalSession { pair, writer });
        Ok(())
    }
    
    pub fn write_to_terminal(&mut self, id: &str, data: &str) -> Result<(), String> {
        if let Some(session) = self.terminals.get_mut(id) {
            session.writer.write_all(data.as_bytes()).map_err(|e| format!("Failed to write: {}", e))?;
            session.writer.flush().map_err(|e| format!("Failed to flush: {}", e))?;
            Ok(())
        } else { Err(format!("Terminal {} not found", id)) }
    }
    
    pub fn resize_terminal(&mut self, id: &str, cols: u16, rows: u16) -> Result<(), String> {
        if let Some(session) = self.terminals.get(id) {
            session.pair.master.resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 }).map_err(|e| format!("Failed to resize: {}", e))?;
            Ok(())
        } else { Err(format!("Terminal {} not found", id)) }
    }
    
    pub fn kill_terminal(&mut self, id: &str) -> Result<(), String> {
        if self.terminals.remove(id).is_some() { Ok(()) }
        else { Err(format!("Terminal {} not found", id)) }
    }
}

impl Default for TerminalManager {
    fn default() -> Self { Self::new() }
}
