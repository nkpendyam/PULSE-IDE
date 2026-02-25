//! Semantic Tokens Implementation
//!
//! Semantic highlighting using LSP semantic tokens protocol.
//! Based on: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_semanticTokens

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

/// Semantic token types as defined by LSP
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum SemanticTokenType {
    Namespace = 0,
    Type = 1,
    Class = 2,
    Enum = 3,
    Interface = 4,
    Struct = 5,
    TypeParameter = 6,
    Parameter = 7,
    Variable = 8,
    Property = 9,
    EnumMember = 10,
    Event = 11,
    Function = 12,
    Method = 13,
    Macro = 14,
    Keyword = 15,
    Modifier = 16,
    Comment = 17,
    String = 18,
    Number = 19,
    Regexp = 20,
    Operator = 21,
    Decorator = 22,
    Label = 23,
    // Custom token types can be added beyond this
}

impl SemanticTokenType {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "namespace" => Some(Self::Namespace),
            "type" => Some(Self::Type),
            "class" => Some(Self::Class),
            "enum" => Some(Self::Enum),
            "interface" => Some(Self::Interface),
            "struct" => Some(Self::Struct),
            "typeParameter" => Some(Self::TypeParameter),
            "parameter" => Some(Self::Parameter),
            "variable" => Some(Self::Variable),
            "property" => Some(Self::Property),
            "enumMember" => Some(Self::EnumMember),
            "event" => Some(Self::Event),
            "function" => Some(Self::Function),
            "method" => Some(Self::Method),
            "macro" => Some(Self::Macro),
            "keyword" => Some(Self::Keyword),
            "modifier" => Some(Self::Modifier),
            "comment" => Some(Self::Comment),
            "string" => Some(Self::String),
            "number" => Some(Self::Number),
            "regexp" => Some(Self::Regexp),
            "operator" => Some(Self::Operator),
            "decorator" => Some(Self::Decorator),
            "label" => Some(Self::Label),
            _ => None,
        }
    }
    
    pub fn to_css_class(self) -> &'static str {
        match self {
            Self::Namespace => "semantic-namespace",
            Self::Type => "semantic-type",
            Self::Class => "semantic-class",
            Self::Enum => "semantic-enum",
            Self::Interface => "semantic-interface",
            Self::Struct => "semantic-struct",
            Self::TypeParameter => "semantic-type-parameter",
            Self::Parameter => "semantic-parameter",
            Self::Variable => "semantic-variable",
            Self::Property => "semantic-property",
            Self::EnumMember => "semantic-enum-member",
            Self::Event => "semantic-event",
            Self::Function => "semantic-function",
            Self::Method => "semantic-method",
            Self::Macro => "semantic-macro",
            Self::Keyword => "semantic-keyword",
            Self::Modifier => "semantic-modifier",
            Self::Comment => "semantic-comment",
            Self::String => "semantic-string",
            Self::Number => "semantic-number",
            Self::Regexp => "semantic-regexp",
            Self::Operator => "semantic-operator",
            Self::Decorator => "semantic-decorator",
            Self::Label => "semantic-label",
        }
    }
}

/// Semantic token modifiers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum SemanticTokenModifier {
    Declaration = 0,
    Definition = 1,
    Readonly = 2,
    Static = 3,
    Deprecated = 4,
    Abstract = 5,
    Async = 6,
    Modification = 7,
    Documentation = 8,
    DefaultLibrary = 9,
}

impl SemanticTokenModifier {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "declaration" => Some(Self::Declaration),
            "definition" => Some(Self::Definition),
            "readonly" => Some(Self::Readonly),
            "static" => Some(Self::Static),
            "deprecated" => Some(Self::Deprecated),
            "abstract" => Some(Self::Abstract),
            "async" => Some(Self::Async),
            "modification" => Some(Self::Modification),
            "documentation" => Some(Self::Documentation),
            "defaultLibrary" => Some(Self::DefaultLibrary),
            _ => None,
        }
    }
}

/// A semantic token with absolute position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanticToken {
    pub line: u32,
    pub column: u32,
    pub length: u32,
    pub token_type: String,
    pub modifiers: Vec<String>,
}

/// Decoded semantic tokens
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanticTokensResult {
    pub result_id: Option<String>,
    pub tokens: Vec<SemanticToken>,
}

/// Semantic tokens legend - maps token types and modifiers to indices
#[derive(Debug, Clone, Default)]
pub struct SemanticTokensLegend {
    pub token_types: Vec<String>,
    pub token_modifiers: Vec<String>,
}

impl SemanticTokensLegend {
    pub fn new(token_types: Vec<String>, token_modifiers: Vec<String>) -> Self {
        Self { token_types, token_modifiers }
    }
    
    pub fn get_token_type(&self, index: u32) -> Option<&str> {
        self.token_types.get(index as usize).map(|s| s.as_str())
    }
    
    pub fn get_token_modifiers(&self, modifier_bits: u32) -> Vec<String> {
        let mut modifiers = Vec::new();
        for i in 0..self.token_modifiers.len() {
            if (modifier_bits & (1 << i)) != 0 {
                modifiers.push(self.token_modifiers[i].clone());
            }
        }
        modifiers
    }
}

/// Decode semantic tokens from LSP response
/// The LSP encodes tokens as a flat array of 5 integers per token:
/// [delta_line, delta_start, length, token_type, token_modifiers]
pub fn decode_semantic_tokens(data: &Value, legend: &SemanticTokensLegend) -> SemanticTokensResult {
    let result_id = data.get("resultId").and_then(|v| v.as_str()).map(|s| s.to_string());
    
    let data_array = data.get("data")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_u64() as Option<u32>).collect::<Vec<_>>())
        .unwrap_or_default();
    
    let mut tokens = Vec::new();
    let mut line = 0u32;
    let mut column = 0u32;
    
    for chunk in data_array.chunks(5) {
        if chunk.len() < 5 {
            continue;
        }
        
        let delta_line = chunk[0];
        let delta_start = chunk[1];
        let length = chunk[2];
        let token_type_idx = chunk[3];
        let token_modifiers = chunk[4];
        
        // Apply deltas
        if delta_line > 0 {
            line += delta_line;
            column = delta_start;
        } else {
            column += delta_start;
        }
        
        let token_type = legend.get_token_type(token_type_idx)
            .unwrap_or("unknown")
            .to_string();
        
        let modifiers = legend.get_token_modifiers(token_modifiers);
        
        tokens.push(SemanticToken {
            line,
            column,
            length,
            token_type,
            modifiers,
        });
    }
    
    SemanticTokensResult { result_id, tokens }
}

/// Default semantic tokens legend
pub fn default_legend() -> SemanticTokensLegend {
    SemanticTokensLegend::new(
        vec![
            "namespace".to_string(),
            "type".to_string(),
            "class".to_string(),
            "enum".to_string(),
            "interface".to_string(),
            "struct".to_string(),
            "typeParameter".to_string(),
            "parameter".to_string(),
            "variable".to_string(),
            "property".to_string(),
            "enumMember".to_string(),
            "event".to_string(),
            "function".to_string(),
            "method".to_string(),
            "macro".to_string(),
            "keyword".to_string(),
            "modifier".to_string(),
            "comment".to_string(),
            "string".to_string(),
            "number".to_string(),
            "regexp".to_string(),
            "operator".to_string(),
        ],
        vec![
            "declaration".to_string(),
            "definition".to_string(),
            "readonly".to_string(),
            "static".to_string(),
            "deprecated".to_string(),
            "abstract".to_string(),
            "async".to_string(),
            "modification".to_string(),
            "documentation".to_string(),
            "defaultLibrary".to_string(),
        ],
    )
}

/// Generate CSS for semantic highlighting
pub fn generate_semantic_css() -> String {
    let styles = [
        (SemanticTokenType::Namespace, "#8567b0"),
        (SemanticTokenType::Type, "#4ec9b0"),
        (SemanticTokenType::Class, "#4ec9b0"),
        (SemanticTokenType::Enum, "#4ec9b0"),
        (SemanticTokenType::Interface, "#4ec9b0"),
        (SemanticTokenType::Struct, "#4ec9b0"),
        (SemanticTokenType::TypeParameter, "#4ec9b0"),
        (SemanticTokenType::Parameter, "#9cdcfe"),
        (SemanticTokenType::Variable, "#9cdcfe"),
        (SemanticTokenType::Property, "#9cdcfe"),
        (SemanticTokenType::EnumMember, "#4fc1ff"),
        (SemanticTokenType::Event, "#ffc300"),
        (SemanticTokenType::Function, "#dcdcaa"),
        (SemanticTokenType::Method, "#dcdcaa"),
        (SemanticTokenType::Macro, "#dcdcaa"),
        (SemanticTokenType::Keyword, "#569cd6"),
        (SemanticTokenType::Modifier, "#569cd6"),
        (SemanticTokenType::Comment, "#6a9955"),
        (SemanticTokenType::String, "#ce9178"),
        (SemanticTokenType::Number, "#b5cea8"),
        (SemanticTokenType::Regexp, "#d16969"),
        (SemanticTokenType::Operator, "#d4d4d4"),
        (SemanticTokenType::Decorator, "#dcdcaa"),
        (SemanticTokenType::Label, "#c8c8c8"),
    ];
    
    let mut css = String::new();
    for (token_type, color) in styles {
        css.push_str(&format!(
            ".{} {{ color: {}; }}\n",
            token_type.to_css_class(),
            color
        ));
    }
    
    // Add modifier styles
    css.push_str(".semantic-deprecated { text-decoration: line-through; }\n");
    css.push_str(".semantic-readonly { font-style: italic; }\n");
    css.push_str(".semantic-static { font-weight: bold; }\n");
    css.push_str(".semantic-definition { font-weight: bold; }\n");
    
    css
}
