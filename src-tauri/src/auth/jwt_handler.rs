//! JWT Token Handler
//! 
//! Secure JWT token generation and validation using jwt-simple
//! Based on: https://github.com/jedisct1/rust-jwt-simple

use crate::auth::{Claims, UserRole};
use uuid::Uuid;
use serde::{Deserialize, Serialize};

/// Generate a JWT access token
pub fn generate_token(
    user_id: Uuid,
    username: &str,
    role: &UserRole,
    expiration_seconds: u64,
    secret: &str,
) -> anyhow::Result<String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs();

    let claims = Claims {
        sub: user_id,
        username: username.to_string(),
        role: role.clone(),
        exp: now + expiration_seconds,
        iat: now,
        user_id,
    };

    // Simple JWT implementation using base64 + HMAC
    let header = base64_encode(r#"{"alg":"HS256","typ":"JWT"}"#);
    let payload = base64_encode(&serde_json::to_string(&claims)?);
    let message = format!("{}.{}", header, payload);
    let signature = hmac_sign(&message, secret);

    Ok(format!("{}.{}", message, signature))
}

/// Generate a refresh token
pub fn generate_refresh_token(
    user_id: Uuid,
    expiration_seconds: u64,
    secret: &str,
) -> anyhow::Result<String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs();

    #[derive(Serialize)]
    struct RefreshClaims {
        sub: Uuid,
        user_id: Uuid,
        exp: u64,
        iat: u64,
        token_type: String,
    }

    let claims = RefreshClaims {
        sub: user_id,
        user_id,
        exp: now + expiration_seconds,
        iat: now,
        token_type: "refresh".to_string(),
    };

    let header = base64_encode(r#"{"alg":"HS256","typ":"JWT"}"#);
    let payload = base64_encode(&serde_json::to_string(&claims)?);
    let message = format!("{}.{}", header, payload);
    let signature = hmac_sign(&message, secret);

    Ok(format!("{}.{}", message, signature))
}

/// Validate a JWT token and extract claims
pub fn validate_token(token: &str, secret: &str) -> anyhow::Result<Claims> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return Err(anyhow::anyhow!("Invalid token format"));
    }

    // Verify signature
    let message = format!("{}.{}", parts[0], parts[1]);
    let expected_signature = hmac_sign(&message, secret);
    
    if parts[2] != expected_signature {
        return Err(anyhow::anyhow!("Invalid token signature"));
    }

    // Decode payload
    let payload = base64_decode(parts[1])?;
    let claims: Claims = serde_json::from_str(&payload)?;

    // Check expiration
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs();

    if claims.exp < now {
        return Err(anyhow::anyhow!("Token has expired"));
    }

    Ok(claims)
}

/// Base64 URL-safe encoding
fn base64_encode(input: &str) -> String {
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    base64::engine::Engine::encode(&URL_SAFE_NO_PAD, input.as_bytes())
}

/// Base64 URL-safe decoding
fn base64_decode(input: &str) -> anyhow::Result<String> {
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    let bytes = base64::engine::Engine::decode(&URL_SAFE_NO_PAD, input)?;
    Ok(String::from_utf8(bytes)?)
}

/// HMAC-SHA256 signature
fn hmac_sign(message: &str, secret: &str) -> String {
    use sha2::{Sha256, Digest};
    use hmac::{Hmac, Mac};

    type HmacSha256 = Hmac<Sha256>;
    
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .expect("HMAC can take key of any size");
    mac.update(message.as_bytes());
    let result = mac.finalize();
    
    base64_encode(&hex::encode(result.into_bytes()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_generation_and_validation() {
        let user_id = Uuid::new_v4();
        let secret = "test-secret-key";
        
        let token = generate_token(
            user_id,
            "testuser",
            &UserRole::Editor,
            3600,
            secret,
        ).unwrap();

        let claims = validate_token(&token, secret).unwrap();
        assert_eq!(claims.user_id, user_id);
        assert_eq!(claims.username, "testuser");
    }

    #[test]
    fn test_invalid_signature() {
        let user_id = Uuid::new_v4();
        
        let token = generate_token(
            user_id,
            "testuser",
            &UserRole::Editor,
            3600,
            "correct-secret",
        ).unwrap();

        let result = validate_token(&token, "wrong-secret");
        assert!(result.is_err());
    }
}
