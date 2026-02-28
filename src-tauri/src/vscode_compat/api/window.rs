//! VS Code Window API
//! Implements vscode.window namespace

use serde::{Deserialize, Serialize};

/// Status bar item alignment
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum StatusBarAlignment { Left, Right }

/// Status bar item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusBarItem {
    pub text: String,
    pub tooltip: Option<String>,
    pub alignment: StatusBarAlignment,
    pub priority: i32,
    pub command: Option<String>,
}

/// Show information message
pub fn show_information_message(message: &str) -> String {
    message.to_string()
}

/// Show warning message
pub fn show_warning_message(message: &str) -> String {
    message.to_string()
}

/// Show error message
pub fn show_error_message(message: &str) -> String {
    message.to_string()
}
