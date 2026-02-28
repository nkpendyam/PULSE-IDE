//! Telemetry System for KRO_IDE
//!
//! Privacy-first, opt-in, GDPR-compliant telemetry

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};

/// Telemetry configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetryConfig {
    /// Enable telemetry (user opt-in)
    pub enabled: bool,
    /// Anonymous session ID
    pub session_id: String,
    /// Endpoint for telemetry data
    pub endpoint: Option<String>,
    /// Send interval in seconds
    pub send_interval_secs: u64,
}

impl Default for TelemetryConfig {
    fn default() -> Self {
        Self {
            enabled: false, // Opt-in by default
            session_id: uuid::Uuid::new_v4().to_string(),
            endpoint: Some("https://telemetry.kro-ide.dev/v1/events".to_string()),
            send_interval_secs: 300, // 5 minutes
        }
    }
}

/// Telemetry event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetryEvent {
    pub event_type: String,
    pub timestamp: i64,
    pub duration_ms: Option<u64>,
    pub success: Option<bool>,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Telemetry manager
pub struct TelemetryManager {
    config: TelemetryConfig,
    events: Vec<TelemetryEvent>,
    counters: HashMap<String, AtomicU64>,
}

impl TelemetryManager {
    pub fn new(config: TelemetryConfig) -> Self {
        let mut counters = HashMap::new();
        counters.insert("startup_count".to_string(), AtomicU64::new(0));
        counters.insert("crash_count".to_string(), AtomicU64::new(0));
        counters.insert("ai_requests".to_string(), AtomicU64::new(0));
        counters.insert("ai_cache_hits".to_string(), AtomicU64::new(0));
        
        Self {
            config,
            events: Vec::new(),
            counters,
        }
    }
    
    /// Record an event
    pub fn record(&mut self, event_type: &str, metadata: HashMap<String, serde_json::Value>) {
        if !self.config.enabled {
            return;
        }
        
        let event = TelemetryEvent {
            event_type: event_type.to_string(),
            timestamp: chrono::Utc::now().timestamp_millis(),
            duration_ms: None,
            success: None,
            metadata,
        };
        
        self.events.push(event);
    }
    
    /// Record a timed event
    pub fn record_timed(
        &mut self, 
        event_type: &str, 
        duration_ms: u64, 
        success: bool,
        metadata: HashMap<String, serde_json::Value>
    ) {
        if !self.config.enabled {
            return;
        }
        
        let event = TelemetryEvent {
            event_type: event_type.to_string(),
            timestamp: chrono::Utc::now().timestamp_millis(),
            duration_ms: Some(duration_ms),
            success: Some(success),
            metadata,
        };
        
        self.events.push(event);
    }
    
    /// Increment a counter
    pub fn increment(&self, counter: &str) {
        if !self.config.enabled {
            return;
        }
        
        if let Some(atomic) = self.counters.get(counter) {
            atomic.fetch_add(1, Ordering::Relaxed);
        }
    }
    
    /// Get counter value
    pub fn get_counter(&self, counter: &str) -> u64 {
        self.counters.get(counter)
            .map(|a| a.load(Ordering::Relaxed))
            .unwrap_or(0)
    }
    
    /// Flush events to server
    pub async fn flush(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        if !self.config.enabled || self.events.is_empty() {
            return Ok(());
        }
        
        if let Some(ref endpoint) = self.config.endpoint {
            let payload = serde_json::json!({
                "session_id": self.config.session_id,
                "version": env!("CARGO_PKG_VERSION"),
                "events": std::mem::take(&mut self.events),
                "counters": self.counters.iter()
                    .map(|(k, v)| (k.clone(), v.load(Ordering::Relaxed)))
                    .collect::<HashMap<_, _>>(),
            });
            
            let client = reqwest::Client::new();
            let _ = client.post(endpoint)
                .json(&payload)
                .timeout(std::time::Duration::from_secs(10))
                .send()
                .await?;
        }
        
        Ok(())
    }
    
    /// Check if telemetry is enabled
    pub fn is_enabled(&self) -> bool {
        self.config.enabled
    }
    
    /// Enable telemetry
    pub fn enable(&mut self) {
        self.config.enabled = true;
    }
    
    /// Disable telemetry
    pub fn disable(&mut self) {
        self.config.enabled = false;
    }
    
    /// Get session ID
    pub fn session_id(&self) -> &str {
        &self.config.session_id
    }
}

/// Crash reporter
pub struct CrashReporter {
    crash_dir: std::path::PathBuf,
}

impl CrashReporter {
    pub fn new() -> Self {
        let crash_dir = dirs::data_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join("kro_ide")
            .join("crashes");
        
        std::fs::create_dir_all(&crash_dir).ok();
        
        Self { crash_dir }
    }
    
    /// Write crash report
    pub fn write_crash_report(&self, error: &str, backtrace: Option<&str>) {
        let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
        let report_path = self.crash_dir.join(format!("crash_{}.txt", timestamp));
        
        let report = format!(
            "KRO_IDE Crash Report\n\
            ===================\n\
            Version: {}\n\
            Time: {}\n\
            Error: {}\n\
            \n\
            Backtrace:\n\
            {}\n",
            env!("CARGO_PKG_VERSION"),
            chrono::Utc::now().to_rfc3339(),
            error,
            backtrace.unwrap_or("Not available")
        );
        
        std::fs::write(&report_path, report).ok();
    }
    
    /// List crash reports
    pub fn list_crash_reports(&self) -> Vec<std::path::PathBuf> {
        std::fs::read_dir(&self.crash_dir)
            .map(|entries| {
                entries
                    .filter_map(|e| e.ok())
                    .map(|e| e.path())
                    .collect()
            })
            .unwrap_or_default()
    }
}

impl Default for CrashReporter {
    fn default() -> Self {
        Self::new()
    }
}
