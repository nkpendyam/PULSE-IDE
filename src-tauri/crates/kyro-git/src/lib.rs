//! Kyro Git - Git integration
//!
//! Provides Git operations and version control integration
//! for Kyro IDE.

pub mod manager;
pub mod repository;

pub use manager::GitManager;
pub use repository::Repository;
