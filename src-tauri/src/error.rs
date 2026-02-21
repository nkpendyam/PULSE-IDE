use thiserror::Error;

#[derive(Error, Debug)]
pub enum PulseError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Git error: {0}")]
    Git(#[from] git2::Error),
    
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    
    #[error("HTTP error: {0}")]
    Http(String),
    
    #[error("Terminal error: {0}")]
    Terminal(String),
    
    #[error("Configuration error: {0}")]
    Config(String),
    
    #[error("Unknown error: {0}")]
    Unknown(String),
}

pub type Result<T> = std::result::Result<T, PulseError>;
