//! Learning Flywheel — SQLite Feedback Database
//!
//! Records every AI suggestion along with whether the user accepted,
//! rejected, or corrected it. Over time this lets us surface quality
//! metrics and tune model/prompt selection.

use anyhow::Result;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

/// A single AI suggestion record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Suggestion {
    pub id: i64,
    pub model: String,
    pub task_kind: String,
    pub prompt_hash: String,
    pub prompt_preview: String,
    pub response_preview: String,
    pub tokens_used: u32,
    pub latency_ms: u32,
    pub outcome: Outcome,
    pub user_fix: Option<String>,
    pub created_at: String,
}

/// What the user did with a suggestion
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Outcome {
    Pending,
    Accepted,
    Rejected,
    Corrected,
}

impl std::fmt::Display for Outcome {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Outcome::Pending => write!(f, "pending"),
            Outcome::Accepted => write!(f, "accepted"),
            Outcome::Rejected => write!(f, "rejected"),
            Outcome::Corrected => write!(f, "corrected"),
        }
    }
}

impl Outcome {
    fn from_str(s: &str) -> Self {
        match s {
            "accepted" => Self::Accepted,
            "rejected" => Self::Rejected,
            "corrected" => Self::Corrected,
            _ => Self::Pending,
        }
    }
}

/// Aggregate stats for a model or task
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeedbackStats {
    pub total: u64,
    pub accepted: u64,
    pub rejected: u64,
    pub corrected: u64,
    pub pending: u64,
    pub accept_rate: f64,
    pub avg_latency_ms: f64,
}

/// The feedback database
pub struct FeedbackDB {
    conn: Mutex<Connection>,
}

impl FeedbackDB {
    /// Open (or create) the feedback database at the given path
    pub fn open(path: &PathBuf) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path)?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS suggestions (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                model       TEXT NOT NULL,
                task_kind   TEXT NOT NULL,
                prompt_hash TEXT NOT NULL,
                prompt_preview TEXT NOT NULL DEFAULT '',
                response_preview TEXT NOT NULL DEFAULT '',
                tokens_used INTEGER NOT NULL DEFAULT 0,
                latency_ms  INTEGER NOT NULL DEFAULT 0,
                outcome     TEXT NOT NULL DEFAULT 'pending',
                user_fix    TEXT,
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_suggestions_model ON suggestions(model);
            CREATE INDEX IF NOT EXISTS idx_suggestions_task ON suggestions(task_kind);
            CREATE INDEX IF NOT EXISTS idx_suggestions_outcome ON suggestions(outcome);",
        )?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Open the default feedback DB location
    pub fn open_default() -> Result<Self> {
        let path = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("kyro-ide")
            .join("feedback.db");
        Self::open(&path)
    }

    /// Record a new suggestion (outcome starts as Pending)
    pub fn log_suggestion(
        &self,
        model: &str,
        task_kind: &str,
        prompt_hash: &str,
        prompt_preview: &str,
        response_preview: &str,
        tokens_used: u32,
        latency_ms: u32,
    ) -> Result<i64> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| anyhow::anyhow!("lock: {}", e))?;
        conn.execute(
            "INSERT INTO suggestions (model, task_kind, prompt_hash, prompt_preview, response_preview, tokens_used, latency_ms)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![model, task_kind, prompt_hash,
                    &prompt_preview[..prompt_preview.len().min(500)],
                    &response_preview[..response_preview.len().min(500)],
                    tokens_used, latency_ms],
        )?;
        Ok(conn.last_insert_rowid())
    }

    /// Mark a suggestion as accepted
    pub fn accept(&self, id: i64) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| anyhow::anyhow!("lock: {}", e))?;
        conn.execute(
            "UPDATE suggestions SET outcome = 'accepted' WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    }

    /// Mark a suggestion as rejected
    pub fn reject(&self, id: i64) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| anyhow::anyhow!("lock: {}", e))?;
        conn.execute(
            "UPDATE suggestions SET outcome = 'rejected' WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    }

    /// Mark a suggestion as corrected and store the user's fix
    pub fn correct(&self, id: i64, user_fix: &str) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| anyhow::anyhow!("lock: {}", e))?;
        conn.execute(
            "UPDATE suggestions SET outcome = 'corrected', user_fix = ?2 WHERE id = ?1",
            params![id, user_fix],
        )?;
        Ok(())
    }

    /// Get aggregate stats, optionally filtered by model and/or task
    pub fn stats(&self, model: Option<&str>, task_kind: Option<&str>) -> Result<FeedbackStats> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| anyhow::anyhow!("lock: {}", e))?;
        let mut sql = String::from(
            "SELECT COUNT(*) as total,
                    SUM(CASE WHEN outcome='accepted' THEN 1 ELSE 0 END),
                    SUM(CASE WHEN outcome='rejected' THEN 1 ELSE 0 END),
                    SUM(CASE WHEN outcome='corrected' THEN 1 ELSE 0 END),
                    SUM(CASE WHEN outcome='pending' THEN 1 ELSE 0 END),
                    AVG(latency_ms)
             FROM suggestions WHERE 1=1",
        );
        let mut binds: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        if let Some(m) = model {
            sql.push_str(" AND model = ?");
            binds.push(Box::new(m.to_string()));
        }
        if let Some(t) = task_kind {
            sql.push_str(" AND task_kind = ?");
            binds.push(Box::new(t.to_string()));
        }

        let params_refs: Vec<&dyn rusqlite::types::ToSql> =
            binds.iter().map(|b| b.as_ref()).collect();
        let mut stmt = conn.prepare(&sql)?;
        let row = stmt.query_row(params_refs.as_slice(), |row| {
            let total: u64 = row.get(0)?;
            let accepted: u64 = row.get::<_, Option<u64>>(1)?.unwrap_or(0);
            let rejected: u64 = row.get::<_, Option<u64>>(2)?.unwrap_or(0);
            let corrected: u64 = row.get::<_, Option<u64>>(3)?.unwrap_or(0);
            let pending: u64 = row.get::<_, Option<u64>>(4)?.unwrap_or(0);
            let avg_lat: f64 = row.get::<_, Option<f64>>(5)?.unwrap_or(0.0);
            Ok(FeedbackStats {
                total,
                accepted,
                rejected,
                corrected,
                pending,
                accept_rate: if total > 0 {
                    accepted as f64 / total as f64
                } else {
                    0.0
                },
                avg_latency_ms: avg_lat,
            })
        })?;
        Ok(row)
    }

    /// Get recent suggestions (newest first)
    pub fn recent(&self, limit: u32) -> Result<Vec<Suggestion>> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| anyhow::anyhow!("lock: {}", e))?;
        let mut stmt = conn.prepare(
            "SELECT id, model, task_kind, prompt_hash, prompt_preview, response_preview,
                    tokens_used, latency_ms, outcome, user_fix, created_at
             FROM suggestions ORDER BY id DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit], |row| {
            Ok(Suggestion {
                id: row.get(0)?,
                model: row.get(1)?,
                task_kind: row.get(2)?,
                prompt_hash: row.get(3)?,
                prompt_preview: row.get(4)?,
                response_preview: row.get(5)?,
                tokens_used: row.get(6)?,
                latency_ms: row.get(7)?,
                outcome: Outcome::from_str(&row.get::<_, String>(8)?),
                user_fix: row.get(9)?,
                created_at: row.get(10)?,
            })
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }
}
