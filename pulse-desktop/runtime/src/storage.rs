//! PULSE Runtime Kernel - Storage Engine
//!
//! SQLite-based persistent storage with atomic writes.

use anyhow::Result;
use rusqlite::{Connection, params};
use serde::{Serialize, de::DeserializeOwned};
use std::path::Path;
use std::sync::{Arc, Mutex};
use tracing::{info, debug};

/// Storage engine wrapper
pub struct StorageEngine {
    conn: Arc<Mutex<Connection>>,
    path: String,
}

impl StorageEngine {
    /// Create a new storage engine
    pub fn new(path: &str) -> Result<Self> {
        let conn = Connection::open(path)?;
        
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
            path: path.to_string(),
        })
    }

    /// Initialize database schema
    pub async fn initialize(&self) -> Result<()> {
        info!("Initializing storage at {}", self.path);

        let conn = self.conn.lock().unwrap();

        conn.execute_batch(r#"
            -- Events table
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                event_type TEXT NOT NULL,
                source_id TEXT NOT NULL,
                payload TEXT,
                timestamp TEXT NOT NULL,
                metadata TEXT
            );

            -- Tasks table
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                task_type TEXT,
                priority INTEGER,
                status TEXT,
                payload TEXT,
                source_id TEXT,
                result TEXT,
                error TEXT,
                created_at TEXT,
                started_at TEXT,
                completed_at TEXT
            );

            -- Agents table
            CREATE TABLE IF NOT EXISTS agents (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                status TEXT,
                health TEXT,
                config TEXT,
                last_heartbeat TEXT,
                created_at TEXT
            );

            -- Modules table
            CREATE TABLE IF NOT EXISTS modules (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                version TEXT,
                status TEXT,
                manifest TEXT,
                enabled INTEGER,
                created_at TEXT
            );

            -- Capabilities table
            CREATE TABLE IF NOT EXISTS capabilities (
                id TEXT PRIMARY KEY,
                entity_id TEXT NOT NULL,
                entity_type TEXT,
                capabilities TEXT,
                created_at TEXT,
                expires_at TEXT
            );

            -- Memory/Context table
            CREATE TABLE IF NOT EXISTS memory (
                id TEXT PRIMARY KEY,
                key TEXT UNIQUE NOT NULL,
                value TEXT,
                memory_type TEXT,
                importance REAL,
                access_count INTEGER,
                last_accessed TEXT,
                created_at TEXT
            );

            -- Artifacts table (for replay)
            CREATE TABLE IF NOT EXISTS artifacts (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                event_id TEXT,
                artifact_type TEXT,
                content TEXT,
                created_at TEXT
            );

            -- Checkpoints table
            CREATE TABLE IF NOT EXISTS checkpoints (
                id TEXT PRIMARY KEY,
                entity_type TEXT,
                entity_id TEXT,
                state TEXT,
                version INTEGER,
                created_at TEXT
            );

            -- Metrics table
            CREATE TABLE IF NOT EXISTS metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                metric_type TEXT NOT NULL,
                value REAL,
                timestamp TEXT,
                tags TEXT
            );

            -- Create indexes
            CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
            CREATE INDEX IF NOT EXISTS idx_events_source ON events(source_id);
            CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
            CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
            CREATE INDEX IF NOT EXISTS idx_memory_type ON memory(memory_type);
            CREATE INDEX IF NOT EXISTS idx_metrics_type ON metrics(metric_type);
        "#)?;

        info!("Database schema initialized");
        Ok(())
    }

    /// Store an event
    pub async fn store_event(&self, event: &crate::event::Event) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        conn.execute(
            "INSERT OR REPLACE INTO events (id, event_type, source_id, payload, timestamp, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                event.id,
                event.event_type.to_string(),
                event.source_id,
                serde_json::to_string(&event.payload)?,
                event.timestamp.to_rfc3339(),
                serde_json::to_string(&event.metadata)?,
            ],
        )?;

        Ok(())
    }

    /// Get events by type
    pub async fn get_events_by_type(&self, event_type: &str, limit: usize) -> Result<Vec<crate::event::Event>> {
        let conn = self.conn.lock().unwrap();
        
        let mut stmt = conn.prepare(
            "SELECT id, event_type, source_id, payload, timestamp, metadata 
             FROM events WHERE event_type = ?1 
             ORDER BY timestamp DESC LIMIT ?2"
        )?;

        let events = stmt.query_map(params![event_type, limit as i32], |row| {
            Ok(crate::event::Event {
                id: row.get(0)?,
                event_type: row.get::<_, String>(1)?.parse().unwrap_or(crate::event::EventType::Error),
                source_id: row.get(2)?,
                payload: serde_json::from_str(&row.get::<_, String>(3)?).unwrap_or_default(),
                timestamp: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                    .map(|dt| dt.with_timezone(&chrono::Utc))
                    .unwrap_or_else(|_| chrono::Utc::now()),
                metadata: serde_json::from_str(&row.get::<_, String>(5)?).unwrap_or_default(),
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(events)
    }

    /// Store a task
    pub async fn store_task(&self, task: &crate::scheduler::Task) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        conn.execute(
            "INSERT OR REPLACE INTO tasks (id, name, task_type, priority, status, payload, source_id, result, error, created_at, started_at, completed_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                task.id,
                task.name,
                task.task_type,
                task.priority as i32,
                format!("{:?}", task.status),
                serde_json::to_string(&task.payload)?,
                task.source_id,
                task.result.as_ref().map(|r| serde_json::to_string(r).unwrap_or_default()),
                task.error,
                task.created_at.to_rfc3339(),
                task.started_at.map(|t| t.to_rfc3339()),
                task.completed_at.map(|t| t.to_rfc3339()),
            ],
        )?;

        Ok(())
    }

    /// Store memory entry
    pub async fn store_memory(&self, key: &str, value: &str, memory_type: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        conn.execute(
            "INSERT INTO memory (id, key, value, memory_type, importance, access_count, last_accessed, created_at)
             VALUES (?1, ?2, ?3, ?4, 0.5, 0, datetime('now'), datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, last_accessed = datetime('now'), access_count = access_count + 1",
            params![
                uuid::Uuid::new_v4().to_string(),
                key,
                value,
                memory_type,
            ],
        )?;

        Ok(())
    }

    /// Get memory entry
    pub async fn get_memory(&self, key: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        
        let mut stmt = conn.prepare(
            "SELECT value FROM memory WHERE key = ?1"
        )?;

        let result = stmt.query_row(params![key], |row| row.get::<_, String>(0)).ok();

        // Update access count
        if result.is_some() {
            conn.execute(
                "UPDATE memory SET access_count = access_count + 1, last_accessed = datetime('now') WHERE key = ?1",
                params![key],
            )?;
        }

        Ok(result)
    }

    /// Store a checkpoint
    pub async fn store_checkpoint(&self, entity_type: &str, entity_id: &str, state: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        conn.execute(
            "INSERT INTO checkpoints (id, entity_type, entity_id, state, version, created_at)
             VALUES (?1, ?2, ?3, ?4, 1, datetime('now'))
             ON CONFLICT(entity_type, entity_id) DO UPDATE SET state = excluded.state, version = version + 1",
            params![
                uuid::Uuid::new_v4().to_string(),
                entity_type,
                entity_id,
                state,
            ],
        )?;

        Ok(())
    }

    /// Get latest checkpoint
    pub async fn get_checkpoint(&self, entity_type: &str, entity_id: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        
        let mut stmt = conn.prepare(
            "SELECT state FROM checkpoints WHERE entity_type = ?1 AND entity_id = ?2 ORDER BY version DESC LIMIT 1"
        )?;

        let result = stmt.query_row(params![entity_type, entity_id], |row| row.get::<_, String>(0)).ok();

        Ok(result)
    }

    /// Record metric
    pub async fn record_metric(&self, metric_type: &str, value: f64, tags: Option<&str>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        conn.execute(
            "INSERT INTO metrics (metric_type, value, timestamp, tags) VALUES (?1, ?2, datetime('now'), ?3)",
            params![metric_type, value, tags],
        )?;

        Ok(())
    }

    /// Get metrics
    pub async fn get_metrics(&self, metric_type: &str, limit: usize) -> Result<Vec<(f64, chrono::DateTime<chrono::Utc>)>> {
        let conn = self.conn.lock().unwrap();
        
        let mut stmt = conn.prepare(
            "SELECT value, timestamp FROM metrics WHERE metric_type = ?1 ORDER BY timestamp DESC LIMIT ?2"
        )?;

        let metrics = stmt.query_map(params![metric_type, limit as i32], |row| {
            let value: f64 = row.get(0)?;
            let ts: String = row.get(1)?;
            let dt = chrono::DateTime::parse_from_rfc3339(&ts)
                .map(|dt| dt.with_timezone(&chrono::Utc))
                .unwrap_or_else(|_| chrono::Utc::now());
            Ok((value, dt))
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(metrics)
    }

    /// Close the storage connection
    pub fn close(&self) -> Result<()> {
        // Connection will be closed when dropped
        info!("Storage closed");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;

    #[tokio::test]
    async fn test_storage_init() {
        let temp = NamedTempFile::new().unwrap();
        let storage = StorageEngine::new(temp.path().to_str().unwrap()).unwrap();
        storage.initialize().await.unwrap();
    }

    #[tokio::test]
    async fn test_memory_storage() {
        let temp = NamedTempFile::new().unwrap();
        let storage = StorageEngine::new(temp.path().to_str().unwrap()).unwrap();
        storage.initialize().await.unwrap();

        storage.store_memory("test-key", "test-value", "fact").await.unwrap();
        let value = storage.get_memory("test-key").await.unwrap();
        assert_eq!(value, Some("test-value".to_string()));
    }
}
