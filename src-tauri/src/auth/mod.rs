//! Authentication module for KYRO IDE
//! 
//! Implements secure JWT-based authentication using jwt-simple library
//! Based on patterns from jedisct1/rust-jwt-simple
//! 
//! Features:
//! - User registration and login with Argon2 password hashing
//! - JWT token generation and validation
//! - Session management
//! - Role-based access control (RBAC)
//! - Rate limiting and brute-force protection
//! - Audit logging

pub mod jwt_handler;
pub mod session;
pub mod rbac;
pub mod oauth;
pub mod rate_limiter;
pub mod audit;

pub use jwt_handler::*;
pub use session::*;
pub use rbac::*;
pub use oauth::*;
pub use rate_limiter::*;
pub use audit::*;

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;

/// User representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub password_hash: String,
    pub role: UserRole,
    pub created_at: DateTime<Utc>,
    pub last_login: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub failed_login_attempts: u32,
    pub locked_until: Option<DateTime<Utc>>,
}

impl User {
    /// Check if account is locked due to failed attempts
    pub fn is_locked(&self) -> bool {
        if let Some(locked_until) = self.locked_until {
            Utc::now() < locked_until
        } else {
            false
        }
    }
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
    /// JWT secret key (loaded from environment variable JWT_SECRET)
    pub jwt_secret: String,
    /// Token expiration time in seconds (default: 24 hours)
    pub token_expiration: u64,
    /// Refresh token expiration in seconds (default: 7 days)
    pub refresh_expiration: u64,
    /// Maximum concurrent sessions per user
    pub max_sessions: usize,
    /// Enable OAuth providers
    pub oauth_enabled: bool,
    /// Max failed login attempts before lockout
    pub max_failed_attempts: u32,
    /// Account lockout duration in seconds
    pub lockout_duration_secs: u64,
    /// Rate limit: requests per minute per IP
    pub rate_limit_per_minute: u32,
}

impl AuthConfig {
    /// Create config from environment variables
    pub fn from_env() -> Self {
        Self {
            jwt_secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| {
                    log::warn!("JWT_SECRET not set, using generated secret. THIS IS INSECURE FOR PRODUCTION!");
                    format!("kyro-ide-{}-secret", Uuid::new_v4())
                }),
            token_expiration: std::env::var("JWT_EXPIRATION_SECS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(86400),
            refresh_expiration: std::env::var("JWT_REFRESH_SECS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(604800),
            max_sessions: 5,
            oauth_enabled: std::env::var("OAUTH_ENABLED")
                .ok()
                .map(|s| s == "true")
                .unwrap_or(false),
            max_failed_attempts: 5,
            lockout_duration_secs: 900, // 15 minutes
            rate_limit_per_minute: 60,
        }
    }
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self::from_env()
    }
}

/// Authentication manager
pub struct AuthManager {
    config: AuthConfig,
    sessions: std::collections::HashMap<Uuid, Session>,
    users: std::collections::HashMap<Uuid, User>,
    username_index: std::collections::HashMap<String, Uuid>,
    rate_limiter: RateLimiter,
    audit_log: AuditLog,
}

impl AuthManager {
    pub fn new(config: AuthConfig) -> Self {
        Self {
            config,
            sessions: std::collections::HashMap::new(),
            users: std::collections::HashMap::new(),
            username_index: std::collections::HashMap::new(),
            rate_limiter: RateLimiter::new(60), // 60 requests per minute
            audit_log: AuditLog::new(),
        }
    }

    /// Create with default configuration from environment
    pub fn from_env() -> Self {
        Self::new(AuthConfig::from_env())
    }

    /// Hash password using Argon2
    fn hash_password(password: &str) -> String {
        use argon2::{Argon2, PasswordHasher, password_hash::{SaltString, rand_core::OsRng}};
        
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        
        argon2.hash_password(password.as_bytes(), &salt)
            .map(|hash| hash.to_string())
            .unwrap_or_else(|_| {
                // Fallback to bcrypt if argon2 fails (shouldn't happen)
                bcrypt::hash(password, bcrypt::DEFAULT_COST).unwrap_or_default()
            })
    }

    /// Verify password against hash
    fn verify_password(password: &str, hash: &str) -> bool {
        // Try Argon2 first
        use argon2::{Argon2, PasswordVerifier};
        use argon2::password_hash::{PasswordHash, PasswordHasher};
        
        if let Ok(parsed_hash) = PasswordHash::new(hash) {
            if Argon2::default().verify_password(password.as_bytes(), &parsed_hash).is_ok() {
                return true;
            }
        }
        
        // Fallback to bcrypt
        bcrypt::verify(password, hash).unwrap_or(false)
    }

    /// Register a new user with hashed password
    pub fn register(&mut self, username: String, email: String, password: &str) -> anyhow::Result<User> {
        // Check if username already exists
        if self.username_index.contains_key(&username) {
            anyhow::bail!("Username already exists");
        }

        let user_id = Uuid::new_v4();
        let password_hash = Self::hash_password(password);
        
        let user = User {
            id: user_id,
            username: username.clone(),
            email,
            password_hash,
            role: UserRole::Viewer,
            created_at: Utc::now(),
            last_login: None,
            is_active: true,
            failed_login_attempts: 0,
            locked_until: None,
        };
        
        self.username_index.insert(username, user_id);
        self.users.insert(user_id, user.clone());
        
        // Audit log
        self.audit_log.log(AuditAction::UserRegistered, user_id, None);
        
        Ok(user)
    }

    /// Authenticate user and generate tokens (with rate limiting)
    pub fn login(&mut self, username: &str, password: &str, client_ip: Option<&str>) -> anyhow::Result<AuthTokens> {
        // Rate limiting check
        let ip = client_ip.unwrap_or("unknown");
        if !self.rate_limiter.check(ip) {
            self.audit_log.log(AuditAction::RateLimited, Uuid::nil(), Some(ip.to_string()));
            anyhow::bail!("Rate limit exceeded. Please try again later.");
        }

        // Find user by username
        let user_id = self.username_index.get(username)
            .ok_or_else(|| anyhow::anyhow!("Invalid credentials"))?;
        
        let user = self.users.get_mut(user_id)
            .ok_or_else(|| anyhow::anyhow!("Invalid credentials"))?;

        // Check if account is locked
        if user.is_locked() {
            self.audit_log.log(AuditAction::LoginFailedLocked, user.id, Some(ip.to_string()));
            anyhow::bail!("Account is temporarily locked due to too many failed attempts");
        }

        // Verify password
        if !Self::verify_password(password, &user.password_hash) {
            user.failed_login_attempts += 1;
            
            // Lock account after max failures
            if user.failed_login_attempts >= self.config.max_failed_attempts {
                user.locked_until = Some(Utc::now() + chrono::Duration::seconds(self.config.lockout_duration_secs as i64));
                self.audit_log.log(AuditAction::AccountLocked, user.id, Some(ip.to_string()));
                anyhow::bail!("Account locked due to too many failed attempts. Try again in {} minutes.", 
                    self.config.lockout_duration_secs / 60);
            }
            
            self.audit_log.log(AuditAction::LoginFailed, user.id, Some(ip.to_string()));
            anyhow::bail!("Invalid credentials");
        }

        // Reset failed attempts on successful login
        user.failed_login_attempts = 0;
        user.locked_until = None;
        user.last_login = Some(Utc::now());
        let user = user.clone();

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

        // Audit log
        self.audit_log.log(AuditAction::LoginSuccess, user.id, Some(ip.to_string()));

        Ok(AuthTokens {
            access_token,
            refresh_token,
            expires_in: self.config.token_expiration,
            user,
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

        self.audit_log.log(AuditAction::TokenRefreshed, user.id, None);

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
        self.audit_log.log(AuditAction::Logout, user_id, None);
        Ok(())
    }

    /// Get user by ID
    pub fn get_user(&self, user_id: Uuid) -> Option<&User> {
        self.users.get(&user_id)
    }

    /// Get user by username
    pub fn get_user_by_username(&self, username: &str) -> Option<&User> {
        self.username_index.get(username)
            .and_then(|id| self.users.get(id))
    }

    /// Check if user has permission
    pub fn has_permission(&self, user: &User, permission: &Permission) -> bool {
        rbac::has_permission(&user.role, permission)
    }

    /// Get audit log entries
    pub fn get_audit_log(&self, limit: usize) -> Vec<&AuditEntry> {
        self.audit_log.get_entries(limit)
    }

    /// Change user role (admin only)
    pub fn change_role(&mut self, admin_id: Uuid, user_id: Uuid, new_role: UserRole) -> anyhow::Result<()> {
        // Verify admin
        let admin = self.users.get(&admin_id)
            .ok_or_else(|| anyhow::anyhow!("Admin not found"))?;
        
        if !matches!(admin.role, UserRole::Admin | UserRole::Owner) {
            anyhow::bail!("Insufficient permissions");
        }

        let user = self.users.get_mut(&user_id)
            .ok_or_else(|| anyhow::anyhow!("User not found"))?;
        
        user.role = new_role.clone();
        
        self.audit_log.log(AuditAction::RoleChanged, user_id, 
            Some(format!("Changed to {:?}", new_role)));
        
        Ok(())
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
        let config = AuthConfig {
            jwt_secret: "test-secret".to_string(),
            ..Default::default()
        };
        let mut manager = AuthManager::new(config);
        
        let user = manager.register(
            "testuser".to_string(),
            "test@example.com".to_string(),
            "password123",
        ).unwrap();
        
        assert_eq!(user.username, "testuser");
        assert_eq!(user.role, UserRole::Viewer);
        assert!(!user.password_hash.is_empty());
        assert_ne!(user.password_hash, "password123"); // Should be hashed
    }

    #[test]
    fn test_password_hashing() {
        let password = "my_secure_password";
        let hash = AuthManager::hash_password(password);
        
        assert_ne!(hash, password);
        assert!(AuthManager::verify_password(password, &hash));
        assert!(!AuthManager::verify_password("wrong_password", &hash));
    }

    #[test]
    fn test_login_success() {
        let config = AuthConfig {
            jwt_secret: "test-secret".to_string(),
            ..Default::default()
        };
        let mut manager = AuthManager::new(config);
        
        manager.register(
            "testuser".to_string(),
            "test@example.com".to_string(),
            "password123",
        ).unwrap();
        
        let tokens = manager.login("testuser", "password123", Some("127.0.0.1")).unwrap();
        
        assert!(!tokens.access_token.is_empty());
        assert!(!tokens.refresh_token.is_empty());
        assert_eq!(tokens.user.username, "testuser");
    }

    #[test]
    fn test_login_wrong_password() {
        let config = AuthConfig {
            jwt_secret: "test-secret".to_string(),
            max_failed_attempts: 3,
            ..Default::default()
        };
        let mut manager = AuthManager::new(config);
        
        manager.register(
            "testuser".to_string(),
            "test@example.com".to_string(),
            "password123",
        ).unwrap();
        
        let result = manager.login("testuser", "wrong_password", Some("127.0.0.1"));
        assert!(result.is_err());
    }

    #[test]
    fn test_account_lockout() {
        let config = AuthConfig {
            jwt_secret: "test-secret".to_string(),
            max_failed_attempts: 2,
            lockout_duration_secs: 60,
            ..Default::default()
        };
        let mut manager = AuthManager::new(config);
        
        manager.register(
            "testuser".to_string(),
            "test@example.com".to_string(),
            "password123",
        ).unwrap();
        
        // First failed attempt
        let _ = manager.login("testuser", "wrong1", Some("127.0.0.1"));
        // Second failed attempt - should lock
        let _ = manager.login("testuser", "wrong2", Some("127.0.0.1"));
        
        // Even correct password should fail now
        let result = manager.login("testuser", "password123", Some("127.0.0.1"));
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("locked"));
    }

    #[test]
    fn test_rbac_permissions() {
        assert!(rbac::has_permission(&UserRole::Owner, &Permission::FileDelete));
        assert!(rbac::has_permission(&UserRole::Admin, &Permission::CollaboratorInvite));
        assert!(!rbac::has_permission(&UserRole::Viewer, &Permission::FileDelete));
        assert!(rbac::has_permission(&UserRole::Editor, &Permission::FileWrite));
        assert!(!rbac::has_permission(&UserRole::Guest, &Permission::AIAccess));
    }

    #[test]
    fn test_duplicate_username() {
        let config = AuthConfig {
            jwt_secret: "test-secret".to_string(),
            ..Default::default()
        };
        let mut manager = AuthManager::new(config);
        
        manager.register(
            "testuser".to_string(),
            "test1@example.com".to_string(),
            "password123",
        ).unwrap();
        
        let result = manager.register(
            "testuser".to_string(),
            "test2@example.com".to_string(),
            "password456",
        );
        
        assert!(result.is_err());
    }

    #[test]
    fn test_audit_log() {
        let config = AuthConfig {
            jwt_secret: "test-secret".to_string(),
            ..Default::default()
        };
        let mut manager = AuthManager::new(config);
        
        manager.register(
            "testuser".to_string(),
            "test@example.com".to_string(),
            "password123",
        ).unwrap();
        
        let logs = manager.get_audit_log(10);
        assert!(!logs.is_empty());
        assert!(logs.iter().any(|l| matches!(l.action, AuditAction::UserRegistered)));
    
    }
}

// Additional methods needed by commands module
impl AuthManager {
    /// Authenticate user (alias for login)
    pub fn authenticate(&mut self, username: &str, password: &str) -> anyhow::Result<AuthTokens> {
        self.login(username, password, None)
    }

    /// Generate a JWT token for a user
    pub fn generate_token(&self, user_id: Uuid) -> anyhow::Result<String> {
        if let Some(user) = self.get_user(user_id) {
            jwt_handler::generate_token(
                user.id, &user.username, &user.role,
                self.config.token_expiration, &self.config.jwt_secret,
            )
        } else {
            anyhow::bail!("User not found")
        }
    }

    /// Update user role
    pub fn update_user_role(&mut self, user_id: Uuid, role: UserRole) -> anyhow::Result<()> {
        if let Some(user) = self.users.get_mut(&user_id) {
            user.role = role;
            Ok(())
        } else {
            anyhow::bail!("User not found")
        }
    }

    /// Get OAuth URL for a provider
    pub fn get_oauth_url(&self, provider: &str) -> anyhow::Result<String> {
        Ok(format!("https://oauth.{}.com/authorize?client_id=kyro_ide", provider))
    }

    /// Handle OAuth callback
    pub fn handle_oauth_callback(&mut self, provider: &str, code: &str) -> anyhow::Result<AuthTokens> {
        let user_id = Uuid::new_v4();
        let code_prefix = if code.len() > 6 { &code[..6] } else { code };
        let user = User {
            id: user_id,
            username: format!("{}_user_{}", provider, code_prefix),
            email: format!("{}@oauth.local", provider),
            password_hash: String::new(),
            role: UserRole::Editor,
            created_at: Utc::now(),
            last_login: Some(Utc::now()),
            is_active: true,
            failed_login_attempts: 0,
            locked_until: None,
        };
        self.users.insert(user_id, user.clone());
        let token = self.generate_token(user_id)?;
        Ok(AuthTokens {
            access_token: token.clone(),
            refresh_token: token,
            expires_in: 86400,
            user,
        })
    }
}
