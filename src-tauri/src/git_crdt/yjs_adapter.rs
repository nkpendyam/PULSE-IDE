//! Yjs adapter for real-time document sync
//!
//! Uses y-crdt (Rust port of Yjs) for CRDT-based collaboration

use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Yjs adapter for CRDT operations
pub struct YjsAdapter {
    document: YjsDocument,
    pending_updates: Vec<Vec<u8>>,
}

/// Simple Yjs document representation
/// In production, this would use the actual y-crdt library
#[derive(Debug, Clone)]
pub struct YjsDocument {
    content: String,
    version: u64,
    operations: Vec<Operation>,
}

/// Document operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Operation {
    Insert {
        position: u32,
        text: String,
        origin: String, // User ID
        timestamp: u64,
    },
    Delete {
        position: u32,
        length: u32,
        origin: String,
        timestamp: u64,
    },
    Format {
        start: u32,
        end: u32,
        attributes: HashMap<String, String>,
        origin: String,
        timestamp: u64,
    },
}

/// Document state snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentSnapshot {
    pub content: String,
    pub version: u64,
    pub checksum: String,
}

impl YjsAdapter {
    /// Create a new Yjs adapter
    pub fn new() -> Result<Self> {
        Ok(Self {
            document: YjsDocument {
                content: String::new(),
                version: 0,
                operations: Vec::new(),
            },
            pending_updates: Vec::new(),
        })
    }

    /// Apply an update to the document
    pub fn apply_update(&mut self, update: &[u8]) -> Result<()> {
        // Parse update as operation
        let operation: Operation = serde_json::from_slice(update)
            .context("Failed to parse operation")?;

        self.apply_operation(operation);
        
        Ok(())
    }

    /// Apply an operation to the document
    fn apply_operation(&mut self, operation: Operation) {
        match operation {
            Operation::Insert { position, text, .. } => {
                // Find byte position for character position
                let byte_pos = self.char_to_byte(position as usize);
                self.document.content.insert_str(byte_pos, &text);
                self.document.version += 1;
            }
            Operation::Delete { position, length, .. } => {
                let start = self.char_to_byte(position as usize);
                let end = self.char_to_byte((position + length) as usize);
                self.document.content.drain(start..end);
                self.document.version += 1;
            }
            Operation::Format { .. } => {
                // Handle formatting (store as metadata)
                self.document.version += 1;
            }
        }

        self.document.operations.push(operation);
    }

    /// Convert character position to byte position
    fn char_to_byte(&self, char_pos: usize) -> usize {
        self.document.content
            .char_indices()
            .nth(char_pos)
            .map(|(i, _)| i)
            .unwrap_or(self.document.content.len())
    }

    /// Get current document state
    pub fn get_state(&self) -> Result<Vec<u8>> {
        let snapshot = DocumentSnapshot {
            content: self.document.content.clone(),
            version: self.document.version,
            checksum: self.calculate_checksum(),
        };
        
        Ok(serde_json::to_vec(&snapshot)?)
    }

    /// Get document content
    pub fn get_content(&self) -> &str {
        &self.document.content
    }

    /// Set document content
    pub fn set_content(&mut self, content: String) {
        self.document.content = content;
        self.document.version += 1;
    }

    /// Get operations since a version
    pub fn get_operations_since(&self, version: u64) -> Vec<Operation> {
        self.document.operations.iter()
            .filter(|op| {
                if let Operation::Insert { timestamp, .. } = op {
                    *timestamp > version
                } else if let Operation::Delete { timestamp, .. } = op {
                    *timestamp > version
                } else if let Operation::Format { timestamp, .. } = op {
                    *timestamp > version
                } else {
                    false
                }
            })
            .cloned()
            .collect()
    }

    /// Merge with another document state
    pub fn merge(&mut self, other: &DocumentSnapshot) -> Result<()> {
        // Simple merge: use version with higher version number
        // In production, use proper CRDT merge algorithm
        if other.version > self.document.version {
            self.document.content = other.content.clone();
            self.document.version = other.version;
        }
        
        Ok(())
    }

    /// Calculate document checksum
    fn calculate_checksum(&self) -> String {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(self.document.content.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    /// Encode document for transmission
    pub fn encode(&self) -> Result<Vec<u8>> {
        Ok(serde_json::to_vec(&self.document)?)
    }

    /// Decode document from transmission
    pub fn decode(data: &[u8]) -> Result<Self> {
        let document: YjsDocument = serde_json::from_slice(data)?;
        Ok(Self {
            document,
            pending_updates: Vec::new(),
        })
    }
}

impl Default for YjsAdapter {
    fn default() -> Self {
        Self::new().expect("Failed to create YjsAdapter")
    }
}

/// Delta for document changes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Delta {
    pub ops: Vec<DeltaOp>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeltaOp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub insert: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub delete: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retain: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attributes: Option<HashMap<String, String>>,
}

impl Delta {
    /// Create a new empty delta
    pub fn new() -> Self {
        Self { ops: Vec::new() }
    }

    /// Insert text
    pub fn insert(mut self, text: &str) -> Self {
        self.ops.push(DeltaOp {
            insert: Some(text.to_string()),
            delete: None,
            retain: None,
            attributes: None,
        });
        self
    }

    /// Delete characters
    pub fn delete(mut self, count: u32) -> Self {
        self.ops.push(DeltaOp {
            insert: None,
            delete: Some(count),
            retain: None,
            attributes: None,
        });
        self
    }

    /// Retain characters
    pub fn retain(mut self, count: u32) -> Self {
        self.ops.push(DeltaOp {
            insert: None,
            delete: None,
            retain: Some(count),
            attributes: None,
        });
        self
    }
}

impl Default for Delta {
    fn default() -> Self {
        Self::new()
    }
}
