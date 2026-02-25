//! VS Code Extension API Compatibility Layer
//! 
//! Implements the vscode namespace for extension compatibility
//! Based on: https://code.visualstudio.com/api/references/vscode-api

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

pub mod commands;
pub mod window;
pub mod workspace;
pub mod languages;
pub mod debug;

/// VS Code Extension Context
#[derive(Debug, Clone)]
pub struct ExtensionContext {
    pub extension_id: String,
    pub extension_path: String,
    pub global_state: HashMap<String, serde_json::Value>,
    pub workspace_state: HashMap<String, serde_json::Value>,
    pub subscriptions: Vec<String>,
}

impl ExtensionContext {
    pub fn new(extension_id: &str, extension_path: &str) -> Self {
        Self {
            extension_id: extension_id.to_string(),
            extension_path: extension_path.to_string(),
            global_state: HashMap::new(),
            workspace_state: HashMap::new(),
            subscriptions: Vec::new(),
        }
    }

    pub fn get_global_state(&self, key: &str) -> Option<&serde_json::Value> {
        self.global_state.get(key)
    }

    pub fn set_global_state(&mut self, key: &str, value: serde_json::Value) {
        self.global_state.insert(key.to_string(), value);
    }

    pub fn get_workspace_state(&self, key: &str) -> Option<&serde_json::Value> {
        self.workspace_state.get(key)
    }

    pub fn set_workspace_state(&mut self, key: &str, value: serde_json::Value) {
        self.workspace_state.insert(key.to_string(), value);
    }
}

/// VS Code Position (line and character)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Position {
    pub line: u32,
    pub character: u32,
}

impl Position {
    pub fn new(line: u32, character: u32) -> Self {
        Self { line, character }
    }
}

/// VS Code Range (start and end positions)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Range {
    pub start: Position,
    pub end: Position,
}

impl Range {
    pub fn new(start: Position, end: Position) -> Self {
        Self { start, end }
    }
}

/// VS Code Location (URI + Range)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    pub uri: String,
    pub range: Range,
}

/// VS Code Text Document
#[derive(Debug, Clone)]
pub struct TextDocument {
    pub uri: String,
    pub language_id: String,
    pub version: i32,
    pub content: String,
    pub is_dirty: bool,
    pub is_closed: bool,
    pub line_count: u32,
}

impl TextDocument {
    pub fn new(uri: &str, language_id: &str, content: &str) -> Self {
        Self {
            uri: uri.to_string(),
            language_id: language_id.to_string(),
            version: 1,
            content: content.to_string(),
            is_dirty: false,
            is_closed: false,
            line_count: content.lines().count() as u32,
        }
    }

    pub fn get_text(&self, range: Option<Range>) -> String {
        if let Some(r) = range {
            // Extract text in range
            let lines: Vec<&str> = self.content.lines().collect();
            let start_line = r.start.line as usize;
            let end_line = r.end.line as usize;
            
            if start_line < lines.len() && end_line < lines.len() {
                if start_line == end_line {
                    let line = lines[start_line];
                    let start_char = r.start.character as usize;
                    let end_char = r.end.character as usize;
                    line.chars().skip(start_char).take(end_char - start_char).collect()
                } else {
                    // Multi-line range
                    let mut result = String::new();
                    for i in start_line..=end_line.min(lines.len() - 1) {
                        if i == start_line {
                            result.push_str(&lines[i][r.start.character as usize..]);
                        } else if i == end_line {
                            result.push_str(&lines[i][..r.end.character as usize]);
                        } else {
                            result.push_str(lines[i]);
                        }
                        if i < end_line {
                            result.push('\n');
                        }
                    }
                    result
                }
            } else {
                String::new()
            }
        } else {
            self.content.clone()
        }
    }

    pub fn line_at(&self, line: u32) -> Option<TextLine> {
        let lines: Vec<&str> = self.content.lines().collect();
        if (line as usize) < lines.len() {
            Some(TextLine {
                line_number: line,
                text: lines[line as usize].to_string(),
                range: Range::new(
                    Position::new(line, 0),
                    Position::new(line, lines[line as usize].len() as u32),
                ),
            })
        } else {
            None
        }
    }
}

/// Text line representation
#[derive(Debug, Clone)]
pub struct TextLine {
    pub line_number: u32,
    pub text: String,
    pub range: Range,
}

/// VS Code Text Editor
#[derive(Debug, Clone)]
pub struct TextEditor {
    pub id: String,
    pub document: TextDocument,
    pub selection: Selection,
    pub visible_ranges: Vec<Range>,
    pub options: TextEditorOptions,
}

impl TextEditor {
    pub fn new(document: TextDocument) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            document,
            selection: Selection::default(),
            visible_ranges: vec![Range::new(Position::new(0, 0), Position::new(0, 0))],
            options: TextEditorOptions::default(),
        }
    }

    pub fn edit(&mut self, edits: Vec<TextEdit>) -> bool {
        // Apply edits to document
        for edit in edits {
            self.document.content = apply_edit(&self.document.content, &edit);
        }
        self.document.version += 1;
        self.document.is_dirty = true;
        true
    }
}

/// Text edit operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextEdit {
    pub range: Range,
    pub new_text: String,
}

/// Selection in editor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Selection {
    pub anchor: Position,
    pub active: Position,
    pub is_reversed: bool,
}

impl Default for Selection {
    fn default() -> Self {
        Self {
            anchor: Position::new(0, 0),
            active: Position::new(0, 0),
            is_reversed: false,
        }
    }
}

/// Text editor options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextEditorOptions {
    pub tab_size: u32,
    pub insert_spaces: bool,
    pub cursor_style: String,
    pub line_numbers: String,
    pub word_wrap: String,
}

impl Default for TextEditorOptions {
    fn default() -> Self {
        Self {
            tab_size: 4,
            insert_spaces: true,
            cursor_style: "line".to_string(),
            line_numbers: "on".to_string(),
            word_wrap: "off".to_string(),
        }
    }
}

/// Apply a text edit to content
fn apply_edit(content: &str, edit: &TextEdit) -> String {
    let lines: Vec<&str> = content.lines().collect();
    let mut result = String::new();
    
    for (i, line) in lines.iter().enumerate() {
        if i < edit.range.start.line as usize {
            result.push_str(line);
            result.push('\n');
        } else if i == edit.range.start.line as usize {
            // Insert new text at position
            result.push_str(&line[..edit.range.start.character as usize]);
            result.push_str(&edit.new_text);
            if i == edit.range.end.line as usize {
                result.push_str(&line[edit.range.end.character as usize..]);
            }
            result.push('\n');
        } else if i > edit.range.end.line as usize {
            result.push_str(line);
            result.push('\n');
        }
    }
    
    result
}

/// VS Code Diagnostic (error/warning/info)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnostic {
    pub range: Range,
    pub message: String,
    pub severity: DiagnosticSeverity,
    pub source: Option<String>,
    pub code: Option<String>,
    pub related_information: Vec<DiagnosticRelatedInformation>,
}

/// Diagnostic severity levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum DiagnosticSeverity {
    Error = 0,
    Warning = 1,
    Information = 2,
    Hint = 3,
}

/// Related diagnostic information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticRelatedInformation {
    pub location: Location,
    pub message: String,
}

/// VS Code Command
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Command {
    pub title: String,
    pub command: String,
    pub arguments: Vec<serde_json::Value>,
}

impl Command {
    pub fn new(title: &str, command: &str) -> Self {
        Self {
            title: title.to_string(),
            command: command.to_string(),
            arguments: Vec::new(),
        }
    }
}

/// VS Code Symbol Information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymbolInformation {
    pub name: String,
    pub kind: SymbolKind,
    pub location: Location,
    pub container_name: Option<String>,
}

/// Symbol kinds
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SymbolKind {
    File = 0,
    Module = 1,
    Namespace = 2,
    Package = 3,
    Class = 4,
    Method = 5,
    Property = 6,
    Field = 7,
    Constructor = 8,
    Enum = 9,
    Interface = 10,
    Function = 11,
    Variable = 12,
    Constant = 13,
    String = 14,
    Number = 15,
    Boolean = 16,
    Array = 17,
    Object = 18,
    Key = 19,
    Null = 20,
    EnumMember = 21,
    Struct = 22,
    Event = 23,
    Operator = 24,
    TypeParameter = 25,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extension_context() {
        let ctx = ExtensionContext::new("test.ext", "/path/to/ext");
        assert_eq!(ctx.extension_id, "test.ext");
    }

    #[test]
    fn test_text_document() {
        let doc = TextDocument::new("file:///test.rs", "rust", "fn main() {}");
        assert_eq!(doc.language_id, "rust");
        assert_eq!(doc.line_count, 1);
    }

    #[test]
    fn test_position_and_range() {
        let start = Position::new(0, 5);
        let end = Position::new(2, 10);
        let range = Range::new(start.clone(), end.clone());
        
        assert_eq!(range.start, start);
        assert_eq!(range.end, end);
    }

    #[test]
    fn test_diagnostic() {
        let diag = Diagnostic {
            range: Range::new(Position::new(0, 0), Position::new(0, 5)),
            message: "Test error".to_string(),
            severity: DiagnosticSeverity::Error,
            source: Some("test".to_string()),
            code: Some("E001".to_string()),
            related_information: vec![],
        };
        
        assert_eq!(diag.severity, DiagnosticSeverity::Error);
    }
}
