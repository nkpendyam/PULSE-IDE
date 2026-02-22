//! Gesture recognition for mobile devices
//!
//! Uses accelerometer and gyroscope data to recognize gestures

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use super::protocol::PicoCommand;

/// Gesture recognizer using IMU data
pub struct GestureRecognizer {
    accelerometer_buffer: VecDeque<SensorReading>,
    gyroscope_buffer: VecDeque<SensorReading>,
    buffer_size: usize,
    sensitivity: f32,
    calibration: CalibrationData,
    trained_gestures: HashMap<String, GesturePattern>,
}

/// Sensor reading
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorReading {
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub timestamp: u64,
}

/// Calibration data for device sensors
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalibrationData {
    pub accel_offset: (f32, f32, f32),
    pub gyro_offset: (f32, f32, f32),
    pub accel_scale: f32,
    pub gyro_scale: f32,
}

impl Default for CalibrationData {
    fn default() -> Self {
        Self {
            accel_offset: (0.0, 0.0, 0.0),
            gyro_offset: (0.0, 0.0, 0.0),
            accel_scale: 1.0,
            gyro_scale: 1.0,
        }
    }
}

/// Gesture pattern for recognition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GesturePattern {
    pub name: String,
    pub command: PicoCommand,
    pub pattern_type: GestureType,
    pub threshold: f32,
    pub min_duration_ms: u64,
    pub max_duration_ms: u64,
}

/// Types of gestures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GestureType {
    Shake,
    SwipeLeft,
    SwipeRight,
    SwipeUp,
    SwipeDown,
    Circle,
    Tilt,
    DoubleTap,
    Custom { pattern: Vec<SensorReading> },
}

/// Recognized gesture result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GestureResult {
    pub gesture_type: String,
    pub confidence: f32,
    pub command: Option<PicoCommand>,
    pub duration_ms: u64,
}

impl GestureRecognizer {
    /// Create a new gesture recognizer
    pub fn new() -> Self {
        let mut recognizer = Self {
            accelerometer_buffer: VecDeque::with_capacity(100),
            gyroscope_buffer: VecDeque::with_capacity(100),
            buffer_size: 100,
            sensitivity: 0.7,
            calibration: CalibrationData::default(),
            trained_gestures: HashMap::new(),
        };

        recognizer.load_default_gestures();
        recognizer
    }

    /// Load default gesture patterns
    fn load_default_gestures(&mut self) {
        // Shake gesture - undo
        self.trained_gestures.insert("shake".to_string(), GesturePattern {
            name: "Shake".to_string(),
            command: PicoCommand::Undo,
            pattern_type: GestureType::Shake,
            threshold: 0.8,
            min_duration_ms: 200,
            max_duration_ms: 800,
        });

        // Swipe left - navigate back
        self.trained_gestures.insert("swipe_left".to_string(), GesturePattern {
            name: "Swipe Left".to_string(),
            command: PicoCommand::Navigate { direction: "left".to_string() },
            pattern_type: GestureType::SwipeLeft,
            threshold: 0.7,
            min_duration_ms: 100,
            max_duration_ms: 500,
        });

        // Swipe right - navigate forward
        self.trained_gestures.insert("swipe_right".to_string(), GesturePattern {
            name: "Swipe Right".to_string(),
            command: PicoCommand::Navigate { direction: "right".to_string() },
            pattern_type: GestureType::SwipeRight,
            threshold: 0.7,
            min_duration_ms: 100,
            max_duration_ms: 500,
        });

        // Circle - run code
        self.trained_gestures.insert("circle".to_string(), GesturePattern {
            name: "Circle".to_string(),
            command: PicoCommand::RunCode { code: None },
            pattern_type: GestureType::Circle,
            threshold: 0.75,
            min_duration_ms: 300,
            max_duration_ms: 1000,
        });

        // Tilt up - scroll up
        self.trained_gestures.insert("tilt_up".to_string(), GesturePattern {
            name: "Tilt Up".to_string(),
            command: PicoCommand::Scroll { direction: "up".to_string(), amount: 10 },
            pattern_type: GestureType::Tilt,
            threshold: 0.6,
            min_duration_ms: 50,
            max_duration_ms: 300,
        });

        // Tilt down - scroll down
        self.trained_gestures.insert("tilt_down".to_string(), GesturePattern {
            name: "Tilt Down".to_string(),
            command: PicoCommand::Scroll { direction: "down".to_string(), amount: 10 },
            pattern_type: GestureType::Tilt,
            threshold: 0.6,
            min_duration_ms: 50,
            max_duration_ms: 300,
        });
    }

    /// Process sensor data
    pub fn process_sensor_data(&mut self, data: &SensorData) {
        if let Some(ref accel) = data.accelerometer {
            self.accelerometer_buffer.push_back(accel.clone());
            if self.accelerometer_buffer.len() > self.buffer_size {
                self.accelerometer_buffer.pop_front();
            }
        }

        if let Some(ref gyro) = data.gyroscope {
            self.gyroscope_buffer.push_back(gyro.clone());
            if self.gyroscope_buffer.len() > self.buffer_size {
                self.gyroscope_buffer.pop_front();
            }
        }
    }

    /// Recognize gesture from data
    pub fn recognize(&self, data: &SensorData) -> Option<PicoCommand> {
        let accel = data.accelerometer.as_ref()?;
        
        // Check for shake
        if self.detect_shake(accel) {
            return Some(PicoCommand::Undo);
        }

        // Check for tilt
        if let Some(direction) = self.detect_tilt(accel) {
            return Some(PicoCommand::Scroll { direction, amount: 10 });
        }

        None
    }

    /// Detect shake gesture
    fn detect_shake(&self, accel: &SensorReading) -> bool {
        let magnitude = (accel.x.powi(2) + accel.y.powi(2) + accel.z.powi(2)).sqrt();
        
        // Shake is detected when acceleration changes rapidly
        let threshold = 15.0 * self.sensitivity;
        magnitude > threshold
    }

    /// Detect tilt direction
    fn detect_tilt(&self, accel: &SensorReading) -> Option<String> {
        let tilt_threshold = 3.0 * self.sensitivity;

        if accel.x > tilt_threshold {
            Some("down".to_string())
        } else if accel.x < -tilt_threshold {
            Some("up".to_string())
        } else if accel.y > tilt_threshold {
            Some("right".to_string())
        } else if accel.y < -tilt_threshold {
            Some("left".to_string())
        } else {
            None
        }
    }

    /// Detect swipe from buffer
    fn detect_swipe(&self) -> Option<String> {
        if self.accelerometer_buffer.len() < 10 {
            return None;
        }

        let readings: Vec<_> = self.accelerometer_buffer.iter().collect();
        
        // Calculate net movement
        let mut dx = 0.0;
        let mut dy = 0.0;

        for i in 1..readings.len() {
            dx += readings[i].x - readings[i-1].x;
            dy += readings[i].y - readings[i-1].y;
        }

        let threshold = 5.0;
        let abs_x = dx.abs();
        let abs_y = dy.abs();

        if abs_x > abs_y && abs_x > threshold {
            Some(if dx > 0.0 { "right" } else { "left" }.to_string())
        } else if abs_y > threshold {
            Some(if dy > 0.0 { "down" } else { "up" }.to_string())
        } else {
            None
        }
    }

    /// Calibrate sensors
    pub fn calibrate(&mut self, readings: &[SensorReading]) {
        if readings.is_empty() {
            return;
        }

        let n = readings.len() as f32;
        let sum_x: f32 = readings.iter().map(|r| r.x).sum();
        let sum_y: f32 = readings.iter().map(|r| r.y).sum();
        let sum_z: f32 = readings.iter().map(|r| r.z).sum();

        self.calibration.accel_offset = (
            sum_x / n,
            sum_y / n,
            sum_z / n,
        );
    }

    /// Set sensitivity
    pub fn set_sensitivity(&mut self, sensitivity: f32) {
        self.sensitivity = sensitivity.clamp(0.1, 1.0);
    }

    /// Add custom gesture
    pub fn add_custom_gesture(&mut self, name: String, pattern: GesturePattern) {
        self.trained_gestures.insert(name, pattern);
    }

    /// Clear buffers
    pub fn clear_buffers(&mut self) {
        self.accelerometer_buffer.clear();
        self.gyroscope_buffer.clear();
    }
}

impl Default for GestureRecognizer {
    fn default() -> Self {
        Self::new()
    }
}

/// Sensor data from device
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorData {
    pub accelerometer: Option<SensorReading>,
    pub gyroscope: Option<SensorReading>,
    pub timestamp: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_shake_detection() {
        let recognizer = GestureRecognizer::new();
        
        let shake_data = SensorData {
            accelerometer: Some(SensorReading {
                x: 10.0,
                y: 10.0,
                z: 10.0,
                timestamp: 0,
            }),
            gyroscope: None,
            timestamp: 0,
        };

        let result = recognizer.recognize(&shake_data);
        assert!(result.is_some());
    }
}
