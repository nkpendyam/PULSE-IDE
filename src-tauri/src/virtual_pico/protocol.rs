//! PICO Protocol definitions
//!
//! Message types for communication between IDE and mobile devices

use serde::{Deserialize, Serialize};
use super::{PicoDevice, SensorData};
use super::gesture_recognizer::SensorReading;

/// Messages exchanged between IDE and PICO devices
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PicoMessage {
    /// Register a new device
    Register { device: PicoDevice },
    
    /// Unregister a device
    Unregister { device_id: String },
    
    /// Heartbeat to keep connection alive
    Heartbeat,
    
    /// Sensor data from device
    SensorData(SensorData),
    
    /// Gesture detected on device
    Gesture(GestureData),
    
    /// Command from device
    Command(PicoCommand),
    
    /// Response to command
    Response { 
        request_id: String, 
        success: bool, 
        data: Option<String> 
    },
    
    /// Code mirror update
    CodeMirror {
        file_path: String,
        content: String,
        cursor_position: (u32, u32),
    },
    
    /// Request for code completion
    CompletionRequest {
        file_path: String,
        line: u32,
        column: u32,
        prefix: String,
    },
    
    /// Completion response
    CompletionResponse {
        completions: Vec<Completion>,
    },
    
    /// File operation
    FileOperation {
        operation: FileOp,
    },
    
    /// Haptic feedback request
    Haptic {
        pattern: String,
        intensity: Option<f32>,
    },
}

/// Gesture data from device
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GestureData {
    pub gesture_type: String,
    pub confidence: f32,
    pub timestamp: u64,
    pub sensor_data: Option<Vec<SensorReading>>,
}

/// Commands that can be sent from PICO device
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PicoCommand {
    /// Open a file
    OpenFile { path: String },
    
    /// Save current file
    SaveFile,
    
    /// Run code
    RunCode { code: Option<String> },
    
    /// Stop execution
    StopExecution,
    
    /// Navigate in editor
    Navigate { direction: String },
    
    /// Scroll in editor
    Scroll { direction: String, amount: u32 },
    
    /// Undo last action
    Undo,
    
    /// Redo last action
    Redo,
    
    /// Copy selection
    Copy,
    
    /// Paste from clipboard
    Paste,
    
    /// Voice command
    VoiceCommand { text: String },
    
    /// Request code completion
    RequestCompletion,
    
    /// Execute terminal command
    TerminalCommand { command: String },
    
    /// AI chat message
    AiChat { message: String },
    
    /// Format code
    FormatCode,
    
    /// Toggle comment
    ToggleComment,
    
    /// Find in file
    Find { query: String },
    
    /// Replace in file
    Replace { find: String, replace: String },
    
    /// Go to line
    GoToLine { line: u32 },
    
    /// Set breakpoint
    SetBreakpoint { line: u32 },
    
    /// Continue debugging
    DebugContinue,
    
    /// Step over
    DebugStepOver,
    
    /// Step into
    DebugStepInto,
}

/// File operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FileOp {
    Create { path: String },
    Delete { path: String },
    Rename { old_path: String, new_path: String },
    Read { path: String },
    Write { path: String, content: String },
}

/// Code completion item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Completion {
    pub text: String,
    pub display_text: String,
    pub kind: CompletionKind,
    pub documentation: Option<String>,
}

/// Kind of completion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CompletionKind {
    Function,
    Method,
    Class,
    Struct,
    Enum,
    Variable,
    Constant,
    Keyword,
    Snippet,
    File,
    Folder,
}

/// IDE state to sync with device
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdeState {
    pub open_files: Vec<String>,
    pub active_file: Option<String>,
    pub cursor_position: Option<(u32, u32)>,
    pub terminal_output: Option<String>,
    pub ai_chat_history: Vec<ChatMessage>,
}

/// Chat message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    pub timestamp: u64,
}

/// Device queue for offline support
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceQueue {
    pub device_id: String,
    pub commands: Vec<QueuedCommand>,
    pub last_sync: u64,
}

/// Queued command for offline support
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueuedCommand {
    pub id: String,
    pub command: PicoCommand,
    pub timestamp: u64,
    pub status: CommandStatus,
}

/// Status of queued command
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CommandStatus {
    Pending,
    Sent,
    Acknowledged,
    Failed,
}

impl PicoMessage {
    /// Serialize message to JSON
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }

    /// Deserialize message from JSON
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }

    /// Serialize message to binary
    pub fn to_bytes(&self) -> Result<Vec<u8>, serde_json::Error> {
        serde_json::to_vec(self)
    }

    /// Deserialize message from binary
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, serde_json::Error> {
        serde_json::from_slice(bytes)
    }
}
