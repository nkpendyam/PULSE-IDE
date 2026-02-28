//! Awareness Protocol Implementation
//!
//! Tracks presence and state of collaborators in real-time.

use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Awareness state for a single client
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientAwareness {
    pub client_id: String,
    pub state: HashMap<String, Value>,
    pub last_updated: u64,
}

/// Global awareness state
#[derive(Debug, Clone, Default)]
pub struct AwarenessState {
    local_client_id: String,
    local_state: HashMap<String, Value>,
    states: HashMap<String, ClientAwareness>,
}

impl AwarenessState {
    pub fn new() -> Self {
        Self {
            local_client_id: uuid::Uuid::new_v4().to_string(),
            local_state: HashMap::new(),
            states: HashMap::new(),
        }
    }
    
    /// Get local client ID
    pub fn client_id(&self) -> &str {
        &self.local_client_id
    }
    
    /// Set local state field
    pub fn set_local_state_field(&mut self, key: &str, value: Value) {
        self.local_state.insert(key.to_string(), value);
        self.states.insert(
            self.local_client_id.clone(),
            ClientAwareness {
                client_id: self.local_client_id.clone(),
                state: self.local_state.clone(),
                last_updated: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0),
            },
        );
    }
    
    /// Get local state
    pub fn get_local_state(&self) -> &HashMap<String, Value> {
        &self.local_state
    }
    
    /// Set remote client state
    pub fn set_state(&mut self, client_id: String, state: HashMap<String, Value>) {
        self.states.insert(
            client_id.clone(),
            ClientAwareness {
                client_id,
                state,
                last_updated: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0),
            },
        );
    }
    
    /// Remove client state
    pub fn remove_state(&mut self, client_id: &str) {
        self.states.remove(client_id);
    }
    
    /// Get all states
    pub fn get_states(&self) -> &HashMap<String, ClientAwareness> {
        &self.states
    }
    
    /// Get specific client state
    pub fn get_state(&self, client_id: &str) -> Option<&ClientAwareness> {
        self.states.get(client_id)
    }
    
    /// Get number of connected clients
    pub fn client_count(&self) -> usize {
        self.states.len()
    }
    
    /// Encode awareness for sync
    pub fn encode(&self) -> Vec<u8> {
        // Simple JSON encoding
        serde_json::to_vec(&self.states).unwrap_or_default()
    }
    
    /// Decode awareness from sync
    pub fn decode(data: &[u8]) -> HashMap<String, ClientAwareness> {
        serde_json::from_slice(data).unwrap_or_default()
    }
}

/// User presence information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPresence {
    pub user_id: String,
    pub user_name: String,
    pub color: String,
    pub cursor: Option<CursorPosition>,
    pub selection: Option<SelectionRange>,
    pub typing: bool,
    pub last_activity: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorPosition {
    pub line: u32,
    pub column: u32,
    pub file: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectionRange {
    pub start: CursorPosition,
    pub end: CursorPosition,
}

impl UserPresence {
    pub fn new(user_id: String, user_name: String) -> Self {
        Self {
            user_id,
            user_name,
            color: Self::generate_color(),
            cursor: None,
            selection: None,
            typing: false,
            last_activity: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0),
        }
    }
    
    fn generate_color() -> String {
        let colors = [
            "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
            "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
        ];
        use std::hash::{Hash, Hasher, DefaultHasher};
        let mut hasher = DefaultHasher::new();
        std::time::SystemTime::now().hash(&mut hasher);
        let idx = hasher.finish() as usize % colors.len();
        colors[idx].to_string()
    }
    
    /// Update cursor position
    pub fn update_cursor(&mut self, cursor: CursorPosition) {
        self.cursor = Some(cursor);
        self.touch();
    }
    
    /// Update selection
    pub fn update_selection(&mut self, selection: SelectionRange) {
        self.selection = Some(selection);
        self.touch();
    }
    
    /// Mark as typing
    pub fn set_typing(&mut self, typing: bool) {
        self.typing = typing;
        self.touch();
    }
    
    /// Update last activity timestamp
    fn touch(&mut self) {
        self.last_activity = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
    }
    
    /// Check if user is active (within last 30 seconds)
    pub fn is_active(&self) -> bool {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        now - self.last_activity < 30
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_awareness_state() {
        let mut awareness = AwarenessState::new();
        
        awareness.set_local_state_field("name", serde_json::json!("User 1"));
        awareness.set_local_state_field("cursor", serde_json::json!({"line": 10, "column": 5}));
        
        let state = awareness.get_local_state();
        assert_eq!(state.get("name").unwrap(), "User 1");
    }
}
