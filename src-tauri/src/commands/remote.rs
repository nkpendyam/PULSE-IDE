use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::command;
use tokio::sync::RwLock;

lazy_static::lazy_static! {
    static ref REMOTE_STATE: Arc<RwLock<HashMap<String, RemoteConnection>>> =
        Arc::new(RwLock::new(HashMap::new()));
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteConnection {
    pub connection_id: String,
    pub connection_type: String,
    pub host: String,
    pub status: String,
    pub connected_at: String,
    pub config: HashMap<String, String>,
}

#[command]
pub async fn remote_connect(
    connection_type: String,
    host: String,
    config: HashMap<String, String>,
) -> Result<RemoteConnection, String> {
    let connection_id = format!(
        "{}:{}:{}",
        connection_type,
        host,
        chrono::Utc::now().timestamp_millis()
    );

    let connection = RemoteConnection {
        connection_id: connection_id.clone(),
        connection_type,
        host,
        status: "connected".to_string(),
        connected_at: chrono::Utc::now().to_rfc3339(),
        config,
    };

    let mut state = REMOTE_STATE.write().await;
    state.insert(connection_id, connection.clone());

    Ok(connection)
}

#[command]
pub async fn remote_disconnect(connection_id: String) -> Result<bool, String> {
    let mut state = REMOTE_STATE.write().await;
    Ok(state.remove(&connection_id).is_some())
}

#[command]
pub async fn list_remote_connections() -> Result<Vec<RemoteConnection>, String> {
    let state = REMOTE_STATE.read().await;
    Ok(state.values().cloned().collect())
}
