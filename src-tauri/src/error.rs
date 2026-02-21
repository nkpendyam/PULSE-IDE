//! Error types for Kyro IDE

use thiserror::Error;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Error, Debug)]
pub enum Error {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Git error: {0}")]
    Git(#[from] git2::Error),
    
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    
    #[error("Path error: {0}")]
    Path(String),
    
    #[error("Command error: {0}")]
    Command(String),
    
    #[error("Terminal error: {0}")]
    Terminal(String),
    
    #[error("AI error: {0}")]
    Ai(String),
    
    #[error("Configuration error: {0}")]
    Config(String),
    
    #[error("Permission denied: {0}")]
    Permission(String),
    
    #[error("Not found: {0}")]
    NotFound(String),
    
    #[error("Unexpected error: {0}")]
    Unexpected(String),
}

impl From<Error> for String {
    fn from(error: Error) -> Self {
        error.to_string()
    }
}
