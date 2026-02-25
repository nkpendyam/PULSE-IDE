//! Presence and Awareness
//!
//! Real-time cursor and user presence tracking

use serde::{Deserialize, Serialize};

/// User presence information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPresence {
    pub user_id: String,
    pub name: String,
    pub color: String,
    pub cursor: Option<CursorPosition>,
    pub status: super::UserStatus,
}

/// Cursor position in document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorPosition {
    pub line: u32,
    pub column: u32,
    pub file_path: Option<String>,
    pub offset: Option<u64>,
}

/// Presence manager
#[derive(Debug, Default)]
pub struct Presence {
    users: Vec<UserPresence>,
}

impl Presence {
    pub fn new() -> Self {
        Self { users: Vec::new() }
    }
    
    pub fn add_user(&mut self, presence: UserPresence) {
        self.users.push(presence);
    }
    
    pub fn remove_user(&mut self, user_id: &str) {
        self.users.retain(|p| p.user_id != user_id);
    }
    
    pub fn update_cursor(&mut self, user_id: &str, cursor: CursorPosition) {
        if let Some(user) = self.users.iter_mut().find(|p| p.user_id == user_id) {
            user.cursor = Some(cursor);
        }
    }
    
    pub fn get_all(&self) -> &[UserPresence] {
        &self.users
    }
}
