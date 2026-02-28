//! Session Management
//! 
//! Handles user sessions for authentication persistence

use crate::auth::{User, Claims};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Session store for managing active sessions
pub struct SessionStore {
    sessions: HashMap<Uuid, UserSession>,
    user_sessions: HashMap<Uuid, Vec<Uuid>>, // user_id -> session_ids
}

/// User session data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSession {
    pub id: Uuid,
    pub user_id: Uuid,
    pub refresh_token_hash: String,
    pub device_info: Option<DeviceInfo>,
    pub ip_address: Option<String>,
    pub created_at: DateTime<Utc>,
    pub last_activity: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

/// Device information for session tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub user_agent: String,
    pub platform: String,
    pub device_name: Option<String>,
}

impl SessionStore {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
            user_sessions: HashMap::new(),
        }
    }

    /// Create a new session
    pub fn create_session(
        &mut self,
        user_id: Uuid,
        refresh_token_hash: String,
        device_info: Option<DeviceInfo>,
        ip_address: Option<String>,
        expires_in_seconds: i64,
    ) -> Uuid {
        let session_id = Uuid::new_v4();
        let now = Utc::now();

        let session = UserSession {
            id: session_id,
            user_id,
            refresh_token_hash,
            device_info,
            ip_address,
            created_at: now,
            last_activity: now,
            expires_at: now + chrono::Duration::seconds(expires_in_seconds),
        };

        self.sessions.insert(session_id, session);
        
        // Track user's sessions
        self.user_sessions
            .entry(user_id)
            .or_insert_with(Vec::new)
            .push(session_id);

        session_id
    }

    /// Get session by ID
    pub fn get_session(&self, session_id: Uuid) -> Option<&UserSession> {
        self.sessions.get(&session_id)
    }

    /// Get all sessions for a user
    pub fn get_user_sessions(&self, user_id: Uuid) -> Vec<&UserSession> {
        self.user_sessions
            .get(&user_id)
            .map(|ids| {
                ids.iter()
                    .filter_map(|id| self.sessions.get(id))
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Update session activity
    pub fn touch_session(&mut self, session_id: Uuid) {
        if let Some(session) = self.sessions.get_mut(&session_id) {
            session.last_activity = Utc::now();
        }
    }

    /// Invalidate a session
    pub fn invalidate_session(&mut self, session_id: Uuid) {
        if let Some(session) = self.sessions.remove(&session_id) {
            if let Some(sessions) = self.user_sessions.get_mut(&session.user_id) {
                sessions.retain(|id| id != &session_id);
            }
        }
    }

    /// Invalidate all sessions for a user
    pub fn invalidate_user_sessions(&mut self, user_id: Uuid) {
        if let Some(session_ids) = self.user_sessions.remove(&user_id) {
            for session_id in session_ids {
                self.sessions.remove(&session_id);
            }
        }
    }

    /// Clean up expired sessions
    pub fn cleanup_expired(&mut self) -> usize {
        let now = Utc::now();
        let expired: Vec<Uuid> = self.sessions
            .iter()
            .filter(|(_, session)| session.expires_at < now)
            .map(|(id, _)| *id)
            .collect();

        let count = expired.len();
        for session_id in expired {
            self.invalidate_session(session_id);
        }

        count
    }

    /// Count active sessions
    pub fn active_count(&self) -> usize {
        self.sessions.len()
    }
}

impl Default for SessionStore {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_creation() {
        let mut store = SessionStore::new();
        let user_id = Uuid::new_v4();
        
        let session_id = store.create_session(
            user_id,
            "hash123".to_string(),
            None,
            None,
            3600,
        );

        assert!(store.get_session(session_id).is_some());
        assert_eq!(store.active_count(), 1);
    }

    #[test]
    fn test_session_invalidation() {
        let mut store = SessionStore::new();
        let user_id = Uuid::new_v4();
        
        let session_id = store.create_session(
            user_id,
            "hash123".to_string(),
            None,
            None,
            3600,
        );

        store.invalidate_session(session_id);
        assert!(store.get_session(session_id).is_none());
    }
}
