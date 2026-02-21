//! AI commands for Kyro IDE

use crate::error::{Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub is_local: bool,
    pub is_loaded: bool,
    pub context_window: usize,
    pub supports_vision: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    pub content: String,
    pub model: String,
    pub tokens_used: usize,
}

// Loaded models storage
lazy_static::lazy_static! {
    static ref LOADED_MODELS: Arc<RwLock<HashMap<String, bool>>> = 
        Arc::new(RwLock::new(HashMap::new()));
}

/// Send a chat message to AI model
#[tauri::command]
pub async fn ai_chat(
    messages: Vec<ChatMessage>,
    model: String,
    temperature: Option<f32>,
    max_tokens: Option<usize>,
) -> Result<ChatResponse> {
    // In a full implementation, this would:
    // 1. Check if Ollama model (call local Ollama API)
    // 2. Check if cloud model (call cloud API)
    // 3. Stream response back to frontend
    
    // For now, return a placeholder
    let ollama_url = "http://localhost:11434";
    
    // Check if it's an Ollama model
    let is_ollama = model.starts_with("ollama/") || 
        ["llama3", "llama2", "mistral", "codellama", "deepseek-coder", "phi3", "qwen"]
            .iter().any(|m| model.contains(m));
    
    if is_ollama {
        // Try to call Ollama
        let client = reqwest::Client::new();
        let model_name = model.replace("ollama/", "");
        
        let response = client
            .post(format!("{}/api/chat", ollama_url))
            .json(&serde_json::json!({
                "model": model_name,
                "messages": messages.iter().map(|m| {
                    serde_json::json!({
                        "role": m.role,
                        "content": m.content
                    })
                }).collect::<Vec<_>>(),
                "stream": false,
                "options": {
                    "temperature": temperature.unwrap_or(0.7),
                    "num_predict": max_tokens.unwrap_or(2048)
                }
            }))
            .timeout(std::time::Duration::from_secs(60))
            .send()
            .await;
        
        match response {
            Ok(resp) if resp.status().is_success() => {
                let data: serde_json::Value = resp.json().await
                    .map_err(|e| Error::Ai(format!("Failed to parse response: {}", e)))?;
                
                let content = data["message"]["content"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                
                return Ok(ChatResponse {
                    content,
                    model: model_name,
                    tokens_used: 0,
                });
            }
            _ => {
                return Err(Error::Ai("Ollama is not running. Please start Ollama to use local models.".to_string()));
            }
        }
    }
    
    // Cloud model placeholder
    Ok(ChatResponse {
        content: "Cloud AI integration requires API keys. Please configure your API keys in settings.".to_string(),
        model,
        tokens_used: 0,
    })
}

/// Get code completion from AI
#[tauri::command]
pub async fn ai_complete(
    code: String,
    language: String,
    cursor_position: usize,
    model: Option<String>,
) -> Result<String> {
    // In a full implementation, this would use the model to complete code
    Ok(String::new())
}

/// Get list of available AI models
#[tauri::command]
pub async fn ai_get_models() -> Result<Vec<ModelInfo>> {
    let mut models = Vec::new();
    
    // Check Ollama availability
    let client = reqwest::Client::new();
    let ollama_url = "http://localhost:11434";
    
    let ollama_available = client
        .get(format!("{}/api/tags", ollama_url))
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false);
    
    if ollama_available {
        // Get installed Ollama models
        if let Ok(resp) = client
            .get(format!("{}/api/tags", ollama_url))
            .send()
            .await
        {
            if let Ok(data) = resp.json::<serde_json::Value>().await {
                if let Some(ollama_models) = data["models"].as_array() {
                    for m in ollama_models {
                        let name = m["name"].as_str().unwrap_or("").to_string();
                        models.push(ModelInfo {
                            id: format!("ollama/{}", name),
                            name: format!("{} (Local)", name),
                            provider: "ollama".to_string(),
                            is_local: true,
                            is_loaded: true,
                            context_window: 4096,
                            supports_vision: false,
                        });
                    }
                }
            }
        }
    }
    
    // Add default cloud models
    let cloud_models = vec![
        ("claude-3-opus", "Claude 3 Opus", "anthropic", 200000, true),
        ("claude-3-sonnet", "Claude 3.5 Sonnet", "anthropic", 200000, true),
        ("claude-3-haiku", "Claude 3 Haiku", "anthropic", 200000, true),
        ("gpt-4o", "GPT-4o", "openai", 128000, true),
        ("gpt-4-turbo", "GPT-4 Turbo", "openai", 128000, true),
        ("gemini-pro", "Gemini Pro", "google", 32000, true),
    ];
    
    for (id, name, provider, context, vision) in cloud_models {
        models.push(ModelInfo {
            id: id.to_string(),
            name: name.to_string(),
            provider: provider.to_string(),
            is_local: false,
            is_loaded: false,
            context_window: context,
            supports_vision: vision,
        });
    }
    
    Ok(models)
}

/// Load an AI model
#[tauri::command]
pub async fn ai_load_model(model_id: String) -> Result<()> {
    let is_ollama = model_id.starts_with("ollama/") || model_id.contains("llama") || 
        model_id.contains("mistral") || model_id.contains("codellama");
    
    if is_ollama {
        let client = reqwest::Client::new();
        let ollama_url = "http://localhost:11434";
        let model_name = model_id.replace("ollama/", "");
        
        // Pull model if not present
        let _ = client
            .post(format!("{}/api/pull", ollama_url))
            .json(&serde_json::json!({
                "name": model_name,
                "stream": false
            }))
            .send()
            .await;
    }
    
    LOADED_MODELS.write().await.insert(model_id, true);
    
    Ok(())
}

/// Unload an AI model
#[tauri::command]
pub async fn ai_unload_model(model_id: String) -> Result<()> {
    LOADED_MODELS.write().await.remove(&model_id);
    Ok(())
}
