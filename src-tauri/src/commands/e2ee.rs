// E2EE Tauri Commands — Real X25519 + ChaCha20-Poly1305 implementation
use tauri::command;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;
use x25519_dalek::{EphemeralSecret, PublicKey, StaticSecret};
use chacha20poly1305::{
    aead::{Aead, KeyInit, OsRng},
    ChaCha20Poly1305, Nonce,
};
use hkdf::Hkdf;
use sha2::Sha256;
use base64::Engine;
use rand::RngCore;

lazy_static::lazy_static! {
    static ref E2EE_STATE: Arc<RwLock<E2eeState>> = Arc::new(RwLock::new(E2eeState::new()));
}

#[derive(Debug)]
pub struct ChannelKeys {
    send_key: [u8; 32],
    recv_key: [u8; 32],
}

pub struct E2eeState {
    secret_key: Option<StaticSecret>,
    public_key: Option<[u8; 32]>,
    channels: HashMap<String, ChannelKeys>,
    prekeys: Vec<([u8; 32], StaticSecret)>,
}

impl E2eeState {
    pub fn new() -> Self {
        Self {
            secret_key: None,
            public_key: None,
            channels: HashMap::new(),
            prekeys: Vec::new(),
        }
    }

    fn generate_prekeys(&mut self, count: usize) {
        for _ in 0..count {
            let secret = StaticSecret::random_from_rng(OsRng);
            let public = PublicKey::from(&secret);
            self.prekeys.push((*public.as_bytes(), secret));
        }
    }
}

fn derive_channel_keys(shared_secret: &[u8], is_initiator: bool) -> ChannelKeys {
    let hk = Hkdf::<Sha256>::new(Some(b"kyro-e2ee-v1"), shared_secret);
    let mut key_a = [0u8; 32];
    let mut key_b = [0u8; 32];
    hk.expand(b"channel-key-a", &mut key_a).expect("HKDF expand");
    hk.expand(b"channel-key-b", &mut key_b).expect("HKDF expand");
    if is_initiator {
        ChannelKeys { send_key: key_a, recv_key: key_b }
    } else {
        ChannelKeys { send_key: key_b, recv_key: key_a }
    }
}

#[command]
pub async fn generate_key_pair() -> Result<String, String> {
    let mut state = E2EE_STATE.write().await;
    let secret = StaticSecret::random_from_rng(OsRng);
    let public = PublicKey::from(&secret);
    let public_bytes = *public.as_bytes();
    state.secret_key = Some(secret);
    state.public_key = Some(public_bytes);
    state.generate_prekeys(100);
    let public_hex = hex::encode(public_bytes);
    Ok(public_hex)
}

#[command]
pub async fn get_public_key() -> Result<Option<String>, String> {
    let state = E2EE_STATE.read().await;
    Ok(state.public_key.map(|k| hex::encode(k)))
}

#[command]
pub async fn create_key_bundle() -> Result<String, String> {
    let state = E2EE_STATE.read().await;
    let pk = state.public_key.ok_or("No keypair generated")?;
    let prekey_pubs: Vec<String> = state.prekeys.iter()
        .take(10)
        .map(|(pk, _)| hex::encode(pk))
        .collect();
    let bundle = serde_json::json!({
        "identity_key": hex::encode(pk),
        "prekeys": prekey_pubs,
    });
    Ok(bundle.to_string())
}

#[command]
pub async fn init_encrypted_channel(peer_id: String) -> Result<bool, String> {
    let mut state = E2EE_STATE.write().await;
    let our_secret = state.secret_key.as_ref().ok_or("No keypair generated")?;
    // For channel init, derive keys from our secret + peer's public key (encoded in peer_id)
    let peer_bytes = hex::decode(&peer_id).map_err(|e| format!("Invalid peer key: {}", e))?;
    if peer_bytes.len() != 32 { return Err("Invalid peer key length".to_string()); }
    let mut peer_key_bytes = [0u8; 32];
    peer_key_bytes.copy_from_slice(&peer_bytes);
    let peer_public = PublicKey::from(peer_key_bytes);
    let shared = our_secret.diffie_hellman(&peer_public);
    let channel_keys = derive_channel_keys(shared.as_bytes(), true);
    state.channels.insert(peer_id, channel_keys);
    Ok(true)
}

#[command]
pub async fn encrypt_message(channel_id: String, plaintext: String) -> Result<String, String> {
    let state = E2EE_STATE.read().await;
    let keys = state.channels.get(&channel_id).ok_or("No channel established")?;
    let cipher = ChaCha20Poly1305::new_from_slice(&keys.send_key)
        .map_err(|e| format!("Cipher init error: {}", e))?;
    let mut nonce_bytes = [0u8; 12];
    rand::rngs::OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher.encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("Encryption error: {}", e))?;
    // Prepend nonce to ciphertext
    let mut output = Vec::with_capacity(12 + ciphertext.len());
    output.extend_from_slice(&nonce_bytes);
    output.extend_from_slice(&ciphertext);
    Ok(base64::engine::general_purpose::STANDARD.encode(&output))
}

#[command]
pub async fn decrypt_message(channel_id: String, ciphertext: String) -> Result<String, String> {
    let state = E2EE_STATE.read().await;
    let keys = state.channels.get(&channel_id).ok_or("No channel established")?;
    let data = base64::engine::general_purpose::STANDARD.decode(&ciphertext)
        .map_err(|e| format!("Base64 decode error: {}", e))?;
    if data.len() < 12 { return Err("Ciphertext too short".to_string()); }
    let (nonce_bytes, encrypted) = data.split_at(12);
    let cipher = ChaCha20Poly1305::new_from_slice(&keys.recv_key)
        .map_err(|e| format!("Cipher init error: {}", e))?;
    let nonce = Nonce::from_slice(nonce_bytes);
    let plaintext = cipher.decrypt(nonce, encrypted)
        .map_err(|_| "Decryption failed — message may be tampered".to_string())?;
    String::from_utf8(plaintext).map_err(|e| format!("UTF-8 error: {}", e))
}

#[command]
pub async fn has_e2ee_session() -> Result<bool, String> {
    let state = E2EE_STATE.read().await;
    Ok(state.secret_key.is_some())
}

#[command]
pub async fn has_encrypted_channel(peer_id: String) -> Result<bool, String> {
    let state = E2EE_STATE.read().await;
    Ok(state.channels.contains_key(&peer_id))
}

#[command]
pub async fn rotate_keys() -> Result<String, String> {
    let mut state = E2EE_STATE.write().await;
    let secret = StaticSecret::random_from_rng(OsRng);
    let public = PublicKey::from(&secret);
    let public_bytes = *public.as_bytes();
    state.secret_key = Some(secret);
    state.public_key = Some(public_bytes);
    state.channels.clear(); // Rotating keys invalidates existing channels
    state.prekeys.clear();
    state.generate_prekeys(100);
    Ok(hex::encode(public_bytes))
}

#[command]
pub async fn get_prekey_count() -> Result<usize, String> {
    let state = E2EE_STATE.read().await;
    Ok(state.prekeys.len())
}

#[command]
pub async fn delete_e2ee_session() -> Result<(), String> {
    let mut state = E2EE_STATE.write().await;
    state.secret_key = None;
    state.public_key = None;
    state.channels.clear();
    state.prekeys.clear();
    Ok(())
}
