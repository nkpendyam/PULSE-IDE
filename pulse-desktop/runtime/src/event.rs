//! PULSE Runtime Kernel - Event System
//!
//! Versioned event schema with priority queue processing.

use anyhow::Result;
use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use tracing::{debug, trace};

/// Event types supported by the kernel
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum EventType {
    // Kernel events
    KernelShutdown,
    KernelPause,
    KernelResume,

    // Task events
    TaskRequested,
    TaskStarted,
    TaskCompleted,
    TaskFailed,

    // Plan events (PicoClaw)
    PlanProposed,
    PlanQueued,
    PlanApproved,
    PlanRejected,
    PlanExecuted,

    // Model events
    ModelLoad,
    ModelUnload,
    ModelCall,
    ModelResponse,

    // Agent events
    AgentSpawn,
    AgentTerminate,
    AgentHeartbeat,
    AgentError,

    // Memory events
    MemorySwap,
    MemoryPressure,

    // Module events
    ModuleInstall,
    ModuleLoad,
    ModuleUnload,
    ModuleError,

    // Error event
    Error,
}

impl std::fmt::Display for EventType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

/// Event priority levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum Priority {
    Low = 0,
    Normal = 1,
    High = 2,
    Critical = 3,
}

impl Default for Priority {
    fn default() -> Self {
        Self::Normal
    }
}

/// Event structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    /// Unique event identifier
    pub id: String,
    /// Event type
    pub event_type: EventType,
    /// Source entity ID
    pub source_id: String,
    /// Event payload
    pub payload: serde_json::Value,
    /// Event timestamp
    pub timestamp: chrono::DateTime<chrono::Utc>,
    /// Additional metadata
    pub metadata: serde_json::Value,
}

impl Event {
    /// Create a new event
    pub fn new(
        event_type: EventType,
        source_id: impl Into<String>,
        payload: serde_json::Value,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            event_type,
            source_id: source_id.into(),
            payload,
            timestamp: chrono::Utc::now(),
            metadata: serde_json::Value::Null,
        }
    }

    /// Add metadata to the event
    pub fn with_metadata(mut self, metadata: serde_json::Value) -> Self {
        self.metadata = metadata;
        self
    }
}

/// Event handler type
type EventHandler = Box<dyn Fn(Event) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>> + Send + Sync>;

/// Priority-queued event with timestamp for ordering
struct QueuedEvent {
    event: Event,
    priority: Priority,
    sequence: u64,
}

/// Event bus with priority queue and subscriptions
pub struct EventBus {
    queue: Arc<RwLock<Vec<QueuedEvent>>>,
    subscribers: Arc<RwLock<HashMap<EventType, Vec<EventHandler>>>>,
    tx: mpsc::Sender<Event>,
    rx: Option<mpsc::Receiver<Event>>,
    sequence: Arc<RwLock<u64>>,
    running: Arc<RwLock<bool>>,
}

impl EventBus {
    /// Create a new event bus
    pub fn new() -> Self {
        let (tx, rx) = mpsc::channel(1024);
        Self {
            queue: Arc::new(RwLock::new(Vec::new())),
            subscribers: Arc::new(RwLock::new(HashMap::new())),
            tx,
            rx: Some(rx),
            sequence: Arc::new(RwLock::new(0)),
            running: Arc::new(RwLock::new(true)),
        }
    }

    /// Publish an event to the bus
    pub fn publish(&self, event: Event) -> Result<()> {
        let seq = {
            let mut seq = self.sequence.blocking_write();
            *seq += 1;
            *seq
        };

        let queue = Arc::clone(&self.queue);
        tokio::spawn(async move {
            let mut q = queue.write().await;
            q.push(QueuedEvent {
                event,
                priority: Priority::Normal,
                sequence: seq,
            });
        });

        Ok(())
    }

    /// Publish an event with priority
    pub fn publish_with_priority(&self, event: Event, priority: Priority) -> Result<()> {
        let seq = {
            let mut seq = self.sequence.blocking_write();
            *seq += 1;
            *seq
        };

        let queue = Arc::clone(&self.queue);
        tokio::spawn(async move {
            let mut q = queue.write().await;
            q.push(QueuedEvent {
                event,
                priority,
                sequence: seq,
            });
        });

        Ok(())
    }

    /// Subscribe to an event type
    pub fn subscribe<F, Fut>(&self, event_type: EventType, handler: F) -> Result<()>
    where
        F: Fn(Event) -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = ()> + Send + 'static,
    {
        let subscribers = Arc::clone(&self.subscribers);
        tokio::spawn(async move {
            let mut subs = subscribers.write().await;
            subs.entry(event_type)
                .or_insert_with(Vec::new)
                .push(Box::new(move |e| Box::pin(handler(e))));
        });
        Ok(())
    }

    /// Receive the next event from the queue
    pub async fn recv(&self) -> Option<Event> {
        let rx = self.rx.as_ref()?;
        let mut rx = rx.lock().await;
        rx.recv().await
    }

    /// Get queue length
    pub fn queue_length(&self) -> usize {
        self.queue.blocking_read().len()
    }

    /// Shutdown the event bus
    pub fn shutdown(&self) {
        let running = Arc::clone(&self.running);
        tokio::spawn(async move {
            let mut r = running.write().await;
            *r = false;
        });
    }
}

impl Default for EventBus {
    fn default() -> Self {
        Self::new()
    }
}

/// Event schema for validation
pub struct EventSchema {
    schema: jsonschema::JSONSchema,
}

impl EventSchema {
    /// Create event schema from JSON Schema definition
    pub fn new(schema_json: &str) -> Result<Self> {
        let schema = serde_json::from_str(schema_json)?;
        let compiled = jsonschema::JSONSchema::compile(&schema)?;
        Ok(Self { schema: compiled })
    }

    /// Validate an event against the schema
    pub fn validate(&self, event: &Event) -> Result<()> {
        let event_json = serde_json::to_value(event)?;
        let result = self.schema.validate(&event_json);
        
        if let Err(errors) = result {
            let error_messages: Vec<String> = errors.map(|e| e.to_string()).collect();
            anyhow::bail!("Event validation failed: {}", error_messages.join(", "));
        }
        
        Ok(())
    }
}

/// Default event schema
pub const DEFAULT_EVENT_SCHEMA: &str = r#"
{
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["id", "event_type", "source_id", "timestamp"],
    "properties": {
        "id": { "type": "string", "format": "uuid" },
        "event_type": { "type": "string" },
        "source_id": { "type": "string" },
        "payload": {},
        "timestamp": { "type": "string", "format": "date-time" },
        "metadata": {}
    }
}
"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_event_creation() {
        let event = Event::new(
            EventType::TaskRequested,
            "test-agent",
            serde_json::json!({"task": "test"}),
        );
        
        assert_eq!(event.event_type, EventType::TaskRequested);
        assert_eq!(event.source_id, "test-agent");
    }

    #[test]
    fn test_event_schema_validation() {
        let schema = EventSchema::new(DEFAULT_EVENT_SCHEMA).unwrap();
        let event = Event::new(
            EventType::TaskRequested,
            "test",
            serde_json::json!({}),
        );
        
        assert!(schema.validate(&event).is_ok());
    }
}
