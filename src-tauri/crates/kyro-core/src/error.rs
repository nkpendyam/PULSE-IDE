//! Error handling types for Kyro IDE
//!
//! Provides a unified error type and Result wrapper for all Kyro operations.

use std::fmt;

/// Main error type for Kyro IDE operations
#[derive(Debug, thiserror::Error)]
pub enum KyroError {
    /// IO errors (file operations, network, etc.)
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    /// Serialization/deserialization errors
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    /// Service not found in registry
    #[error("Service not found: {0}")]
    ServiceNotFound(String),

    /// Service initialization failed
    #[error("Service initialization failed: {0}")]
    ServiceInitFailed(String),

    /// LSP operation failed
    #[error("LSP error: {0}")]
    Lsp(String),

    /// Git operation failed
    #[error("Git error: {0}")]
    Git(String),

    /// AI/LLM operation failed
    #[error("AI error: {0}")]
    Ai(String),

    /// Collaboration/CRDT operation failed
    #[error("Collaboration error: {0}")]
    Collaboration(String),

    /// Terminal operation failed
    #[error("Terminal error: {0}")]
    Terminal(String),

    /// File system operation failed
    #[error("File system error: {0}")]
    FileSystem(String),

    /// Configuration error
    #[error("Configuration error: {0}")]
    Config(String),

    /// Authentication/authorization error
    #[error("Auth error: {0}")]
    Auth(String),

    /// Encryption/decryption error
    #[error("Encryption error: {0}")]
    Encryption(String),

    /// Extension/plugin error
    #[error("Extension error: {0}")]
    Extension(String),

    /// Invalid input or state
    #[error("Invalid: {0}")]
    Invalid(String),

    /// Operation timeout
    #[error("Timeout: {0}")]
    Timeout(String),

    /// Generic error with context
    #[error("{0}")]
    Other(String),
}

impl KyroError {
    /// Create a new error with a custom message
    pub fn new(msg: impl Into<String>) -> Self {
        Self::Other(msg.into())
    }

    /// Create a service not found error
    pub fn service_not_found(service: impl Into<String>) -> Self {
        Self::ServiceNotFound(service.into())
    }

    /// Create a service initialization error
    pub fn service_init_failed(msg: impl Into<String>) -> Self {
        Self::ServiceInitFailed(msg.into())
    }

    /// Create an LSP error
    pub fn lsp(msg: impl Into<String>) -> Self {
        Self::Lsp(msg.into())
    }

    /// Create a Git error
    pub fn git(msg: impl Into<String>) -> Self {
        Self::Git(msg.into())
    }

    /// Create an AI error
    pub fn ai(msg: impl Into<String>) -> Self {
        Self::Ai(msg.into())
    }

    /// Create a collaboration error
    pub fn collaboration(msg: impl Into<String>) -> Self {
        Self::Collaboration(msg.into())
    }

    /// Create a terminal error
    pub fn terminal(msg: impl Into<String>) -> Self {
        Self::Terminal(msg.into())
    }

    /// Create a file system error
    pub fn file_system(msg: impl Into<String>) -> Self {
        Self::FileSystem(msg.into())
    }

    /// Create a configuration error
    pub fn config(msg: impl Into<String>) -> Self {
        Self::Config(msg.into())
    }

    /// Create an authentication error
    pub fn auth(msg: impl Into<String>) -> Self {
        Self::Auth(msg.into())
    }

    /// Create an encryption error
    pub fn encryption(msg: impl Into<String>) -> Self {
        Self::Encryption(msg.into())
    }

    /// Create an extension error
    pub fn extension(msg: impl Into<String>) -> Self {
        Self::Extension(msg.into())
    }

    /// Create an invalid input/state error
    pub fn invalid(msg: impl Into<String>) -> Self {
        Self::Invalid(msg.into())
    }

    /// Create a timeout error
    pub fn timeout(msg: impl Into<String>) -> Self {
        Self::Timeout(msg.into())
    }
}

/// Result type alias for Kyro operations
pub type KyroResult<T> = Result<T, KyroError>;

/// Convert anyhow::Error to KyroError
impl From<anyhow::Error> for KyroError {
    fn from(err: anyhow::Error) -> Self {
        Self::Other(err.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_creation() {
        let err = KyroError::service_not_found("TestService");
        assert!(matches!(err, KyroError::ServiceNotFound(_)));
        assert_eq!(err.to_string(), "Service not found: TestService");
    }

    #[test]
    fn test_error_conversion() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let kyro_err: KyroError = io_err.into();
        assert!(matches!(kyro_err, KyroError::Io(_)));
    }

    #[test]
    fn test_result_type() {
        fn test_fn() -> KyroResult<i32> {
            Ok(42)
        }
        assert_eq!(test_fn().unwrap(), 42);
    }
}
