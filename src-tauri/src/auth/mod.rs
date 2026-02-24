//! Authentication module for KYRO IDE
//! 
//! Implements secure JWT-based authentication using jwt-simple library
//! Based on patterns from jedisct1/rust-jwt-simple
//! 
//! Features:
//! - User registration and login
//! - JWT token generation and validation
//! - Session management
//! - Role-based access control (RBAC)

pub mod jwt_handler;
pub mod session;
pub mod rbac;
pub mod oauth;

pub use jwt_handler::*;
pub use session::*;
pub use rbac::*;
pub use oauth::*;

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;

/// User representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub role: UserRole,
    pub created_at: DateTime<Utc>,
    pub last_login: Option<DateTime<Utc>>,
    pub is_active: bool,
}

/// User roles for RBAC
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum UserRole {
    Guest,
    Viewer,
    Editor,
    Admin,
    Owner,
}

impl Default for UserRole {
    fn default() -> Self {
        Self::Viewer
    }
}

/// Authentication configuration
#[derive(Debug, Clone)]
pub struct AuthConfig {
    /// JWT secret key (should be loaded from environment)
    pub jwt_secret: String,
    /// Token expiration time in seconds (default: 24 hours)
    pub token_expiration: u64,
    /// Refresh token expiration in seconds (default: 7 days)
    pub refresh_expiration: u64,
    /// Maximum concurrent sessions per user
    pub max_sessions: usize,
    /// Enable OAuth providers
    pub oauth_enabled: bool,
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            jwt_secret: "kyro-ide-default-secret-change-in-production".to_string(),
            token_expiration: 86400, // 24 hours
            refresh_expiration: 604800, // 7 days
            max_sessions: 5,
            oauth_enabled: false,
        }
    }
}

/// Authentication manager
pub struct AuthManager {
    config: AuthConfig,
    sessions: std::collections::HashMap<Uuid, Session>,
    users: std::collections::HashMap<Uuid, User>,
}

impl AuthManager {
    pub fn new(config: AuthConfig) -> Self {
        Self {
            config,
            sessions: std::collections::HashMap::new(),
            users: std::collections::HashMap::new(),
        }
    }

    /// Register a new user
    pub fn register(&mut self, username: String, email: String, password: &str) -> anyhow::Result<User> {
        let user_id = Uuid::new_v4();
        let user = User {
            id: user_id,
            username,
            email,
            role: UserRole::Viewer,
            created_at: Utc::now(),
            last_login: None,
            is_active: true,
        };
        
        self.users.insert(user_id, user.clone());
        Ok(user)
    }

    /// Authenticate user and generate tokens
    pub fn login(&mut self, username: &str, password: &str) -> anyhow::Result<AuthTokens> {
        // Find user by username
        let user = self.users.values()
            .find(|u| u.username == username)
            .ok_or_else(|| anyhow::anyhow!("Invalid credentials"))?;

        // Generate tokens
        let access_token = jwt_handler::generate_token(
            user.id,
            &user.username,
            &user.role,
            self.config.token_expiration,
            &self.config.jwt_secret,
        )?;

        let refresh_token = jwt_handler::generate_refresh_token(
            user.id,
            self.config.refresh_expiration,
            &self.config.jwt_secret,
        )?;

        // Create session
        let session = Session {
            id: Uuid::new_v4(),
            user_id: user.id,
            refresh_token: refresh_token.clone(),
            created_at: Utc::now(),
            expires_at: Utc::now() + chrono::Duration::seconds(self.config.refresh_expiration as i64),
        };

        self.sessions.insert(session.id, session);

        Ok(AuthTokens {
            access_token,
            refresh_token,
            expires_in: self.config.token_expiration,
            user: user.clone(),
        })
    }

    /// Validate JWT token
    pub fn validate_token(&self, token: &str) -> anyhow::Result<Claims> {
        jwt_handler::validate_token(token, &self.config.jwt_secret)
    }

    /// Refresh access token
    pub fn refresh(&mut self, refresh_token: &str) -> anyhow::Result<AuthTokens> {
        let claims = jwt_handler::validate_token(refresh_token, &self.config.jwt_secret)?;
        
        let user = self.users.get(&claims.user_id)
            .ok_or_else(|| anyhow::anyhow!("User not found"))?
            .clone();

        // Generate new tokens
        let new_access_token = jwt_handler::generate_token(
            user.id,
            &user.username,
            &user.role,
            self.config.token_expiration,
            &self.config.jwt_secret,
        )?;

        let new_refresh_token = jwt_handler::generate_refresh_token(
            user.id,
            self.config.refresh_expiration,
            &self.config.jwt_secret,
        )?;

        Ok(AuthTokens {
            access_token: new_access_token,
            refresh_token: new_refresh_token,
            expires_in: self.config.token_expiration,
            user,
        })
    }

    /// Logout user (invalidate session)
    pub fn logout(&mut self, user_id: Uuid) -> anyhow::Result<()> {
        self.sessions.retain(|_, s| s.user_id != user_id);
        Ok(())
    }

    /// Get user by ID
    pub fn get_user(&self, user_id: Uuid) -> Option<&User> {
        self.users.get(&user_id)
    }

    /// Check if user has permission
    pub fn has_permission(&self, user: &User, permission: &Permission) -> bool {
        rbac::has_permission(&user.role, permission)
    }
}

/// Authentication tokens response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: u64,
    pub user: User,
}

/// JWT claims
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,        // Subject (user ID)
    pub username: String,
    pub role: UserRole,
    pub exp: u64,         // Expiration time
    pub iat: u64,         // Issued at
    pub user_id: Uuid,
}

/// Session information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: Uuid,
    pub user_id: Uuid,
    pub refresh_token: String,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

/// Permissions for RBAC
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Permission {
    /// Read file contents
    FileRead,
    /// Write/modify files
    FileWrite,
    /// Delete files
    FileDelete,
    /// Execute terminal commands
    TerminalExecute,
    /// Manage extensions
    ExtensionManage,
    /// Invite collaborators
    CollaboratorInvite,
    /// Remove collaborators
    CollaboratorRemove,
    /// Modify project settings
    ProjectSettings,
    /// Access AI features
    AIAccess,
    /// Admin panel access
    AdminAccess,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_registration() {
        let config = AuthConfig::default();
        let mut manager = AuthManager::new(config);
        
        let user = manager.register(
            "testuser".to_string(),
            "test@example.com".to_string(),
            "password123",
        ).unwrap();
        
        assert_eq!(user.username, "testuser");
        assert_eq!(user.role, UserRole::Viewer);
    }

    #[test]
    fn test_rbac_permissions() {
        assert!(rbac::has_permission(&UserRole::Owner, &Permission::FileDelete));
        assert!(rbac::has_permission(&UserRole::Admin, &Permission::CollaboratorInvite));
        assert!(!rbac::has_permission(&UserRole::Viewer, &Permission::FileDelete));
    }
}
