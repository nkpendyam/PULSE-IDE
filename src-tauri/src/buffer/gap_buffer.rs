//! Gap Buffer Implementation
//!
//! Simple and fast text buffer for local edits

use serde::{Deserialize, Serialize};
use std::ops::Range;

use super::{TextBuffer, EditResult, Edit, EditKind};

/// Gap buffer for efficient local edits
#[derive(Debug, Clone)]
pub struct GapBuffer {
    /// Buffer content
    buffer: Vec<u8>,
    /// Gap start position
    gap_start: usize,
    /// Gap end position
    gap_end: usize,
    /// Growth factor when resizing
    growth_factor: usize,
}

impl GapBuffer {
    /// Create new empty gap buffer
    pub fn new() -> Self {
        Self::with_capacity(1024)
    }
    
    /// Create with initial capacity
    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            buffer: vec![0; capacity],
            gap_start: 0,
            gap_end: capacity,
            growth_factor: 2,
        }
    }
    
    /// Create from text
    pub fn from_text(text: &str) -> Self {
        let mut buf = Self::with_capacity(text.len().max(1024));
        buf.insert(0, text).ok();
        buf
    }
    
    /// Get gap size
    fn gap_size(&self) -> usize {
        self.gap_end - self.gap_start
    }
    
    /// Get content length (excluding gap)
    fn content_len(&self) -> usize {
        self.buffer.len() - self.gap_size()
    }
    
    /// Move gap to position
    fn move_gap_to(&mut self, pos: usize) {
        if pos == self.gap_start {
            return;
        }
        
        if pos < self.gap_start {
            // Move gap left
            let amount = self.gap_start - pos;
            self.buffer.copy_within(pos..self.gap_start, self.gap_end - amount);
            self.gap_start -= amount;
            self.gap_end -= amount;
        } else {
            // Move gap right
            let amount = pos - self.gap_start;
            let src_start = self.gap_end;
            let src_end = self.gap_end + amount;
            self.buffer.copy_within(src_start..src_end, self.gap_start);
            self.gap_start += amount;
            self.gap_end += amount;
        }
    }
    
    /// Ensure gap has at least required space
    fn ensure_gap_capacity(&mut self, required: usize) {
        if self.gap_size() >= required {
            return;
        }
        
        // Grow buffer
        let new_size = (self.buffer.len() + required) * self.growth_factor;
        let mut new_buffer = vec![0u8; new_size];
        
        // Copy content before gap
        new_buffer[..self.gap_start].copy_from_slice(&self.buffer[..self.gap_start]);
        
        // Copy content after gap
        let after_gap_len = self.buffer.len() - self.gap_end;
        let new_gap_end = new_size - after_gap_len;
        new_buffer[new_gap_end..].copy_from_slice(&self.buffer[self.gap_end..]);
        
        self.buffer = new_buffer;
        self.gap_end = new_gap_end;
    }
    
    /// Convert logical position to physical buffer position
    fn logical_to_physical(&self, pos: usize) -> usize {
        if pos <= self.gap_start {
            pos
        } else {
            pos + self.gap_size()
        }
    }
}

impl Default for GapBuffer {
    fn default() -> Self {
        Self::new()
    }
}

impl TextBuffer for GapBuffer {
    fn len(&self) -> usize {
        self.content_len()
    }
    
    fn is_empty(&self) -> bool {
        self.content_len() == 0
    }
    
    fn char_at(&self, pos: usize) -> Option<char> {
        let physical = self.logical_to_physical(pos);
        if physical < self.buffer.len() && physical >= self.gap_end || physical < self.gap_start {
            let byte = self.buffer.get(physical)?;
            Some(*byte as char)
        } else {
            None
        }
    }
    
    fn insert(&mut self, pos: usize, text: &str) -> EditResult {
        self.move_gap_to(pos);
        self.ensure_gap_capacity(text.len());
        
        let bytes = text.as_bytes();
        self.buffer[self.gap_start..self.gap_start + bytes.len()].copy_from_slice(bytes);
        self.gap_start += bytes.len();
        
        EditResult::Success(Edit::insert(pos, text.to_string()))
    }
    
    fn delete(&mut self, start: usize, end: usize) -> EditResult {
        if start >= end {
            return EditResult::Error("Invalid range".to_string());
        }
        
        let deleted = self.slice(start, end);
        self.move_gap_to(end);
        self.gap_start -= (end - start);
        
        EditResult::Success(Edit::delete(start, end, deleted))
    }
    
    fn slice(&self, start: usize, end: usize) -> String {
        if start >= end {
            return String::new();
        }
        
        let mut result = Vec::with_capacity(end - start);
        
        for i in start..end {
            if let Some(c) = self.char_at(i) {
                result.push(c as u8);
            }
        }
        
        String::from_utf8_lossy(&result).to_string()
    }
    
    fn to_string(&self) -> String {
        self.slice(0, self.content_len())
    }
    
    fn line_count(&self) -> usize {
        self.to_string().lines().count().max(1)
    }
    
    fn line(&self, line_idx: usize) -> Option<String> {
        self.to_string().lines().nth(line_idx).map(|s| s.to_string())
    }
    
    fn pos_to_line_col(&self, pos: usize) -> (usize, usize) {
        let text = self.to_string();
        let mut line = 0;
        let mut col = 0;
        let mut current_pos = 0;
        
        for c in text.chars() {
            if current_pos == pos {
                break;
            }
            if c == '\n' {
                line += 1;
                col = 0;
            } else {
                col += 1;
            }
            current_pos += 1;
        }
        
        (line, col)
    }
    
    fn line_col_to_pos(&self, line: usize, col: usize) -> usize {
        let text = self.to_string();
        let mut current_line = 0;
        let mut current_col = 0;
        let mut pos = 0;
        
        for c in text.chars() {
            if current_line == line && current_col == col {
                return pos;
            }
            if c == '\n' {
                current_line += 1;
                current_col = 0;
            } else {
                current_col += 1;
            }
            pos += 1;
        }
        
        pos
    }
    
    fn search(&self, pattern: &str) -> Vec<usize> {
        let text = self.to_string();
        text.match_indices(pattern)
            .map(|(i, _)| i)
            .collect()
    }
    
    fn search_regex(&self, _pattern: &str) -> Vec<(usize, usize)> {
        Vec::new()
    }
}
