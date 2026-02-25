//! Edit Operations
//!
//! Represents text edits for undo/redo support

use serde::{Deserialize, Serialize};

/// Edit operation kind
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum EditKind {
    Insert,
    Delete,
    Replace,
}

/// Single edit operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Edit {
    pub kind: EditKind,
    pub start: usize,
    pub end: usize,
    pub text: String,
    pub deleted: Option<String>,
}

impl Edit {
    /// Create an insert edit
    pub fn insert(pos: usize, text: String) -> Self {
        Self {
            kind: EditKind::Insert,
            start: pos,
            end: pos + text.len(),
            text,
            deleted: None,
        }
    }
    
    /// Create a delete edit
    pub fn delete(start: usize, end: usize, deleted: String) -> Self {
        Self {
            kind: EditKind::Delete,
            start,
            end: start,
            text: String::new(),
            deleted: Some(deleted),
        }
    }
    
    /// Create a replace edit
    pub fn replace(start: usize, end: usize, text: String, deleted: String) -> Self {
        Self {
            kind: EditKind::Replace,
            start,
            end: start + text.len(),
            text,
            deleted: Some(deleted),
        }
    }
    
    /// Get the inverse edit for undo
    pub fn inverse(&self) -> Self {
        match self.kind {
            EditKind::Insert => Self {
                kind: EditKind::Delete,
                start: self.start,
                end: self.start,
                text: String::new(),
                deleted: Some(self.text.clone()),
            },
            EditKind::Delete => Self {
                kind: EditKind::Insert,
                start: self.start,
                end: self.start + self.deleted.as_ref().map(|d| d.len()).unwrap_or(0),
                text: self.deleted.clone().unwrap_or_default(),
                deleted: None,
            },
            EditKind::Replace => Self {
                kind: EditKind::Replace,
                start: self.start,
                end: self.start + self.deleted.as_ref().map(|d| d.len()).unwrap_or(0),
                text: self.deleted.clone().unwrap_or_default(),
                deleted: Some(self.text.clone()),
            },
        }
    }
}

/// Edit result
#[derive(Debug, Clone)]
pub enum EditResult {
    Success(Edit),
    Error(String),
}

impl EditResult {
    pub fn is_success(&self) -> bool {
        matches!(self, EditResult::Success(_))
    }
    
    pub fn edit(&self) -> Option<&Edit> {
        match self {
            EditResult::Success(edit) => Some(edit),
            _ => None,
        }
    }
}

/// Batch of edits
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct EditBatch {
    pub edits: Vec<Edit>,
    pub timestamp: u64,
    pub description: Option<String>,
}

impl EditBatch {
    pub fn new(edits: Vec<Edit>) -> Self {
        Self {
            edits,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
            description: None,
        }
    }
    
    pub fn with_description(mut self, desc: &str) -> Self {
        self.description = Some(desc.to_string());
        self
    }
    
    /// Get inverse batch for undo
    pub fn inverse(&self) -> Self {
        let mut inverted: Vec<Edit> = self.edits.iter().rev().map(|e| e.inverse()).collect();
        
        // Adjust positions for sequential undos
        if !inverted.is_empty() {
            let mut offset = 0i64;
            for edit in &mut inverted {
                edit.start = ((edit.start as i64) + offset) as usize;
                edit.end = ((edit.end as i64) + offset) as usize;
            }
        }
        
        Self {
            edits: inverted,
            timestamp: self.timestamp,
            description: self.description.clone(),
        }
    }
}
