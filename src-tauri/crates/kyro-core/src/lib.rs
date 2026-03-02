//! Kyro Core - Core types, utilities, and service registry
//!
//! This crate provides the foundational types and utilities used across
//! the Kyro IDE backend, including:
//! - ServiceRegistry for dependency injection
//! - Error handling types and Result wrappers
//! - Common traits and interfaces
//! - Async runtime configuration

pub mod error;
pub mod registry;
pub mod runtime;
pub mod types;

// Re-export commonly used types
pub use error::{KyroError, KyroResult};
pub use registry::{Service, ServiceRegistry};
pub use runtime::RuntimeConfig;
