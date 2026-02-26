//! Unit Tests for Authentication Module
//!
//! Comprehensive tests for JWT handling, password hashing,
//! rate limiting, RBAC, and session management.

#[cfg(test)]
mod auth_tests {
    use kyro_ide::auth::*;
    use std::collections::HashMap;
    use std::time::Duration;

    // ============= Password Hashing Tests =============

    mod password_hashing {
        use super::*;

        #[test]
        fn test_password_hash_creates_unique_hashes() {
            let password = "test_password_123";
            let hash1 = hash_password(password).unwrap();
            let hash2 = hash_password(password).unwrap();
            
            // Same password should produce different hashes (salt)
            assert_ne!(hash1, hash2, "Same password should produce different hashes");
        }

        #[test]
        fn test_password_verification_success() {
            let password = "correct_password";
            let hash = hash_password(password).unwrap();
            
            assert!(verify_password(password, &hash).unwrap(), 
                "Password verification should succeed with correct password");
        }

        #[test]
        fn test_password_verification_failure() {
            let password = "correct_password";
            let wrong_password = "wrong_password";
            let hash = hash_password(password).unwrap();
            
            assert!(!verify_password(wrong_password, &hash).unwrap(),
                "Password verification should fail with wrong password");
        }

        #[test]
        fn test_empty_password_rejected() {
            let result = hash_password("");
            assert!(result.is_err(), "Empty password should be rejected");
        }

        #[test]
        fn test_long_password_accepted() {
            let long_password = "a".repeat(1000);
            let hash = hash_password(&long_password).unwrap();
            assert!(verify_password(&long_password, &hash).unwrap(),
                "Long password should be accepted and verified");
        }

        #[test]
        fn test_unicode_password() {
            let unicode_password = "密码测试🔐🚀";
            let hash = hash_password(unicode_password).unwrap();
            assert!(verify_password(unicode_password, &hash).unwrap(),
                "Unicode password should work");
        }

        #[test]
        fn test_argon2_parameters() {
            // Verify Argon2id is used with proper parameters
            let password = "test";
            let hash = hash_password(password).unwrap();
            
            // Argon2id hash format: $argon2id$v=19$m=...,t=...,p=...$...
            assert!(hash.starts_with("$argon2id$"), 
                "Should use Argon2id algorithm");
        }
    }

    // ============= JWT Token Tests =============

    mod jwt_tests {
        use super::*;

        #[test]
        fn test_jwt_generation_and_validation() {
            let claims = UserClaims {
                sub: "user-123".to_string(),
                email: "test@example.com".to_string(),
                role: Role::Editor,
                exp: (chrono::Utc::now() + chrono::Duration::hours(1)).timestamp() as u64,
                iat: chrono::Utc::now().timestamp() as u64,
            };
            
            let token = generate_jwt(&claims).unwrap();
            let validated = validate_jwt(&token).unwrap();
            
            assert_eq!(validated.sub, claims.sub);
            assert_eq!(validated.email, claims.email);
        }

        #[test]
        fn test_jwt_expiration() {
            let expired_claims = UserClaims {
                sub: "user-123".to_string(),
                email: "test@example.com".to_string(),
                role: Role::Editor,
                exp: (chrono::Utc::now() - chrono::Duration::hours(1)).timestamp() as u64,
                iat: (chrono::Utc::now() - chrono::Duration::hours(2)).timestamp() as u64,
            };
            
            let token = generate_jwt(&expired_claims).unwrap();
            let result = validate_jwt(&token);
            
            assert!(result.is_err(), "Expired token should be rejected");
        }

        #[test]
        fn test_jwt_tampering_detected() {
            let claims = UserClaims {
                sub: "user-123".to_string(),
                email: "test@example.com".to_string(),
                role: Role::Editor,
                exp: (chrono::Utc::now() + chrono::Duration::hours(1)).timestamp() as u64,
                iat: chrono::Utc::now().timestamp() as u64,
            };
            
            let token = generate_jwt(&claims).unwrap();
            
            // Tamper with the token (change one character)
            let mut tampered = token.clone();
            if let Some(c) = tampered.chars().nth_mut(20) {
                *c = if *c == 'a' { 'b' } else { 'a' };
            }
            
            let result = validate_jwt(&tampered);
            assert!(result.is_err(), "Tampered token should be rejected");
        }

        #[test]
        fn test_jwt_role_extraction() {
            let claims = UserClaims {
                sub: "user-123".to_string(),
                email: "test@example.com".to_string(),
                role: Role::Admin,
                exp: (chrono::Utc::now() + chrono::Duration::hours(1)).timestamp() as u64,
                iat: chrono::Utc::now().timestamp() as u64,
            };
            
            let token = generate_jwt(&claims).unwrap();
            let validated = validate_jwt(&token).unwrap();
            
            assert_eq!(validated.role, Role::Admin, "Role should be preserved in token");
        }

        #[test]
        fn test_jwt_refresh_token() {
            let refresh_token = generate_refresh_token("user-123").unwrap();
            let user_id = validate_refresh_token(&refresh_token).unwrap();
            
            assert_eq!(user_id, "user-123", "Refresh token should validate user ID");
        }
    }

    // ============= Rate Limiting Tests =============

    mod rate_limiting_tests {
        use super::*;

        #[test]
        fn test_rate_limit_allows_within_limit() {
            let mut limiter = RateLimiter::new(60, Duration::from_secs(60)); // 60 req/min
            let client_id = "client-123";
            
            for _ in 0..60 {
                assert!(limiter.check(client_id).unwrap(),
                    "Requests within limit should be allowed");
            }
        }

        #[test]
        fn test_rate_limit_blocks_over_limit() {
            let mut limiter = RateLimiter::new(10, Duration::from_secs(60)); // 10 req/min
            let client_id = "client-123";
            
            for _ in 0..10 {
                limiter.check(client_id).unwrap();
            }
            
            assert!(!limiter.check(client_id).unwrap(),
                "Request over limit should be blocked");
        }

        #[test]
        fn test_rate_limit_resets_after_window() {
            let mut limiter = RateLimiter::new(5, Duration::from_millis(100));
            let client_id = "client-123";
            
            for _ in 0..5 {
                limiter.check(client_id).unwrap();
            }
            
            assert!(!limiter.check(client_id).unwrap());
            
            // Wait for window to reset
            std::thread::sleep(Duration::from_millis(150));
            
            assert!(limiter.check(client_id).unwrap(),
                "Rate limit should reset after window");
        }

        #[test]
        fn test_rate_limit_per_client() {
            let mut limiter = RateLimiter::new(5, Duration::from_secs(60));
            
            // Client 1 uses all their requests
            for _ in 0..5 {
                limiter.check("client-1").unwrap();
            }
            
            // Client 2 should still be able to make requests
            assert!(limiter.check("client-2").unwrap(),
                "Different clients should have separate rate limits");
        }

        #[test]
        fn test_sliding_window_rate_limit() {
            let mut limiter = SlidingWindowRateLimiter::new(100, Duration::from_secs(1));
            let client_id = "client-123";
            
            // Rapid requests should trigger rate limiting
            let mut allowed = 0;
            let mut blocked = 0;
            
            for _ in 0..200 {
                if limiter.check(client_id).unwrap() {
                    allowed += 1;
                } else {
                    blocked += 1;
                }
            }
            
            assert!(allowed <= 100, "Should allow at most 100 requests");
            assert!(blocked >= 100, "Should block requests over limit");
        }
    }

    // ============= RBAC Tests =============

    mod rbac_tests {
        use super::*;

        #[test]
        fn test_role_hierarchy() {
            assert!(Role::Owner > Role::Admin);
            assert!(Role::Admin > Role::Editor);
            assert!(Role::Editor > Role::Viewer);
            assert!(Role::Viewer > Role::Guest);
        }

        #[test]
        fn test_permission_check_owner() {
            let role = Role::Owner;
            
            assert!(has_permission(role, Permission::ReadFile));
            assert!(has_permission(role, Permission::WriteFile));
            assert!(has_permission(role, Permission::DeleteFile));
            assert!(has_permission(role, Permission::ManageUsers));
            assert!(has_permission(role, Permission::AdminPanel));
        }

        #[test]
        fn test_permission_check_admin() {
            let role = Role::Admin;
            
            assert!(has_permission(role, Permission::ReadFile));
            assert!(has_permission(role, Permission::WriteFile));
            assert!(has_permission(role, Permission::DeleteFile));
            assert!(has_permission(role, Permission::ManageUsers));
            assert!(!has_permission(role, Permission::AdminPanel));
        }

        #[test]
        fn test_permission_check_editor() {
            let role = Role::Editor;
            
            assert!(has_permission(role, Permission::ReadFile));
            assert!(has_permission(role, Permission::WriteFile));
            assert!(!has_permission(role, Permission::DeleteFile));
            assert!(!has_permission(role, Permission::ManageUsers));
        }

        #[test]
        fn test_permission_check_viewer() {
            let role = Role::Viewer;
            
            assert!(has_permission(role, Permission::ReadFile));
            assert!(!has_permission(role, Permission::WriteFile));
            assert!(!has_permission(role, Permission::DeleteFile));
        }

        #[test]
        fn test_permission_check_guest() {
            let role = Role::Guest;
            
            assert!(has_permission(role, Permission::ReadFile));
            assert!(!has_permission(role, Permission::WriteFile));
        }

        #[test]
        fn test_role_from_string() {
            assert_eq!(Role::from_str("owner").unwrap(), Role::Owner);
            assert_eq!(Role::from_str("admin").unwrap(), Role::Admin);
            assert_eq!(Role::from_str("editor").unwrap(), Role::Editor);
            assert_eq!(Role::from_str("viewer").unwrap(), Role::Viewer);
            assert_eq!(Role::from_str("guest").unwrap(), Role::Guest);
            assert!(Role::from_str("invalid").is_err());
        }
    }

    // ============= Account Lockout Tests =============

    mod account_lockout_tests {
        use super::*;

        #[test]
        fn test_lockout_after_failed_attempts() {
            let mut lockout = AccountLockout::new(5, Duration::from_secs(300));
            let user_id = "user-123";
            
            // 5 failed attempts
            for _ in 0..5 {
                lockout.record_failed_attempt(user_id);
            }
            
            assert!(lockout.is_locked(user_id), 
                "Account should be locked after 5 failed attempts");
        }

        #[test]
        fn test_no_lockout_before_threshold() {
            let mut lockout = AccountLockout::new(5, Duration::from_secs(300));
            let user_id = "user-123";
            
            // 4 failed attempts (under threshold)
            for _ in 0..4 {
                lockout.record_failed_attempt(user_id);
            }
            
            assert!(!lockout.is_locked(user_id),
                "Account should not be locked before threshold");
        }

        #[test]
        fn test_lockout_expires() {
            let mut lockout = AccountLockout::new(3, Duration::from_millis(100));
            let user_id = "user-123";
            
            for _ in 0..3 {
                lockout.record_failed_attempt(user_id);
            }
            
            assert!(lockout.is_locked(user_id));
            
            std::thread::sleep(Duration::from_millis(150));
            
            assert!(!lockout.is_locked(user_id),
                "Lockout should expire after duration");
        }

        #[test]
        fn test_successful_login_resets_lockout() {
            let mut lockout = AccountLockout::new(5, Duration::from_secs(300));
            let user_id = "user-123";
            
            // Some failed attempts
            for _ in 0..3 {
                lockout.record_failed_attempt(user_id);
            }
            
            // Successful login
            lockout.reset(user_id);
            
            // Should not be locked
            assert!(!lockout.is_locked(user_id));
            
            // Counter should be reset
            assert_eq!(lockout.get_failed_attempts(user_id), 0);
        }
    }

    // ============= Session Management Tests =============

    mod session_tests {
        use super::*;

        #[test]
        fn test_session_creation() {
            let session = Session::new("user-123", Duration::from_secs(3600));
            
            assert_eq!(session.user_id, "user-123");
            assert!(!session.is_expired());
            assert!(session.is_active);
        }

        #[test]
        fn test_session_expiration() {
            let session = Session::new("user-123", Duration::from_millis(50));
            
            assert!(!session.is_expired());
            
            std::thread::sleep(Duration::from_millis(100));
            
            assert!(session.is_expired());
        }

        #[test]
        fn test_session_invalidation() {
            let mut session = Session::new("user-123", Duration::from_secs(3600));
            
            session.invalidate();
            
            assert!(!session.is_active);
        }

        #[test]
        fn test_session_store_operations() {
            let mut store = SessionStore::new(Duration::from_secs(3600));
            
            let session_id = store.create_session("user-123").unwrap();
            
            assert!(store.get_session(&session_id).is_some());
            assert_eq!(store.get_session(&session_id).unwrap().user_id, "user-123");
            
            store.invalidate_session(&session_id);
            
            assert!(store.get_session(&session_id).is_none());
        }

        #[test]
        fn test_concurrent_session_limit() {
            let mut store = SessionStore::new(Duration::from_secs(3600));
            store.set_max_sessions_per_user(3);
            
            let user_id = "user-123";
            
            // Create 3 sessions
            let s1 = store.create_session(user_id).unwrap();
            let s2 = store.create_session(user_id).unwrap();
            let s3 = store.create_session(user_id).unwrap();
            
            // All 3 should exist
            assert!(store.get_session(&s1).is_some());
            assert!(store.get_session(&s2).is_some());
            assert!(store.get_session(&s3).is_some());
            
            // 4th session should evict oldest
            let s4 = store.create_session(user_id).unwrap();
            
            assert!(store.get_session(&s1).is_none(), "Oldest session should be evicted");
            assert!(store.get_session(&s4).is_some());
        }
    }

    // ============= Audit Logging Tests =============

    mod audit_tests {
        use super::*;

        #[test]
        fn test_audit_log_creation() {
            let entry = AuditEntry {
                timestamp: chrono::Utc::now(),
                user_id: "user-123".to_string(),
                action: AuditAction::Login,
                resource: "session".to_string(),
                ip_address: "192.168.1.1".to_string(),
                user_agent: "Test/1.0".to_string(),
                success: true,
                details: HashMap::new(),
            };
            
            let log = AuditLog::new();
            log.append(entry).unwrap();
            
            let entries = log.get_entries("user-123").unwrap();
            assert_eq!(entries.len(), 1);
        }

        #[test]
        fn test_suspicious_activity_detection() {
            let mut detector = SuspiciousActivityDetector::new();
            
            // Multiple failed logins from same IP
            let ip = "192.168.1.100";
            for _ in 0..10 {
                detector.record_event(SecurityEvent::FailedLogin, ip);
            }
            
            assert!(detector.is_suspicious(ip), 
                "Multiple failed logins should be flagged");
        }

        #[test]
        fn test_audit_log_retention() {
            let log = AuditLog::new();
            log.set_retention(Duration::from_secs(1));
            
            let entry = AuditEntry {
                timestamp: chrono::Utc::now() - chrono::Duration::seconds(2),
                user_id: "user-123".to_string(),
                action: AuditAction::Login,
                resource: "session".to_string(),
                ip_address: "192.168.1.1".to_string(),
                user_agent: "Test/1.0".to_string(),
                success: true,
                details: HashMap::new(),
            };
            
            log.append(entry).unwrap();
            log.cleanup_expired();
            
            let entries = log.get_entries("user-123").unwrap();
            assert!(entries.is_empty(), "Expired entries should be removed");
        }
    }

    // ============= OAuth Tests =============

    mod oauth_tests {
        use super::*;

        #[test]
        fn test_oauth_state_generation() {
            let state1 = generate_oauth_state();
            let state2 = generate_oauth_state();
            
            assert_ne!(state1, state2, "OAuth states should be unique");
            assert!(state1.len() >= 32, "OAuth state should be at least 32 chars");
        }

        #[test]
        fn test_github_oauth_url() {
            let config = OAuthConfig {
                provider: OAuthProvider::GitHub,
                client_id: "test-client-id".to_string(),
                client_secret: "test-secret".to_string(),
                redirect_uri: "http://localhost:3000/callback".to_string(),
            };
            
            let url = build_oauth_url(&config, "test-state").unwrap();
            
            assert!(url.contains("github.com"));
            assert!(url.contains("test-client-id"));
            assert!(url.contains("test-state"));
        }

        #[test]
        fn test_oauth_callback_validation() {
            let state_store = OAuthStateStore::new();
            let state = state_store.create_state("user-session-123").unwrap();
            
            // Validate correct state
            assert!(state_store.validate_state(&state).is_ok());
            
            // Invalid state should fail
            assert!(state_store.validate_state("invalid-state").is_err());
        }
    }
}
