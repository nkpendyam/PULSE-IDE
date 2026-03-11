//! Collaboration Manager - Manages collaboration rooms

use kyro_core::{KyroError, KyroResult, Service};
use async_trait::async_trait;
use dashmap::DashMap;
use std::sync::Arc;
use crate::room::{Room, RoomId};

/// Collaboration Manager service
pub struct CollaborationManager {
    rooms: DashMap<RoomId, Arc<Room>>,
}

impl CollaborationManager {
    /// Create a new collaboration manager
    pub fn new() -> Self {
        Self {
            rooms: DashMap::new(),
        }
    }

    /// Create a new collaboration room
    pub async fn create_room(&self, name: String) -> KyroResult<RoomId> {
        let room = Room::new(name);
        let id = room.id();
        
        self.rooms.insert(id, Arc::new(room));
        log::info!("Created collaboration room: {}", id);
        
        Ok(id)
    }

    /// Get a room by ID
    pub fn get_room(&self, id: RoomId) -> Option<Arc<Room>> {
        self.rooms.get(&id).map(|r| r.value().clone())
    }

    /// List all rooms
    pub fn list_rooms(&self) -> Vec<RoomId> {
        self.rooms.iter().map(|e| *e.key()).collect()
    }

    /// Delete a room
    pub async fn delete_room(&self, id: RoomId) -> KyroResult<()> {
        if let Some((_, _room)) = self.rooms.remove(&id) {
            log::info!("Deleted collaboration room: {}", id);
        }
        Ok(())
    }
}

impl Default for CollaborationManager {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Service for CollaborationManager {
    fn name(&self) -> &str {
        "CollaborationManager"
    }

    async fn init(&mut self) -> KyroResult<()> {
        log::info!("Initializing Collaboration Manager");
        Ok(())
    }

    async fn shutdown(&mut self) -> KyroResult<()> {
        log::info!("Shutting down Collaboration Manager");
        self.rooms.clear();
        Ok(())
    }

    async fn health_check(&self) -> KyroResult<()> {
        Ok(())
    }
}

#[cfg(all(test, feature = "fixme_tests"))]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_collaboration_manager() {
        let manager = CollaborationManager::new();
        let id = manager.create_room("Test Room".to_string()).await.unwrap();
        
        let room = manager.get_room(id).unwrap();
        assert_eq!(room.name(), "Test Room");
    }
}
