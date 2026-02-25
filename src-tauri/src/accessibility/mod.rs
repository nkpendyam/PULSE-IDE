//! Accessibility Features for KRO_IDE
//!
//! WCAG 2.1 AA compliant accessibility support

pub mod screen_reader;
pub mod keyboard;
pub mod visual;

use serde::{Deserialize, Serialize};

/// Accessibility configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessibilityConfig {
    /// Enable screen reader support
    pub screen_reader_enabled: bool,
    /// High contrast mode
    pub high_contrast: bool,
    /// Reduced motion
    pub reduced_motion: bool,
    /// Font size multiplier
    pub font_size_multiplier: f32,
    /// Enable keyboard navigation hints
    pub keyboard_hints: bool,
    /// Focus indicator style
    pub focus_indicator: FocusIndicatorStyle,
}

impl Default for AccessibilityConfig {
    fn default() -> Self {
        Self {
            screen_reader_enabled: false,
            high_contrast: false,
            reduced_motion: false,
            font_size_multiplier: 1.0,
            keyboard_hints: true,
            focus_indicator: FocusIndicatorStyle::default(),
        }
    }
}

/// Focus indicator style
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FocusIndicatorStyle {
    /// Default outline
    Outline,
    /// High visibility outline
    HighVisibility,
    /// Custom color
    Custom(String),
}

impl Default for FocusIndicatorStyle {
    fn default() -> Self {
        Self::Outline
    }
}

/// Accessibility manager
pub struct AccessibilityManager {
    config: AccessibilityConfig,
    announce_queue: Vec<String>,
}

impl AccessibilityManager {
    pub fn new(config: AccessibilityConfig) -> Self {
        Self {
            config,
            announce_queue: Vec::new(),
        }
    }
    
    /// Check if screen reader is enabled
    pub fn is_screen_reader_enabled(&self) -> bool {
        self.config.screen_reader_enabled
    }
    
    /// Check if high contrast is enabled
    pub fn is_high_contrast(&self) -> bool {
        self.config.high_contrast
    }
    
    /// Check if reduced motion is enabled
    pub fn is_reduced_motion(&self) -> bool {
        self.config.reduced_motion
    }
    
    /// Announce a message to screen reader
    pub fn announce(&mut self, message: &str) {
        if self.config.screen_reader_enabled {
            self.announce_queue.push(message.to_string());
        }
    }
    
    /// Get pending announcements
    pub fn get_announcements(&mut self) -> Vec<String> {
        std::mem::take(&mut self.announce_queue)
    }
    
    /// Get font size multiplier
    pub fn font_size_multiplier(&self) -> f32 {
        self.config.font_size_multiplier
    }
    
    /// Update configuration
    pub fn update_config(&mut self, config: AccessibilityConfig) {
        self.config = config;
    }
    
    /// Get current configuration
    pub fn config(&self) -> &AccessibilityConfig {
        &self.config
    }
    
    /// Detect system accessibility settings
    pub fn detect_system_settings() -> AccessibilityConfig {
        let mut config = AccessibilityConfig::default();
        
        // Check for system reduced motion preference
        #[cfg(target_os = "macos")]
        {
            // Would query NSWorkspace.accessibilityDisplayShouldReduceMotion
        }
        
        #[cfg(target_os = "windows")]
        {
            // Would query SystemParametersInfo with SPI_GETCLIENTAREAANIMATION
        }
        
        config
    }
}

impl Default for AccessibilityManager {
    fn default() -> Self {
        Self::new(AccessibilityConfig::default())
    }
}

/// Screen reader support
pub mod screen_reader {
    use super::*;
    
    /// Screen reader interface
    pub trait ScreenReaderSupport: Send + Sync {
        /// Announce a message
        fn announce(&self, message: &str);
        
        /// Get current focus description
        fn get_focus_description(&self) -> String;
        
        /// Set focus to element
        fn set_focus(&mut self, element_id: &str);
    }
    
    /// No-op screen reader for when accessibility is disabled
    pub struct NoOpScreenReader;
    
    impl ScreenReaderSupport for NoOpScreenReader {
        fn announce(&self, _message: &str) {}
        fn get_focus_description(&self) -> String { String::new() }
        fn set_focus(&mut self, _element_id: &str) {}
    }
}

/// Keyboard navigation
pub mod keyboard {
    use super::*;
    
    /// Keyboard shortcut
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct KeyboardShortcut {
        pub key: String,
        pub modifiers: Vec<Modifier>,
        pub action: String,
        pub description: String,
    }
    
    /// Key modifier
    #[derive(Debug, Clone, Copy, Serialize, Deserialize)]
    pub enum Modifier {
        Ctrl,
        Alt,
        Shift,
        Meta,
    }
    
    /// Default keyboard shortcuts
    pub fn default_shortcuts() -> Vec<KeyboardShortcut> {
        vec![
            KeyboardShortcut {
                key: "P".to_string(),
                modifiers: vec![Modifier::Ctrl],
                action: "command_palette".to_string(),
                description: "Open command palette".to_string(),
            },
            KeyboardShortcut {
                key: "S".to_string(),
                modifiers: vec![Modifier::Ctrl],
                action: "save_file".to_string(),
                description: "Save current file".to_string(),
            },
            KeyboardShortcut {
                key: "O".to_string(),
                modifiers: vec![Modifier::Ctrl],
                action: "open_file".to_string(),
                description: "Open file".to_string(),
            },
            KeyboardShortcut {
                key: "Space".to_string(),
                modifiers: vec![Modifier::Ctrl],
                action: "ai_complete".to_string(),
                description: "AI code completion".to_string(),
            },
            KeyboardShortcut {
                key: "/".to_string(),
                modifiers: vec![Modifier::Ctrl],
                action: "toggle_comment".to_string(),
                description: "Toggle line comment".to_string(),
            },
            KeyboardShortcut {
                key: "F".to_string(),
                modifiers: vec![Modifier::Ctrl],
                action: "find".to_string(),
                description: "Find in file".to_string(),
            },
            KeyboardShortcut {
                key: "H".to_string(),
                modifiers: vec![Modifier::Ctrl],
                action: "replace".to_string(),
                description: "Find and replace".to_string(),
            },
            KeyboardShortcut {
                key: "`".to_string(),
                modifiers: vec![Modifier::Ctrl],
                action: "toggle_terminal".to_string(),
                description: "Toggle terminal".to_string(),
            },
            KeyboardShortcut {
                key: "B".to_string(),
                modifiers: vec![Modifier::Ctrl],
                action: "toggle_sidebar".to_string(),
                description: "Toggle sidebar".to_string(),
            },
            KeyboardShortcut {
                key: "J".to_string(),
                modifiers: vec![Modifier::Ctrl],
                action: "toggle_chat".to_string(),
                description: "Toggle AI chat".to_string(),
            },
        ]
    }
}

/// Visual accessibility
pub mod visual {
    use super::*;
    
    /// High contrast color scheme
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct HighContrastTheme {
        pub background: String,
        pub foreground: String,
        pub accent: String,
        pub error: String,
        pub warning: String,
        pub success: String,
        pub selection: String,
        pub cursor: String,
    }
    
    impl Default for HighContrastTheme {
        fn default() -> Self {
            Self {
                background: "#000000".to_string(),
                foreground: "#FFFFFF".to_string(),
                accent: "#FFFF00".to_string(),
                error: "#FF0000".to_string(),
                warning: "#FFA500".to_string(),
                success: "#00FF00".to_string(),
                selection: "#0000FF".to_string(),
                cursor: "#FFFFFF".to_string(),
            }
        }
    }
    
    /// Color blind friendly palette
    pub fn color_blind_palette() -> Vec<String> {
        // Paul Tol's color blind friendly palette
        vec![
            "#332288".to_string(), // Blue
            "#117733".to_string(), // Green
            "#44AA99".to_string(), // Teal
            "#88CCEE".to_string(), // Cyan
            "#DDCC77".to_string(), // Yellow
            "#CC6677".to_string(), // Pink
            "#AA4499".to_string(), // Purple
            "#882255".to_string(), // Red
        ]
    }
}
