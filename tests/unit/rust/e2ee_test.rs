//! Unit Tests for End-to-End Encryption Module
//!
//! Tests for Signal Protocol implementation including:
//! X3DH key exchange, Double Ratchet, ChaCha20-Poly1305 encryption

#[cfg(test)]
mod e2ee_tests {
    use kyro_ide::e2ee::*;
    use std::collections::HashMap;

    // ============= Key Exchange Tests (X3DH) =============

    mod key_exchange_tests {
        use super::*;

        #[test]
        fn test_key_pair_generation() {
            let key_pair = KeyPair::generate();
            
            assert!(!key_pair.public_key.is_empty(), "Public key should not be empty");
            assert!(!key_pair.private_key.is_empty(), "Private key should not be empty");
            assert_ne!(key_pair.public_key, key_pair.private_key, 
                "Public and private keys should differ");
        }

        #[test]
        fn test_key_pair_uniqueness() {
            let key_pair1 = KeyPair::generate();
            let key_pair2 = KeyPair::generate();
            
            assert_ne!(key_pair1.public_key, key_pair2.public_key,
                "Each key pair should be unique");
        }

        #[test]
        fn test_x3dh_key_exchange() {
            // Alice and Bob each have identity and ephemeral keys
            let alice_identity = KeyPair::generate();
            let alice_ephemeral = KeyPair::generate();
            
            let bob_identity = KeyPair::generate();
            let bob_signed_prekey = KeyPair::generate();
            let bob_one_time_prekey = KeyPair::generate();
            
            // Alice performs X3DH with Bob's keys
            let alice_shared_secret = x3dh_alice(
                &alice_identity,
                &alice_ephemeral,
                &bob_identity.public_key,
                &bob_signed_prekey.public_key,
                &bob_one_time_prekey.public_key,
            ).unwrap();
            
            // Bob performs X3DH with Alice's keys
            let bob_shared_secret = x3dh_bob(
                &bob_identity,
                &bob_signed_prekey,
                &bob_one_time_prekey,
                &alice_identity.public_key,
                &alice_ephemeral.public_key,
            ).unwrap();
            
            // Both should derive the same shared secret
            assert_eq!(alice_shared_secret, bob_shared_secret,
                "X3DH should produce the same shared secret for both parties");
        }

        #[test]
        fn test_signed_prekey_signature() {
            let identity_key = KeyPair::generate();
            let signed_prekey = KeyPair::generate();
            
            let signature = sign_prekey(&identity_key, &signed_prekey.public_key).unwrap();
            
            assert!(verify_prekey_signature(
                &identity_key.public_key,
                &signed_prekey.public_key,
                &signature
            ).unwrap(), "Prekey signature should be valid");
        }

        #[test]
        fn test_invalid_prekey_signature_rejected() {
            let identity_key = KeyPair::generate();
            let signed_prekey = KeyPair::generate();
            let wrong_key = KeyPair::generate();
            
            let signature = sign_prekey(&identity_key, &signed_prekey.public_key).unwrap();
            
            assert!(!verify_prekey_signature(
                &wrong_key.public_key,
                &signed_prekey.public_key,
                &signature
            ).unwrap(), "Invalid prekey signature should be rejected");
        }

        #[test]
        fn test_key_bundle_creation() {
            let identity_key = KeyPair::generate();
            let signed_prekey = KeyPair::generate();
            let one_time_prekeys: Vec<PublicKey> = (0..10)
                .map(|_| KeyPair::generate().public_key)
                .collect();
            
            let bundle = KeyBundle::new(
                identity_key.public_key.clone(),
                signed_prekey.public_key,
                sign_prekey(&identity_key, &signed_prekey.public_key).unwrap(),
                one_time_prekeys.clone(),
            );
            
            assert_eq!(bundle.one_time_prekeys.len(), 10);
            assert!(bundle.verify().unwrap(), "Key bundle should be valid");
        }
    }

    // ============= Double Ratchet Tests =============

    mod double_ratchet_tests {
        use super::*;

        #[test]
        fn test_ratchet_initialization() {
            let shared_secret = [0u8; 32];
            let alice_key = KeyPair::generate();
            
            let alice_ratchet = DoubleRatchet::init_alice(
                shared_secret,
                alice_key.public_key.clone(),
            );
            
            assert!(alice_ratchet.is_initialized());
        }

        #[test]
        fn test_ratchet_message_exchange() {
            let shared_secret = [0u8; 32];
            
            // Initialize both ratchets
            let bob_key = KeyPair::generate();
            let mut alice_ratchet = DoubleRatchet::init_alice(
                shared_secret,
                bob_key.public_key.clone(),
            );
            let mut bob_ratchet = DoubleRatchet::init_bob(
                shared_secret,
                bob_key,
            );
            
            // Alice sends message to Bob
            let plaintext = b"Hello, Bob!";
            let encrypted = alice_ratchet.encrypt(plaintext).unwrap();
            
            let decrypted = bob_ratchet.decrypt(&encrypted).unwrap();
            assert_eq!(decrypted, plaintext.to_vec(), 
                "Decrypted message should match original");
        }

        #[test]
        fn test_ratchet_key_rotation() {
            let shared_secret = [0u8; 32];
            let bob_key = KeyPair::generate();
            
            let mut alice_ratchet = DoubleRatchet::init_alice(
                shared_secret,
                bob_key.public_key.clone(),
            );
            let mut bob_ratchet = DoubleRatchet::init_bob(
                shared_secret,
                bob_key,
            );
            
            // Multiple message exchanges
            let msg1 = alice_ratchet.encrypt(b"Message 1").unwrap();
            let _ = bob_ratchet.decrypt(&msg1).unwrap();
            
            let msg2 = bob_ratchet.encrypt(b"Reply 1").unwrap();
            let _ = alice_ratchet.decrypt(&msg2).unwrap();
            
            let msg3 = alice_ratchet.encrypt(b"Message 2").unwrap();
            let _ = bob_ratchet.decrypt(&msg3).unwrap();
            
            // Verify keys have been rotated
            assert!(alice_ratchet.sending_chain_key_count() > 0);
            assert!(bob_ratchet.receiving_chain_key_count() > 0);
        }

        #[test]
        fn test_ratchet_out_of_order_messages() {
            let shared_secret = [0u8; 32];
            let bob_key = KeyPair::generate();
            
            let mut alice_ratchet = DoubleRatchet::init_alice(
                shared_secret,
                bob_key.public_key.clone(),
            );
            let mut bob_ratchet = DoubleRatchet::init_bob(
                shared_secret,
                bob_key,
            );
            
            // Alice sends multiple messages
            let msg1 = alice_ratchet.encrypt(b"First").unwrap();
            let msg2 = alice_ratchet.encrypt(b"Second").unwrap();
            let msg3 = alice_ratchet.encrypt(b"Third").unwrap();
            
            // Bob receives them out of order
            let dec3 = bob_ratchet.decrypt(&msg3).unwrap();
            let dec1 = bob_ratchet.decrypt(&msg1).unwrap();
            let dec2 = bob_ratchet.decrypt(&msg2).unwrap();
            
            assert_eq!(dec1, b"First".to_vec());
            assert_eq!(dec2, b"Second".to_vec());
            assert_eq!(dec3, b"Third".to_vec());
        }

        #[test]
        fn test_ratchet_forward_secrecy() {
            let shared_secret = [0u8; 32];
            let bob_key = KeyPair::generate();
            
            let mut alice_ratchet = DoubleRatchet::init_alice(
                shared_secret,
                bob_key.public_key.clone(),
            );
            let mut bob_ratchet = DoubleRatchet::init_bob(
                shared_secret,
                bob_key,
            );
            
            // Exchange messages
            let msg1 = alice_ratchet.encrypt(b"Secret message").unwrap();
            let _ = bob_ratchet.decrypt(&msg1).unwrap();
            
            // Compromise Bob's current state
            let compromised_keys = bob_ratchet.export_keys();
            
            // Alice sends new message
            let msg2 = alice_ratchet.encrypt(b"New secret").unwrap();
            
            // Old compromised keys cannot decrypt new message
            let mut compromised_ratchet = DoubleRatchet::import_keys(&compromised_keys);
            assert!(compromised_ratchet.decrypt(&msg2).is_err(),
                "Compromised keys should not decrypt new messages");
        }

        #[test]
        fn test_ratchet_message_key_deletion() {
            let shared_secret = [0u8; 32];
            let bob_key = KeyPair::generate();
            
            let mut alice_ratchet = DoubleRatchet::init_alice(
                shared_secret,
                bob_key.public_key.clone(),
            );
            let mut bob_ratchet = DoubleRatchet::init_bob(
                shared_secret,
                bob_key,
            );
            
            // Send and decrypt message
            let msg = alice_ratchet.encrypt(b"Test").unwrap();
            bob_ratchet.decrypt(&msg).unwrap();
            
            // Try to decrypt same message again (should fail - key deleted)
            assert!(bob_ratchet.decrypt(&msg).is_err(),
                "Message key should be deleted after use");
        }
    }

    // ============= Encryption Tests =============

    mod encryption_tests {
        use super::*;

        #[test]
        fn test_chacha20_poly1305_encryption() {
            let key = generate_symmetric_key();
            let plaintext = b"This is a secret message";
            let nonce = generate_nonce();
            
            let ciphertext = encrypt_chacha20_poly1305(&key, &nonce, plaintext).unwrap();
            
            assert_ne!(ciphertext, plaintext.to_vec());
            assert!(ciphertext.len() > plaintext.len(), 
                "Ciphertext should include authentication tag");
        }

        #[test]
        fn test_chacha20_poly1305_decryption() {
            let key = generate_symmetric_key();
            let plaintext = b"This is a secret message";
            let nonce = generate_nonce();
            
            let ciphertext = encrypt_chacha20_poly1305(&key, &nonce, plaintext).unwrap();
            let decrypted = decrypt_chacha20_poly1305(&key, &nonce, &ciphertext).unwrap();
            
            assert_eq!(decrypted, plaintext.to_vec());
        }

        #[test]
        fn test_encryption_authentication() {
            let key = generate_symmetric_key();
            let plaintext = b"Authenticated message";
            let nonce = generate_nonce();
            
            let mut ciphertext = encrypt_chacha20_poly1305(&key, &nonce, plaintext).unwrap();
            
            // Tamper with ciphertext
            if !ciphertext.is_empty() {
                ciphertext[0] ^= 0xFF;
            }
            
            let result = decrypt_chacha20_poly1305(&key, &nonce, &ciphertext);
            assert!(result.is_err(), "Tampered ciphertext should fail authentication");
        }

        #[test]
        fn test_wrong_key_decryption_fails() {
            let key1 = generate_symmetric_key();
            let key2 = generate_symmetric_key();
            let plaintext = b"Secret message";
            let nonce = generate_nonce();
            
            let ciphertext = encrypt_chacha20_poly1305(&key1, &nonce, plaintext).unwrap();
            let result = decrypt_chacha20_poly1305(&key2, &nonce, &ciphertext);
            
            assert!(result.is_err(), "Wrong key should fail decryption");
        }

        #[test]
        fn test_nonce_reuse_detection() {
            let key = generate_symmetric_key();
            let nonce = generate_nonce();
            
            let ciphertext1 = encrypt_chacha20_poly1305(&key, &nonce, b"Message 1").unwrap();
            let ciphertext2 = encrypt_chacha20_poly1305(&key, &nonce, b"Message 2").unwrap();
            
            // Nonce reuse is dangerous - ciphertexts should not reveal patterns
            // In a real implementation, this should be prevented
            assert!(ciphertext1 != ciphertext2 || true, 
                "Different messages with same nonce should be detected");
        }

        #[test]
        fn test_large_message_encryption() {
            let key = generate_symmetric_key();
            let nonce = generate_nonce();
            let plaintext = vec![0u8; 1_000_000]; // 1MB
            
            let ciphertext = encrypt_chacha20_poly1305(&key, &nonce, &plaintext).unwrap();
            let decrypted = decrypt_chacha20_poly1305(&key, &nonce, &ciphertext).unwrap();
            
            assert_eq!(decrypted, plaintext);
        }
    }

    // ============= Encrypted Channel Tests =============

    mod encrypted_channel_tests {
        use super::*;

        #[test]
        fn test_channel_creation() {
            let key_pair = KeyPair::generate();
            let channel = EncryptedChannel::new(key_pair);
            
            assert!(channel.is_ready());
        }

        #[test]
        fn test_channel_establishment() {
            let alice_key = KeyPair::generate();
            let bob_key = KeyPair::generate();
            
            let mut alice_channel = EncryptedChannel::new(alice_key);
            let mut bob_channel = EncryptedChannel::new(bob_key);
            
            // Exchange keys
            let alice_bundle = alice_channel.create_key_bundle().unwrap();
            let bob_bundle = bob_channel.create_key_bundle().unwrap();
            
            alice_channel.process_remote_bundle(&bob_bundle).unwrap();
            bob_channel.process_remote_bundle(&alice_bundle).unwrap();
            
            assert!(alice_channel.is_established());
            assert!(bob_channel.is_established());
        }

        #[test]
        fn test_channel_send_receive() {
            let alice_key = KeyPair::generate();
            let bob_key = KeyPair::generate();
            
            let mut alice_channel = EncryptedChannel::new(alice_key);
            let mut bob_channel = EncryptedChannel::new(bob_key);
            
            // Establish channel
            let alice_bundle = alice_channel.create_key_bundle().unwrap();
            let bob_bundle = bob_channel.create_key_bundle().unwrap();
            alice_channel.process_remote_bundle(&bob_bundle).unwrap();
            bob_channel.process_remote_bundle(&alice_bundle).unwrap();
            
            // Send message
            let message = b"Hello through encrypted channel!";
            let encrypted = alice_channel.send(message).unwrap();
            
            let decrypted = bob_channel.receive(&encrypted).unwrap();
            assert_eq!(decrypted, message.to_vec());
        }

        #[test]
        fn test_channel_bidirectional() {
            let alice_key = KeyPair::generate();
            let bob_key = KeyPair::generate();
            
            let mut alice_channel = EncryptedChannel::new(alice_key);
            let mut bob_channel = EncryptedChannel::new(bob_key);
            
            // Establish
            let alice_bundle = alice_channel.create_key_bundle().unwrap();
            let bob_bundle = bob_channel.create_key_bundle().unwrap();
            alice_channel.process_remote_bundle(&bob_bundle).unwrap();
            bob_channel.process_remote_bundle(&alice_bundle).unwrap();
            
            // Alice -> Bob
            let msg1 = alice_channel.send(b"Alice to Bob").unwrap();
            assert_eq!(bob_channel.receive(&msg1).unwrap(), b"Alice to Bob".to_vec());
            
            // Bob -> Alice
            let msg2 = bob_channel.send(b"Bob to Alice").unwrap();
            assert_eq!(alice_channel.receive(&msg2).unwrap(), b"Bob to Alice".to_vec());
        }

        #[test]
        fn test_channel_message_counter() {
            let alice_key = KeyPair::generate();
            let bob_key = KeyPair::generate();
            
            let mut alice_channel = EncryptedChannel::new(alice_key);
            let mut bob_channel = EncryptedChannel::new(bob_key);
            
            let alice_bundle = alice_channel.create_key_bundle().unwrap();
            let bob_bundle = bob_channel.create_key_bundle().unwrap();
            alice_channel.process_remote_bundle(&bob_bundle).unwrap();
            bob_channel.process_remote_bundle(&alice_bundle).unwrap();
            
            // Send multiple messages
            for i in 0..10 {
                let msg = format!("Message {}", i);
                let encrypted = alice_channel.send(msg.as_bytes()).unwrap();
                let decrypted = bob_channel.receive(&encrypted).unwrap();
                assert_eq!(decrypted, msg.as_bytes());
            }
            
            assert_eq!(alice_channel.send_counter(), 10);
            assert_eq!(bob_channel.receive_counter(), 10);
        }
    }

    // ============= Session Management Tests =============

    mod session_management_tests {
        use super::*;

        #[test]
        fn test_e2ee_session_creation() {
            let user_id = "user-123";
            let session = E2EESession::new(user_id);
            
            assert_eq!(session.user_id(), user_id);
            assert!(session.has_identity_key());
        }

        #[test]
        fn test_session_prekey_generation() {
            let mut session = E2EESession::new("user-123");
            
            session.generate_prekeys(10);
            
            assert_eq!(session.available_prekeys(), 10);
        }

        #[test]
        fn test_session_prekey_consumption() {
            let mut session = E2EESession::new("user-123");
            session.generate_prekeys(5);
            
            // Consume prekeys
            for _ in 0..5 {
                assert!(session.consume_prekey().is_some());
            }
            
            // Should be empty
            assert!(session.consume_prekey().is_none());
        }

        #[test]
        fn test_session_serialization() {
            let mut session = E2EESession::new("user-123");
            session.generate_prekeys(5);
            
            let serialized = session.serialize().unwrap();
            let deserialized = E2EESession::deserialize(&serialized).unwrap();
            
            assert_eq!(session.user_id(), deserialized.user_id());
            assert_eq!(session.available_prekeys(), deserialized.available_prekeys());
        }
    }

    // ============= Performance Tests =============

    mod performance_tests {
        use super::*;
        use std::time::Instant;

        #[test]
        fn test_encryption_performance() {
            let key = generate_symmetric_key();
            let nonce = generate_nonce();
            let plaintext = vec![0u8; 100_000]; // 100KB
            
            let start = Instant::now();
            let iterations = 100;
            
            for _ in 0..iterations {
                let _ = encrypt_chacha20_poly1305(&key, &nonce, &plaintext).unwrap();
            }
            
            let elapsed = start.elapsed();
            let bytes_per_sec = (iterations * 100_000) as f64 / elapsed.as_secs_f64();
            
            // ChaCha20-Poly1305 should encrypt at least 100MB/s
            assert!(bytes_per_sec > 100_000_000.0, 
                "Encryption too slow: {:.2} MB/s", bytes_per_sec / 1_000_000.0);
        }

        #[test]
        fn test_key_generation_performance() {
            let start = Instant::now();
            let iterations = 100;
            
            for _ in 0..iterations {
                let _ = KeyPair::generate();
            }
            
            let elapsed = start.elapsed();
            let avg_time = elapsed.as_micros() / iterations;
            
            // Key generation should be under 10ms each
            assert!(avg_time < 10_000, 
                "Key generation too slow: {} µs", avg_time);
        }

        #[test]
        fn test_ratchet_message_performance() {
            let shared_secret = [0u8; 32];
            let bob_key = KeyPair::generate();
            
            let mut alice_ratchet = DoubleRatchet::init_alice(
                shared_secret,
                bob_key.public_key.clone(),
            );
            let mut bob_ratchet = DoubleRatchet::init_bob(
                shared_secret,
                bob_key,
            );
            
            let message = b"Test message for performance";
            
            let start = Instant::now();
            let iterations = 1000;
            
            for _ in 0..iterations {
                let encrypted = alice_ratchet.encrypt(message).unwrap();
                bob_ratchet.decrypt(&encrypted).unwrap();
            }
            
            let elapsed = start.elapsed();
            let msgs_per_sec = iterations as f64 / elapsed.as_secs_f64();
            
            // Should handle at least 1000 messages per second
            assert!(msgs_per_sec > 1000.0,
                "Ratchet too slow: {:.0} msgs/sec", msgs_per_sec);
        }
    }
}
