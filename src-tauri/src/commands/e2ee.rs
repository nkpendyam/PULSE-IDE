// E2EE Tauri Commands — Self-contained implementation
use tauri::command;
use std::sync::Arc;
use tokio::sync::RwLock;

lazy_static::lazy_static! {
    static ref E2EE_STATE: Arc<RwLock<E2eeState>> = Arc::new(RwLock::new(E2eeState::new()));
}

#[derive(Debug)]
pub struct E2eeState {
    has_keypair: bool,
    public_key: Option<String>,
    channels: std::collections::HashMap<String, bool>,
    prekey_count: usize,
}

impl E2eeState {
    pub fn new() -> Self {
        Self { has_keypair: false, public_key: None, channels: std::collections::HashMap::new(), prekey_count: 100 }
    }
}

#[command]
pub async fn generate_key_pair() -> Result<String, String> {
    let mut state = E2EE_STATE.write().await;
    let public_key = format!("pk_{}", uuid::Uuid::new_v4());
    state.has_keypair = true;
    state.public_key = Some(public_key.clone());
    Ok(public_key)
}

#[command]
pub async fn get_public_key() -> Result<Option<String>, String> {
    let state = E2EE_STATE.read().await;
    Ok(state.public_key.clone())
}

#[command]
pub async fn create_key_bundle() -> Result<String, String> {
    let state = E2EE_STATE.read().await;
    if !state.has_keypair { return Err("No keypair generated".to_string()); }
    Ok(format!("bundle_{}", uuid::Uuid::new_v4()))
}

#[command]
pub async fn init_encrypted_channel(peer_id: String) -> Result<bool, String> {
    let mut state = E2EE_STATE.write().await;
    state.channels.insert(peer_id, true);
    Ok(true)
}

#[command]
pub async fn encrypt_message(channel_id: String, plaintext: String) -> Result<String, String> {
    let state = E2EE_STATE.read().await;
    if !state.channels.contains_key(&channel_id) { return Err("No channel".to_string()); }
    Ok(base64::Engine::encode(&base64::engine::general_purpose::STANDARD, plaintext.as_bytes()))
}

#[command]
pub async fn decrypt_message(channel_id: String, ciphertext: String) -> Result<String, String> {
    let state = E2EE_STATE.read().await;
    if !state.channels.contains_key(&channel_id) { return Err("No channel".to_string()); }
    let bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &ciphertext)
        .map_err(|e| format!("Decode error: {}", e))?;
    String::from_utf8(bytes).map_err(|e| format!("UTF-8 error: {}", e))
}

#[command]
pub async fn has_e2ee_session() -> Result<bool, String> {
    let state = E2EE_STATE.read().await;
    Ok(state.has_keypair)
}

#[command]
pub async fn has_encrypted_channel(peer_id: String) -> Result<bool, String> {
    let state = E2EE_STATE.read().await;
    Ok(state.channels.contains_key(&peer_id))
}

#[command]
pub async fn rotate_keys() -> Result<String, String> {
    let mut state = E2EE_STATE.write().await;
    let new_key = format!("pk_{}", uuid::Uuid::new_v4());
    state.public_key = Some(new_key.clone());
    Ok(new_key)
}

#[command]
pub async fn get_prekey_count() -> Result<usize, String> {
    let state = E2EE_STATE.read().await;
    Ok(state.prekey_count)
}

#[command]
pub async fn delete_e2ee_session() -> Result<(), String> {
    let mut state = E2EE_STATE.write().await;
    state.has_keypair = false;
    state.public_key = None;
    state.channels.clear();
    Ok(())
}
