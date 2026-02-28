//! Integration Tests for 50-User Collaboration
//!
//! Tests real-world collaboration scenarios

#[cfg(test)]
mod collaboration_integration_tests {
    use kyro_ide::collaboration::*;
    use kyro_ide::auth::*;
    use kyro_ide::e2ee::*;
    use uuid::Uuid;
    use std::sync::Arc;
    use tokio::sync::RwLock;

    /// Test: Create room and add 50 users
    #[tokio::test]
    async fn test_room_accepts_50_users() {
        let config = CollaborationServerConfig {
            max_users_per_room: 50,
            ..Default::default()
        };
        
        let server = CollaborationServer::new(config).unwrap();
        let room_id = RoomId("test-room".to_string());
        
        server.create_room(room_id.clone(), RoomConfig::default()).await.unwrap();
        
        // Add 50 users
        for i in 0..50 {
            let user = UserInfo {
                id: format!("user-{}", i),
                name: format!("User {}", i),
                email: Some(format!("user{}@example.com", i)),
                avatar: None,
                color: format!("#{:06x}", i * 0x333333),
            };
            
            let result = server.join_room(&room_id, user).await;
            assert!(result.is_ok(), "Failed to add user {}", i);
        }
        
        let stats = server.get_stats().await;
        assert_eq!(stats.total_users, 50);
    }

    /// Test: Room rejects 51st user
    #[tokio::test]
    async fn test_room_rejects_51st_user() {
        let config = CollaborationServerConfig {
            max_users_per_room: 50,
            ..Default::default()
        };
        
        let server = CollaborationServer::new(config).unwrap();
        let room_id = RoomId("test-room".to_string());
        
        server.create_room(room_id.clone(), RoomConfig::default()).await.unwrap();
        
        // Add 50 users
        for i in 0..50 {
            let user = UserInfo {
                id: format!("user-{}", i),
                name: format!("User {}", i),
                email: None,
                avatar: None,
                color: "#000000".to_string(),
            };
            server.join_room(&room_id, user).await.unwrap();
        }
        
        // Try to add 51st user
        let user_51 = UserInfo {
            id: "user-51".to_string(),
            name: "User 51".to_string(),
            email: None,
            avatar: None,
            color: "#000000".to_string(),
        };
        
        let result = server.join_room(&room_id, user_51).await;
        assert!(result.is_err(), "Should reject 51st user");
    }

    /// Test: Concurrent operations from multiple users
    #[tokio::test]
    async fn test_concurrent_operations() {
        let room = Arc::new(RwLock::new(
            Room::new(
                RoomId("concurrent-test".to_string()),
                RoomConfig::default(),
                50,
            ).unwrap()
        ));
        
        // Add users
        for i in 0..10 {
            let mut room_guard = room.write().await;
            room_guard.add_user(UserInfo {
                id: format!("user-{}", i),
                name: format!("User {}", i),
                email: None,
                avatar: None,
                color: "#000000".to_string(),
            }).unwrap();
        }
        
        // Simulate concurrent edits
        let mut handles = vec![];
        
        for i in 0..10 {
            let room_clone = room.clone();
            let handle = tokio::spawn(async move {
                let room_guard = room_clone.read().await;
                let ops = vec![Operation {
                    id: Uuid::new_v4().to_string(),
                    timestamp: 0,
                    user_id: format!("user-{}", i),
                    kind: OperationKind::Insert {
                        position: i * 10,
                        text: format!("User {} content", i),
                    },
                }];
                room_guard.apply_operations(&format!("user-{}", i), ops)
            });
            handles.push(handle);
        }
        
        // Wait for all operations
        for handle in handles {
            let result = handle.await.unwrap();
            assert!(result.is_ok());
        }
    }

    /// Test: Rate limiting per user
    #[tokio::test]
    async fn test_rate_limiting() {
        let config = RoomConfig {
            rate_limit: 10, // 10 ops/sec
            ..Default::default()
        };
        
        let room = Room::new(
            RoomId("rate-limit-test".to_string()),
            config,
            50,
        ).unwrap();
        
        let user_id = "rate-test-user";
        room.add_user(UserInfo {
            id: user_id.to_string(),
            name: "Rate Test User".to_string(),
            email: None,
            avatar: None,
            color: "#000000".to_string(),
        }).unwrap();
        
        // First 10 operations should succeed
        for i in 0..10 {
            let ops = vec![Operation {
                id: Uuid::new_v4().to_string(),
                timestamp: 0,
                user_id: user_id.to_string(),
                kind: OperationKind::Insert {
                    position: 0,
                    text: format!("Op {}", i),
                },
            }];
            let result = room.apply_operations(user_id, ops);
            assert!(result.is_ok(), "Op {} should succeed", i);
        }
        
        // 11th should be rate limited
        let ops = vec![Operation {
            id: Uuid::new_v4().to_string(),
            timestamp: 0,
            user_id: user_id.to_string(),
            kind: OperationKind::Insert {
                position: 0,
                text: "Op 11".to_string(),
            },
        }];
        let result = room.apply_operations(user_id, ops);
        assert!(result.is_err(), "Should be rate limited");
    }

    /// Test: Presence broadcast
    #[tokio::test]
    async fn test_presence_broadcast() {
        let room = Room::new(
            RoomId("presence-test".to_string()),
            RoomConfig::default(),
            50,
        ).unwrap();
        
        let user_id = "presence-user";
        room.add_user(UserInfo {
            id: user_id.to_string(),
            name: "Presence User".to_string(),
            email: None,
            avatar: None,
            color: "#FF0000".to_string(),
        }).unwrap();
        
        // Subscribe to presence updates
        let mut receiver = room.subscribe_presence();
        
        // Update cursor
        room.update_cursor(user_id, CursorPosition {
            line: 10,
            column: 5,
            file_path: Some("test.rs".to_string()),
        }).unwrap();
        
        // Receive broadcast
        let broadcast = tokio::time::timeout(
            tokio::time::Duration::from_millis(100),
            receiver.recv()
        ).await;
        
        assert!(broadcast.is_ok(), "Should receive presence broadcast");
    }
}

#[cfg(test)]
mod auth_integration_tests {
    use kyro_ide::auth::*;

    #[test]
    fn test_full_auth_flow() {
        let config = AuthConfig {
            jwt_secret: "test-secret-key".to_string(),
            max_failed_attempts: 3,
            ..Default::default()
        };
        let mut manager = AuthManager::new(config);
        
        // Register
        let user = manager.register(
            "testuser".to_string(),
            "test@example.com".to_string(),
            "securepassword123",
        ).unwrap();
        
        assert_eq!(user.username, "testuser");
        
        // Login
        let tokens = manager.login("testuser", "securepassword123", Some("127.0.0.1")).unwrap();
        assert!(!tokens.access_token.is_empty());
        
        // Validate token
        let claims = manager.validate_token(&tokens.access_token).unwrap();
        assert_eq!(claims.user_id, user.id);
        
        // Refresh
        let new_tokens = manager.refresh(&tokens.refresh_token).unwrap();
        assert!(!new_tokens.access_token.is_empty());
        assert_ne!(new_tokens.access_token, tokens.access_token);
        
        // Logout
        manager.logout(user.id).unwrap();
    }

    #[test]
    fn test_failed_login_lockout() {
        let config = AuthConfig {
            jwt_secret: "test-secret".to_string(),
            max_failed_attempts: 2,
            lockout_duration_secs: 60,
            ..Default::default()
        };
        let mut manager = AuthManager::new(config);
        
        manager.register(
            "lockoutuser".to_string(),
            "lockout@example.com".to_string(),
            "correctpassword",
        ).unwrap();
        
        // First failed attempt
        let result = manager.login("lockoutuser", "wrong1", Some("127.0.0.1"));
        assert!(result.is_err());
        
        // Second failed attempt - account locked
        let result = manager.login("lockoutuser", "wrong2", Some("127.0.0.1"));
        assert!(result.is_err());
        
        // Even correct password fails when locked
        let result = manager.login("lockoutuser", "correctpassword", Some("127.0.0.1"));
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("locked"));
    }

    #[test]
    fn test_rbac_permissions() {
        assert!(rbac::has_permission(&UserRole::Owner, &Permission::FileDelete));
        assert!(rbac::has_permission(&UserRole::Admin, &Permission::AdminAccess));
        assert!(rbac::has_permission(&UserRole::Editor, &Permission::FileWrite));
        assert!(!rbac::has_permission(&UserRole::Viewer, &Permission::FileDelete));
        assert!(!rbac::has_permission(&UserRole::Guest, &Permission::AIAccess));
    }
}

#[cfg(test)]
mod e2ee_integration_tests {
    use kyro_ide::e2ee::*;

    #[test]
    fn test_x3dh_key_exchange() {
        let initiator = X3DHInitiator::new();
        let responder = X3DHResponder::new();
        
        let bundle = responder.get_bundle();
        
        let result1 = initiator.perform_x3dh(&bundle).unwrap();
        let result2 = responder.complete_x3dh(
            &initiator.get_identity_public(),
            &initiator.get_ephemeral_public(),
        ).unwrap();
        
        // Both parties derive the same shared secret
        assert_eq!(result1.shared_secret, result2.shared_secret);
    }

    #[test]
    fn test_encrypted_channel() {
        let root_key = [0u8; 32];
        let mut channel = EncryptedChannel::new(root_key, E2eeConfig::default());
        
        let user1 = uuid::Uuid::new_v4();
        let user2 = uuid::Uuid::new_v4();
        
        channel.add_participant(user1);
        channel.add_participant(user2);
        
        assert_eq!(channel.participant_count(), 2);
    }

    #[test]
    fn test_e2ee_manager_sessions() {
        let mut manager = E2eeManager::new(E2eeConfig::default());
        
        let user_id = uuid::Uuid::new_v4();
        let peer_id = uuid::Uuid::new_v4();
        
        let session_id = manager.create_session(user_id, peer_id);
        assert!(manager.get_session(session_id).is_some());
    }
}
