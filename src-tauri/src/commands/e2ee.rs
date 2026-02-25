//! E2E Encryption Tauri Commands
//!
//! Exposes end-to-end encryption functionality to the frontend

use tauri::command;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::e2ee::{E2EESession, EncryptedChannel, KeyPair, KeyBundle};

/// Global E2EE state
lazy_static::lazy_static! {
    static ref E2EE_STATE: Arc<RwLock<E2EEState>> = Arc::new(RwLock::new(E2EEState::new()));
}

#[derive(Debug)]
pub struct E2EEState {
    sessions: std::collections::HashMap<String, E2EESession>,
    channels: std::collections::HashMap<String, EncryptedChannel>,
    key_pairs: std::collections::HashMap<String, KeyPair>,
}

impl E2EEState {
    pub fn new() -> Self {
        Self {
            sessions: std::collections::HashMap::new(),
            channels: std::collections::HashMap::new(),
            key_pairs: std::collections::HashMap::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyPairInfo {
    pub id: String,
    pub public_key: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyBundleInfo {
    pub identity_key: String,
    pub signed_prekey: String,
    pub signature: String,
    pub one_time_prekeys: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedMessage {
    pub ciphertext: Vec<u8>,
    pub nonce: Vec<u8>,
    pub sender_id: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecryptedMessage {
    pub plaintext: String,
    pub sender_id: String,
    pub verified: bool,
}

/// Generate a new key pair for a user
#[command]
pub async fn generate_key_pair(user_id: String) -> Result<KeyPairInfo, String> {
    let mut state = E2EE_STATE.write().await;
    
    let key_pair = KeyPair::generate();
    let public_key = hex::encode(&key_pair.public_key);
    
    let info = KeyPairInfo {
        id: user_id.clone(),
        public_key: public_key.clone(),
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    
    state.key_pairs.insert(user_id, key_pair);
    
    Ok(info)
}

/// Get public key for a user
#[command]
pub async fn get_public_key(user_id: String) -> Result<String, String> {
    let state = E2EE_STATE.read().await;
    
    let key_pair = state.key_pairs.get(&user_id)
        .ok_or("Key pair not found for user")?;
    
    Ok(hex::encode(&key_pair.public_key))
}

/// Create a key bundle for key exchange
#[command]
pub async fn create_key_bundle(user_id: String) -> Result<KeyBundleInfo, String> {
    let mut state = E2EE_STATE.write().await;
    
    let session = E2EESession::new(&user_id);
    session.generate_prekeys(10);
    
    let bundle = session.create_key_bundle()
        .map_err(|e| format!("Failed to create key bundle: {}", e))?;
    
    let info = KeyBundleInfo {
        identity_key: hex::encode(&bundle.identity_key),
        signed_prekey: hex::encode(&bundle.signed_prekey),
        signature: hex::encode(&bundle.signature),
        one_time_prekeys: bundle.one_time_prekeys.iter()
            .map(|k| hex::encode(k))
            .collect(),
    };
    
    state.sessions.insert(user_id, session);
    
    Ok(info)
}

/// Initialize encrypted channel with another user
#[command]
pub async fn init_encrypted_channel(
    user_id: String,
    remote_user_id: String,
    remote_bundle: KeyBundleInfo,
) -> Result<(), String> {
    let mut state = E2EE_STATE.write().await;
    
    let key_pair = state.key_pairs.get(&user_id)
        .ok_or("User key pair not found")?
        .clone();
    
    let mut channel = EncryptedChannel::new(key_pair);
    
    // Process remote bundle
    let bundle = KeyBundle {
        identity_key: hex::decode(&remote_bundle.identity_key)
            .map_err(|_| "Invalid identity key")?,
        signed_prekey: hex::decode(&remote_bundle.signed_prekey)
            .map_err(|_| "Invalid signed prekey")?,
        signature: hex::decode(&remote_bundle.signature)
            .map_err(|_| "Invalid signature")?,
        one_time_prekeys: remote_bundle.one_time_prekeys.iter()
            .filter_map(|k| hex::decode(k).ok())
            .collect(),
    };
    
    channel.process_remote_bundle(&bundle)
        .map_err(|e| format!("Failed to process remote bundle: {}", e))?;
    
    let channel_key = format!("{}-{}", user_id, remote_user_id);
    state.channels.insert(channel_key, channel);
    
    Ok(())
}

/// Encrypt a message for a recipient
#[command]
pub async fn encrypt_message(
    sender_id: String,
    recipient_id: String,
    plaintext: String,
) -> Result<EncryptedMessage, String> {
    let state = E2EE_STATE.read().await;
    
    let channel_key = format!("{}-{}", sender_id, recipient_id);
    let channel = state.channels.get(&channel_key)
        .ok_or("Encrypted channel not found. Initialize channel first.")?;
    
    let encrypted = channel.send(plaintext.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;
    
    Ok(EncryptedMessage {
        ciphertext: encrypted.ciphertext,
        nonce: encrypted.nonce,
        sender_id,
        timestamp: chrono::Utc::now().timestamp_millis() as u64,
    })
}

/// Decrypt a message from a sender
#[command]
pub async fn decrypt_message(
    recipient_id: String,
    sender_id: String,
    encrypted: EncryptedMessage,
) -> Result<DecryptedMessage, String> {
    let state = E2EE_STATE.read().await;
    
    let channel_key = format!("{}-{}", sender_id, recipient_id);
    let channel = state.channels.get(&channel_key)
        .ok_or("Encrypted channel not found")?;
    
    let decrypted = channel.receive(&encrypted.ciphertext, &encrypted.nonce)
        .map_err(|e| format!("Decryption failed: {}", e))?;
    
    Ok(DecryptedMessage {
        plaintext: String::from_utf8(decrypted)
            .map_err(|_| "Invalid UTF-8 in decrypted message")?,
        sender_id: encrypted.sender_id,
        verified: true,
    })
}

/// Check if E2EE session exists for a user
#[command]
pub async fn has_e2ee_session(user_id: String) -> Result<bool, String> {
    let state = E2EE_STATE.read().await;
    Ok(state.sessions.contains_key(&user_id))
}

/// Check if encrypted channel exists between users
#[command]
pub async fn has_encrypted_channel(user_id: String, remote_user_id: String) -> Result<bool, String> {
    let state = E2EE_STATE.read().await;
    let channel_key = format!("{}-{}", user_id, remote_user_id);
    Ok(state.channels.contains_key(&channel_key))
}

/// Rotate keys for forward secrecy
#[command]
pub async fn rotate_keys(user_id: String) -> Result<KeyPairInfo, String> {
    let mut state = E2EE_STATE.write().await;
    
    // Generate new key pair
    let new_key_pair = KeyPair::generate();
    let public_key = hex::encode(&new_key_pair.public_key);
    
    // Update session if exists
    if let Some(session) = state.sessions.get_mut(&user_id) {
        session.rotate_keys();
    }
    
    let info = KeyPairInfo {
        id: user_id.clone(),
        public_key,
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    
    state.key_pairs.insert(user_id, new_key_pair);
    
    Ok(info)
}

/// Get prekey count for a user
#[command]
pub async fn get_prekey_count(user_id: String) -> Result<usize, String> {
    let state = E2EE_STATE.read().await;
    
    let session = state.sessions.get(&user_id)
        .ok_or("Session not found")?;
    
    Ok(session.available_prekeys())
}

/// Delete E2EE session
#[command]
pub async fn delete_e2ee_session(user_id: String) -> Result<(), String> {
    let mut state = E2EE_STATE.write().await;
    state.sessions.remove(&user_id);
    state.key_pairs.remove(&user_id);
    
    // Remove all channels for this user
    state.channels.retain(|k, _| !k.starts_with(&user_id) && !k.ends_with(&user_id));
    
    Ok(())
}
