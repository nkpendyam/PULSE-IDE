//! JWT Authentication
//!
//! Simple JWT authentication for collaboration sessions

use anyhow::Result;
use serde::{Deserialize, Serialize};

/// JWT claims
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub name: String,
    pub email: Option<String>,
    pub exp: usize,
    pub iat: usize,
}

/// Auth configuration
#[derive(Debug, Clone)]
pub struct AuthConfig {
    pub secret: String,
    pub expiry_secs: u64,
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            secret: "change-me-in-production".to_string(),
            expiry_secs: 3600, // 1 hour
        }
    }
}

/// JWT authentication handler
pub struct JwtAuth {
    config: AuthConfig,
}

impl JwtAuth {
    pub fn new(secret: &str) -> Result<Self> {
        Ok(Self {
            config: AuthConfig {
                secret: secret.to_string(),
                ..Default::default()
            },
        })
    }
    
    pub fn generate_token(&self, user_id: &str, name: &str) -> Result<String> {
        let now = chrono::Utc::now().timestamp() as usize;
        let exp = now + self.config.expiry_secs as usize;
        
        let claims = Claims {
            sub: user_id.to_string(),
            name: name.to_string(),
            email: None,
            exp,
            iat: now,
        };
        
        // Simplified token generation (in production, use proper JWT library)
        let payload = serde_json::to_string(&claims)?;
        Ok(format!("{}.{}", 
            base64::encode(b"header"),
            base64::encode(payload.as_bytes())
        ))
    }
    
    pub fn verify_token(&self, token: &str) -> Result<Claims> {
        let parts: Vec<&str> = token.split('.').collect();
        if parts.len() != 2 {
            anyhow::bail!("Invalid token format");
        }
        
        let payload = base64::decode(parts[1])?;
        let claims: Claims = serde_json::from_slice(&payload)?;
        
        let now = chrono::Utc::now().timestamp() as usize;
        if claims.exp < now {
            anyhow::bail!("Token expired");
        }
        
        Ok(claims)
    }
}

/// Base64 helpers (simplified)
mod base64 {
    use base64::{Engine, engine::general_purpose::STANDARD};
    
    pub fn encode(data: &[u8]) -> String {
        STANDARD.encode(data)
    }
    
    pub fn decode(s: &str) -> Result<Vec<u8>, base64::DecodeError> {
        STANDARD.decode(s)
    }
}
