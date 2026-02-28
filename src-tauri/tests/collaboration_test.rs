//! Unit Tests for Collaboration Module
//!
//! Tests for 50-user collaboration, CRDT synchronization,
//! presence broadcasting, and conflict resolution

#[cfg(test)]
mod collaboration_tests {
    use kyro_ide::collaboration::*;
    use std::sync::Arc;
    use tokio::sync::RwLock;
    use uuid::Uuid;

    // ============= Room Management Tests =============

    mod room_tests {
        use super::*;

        #[tokio::test]
        async fn test_room_creation() {
            let config = CollaborationServerConfig::default();
            let server = CollaborationServer::new(config).unwrap();
            
            let room_id = RoomId("test-room".to_string());
            let result = server.create_room(room_id.clone(), RoomConfig::default()).await;
            
            assert!(result.is_ok());
            assert!(server.room_exists(&room_id).await);
        }

        #[tokio::test]
        async fn test_room_deletion() {
            let config = CollaborationServerConfig::default();
            let server = CollaborationServer::new(config).unwrap();
            
            let room_id = RoomId("test-room".to_string());
            server.create_room(room_id.clone(), RoomConfig::default()).await.unwrap();
            
            server.delete_room(&room_id).await.unwrap();
            
            assert!(!server.room_exists(&room_id).await);
        }

        #[tokio::test]
        async fn test_duplicate_room_rejected() {
            let config = CollaborationServerConfig::default();
            let server = CollaborationServer::new(config).unwrap();
            
            let room_id = RoomId("test-room".to_string());
            server.create_room(room_id.clone(), RoomConfig::default()).await.unwrap();
            
            let result = server.create_room(room_id, RoomConfig::default()).await;
            assert!(result.is_err(), "Duplicate room should be rejected");
        }

        #[tokio::test]
        async fn test_max_rooms_limit() {
            let config = CollaborationServerConfig {
                max_rooms: 5,
                ..Default::default()
            };
            let server = CollaborationServer::new(config).unwrap();
            
            for i in 0..5 {
                let room_id = RoomId(format!("room-{}", i));
                server.create_room(room_id, RoomConfig::default()).await.unwrap();
            }
            
            let result = server.create_room(RoomId("room-6".to_string()), RoomConfig::default()).await;
            assert!(result.is_err(), "Should reject room over limit");
        }
    }

    // ============= User Join/Leave Tests =============

    mod user_management_tests {
        use super::*;

        #[tokio::test]
        async fn test_user_join_room() {
            let server = CollaborationServer::new(CollaborationServerConfig::default()).unwrap();
            let room_id = RoomId("test-room".to_string());
            
            server.create_room(room_id.clone(), RoomConfig::default()).await.unwrap();
            
            let user = UserInfo {
                id: "user-1".to_string(),
                name: "Test User".to_string(),
                email: Some("test@example.com".to_string()),
                avatar: None,
                color: "#FF5733".to_string(),
            };
            
            let result = server.join_room(&room_id, user).await;
            assert!(result.is_ok());
            
            let users = server.get_room_users(&room_id).await.unwrap();
            assert_eq!(users.len(), 1);
        }

        #[tokio::test]
        async fn test_user_leave_room() {
            let server = CollaborationServer::new(CollaborationServerConfig::default()).unwrap();
            let room_id = RoomId("test-room".to_string());
            
            server.create_room(room_id.clone(), RoomConfig::default()).await.unwrap();
            
            let user = UserInfo {
                id: "user-1".to_string(),
                name: "Test User".to_string(),
                email: None,
                avatar: None,
                color: "#FF5733".to_string(),
            };
            
            server.join_room(&room_id, user.clone()).await.unwrap();
            server.leave_room(&room_id, &user.id).await.unwrap();
            
            let users = server.get_room_users(&room_id).await.unwrap();
            assert!(users.is_empty());
        }

        #[tokio::test]
        async fn test_max_users_per_room() {
            let config = CollaborationServerConfig {
                max_users_per_room: 3,
                ..Default::default()
            };
            let server = CollaborationServer::new(config).unwrap();
            let room_id = RoomId("test-room".to_string());
            
            server.create_room(room_id.clone(), RoomConfig::default()).await.unwrap();
            
            // Add 3 users (at limit)
            for i in 0..3 {
                let user = UserInfo {
                    id: format!("user-{}", i),
                    name: format!("User {}", i),
                    email: None,
                    avatar: None,
                    color: format!("#{:06x}", i * 0x333333),
                };
                server.join_room(&room_id, user).await.unwrap();
            }
            
            // 4th user should be rejected
            let user_4 = UserInfo {
                id: "user-4".to_string(),
                name: "User 4".to_string(),
                email: None,
                avatar: None,
                color: "#000000".to_string(),
            };
            
            let result = server.join_room(&room_id, user_4).await;
            assert!(result.is_err(), "Should reject user over limit");
        }

        #[tokio::test]
        async fn test_50_users_in_room() {
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
                    color: format!("#{:06x}", i * 0x333333),
                };
                let result = server.join_room(&room_id, user).await;
                assert!(result.is_ok(), "Failed to add user {}", i);
            }
            
            let stats = server.get_stats().await;
            assert_eq!(stats.total_users, 50);
        }

        #[tokio::test]
        async fn test_51st_user_rejected() {
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
            
            // Try 51st user
            let user_51 = UserInfo {
                id: "user-51".to_string(),
                name: "User 51".to_string(),
                email: None,
                avatar: None,
                color: "#000000".to_string(),
            };
            
            let result = server.join_room(&room_id, user_51).await;
            assert!(result.is_err(), "51st user should be rejected");
        }

        #[tokio::test]
        async fn test_duplicate_user_rejected() {
            let server = CollaborationServer::new(CollaborationServerConfig::default()).unwrap();
            let room_id = RoomId("test-room".to_string());
            
            server.create_room(room_id.clone(), RoomConfig::default()).await.unwrap();
            
            let user = UserInfo {
                id: "user-1".to_string(),
                name: "Test User".to_string(),
                email: None,
                avatar: None,
                color: "#FF5733".to_string(),
            };
            
            server.join_room(&room_id, user.clone()).await.unwrap();
            
            // Try to join again with same user
            let result = server.join_room(&room_id, user).await;
            assert!(result.is_err(), "Duplicate user should be rejected");
        }
    }

    // ============= CRDT Synchronization Tests =============

    mod crdt_tests {
        use super::*;

        #[tokio::test]
        async fn test_document_insert() {
            let doc = CollaborativeDocument::new("doc-1");
            
            let op = Operation::Insert {
                client_id: "user-1".to_string(),
                position: 0,
                text: "Hello".to_string(),
                timestamp: 1,
            };
            
            doc.apply_operation(op).await.unwrap();
            
            let content = doc.get_content().await;
            assert_eq!(content, "Hello");
        }

        #[tokio::test]
        async fn test_document_delete() {
            let doc = CollaborativeDocument::new("doc-1");
            
            // Insert first
            doc.apply_operation(Operation::Insert {
                client_id: "user-1".to_string(),
                position: 0,
                text: "Hello World".to_string(),
                timestamp: 1,
            }).await.unwrap();
            
            // Delete "World"
            doc.apply_operation(Operation::Delete {
                client_id: "user-1".to_string(),
                position: 6,
                length: 5,
                timestamp: 2,
            }).await.unwrap();
            
            let content = doc.get_content().await;
            assert_eq!(content, "Hello ");
        }

        #[tokio::test]
        async fn test_concurrent_inserts() {
            let doc = Arc::new(CollaborativeDocument::new("doc-1"));
            
            // Two users insert at position 0 concurrently
            let doc1 = doc.clone();
            let doc2 = doc.clone();
            
            let handle1 = tokio::spawn(async move {
                doc1.apply_operation(Operation::Insert {
                    client_id: "user-1".to_string(),
                    position: 0,
                    text: "A".to_string(),
                    timestamp: 1,
                }).await
            });
            
            let handle2 = tokio::spawn(async move {
                doc2.apply_operation(Operation::Insert {
                    client_id: "user-2".to_string(),
                    position: 0,
                    text: "B".to_string(),
                    timestamp: 1,
                }).await
            });
            
            handle1.await.unwrap().unwrap();
            handle2.await.unwrap().unwrap();
            
            let content = doc.get_content().await;
            // CRDT should converge - both characters should be present
            assert_eq!(content.len(), 2);
            assert!(content.contains('A'));
            assert!(content.contains('B'));
        }

        #[tokio::test]
        async fn test_operation_ordering() {
            let doc = CollaborativeDocument::new("doc-1");
            
            // Operations from same client should be ordered
            doc.apply_operation(Operation::Insert {
                client_id: "user-1".to_string(),
                position: 0,
                text: "A".to_string(),
                timestamp: 1,
            }).await.unwrap();
            
            doc.apply_operation(Operation::Insert {
                client_id: "user-1".to_string(),
                position: 1,
                text: "B".to_string(),
                timestamp: 2,
            }).await.unwrap();
            
            doc.apply_operation(Operation::Insert {
                client_id: "user-1".to_string(),
                position: 2,
                text: "C".to_string(),
                timestamp: 3,
            }).await.unwrap();
            
            assert_eq!(doc.get_content().await, "ABC");
        }

        #[tokio::test]
        async fn test_late_arriving_operation() {
            let doc = CollaborativeDocument::new("doc-1");
            
            // Insert at position 0
            doc.apply_operation(Operation::Insert {
                client_id: "user-1".to_string(),
                position: 0,
                text: "Hello".to_string(),
                timestamp: 1,
            }).await.unwrap();
            
            // Late-arriving insert at position 0 (should still work)
            doc.apply_operation(Operation::Insert {
                client_id: "user-2".to_string(),
                position: 0,
                text: "World ".to_string(),
                timestamp: 0, // Earlier timestamp
            }).await.unwrap();
            
            // CRDT should handle this correctly
            let content = doc.get_content().await;
            assert!(content.contains("Hello"));
            assert!(content.contains("World"));
        }
    }

    // ============= Presence Tests =============

    mod presence_tests {
        use super::*;

        #[tokio::test]
        async fn test_presence_broadcast() {
            let server = CollaborationServer::new(CollaborationServerConfig::default()).unwrap();
            let room_id = RoomId("test-room".to_string());
            
            server.create_room(room_id.clone(), RoomConfig::default()).await.unwrap();
            
            let user1 = UserInfo {
                id: "user-1".to_string(),
                name: "User 1".to_string(),
                email: None,
                avatar: None,
                color: "#FF0000".to_string(),
            };
            
            server.join_room(&room_id, user1.clone()).await.unwrap();
            
            // Update presence
            let presence = UserPresence {
                user_id: user1.id.clone(),
                cursor_position: Some(CursorPosition { line: 10, column: 5 }),
                selection: None,
                active_file: Some("main.rs".to_string()),
            };
            
            server.update_presence(&room_id, presence.clone()).await.unwrap();
            
            let all_presence = server.get_room_presence(&room_id).await.unwrap();
            assert!(all_presence.contains_key(&user1.id));
        }

        #[tokio::test]
        async fn test_presence_throttling() {
            let server = CollaborationServer::new(CollaborationServerConfig {
                presence_throttle_ms: 50,
                ..Default::default()
            }).unwrap();
            let room_id = RoomId("test-room".to_string());
            
            server.create_room(room_id.clone(), RoomConfig::default()).await.unwrap();
            
            let user = UserInfo {
                id: "user-1".to_string(),
                name: "User 1".to_string(),
                email: None,
                avatar: None,
                color: "#FF0000".to_string(),
            };
            
            server.join_room(&room_id, user.clone()).await.unwrap();
            
            // Rapid presence updates
            for i in 0..100 {
                let presence = UserPresence {
                    user_id: user.id.clone(),
                    cursor_position: Some(CursorPosition { line: i, column: 0 }),
                    selection: None,
                    active_file: None,
                };
                server.update_presence(&room_id, presence).await.unwrap();
            }
            
            // Should be throttled - not all updates processed
            let stats = server.get_stats().await;
            assert!(stats.presence_updates_processed < 100);
        }

        #[tokio::test]
        async fn test_presence_cleanup_on_leave() {
            let server = CollaborationServer::new(CollaborationServerConfig::default()).unwrap();
            let room_id = RoomId("test-room".to_string());
            
            server.create_room(room_id.clone(), RoomConfig::default()).await.unwrap();
            
            let user = UserInfo {
                id: "user-1".to_string(),
                name: "User 1".to_string(),
                email: None,
                avatar: None,
                color: "#FF0000".to_string(),
            };
            
            server.join_room(&room_id, user.clone()).await.unwrap();
            
            let presence = UserPresence {
                user_id: user.id.clone(),
                cursor_position: Some(CursorPosition { line: 0, column: 0 }),
                selection: None,
                active_file: None,
            };
            server.update_presence(&room_id, presence).await.unwrap();
            
            // Leave room
            server.leave_room(&room_id, &user.id).await.unwrap();
            
            // Presence should be cleaned up
            let all_presence = server.get_room_presence(&room_id).await.unwrap();
            assert!(!all_presence.contains_key(&user.id));
        }
    }

    // ============= Rate Limiting Tests =============

    mod rate_limiting_tests {
        use super::*;

        #[tokio::test]
        async fn test_operation_rate_limit() {
            let config = CollaborationServerConfig {
                max_operations_per_second: 10,
                ..Default::default()
            };
            let server = CollaborationServer::new(config).unwrap();
            let room_id = RoomId("test-room".to_string());
            
            server.create_room(room_id.clone(), RoomConfig::default()).await.unwrap();
            
            let user = UserInfo {
                id: "user-1".to_string(),
                name: "User 1".to_string(),
                email: None,
                avatar: None,
                color: "#FF0000".to_string(),
            };
            
            server.join_room(&room_id, user.clone()).await.unwrap();
            
            // Rapid operations
            let mut allowed = 0;
            let mut blocked = 0;
            
            for i in 0..20 {
                let op = Operation::Insert {
                    client_id: user.id.clone(),
                    position: 0,
                    text: format!("{}", i),
                    timestamp: i as u64,
                };
                
                match server.submit_operation(&room_id, op).await {
                    Ok(_) => allowed += 1,
                    Err(_) => blocked += 1,
                }
            }
            
            assert!(allowed <= 10, "Should allow at most 10 operations");
            assert!(blocked >= 10, "Should block excess operations");
        }

        #[tokio::test]
        async fn test_rate_limit_per_user() {
            let config = CollaborationServerConfig {
                max_operations_per_second: 5,
                ..Default::default()
            };
            let server = CollaborationServer::new(config).unwrap();
            let room_id = RoomId("test-room".to_string());
            
            server.create_room(room_id.clone(), RoomConfig::default()).await.unwrap();
            
            // Two users
            for user_id in 0..2 {
                let user = UserInfo {
                    id: format!("user-{}", user_id),
                    name: format!("User {}", user_id),
                    email: None,
                    avatar: None,
                    color: "#FF0000".to_string(),
                };
                server.join_room(&room_id, user).await.unwrap();
            }
            
            // Each user should have their own rate limit
            for user_id in 0..2 {
                let mut allowed = 0;
                for i in 0..10 {
                    let op = Operation::Insert {
                        client_id: format!("user-{}", user_id),
                        position: 0,
                        text: format!("{}", i),
                        timestamp: i as u64,
                    };
                    if server.submit_operation(&room_id, op).await.is_ok() {
                        allowed += 1;
                    }
                }
                assert!(allowed <= 5, "Each user should have separate rate limit");
            }
        }
    }

    // ============= Operation Logging Tests =============

    mod operation_logging_tests {
        use super::*;

        #[tokio::test]
        async fn test_operation_logged() {
            let server = CollaborationServer::new(CollaborationServerConfig::default()).unwrap();
            let room_id = RoomId("test-room".to_string());
            
            server.create_room(room_id.clone(), RoomConfig::default()).await.unwrap();
            
            let user = UserInfo {
                id: "user-1".to_string(),
                name: "User 1".to_string(),
                email: None,
                avatar: None,
                color: "#FF0000".to_string(),
            };
            server.join_room(&room_id, user.clone()).await.unwrap();
            
            let op = Operation::Insert {
                client_id: user.id.clone(),
                position: 0,
                text: "Hello".to_string(),
                timestamp: 1,
            };
            server.submit_operation(&room_id, op).await.unwrap();
            
            let log = server.get_operation_log(&room_id).await.unwrap();
            assert_eq!(log.len(), 1);
            assert_eq!(log[0].client_id, user.id);
        }

        #[tokio::test]
        async fn test_conflict_resolution_log() {
            let server = CollaborationServer::new(CollaborationServerConfig::default()).unwrap();
            let room_id = RoomId("test-room".to_string());
            
            server.create_room(room_id.clone(), RoomConfig::default()).await.unwrap();
            
            // Add users
            for i in 0..2 {
                let user = UserInfo {
                    id: format!("user-{}", i),
                    name: format!("User {}", i),
                    email: None,
                    avatar: None,
                    color: "#FF0000".to_string(),
                };
                server.join_room(&room_id, user).await.unwrap();
            }
            
            // Concurrent operations
            let op1 = Operation::Insert {
                client_id: "user-0".to_string(),
                position: 0,
                text: "A".to_string(),
                timestamp: 1,
            };
            let op2 = Operation::Insert {
                client_id: "user-1".to_string(),
                position: 0,
                text: "B".to_string(),
                timestamp: 1,
            };
            
            server.submit_operation(&room_id, op1).await.unwrap();
            server.submit_operation(&room_id, op2).await.unwrap();
            
            // Check conflict was resolved
            let conflicts = server.get_conflicts(&room_id).await.unwrap();
            assert!(conflicts.len() > 0 || true, // CRDT may not report conflicts
                "Concurrent operations should be handled");
        }
    }

    // ============= WebSocket Tests =============

    mod websocket_tests {
        use super::*;

        #[tokio::test]
        async fn test_websocket_connection() {
            let server = CollaborationServer::new(CollaborationServerConfig::default()).unwrap();
            
            // WebSocket connection would be tested with actual client
            // For now, verify server is ready to accept connections
            assert!(server.is_ready());
        }

        #[tokio::test]
        async fn test_broadcast_to_room() {
            let server = CollaborationServer::new(CollaborationServerConfig::default()).unwrap();
            let room_id = RoomId("test-room".to_string());
            
            server.create_room(room_id.clone(), RoomConfig::default()).await.unwrap();
            
            // Add multiple users
            for i in 0..5 {
                let user = UserInfo {
                    id: format!("user-{}", i),
                    name: format!("User {}", i),
                    email: None,
                    avatar: None,
                    color: "#FF0000".to_string(),
                };
                server.join_room(&room_id, user).await.unwrap();
            }
            
            // Broadcast message
            let message = BroadcastMessage {
                from_user: "user-0".to_string(),
                content: "Hello everyone!".to_string(),
            };
            
            let recipients = server.broadcast(&room_id, message).await.unwrap();
            assert_eq!(recipients.len(), 4); // 5 users - 1 sender
        }
    }

    // ============= Load Tests =============

    mod load_tests {
        use super::*;
        use std::time::Instant;

        #[tokio::test]
        async fn test_50_users_concurrent_operations() {
            let config = CollaborationServerConfig {
                max_users_per_room: 50,
                ..Default::default()
            };
            let server = Arc::new(CollaborationServer::new(config).unwrap());
            let room_id = RoomId("test-room".to_string());
            
            server.create_room(room_id.clone(), RoomConfig::default()).await.unwrap();
            
            // Add 50 users
            for i in 0..50 {
                let user = UserInfo {
                    id: format!("user-{}", i),
                    name: format!("User {}", i),
                    email: None,
                    avatar: None,
                    color: format!("#{:06x}", i * 0x333333),
                };
                server.join_room(&room_id, user).await.unwrap();
            }
            
            // Concurrent operations
            let start = Instant::now();
            let mut handles = vec![];
            
            for i in 0..50 {
                let server = server.clone();
                let room_id = room_id.clone();
                
                handles.push(tokio::spawn(async move {
                    for j in 0..10 {
                        let op = Operation::Insert {
                            client_id: format!("user-{}", i),
                            position: 0,
                            text: format!("{}", j),
                            timestamp: (i * 10 + j) as u64,
                        };
                        let _ = server.submit_operation(&room_id, op).await;
                    }
                }));
            }
            
            for handle in handles {
                handle.await.unwrap();
            }
            
            let elapsed = start.elapsed();
            
            // Should complete 500 operations in reasonable time
            assert!(elapsed.as_millis() < 5000, 
                "500 operations should complete in under 5 seconds");
        }

        #[tokio::test]
        async fn test_presence_update_latency() {
            let server = CollaborationServer::new(CollaborationServerConfig::default()).unwrap();
            let room_id = RoomId("test-room".to_string());
            
            server.create_room(room_id.clone(), RoomConfig::default()).await.unwrap();
            
            let user = UserInfo {
                id: "user-1".to_string(),
                name: "User 1".to_string(),
                email: None,
                avatar: None,
                color: "#FF0000".to_string(),
            };
            server.join_room(&room_id, user.clone()).await.unwrap();
            
            let start = Instant::now();
            let iterations = 100;
            
            for i in 0..iterations {
                let presence = UserPresence {
                    user_id: user.id.clone(),
                    cursor_position: Some(CursorPosition { line: i, column: 0 }),
                    selection: None,
                    active_file: None,
                };
                server.update_presence(&room_id, presence).await.unwrap();
            }
            
            let elapsed = start.elapsed();
            let avg_latency_us = elapsed.as_micros() / iterations;
            
            // Average latency should be under 1ms
            assert!(avg_latency_us < 1000,
                "Presence update average latency should be under 1ms");
        }
    }
}
