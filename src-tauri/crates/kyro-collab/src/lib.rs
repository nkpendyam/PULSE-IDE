//! Kyro Collab - CRDT collaboration engine
//!
//! Provides real-time collaborative editing using Yjs CRDT,
//! supporting 50+ concurrent users with conflict-free merging.

pub mod manager;
pub mod room;

pub use manager::CollaborationManager;
pub use room::{Room, RoomId};
