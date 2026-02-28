// Authentication Tauri Commands — Self-contained implementation
use tauri::command;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::auth::{AuthManager, AuthConfig, UserRole};

lazy_static::lazy_static! {
    static ref AUTH_STATE: Arc<RwLock<AuthManager>> = Arc::new(RwLock::new(AuthManager::new(AuthConfig::default())));
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: String,
    pub username: String,
    pub email: String,
    pub role: String,
    pub avatar_url: Option<String>,
}

#[command]
pub async fn login_user(username: String, password: String) -> Result<UserInfo, String> {
    let mut state = AUTH_STATE.write().await;
    let tokens = state.login(&username, &password, None)
        .map_err(|e| format!("Login failed: {}", e))?;
    Ok(UserInfo {
        id: tokens.user.id.to_string(), username: tokens.user.username.clone(),
        email: tokens.user.email.clone(), role: format!("{:?}", tokens.user.role),
        avatar_url: None,
    })
}

#[command]
pub async fn logout_user() -> Result<(), String> {
    Ok(())
}

#[command]
pub async fn register_user(username: String, email: String, password: String) -> Result<UserInfo, String> {
    let mut state = AUTH_STATE.write().await;
    let user = state.register(username, email, &password)
        .map_err(|e| format!("Registration failed: {}", e))?;
    Ok(UserInfo {
        id: user.id.to_string(), username: user.username.clone(),
        email: user.email.clone(), role: format!("{:?}", user.role),
        avatar_url: None,
    })
}

#[command]
pub async fn get_current_user() -> Result<Option<UserInfo>, String> {
    Ok(None)
}

#[command]
pub async fn is_authenticated() -> Result<bool, String> {
    Ok(false)
}

#[command]
pub async fn update_user_role(user_id: String, role: String) -> Result<(), String> {
    let mut state = AUTH_STATE.write().await;
    let uid = uuid::Uuid::parse_str(&user_id).map_err(|e| format!("Invalid UUID: {}", e))?;
    let new_role = match role.to_lowercase().as_str() {
        "admin" => UserRole::Admin,
        "editor" => UserRole::Editor,
        "viewer" => UserRole::Viewer,
        "owner" => UserRole::Owner,
        _ => UserRole::Viewer,
    };
    state.update_user_role(uid, new_role).map_err(|e| format!("Failed: {}", e))
}

#[command]
pub async fn validate_session(token: String) -> Result<bool, String> {
    let state = AUTH_STATE.read().await;
    Ok(state.validate_token(&token).is_ok())
}

#[command]
pub async fn get_oauth_url(provider: String) -> Result<String, String> {
    let state = AUTH_STATE.read().await;
    state.get_oauth_url(&provider).map_err(|e| format!("Failed: {}", e))
}

#[command]
pub async fn handle_oauth_callback(provider: String, code: String) -> Result<UserInfo, String> {
    let mut state = AUTH_STATE.write().await;
    let tokens = state.handle_oauth_callback(&provider, &code)
        .map_err(|e| format!("OAuth failed: {}", e))?;
    Ok(UserInfo {
        id: tokens.user.id.to_string(), username: tokens.user.username.clone(),
        email: tokens.user.email.clone(), role: format!("{:?}", tokens.user.role),
        avatar_url: None,
    })
}
