//! VS Code Extension API Compatibility Layer
//!
//! Provides VS Code-like extension API for compatibility with existing extensions

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Extension context passed to activate/deactivate
pub struct ExtensionContext {
    /// Extension path
    pub extension_path: String,
    /// Global storage path
    pub global_storage_path: String,
    /// Workspace storage path
    pub workspace_storage_path: Option<String>,
    /// Subscriptions (disposables)
    pub subscriptions: Vec<Box<dyn std::any::Any + Send + Sync>>,
    /// Extension manifest
    pub extension: ExtensionManifest,
}

/// Extension manifest (package.json)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionManifest {
    /// Extension name
    pub name: String,
    /// Publisher
    pub publisher: String,
    /// Version
    pub version: String,
    /// Display name
    #[serde(rename = "displayName")]
    pub display_name: String,
    /// Description
    pub description: Option<String>,
    /// Main entry point
    pub main: Option<String>,
    /// Browser entry point (for web extensions)
    pub browser: Option<String>,
    /// Activation events
    #[serde(rename = "activationEvents")]
    pub activation_events: Option<Vec<String>>,
    /// Contributed configuration
    pub contributes: Option<ExtensionContributes>,
    /// Extension dependencies
    #[serde(rename = "extensionDependencies")]
    pub extension_dependencies: Option<Vec<String>>,
    /// Engine version
    #[serde(rename = "engines")]
    pub engines: Option<HashMap<String, String>>,
}

/// Extension contributions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionContributes {
    /// Commands
    pub commands: Option<Vec<CommandContribution>>,
    /// Languages
    pub languages: Option<Vec<LanguageContribution>>,
    /// Themes
    pub themes: Option<Vec<ThemeContribution>>,
    /// Keybindings
    pub keybindings: Option<Vec<KeybindingContribution>>,
    /// Configuration
    pub configuration: Option<serde_json::Value>,
    /// Grammars
    pub grammars: Option<Vec<GrammarContribution>>,
}

/// Command contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandContribution {
    /// Command ID
    pub command: String,
    /// Display title
    pub title: String,
    /// Category
    pub category: Option<String>,
    /// Icon
    pub icon: Option<String>,
}

/// Language contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageContribution {
    /// Language ID
    pub id: String,
    /// File extensions
    pub extensions: Option<Vec<String>>,
    /// File name patterns
    pub filenames: Option<Vec<String>>,
    /// File name patterns (glob)
    pub filename_patterns: Option<Vec<String>>,
    /// Aliases
    pub aliases: Option<Vec<String>>,
    /// First line pattern
    pub first_line: Option<String>,
}

/// Theme contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeContribution {
    /// Theme label
    pub label: String,
    /// Theme ID
    pub id: Option<String>,
    /// Path to theme file
    pub path: String,
    /// UI theme (vs, vs-dark, hc-black)
    pub ui_theme: Option<String>,
}

/// Keybinding contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeybindingContribution {
    /// Command ID
    pub command: String,
    /// Key combination
    pub key: String,
    /// Mac key combination
    pub mac: Option<String>,
    /// When clause
    pub when: Option<String>,
}

/// Grammar contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrammarContribution {
    /// Language ID
    pub language: String,
    /// Scope name
    #[serde(rename = "scopeName")]
    pub scope_name: String,
    /// Path to grammar file
    pub path: String,
}

/// VS Code Extension API (subset)
pub struct ExtensionApi {
    /// Window API
    pub window: WindowApi,
    /// Workspace API
    pub workspace: WorkspaceApi,
    /// Commands API
    pub commands: CommandsApi,
    /// Languages API
    pub languages: LanguagesApi,
}

/// Window API
pub struct WindowApi {
    _private: (),
}

impl WindowApi {
    pub fn new() -> Self {
        Self { _private: () }
    }
    
    /// Show information message
    pub async fn show_information_message(&self, _message: &str) -> Option<String> {
        // Would show UI notification
        None
    }
    
    /// Show error message
    pub async fn show_error_message(&self, _message: &str) -> Option<String> {
        // Would show UI error notification
        None
    }
    
    /// Show input box
    pub async fn show_input_box(&self, _options: InputBoxOptions) -> Option<String> {
        // Would show input dialog
        None
    }
    
    /// Show quick pick
    pub async fn show_quick_pick(&self, _items: Vec<String>, _options: QuickPickOptions) -> Option<String> {
        // Would show quick pick dialog
        None
    }
}

/// Input box options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InputBoxOptions {
    pub prompt: Option<String>,
    pub place_holder: Option<String>,
    pub value: Option<String>,
    pub password: Option<bool>,
}

/// Quick pick options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickPickOptions {
    pub place_holder: Option<String>,
    pub can_pick_many: Option<bool>,
}

/// Workspace API
pub struct WorkspaceApi {
    _private: (),
}

impl WorkspaceApi {
    pub fn new() -> Self {
        Self { _private: () }
    }
    
    /// Get workspace folders
    pub fn workspace_folders(&self) -> Vec<WorkspaceFolder> {
        vec![]
    }
    
    /// Get workspace root
    pub fn root_path(&self) -> Option<String> {
        None
    }
    
    /// Get configuration
    pub fn get_configuration(&self, _section: &str) -> Configuration {
        Configuration::new()
    }
    
    /// Open text document
    pub async fn open_text_document(&self, _path: &str) -> Option<TextDocument> {
        None
    }
}

/// Workspace folder
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceFolder {
    /// Folder URI
    pub uri: String,
    /// Folder name
    pub name: String,
}

/// Configuration
pub struct Configuration {
    values: HashMap<String, serde_json::Value>,
}

impl Configuration {
    pub fn new() -> Self {
        Self {
            values: HashMap::new(),
        }
    }
    
    /// Get configuration value
    pub fn get<T: serde::de::DeserializeOwned>(&self, key: &str) -> Option<T> {
        self.values.get(key).and_then(|v| serde_json::from_value(v.clone()).ok())
    }
    
    /// Update configuration value
    pub fn update(&mut self, key: &str, value: serde_json::Value) {
        self.values.insert(key.to_string(), value);
    }
}

impl Default for Configuration {
    fn default() -> Self {
        Self::new()
    }
}

/// Text document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextDocument {
    /// Document URI
    pub uri: String,
    /// Language ID
    pub language_id: String,
    /// Document content
    pub text: String,
    /// Line count
    pub line_count: u32,
}

/// Commands API
pub struct CommandsApi {
    commands: HashMap<String, Box<dyn Fn() + Send + Sync>>,
}

impl CommandsApi {
    pub fn new() -> Self {
        Self {
            commands: HashMap::new(),
        }
    }
    
    /// Register command
    pub fn register_command(&mut self, id: &str, handler: Box<dyn Fn() + Send + Sync>) {
        self.commands.insert(id.to_string(), handler);
    }
    
    /// Execute command
    pub async fn execute_command(&self, id: &str) -> anyhow::Result<()> {
        if let Some(handler) = self.commands.get(id) {
            handler();
        }
        Ok(())
    }
}

impl Default for CommandsApi {
    fn default() -> Self {
        Self::new()
    }
}

/// Languages API
pub struct LanguagesApi {
    _private: (),
}

impl LanguagesApi {
    pub fn new() -> Self {
        Self { _private: () }
    }
    
    /// Get document selector
    pub fn get_languages(&self) -> Vec<String> {
        vec!["rust".to_string(), "typescript".to_string(), "javascript".to_string()]
    }
}

impl Default for ExtensionApi {
    fn default() -> Self {
        Self {
            window: WindowApi::new(),
            workspace: WorkspaceApi::new(),
            commands: CommandsApi::new(),
            languages: LanguagesApi::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_extension_api_creation() {
        let api = ExtensionApi::default();
        assert!(api.window.show_information_message("").await.is_none());
    }
    
    #[test]
    fn test_configuration() {
        let mut config = Configuration::new();
        config.update("test.key", serde_json::json!("value"));
        assert_eq!(config.get::<String>("test.key"), Some("value".to_string()));
    }
}
