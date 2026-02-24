//! Encrypted Channel Module
//! 
//! High-level encrypted communication channel for collaboration

use crate::e2ee::{DoubleRatchetState, EncryptedEnvelope, E2eeConfig};
use chacha20poly1305::{ChaCha20Poly1305, Key, Nonce, aead::{Aead, KeyInit}};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Encrypted collaboration channel
pub struct EncryptedChannel {
    pub channel_id: Uuid,
    pub config: E2eeConfig,
    ratchet: DoubleRatchetState,
    participants: Vec<Uuid>,
    created_at: DateTime<Utc>,
}

impl EncryptedChannel {
    /// Create a new encrypted channel
    pub fn new(root_key: [u8; 32], config: E2eeConfig) -> Self {
        Self {
            channel_id: Uuid::new_v4(),
            config,
            ratchet: DoubleRatchetState::new_initiator(root_key),
            participants: Vec::new(),
            created_at: Utc::now(),
        }
    }

    /// Add participant to channel
    pub fn add_participant(&mut self, user_id: Uuid) {
        if !self.participants.contains(&user_id) {
            self.participants.push(user_id);
        }
    }

    /// Remove participant from channel
    pub fn remove_participant(&mut self, user_id: Uuid) {
        self.participants.retain(|id| id != &user_id);
    }

    /// Encrypt operation for broadcast
    pub fn encrypt_operation(&mut self, operation: &CollaborationOperation) -> anyhow::Result<EncryptedEnvelope> {
        let plaintext = serde_json::to_vec(operation)?;
        let (key, message_number) = self.ratchet.get_sending_key()?;
        
        // Generate random nonce
        let nonce_bytes: [u8; 12] = rand::random();
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        // Encrypt with ChaCha20-Poly1305
        let cipher = ChaCha20Poly1305::new(Key::from_slice(&key));
        let ciphertext = cipher.encrypt(&nonce, plaintext.as_slice())
            .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;
        
        Ok(EncryptedEnvelope {
            sender_key: vec![], // Would include sender's ratchet public key
            ciphertext,
            nonce: nonce_bytes.to_vec(),
            message_number,
            timestamp: Utc::now(),
        })
    }

    /// Decrypt received operation
    pub fn decrypt_operation(&mut self, envelope: &EncryptedEnvelope) -> anyhow::Result<CollaborationOperation> {
        let key = self.ratchet.get_receiving_key(envelope.message_number)?;
        
        // Decrypt with ChaCha20-Poly1305
        let nonce = Nonce::from_slice(&envelope.nonce);
        let cipher = ChaCha20Poly1305::new(Key::from_slice(&key));
        
        let plaintext = cipher.decrypt(nonce, envelope.ciphertext.as_slice())
            .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;
        
        let operation = serde_json::from_slice(&plaintext)?;
        Ok(operation)
    }

    /// Get participant count
    pub fn participant_count(&self) -> usize {
        self.participants.len()
    }
}

/// Collaboration operation that can be encrypted
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollaborationOperation {
    pub id: Uuid,
    pub user_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub kind: OperationKind,
}

/// Types of collaboration operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OperationKind {
    /// Text insert
    Insert {
        position: u64,
        text: String,
    },
    /// Text delete
    Delete {
        position: u64,
        length: u64,
    },
    /// Cursor move
    CursorMove {
        line: u32,
        column: u32,
        file: Option<String>,
    },
    /// Selection change
    Selection {
        start_line: u32,
        start_column: u32,
        end_line: u32,
        end_column: u32,
    },
    /// File open
    FileOpen {
        path: String,
    },
    /// File close
    FileClose {
        path: String,
    },
}

/// Encrypted channel manager for multiple channels
pub struct ChannelManager {
    config: E2eeConfig,
    channels: std::collections::HashMap<Uuid, EncryptedChannel>,
    user_channels: std::collections::HashMap<Uuid, Vec<Uuid>>,
}

impl ChannelManager {
    pub fn new(config: E2eeConfig) -> Self {
        Self {
            config,
            channels: std::collections::HashMap::new(),
            user_channels: std::collections::HashMap::new(),
        }
    }

    /// Create a new encrypted channel
    pub fn create_channel(&mut self, root_key: [u8; 32]) -> Uuid {
        let channel = EncryptedChannel::new(root_key, self.config.clone());
        let channel_id = channel.channel_id;
        self.channels.insert(channel_id, channel);
        channel_id
    }

    /// Join a channel
    pub fn join_channel(&mut self, channel_id: Uuid, user_id: Uuid) -> anyhow::Result<()> {
        let channel = self.channels.get_mut(&channel_id)
            .ok_or_else(|| anyhow::anyhow!("Channel not found"))?;
        
        channel.add_participant(user_id);
        
        self.user_channels
            .entry(user_id)
            .or_insert_with(Vec::new)
            .push(channel_id);
        
        Ok(())
    }

    /// Leave a channel
    pub fn leave_channel(&mut self, channel_id: Uuid, user_id: Uuid) -> anyhow::Result<()> {
        let channel = self.channels.get_mut(&channel_id)
            .ok_or_else(|| anyhow::anyhow!("Channel not found"))?;
        
        channel.remove_participant(user_id);
        
        if let Some(channels) = self.user_channels.get_mut(&user_id) {
            channels.retain(|id| id != &channel_id);
        }
        
        Ok(())
    }

    /// Get channel
    pub fn get_channel(&self, channel_id: Uuid) -> Option<&EncryptedChannel> {
        self.channels.get(&channel_id)
    }

    /// Get mutable channel
    pub fn get_channel_mut(&mut self, channel_id: Uuid) -> Option<&mut EncryptedChannel> {
        self.channels.get_mut(&channel_id)
    }

    /// Broadcast encrypted operation to channel
    pub fn broadcast(&mut self, channel_id: Uuid, operation: CollaborationOperation) -> anyhow::Result<EncryptedEnvelope> {
        let channel = self.channels.get_mut(&channel_id)
            .ok_or_else(|| anyhow::anyhow!("Channel not found"))?;
        
        channel.encrypt_operation(&operation)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypted_channel_creation() {
        let root_key = [0u8; 32];
        let channel = EncryptedChannel::new(root_key, E2eeConfig::default());
        
        assert_eq!(channel.participant_count(), 0);
    }

    #[test]
    fn test_channel_participants() {
        let root_key = [0u8; 32];
        let mut channel = EncryptedChannel::new(root_key, E2eeConfig::default());
        
        let user1 = Uuid::new_v4();
        let user2 = Uuid::new_v4();
        
        channel.add_participant(user1);
        channel.add_participant(user2);
        channel.add_participant(user1); // Duplicate should be ignored
        
        assert_eq!(channel.participant_count(), 2);
    }

    #[test]
    fn test_channel_manager() {
        let mut manager = ChannelManager::new(E2eeConfig::default());
        
        let root_key = [0u8; 32];
        let channel_id = manager.create_channel(root_key);
        
        let user_id = Uuid::new_v4();
        manager.join_channel(channel_id, user_id).unwrap();
        
        assert!(manager.get_channel(channel_id).is_some());
    }
}
