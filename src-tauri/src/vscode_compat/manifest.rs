//! Extension Manifest Parser
//!
//! Parses and validates VS Code extension package.json files.

use anyhow::{Result, Context, bail};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

/// Extension manifest (package.json)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionManifest {
    /// Extension name
    pub name: String,
    /// Extension display name
    #[serde(default)]
    pub display_name: Option<String>,
    /// Extension version
    pub version: String,
    /// Extension publisher
    pub publisher: String,
    /// Extension description
    #[serde(default)]
    pub description: String,
    /// Extension identifier (computed: publisher.name)
    #[serde(skip)]
    pub identifier: ExtensionIdentifier,
    /// Main entry point
    #[serde(default = "default_main")]
    pub main: String,
    /// Browser entry point
    #[serde(default)]
    pub browser: Option<String>,
    /// Extension kind (ui, workspace, web)
    #[serde(default)]
    pub extension_kind: Option<Vec<ExtensionKind>>,
    /// Activation events
    #[serde(default)]
    pub activation_events: Vec<String>,
    /// Contributed commands
    #[serde(default)]
    pub contributes: Option<Contributes>,
    /// Supported engines
    pub engines: Engines,
    /// Categories
    #[serde(default)]
    pub categories: Vec<String>,
    /// Keywords
    #[serde(default)]
    pub keywords: Vec<String>,
    /// Extension icon
    #[serde(default)]
    pub icon: Option<String>,
    /// Repository
    #[serde(default)]
    pub repository: Option<Repository>,
    /// License
    #[serde(default)]
    pub license: Option<String>,
    /// Dependencies
    #[serde(default)]
    pub dependencies: HashMap<String, String>,
    /// Dev dependencies
    #[serde(default)]
    #[serde(rename = "devDependencies")]
    pub dev_dependencies: HashMap<String, String>,
    /// Extension capabilities
    #[serde(default)]
    pub capabilities: Option<Capabilities>,
    /// Enable proposed API
    #[serde(default)]
    #[serde(rename = "enableProposedApi")]
    pub enable_proposed_api: bool,
    /// Extension pack
    #[serde(default)]
    #[serde(rename = "extensionPack")]
    pub extension_pack: Vec<String>,
    /// Extension dependencies
    #[serde(default)]
    #[serde(rename = "extensionDependencies")]
    pub extension_dependencies: Vec<String>,
}

fn default_main() -> String {
    "./extension.js".to_string()
}

/// Extension identifier
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionIdentifier {
    pub id: String,
    pub publisher: String,
    pub name: String,
}

/// Extension kind
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ExtensionKind {
    UI,
    Workspace,
    Web,
}

impl Default for ExtensionKind {
    fn default() -> Self {
        Self::Workspace
    }
}

/// Engine requirements
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Engines {
    #[serde(rename = "vscode")]
    pub vscode: String,
}

impl Default for Engines {
    fn default() -> Self {
        Self {
            vscode: "^1.60.0".to_string(),
        }
    }
}

/// Repository information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Repository {
    #[serde(rename = "type")]
    pub repo_type: String,
    pub url: String,
}

/// Extension contributions
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Contributes {
    /// Commands
    #[serde(default)]
    pub commands: Vec<CommandContribution>,
    /// Menus
    #[serde(default)]
    pub menus: HashMap<String, Vec<MenuContribution>>,
    /// Keybindings
    #[serde(default)]
    pub keybindings: Vec<KeybindingContribution>,
    /// Languages
    #[serde(default)]
    pub languages: Vec<LanguageContribution>,
    /// Grammars
    #[serde(default)]
    pub grammars: Vec<GrammarContribution>,
    /// Snippets
    #[serde(default)]
    pub snippets: Vec<SnippetContribution>,
    /// Themes
    #[serde(default)]
    pub themes: Vec<ThemeContribution>,
    /// Icon themes
    #[serde(default)]
    #[serde(rename = "iconThemes")]
    pub icon_themes: Vec<IconThemeContribution>,
    /// Configurations
    #[serde(default)]
    pub configuration: Option<ConfigurationContribution>,
    /// Configuration defaults
    #[serde(default)]
    #[serde(rename = "configurationDefaults")]
    pub configuration_defaults: HashMap<String, serde_json::Value>,
    /// Views
    #[serde(default)]
    pub views: HashMap<String, Vec<ViewContribution>>,
    /// Views containers
    #[serde(default)]
    #[serde(rename = "viewsContainers")]
    pub views_containers: Option<ViewsContainers>,
    /// Problem matchers
    #[serde(default)]
    #[serde(rename = "problemMatchers")]
    pub problem_matchers: Vec<ProblemMatcherContribution>,
    /// Task definitions
    #[serde(default)]
    #[serde(rename = "taskDefinitions")]
    pub task_definitions: Vec<TaskDefinitionContribution>,
    /// Debuggers
    #[serde(default)]
    pub debuggers: Vec<DebuggerContribution>,
    /// Breakpoints
    #[serde(default)]
    pub breakpoints: Vec<BreakpointContribution>,
    /// Colors
    #[serde(default)]
    pub colors: Vec<ColorContribution>,
    /// TypeScript plugins
    #[serde(default)]
    #[serde(rename = "typescriptServerPlugins")]
    pub typescript_server_plugins: Vec<TypeScriptServerPlugin>,
    /// Resource label formatters
    #[serde(default)]
    #[serde(rename = "resourceLabelFormatters")]
    pub resource_label_formatters: Vec<ResourceLabelFormatter>,
}

/// Command contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandContribution {
    pub command: String,
    pub title: String,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub icon: Option<IconDefinition>,
    #[serde(default)]
    pub enablement: Option<String>,
    #[serde(default)]
    pub short_title: Option<String>,
}

/// Icon definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IconDefinition {
    #[serde(default)]
    pub light: Option<String>,
    #[serde(default)]
    pub dark: Option<String>,
    #[serde(default)]
    #[serde(rename = "iconPath")]
    pub icon_path: Option<String>,
}

/// Menu contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MenuContribution {
    pub command: String,
    #[serde(default)]
    pub group: Option<String>,
    #[serde(default)]
    pub when: Option<String>,
    #[serde(default)]
    pub alt: Option<String>,
}

/// Keybinding contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeybindingContribution {
    pub command: String,
    pub key: String,
    #[serde(default)]
    pub mac: Option<String>,
    #[serde(default)]
    pub linux: Option<String>,
    #[serde(default)]
    pub win: Option<String>,
    #[serde(default)]
    pub when: Option<String>,
    #[serde(default)]
    pub args: Option<serde_json::Value>,
}

/// Language contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageContribution {
    pub id: String,
    #[serde(default)]
    pub extensions: Vec<String>,
    #[serde(default)]
    pub aliases: Vec<String>,
    #[serde(default)]
    pub filenames: Vec<String>,
    #[serde(default)]
    #[serde(rename = "filenamePatterns")]
    pub filename_patterns: Vec<String>,
    #[serde(default)]
    #[serde(rename = "firstLine")]
    pub first_line: Option<String>,
    #[serde(default)]
    pub configuration: Option<String>,
    #[serde(default)]
    pub icon: Option<IconDefinition>,
}

/// Grammar contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrammarContribution {
    pub language: String,
    pub scope_name: String,
    pub path: String,
    #[serde(default)]
    #[serde(rename = "embeddedLanguages")]
    pub embedded_languages: HashMap<String, String>,
    #[serde(default)]
    #[serde(rename = "tokenTypes")]
    pub token_types: HashMap<String, String>,
}

/// Snippet contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnippetContribution {
    pub language: String,
    pub path: String,
}

/// Theme contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeContribution {
    pub label: String,
    #[serde(rename = "uiTheme")]
    pub ui_theme: String,
    pub path: String,
}

/// Icon theme contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IconThemeContribution {
    pub id: String,
    pub label: String,
    pub path: String,
}

/// Configuration contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigurationContribution {
    #[serde(default)]
    pub title: Option<String>,
    pub properties: HashMap<String, ConfigurationProperty>,
}

/// Configuration property
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigurationProperty {
    #[serde(rename = "type")]
    pub prop_type: String,
    #[serde(default)]
    pub default: Option<serde_json::Value>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    #[serde(rename = "enum")]
    pub enum_values: Option<Vec<serde_json::Value>>,
    #[serde(default)]
    #[serde(rename = "enumDescriptions")]
    pub enum_descriptions: Option<Vec<String>>,
    #[serde(default)]
    #[serde(rename = "deprecationMessage")]
    pub deprecation_message: Option<String>,
}

/// View contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewContribution {
    pub id: String,
    pub name: String,
    #[serde(default)]
    #[serde(rename = "when")]
    pub condition: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub type: Option<String>,
}

/// Views containers
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ViewsContainers {
    #[serde(default)]
    #[serde(rename = "activitybar")]
    pub activitybar: Vec<ViewContainer>,
    #[serde(default)]
    pub panel: Vec<ViewContainer>,
}

/// View container
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewContainer {
    pub id: String,
    pub title: String,
    pub icon: String,
}

/// Problem matcher contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProblemMatcherContribution {
    pub name: String,
    pub owner: Option<String>,
    #[serde(default)]
    #[serde(rename = "source")]
    pub file_location: Option<String>,
    pub pattern: ProblemPattern,
}

/// Problem pattern
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProblemPattern {
    #[serde(default)]
    pub regexp: Option<String>,
    #[serde(default)]
    pub file: Option<u32>,
    #[serde(default)]
    pub line: Option<u32>,
    #[serde(default)]
    pub column: Option<u32>,
    #[serde(default)]
    pub message: Option<u32>,
}

/// Task definition contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskDefinitionContribution {
    #[serde(rename = "type")]
    pub task_type: String,
    #[serde(default)]
    pub required: Vec<String>,
    #[serde(default)]
    pub properties: HashMap<String, serde_json::Value>,
}

/// Debugger contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebuggerContribution {
    #[serde(rename = "type")]
    pub debugger_type: String,
    pub label: String,
    #[serde(default)]
    pub program: Option<String>,
    #[serde(default)]
    pub runtime: Option<String>,
    #[serde(default)]
    pub configuration_attributes: Option<serde_json::Value>,
    #[serde(default)]
    pub configurations: Vec<serde_json::Value>,
    #[serde(default)]
    pub languages: Vec<String>,
}

/// Breakpoint contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BreakpointContribution {
    #[serde(rename = "language")]
    pub language_id: String,
}

/// Color contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorContribution {
    pub id: String,
    pub description: String,
    #[serde(default)]
    pub defaults: Option<ColorDefaults>,
}

/// Color defaults
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorDefaults {
    pub light: String,
    pub dark: String,
    #[serde(rename = "highContrast")]
    pub high_contrast: String,
}

/// TypeScript server plugin
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypeScriptServerPlugin {
    pub name: String,
    #[serde(default)]
    pub languages: Vec<String>,
}

/// Resource label formatter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLabelFormatter {
    pub scheme: String,
    #[serde(default)]
    pub authority: Option<String>,
    pub formatting: LabelFormatting,
}

/// Label formatting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LabelFormatting {
    pub label: String,
    #[serde(default)]
    pub separator: Option<String>,
}

/// Extension capabilities
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Capabilities {
    #[serde(default)]
    #[serde(rename = "virtualWorkspaces")]
    pub virtual_workspaces: Option<bool>,
    #[serde(default)]
    #[serde(rename = "untrustedWorkspaces")]
    pub untrusted_workspaces: Option<UntrustedWorkspacesSupport>,
}

/// Untrusted workspaces support
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UntrustedWorkspacesSupport {
    pub supported: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub restrictedConfigurations: Vec<String>,
}

impl ExtensionManifest {
    /// Load manifest from directory
    pub fn from_dir(dir: &PathBuf) -> Result<Self> {
        let package_json = dir.join("package.json");
        
        if !package_json.exists() {
            bail!("package.json not found in {:?}", dir);
        }
        
        let content = std::fs::read_to_string(&package_json)
            .context("Failed to read package.json")?;
        
        let mut manifest: Self = serde_json::from_str(&content)
            .context("Failed to parse package.json")?;
        
        // Compute identifier
        manifest.identifier = ExtensionIdentifier {
            id: format!("{}.{}", manifest.publisher, manifest.name),
            publisher: manifest.publisher.clone(),
            name: manifest.name.clone(),
        };
        
        // Validate
        manifest.validate()?;
        
        Ok(manifest)
    }
    
    /// Validate manifest
    pub fn validate(&self) -> Result<()> {
        if self.name.is_empty() {
            bail!("Extension name is required");
        }
        
        if self.publisher.is_empty() {
            bail!("Extension publisher is required");
        }
        
        if self.version.is_empty() {
            bail!("Extension version is required");
        }
        
        // Validate version format
        semver::Version::parse(&self.version)
            .map_err(|e| anyhow::anyhow!("Invalid version format: {}", e))?;
        
        // Validate engine compatibility
        if !self.engines.vscode.starts_with('^') && !self.engines.vscode.starts_with('>') {
            log::warn!("Engine version {} may be too restrictive", self.engines.vscode);
        }
        
        Ok(())
    }
    
    /// Get extension ID
    pub fn id(&self) -> &str {
        &self.identifier.id
    }
    
    /// Check if extension is UI extension
    pub fn is_ui_extension(&self) -> bool {
        self.extension_kind.as_ref()
            .map(|k| k.contains(&ExtensionKind::UI))
            .unwrap_or(false)
    }
    
    /// Check if extension is web extension
    pub fn is_web_extension(&self) -> bool {
        self.extension_kind.as_ref()
            .map(|k| k.contains(&ExtensionKind::Web))
            .unwrap_or(false)
    }
    
    /// Get activation events
    pub fn get_activation_events(&self) -> &[String] {
        &self.activation_events
    }
    
    /// Check if extension activates on language
    pub fn activates_on_language(&self, language_id: &str) -> bool {
        self.activation_events.iter().any(|e| {
            e == "*" || e == &format!("onLanguage:{}", language_id)
        })
    }
    
    /// Check if extension activates on command
    pub fn activates_on_command(&self, command_id: &str) -> bool {
        self.activation_events.iter().any(|e| {
            e == "*" || e == &format!("onCommand:{}", command_id)
        })
    }
    
    /// Get contributed commands
    pub fn get_commands(&self) -> Vec<&CommandContribution> {
        self.contributes.as_ref()
            .map(|c| c.commands.iter().collect())
            .unwrap_or_default()
    }
    
    /// Get contributed languages
    pub fn get_languages(&self) -> Vec<&LanguageContribution> {
        self.contributes.as_ref()
            .map(|c| c.languages.iter().collect())
            .unwrap_or_default()
    }
    
    /// Get contributed keybindings
    pub fn get_keybindings(&self) -> Vec<&KeybindingContribution> {
        self.contributes.as_ref()
            .map(|c| c.keybindings.iter().collect())
            .unwrap_or_default()
    }
    
    /// Get contributed themes
    pub fn get_themes(&self) -> Vec<&ThemeContribution> {
        self.contributes.as_ref()
            .map(|c| c.themes.iter().collect())
            .unwrap_or_default()
    }
}

/// Semver parsing (simplified)
mod semver {
    #[derive(Debug)]
    pub struct Version {
        pub major: u32,
        pub minor: u32,
        pub patch: u32,
    }
    
    impl Version {
        pub fn parse(s: &str) -> Result<Self, String> {
            let s = s.trim_start_matches('^').trim_start_matches('~').trim_start_matches('=');
            let parts: Vec<&str> = s.split('.').collect();
            
            if parts.len() < 2 {
                return Err("Invalid version format".to_string());
            }
            
            Ok(Self {
                major: parts[0].parse().map_err(|_| "Invalid major version")?,
                minor: parts[1].parse().map_err(|_| "Invalid minor version")?,
                patch: parts.get(2).and_then(|p| p.parse().ok()).unwrap_or(0),
            })
        }
    }
}
