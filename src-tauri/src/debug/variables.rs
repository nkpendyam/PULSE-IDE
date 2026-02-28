//! Variable Inspection
//!
//! Variable viewing and evaluation for debugging

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

/// Variable tree node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VariableNode {
    pub name: String,
    pub value: String,
    pub var_type: Option<String>,
    pub children: Vec<VariableNode>,
    pub expandable: bool,
    pub memory_reference: Option<String>,
}

/// Variable watcher
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchExpression {
    pub id: u64,
    pub expression: String,
    pub value: Option<String>,
    pub error: Option<String>,
    pub eval_on_each_step: bool,
}

/// Watch manager
pub struct WatchManager {
    watches: Vec<WatchExpression>,
    id_counter: u64,
}

impl WatchManager {
    pub fn new() -> Self {
        Self {
            watches: Vec::new(),
            id_counter: 0,
        }
    }
    
    /// Add a watch expression
    pub fn add(&mut self, expression: &str) -> WatchExpression {
        self.id_counter += 1;
        let watch = WatchExpression {
            id: self.id_counter,
            expression: expression.to_string(),
            value: None,
            error: None,
            eval_on_each_step: true,
        };
        self.watches.push(watch.clone());
        watch
    }
    
    /// Remove a watch
    pub fn remove(&mut self, id: u64) {
        self.watches.retain(|w| w.id != id);
    }
    
    /// Update watch value
    pub fn update(&mut self, id: u64, value: Result<String, String>) {
        if let Some(watch) = self.watches.iter_mut().find(|w| w.id == id) {
            match value {
                Ok(v) => {
                    watch.value = Some(v);
                    watch.error = None;
                }
                Err(e) => {
                    watch.value = None;
                    watch.error = Some(e);
                }
            }
        }
    }
    
    /// Get all watches
    pub fn get_all(&self) -> &[WatchExpression] {
        &self.watches
    }
    
    /// Get watches that should be evaluated on step
    pub fn get_step_watches(&self) -> Vec<&WatchExpression> {
        self.watches.iter()
            .filter(|w| w.eval_on_each_step)
            .collect()
    }
}

impl Default for WatchManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Memory inspector
pub struct MemoryInspector {
    cache: HashMap<String, Vec<u8>>,
    max_cache_size: usize,
}

impl MemoryInspector {
    pub fn new() -> Self {
        Self {
            cache: HashMap::new(),
            max_cache_size: 1024 * 1024, // 1MB cache
        }
    }
    
    /// Read memory at reference
    pub fn read(&mut self, reference: &str, offset: u64, count: usize) -> Vec<u8> {
        let cache_key = format!("{}:{}", reference, offset);
        
        if let Some(data) = self.cache.get(&cache_key) {
            return data.iter().take(count).copied().collect();
        }
        
        // In real implementation, would query debug adapter
        vec![0; count]
    }
    
    /// Format memory as hex dump
    pub fn format_hex_dump(&self, data: &[u8], base_address: u64) -> String {
        let mut output = String::new();
        
        for (i, chunk) in data.chunks(16).enumerate() {
            let addr = base_address + (i as u64 * 16);
            output.push_str(&format!("{:016x}: ", addr));
            
            // Hex bytes
            for (j, byte) in chunk.iter().enumerate() {
                if j == 8 {
                    output.push(' ');
                }
                output.push_str(&format!("{:02x} ", byte));
            }
            
            // Padding if chunk is less than 16
            if chunk.len() < 16 {
                for j in chunk.len()..16 {
                    if j == 8 {
                        output.push(' ');
                    }
                    output.push_str("   ");
                }
            }
            
            output.push_str(" |");
            
            // ASCII representation
            for byte in chunk {
                if byte.is_ascii_graphic() || *byte == b' ' {
                    output.push(*byte as char);
                } else {
                    output.push('.');
                }
            }
            
            output.push_str("|\n");
        }
        
        output
    }
    
    /// Clear cache
    pub fn clear_cache(&mut self) {
        self.cache.clear();
    }
}

impl Default for MemoryInspector {
    fn default() -> Self {
        Self::new()
    }
}

/// REPL (Read-Eval-Print-Loop) for debug console
pub struct DebugRepl {
    history: Vec<ReplEntry>,
    max_history: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplEntry {
    pub expression: String,
    pub result: Option<String>,
    pub error: Option<String>,
    pub timestamp: u64,
}

impl DebugRepl {
    pub fn new() -> Self {
        Self {
            history: Vec::new(),
            max_history: 1000,
        }
    }
    
    /// Add entry to history
    pub fn add(&mut self, entry: ReplEntry) {
        if self.history.len() >= self.max_history {
            self.history.remove(0);
        }
        self.history.push(entry);
    }
    
    /// Get history
    pub fn history(&self) -> &[ReplEntry] {
        &self.history
    }
    
    /// Search history
    pub fn search(&self, query: &str) -> Vec<&ReplEntry> {
        self.history.iter()
            .filter(|e| e.expression.contains(query))
            .collect()
    }
    
    /// Clear history
    pub fn clear(&mut self) {
        self.history.clear();
    }
}

impl Default for DebugRepl {
    fn default() -> Self {
        Self::new()
    }
}
