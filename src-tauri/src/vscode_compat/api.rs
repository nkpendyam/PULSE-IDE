//! VS Code Namespace API Shim
//!
//! Implements the `vscode` namespace that extensions expect.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// VS Code API namespace
pub struct VsCodeApi {
    pub window: WindowApi,
    pub workspace: WorkspaceApi,
    pub commands: CommandsApi,
    pub languages: LanguagesApi,
    pub env: EnvApi,
    pub extensions: ExtensionsApi,
}

/// Window API (vscode.window)
#[derive(Debug, Clone)]
pub struct WindowApi {
    /// Active text editor
    pub active_text_editor: Option<TextEditor>,
    /// Visible text editors
    pub visible_text_editors: Vec<TextEditor>,
    /// Active terminal
    pub active_terminal: Option<Terminal>,
    /// Terminals
    pub terminals: Vec<Terminal>,
    /// State
    state: WindowState,
}

#[derive(Debug, Clone, Default)]
pub struct WindowState {
    active_editor_id: Option<String>,
    visible_editor_ids: Vec<String>,
    message_items: Vec<MessageItem>,
}

/// Text editor representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextEditor {
    pub id: String,
    pub document: TextDocument,
    pub selection: Selection,
    pub selections: Vec<Selection>,
    pub visible_ranges: Vec<Range>,
    pub options: TextEditorOptions,
    pub view_column: Option<ViewColumn>,
}

/// Text document representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextDocument {
    pub uri: String,
    pub file_name: String,
    pub is_untitled: bool,
    pub language_id: String,
    pub version: i32,
    pub is_dirty: bool,
    pub is_closed: bool,
    pub eol: EndOfLine,
    pub line_count: u32,
    #[serde(skip)]
    content: String,
}

/// Selection in editor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Selection {
    pub anchor: Position,
    pub active: Position,
    pub start: Position,
    pub end: Position,
    pub is_empty: bool,
    pub is_single_line: bool,
}

/// Position in document
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Position {
    pub line: u32,
    pub character: u32,
}

/// Range in document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Range {
    pub start: Position,
    pub end: Position,
    pub is_empty: bool,
    pub is_single_line: bool,
}

/// Text editor options
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TextEditorOptions {
    pub tab_size: Option<u32>,
    pub insert_spaces: Option<bool>,
    pub cursor_style: Option<CursorStyle>,
    pub line_numbers: Option<LineNumbers>,
    pub word_wrap: Option<String>,
    pub minimap: Option<MinimapOptions>,
    pub render_whitespace: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CursorStyle {
    Line,
    Block,
    Underline,
    LineThin,
    BlockOutline,
    UnderlineThin,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LineNumbers {
    On,
    Off,
    Relative,
    Interval,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinimapOptions {
    pub enabled: Option<bool>,
    pub scale: Option<u32>,
    pub show_slider: Option<String>,
}

/// View column
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ViewColumn {
    Active = -1,
    Beside = -2,
    One = 1,
    Two = 2,
    Three = 3,
    Four = 4,
    Five = 5,
    Six = 6,
    Seven = 7,
    Eight = 8,
    Nine = 9,
}

/// End of line sequence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EndOfLine {
    LF = 1,
    CRLF = 2,
}

/// Terminal representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Terminal {
    pub id: String,
    pub name: String,
    pub exit_status: Option<TerminalExitStatus>,
    pub creation_options: Option<TerminalOptions>,
}

/// Terminal exit status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalExitStatus {
    pub code: Option<i32>,
}

/// Terminal options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalOptions {
    pub name: Option<String>,
    pub shell_path: Option<String>,
    pub shell_args: Option<Vec<String>>,
    pub cwd: Option<String>,
    pub env: Option<HashMap<String, String>>,
}

/// Message item for showInformationMessage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageItem {
    pub title: String,
    #[serde(default)]
    pub is_close_affordance: bool,
}

/// Input box options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InputBoxOptions {
    pub value: Option<String>,
    pub value_selection: Option<[u32; 2]>,
    pub prompt: Option<String>,
    pub place_holder: Option<String>,
    pub password: Option<bool>,
    pub ignore_focus_out: Option<bool>,
    pub validate_input: Option<String>, // Would be function in JS
}

/// Quick pick options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickPickOptions<T> {
    pub items: Vec<T>,
    pub place_holder: Option<String>,
    pub can_pick_many: Option<bool>,
    pub ignore_focus_out: Option<bool>,
    pub match_on_description: Option<bool>,
    pub match_on_detail: Option<bool>,
}

/// Quick pick item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickPickItem {
    pub label: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub detail: Option<String>,
    #[serde(default)]
    pub picked: bool,
    #[serde(default)]
    pub always_show: bool,
}

impl WindowApi {
    /// Show information message
    pub fn show_information_message(&self, message: &str, items: Vec<MessageItem>) -> Option<MessageItem> {
        log::info!("VSCode API: showInformationMessage: {}", message);
        // Would show UI and wait for user response
        items.first().cloned()
    }
    
    /// Show warning message
    pub fn show_warning_message(&self, message: &str, items: Vec<MessageItem>) -> Option<MessageItem> {
        log::warn!("VSCode API: showWarningMessage: {}", message);
        items.first().cloned()
    }
    
    /// Show error message
    pub fn show_error_message(&self, message: &str, items: Vec<MessageItem>) -> Option<MessageItem> {
        log::error!("VSCode API: showErrorMessage: {}", message);
        items.first().cloned()
    }
    
    /// Show input box
    pub fn show_input_box(&self, options: InputBoxOptions) -> Option<String> {
        log::info!("VSCode API: showInputBox: {:?}", options.prompt);
        options.value
    }
    
    /// Show quick pick
    pub fn show_quick_pick(&self, items: Vec<QuickPickItem>, _options: QuickPickOptions<QuickPickItem>) -> Option<QuickPickItem> {
        items.first().cloned()
    }
    
    /// Create terminal
    pub fn create_terminal(&self, options: TerminalOptions) -> Terminal {
        Terminal {
            id: uuid::Uuid::new_v4().to_string(),
            name: options.name.unwrap_or_else(|| "Terminal".to_string()),
            exit_status: None,
            creation_options: Some(options),
        }
    }
    
    /// Get active text editor
    pub fn active_text_editor(&self) -> Option<&TextEditor> {
        self.active_text_editor.as_ref()
    }
    
    /// Show text document
    pub fn show_text_document(&mut self, document: TextDocument, column: ViewColumn) -> TextEditor {
        let editor = TextEditor {
            id: uuid::Uuid::new_v4().to_string(),
            document,
            selection: Selection::default(),
            selections: vec![Selection::default()],
            visible_ranges: vec![],
            options: TextEditorOptions::default(),
            view_column: Some(column),
        };
        
        self.active_text_editor = Some(editor.clone());
        editor
    }
}

impl Default for WindowApi {
    fn default() -> Self {
        Self {
            active_text_editor: None,
            visible_text_editors: Vec::new(),
            active_terminal: None,
            terminals: Vec::new(),
            state: WindowState::default(),
        }
    }
}

impl Default for Selection {
    fn default() -> Self {
        Self {
            anchor: Position::default(),
            active: Position::default(),
            start: Position::default(),
            end: Position::default(),
            is_empty: true,
            is_single_line: true,
        }
    }
}

impl Range {
    pub fn new(start: Position, end: Position) -> Self {
        Self {
            is_empty: start == end,
            is_single_line: start.line == end.line,
            start,
            end,
        }
    }
}

/// Workspace API (vscode.workspace)
#[derive(Debug, Clone)]
pub struct WorkspaceApi {
    pub root_path: Option<String>,
    pub workspace_folders: Option<Vec<WorkspaceFolder>>,
    pub name: Option<String>,
    pub workspace_file: Option<String>,
    state: WorkspaceState,
}

#[derive(Debug, Clone, Default)]
pub struct WorkspaceState {
    configuration: HashMap<String, serde_json::Value>,
    text_documents: Vec<TextDocument>,
}

/// Workspace folder
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceFolder {
    pub uri: String,
    pub name: String,
    pub index: u32,
}

/// Workspace configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceConfiguration {
    section: String,
    values: HashMap<String, serde_json::Value>,
}

/// Text document content event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextDocumentContentChangeEvent {
    pub range: Option<Range>,
    pub range_length: Option<u32>,
    pub text: String,
}

/// File system watcher
#[derive(Debug, Clone)]
pub struct FileSystemWatcher {
    pub id: String,
    pub pattern: String,
    pub ignore_create_events: bool,
    pub ignore_change_events: bool,
    pub ignore_delete_events: bool,
}

/// File stat
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileStat {
    #[serde(rename = "type")]
    pub file_type: FileType,
    pub ctime: u64,
    pub mtime: u64,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FileType {
    Unknown = 0,
    File = 1,
    Directory = 2,
    SymbolicLink = 64,
}

impl WorkspaceApi {
    /// Get configuration
    pub fn get_configuration(&self, section: Option<&str>) -> WorkspaceConfiguration {
        let section = section.unwrap_or("");
        let values = self.state.configuration.iter()
            .filter(|(k, _)| k.starts_with(section))
            .map(|(k, v)| (k.trim_start_matches(&format!("{}.", section)).to_string(), v.clone()))
            .collect();
        
        WorkspaceConfiguration {
            section: section.to_string(),
            values,
        }
    }
    
    /// Get workspace folders
    pub fn workspace_folders(&self) -> Option<&[WorkspaceFolder]> {
        self.workspace_folders.as_deref()
    }
    
    /// Get text documents
    pub fn text_documents(&self) -> &[TextDocument] {
        &self.state.text_documents
    }
    
    /// Open text document
    pub fn open_text_document(&self, uri: &str) -> Result<TextDocument, String> {
        Ok(TextDocument {
            uri: uri.to_string(),
            file_name: uri.trim_start_matches("file://").to_string(),
            is_untitled: false,
            language_id: "plaintext".to_string(),
            version: 1,
            is_dirty: false,
            is_closed: false,
            eol: EndOfLine::LF,
            line_count: 0,
            content: String::new(),
        })
    }
    
    /// Create file system watcher
    pub fn create_file_system_watcher(&self, pattern: &str) -> FileSystemWatcher {
        FileSystemWatcher {
            id: uuid::Uuid::new_v4().to_string(),
            pattern: pattern.to_string(),
            ignore_create_events: false,
            ignore_change_events: false,
            ignore_delete_events: false,
        }
    }
    
    /// Find files
    pub fn find_files(&self, include: &str, exclude: Option<&str>, max_results: Option<u32>) -> Vec<String> {
        // Would actually search file system
        log::info!("VSCode API: findFiles: include={}, exclude={:?}", include, exclude);
        Vec::new()
    }
    
    /// Save all
    pub fn save_all(&self, include_untitled: bool) -> bool {
        log::info!("VSCode API: saveAll: include_untitled={}", include_untitled);
        true
    }
}

impl Default for WorkspaceApi {
    fn default() -> Self {
        Self {
            root_path: None,
            workspace_folders: None,
            name: None,
            workspace_file: None,
            state: WorkspaceState::default(),
        }
    }
}

/// Commands API (vscode.commands)
#[derive(Debug, Clone)]
pub struct CommandsApi {
    state: CommandsState,
}

#[derive(Debug, Clone, Default)]
pub struct CommandsState {
    registered_commands: HashMap<String, CommandHandler>,
    next_id: u32,
}

#[derive(Debug, Clone)]
pub struct CommandHandler {
    pub id: u32,
    pub extension_id: String,
}

impl CommandsApi {
    /// Register command
    pub fn register_command(&mut self, extension_id: &str, command: &str) -> u32 {
        let id = self.state.next_id;
        self.state.next_id += 1;
        
        self.state.registered_commands.insert(command.to_string(), CommandHandler {
            id,
            extension_id: extension_id.to_string(),
        });
        
        log::info!("VSCode API: registerCommand: {} (id={})", command, id);
        id
    }
    
    /// Execute command
    pub fn execute_command(&self, command: &str, args: Vec<serde_json::Value>) -> Result<serde_json::Value, String> {
        log::info!("VSCode API: executeCommand: {} with {} args", command, args.len());
        
        if self.state.registered_commands.contains_key(command) {
            Ok(serde_json::json!(null))
        } else {
            Err(format!("Command not found: {}", command))
        }
    }
    
    /// Get commands
    pub fn get_commands(&self, filter_internal: bool) -> Vec<String> {
        self.state.registered_commands.keys().cloned().collect()
    }
}

impl Default for CommandsApi {
    fn default() -> Self {
        Self {
            state: CommandsState::default(),
        }
    }
}

/// Languages API (vscode.languages)
#[derive(Debug, Clone)]
pub struct LanguagesApi {
    state: LanguagesState,
}

#[derive(Debug, Clone, Default)]
pub struct LanguagesState {
    languages: HashMap<String, LanguageInfo>,
    document_selectors: Vec<DocumentSelector>,
}

#[derive(Debug, Clone)]
pub struct LanguageInfo {
    pub id: String,
    pub extensions: Vec<String>,
    pub aliases: Vec<String>,
}

pub type DocumentSelector = Vec<DocumentFilter>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentFilter {
    pub language: Option<String>,
    pub scheme: Option<String>,
    pub pattern: Option<String>,
}

/// Completion item (for language contributions)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VsCompletionItem {
    pub label: String,
    pub kind: Option<CompletionItemKind>,
    pub detail: Option<String>,
    pub documentation: Option<String>,
    pub insert_text: Option<String>,
    pub sort_text: Option<String>,
    pub filter_text: Option<String>,
    pub preselect: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CompletionItemKind {
    Text = 0,
    Method = 1,
    Function = 2,
    Constructor = 3,
    Field = 4,
    Variable = 5,
    Class = 6,
    Interface = 7,
    Module = 8,
    Property = 9,
    Enum = 10,
    Keyword = 11,
    Snippet = 12,
    File = 13,
    Folder = 14,
    EnumMember = 15,
    Constant = 16,
    Struct = 17,
    Event = 18,
    Operator = 19,
    TypeParameter = 20,
}

impl LanguagesApi {
    /// Get languages
    pub fn get_languages(&self) -> Vec<String> {
        self.state.languages.keys().cloned().collect()
    }
    
    /// Register completion item provider
    pub fn register_completion_item_provider(
        &mut self,
        selector: DocumentSelector,
        provider_id: &str,
        trigger_characters: Vec<String>,
    ) -> u32 {
        log::info!("VSCode API: registerCompletionItemProvider: {:?}", selector);
        // Would register the provider
        rand::random::<u32>()
    }
    
    /// Register hover provider
    pub fn register_hover_provider(&mut self, selector: DocumentSelector, provider_id: &str) -> u32 {
        log::info!("VSCode API: registerHoverProvider: {:?}", selector);
        rand::random::<u32>()
    }
    
    /// Register definition provider
    pub fn register_definition_provider(&mut self, selector: DocumentSelector, provider_id: &str) -> u32 {
        log::info!("VSCode API: registerDefinitionProvider: {:?}", selector);
        rand::random::<u32>()
    }
    
    /// Register document symbol provider
    pub fn register_document_symbol_provider(&mut self, selector: DocumentSelector, provider_id: &str) -> u32 {
        log::info!("VSCode API: registerDocumentSymbolProvider: {:?}", selector);
        rand::random::<u32>()
    }
    
    /// Register code actions provider
    pub fn register_code_actions_provider(&mut self, selector: DocumentSelector, provider_id: &str) -> u32 {
        log::info!("VSCode API: registerCodeActionsProvider: {:?}", selector);
        rand::random::<u32>()
    }
    
    /// Set language configuration
    pub fn set_language_configuration(&mut self, language_id: &str, config: LanguageConfiguration) {
        log::info!("VSCode API: setLanguageConfiguration: {}", language_id);
        self.state.languages.insert(language_id.to_string(), LanguageInfo {
            id: language_id.to_string(),
            extensions: config.extensions,
            aliases: config.aliases,
        });
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageConfiguration {
    pub comments: CommentRule,
    pub brackets: Vec<[String; 2]>,
    pub auto_closing_pairs: Vec<AutoClosingPair>,
    pub surrounding_pairs: Vec<AutoClosingPair>,
    pub colorized_bracket_pairs: Option<Vec<[String; 2]>>,
    pub word_pattern: Option<String>,
    pub indentation_rules: Option<IndentationRules>,
    pub on_enter_rules: Option<Vec<OnEnterRule>>,
    pub extensions: Vec<String>,
    pub aliases: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommentRule {
    pub line_comment: Option<String>,
    pub block_comment: Option<[String; 2]>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoClosingPair {
    pub open: String,
    pub close: String,
    #[serde(default)]
    pub not_in: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndentationRules {
    pub increase_indent_pattern: String,
    pub decrease_indent_pattern: String,
    #[serde(default)]
    pub indent_next_line_pattern: Option<String>,
    #[serde(default)]
    pub unIndented_line_pattern: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OnEnterRule {
    pub before_text: String,
    #[serde(default)]
    pub after_text: Option<String>,
    pub action: EnterAction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnterAction {
    pub indent: IndentAction,
    #[serde(default)]
    pub append_text: Option<String>,
    #[serde(default)]
    pub remove_text: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IndentAction {
    None = 0,
    Indent = 1,
    IndentOutdent = 2,
    Outdent = 3,
}

impl Default for LanguagesApi {
    fn default() -> Self {
        Self {
            state: LanguagesState::default(),
        }
    }
}

/// Environment API (vscode.env)
#[derive(Debug, Clone)]
pub struct EnvApi {
    pub app_name: String,
    pub app_root: String,
    pub language: String,
    pub machine_id: String,
    pub session_id: String,
    pub shell: String,
    pub uri_scheme: String,
}

impl Default for EnvApi {
    fn default() -> Self {
        Self {
            app_name: "Kyro IDE".to_string(),
            app_root: "/".to_string(),
            language: "en".to_string(),
            machine_id: uuid::Uuid::new_v4().to_string(),
            session_id: uuid::Uuid::new_v4().to_string(),
            shell: "/bin/sh".to_string(),
            uri_scheme: "kyro".to_string(),
        }
    }
}

/// Extensions API (vscode.extensions)
#[derive(Debug, Clone)]
pub struct ExtensionsApi {
    pub all: Vec<Extension>,
}

/// Extension representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Extension {
    pub id: String,
    pub extension_uri: String,
    pub extension_path: String,
    pub isActive: bool,
    pub package_json: serde_json::Value,
}

impl Default for ExtensionsApi {
    fn default() -> Self {
        Self {
            all: Vec::new(),
        }
    }
}

impl VsCodeApi {
    pub fn new() -> Self {
        Self {
            window: WindowApi::default(),
            workspace: WorkspaceApi::default(),
            commands: CommandsApi::default(),
            languages: LanguagesApi::default(),
            env: EnvApi::default(),
            extensions: ExtensionsApi::default(),
        }
    }
}

impl Default for VsCodeApi {
    fn default() -> Self {
        Self::new()
    }
}
