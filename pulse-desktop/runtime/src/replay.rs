//! PULSE Runtime Kernel - Deterministic Replay
//!
//! Record and replay sessions for debugging and benchmarking.

use crate::event::{Event, EventType};
use crate::kernel::KernelConfig;
use anyhow::Result;
use serde::{Serialize, Deserialize};
use std::fs::File;
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::path::Path;
use tracing::{info, debug};

/// Recorded session header
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionHeader {
    pub version: String,
    pub created_at: String,
    pub kernel_version: String,
    pub config: SessionConfig,
    pub model_versions: HashMap<String, String>,
    pub seed: u64,
}

/// Session configuration snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionConfig {
    pub ram_budget_mb: u64,
    pub policy_mode: String,
    pub max_concurrent_tasks: usize,
}

/// Recorded event with sequence number
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordedEvent {
    pub sequence: u64,
    pub timestamp: i64,
    pub event: Event,
}

/// Replay engine for deterministic replay
pub struct ReplayEngine {
    /// Session file path
    path: String,
    /// Session header
    header: Option<SessionHeader>,
    /// Recorded events
    events: Vec<RecordedEvent>,
    /// Current position
    position: usize,
    /// Random seed for reproducibility
    seed: u64,
}

impl ReplayEngine {
    /// Create a new replay engine from a recording file
    pub fn new(path: &str) -> Result<Self> {
        let file = File::open(path)?;
        let reader = BufReader::new(file);

        let mut events = Vec::new();
        let mut header: Option<SessionHeader> = None;

        for (i, line) in reader.lines().enumerate() {
            let line = line?;

            if i == 0 {
                // First line is header
                header = Some(serde_json::from_str(&line)?);
            } else {
                // Subsequent lines are events
                let recorded: RecordedEvent = serde_json::from_str(&line)?;
                events.push(recorded);
            }
        }

        let seed = header.as_ref().map(|h| h.seed).unwrap_or(0);

        Ok(Self {
            path: path.to_string(),
            header,
            events,
            position: 0,
            seed,
        })
    }

    /// Get session header
    pub fn header(&self) -> Option<&SessionHeader> {
        self.header.as_ref()
    }

    /// Get total event count
    pub fn event_count(&self) -> usize {
        self.events.len()
    }

    /// Get current position
    pub fn position(&self) -> usize {
        self.position
    }

    /// Seek to a specific position
    pub fn seek(&mut self, position: usize) {
        self.position = position.min(self.events.len());
    }

    /// Get next event
    pub fn next(&mut self) -> Option<&RecordedEvent> {
        if self.position < self.events.len() {
            let event = &self.events[self.position];
            self.position += 1;
            Some(event)
        } else {
            None
        }
    }

    /// Run the replay
    pub async fn run(&self) -> Result<()> {
        info!(
            path = %self.path,
            events = self.events.len(),
            seed = self.seed,
            "Starting replay"
        );

        // Initialize RNG with seed for deterministic behavior
        let mut rng = rand::rngs::StdRng::seed_from_u64(self.seed);

        for recorded in &self.events {
            debug!(
                sequence = recorded.sequence,
                event_type = ?recorded.event.event_type,
                "Replaying event"
            );

            // In a real implementation, would:
            // 1. Set monotonic clock to recorded timestamp
            // 2. Dispatch event to handlers
            // 3. Verify outputs match expected

            tokio::time::sleep(tokio::time::Duration::from_millis(1)).await;
        }

        info!("Replay complete");
        Ok(())
    }

    /// Get events by type
    pub fn events_by_type(&self, event_type: EventType) -> Vec<&RecordedEvent> {
        self.events
            .iter()
            .filter(|r| r.event.event_type == event_type)
            .collect()
    }

    /// Get events in time range
    pub fn events_in_range(&self, start: i64, end: i64) -> Vec<&RecordedEvent> {
        self.events
            .iter()
            .filter(|r| r.timestamp >= start && r.timestamp <= end)
            .collect()
    }
}

/// Session recorder for creating recordings
pub struct SessionRecorder {
    /// Output file
    writer: BufWriter<File>,
    /// Event counter
    sequence: u64,
    /// Session header (written on first event)
    header_written: bool,
    /// Configuration
    config: SessionConfig,
    /// Model versions
    model_versions: HashMap<String, String>,
    /// Random seed
    seed: u64,
}

impl SessionRecorder {
    /// Create a new session recorder
    pub fn new(path: &str, config: SessionConfig) -> Result<Self> {
        let file = File::create(path)?;
        let writer = BufWriter::new(file);

        Ok(Self {
            writer,
            sequence: 0,
            header_written: false,
            config,
            model_versions: HashMap::new(),
            seed: rand::random(),
        })
    }

    /// Set model versions for reproducibility
    pub fn set_model_version(&mut self, model: String, version: String) {
        self.model_versions.insert(model, version);
    }

    /// Set random seed
    pub fn set_seed(&mut self, seed: u64) {
        self.seed = seed;
    }

    /// Record an event
    pub fn record(&mut self, event: Event) -> Result<()> {
        // Write header on first event
        if !self.header_written {
            let header = SessionHeader {
                version: "1.0".to_string(),
                created_at: chrono::Utc::now().to_rfc3339(),
                kernel_version: env!("CARGO_PKG_VERSION").to_string(),
                config: self.config.clone(),
                model_versions: self.model_versions.clone(),
                seed: self.seed,
            };

            writeln!(self.writer, "{}", serde_json::to_string(&header)?)?;
            self.header_written = true;
        }

        let recorded = RecordedEvent {
            sequence: self.sequence,
            timestamp: event.timestamp.timestamp_millis(),
            event,
        };

        writeln!(self.writer, "{}", serde_json::to_string(&recorded)?)?;
        self.sequence += 1;

        Ok(())
    }

    /// Flush and finalize recording
    pub fn finalize(&mut self) -> Result<()> {
        self.writer.flush()?;
        info!(
            events = self.sequence,
            "Session recording finalized"
        );
        Ok(())
    }
}

use std::collections::HashMap;
use rand::SeedableRng;

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;

    #[test]
    fn test_session_recorder() {
        let temp = NamedTempFile::new().unwrap();
        let path = temp.path().to_str().unwrap();

        let config = SessionConfig {
            ram_budget_mb: 4096,
            policy_mode: "review".to_string(),
            max_concurrent_tasks: 4,
        };

        let mut recorder = SessionRecorder::new(path, config).unwrap();
        recorder.set_seed(42);

        let event = Event::new(
            EventType::TaskRequested,
            "test",
            serde_json::json!({"task": "test"}),
        );

        recorder.record(event).unwrap();
        recorder.finalize().unwrap();
    }

    #[test]
    fn test_replay_engine() {
        let temp = NamedTempFile::new().unwrap();
        let path = temp.path().to_str().unwrap();

        // Create recording
        let config = SessionConfig {
            ram_budget_mb: 4096,
            policy_mode: "review".to_string(),
            max_concurrent_tasks: 4,
        };

        let mut recorder = SessionRecorder::new(path, config).unwrap();
        recorder.set_seed(42);

        recorder.record(Event::new(EventType::TaskRequested, "test", serde_json::json!({}))).unwrap();
        recorder.record(Event::new(EventType::TaskStarted, "test", serde_json::json!({}))).unwrap();
        recorder.record(Event::new(EventType::TaskCompleted, "test", serde_json::json!({}))).unwrap();

        recorder.finalize().unwrap();

        // Replay
        let mut engine = ReplayEngine::new(path).unwrap();
        assert_eq!(engine.event_count(), 3);

        let first = engine.next().unwrap();
        assert_eq!(first.event.event_type, EventType::TaskRequested);

        engine.seek(2);
        let third = engine.next().unwrap();
        assert_eq!(third.event.event_type, EventType::TaskCompleted);
    }
}
