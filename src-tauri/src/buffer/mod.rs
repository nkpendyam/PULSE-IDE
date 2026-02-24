//! Text Buffer Module
//!
//! High-performance text editing using Rope data structure
//! Based on Ropey (https://github.com/cessen/ropey)
//!
//! Ropey is a UTF-8 text rope for Rust, designed to be the backing
//! text-buffer for applications such as text editors. It's fast, robust,
//! and can handle huge texts and memory-incoherent edits with ease.

pub mod rope_buffer;
pub mod gap_buffer;
pub mod piece_table;
pub mod edit;

use serde::{Deserialize, Serialize};

pub use rope_buffer::RopeBuffer;
pub use gap_buffer::GapBuffer;
pub use piece_table::PieceTable;
pub use edit::{Edit, EditKind, EditResult};

/// Buffer trait for text editing
pub trait TextBuffer: Send + Sync {
    /// Get the length of the buffer in bytes
    fn len(&self) -> usize;
    
    /// Check if buffer is empty
    fn is_empty(&self) -> bool;
    
    /// Get character at position
    fn char_at(&self, pos: usize) -> Option<char>;
    
    /// Insert text at position
    fn insert(&mut self, pos: usize, text: &str) -> EditResult;
    
    /// Delete range
    fn delete(&mut self, start: usize, end: usize) -> EditResult;
    
    /// Get text in range
    fn slice(&self, start: usize, end: usize) -> String;
    
    /// Get entire text
    fn to_string(&self) -> String;
    
    /// Get line count
    fn line_count(&self) -> usize;
    
    /// Get line content
    fn line(&self, line_idx: usize) -> Option<String>;
    
    /// Convert byte position to line/column
    fn pos_to_line_col(&self, pos: usize) -> (usize, usize);
    
    /// Convert line/column to byte position
    fn line_col_to_pos(&self, line: usize, col: usize) -> usize;
    
    /// Search for text
    fn search(&self, pattern: &str) -> Vec<usize>;
    
    /// Search with regex
    fn search_regex(&self, pattern: &str) -> Vec<(usize, usize)>;
}

/// Buffer statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BufferStats {
    pub byte_count: usize,
    pub char_count: usize,
    pub line_count: usize,
    pub word_count: usize,
    pub memory_usage: usize,
}

/// Cursor position
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct Cursor {
    pub offset: usize,
    pub line: usize,
    pub column: usize,
}

impl Default for Cursor {
    fn default() -> Self {
        Self {
            offset: 0,
            line: 0,
            column: 0,
        }
    }
}

/// Selection range
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Selection {
    pub start: Cursor,
    pub end: Cursor,
}

impl Selection {
    pub fn new(start: Cursor, end: Cursor) -> Self {
        Self { start, end }
    }
    
    pub fn is_empty(&self) -> bool {
        self.start == self.end
    }
    
    pub fn contains(&self, cursor: &Cursor) -> bool {
        (cursor.offset >= self.start.offset && cursor.offset <= self.end.offset)
            || (cursor.offset >= self.end.offset && cursor.offset <= self.start.offset)
    }
    
    pub fn sorted(&self) -> (Cursor, Cursor) {
        if self.start.offset <= self.end.offset {
            (self.start, self.end)
        } else {
            (self.end, self.start)
        }
    }
}

impl Default for Selection {
    fn default() -> Self {
        Self {
            start: Cursor::default(),
            end: Cursor::default(),
        }
    }
}

/// Undo/Redo support
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UndoEntry {
    pub edits: Vec<Edit>,
    pub timestamp: u64,
    pub description: Option<String>,
}

/// Undo stack
#[derive(Debug, Default)]
pub struct UndoStack {
    undo_stack: Vec<UndoEntry>,
    redo_stack: Vec<UndoEntry>,
    max_size: usize,
}

impl UndoStack {
    pub fn new(max_size: usize) -> Self {
        Self {
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
            max_size,
        }
    }
    
    pub fn push(&mut self, entry: UndoEntry) {
        self.undo_stack.push(entry);
        self.redo_stack.clear();
        
        if self.undo_stack.len() > self.max_size {
            self.undo_stack.remove(0);
        }
    }
    
    pub fn undo(&mut self) -> Option<UndoEntry> {
        if let Some(entry) = self.undo_stack.pop() {
            self.redo_stack.push(entry.clone());
            return Some(entry);
        }
        None
    }
    
    pub fn redo(&mut self) -> Option<UndoEntry> {
        if let Some(entry) = self.redo_stack.pop() {
            self.undo_stack.push(entry.clone());
            return Some(entry);
        }
        None
    }
    
    pub fn can_undo(&self) -> bool {
        !self.undo_stack.is_empty()
    }
    
    pub fn can_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }
    
    pub fn clear(&mut self) {
        self.undo_stack.clear();
        self.redo_stack.clear();
    }
}
