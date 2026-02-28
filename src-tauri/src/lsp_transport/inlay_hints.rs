//! Inlay Hints Implementation
//!
//! Inlay hints show additional information inline in the editor.
//! Based on: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_inlayHint

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Inlay hint kinds
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum InlayHintKind {
    Type = 1,
    Parameter = 2,
}

/// Inlay hint label part
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InlayHintLabelPart {
    pub value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<Location>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<Command>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tooltip: Option<InlayHintTooltip>,
}

/// Inlay hint tooltip
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum InlayHintTooltip {
    String(String),
    Markup(MarkupContent),
}

/// Markup content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarkupContent {
    pub kind: String,
    pub value: String,
}

/// Location
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    pub uri: String,
    pub range: Range,
}

/// Range
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Range {
    pub start: Position,
    pub end: Position,
}

/// Position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub line: u32,
    pub character: u32,
}

/// Command
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Command {
    pub title: String,
    pub command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arguments: Option<Vec<Value>>,
}

/// Text edit for inlay hint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextEdit {
    pub range: Range,
    pub new_text: String,
}

/// Inlay Hint from LSP
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InlayHint {
    pub position: Position,
    pub label: InlayHintLabel,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<InlayHintKind>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_edits: Option<Vec<TextEdit>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tooltip: Option<InlayHintTooltip>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub padding_left: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub padding_right: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

/// Inlay hint label
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum InlayHintLabel {
    String(String),
    Parts(Vec<InlayHintLabelPart>),
}

/// Decoded inlay hint for rendering
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecodedInlayHint {
    pub line: u32,
    pub character: u32,
    pub text: String,
    pub kind: String,
    pub tooltip: Option<String>,
    pub padding_left: bool,
    pub padding_right: bool,
    pub is_type_hint: bool,
    pub is_parameter_hint: bool,
}

/// Parse inlay hints from LSP response
pub fn parse_inlay_hints(value: &Value) -> Vec<DecodedInlayHint> {
    let hints = value.as_array().cloned().unwrap_or_default();
    
    hints.iter().filter_map(|hint| {
        let position = hint.get("position")?;
        let line = position.get("line")?.as_u64()? as u32;
        let character = position.get("character")?.as_u64()? as u32;
        
        let label = hint.get("label")?;
        let text = match label {
            Value::String(s) => s.clone(),
            Value::Array(parts) => {
                parts.iter()
                    .filter_map(|p| p.get("value")?.as_str())
                    .collect::<Vec<_>>()
                    .join("")
            }
            _ => return None,
        };
        
        let kind = hint.get("kind").and_then(|k| k.as_u64()).unwrap_or(0);
        let kind_str = match kind {
            1 => "type",
            2 => "parameter",
            _ => "other",
        };
        
        let tooltip = hint.get("tooltip").and_then(|t| match t {
            Value::String(s) => Some(s.clone()),
            Value::Object(obj) => obj.get("value")?.as_str().map(|s| s.to_string()),
            _ => None,
        });
        
        let padding_left = hint.get("paddingLeft").and_then(|p| p.as_bool()).unwrap_or(false);
        let padding_right = hint.get("paddingRight").and_then(|p| p.as_bool()).unwrap_or(false);
        
        Some(DecodedInlayHint {
            line,
            character,
            text,
            kind: kind_str.to_string(),
            tooltip,
            padding_left,
            padding_right,
            is_type_hint: kind == 1,
            is_parameter_hint: kind == 2,
        })
    }).collect()
}

/// Inlay hint configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InlayHintConfig {
    pub enable_type_hints: bool,
    pub enable_parameter_hints: bool,
    pub enable_implicit_types: bool,
    pub show_variable_types: bool,
    pub show_parameter_names: bool,
    pub max_length: Option<u32>,
}

impl Default for InlayHintConfig {
    fn default() -> Self {
        Self {
            enable_type_hints: true,
            enable_parameter_hints: true,
            enable_implicit_types: true,
            show_variable_types: true,
            show_parameter_names: true,
            max_length: Some(50),
        }
    }
}

/// Filter inlay hints based on configuration
pub fn filter_inlay_hints(hints: Vec<DecodedInlayHint>, config: &InlayHintConfig) -> Vec<DecodedInlayHint> {
    hints.into_iter().filter(|hint| {
        if hint.is_type_hint && !config.enable_type_hints {
            return false;
        }
        if hint.is_parameter_hint && !config.enable_parameter_hints {
            return false;
        }
        true
    }).collect()
}

/// Generate CSS for inlay hints
pub fn generate_inlay_hint_css() -> String {
    r#"
.inlay-hint {
    display: inline;
    font-family: monospace;
    font-size: 0.9em;
    border-radius: 3px;
    padding: 0 2px;
    margin: 0 1px;
    cursor: pointer;
}

.inlay-hint-type {
    background-color: rgba(78, 201, 176, 0.15);
    color: #4ec9b0;
    border: 1px solid rgba(78, 201, 176, 0.3);
}

.inlay-hint-parameter {
    background-color: rgba(156, 220, 254, 0.15);
    color: #9cdcfe;
    border: 1px solid rgba(156, 220, 254, 0.3);
}

.inlay-hint:hover {
    background-color: rgba(255, 255, 255, 0.1);
}

.inlay-hint-tooltip {
    position: absolute;
    background: #1e1e1e;
    border: 1px solid #454545;
    border-radius: 4px;
    padding: 8px 12px;
    font-size: 12px;
    color: #d4d4d4;
    max-width: 400px;
    z-index: 1000;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}
"#.to_string()
}
