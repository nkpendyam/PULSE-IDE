//! Diff-by-Diff Application
//!
//! Users see exactly what the agent changed, character by character.
//! Allows reverting chunks instantly.

use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// Change chunk for review
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeChunk {
    pub id: String,
    pub file_path: String,
    pub change_type: ChangeType,
    pub old_content: Option<String>,
    pub new_content: Option<String>,
    pub start_line: u32,
    pub end_line: u32,
    pub agent_id: String,
    pub timestamp: DateTime<Utc>,
    pub status: ChunkStatus,
    pub confidence: f32,
    pub explanation: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ChangeType {
    Insert,
    Delete,
    Replace,
    Move { from_line: u32, to_line: u32 },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ChunkStatus {
    Pending,
    Applied,
    Rejected,
    Reverted,
}

/// Change group (multiple chunks from one agent action)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeGroup {
    pub id: String,
    pub agent_id: String,
    pub description: String,
    pub chunks: Vec<String>, // Chunk IDs
    pub timestamp: DateTime<Utc>,
    pub status: GroupStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum GroupStatus {
    Pending,
    PartiallyApplied,
    FullyApplied,
    FullyReverted,
}

/// Diff viewer state
pub struct DiffViewer {
    pending_chunks: HashMap<String, ChangeChunk>,
    applied_chunks: HashMap<String, ChangeChunk>,
    groups: HashMap<String, ChangeGroup>,
    max_undo_depth: usize,
    undo_stack: Vec<String>, // Applied chunk IDs
}

impl DiffViewer {
    pub fn new() -> Self {
        Self {
            pending_chunks: HashMap::new(),
            applied_chunks: HashMap::new(),
            groups: HashMap::new(),
            max_undo_depth: 1000,
            undo_stack: Vec::new(),
        }
    }
    
    /// Add a change chunk for review
    pub fn add_chunk(&mut self, chunk: ChangeChunk) -> String {
        let id = chunk.id.clone();
        self.pending_chunks.insert(id.clone(), chunk);
        id
    }
    
    /// Create a change group
    pub fn create_group(&mut self, agent_id: &str, description: &str, chunk_ids: Vec<String>) -> String {
        let group_id = uuid::Uuid::new_v4().to_string();
        
        let group = ChangeGroup {
            id: group_id.clone(),
            agent_id: agent_id.to_string(),
            description: description.to_string(),
            chunks: chunk_ids,
            timestamp: Utc::now(),
            status: GroupStatus::Pending,
        };
        
        self.groups.insert(group_id.clone(), group);
        group_id
    }
    
    /// Preview a chunk (unified diff format)
    pub fn preview_chunk(&self, chunk_id: &str) -> Option<String> {
        let chunk = self.pending_chunks.get(chunk_id)?;
        
        let mut diff = String::new();
        diff.push_str(&format!("--- {}\n", chunk.file_path));
        diff.push_str(&format!("+++ {}\n", chunk.file_path));
        diff.push_str(&format!("@@ -{},{} +{},{} @@\n", 
            chunk.start_line, 
            chunk.end_line - chunk.start_line + 1,
            chunk.start_line,
            chunk.end_line - chunk.start_line + 1
        ));
        
        match &chunk.change_type {
            ChangeType::Delete => {
                if let Some(old) = &chunk.old_content {
                    for line in old.lines() {
                        diff.push_str(&format!("-{}\n", line));
                    }
                }
            }
            ChangeType::Insert => {
                if let Some(new) = &chunk.new_content {
                    for line in new.lines() {
                        diff.push_str(&format!("+{}\n", line));
                    }
                }
            }
            ChangeType::Replace => {
                if let Some(old) = &chunk.old_content {
                    for line in old.lines() {
                        diff.push_str(&format!("-{}\n", line));
                    }
                }
                if let Some(new) = &chunk.new_content {
                    for line in new.lines() {
                        diff.push_str(&format!("+{}\n", line));
                    }
                }
            }
            ChangeType::Move { from_line, to_line } => {
                diff.push_str(&format!("@@ moved from line {} to {} @@\n", from_line, to_line));
            }
        }
        
        Some(diff)
    }
    
    /// Apply a single chunk
    pub fn apply_chunk(&mut self, chunk_id: &str) -> Result<(), String> {
        let chunk = self.pending_chunks.remove(chunk_id)
            .ok_or_else(|| format!("Chunk not found: {}", chunk_id))?;
        
        let mut chunk = chunk;
        chunk.status = ChunkStatus::Applied;
        
        self.applied_chunks.insert(chunk_id.to_string(), chunk);
        self.undo_stack.push(chunk_id.to_string());
        
        // Trim undo stack if too large
        if self.undo_stack.len() > self.max_undo_depth {
            let removed = self.undo_stack.remove(0);
            self.applied_chunks.remove(&removed);
        }
        
        Ok(())
    }
    
    /// Reject a chunk
    pub fn reject_chunk(&mut self, chunk_id: &str) -> Result<(), String> {
        let chunk = self.pending_chunks.remove(chunk_id)
            .ok_or_else(|| format!("Chunk not found: {}", chunk_id))?;
        
        let mut chunk = chunk;
        chunk.status = ChunkStatus::Rejected;
        
        // Don't store rejected chunks
        Ok(())
    }
    
    /// Revert an applied chunk
    pub fn revert_chunk(&mut self, chunk_id: &str) -> Result<ChangeChunk, String> {
        let chunk = self.applied_chunks.remove(chunk_id)
            .ok_or_else(|| format!("Applied chunk not found: {}", chunk_id))?;
        
        let mut chunk = chunk;
        chunk.status = ChunkStatus::Reverted;
        
        // Remove from undo stack
        self.undo_stack.retain(|id| id != chunk_id);
        
        Ok(chunk)
    }
    
    /// Apply all pending chunks from a group
    pub fn apply_group(&mut self, group_id: &str) -> Result<Vec<String>, String> {
        let group = self.groups.get(group_id)
            .ok_or_else(|| format!("Group not found: {}", group_id))?
            .clone();
        
        let mut applied = Vec::new();
        let mut failed = Vec::new();
        
        for chunk_id in &group.chunks {
            match self.apply_chunk(chunk_id) {
                Ok(()) => applied.push(chunk_id.clone()),
                Err(e) => failed.push(format!("{}: {}", chunk_id, e)),
            }
        }
        
        // Update group status
        if let Some(g) = self.groups.get_mut(group_id) {
            if failed.is_empty() {
                g.status = GroupStatus::FullyApplied;
            } else if applied.is_empty() {
                g.status = GroupStatus::Pending;
            } else {
                g.status = GroupStatus::PartiallyApplied;
            }
        }
        
        if failed.is_empty() {
            Ok(applied)
        } else {
            Err(format!("Failed to apply some chunks: {}", failed.join(", ")))
        }
    }
    
    /// Revert all chunks in a group
    pub fn revert_group(&mut self, group_id: &str) -> Result<Vec<String>, String> {
        let group = self.groups.get(group_id)
            .ok_or_else(|| format!("Group not found: {}", group_id))?
            .clone();
        
        let mut reverted = Vec::new();
        
        for chunk_id in &group.chunks {
            if self.applied_chunks.contains_key(chunk_id) {
                match self.revert_chunk(chunk_id) {
                    Ok(_) => reverted.push(chunk_id.clone()),
                    Err(e) => log::warn!("Failed to revert chunk {}: {}", chunk_id, e),
                }
            }
        }
        
        // Update group status
        if let Some(g) = self.groups.get_mut(group_id) {
            g.status = GroupStatus::FullyReverted;
        }
        
        Ok(reverted)
    }
    
    /// Get all pending chunks
    pub fn get_pending(&self) -> Vec<&ChangeChunk> {
        self.pending_chunks.values().collect()
    }
    
    /// Get chunks for a file
    pub fn get_chunks_for_file(&self, file_path: &str) -> (Vec<&ChangeChunk>, Vec<&ChangeChunk>) {
        let pending: Vec<_> = self.pending_chunks.values()
            .filter(|c| c.file_path == file_path)
            .collect();
        
        let applied: Vec<_> = self.applied_chunks.values()
            .filter(|c| c.file_path == file_path)
            .collect();
        
        (pending, applied)
    }
    
    /// Get undo history
    pub fn get_undo_history(&self, limit: usize) -> Vec<&ChangeChunk> {
        self.undo_stack.iter().rev()
            .take(limit)
            .filter_map(|id| self.applied_chunks.get(id))
            .collect()
    }
    
    /// Undo last applied chunk
    pub fn undo_last(&mut self) -> Option<ChangeChunk> {
        let chunk_id = self.undo_stack.pop()?;
        self.revert_chunk(&chunk_id).ok()
    }
    
    /// Get statistics
    pub fn stats(&self) -> DiffStats {
        DiffStats {
            pending_count: self.pending_chunks.len(),
            applied_count: self.applied_chunks.len(),
            group_count: self.groups.len(),
            undo_depth: self.undo_stack.len(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffStats {
    pub pending_count: usize,
    pub applied_count: usize,
    pub group_count: usize,
    pub undo_depth: usize,
}

impl Default for DiffViewer {
    fn default() -> Self {
        Self::new()
    }
}
