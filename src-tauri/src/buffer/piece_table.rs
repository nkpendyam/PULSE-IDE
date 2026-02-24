//! Piece Table Implementation
//!
//! Efficient for multiple insert/delete operations
//! Based on the piece table data structure used in many editors

use serde::{Deserialize, Serialize};
use std::ops::Range;

use super::{TextBuffer, EditResult, Edit};

/// Piece in the piece table
#[derive(Debug, Clone, Copy)]
struct Piece {
    /// Source buffer index (0 = original, 1 = add buffer)
    source: usize,
    /// Start position in source
    start: usize,
    /// Length of piece
    length: usize,
}

/// Piece table buffer
#[derive(Debug, Clone)]
pub struct PieceTable {
    /// Original content buffer
    original: Vec<u8>,
    /// Add buffer for new content
    add_buffer: Vec<u8>,
    /// List of pieces
    pieces: Vec<Piece>,
}

impl PieceTable {
    /// Create new empty piece table
    pub fn new() -> Self {
        Self {
            original: Vec::new(),
            add_buffer: Vec::new(),
            pieces: Vec::new(),
        }
    }
    
    /// Create from text
    pub fn from_text(text: &str) -> Self {
        Self {
            original: text.as_bytes().to_vec(),
            add_buffer: Vec::new(),
            pieces: vec![Piece {
                source: 0,
                start: 0,
                length: text.len(),
            }],
        }
    }
    
    /// Get total length
    fn total_length(&self) -> usize {
        self.pieces.iter().map(|p| p.length).sum()
    }
    
    /// Find piece containing position
    fn find_piece(&self, pos: usize) -> Option<(usize, usize)> {
        let mut current_pos = 0;
        
        for (idx, piece) in self.pieces.iter().enumerate() {
            if current_pos + piece.length > pos {
                return Some((idx, pos - current_pos));
            }
            current_pos += piece.length;
        }
        
        if pos == current_pos && !self.pieces.is_empty() {
            return Some((self.pieces.len() - 1, self.pieces.last()?.length));
        }
        
        None
    }
    
    /// Get content from a piece
    fn get_piece_content(&self, piece: &Piece) -> &[u8] {
        let source = if piece.source == 0 {
            &self.original
        } else {
            &self.add_buffer
        };
        
        &source[piece.start..piece.start + piece.length]
    }
}

impl Default for PieceTable {
    fn default() -> Self {
        Self::new()
    }
}

impl TextBuffer for PieceTable {
    fn len(&self) -> usize {
        self.total_length()
    }
    
    fn is_empty(&self) -> bool {
        self.pieces.is_empty() || self.total_length() == 0
    }
    
    fn char_at(&self, pos: usize) -> Option<char> {
        let (piece_idx, offset) = self.find_piece(pos)?;
        let piece = self.pieces.get(piece_idx)?;
        let content = self.get_piece_content(piece);
        let byte = content.get(offset)?;
        Some(*byte as char)
    }
    
    fn insert(&mut self, pos: usize, text: &str) -> EditResult {
        if text.is_empty() {
            return EditResult::Success(Edit::insert(pos, String::new()));
        }
        
        let add_start = self.add_buffer.len();
        self.add_buffer.extend_from_slice(text.as_bytes());
        
        let new_piece = Piece {
            source: 1,
            start: add_start,
            length: text.len(),
        };
        
        if self.pieces.is_empty() {
            self.pieces.push(new_piece);
        } else if let Some((piece_idx, offset)) = self.find_piece(pos) {
            // Split existing piece
            let old_piece = self.pieces[piece_idx];
            
            if offset == 0 {
                // Insert before this piece
                self.pieces.insert(piece_idx, new_piece);
            } else if offset == old_piece.length {
                // Insert after this piece
                self.pieces.insert(piece_idx + 1, new_piece);
            } else {
                // Split piece in two and insert new piece between
                let first_piece = Piece {
                    source: old_piece.source,
                    start: old_piece.start,
                    length: offset,
                };
                let second_piece = Piece {
                    source: old_piece.source,
                    start: old_piece.start + offset,
                    length: old_piece.length - offset,
                };
                
                self.pieces[piece_idx] = first_piece;
                self.pieces.insert(piece_idx + 1, new_piece);
                self.pieces.insert(piece_idx + 2, second_piece);
            }
        }
        
        EditResult::Success(Edit::insert(pos, text.to_string()))
    }
    
    fn delete(&mut self, start: usize, end: usize) -> EditResult {
        if start >= end {
            return EditResult::Error("Invalid range".to_string());
        }
        
        let deleted = self.slice(start, end);
        let length = end - start;
        
        // Find and modify pieces
        if let Some((piece_idx, offset)) = self.find_piece(start) {
            let piece = self.pieces[piece_idx];
            
            if offset == 0 && length >= piece.length {
                // Remove entire piece
                self.pieces.remove(piece_idx);
            } else {
                // Shorten piece
                self.pieces[piece_idx].length = offset;
                
                if offset + length < piece.length {
                    // Add remaining piece
                    let remaining = Piece {
                        source: piece.source,
                        start: piece.start + offset + length,
                        length: piece.length - offset - length,
                    };
                    self.pieces.insert(piece_idx + 1, remaining);
                }
            }
        }
        
        EditResult::Success(Edit::delete(start, end, deleted))
    }
    
    fn slice(&self, start: usize, end: usize) -> String {
        if start >= end {
            return String::new();
        }
        
        let mut result = Vec::with_capacity(end - start);
        let mut current_pos = 0;
        
        for piece in &self.pieces {
            let piece_start = current_pos;
            let piece_end = current_pos + piece.length;
            
            if piece_end <= start {
                current_pos = piece_end;
                continue;
            }
            if piece_start >= end {
                break;
            }
            
            let content = self.get_piece_content(piece);
            let slice_start = if start > piece_start { start - piece_start } else { 0 };
            let slice_end = if end < piece_end { end - piece_start } else { piece.length };
            
            result.extend_from_slice(&content[slice_start..slice_end]);
            current_pos = piece_end;
        }
        
        String::from_utf8_lossy(&result).to_string()
    }
    
    fn to_string(&self) -> String {
        self.slice(0, self.total_length())
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
