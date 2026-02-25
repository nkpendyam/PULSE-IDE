//! Extension Protocol
//!
//! JSON-RPC protocol for communication with extension host processes.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// JSON-RPC request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: Option<RequestId>,
    pub method: String,
    #[serde(default)]
    pub params: Option<Params>,
}

/// JSON-RPC response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: RequestId,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

/// JSON-RPC error
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

/// Request ID type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum RequestId {
    Number(i64),
    String(String),
}

/// Parameters type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Params {
    Array(Vec<serde_json::Value>),
    Object(HashMap<String, serde_json::Value>),
}

/// Extension protocol message types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum ExtensionProtocolMessage {
    /// Initialize extension
    Initialize(InitializeParams),
    /// Ready notification
    Ready,
    /// API call from extension
    ApiCall(ApiCallParams),
    /// API result to extension
    ApiResult(ApiResultParams),
    /// Event from IDE
    Event(EventParams),
    /// Log message
    Log(LogParams),
    /// Error
    Error(ErrorParams),
}

/// Initialize parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitializeParams {
    pub extension_id: String,
    pub extension_path: String,
    pub global_storage_path: String,
    pub workspace_path: Option<String>,
    pub locale: String,
    pub ui_kind: UiKind,
    pub capabilities: ClientCapabilities,
}

/// UI kind
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UiKind {
    Desktop,
    Web,
}

/// Client capabilities
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ClientCapabilities {
    pub workspace: WorkspaceCapabilities,
    pub text_document: TextDocumentCapabilities,
    pub window: WindowCapabilities,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WorkspaceCapabilities {
    pub workspace_folders: bool,
    pub configuration: bool,
    pub file_watcher: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TextDocumentCapabilities {
    pub completion: CompletionCapabilities,
    pub hover: bool,
    pub definition: bool,
    pub references: bool,
    pub document_symbol: bool,
    pub code_action: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CompletionCapabilities {
    pub completion_item: CompletionItemCapabilities,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CompletionItemCapabilities {
    pub snippet_support: bool,
    pub commit_characters_support: bool,
    pub documentation_format: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WindowCapabilities {
    pub show_message: bool,
    pub show_input_box: bool,
    pub show_quick_pick: bool,
    pub create_terminal: bool,
}

/// API call parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiCallParams {
    pub call_id: u32,
    pub api: String,
    pub method: String,
    pub args: Vec<serde_json::Value>,
}

/// API result parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResultParams {
    pub call_id: u32,
    pub result: serde_json::Value,
}

/// Event parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventParams {
    pub event: String,
    pub data: serde_json::Value,
}

/// Log parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogParams {
    pub level: LogLevel,
    pub message: String,
}

/// Log level
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LogLevel {
    Trace,
    Debug,
    Info,
    Warning,
    Error,
    Critical,
}

/// Error parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorParams {
    pub code: i32,
    pub message: String,
    pub stack: Option<String>,
}

/// API methods for extension protocol
pub enum ApiMethod {
    // Window API
    WindowShowMessage,
    WindowShowErrorMessage,
    WindowShowWarningMessage,
    WindowShowInputBox,
    WindowShowQuickPick,
    WindowCreateTerminal,
    WindowCreateOutputChannel,
    WindowSetStatusBarMessage,
    
    // Workspace API
    WorkspaceGetConfiguration,
    WorkspaceGetWorkspaceFolders,
    WorkspaceOpenTextDocument,
    WorkspaceSaveAll,
    WorkspaceFindFiles,
    WorkspaceCreateFileSystemWatcher,
    
    // Commands API
    CommandsRegisterCommand,
    CommandsExecuteCommand,
    CommandsGetCommands,
    
    // Languages API
    LanguagesRegisterCompletionItemProvider,
    LanguagesRegisterHoverProvider,
    LanguagesRegisterDefinitionProvider,
    LanguagesRegisterDocumentSymbolProvider,
    LanguagesRegisterCodeActionsProvider,
    
    // Debug API
    DebugStartDebugging,
    DebugRegisterDebugConfigurationProvider,
}

impl ApiMethod {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "window.showInformationMessage" => Some(Self::WindowShowMessage),
            "window.showErrorMessage" => Some(Self::WindowShowErrorMessage),
            "window.showWarningMessage" => Some(Self::WindowShowWarningMessage),
            "window.showInputBox" => Some(Self::WindowShowInputBox),
            "window.showQuickPick" => Some(Self::WindowShowQuickPick),
            "window.createTerminal" => Some(Self::WindowCreateTerminal),
            "window.createOutputChannel" => Some(Self::WindowCreateOutputChannel),
            "window.setStatusBarMessage" => Some(Self::WindowSetStatusBarMessage),
            
            "workspace.getConfiguration" => Some(Self::WorkspaceGetConfiguration),
            "workspace.workspaceFolders" => Some(Self::WorkspaceGetWorkspaceFolders),
            "workspace.openTextDocument" => Some(Self::WorkspaceOpenTextDocument),
            "workspace.saveAll" => Some(Self::WorkspaceSaveAll),
            "workspace.findFiles" => Some(Self::WorkspaceFindFiles),
            "workspace.createFileSystemWatcher" => Some(Self::WorkspaceCreateFileSystemWatcher),
            
            "commands.registerCommand" => Some(Self::CommandsRegisterCommand),
            "commands.executeCommand" => Some(Self::CommandsExecuteCommand),
            "commands.getCommands" => Some(Self::CommandsGetCommands),
            
            "languages.registerCompletionItemProvider" => Some(Self::LanguagesRegisterCompletionItemProvider),
            "languages.registerHoverProvider" => Some(Self::LanguagesRegisterHoverProvider),
            "languages.registerDefinitionProvider" => Some(Self::LanguagesRegisterDefinitionProvider),
            "languages.registerDocumentSymbolProvider" => Some(Self::LanguagesRegisterDocumentSymbolProvider),
            "languages.registerCodeActionsProvider" => Some(Self::LanguagesRegisterCodeActionsProvider),
            
            "debug.startDebugging" => Some(Self::DebugStartDebugging),
            "debug.registerDebugConfigurationProvider" => Some(Self::DebugRegisterDebugConfigurationProvider),
            
            _ => None,
        }
    }
    
    pub fn to_str(&self) -> &'static str {
        match self {
            Self::WindowShowMessage => "window.showInformationMessage",
            Self::WindowShowErrorMessage => "window.showErrorMessage",
            Self::WindowShowWarningMessage => "window.showWarningMessage",
            Self::WindowShowInputBox => "window.showInputBox",
            Self::WindowShowQuickPick => "window.showQuickPick",
            Self::WindowCreateTerminal => "window.createTerminal",
            Self::WindowCreateOutputChannel => "window.createOutputChannel",
            Self::WindowSetStatusBarMessage => "window.setStatusBarMessage",
            
            Self::WorkspaceGetConfiguration => "workspace.getConfiguration",
            Self::WorkspaceGetWorkspaceFolders => "workspace.workspaceFolders",
            Self::WorkspaceOpenTextDocument => "workspace.openTextDocument",
            Self::WorkspaceSaveAll => "workspace.saveAll",
            Self::WorkspaceFindFiles => "workspace.findFiles",
            Self::WorkspaceCreateFileSystemWatcher => "workspace.createFileSystemWatcher",
            
            Self::CommandsRegisterCommand => "commands.registerCommand",
            Self::CommandsExecuteCommand => "commands.executeCommand",
            Self::CommandsGetCommands => "commands.getCommands",
            
            Self::LanguagesRegisterCompletionItemProvider => "languages.registerCompletionItemProvider",
            Self::LanguagesRegisterHoverProvider => "languages.registerHoverProvider",
            Self::LanguagesRegisterDefinitionProvider => "languages.registerDefinitionProvider",
            Self::LanguagesRegisterDocumentSymbolProvider => "languages.registerDocumentSymbolProvider",
            Self::LanguagesRegisterCodeActionsProvider => "languages.registerCodeActionsProvider",
            
            Self::DebugStartDebugging => "debug.startDebugging",
            Self::DebugRegisterDebugConfigurationProvider => "debug.registerDebugConfigurationProvider",
        }
    }
}

/// Extension protocol handler
pub struct ExtensionProtocol;

impl ExtensionProtocol {
    /// Create initialize request
    pub fn create_initialize(params: InitializeParams) -> JsonRpcRequest {
        JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: Some(RequestId::Number(1)),
            method: "initialize".to_string(),
            params: Some(Params::Object(serde_json::to_value(params)
                .unwrap_or_default()
                .as_object()
                .cloned()
                .unwrap_or_default())),
        }
    }
    
    /// Create initialized notification
    pub fn create_initialized() -> JsonRpcRequest {
        JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: None,
            method: "initialized".to_string(),
            params: None,
        }
    }
    
    /// Create shutdown request
    pub fn create_shutdown() -> JsonRpcRequest {
        JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: Some(RequestId::Number(2)),
            method: "shutdown".to_string(),
            params: None,
        }
    }
    
    /// Create exit notification
    pub fn create_exit() -> JsonRpcRequest {
        JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: None,
            method: "exit".to_string(),
            params: None,
        }
    }
    
    /// Create API call
    pub fn create_api_call(call_id: u32, api: &str, method: &str, args: Vec<serde_json::Value>) -> JsonRpcRequest {
        JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: Some(RequestId::Number(call_id as i64)),
            method: format!("api/{}/{}", api, method),
            params: Some(Params::Array(args)),
        }
    }
    
    /// Create event notification
    pub fn create_event(event: &str, data: serde_json::Value) -> JsonRpcRequest {
        JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: None,
            method: format!("event/{}", event),
            params: Some(Params::Object(
                serde_json::to_value(data)
                    .unwrap_or_default()
                    .as_object()
                    .cloned()
                    .unwrap_or_default()
            )),
        }
    }
    
    /// Parse response
    pub fn parse_response(data: &str) -> Result<JsonRpcResponse, serde_json::Error> {
        serde_json::from_str(data)
    }
    
    /// Parse notification
    pub fn parse_notification(data: &str) -> Result<JsonRpcRequest, serde_json::Error> {
        serde_json::from_str(data)
    }
}

/// Standard JSON-RPC error codes
pub mod error_codes {
    pub const PARSE_ERROR: i32 = -32700;
    pub const INVALID_REQUEST: i32 = -32600;
    pub const METHOD_NOT_FOUND: i32 = -32601;
    pub const INVALID_PARAMS: i32 = -32602;
    pub const INTERNAL_ERROR: i32 = -32603;
    
    // Extension-specific errors
    pub const EXTENSION_NOT_FOUND: i32 = -40001;
    pub const EXTENSION_NOT_ACTIVE: i32 = -40002;
    pub const EXTENSION_ACTIVATION_FAILED: i32 = -40003;
    pub const API_NOT_AVAILABLE: i32 = -40004;
    pub const PERMISSION_DENIED: i32 = -40005;
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_create_initialize() {
        let params = InitializeParams {
            extension_id: "test.extension".to_string(),
            extension_path: "/path/to/extension".to_string(),
            global_storage_path: "/path/to/storage".to_string(),
            workspace_path: None,
            locale: "en".to_string(),
            ui_kind: UiKind::Desktop,
            capabilities: ClientCapabilities::default(),
        };
        
        let request = ExtensionProtocol::create_initialize(params);
        assert_eq!(request.method, "initialize");
        assert!(request.params.is_some());
    }
    
    #[test]
    fn test_parse_response() {
        let json = r#"{"jsonrpc":"2.0","id":1,"result":{"success":true}}"#;
        let response = ExtensionProtocol::parse_response(json).unwrap();
        assert_eq!(response.jsonrpc, "2.0");
        assert!(response.result.is_some());
    }
    
    #[test]
    fn test_api_method_conversion() {
        assert_eq!(
            ApiMethod::from_str("window.showInformationMessage"),
            Some(ApiMethod::WindowShowMessage)
        );
        assert_eq!(
            ApiMethod::WindowShowMessage.to_str(),
            "window.showInformationMessage"
        );
    }
}
