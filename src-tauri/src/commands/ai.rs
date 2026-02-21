use serde::{Deserialize, Serialize};
use reqwest::Client;

#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaModel {
    pub name: String,
    pub size: u64,
    pub digest: String,
    pub modified_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaStatus {
    pub running: bool,
    pub version: Option<String>,
    pub models_count: usize,
}

/// Check Ollama status
#[tauri::command]
pub async fn ollama_status(host: Option<String>) -> Result<OllamaStatus, String> {
    let ollama_host = host.unwrap_or_else(|| "http://localhost:11434".to_string());
    let client = Client::new();
    
    let response = client
        .get(format!("{}/api/version", ollama_host))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await;
    
    match response {
        Ok(resp) => {
            let version: Option<String> = resp.json::<serde_json::Value>().await.ok()
                .and_then(|v| v.get("version").and_then(|s| s.as_str().map(|s| s.to_string())));
            
            // Get models count
            let models_resp = client
                .get(format!("{}/api/tags", ollama_host))
                .send()
                .await
                .map_err(|e| format!("Failed to get models: {}", e))?;
            
            let models: serde_json::Value = models_resp.json().await
                .map_err(|e| format!("Failed to parse models: {}", e))?;
            
            let models_count = models.get("models")
                .and_then(|m| m.as_array())
                .map(|a| a.len())
                .unwrap_or(0);
            
            Ok(OllamaStatus {
                running: true,
                version,
                models_count,
            })
        },
        Err(_) => Ok(OllamaStatus {
            running: false,
            version: None,
            models_count: 0,
        }),
    }
}

/// List available Ollama models
#[tauri::command]
pub async fn ollama_models(host: Option<String>) -> Result<Vec<OllamaModel>, String> {
    let ollama_host = host.unwrap_or_else(|| "http://localhost:11434".to_string());
    let client = Client::new();
    
    let response = client
        .get(format!("{}/api/tags", ollama_host))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama: {}", e))?;
    
    let data: serde_json::Value = response.json().await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    let models = data.get("models")
        .and_then(|m| m.as_array())
        .map(|arr| {
            arr.iter().filter_map(|m| {
                Some(OllamaModel {
                    name: m.get("name")?.as_str()?.to_string(),
                    size: m.get("size")?.as_u64()?,
                    digest: m.get("digest")?.as_str()?.to_string(),
                    modified_at: m.get("modified_at")?.as_str()?.to_string(),
                })
            }).collect()
        })
        .unwrap_or_default();
    
    Ok(models)
}

/// Chat with Ollama model
#[tauri::command]
pub async fn ollama_chat(
    model: String,
    messages: Vec<serde_json::Value>,
    host: Option<String>,
    stream: Option<bool>,
) -> Result<String, String> {
    let ollama_host = host.unwrap_or_else(|| "http://localhost:11434".to_string());
    let client = Client::new();
    
    let request_body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": stream.unwrap_or(false)
    });
    
    let response = client
        .post(format!("{}/api/chat", ollama_host))
        .json(&request_body)
        .timeout(std::time::Duration::from_secs(120))
        .send()
        .await
        .map_err(|e| format!("Failed to send request: {}", e))?;
    
    let data: serde_json::Value = response.json().await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    let content = data.get("message")
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .unwrap_or("")
        .to_string();
    
    Ok(content)
}

/// Pull a model from Ollama registry
#[tauri::command]
pub async fn ollama_pull(
    model: String,
    host: Option<String>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let ollama_host = host.unwrap_or_else(|| "http://localhost:11434".to_string());
    let client = Client::new();
    
    let request_body = serde_json::json!({
        "name": model,
        "stream": true
    });
    
    let response = client
        .post(format!("{}/api/pull", ollama_host))
        .json(&request_body)
        .timeout(std::time::Duration::from_secs(3600)) // 1 hour timeout for large models
        .send()
        .await
        .map_err(|e| format!("Failed to pull model: {}", e))?;
    
    // Stream progress events
    let bytes = response.bytes().await
        .map_err(|e| format!("Failed to read response: {}", e))?;
    
    let text = String::from_utf8_lossy(&bytes);
    for line in text.lines() {
        if let Ok(progress) = serde_json::from_str::<serde_json::Value>(line) {
            if let Some(status) = progress.get("status").and_then(|s| s.as_str()) {
                let _ = app_handle.emit("ollama:pull:progress", status);
            }
        }
    }
    
    Ok(())
}
