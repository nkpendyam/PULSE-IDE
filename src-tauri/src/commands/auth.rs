//! Authentication Tauri Commands
//!
//! Exposes authentication functionality to the frontend

use tauri::command;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::auth::{AuthManager, User, Role, Session};

/// Global auth state
lazy_static::lazy_static! {
    static ref AUTH_STATE: Arc<RwLock<AuthState>> = Arc::new(RwLock::new(AuthState::new()));
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthState {
    pub current_user: Option<UserInfo>,
    pub session_token: Option<String>,
    pub is_authenticated: bool,
}

impl AuthState {
    pub fn new() -> Self {
        Self {
            current_user: None,
            session_token: None,
            is_authenticated: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: String,
    pub email: String,
    pub name: String,
    pub role: String,
    pub avatar: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginResponse {
    pub user: UserInfo,
    pub token: String,
    pub expires_at: String,
}

/// Login user with email and password
#[command]
pub async fn login_user(request: LoginRequest) -> Result<LoginResponse, String> {
    let mut auth = AuthManager::new();
    
    // Authenticate user
    let user = auth.authenticate(&request.email, &request.password)
        .await
        .map_err(|e| format!("Authentication failed: {}", e))?;
    
    // Generate session token
    let token = auth.generate_token(&user)
        .map_err(|e| format!("Token generation failed: {}", e))?;
    
    let expires_at = chrono::Utc::now() + chrono::Duration::hours(24);
    
    // Create user info
    let user_info = UserInfo {
        id: user.id.clone(),
        email: user.email.clone(),
        name: user.name.clone(),
        role: format!("{:?}", user.role),
        avatar: user.avatar.clone(),
        created_at: user.created_at.to_rfc3339(),
    };
    
    // Update global state
    let mut state = AUTH_STATE.write().await;
    state.current_user = Some(user_info.clone());
    state.session_token = Some(token.clone());
    state.is_authenticated = true;
    
    Ok(LoginResponse {
        user: user_info,
        token,
        expires_at: expires_at.to_rfc3339(),
    })
}

/// Register new user
#[command]
pub async fn register_user(request: RegisterRequest) -> Result<LoginResponse, String> {
    let mut auth = AuthManager::new();
    
    // Create user
    let user = auth.create_user(&request.email, &request.password, &request.name)
        .await
        .map_err(|e| format!("Registration failed: {}", e))?;
    
    // Generate token
    let token = auth.generate_token(&user)
        .map_err(|e| format!("Token generation failed: {}", e))?;
    
    let expires_at = chrono::Utc::now() + chrono::Duration::hours(24);
    
    // Create user info
    let user_info = UserInfo {
        id: user.id.clone(),
        email: user.email.clone(),
        name: user.name.clone(),
        role: format!("{:?}", user.role),
        avatar: user.avatar.clone(),
        created_at: user.created_at.to_rfc3339(),
    };
    
    // Update state
    let mut state = AUTH_STATE.write().await;
    state.current_user = Some(user_info.clone());
    state.session_token = Some(token.clone());
    state.is_authenticated = true;
    
    Ok(LoginResponse {
        user: user_info,
        token,
        expires_at: expires_at.to_rfc3339(),
    })
}

/// Logout current user
#[command]
pub async fn logout_user() -> Result<(), String> {
    let mut state = AUTH_STATE.write().await;
    state.current_user = None;
    state.session_token = None;
    state.is_authenticated = false;
    Ok(())
}

/// Get current authenticated user
#[command]
pub async fn get_current_user() -> Result<Option<UserInfo>, String> {
    let state = AUTH_STATE.read().await;
    Ok(state.current_user.clone())
}

/// Check if user is authenticated
#[command]
pub async fn is_authenticated() -> Result<bool, String> {
    let state = AUTH_STATE.read().await;
    Ok(state.is_authenticated)
}

/// Update user role (admin only)
#[command]
pub async fn update_user_role(user_id: String, role: String) -> Result<(), String> {
    let state = AUTH_STATE.read().await;
    
    if !state.is_authenticated {
        return Err("Not authenticated".to_string());
    }
    
    let current_user = state.current_user.as_ref()
        .ok_or("No current user")?;
    
    if current_user.role != "Admin" && current_user.role != "Owner" {
        return Err("Insufficient permissions".to_string());
    }
    
    let role: Role = role.parse()
        .map_err(|_| "Invalid role")?;
    
    let mut auth = AuthManager::new();
    auth.update_user_role(&user_id, role)
        .await
        .map_err(|e| format!("Failed to update role: {}", e))?;
    
    Ok(())
}

/// Validate session token
#[command]
pub async fn validate_session(token: String) -> Result<UserInfo, String> {
    let auth = AuthManager::new();
    let claims = auth.validate_token(&token)
        .map_err(|e| format!("Invalid token: {}", e))?;
    
    Ok(UserInfo {
        id: claims.sub.clone(),
        email: claims.email.clone(),
        name: claims.name.unwrap_or_default(),
        role: format!("{:?}", claims.role),
        avatar: None,
        created_at: chrono::Utc::now().to_rfc3339(),
    })
}

/// OAuth login URL generation
#[command]
pub async fn get_oauth_url(provider: String) -> Result<String, String> {
    let auth = AuthManager::new();
    let url = auth.get_oauth_url(&provider)
        .await
        .map_err(|e| format!("Failed to get OAuth URL: {}", e))?;
    Ok(url)
}

/// OAuth callback handling
#[command]
pub async fn handle_oauth_callback(provider: String, code: String) -> Result<LoginResponse, String> {
    let mut auth = AuthManager::new();
    let user = auth.handle_oauth_callback(&provider, &code)
        .await
        .map_err(|e| format!("OAuth failed: {}", e))?;
    
    let token = auth.generate_token(&user)
        .map_err(|e| format!("Token generation failed: {}", e))?;
    
    let expires_at = chrono::Utc::now() + chrono::Duration::hours(24);
    
    let mut state = AUTH_STATE.write().await;
    state.current_user = Some(UserInfo {
        id: user.id.clone(),
        email: user.email.clone(),
        name: user.name.clone(),
        role: format!("{:?}", user.role),
        avatar: user.avatar.clone(),
        created_at: user.created_at.to_rfc3339(),
    });
    state.session_token = Some(token.clone());
    state.is_authenticated = true;
    
    Ok(LoginResponse {
        user: state.current_user.clone().unwrap(),
        token,
        expires_at: expires_at.to_rfc3339(),
    })
}
