//! Code Lens Implementation
//!
//! Code Lens provides actionable, contextual information interspersed in the code.
//! Based on: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_codeLens

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Code Lens from LSP
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeLens {
    pub range: Range,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<Command>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
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

/// Decoded code lens for rendering
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecodedCodeLens {
    pub line: u32,
    pub start_character: u32,
    pub end_character: u32,
    pub title: String,
    pub command: Option<String>,
    pub arguments: Option<Vec<Value>>,
    pub is_resolved: bool,
    pub lens_type: CodeLensType,
}

/// Types of code lenses
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CodeLensType {
    References,
    Implementations,
    Test,
    Run,
    Debug,
    GitBlame,
    Todo,
    Custom,
}

impl CodeLensType {
    pub fn from_command(command: &str) -> Self {
        match command {
            "editor.action.findReferences" | "references" => CodeLensType::References,
            "editor.action.goToImplementation" | "implementations" => CodeLensType::Implementations,
            "test.run" | "runTest" => CodeLensType::Test,
            "run" | "execute" => CodeLensType::Run,
            "debug" | "test.debug" => CodeLensType::Debug,
            "git.blame" => CodeLensType::GitBlame,
            "todo" => CodeLensType::Todo,
            _ => CodeLensType::Custom,
        }
    }
    
    pub fn icon(&self) -> &'static str {
        match self {
            CodeLensType::References => "🔗",
            CodeLensType::Implementations => "↘",
            CodeLensType::Test => "🧪",
            CodeLensType::Run => "▶",
            CodeLensType::Debug => "🐛",
            CodeLensType::GitBlame => "📝",
            CodeLensType::Todo => "☑",
            CodeLensType::Custom => "•",
        }
    }
    
    pub fn css_class(&self) -> &'static str {
        match self {
            CodeLensType::References => "codelens-references",
            CodeLensType::Implementations => "codelens-implementations",
            CodeLensType::Test => "codelens-test",
            CodeLensType::Run => "codelens-run",
            CodeLensType::Debug => "codelens-debug",
            CodeLensType::GitBlame => "codelens-git",
            CodeLensType::Todo => "codelens-todo",
            CodeLensType::Custom => "codelens-custom",
        }
    }
}

/// Parse code lenses from LSP response
pub fn parse_code_lenses(value: &Value) -> Vec<DecodedCodeLens> {
    let lenses = value.as_array().cloned().unwrap_or_default();
    
    lenses.iter().filter_map(|lens| {
        let range = lens.get("range")?;
        let start = range.get("start")?;
        let end = range.get("end")?;
        
        let line = start.get("line")?.as_u64()? as u32;
        let start_character = start.get("character")?.as_u64()? as u32;
        let end_character = end.get("character")?.as_u64()? as u32;
        
        let command = lens.get("command");
        let title = command.and_then(|c| c.get("title")?.as_str())
            .unwrap_or("...")
            .to_string();
        
        let cmd_name = command.and_then(|c| c.get("command")?.as_str()).map(|s| s.to_string());
        let arguments = command.and_then(|c| c.get("arguments").cloned());
        
        let is_resolved = command.is_some();
        let lens_type = cmd_name.as_ref()
            .map(|c| CodeLensType::from_command(c))
            .unwrap_or(CodeLensType::Custom);
        
        Some(DecodedCodeLens {
            line,
            start_character,
            end_character,
            title,
            command: cmd_name,
            arguments,
            is_resolved,
            lens_type,
        })
    }).collect()
}

/// Code Lens configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeLensConfig {
    pub enable: bool,
    pub enable_references: bool,
    pub enable_implementations: bool,
    pub enable_tests: bool,
    pub enable_run: bool,
    pub enable_debug: bool,
    pub show_on_hover_only: bool,
    pub position: CodeLensPosition,
}

impl Default for CodeLensConfig {
    fn default() -> Self {
        Self {
            enable: true,
            enable_references: true,
            enable_implementations: true,
            enable_tests: true,
            enable_run: true,
            enable_debug: true,
            show_on_hover_only: false,
            position: CodeLensPosition::EndOfLine,
        }
    }
}

/// Code lens display position
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum CodeLensPosition {
    #[default]
    EndOfLine,
    AboveLine,
    Inline,
}

/// Filter code lenses based on configuration
pub fn filter_code_lenses(lenses: Vec<DecodedCodeLens>, config: &CodeLensConfig) -> Vec<DecodedCodeLens> {
    if !config.enable {
        return vec![];
    }
    
    lenses.into_iter().filter(|lens| {
        match lens.lens_type {
            CodeLensType::References => config.enable_references,
            CodeLensType::Implementations => config.enable_implementations,
            CodeLensType::Test => config.enable_tests,
            CodeLensType::Run => config.enable_run,
            CodeLensType::Debug => config.enable_debug,
            _ => true,
        }
    }).collect()
}

/// Generate CSS for code lenses
pub fn generate_code_lens_css() -> String {
    r#"
.code-lens {
    display: inline-block;
    font-size: 0.85em;
    color: #9cdcfe;
    opacity: 0.7;
    cursor: pointer;
    padding: 0 4px;
    border-radius: 3px;
    transition: opacity 0.15s, background-color 0.15s;
    font-family: monospace;
    user-select: none;
}

.code-lens:hover {
    opacity: 1;
    background-color: rgba(156, 220, 254, 0.1);
}

.code-lens:active {
    background-color: rgba(156, 220, 254, 0.2);
}

.code-lens-icon {
    margin-right: 4px;
    font-size: 0.9em;
}

.code-lens-above {
    display: block;
    margin-left: 0;
    margin-bottom: 2px;
}

.code-lens-references { color: #4ec9b0; }
.code-lens-implementations { color: #dcdcaa; }
.code-lens-test { color: #4fc1ff; }
.code-lens-run { color: #89d185; }
.code-lens-debug { color: #f4a261; }
.code-lens-git { color: #d4d4d4; font-style: italic; }
.code-lens-todo { color: #ffc300; }
.code-lens-custom { color: #c8c8c8; }
"#.to_string()
}

/// Generate reference count text
pub fn format_reference_count(count: u32) -> String {
    if count == 0 {
        return "No references".to_string();
    }
    if count == 1 {
        return "1 reference".to_string();
    }
    format!("{} references", count)
}

/// Generate implementation count text
pub fn format_implementation_count(count: u32) -> String {
    if count == 0 {
        return "No implementations".to_string();
    }
    if count == 1 {
        return "1 implementation".to_string();
    }
    format!("{} implementations", count)
}
