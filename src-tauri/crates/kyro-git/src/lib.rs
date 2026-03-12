//! Kyro Git - Git integration
//!
//! Provides Git operations and version control integration
//! for Kyro IDE.

#![allow(dead_code, unused_variables, unused_imports)]

pub mod manager;
pub mod repository;

pub use manager::GitManager;
pub use repository::Repository;
