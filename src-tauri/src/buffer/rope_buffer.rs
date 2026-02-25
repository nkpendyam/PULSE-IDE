//! Rope-based Text Buffer
//!
//! Uses Ropey (https://github.com/cessen/ropey) for efficient text editing

use anyhow::Result;
use ropey::{Rope, RopeSlice, iter::Chars};
use serde::{Deserialize, Serialize};
use std::ops::Range;

use super::{TextBuffer, BufferStats, Cursor, Selection, EditResult, Edit, EditKind};

/// Rope-based text buffer
#[derive(Debug, Clone)]
pub struct RopeBuffer {
    rope: Rope,
    /// Buffer file path
    path: Option<String>,
    /// Language ID
    language: Option<String>,
    /// Modified flag
    modified: bool,
    /// Version number for synchronization
    version: u64,
}

impl RopeBuffer {
    /// Create a new empty buffer
    pub fn new() -> Self {
        Self {
            rope: Rope::new(),
            path: None,
            language: None,
            modified: false,
            version: 0,
        }
    }
    
    /// Create buffer from text
    pub fn from_text(text: &str) -> Self {
        Self {
            rope: Rope::from_str(text),
            path: None,
            language: None,
            modified: false,
            version: 0,
        }
    }
    
    /// Create buffer from file
    pub fn from_file(path: &str) -> Result<Self> {
        let rope = Rope::from_reader(std::fs::File::open(path)?)?;
        
        // Detect language from extension
        let language = path.rsplit('.').next().map(|ext| {
            match ext {
                "rs" => "rust",
                "py" => "python",
                "js" => "javascript",
                "ts" => "typescript",
                "go" => "go",
                "java" => "java",
                "c" => "c",
                "cpp" | "cc" | "cxx" => "cpp",
                "h" | "hpp" => "cpp",
                "rb" => "ruby",
                "php" => "php",
                "html" => "html",
                "css" => "css",
                "json" => "json",
                "yaml" | "yml" => "yaml",
                "md" => "markdown",
                "sql" => "sql",
                "sh" => "shell",
                _ => "plaintext",
            }.to_string()
        });
        
        Ok(Self {
            rope,
            path: Some(path.to_string()),
            language,
            modified: false,
            version: 0,
        })
    }
    
    /// Save buffer to file
    pub fn save(&self) -> Result<()> {
        if let Some(ref path) = self.path {
            self.save_as(path)?;
        }
        Ok(())
    }
    
    /// Save buffer to specific path
    pub fn save_as(&self, path: &str) -> Result<()> {
        use std::io::Write;
        let mut file = std::fs::File::create(path)?;
        for chunk in self.rope.chunks() {
            file.write_all(chunk.as_bytes())?;
        }
        Ok(())
    }
    
    /// Get file path
    pub fn path(&self) -> Option<&str> {
        self.path.as_deref()
    }
    
    /// Set file path
    pub fn set_path(&mut self, path: String) {
        self.path = Some(path);
    }
    
    /// Get language ID
    pub fn language(&self) -> Option<&str> {
        self.language.as_deref()
    }
    
    /// Set language ID
    pub fn set_language(&mut self, language: String) {
        self.language = Some(language);
    }
    
    /// Check if modified
    pub fn is_modified(&self) -> bool {
        self.modified
    }
    
    /// Mark as saved
    pub fn mark_saved(&mut self) {
        self.modified = false;
    }
    
    /// Get version
    pub fn version(&self) -> u64 {
        self.version
    }
    
    /// Get buffer statistics
    pub fn stats(&self) -> BufferStats {
        let char_count = self.rope.len_chars();
        let byte_count = self.rope.len_bytes();
        let line_count = self.rope.len_lines();
        
        // Count words (simplified)
        let word_count = self.rope.chunks()
            .flat_map(|chunk| chunk.split_whitespace())
            .count();
        
        BufferStats {
            byte_count,
            char_count,
            line_count,
            word_count,
            memory_usage: byte_count, // Approximate
        }
    }
    
    /// Get a slice of the rope
    pub fn slice_range(&self, range: Range<usize>) -> RopeSlice {
        self.rope.get_slice(range.start..range.end).unwrap_or_default()
    }
    
    /// Iterate over characters
    pub fn chars(&self) -> Chars {
        self.rope.chars()
    }
    
    /// Get line start byte
    pub fn line_start_byte(&self, line_idx: usize) -> usize {
        self.rope.line_to_byte(line_idx)
    }
    
    /// Get line end byte
    pub fn line_end_byte(&self, line_idx: usize) -> usize {
        if line_idx + 1 < self.rope.len_lines() {
            self.rope.line_to_byte(line_idx + 1)
        } else {
            self.rope.len_bytes()
        }
    }
    
    /// Replace range with text
    pub fn replace(&mut self, start: usize, end: usize, text: &str) -> EditResult {
        if start > end || end > self.rope.len_bytes() {
            return EditResult::Error("Invalid range".to_string());
        }
        
        let deleted = self.slice(start, end);
        
        // Delete range
        if start < end {
            let start_char = self.rope.byte_to_char(start);
            let end_char = self.rope.byte_to_char(end);
            self.rope.remove(start_char..end_char);
        }
        
        // Insert new text
        if !text.is_empty() {
            let insert_char = self.rope.byte_to_char(start);
            self.rope.insert(insert_char, text);
        }
        
        self.modified = true;
        self.version += 1;
        
        EditResult::Success(Edit {
            kind: EditKind::Replace,
            start,
            end: start + text.len(),
            text: text.to_string(),
            deleted: Some(deleted),
        })
    }
    
    /// Search for pattern
    pub fn find(&self, pattern: &str) -> Vec<usize> {
        let mut results = Vec::new();
        let pattern_bytes = pattern.as_bytes();
        
        // Simple byte search (could be optimized with Boyer-Moore)
        for i in 0..self.rope.len_bytes().saturating_sub(pattern.len()) {
            let mut found = true;
            for (j, &b) in pattern_bytes.iter().enumerate() {
                if let Some(c) = self.char_at(i + j) {
                    if c as u8 != b && c.to_ascii_lowercase() as u8 != b.to_ascii_lowercase() {
                        found = false;
                        break;
                    }
                } else {
                    found = false;
                    break;
                }
            }
            if found {
                results.push(i);
            }
        }
        
        results
    }
    
    /// Find next occurrence
    pub fn find_next(&self, pattern: &str, from: usize) -> Option<usize> {
        let positions = self.find(pattern);
        positions.into_iter().find(|&p| p >= from)
    }
    
    /// Find previous occurrence
    pub fn find_prev(&self, pattern: &str, from: usize) -> Option<usize> {
        let positions = self.find(pattern);
        positions.into_iter().rev().find(|&p| p < from)
    }
}

impl Default for RopeBuffer {
    fn default() -> Self {
        Self::new()
    }
}

impl TextBuffer for RopeBuffer {
    fn len(&self) -> usize {
        self.rope.len_bytes()
    }
    
    fn is_empty(&self) -> bool {
        self.rope.len_bytes() == 0
    }
    
    fn char_at(&self, pos: usize) -> Option<char> {
        if pos < self.rope.len_bytes() {
            let char_idx = self.rope.byte_to_char(pos);
            self.rope.get_char(char_idx)
        } else {
            None
        }
    }
    
    fn insert(&mut self, pos: usize, text: &str) -> EditResult {
        if pos > self.rope.len_bytes() {
            return EditResult::Error("Position out of bounds".to_string());
        }
        
        let char_idx = self.rope.byte_to_char(pos);
        self.rope.insert(char_idx, text);
        
        self.modified = true;
        self.version += 1;
        
        EditResult::Success(Edit {
            kind: EditKind::Insert,
            start: pos,
            end: pos + text.len(),
            text: text.to_string(),
            deleted: None,
        })
    }
    
    fn delete(&mut self, start: usize, end: usize) -> EditResult {
        if start > end || end > self.rope.len_bytes() {
            return EditResult::Error("Invalid range".to_string());
        }
        
        let deleted = self.slice(start, end);
        let start_char = self.rope.byte_to_char(start);
        let end_char = self.rope.byte_to_char(end);
        self.rope.remove(start_char..end_char);
        
        self.modified = true;
        self.version += 1;
        
        EditResult::Success(Edit {
            kind: EditKind::Delete,
            start,
            end: start,
            text: String::new(),
            deleted: Some(deleted),
        })
    }
    
    fn slice(&self, start: usize, end: usize) -> String {
        if start >= end || start >= self.rope.len_bytes() {
            return String::new();
        }
        
        let end = end.min(self.rope.len_bytes());
        let start_char = self.rope.byte_to_char(start);
        let end_char = self.rope.byte_to_char(end);
        
        self.rope.get_slice(start_char..end_char)
            .map(|s| s.to_string())
            .unwrap_or_default()
    }
    
    fn to_string(&self) -> String {
        self.rope.to_string()
    }
    
    fn line_count(&self) -> usize {
        self.rope.len_lines()
    }
    
    fn line(&self, line_idx: usize) -> Option<String> {
        if line_idx >= self.rope.len_lines() {
            return None;
        }
        
        let start = self.rope.line_to_char(line_idx);
        let end = if line_idx + 1 < self.rope.len_lines() {
            self.rope.line_to_char(line_idx + 1)
        } else {
            self.rope.len_chars()
        };
        
        Some(self.rope.get_slice(start..end)?.to_string())
    }
    
    fn pos_to_line_col(&self, pos: usize) -> (usize, usize) {
        let char_idx = self.rope.byte_to_char(pos.min(self.rope.len_bytes()));
        let line_idx = self.rope.char_to_line(char_idx);
        let line_start = self.rope.line_to_char(line_idx);
        let col = char_idx - line_start;
        
        (line_idx, col)
    }
    
    fn line_col_to_pos(&self, line: usize, col: usize) -> usize {
        let line = line.min(self.rope.len_lines().saturating_sub(1));
        let line_start = self.rope.line_to_char(line);
        let line_end = if line + 1 < self.rope.len_lines() {
            self.rope.line_to_char(line + 1)
        } else {
            self.rope.len_chars()
        };
        
        let char_idx = (line_start + col).min(line_end.saturating_sub(1));
        self.rope.char_to_byte(char_idx)
    }
    
    fn search(&self, pattern: &str) -> Vec<usize> {
        self.find(pattern)
    }
    
    fn search_regex(&self, _pattern: &str) -> Vec<(usize, usize)> {
        // Would need regex crate integration
        Vec::new()
    }
}
