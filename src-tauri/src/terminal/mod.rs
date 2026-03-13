//! Terminal management for KYRO IDE

use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex as StdMutex};
use std::thread;

pub struct TerminalManager {
    terminals: HashMap<String, TerminalSession>,
}

struct TerminalSession {
    pair: portable_pty::PtyPair,
    _child: Box<dyn portable_pty::Child + Send>,
    writer: Box<dyn Write + Send>,
    output_buffer: Arc<StdMutex<String>>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            terminals: HashMap::new(),
        }
    }

    pub fn create_terminal(&mut self, id: &str, cwd: &str) -> Result<(), String> {
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to create PTY: {}", e))?;
        let shell = if cfg!(windows) {
            std::env::var("COMSPEC").unwrap_or_else(|_| "powershell.exe".to_string())
        } else {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
        };
        let mut cmd = CommandBuilder::new(shell);
        cmd.cwd(cwd);
        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn shell: {}", e))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to get writer: {}", e))?;

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to get reader: {}", e))?;
        let output_buffer = Arc::new(StdMutex::new(String::new()));
        let output_buffer_clone = Arc::clone(&output_buffer);
        thread::spawn(move || {
            let mut chunk = [0u8; 4096];
            loop {
                match reader.read(&mut chunk) {
                    Ok(0) => break,
                    Ok(size) => {
                        let text = String::from_utf8_lossy(&chunk[..size]);
                        if let Ok(mut buffer) = output_buffer_clone.lock() {
                            buffer.push_str(&text);
                            if buffer.len() > 200_000 {
                                let drain_until = buffer.len() - 120_000;
                                buffer.drain(..drain_until);
                            }
                        }
                    }
                    Err(_) => break,
                }
            }
        });

        self.terminals
            .insert(
                id.to_string(),
                TerminalSession {
                    pair,
                    _child: child,
                    writer,
                    output_buffer,
                },
            );
        Ok(())
    }

    pub fn write_to_terminal(&mut self, id: &str, data: &str) -> Result<(), String> {
        if let Some(session) = self.terminals.get_mut(id) {
            session
                .writer
                .write_all(data.as_bytes())
                .map_err(|e| format!("Failed to write: {}", e))?;
            session
                .writer
                .flush()
                .map_err(|e| format!("Failed to flush: {}", e))?;
            Ok(())
        } else {
            Err(format!("Terminal {} not found", id))
        }
    }

    pub fn resize_terminal(&mut self, id: &str, cols: u16, rows: u16) -> Result<(), String> {
        if let Some(session) = self.terminals.get(id) {
            session
                .pair
                .master
                .resize(PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|e| format!("Failed to resize: {}", e))?;
            Ok(())
        } else {
            Err(format!("Terminal {} not found", id))
        }
    }

    pub fn kill_terminal(&mut self, id: &str) -> Result<(), String> {
        if self.terminals.remove(id).is_some() {
            Ok(())
        } else {
            Err(format!("Terminal {} not found", id))
        }
    }

    pub fn poll_terminal_output(&mut self, id: &str) -> Result<String, String> {
        if let Some(session) = self.terminals.get(id) {
            let mut guard = session
                .output_buffer
                .lock()
                .map_err(|_| "Failed to access terminal output buffer".to_string())?;
            if guard.is_empty() {
                return Ok(String::new());
            }

            let output = guard.clone();
            guard.clear();
            Ok(output)
        } else {
            Err(format!("Terminal {} not found", id))
        }
    }
}

impl Default for TerminalManager {
    fn default() -> Self {
        Self::new()
    }
}
