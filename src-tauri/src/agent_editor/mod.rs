//! MCP Agent Editor - Autonomous File Editing
//!
//! The "Aha!" Moment: You type "Fix the bug in auth.rs" and the agent:
//! 1. Opens the file
//! 2. Reads and understands it
//! 3. Writes the fix
//! 4. Asks you to approve the change
//!
//! Uses MCP (Model Context Protocol) for tool calling.

pub mod agent;
pub mod tools;
pub mod approval;
pub mod executor;
pub mod planner;

pub use agent::MCPAgent;
pub use tools::{AgentTools, FileEdit, EditOperation};
pub use approval::{ApprovalWorkflow, PendingEdit, ApprovalStatus};
pub use executor::EditExecutor;
pub use planner::EditPlanner;

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Agent configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    /// Enable autonomous editing
    pub enable_autonomous: bool,
    /// Require approval for all edits
    pub require_approval: bool,
    /// Maximum edits per request
    pub max_edits_per_request: usize,
    /// Enable rollback
    pub enable_rollback: bool,
    /// Show diff before applying
    pub show_diff: bool,
    /// Auto-save before edits
    pub auto_save_before_edit: bool,
    /// Maximum file size to edit (bytes)
    pub max_file_size: u64,
    /// Allowed file patterns
    pub allowed_patterns: Vec<String>,
    /// Blocked file patterns
    pub blocked_patterns: Vec<String>,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            enable_autonomous: true,
            require_approval: true,
            max_edits_per_request: 10,
            enable_rollback: true,
            show_diff: true,
            auto_save_before_edit: true,
            max_file_size: 1_000_000, // 1MB
            allowed_patterns: vec![
                "**/*.rs".to_string(),
                "**/*.py".to_string(),
                "**/*.js".to_string(),
                "**/*.ts".to_string(),
                "**/*.go".to_string(),
                "**/*.java".to_string(),
                "**/*.cpp".to_string(),
                "**/*.c".to_string(),
                "**/*.json".to_string(),
                "**/*.yaml".to_string(),
                "**/*.yml".to_string(),
                "**/*.md".to_string(),
                "**/*.txt".to_string(),
            ],
            blocked_patterns: vec![
                "**/.git/**".to_string(),
                "**/node_modules/**".to_string(),
                "**/target/**".to_string(),
                "**/*.env*".to_string(),
                "**/secrets/**".to_string(),
            ],
        }
    }
}

/// Agent action
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentAction {
    pub id: String,
    pub action_type: ActionType,
    pub description: String,
    pub target_file: Option<String>,
    pub edits: Vec<EditOperation>,
    pub confidence: f32,
    pub reasoning: String,
}

/// Action types the agent can perform
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ActionType {
    /// Read a file
    ReadFile,
    /// Write to a file
    WriteFile,
    /// Edit specific lines
    EditLines,
    /// Create a new file
    CreateFile,
    /// Delete a file
    DeleteFile,
    /// Rename/move a file
    RenameFile,
    /// Run a command
    RunCommand,
    /// Search code
    SearchCode,
    /// Open a file in editor
    OpenFile,
}

/// Agent result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentResult {
    pub success: bool,
    pub action: AgentAction,
    pub message: String,
    pub files_changed: Vec<String>,
    pub requires_approval: bool,
    pub approval_id: Option<String>,
}

/// Agent conversation context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentContext {
    /// Current project path
    pub project_path: PathBuf,
    /// Currently open files
    pub open_files: Vec<PathBuf>,
    /// Current file being edited
    pub current_file: Option<PathBuf>,
    /// Selection in current file
    pub selection: Option<Selection>,
    /// Recent actions in this session
    pub recent_actions: Vec<AgentAction>,
}

impl Default for AgentContext {
    fn default() -> Self {
        Self {
            project_path: PathBuf::new(),
            open_files: Vec::new(),
            current_file: None,
            selection: None,
            recent_actions: Vec::new(),
        }
    }
}

/// Text selection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Selection {
    pub start_line: usize,
    pub start_col: usize,
    pub end_line: usize,
    pub end_col: usize,
    pub text: String,
}

/// Agent execution plan
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionPlan {
    pub actions: Vec<AgentAction>,
    pub estimated_time_ms: u64,
    pub requires_approval: bool,
    pub risk_level: RiskLevel,
}

/// Risk level for operations
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}
