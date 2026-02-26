//! Awareness protocol for real-time collaboration
//!
//! Tracks cursor positions, selections, and user presence

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Awareness protocol for tracking user states
pub struct AwarenessProtocol {
    states: HashMap<String, UserState>,
    version: u64,
}

/// User state in collaboration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserState {
    pub user_id: String,
    pub name: String,
    pub color: String,
    pub cursor: Option<CursorPosition>,
    pub selection: Option<SelectionRange>,
    pub editing_file: Option<String>,
    pub last_activity: u64,
}

/// Cursor position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorPosition {
    pub line: u32,
    pub column: u32,
    pub file_path: String,
}

/// Selection range
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectionRange {
    pub start: CursorPosition,
    pub end: CursorPosition,
}

/// Awareness update message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AwarenessUpdate {
    pub user_id: String,
    pub state: UserState,
    pub version: u64,
}

impl AwarenessProtocol {
    /// Create a new awareness protocol
    pub fn new() -> Self {
        Self {
            states: HashMap::new(),
            version: 0,
        }
    }

    /// Update a user's state
    pub fn update(&mut self, user_id: &str, state: UserState) {
        self.states.insert(user_id.to_string(), state);
        self.version += 1;
    }

    /// Remove a user
    pub fn remove(&mut self, user_id: &str) {
        self.states.remove(user_id);
        self.version += 1;
    }

    /// Get all user states
    pub fn get_states(&self) -> &HashMap<String, UserState> {
        &self.states
    }

    /// Get a specific user's state
    pub fn get_state(&self, user_id: &str) -> Option<&UserState> {
        self.states.get(user_id)
    }

    /// Get the current version
    pub fn version(&self) -> u64 {
        self.version
    }

    /// Encode awareness state for transmission
    pub fn encode(&self) -> Vec<u8> {
        let update = AwarenessUpdate {
            user_id: String::new(),
            state: UserState::default(),
            version: self.version,
        };
        serde_json::to_vec(&update).unwrap_or_default()
    }

    /// Decode awareness update
    pub fn decode_update(data: &[u8]) -> Result<AwarenessUpdate> {
        let update: AwarenessUpdate = serde_json::from_slice(data)?;
        Ok(update)
    }

    /// Get users editing a specific file
    pub fn get_users_in_file(&self, file_path: &str) -> Vec<&UserState> {
        self.states.values()
            .filter(|s| s.editing_file.as_deref() == Some(file_path))
            .collect()
    }

    /// Get active users (within last 30 seconds)
    pub fn get_active_users(&self, threshold_secs: u64) -> Vec<&UserState> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        self.states.values()
            .filter(|s| now - s.last_activity < threshold_secs)
            .collect()
    }

    /// Clean up stale users
    pub fn cleanup_stale(&mut self, threshold_secs: u64) -> usize {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let stale: Vec<String> = self.states.iter()
            .filter(|(_, s)| now - s.last_activity > threshold_secs)
            .map(|(id, _)| id.clone())
            .collect();

        let count = stale.len();
        for id in stale {
            self.states.remove(&id);
        }

        if count > 0 {
            self.version += 1;
        }

        count
    }
}

impl Default for AwarenessProtocol {
    fn default() -> Self {
        Self::new()
    }
}

impl Default for UserState {
    fn default() -> Self {
        Self {
            user_id: String::new(),
            name: "Anonymous".to_string(),
            color: "#6366f1".to_string(),
            cursor: None,
            selection: None,
            editing_file: None,
            last_activity: 0,
        }
    }
}

/// User colors for collaboration
pub const USER_COLORS: &[&str] = &[
    "#f43f5e", // Rose
    "#f97316", // Orange
    "#eab308", // Yellow
    "#22c55e", // Green
    "#14b8a6", // Teal
    "#06b6d4", // Cyan
    "#3b82f6", // Blue
    "#8b5cf6", // Violet
    "#d946ef", // Fuchsia
    "#ec4899", // Pink
];

/// Get a color for a user based on their ID
pub fn get_user_color(user_id: &str) -> String {
    let hash = user_id.bytes().fold(0usize, |acc, b| acc + b as usize);
    USER_COLORS[hash % USER_COLORS.len()].to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_awareness_update() {
        let mut awareness = AwarenessProtocol::new();
        
        let state = UserState {
            user_id: "user1".to_string(),
            name: "Alice".to_string(),
            color: "#f43f5e".to_string(),
            cursor: Some(CursorPosition {
                line: 10,
                column: 5,
                file_path: "main.rs".to_string(),
            }),
            selection: None,
            editing_file: Some("main.rs".to_string()),
            last_activity: 0,
        };

        awareness.update("user1", state);
        
        assert_eq!(awareness.get_states().len(), 1);
        assert!(awareness.get_state("user1").is_some());
    }
}
