//! Haptic feedback engine for PICO devices
//!
//! Provides rich vibration patterns for different events

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Haptic engine for vibration feedback
pub struct HapticEngine {
    patterns: HashMap<String, HapticPattern>,
    enabled: bool,
    default_intensity: f32,
}

/// Haptic pattern definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HapticPattern {
    pub name: String,
    pub description: String,
    pub pattern: Vec<PatternElement>,
    pub default_duration_ms: u32,
}

/// Element of a haptic pattern
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternElement {
    pub duration_ms: u32,
    pub intensity: f32, // 0.0 - 1.0
    pub pause_ms: u32,
}

/// Haptic feedback request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HapticRequest {
    pub pattern_name: String,
    pub intensity: Option<f32>,
    pub repeat: Option<u32>,
}

/// Haptic response for transmission
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HapticResponse {
    pub pattern: Vec<PatternElement>,
    pub total_duration_ms: u32,
}

impl HapticEngine {
    /// Create a new haptic engine
    pub fn new() -> Self {
        let mut engine = Self {
            patterns: HashMap::new(),
            enabled: true,
            default_intensity: 0.7,
        };

        engine.load_default_patterns();
        engine
    }

    /// Load default haptic patterns
    fn load_default_patterns(&mut self) {
        // Success - short double pulse
        self.patterns.insert("success".to_string(), HapticPattern {
            name: "Success".to_string(),
            description: "Short double pulse for successful actions".to_string(),
            pattern: vec![
                PatternElement { duration_ms: 50, intensity: 0.8, pause_ms: 50 },
                PatternElement { duration_ms: 50, intensity: 0.8, pause_ms: 0 },
            ],
            default_duration_ms: 150,
        });

        // Error - long vibration
        self.patterns.insert("error".to_string(), HapticPattern {
            name: "Error".to_string(),
            description: "Long vibration for errors".to_string(),
            pattern: vec![
                PatternElement { duration_ms: 200, intensity: 1.0, pause_ms: 0 },
            ],
            default_duration_ms: 200,
        });

        // Warning - pulsing
        self.patterns.insert("warning".to_string(), HapticPattern {
            name: "Warning".to_string(),
            description: "Pulsing vibration for warnings".to_string(),
            pattern: vec![
                PatternElement { duration_ms: 100, intensity: 0.6, pause_ms: 100 },
                PatternElement { duration_ms: 100, intensity: 0.6, pause_ms: 0 },
            ],
            default_duration_ms: 300,
        });

        // Processing - rhythmic
        self.patterns.insert("processing".to_string(), HapticPattern {
            name: "Processing".to_string(),
            description: "Rhythmic vibration during processing".to_string(),
            pattern: vec![
                PatternElement { duration_ms: 30, intensity: 0.5, pause_ms: 70 },
                PatternElement { duration_ms: 30, intensity: 0.5, pause_ms: 70 },
                PatternElement { duration_ms: 30, intensity: 0.5, pause_ms: 0 },
            ],
            default_duration_ms: 230,
        });

        // Notification - attention
        self.patterns.insert("notification".to_string(), HapticPattern {
            name: "Notification".to_string(),
            description: "Attention-getting notification pattern".to_string(),
            pattern: vec![
                PatternElement { duration_ms: 100, intensity: 0.7, pause_ms: 50 },
                PatternElement { duration_ms: 50, intensity: 0.5, pause_ms: 50 },
                PatternElement { duration_ms: 100, intensity: 0.7, pause_ms: 0 },
            ],
            default_duration_ms: 350,
        });

        // Tap - light feedback
        self.patterns.insert("tap".to_string(), HapticPattern {
            name: "Tap".to_string(),
            description: "Light tap feedback for UI interactions".to_string(),
            pattern: vec![
                PatternElement { duration_ms: 20, intensity: 0.4, pause_ms: 0 },
            ],
            default_duration_ms: 20,
        });

        // Code run - escalating
        self.patterns.insert("code_run".to_string(), HapticPattern {
            name: "Code Run".to_string(),
            description: "Escalating pattern when running code".to_string(),
            pattern: vec![
                PatternElement { duration_ms: 50, intensity: 0.3, pause_ms: 50 },
                PatternElement { duration_ms: 50, intensity: 0.5, pause_ms: 50 },
                PatternElement { duration_ms: 50, intensity: 0.7, pause_ms: 0 },
            ],
            default_duration_ms: 200,
        });

        // Code complete - celebration
        self.patterns.insert("code_complete".to_string(), HapticPattern {
            name: "Code Complete".to_string(),
            description: "Celebration pattern for code completion".to_string(),
            pattern: vec![
                PatternElement { duration_ms: 50, intensity: 0.6, pause_ms: 30 },
                PatternElement { duration_ms: 50, intensity: 0.8, pause_ms: 30 },
                PatternElement { duration_ms: 100, intensity: 1.0, pause_ms: 0 },
            ],
            default_duration_ms: 260,
        });

        // Gesture recognized
        self.patterns.insert("gesture".to_string(), HapticPattern {
            name: "Gesture".to_string(),
            description: "Feedback when gesture is recognized".to_string(),
            pattern: vec![
                PatternElement { duration_ms: 40, intensity: 0.6, pause_ms: 40 },
                PatternElement { duration_ms: 40, intensity: 0.6, pause_ms: 0 },
            ],
            default_duration_ms: 120,
        });

        // Connection established
        self.patterns.insert("connected".to_string(), HapticPattern {
            name: "Connected".to_string(),
            description: "Pattern when device connects".to_string(),
            pattern: vec![
                PatternElement { duration_ms: 80, intensity: 0.7, pause_ms: 40 },
                PatternElement { duration_ms: 80, intensity: 0.7, pause_ms: 40 },
                PatternElement { duration_ms: 80, intensity: 0.7, pause_ms: 0 },
            ],
            default_duration_ms: 280,
        });
    }

    /// Trigger haptic feedback on a device
    pub async fn trigger_feedback(&self, device_id: &str, pattern_name: &str) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        if let Some(pattern) = self.patterns.get(pattern_name) {
            // In production, this would send to the device via WebSocket
            println!("Triggering haptic '{}' on device {}", pattern.name, device_id);
        }

        Ok(())
    }

    /// Get haptic response for transmission
    pub fn get_pattern(&self, pattern_name: &str) -> Option<HapticResponse> {
        self.patterns.get(pattern_name).map(|p| HapticResponse {
            pattern: p.pattern.clone(),
            total_duration_ms: p.default_duration_ms,
        })
    }

    /// Create custom pattern
    pub fn create_custom_pattern(
        &mut self,
        name: String,
        description: String,
        elements: Vec<PatternElement>,
    ) {
        let total_duration: u32 = elements.iter()
            .map(|e| e.duration_ms + e.pause_ms)
            .sum();

        self.patterns.insert(name.clone(), HapticPattern {
            name,
            description,
            pattern: elements,
            default_duration_ms: total_duration,
        });
    }

    /// List available patterns
    pub fn list_patterns(&self) -> Vec<&HapticPattern> {
        self.patterns.values().collect()
    }

    /// Enable or disable haptics
    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
    }

    /// Set default intensity
    pub fn set_default_intensity(&mut self, intensity: f32) {
        self.default_intensity = intensity.clamp(0.0, 1.0);
    }

    /// Convert pattern to Vibration API format
    pub fn to_vibration_api_format(&self, pattern_name: &str) -> Option<Vec<u32>> {
        self.patterns.get(pattern_name).map(|p| {
            let mut result = Vec::new();
            for element in &p.pattern {
                result.push(element.duration_ms);
                if element.pause_ms > 0 {
                    result.push(element.pause_ms);
                }
            }
            result
        })
    }
}

impl Default for HapticEngine {
    fn default() -> Self {
        Self::new()
    }
}

/// Audio feedback options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioFeedback {
    pub enabled: bool,
    pub volume: f32,
    pub sounds: HashMap<String, String>, // name -> file path
}

impl Default for AudioFeedback {
    fn default() -> Self {
        Self {
            enabled: false,
            volume: 0.5,
            sounds: HashMap::new(),
        }
    }
}
