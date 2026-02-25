//! Agent Memory Persistence
//! 
//! SQLite-backed memory for agent context across sessions.

use rusqlite::{Connection, params, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::agents::{WorkInProgress, ToolCall, AgentError};

/// Agent memory store
pub struct AgentMemory {
    db: Connection,
}

/// Conversation record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: i64,
    pub agent_id: String,
    pub session_id: String,
    pub timestamp: i64,
    pub user_message: String,
    pub agent_response: String,
    pub tool_calls: Vec<ToolCall>,
    pub context_summary: Option<String>,
    pub files_modified: Vec<String>,
}

impl AgentMemory {
    /// Create new memory store
    pub fn new() -> Result<Self, AgentError> {
        Self::with_path("kyro_agent_memory.db")
    }
    
    /// Create with custom path
    pub fn with_path(path: &str) -> Result<Self, AgentError> {
        let db_path = PathBuf::from(path);
        let db = Connection::open(&db_path)
            .map_err(|e| AgentError::DatabaseError(e.to_string()))?;
        
        // Create tables
        db.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                user_message TEXT,
                agent_response TEXT,
                tool_calls TEXT,
                context_summary TEXT,
                files_modified TEXT
            );
            
            CREATE TABLE IF NOT EXISTS work_in_progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id TEXT NOT NULL,
                task_description TEXT,
                current_file TEXT,
                line_number INTEGER,
                status TEXT,
                last_updated INTEGER
            );
            
            CREATE INDEX IF NOT EXISTS idx_conversations_agent 
            ON conversations(agent_id, timestamp DESC);
            
            CREATE INDEX IF NOT EXISTS idx_wip_agent 
            ON work_in_progress(agent_id, last_updated DESC);
            "#,
        )
        .map_err(|e| AgentError::DatabaseError(e.to_string()))?;
        
        Ok(Self { db })
    }
    
    /// Save a conversation turn
    pub fn save_conversation(
        &self,
        agent_id: &str,
        session_id: &str,
        user_msg: &str,
        agent_resp: &str,
        tools: &[ToolCall],
        files: &[String],
    ) -> Result<i64, AgentError> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        
        let tools_json = serde_json::to_string(tools).unwrap_or_default();
        let files_json = serde_json::to_string(files).unwrap_or_default();
        
        self.db.execute(
            r#"
            INSERT INTO conversations 
            (agent_id, session_id, timestamp, user_message, agent_response, tool_calls, files_modified)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            "#,
            params![agent_id, session_id, timestamp, user_msg, agent_resp, tools_json, files_json],
        )
        .map_err(|e| AgentError::DatabaseError(e.to_string()))?;
        
        Ok(self.db.last_insert_rowid())
    }
    
    /// Get recent conversations for context
    pub fn get_recent_context(&self, agent_id: &str, limit: usize) -> Result<Vec<Conversation>, AgentError> {
        let mut stmt = self.db.prepare(
            r#"
            SELECT id, agent_id, session_id, timestamp, user_message, agent_response, 
                   tool_calls, context_summary, files_modified
            FROM conversations 
            WHERE agent_id = ?1 
            ORDER BY timestamp DESC 
            LIMIT ?2
            "#,
        )
        .map_err(|e| AgentError::DatabaseError(e.to_string()))?;
        
        let conversations = stmt
            .query_map(params![agent_id, limit as i64], |row| {
                let tool_calls_json: String = row.get(6)?;
                let files_json: String = row.get(8)?;
                
                Ok(Conversation {
                    id: row.get(0)?,
                    agent_id: row.get(1)?,
                    session_id: row.get(2)?,
                    timestamp: row.get(3)?,
                    user_message: row.get(4)?,
                    agent_response: row.get(5)?,
                    tool_calls: serde_json::from_str(&tool_calls_json).unwrap_or_default(),
                    context_summary: row.get(7)?,
                    files_modified: serde_json::from_str(&files_json).unwrap_or_default(),
                })
            })
            .map_err(|e| AgentError::DatabaseError(e.to_string()))?
            .filter_map(Result::ok)
            .collect();
        
        Ok(conversations)
    }
    
    /// Generate condensed context summary for agent
    pub fn get_context_summary(&self, agent_id: &str) -> Result<String, AgentError> {
        let conversations = self.get_recent_context(agent_id, 5)?;
        
        if conversations.is_empty() {
            return Ok("No previous context available.".to_string());
        }
        
        let mut summary = String::from("Recent activity:\n");
        
        for conv in conversations.iter().rev() {
            summary.push_str(&format!(
                "- User: {}\n  Agent: {}\n",
                &conv.user_message.chars().take(100).collect::<String>(),
                &conv.agent_response.chars().take(100).collect::<String>()
            ));
            
            if !conv.files_modified.is_empty() {
                summary.push_str(&format!("  Files: {}\n", conv.files_modified.join(", ")));
            }
        }
        
        Ok(summary)
    }
    
    /// Save work in progress
    pub fn save_wip(
        &self,
        agent_id: &str,
        task: &str,
        file: &str,
        line: usize,
    ) -> Result<(), AgentError> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        
        self.db.execute(
            r#"
            INSERT INTO work_in_progress 
            (agent_id, task_description, current_file, line_number, status, last_updated)
            VALUES (?1, ?2, ?3, ?4, 'in_progress', ?5)
            "#,
            params![agent_id, task, file, line as i64, timestamp],
        )
        .map_err(|e| AgentError::DatabaseError(e.to_string()))?;
        
        Ok(())
    }
    
    /// Get current work in progress
    pub fn get_wip(&self, agent_id: &str) -> Result<Option<WorkInProgress>, AgentError> {
        let mut stmt = self.db.prepare(
            r#"
            SELECT task_description, current_file, line_number, status 
            FROM work_in_progress 
            WHERE agent_id = ?1 AND status = 'in_progress'
            ORDER BY last_updated DESC 
            LIMIT 1
            "#,
        )
        .map_err(|e| AgentError::DatabaseError(e.to_string()))?;
        
        let wip = stmt
            .query_row(params![agent_id], |row| {
                Ok(WorkInProgress {
                    task: row.get(0)?,
                    file: row.get(1)?,
                    line: row.get(2)?,
                    status: row.get(3)?,
                })
            })
            .optional()
            .map_err(|e| AgentError::DatabaseError(e.to_string()))?;
        
        Ok(wip)
    }
    
    /// Mark work as completed
    pub fn complete_wip(&self, agent_id: &str) -> Result<(), AgentError> {
        self.db.execute(
            r#"
            UPDATE work_in_progress 
            SET status = 'completed' 
            WHERE agent_id = ?1 AND status = 'in_progress'
            "#,
            params![agent_id],
        )
        .map_err(|e| AgentError::DatabaseError(e.to_string()))?;
        
        Ok(())
    }
    
    /// Clear old conversations (keep last N days)
    pub fn cleanup_old_conversations(&self, days: u64) -> Result<usize, AgentError> {
        let cutoff = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0)
            - (days * 86400) as i64;
        
        let affected = self.db.execute(
            "DELETE FROM conversations WHERE timestamp < ?1",
            params![cutoff],
        )
        .map_err(|e| AgentError::DatabaseError(e.to_string()))?;
        
        Ok(affected)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_memory_persistence() {
        let mem = AgentMemory::with_path(":memory:").unwrap();
        
        mem.save_conversation(
            "test-agent",
            "session-1",
            "Hello",
            "Hi there!",
            &[],
            &[],
        ).unwrap();
        
        let ctx = mem.get_recent_context("test-agent", 10).unwrap();
        assert_eq!(ctx.len(), 1);
    }
}
