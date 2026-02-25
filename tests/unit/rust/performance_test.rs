//! Performance and Load Tests for 50-User Collaboration
//!
//! Stress tests for collaboration server, CRDT operations,
//! presence broadcasting, and real-time sync

#[cfg(test)]
mod performance_tests {
    use kyro_ide::collaboration::*;
    use std::sync::Arc;
    use std::time::{Duration, Instant};
    use tokio::sync::RwLock;

    // ============= Connection Load Tests =============

    mod connection_load {
        use super::*;

        #[tokio::test]
        async fn test_50_concurrent_connections() {
            let config = CollaborationServerConfig {
                max_users_per_room: 50,
                ..Default::default()
            };
            let server = Arc::new(CollaborationServer::new(config).unwrap());
            let room_id = RoomId("load-test-room".to_string());
            
            server.create_room(room_id.clone(), RoomConfig::default()).await.unwrap();
            
            let start = Instant::now();
            let mut handles = vec![];
            
            // Spawn 50 concurrent join operations
            for i in 0..50 {
                let server = server.clone();
                let room_id = room_id.clone();
                
                handles.push(tokio::spawn(async move {
                    let user = UserInfo {
                        id: format!("user-{}", i),
                        name: format!("User {}", i),
                        email: None,
                        avatar: None,
                        color: format!("#{:06x}", i * 0x333333),
                    };
                    
                    server.join_room(&room_id, user).await
                }));
            }
            
            // Wait for all to complete
            let mut successes = 0;
            for handle in handles {
                if handle.await.unwrap().is_ok() {
                    successes += 1;
                }
            }
            
            let elapsed = start.elapsed();
            
            assert_eq!(successes, 50, "All 50 users should join successfully");
            assert!(elapsed.as_millis() < 1000, "50 joins should complete in under 1 second");
        }

        #[tokio::test]
        async fn test_rapid_join_leave() {
            let server = CollaborationServer::new(CollaborationServerConfig::default()).unwrap();
            let room_id = RoomId("rapid-test".to_string());
            
            server.create_room(room_id.clone(), RoomConfig::default()).await.unwrap();
            
            let iterations = 100;
            let start = Instant::now();
            
            for i in 0..iterations {
                let user = UserInfo {
                    id: format!("user-{}", i % 10), // Reuse user IDs
                    name: "Test".to_string(),
                    email: None,
                    avatar: None,
                    color: "#000000".to_string(),
                };
                
                // Join
                if server.join_room(&room_id, user.clone()).await.is_ok() {
                    // Leave
                    server.leave_room(&room_id, &user.id).await.unwrap();
                }
            }
            
            let elapsed = start.elapsed();
            let ops_per_sec = (iterations * 2) as f64 / elapsed.as_secs_f64();
            
            // Should handle at least 100 join/leave ops per second
            assert!(ops_per_sec > 100.0, "Join/leave rate: {:.0} ops/sec", ops_per_sec);
        }
    }

    // ============= CRDT Operation Load Tests =============

    mod crdt_load {
        use super::*;

        #[tokio::test]
        async fn test_high_volume_operations() {
            let config = CollaborationServerConfig {
                max_operations_per_second: 1000, // High limit for load test
                ..Default::default()
            };
            let server = Arc::new(CollaborationServer::new(config).unwrap());
            let room_id = RoomId("crdt-load-test".to_string());
            
            server.create_room(room_id.clone(), RoomConfig::default()).await.unwrap();
            
            let user = UserInfo {
                id: "load-user".to_string(),
                name: "Load User".to_string(),
                email: None,
                avatar: None,
                color: "#000000".to_string(),
            };
            server.join_room(&room_id, user.clone()).await.unwrap();
            
            let operations = 1000;
            let start = Instant::now();
            
            for i in 0..operations {
                let op = Operation::Insert {
                    client_id: user.id.clone(),
                    position: 0,
                    text: format!("{}", i % 10),
                    timestamp: i as u64,
                };
                
                let _ = server.submit_operation(&room_id, op).await;
            }
            
            let elapsed = start.elapsed();
            let ops_per_sec = operations as f64 / elapsed.as_secs_f64();
            
            // Should handle at least 500 ops/sec
            assert!(ops_per_sec > 500.0, "CRDT operation rate: {:.0} ops/sec", ops_per_sec);
        }

        #[tokio::test]
        async fn test_concurrent_edits_50_users() {
            let config = CollaborationServerConfig {
                max_users_per_room: 50,
                max_operations_per_second: 5000,
                ..Default::default()
            };
            let server = Arc::new(CollaborationServer::new(config).unwrap());
            let room_id = RoomId("concurrent-edit-test".to_string());
            
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
            
            let server = Arc::new(server);
            let start = Instant::now();
            let mut handles = vec![];
            
            // Each user sends 20 operations
            for user_id in 0..50 {
                let server = server.clone();
                let room_id = room_id.clone();
                
                handles.push(tokio::spawn(async move {
                    let mut sent = 0;
                    for i in 0..20 {
                        let op = Operation::Insert {
                            client_id: format!("user-{}", user_id),
                            position: 0,
                            text: format!("U{}-{}", user_id, i),
                            timestamp: (user_id * 20 + i) as u64,
                        };
                        
                        if server.submit_operation(&room_id, op).await.is_ok() {
                            sent += 1;
                        }
                    }
                    sent
                }));
            }
            
            let mut total_sent = 0;
            for handle in handles {
                total_sent += handle.await.unwrap();
            }
            
            let elapsed = start.elapsed();
            let ops_per_sec = total_sent as f64 / elapsed.as_secs_f64();
            
            // Should handle concurrent edits from 50 users
            assert!(total_sent > 500, "Sent {} operations", total_sent);
            println!("50 users concurrent edits: {} ops in {:?} ({:.0} ops/sec)", 
                total_sent, elapsed, ops_per_sec);
        }

        #[tokio::test]
        async fn test_large_document_sync() {
            let doc = CollaborativeDocument::new("large-doc-test");
            
            // Insert 100,000 characters
            let chunk_size = 1000;
            let chunks = 100;
            
            let start = Instant::now();
            
            for i in 0..chunks {
                let text = "x".repeat(chunk_size);
                doc.apply_operation(Operation::Insert {
                    client_id: "test".to_string(),
                    position: i * chunk_size,
                    text,
                    timestamp: i as u64,
                }).await.unwrap();
            }
            
            let elapsed = start.elapsed();
            
            assert_eq!(doc.get_content().await.len(), chunk_size * chunks);
            assert!(elapsed.as_millis() < 5000, "Large document sync should be fast");
        }
    }

    // ============= Presence Load Tests =============

    mod presence_load {
        use super::*;

        #[tokio::test]
        async fn test_presence_update_throughput() {
            let config = CollaborationServerConfig {
                presence_throttle_ms: 0, // No throttling for this test
                ..Default::default()
            };
            let server = Arc::new(CollaborationServer::new(config).unwrap());
            let room_id = RoomId("presence-load".to_string());
            
            server.create_room(room_id.clone(), RoomConfig::default()).await.unwrap();
            
            let user = UserInfo {
                id: "presence-user".to_string(),
                name: "Presence User".to_string(),
                email: None,
                avatar: None,
                color: "#000000".to_string(),
            };
            server.join_room(&room_id, user.clone()).await.unwrap();
            
            let updates = 1000;
            let start = Instant::now();
            
            for i in 0..updates {
                let presence = UserPresence {
                    user_id: user.id.clone(),
                    cursor_position: Some(CursorPosition { 
                        line: i / 100, 
                        column: i % 100 
                    }),
                    selection: None,
                    active_file: Some("test.rs".to_string()),
                };
                
                server.update_presence(&room_id, presence).await.unwrap();
            }
            
            let elapsed = start.elapsed();
            let updates_per_sec = updates as f64 / elapsed.as_secs_f64();
            
            // Should handle at least 1000 presence updates/sec
            assert!(updates_per_sec > 1000.0, 
                "Presence update rate: {:.0} updates/sec", updates_per_sec);
        }

        #[tokio::test]
        async fn test_50_users_presence_broadcast() {
            let config = CollaborationServerConfig {
                max_users_per_room: 50,
                presence_throttle_ms: 10,
                ..Default::default()
            };
            let server = Arc::new(CollaborationServer::new(config).unwrap());
            let room_id = RoomId("broadcast-test".to_string());
            
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
            
            let server = Arc::new(server);
            let start = Instant::now();
            let mut handles = vec![];
            
            // Each user updates presence 10 times
            for user_id in 0..50 {
                let server = server.clone();
                let room_id = room_id.clone();
                
                handles.push(tokio::spawn(async move {
                    for i in 0..10 {
                        let presence = UserPresence {
                            user_id: format!("user-{}", user_id),
                            cursor_position: Some(CursorPosition { line: i, column: 0 }),
                            selection: None,
                            active_file: None,
                        };
                        let _ = server.update_presence(&room_id, presence).await;
                    }
                }));
            }
            
            for handle in handles {
                handle.await.unwrap();
            }
            
            let elapsed = start.elapsed();
            
            // 500 presence updates from 50 users should complete quickly
            assert!(elapsed.as_millis() < 5000, 
                "500 presence updates in {:?}", elapsed);
        }
    }

    // ============= Memory and Resource Tests =============

    mod resource_tests {
        use super::*;

        #[tokio::test]
        async fn test_room_memory_cleanup() {
            let server = CollaborationServer::new(CollaborationServerConfig::default()).unwrap();
            
            // Create and delete many rooms
            for i in 0..100 {
                let room_id = RoomId(format!("room-{}", i));
                server.create_room(room_id.clone(), RoomConfig::default()).await.unwrap();
                
                // Add a user
                let user = UserInfo {
                    id: "test-user".to_string(),
                    name: "Test".to_string(),
                    email: None,
                    avatar: None,
                    color: "#000000".to_string(),
                };
                
                // Join may fail if user already in another room
                let _ = server.join_room(&room_id, user.clone()).await;
                
                // Delete room
                server.delete_room(&room_id).await.unwrap();
            }
            
            // All rooms should be cleaned up
            let stats = server.get_stats().await;
            assert_eq!(stats.total_rooms, 0);
        }

        #[tokio::test]
        async fn test_operation_log_rotation() {
            let config = CollaborationServerConfig {
                max_operation_log_size: 100, // Small for testing
                ..Default::default()
            };
            let server = CollaborationServer::new(config).unwrap();
            let room_id = RoomId("log-rotation-test".to_string());
            
            server.create_room(room_id.clone(), RoomConfig::default()).await.unwrap();
            
            let user = UserInfo {
                id: "log-user".to_string(),
                name: "Log User".to_string(),
                email: None,
                avatar: None,
                color: "#000000".to_string(),
            };
            server.join_room(&room_id, user.clone()).await.unwrap();
            
            // Submit many operations
            for i in 0..200 {
                let op = Operation::Insert {
                    client_id: user.id.clone(),
                    position: 0,
                    text: format!("{}", i),
                    timestamp: i as u64,
                };
                let _ = server.submit_operation(&room_id, op).await;
            }
            
            // Log should be rotated
            let log = server.get_operation_log(&room_id).await.unwrap();
            assert!(log.len() <= 100, "Log should be rotated, got {} entries", log.len());
        }
    }

    // ============= Latency Tests =============

    mod latency_tests {
        use super::*;

        #[tokio::test]
        async fn test_operation_latency() {
            let server = CollaborationServer::new(CollaborationServerConfig::default()).unwrap();
            let room_id = RoomId("latency-test".to_string());
            
            server.create_room(room_id.clone(), RoomConfig::default()).await.unwrap();
            
            let user = UserInfo {
                id: "latency-user".to_string(),
                name: "Latency User".to_string(),
                email: None,
                avatar: None,
                color: "#000000".to_string(),
            };
            server.join_room(&room_id, user.clone()).await.unwrap();
            
            let iterations = 100;
            let mut latencies = vec![];
            
            for i in 0..iterations {
                let op = Operation::Insert {
                    client_id: user.id.clone(),
                    position: 0,
                    text: "x".to_string(),
                    timestamp: i as u64,
                };
                
                let start = Instant::now();
                let _ = server.submit_operation(&room_id, op).await;
                latencies.push(start.elapsed().as_micros());
            }
            
            latencies.sort();
            let p50 = latencies[iterations / 2];
            let p99 = latencies[iterations * 99 / 100];
            
            // P50 should be under 1ms, P99 under 5ms
            assert!(p50 < 1000, "P50 latency: {} µs", p50);
            assert!(p99 < 5000, "P99 latency: {} µs", p99);
            
            println!("Operation latency: P50={}µs, P99={}µs", p50, p99);
        }

        #[tokio::test]
        async fn test_presence_broadcast_latency() {
            let server = CollaborationServer::new(CollaborationServerConfig::default()).unwrap();
            let room_id = RoomId("presence-latency".to_string());
            
            server.create_room(room_id.clone(), RoomConfig::default()).await.unwrap();
            
            let user = UserInfo {
                id: "presence-user".to_string(),
                name: "Presence".to_string(),
                email: None,
                avatar: None,
                color: "#000000".to_string(),
            };
            server.join_room(&room_id, user.clone()).await.unwrap();
            
            let iterations = 50;
            let mut latencies = vec![];
            
            for i in 0..iterations {
                let presence = UserPresence {
                    user_id: user.id.clone(),
                    cursor_position: Some(CursorPosition { line: i, column: 0 }),
                    selection: None,
                    active_file: None,
                };
                
                let start = Instant::now();
                server.update_presence(&room_id, presence).await.unwrap();
                latencies.push(start.elapsed().as_micros());
            }
            
            latencies.sort();
            let avg: u128 = latencies.iter().sum::<u128>() / iterations as u128;
            
            // Average presence update should be under 500µs
            assert!(avg < 500, "Average presence latency: {} µs", avg);
            
            println!("Presence broadcast latency: avg={}µs", avg);
        }
    }

    // ============= Stress Tests =============

    mod stress_tests {
        use super::*;

        #[tokio::test]
        async fn test_sustained_load() {
            let config = CollaborationServerConfig {
                max_users_per_room: 50,
                max_operations_per_second: 10000,
                ..Default::default()
            };
            let server = Arc::new(CollaborationServer::new(config).unwrap());
            let room_id = RoomId("stress-test".to_string());
            
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
            
            let server = Arc::new(server);
            let duration = Duration::from_secs(5);
            let start = Instant::now();
            
            let mut handles = vec![];
            
            // Spawn workers for each user
            for user_id in 0..50 {
                let server = server.clone();
                let room_id = room_id.clone();
                
                handles.push(tokio::spawn(async move {
                    let mut ops = 0u64;
                    
                    while start.elapsed() < duration {
                        let op = Operation::Insert {
                            client_id: format!("user-{}", user_id),
                            position: 0,
                            text: "x".to_string(),
                            timestamp: ops,
                        };
                        
                        if server.submit_operation(&room_id, op).await.is_ok() {
                            ops += 1;
                        }
                        
                        tokio::time::sleep(Duration::from_micros(100)).await;
                    }
                    
                    ops
                }));
            }
            
            let mut total_ops = 0u64;
            for handle in handles {
                total_ops += handle.await.unwrap();
            }
            
            let elapsed = start.elapsed();
            let ops_per_sec = total_ops as f64 / elapsed.as_secs_f64();
            
            println!("Sustained load: {} ops in {:?} ({:.0} ops/sec)", 
                total_ops, elapsed, ops_per_sec);
            
            // Should sustain at least 1000 ops/sec with 50 users
            assert!(ops_per_sec > 1000.0, "Sustained load: {:.0} ops/sec", ops_per_sec);
        }
    }
}
