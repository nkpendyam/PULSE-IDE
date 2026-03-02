//! Collaboration Room - Individual room instance

use uuid::Uuid;

/// Room ID
pub type RoomId = Uuid;

/// Collaboration Room
pub struct Room {
    id: RoomId,
    name: String,
    created_at: chrono::DateTime<chrono::Utc>,
}

impl Room {
    /// Create a new room
    pub fn new(name: String) -> Self {
        Self {
            id: Uuid::new_v4(),
            name,
            created_at: chrono::Utc::now(),
        }
    }

    /// Get the room ID
    pub fn id(&self) -> RoomId {
        self.id
    }

    /// Get the room name
    pub fn name(&self) -> &str {
        &self.name
    }

    /// Get the creation timestamp
    pub fn created_at(&self) -> chrono::DateTime<chrono::Utc> {
        self.created_at
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_room_creation() {
        let room = Room::new("Test Room".to_string());
        assert_eq!(room.name(), "Test Room");
    }
}
