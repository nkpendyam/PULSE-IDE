//! Virtual PICO Bridge - Phone as Controller
//!
//! This module enables using smartphones as high-fidelity coding controllers
//! via WebSocket or WebHID, with gesture recognition and haptic feedback.

pub mod websocket_server;
pub mod gesture_recognizer;
pub mod haptic_engine;
pub mod protocol;

pub use websocket_server::PicoWebSocketServer;
pub use gesture_recognizer::GestureRecognizer;
pub use haptic_engine::HapticEngine;
pub use protocol::{PicoMessage, PicoCommand};

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;

/// Virtual PICO controller configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PicoConfig {
    /// WebSocket port
    pub port: u16,
    /// Enable gesture recognition
    pub enable_gestures: bool,
    /// Enable haptic feedback
    pub enable_haptics: bool,
    /// Gesture recognition sensitivity
    pub gesture_sensitivity: f32,
    /// Connection timeout in seconds
    pub connection_timeout_secs: u64,
}

impl Default for PicoConfig {
    fn default() -> Self {
        Self {
            port: 9173,
            enable_gestures: true,
            enable_haptics: true,
            gesture_sensitivity: 0.7,
            connection_timeout_secs: 300,
        }
    }
}

/// Connected PICO device
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PicoDevice {
    pub device_id: String,
    pub name: String,
    pub device_type: DeviceType,
    pub connected_at: chrono::DateTime<chrono::Utc>,
    pub last_activity: chrono::DateTime<chrono::Utc>,
    pub capabilities: DeviceCapabilities,
    pub pending_queue: Vec<QueuedCommand>,
}

/// Device type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DeviceType {
    Phone,
    Tablet,
    WebBrowser,
    Desktop,
}

/// Device capabilities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCapabilities {
    pub has_accelerometer: bool,
    pub has_gyroscope: bool,
    pub has_vibration: bool,
    pub has_microphone: bool,
    pub has_camera: bool,
    pub screen_width: u32,
    pub screen_height: u32,
}

impl Default for DeviceCapabilities {
    fn default() -> Self {
        Self {
            has_accelerometer: true,
            has_gyroscope: true,
            has_vibration: true,
            has_microphone: false,
            has_camera: false,
            screen_width: 390,
            screen_height: 844,
        }
    }
}

/// Queued command for device
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueuedCommand {
    pub id: String,
    pub command: PicoCommand,
    pub queued_at: chrono::DateTime<chrono::Utc>,
    pub priority: u8,
}

/// Virtual PICO Bridge Manager
pub struct PicoBridge {
    config: PicoConfig,
    devices: Arc<RwLock<HashMap<String, PicoDevice>>>,
    gesture_recognizer: Arc<RwLock<GestureRecognizer>>,
    haptic_engine: Arc<RwLock<HapticEngine>>,
    command_handlers: HashMap<String, Box<dyn CommandHandler + Send + Sync>>,
}

/// Command handler trait
pub trait CommandHandler {
    fn handle(&self, command: &PicoCommand) -> Result<()>;
}

impl PicoBridge {
    /// Create a new PICO bridge
    pub fn new(config: PicoConfig) -> Self {
        Self {
            config,
            devices: Arc::new(RwLock::new(HashMap::new())),
            gesture_recognizer: Arc::new(RwLock::new(GestureRecognizer::new())),
            haptic_engine: Arc::new(RwLock::new(HapticEngine::new())),
            command_handlers: HashMap::new(),
        }
    }

    /// Register a device
    pub async fn register_device(&self, device: PicoDevice) -> Result<()> {
        let mut devices = self.devices.write().await;
        devices.insert(device.device_id.clone(), device);
        Ok(())
    }

    /// Unregister a device
    pub async fn unregister_device(&self, device_id: &str) -> Result<()> {
        let mut devices = self.devices.write().await;
        devices.remove(device_id);
        Ok(())
    }

    /// Handle incoming message from device
    pub async fn handle_message(&self, device_id: &str, message: PicoMessage) -> Result<()> {
        match message {
            PicoMessage::Gesture(gesture) => {
                let mut recognizer = self.gesture_recognizer.write().await;
                if let Some(command) = recognizer.recognize(&gesture) {
                    self.execute_command(device_id, command).await?;
                }
            }
            PicoMessage::Command(cmd) => {
                self.execute_command(device_id, cmd).await?;
            }
            PicoMessage::SensorData(data) => {
                let mut recognizer = self.gesture_recognizer.write().await;
                recognizer.process_sensor_data(&data);
            }
            PicoMessage::Heartbeat => {
                // Update last activity
                let mut devices = self.devices.write().await;
                if let Some(device) = devices.get_mut(device_id) {
                    device.last_activity = chrono::Utc::now();
                }
            }
            _ => {}
        }
        Ok(())
    }

    /// Execute a command
    async fn execute_command(&self, device_id: &str, command: PicoCommand) -> Result<()> {
        // Handle command based on type
        match &command {
            PicoCommand::RunCode { code } => {
                println!("Device {} requests to run code: {:?}", device_id, code);
                // In production, send to terminal or execution engine
            }
            PicoCommand::OpenFile { path } => {
                println!("Device {} requests to open file: {}", device_id, path);
            }
            PicoCommand::SaveFile => {
                println!("Device {} requests save", device_id);
            }
            PicoCommand::Navigate { direction } => {
                println!("Device {} navigates {:?}", device_id, direction);
            }
            PicoCommand::VoiceCommand { text } => {
                println!("Device {} voice: {}", device_id, text);
            }
            _ => {}
        }

        // Send haptic feedback
        if self.config.enable_haptics {
            let haptic = self.haptic_engine.read().await;
            haptic.trigger_feedback(device_id, "success").await?;
        }

        Ok(())
    }

    /// Queue a command for a device
    pub async fn queue_command(&self, device_id: &str, command: PicoCommand) -> Result<()> {
        let mut devices = self.devices.write().await;
        if let Some(device) = devices.get_mut(device_id) {
            device.pending_queue.push(QueuedCommand {
                id: uuid::Uuid::new_v4().to_string(),
                command,
                queued_at: chrono::Utc::now(),
                priority: 0,
            });
        }
        Ok(())
    }

    /// Get all connected devices
    pub async fn get_devices(&self) -> Vec<PicoDevice> {
        let devices = self.devices.read().await;
        devices.values().cloned().collect()
    }

    /// Get a specific device
    pub async fn get_device(&self, device_id: &str) -> Option<PicoDevice> {
        let devices = self.devices.read().await;
        devices.get(device_id).cloned()
    }

    /// Broadcast a message to all devices
    pub async fn broadcast(&self, message: PicoMessage) -> Result<()> {
        // In production, this would send via WebSocket
        println!("Broadcasting message to all devices: {:?}", message);
        Ok(())
    }

    /// Clean up disconnected devices
    pub async fn cleanup_stale(&self) -> Result<usize> {
        let mut devices = self.devices.write().await;
        let now = chrono::Utc::now();
        let timeout = chrono::Duration::seconds(self.config.connection_timeout_secs as i64);

        let stale: Vec<String> = devices.iter()
            .filter(|(_, d)| now - d.last_activity > timeout)
            .map(|(id, _)| id.clone())
            .collect();

        let count = stale.len();
        for id in stale {
            devices.remove(&id);
        }

        Ok(count)
    }
}

impl Default for PicoBridge {
    fn default() -> Self {
        Self::new(PicoConfig::default())
    }
}
