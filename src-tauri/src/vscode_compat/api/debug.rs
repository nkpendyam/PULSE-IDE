//! VS Code Debug API
//! Implements vscode.debug namespace

use serde::{Deserialize, Serialize};

/// Debug configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugConfiguration {
    pub name: String,
    pub r#type: String,
    pub request: String,
    pub program: Option<String>,
    pub args: Vec<String>,
    pub cwd: Option<String>,
}

/// Breakpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Breakpoint {
    pub id: String,
    pub enabled: bool,
    pub condition: Option<String>,
}

/// Source breakpoint (file + line)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceBreakpoint {
    pub line: u32,
    pub column: Option<u32>,
    pub condition: Option<String>,
    pub log_message: Option<String>,
}
