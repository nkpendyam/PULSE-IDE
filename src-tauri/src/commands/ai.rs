//! AI commands for KYRO IDE - Real Ollama integration

use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    pub size: String,
    pub modified_at: String,
}

#[command]
pub async fn check_ollama_status() -> Result<bool, String> {
    let client = reqwest::Client::new();
    match client.get("http://localhost:11434/api/tags").timeout(std::time::Duration::from_secs(2)).send().await {
        Ok(response) => Ok(response.status().is_success()),
        Err(_) => Ok(false),
    }
}

#[command]
pub async fn list_models() -> Result<Vec<ModelInfo>, String> {
    let client = reqwest::Client::new();
    let response = client.get("http://localhost:11434/api/tags").timeout(std::time::Duration::from_secs(5)).send().await.map_err(|e| format!("Failed to connect to Ollama: {}", e))?;
    #[derive(Deserialize)]
    struct OllamaResponse { models: Vec<OllamaModel> }
    #[derive(Deserialize)]
    struct OllamaModel { name: String, size: u64, modified_at: String }
    let data: OllamaResponse = response.json().await.map_err(|e| format!("Failed to parse response: {}", e))?;
    Ok(data.models.into_iter().map(|m| ModelInfo { name: m.name, size: format_size(m.size), modified_at: m.modified_at }).collect())
}

#[command]
pub async fn chat_completion(model: String, messages: Vec<ChatMessage>) -> Result<String, String> {
    let client = reqwest::Client::new();
    #[derive(Serialize)]
    struct OllamaRequest { model: String, messages: Vec<ChatMessage>, stream: bool }
    let request = OllamaRequest { model, messages, stream: false };
    let response = client.post("http://localhost:11434/api/chat").json(&request).timeout(std::time::Duration::from_secs(120)).send().await.map_err(|e| format!("Failed to connect to Ollama: {}", e))?;
    #[derive(Deserialize)]
    struct OllamaResponse { message: ChatMessage }
    let data: OllamaResponse = response.json().await.map_err(|e| format!("Failed to parse response: {}", e))?;
    Ok(data.message.content)
}

#[command]
pub async fn code_completion(model: String, prompt: String, code: Option<String>, language: Option<String>) -> Result<String, String> {
    let system_prompt = "You are KYRO, an expert code completion AI. Complete the code following best practices.";
    let user_prompt = match (code, language) {
        (Some(code), Some(lang)) => format!("Language: {}\n\nExisting code:\n```\n{}\n```\n\nRequest: {}", lang, code, prompt),
        _ => prompt,
    };
    chat_completion(model, vec![
        ChatMessage { role: "system".to_string(), content: system_prompt.to_string() },
        ChatMessage { role: "user".to_string(), content: user_prompt },
    ]).await
}

#[command]
pub async fn code_review(model: String, code: String, language: String) -> Result<String, String> {
    chat_completion(model, vec![
        ChatMessage { role: "system".to_string(), content: "You are KYRO-REVIEW, a senior code reviewer. Analyze code for security, performance, logic errors, and best practices.".to_string() },
        ChatMessage { role: "user".to_string(), content: format!("Review this {} code:\n\n```\n{}\n```", language, code) },
    ]).await
}

#[command]
pub async fn generate_tests(model: String, code: String, language: String) -> Result<String, String> {
    chat_completion(model, vec![
        ChatMessage { role: "system".to_string(), content: "You are KYRO-TEST, a test engineering expert. Generate comprehensive tests with high coverage.".to_string() },
        ChatMessage { role: "user".to_string(), content: format!("Generate tests for this {} code:\n\n```\n{}\n```", language, code) },
    ]).await
}

#[command]
pub async fn explain_code(model: String, code: String, language: String) -> Result<String, String> {
    chat_completion(model, vec![
        ChatMessage { role: "system".to_string(), content: "You are KYRO-EXPLAIN, a code explanation expert. Explain code clearly and thoroughly.".to_string() },
        ChatMessage { role: "user".to_string(), content: format!("Explain this {} code:\n\n```\n{}\n```", language, code) },
    ]).await
}

#[command]
pub async fn refactor_code(model: String, code: String, language: String, instructions: Option<String>) -> Result<String, String> {
    let user_prompt = match instructions {
        Some(ref instr) => format!("Refactor this {} code according to: {}\n\n```\n{}\n```", language, instr, code),
        None => format!("Refactor this {} code to be cleaner:\n\n```\n{}\n```", language, code),
    };
    chat_completion(model, vec![
        ChatMessage { role: "system".to_string(), content: "You are KYRO-REFACTOR, a code refactoring expert.".to_string() },
        ChatMessage { role: "user".to_string(), content: user_prompt },
    ]).await
}

#[command]
pub async fn fix_code(model: String, code: String, language: String, error: Option<String>) -> Result<String, String> {
    let user_prompt = match error {
        Some(ref err) => format!("Fix this {} code with error:\n\nError: {}\n\nCode:\n```\n{}\n```", language, err, code),
        None => format!("Fix any issues in this {} code:\n\n```\n{}\n```", language, code),
    };
    chat_completion(model, vec![
        ChatMessage { role: "system".to_string(), content: "You are KYRO-FIX, a debugging expert.".to_string() },
        ChatMessage { role: "user".to_string(), content: user_prompt },
    ]).await
}

fn format_size(bytes: u64) -> String {
    const GB: u64 = 1024 * 1024 * 1024;
    const MB: u64 = 1024 * 1024;
    const KB: u64 = 1024;
    if bytes >= GB { format!("{:.1} GB", bytes as f64 / GB as f64) }
    else if bytes >= MB { format!("{:.1} MB", bytes as f64 / MB as f64) }
    else if bytes >= KB { format!("{:.1} KB", bytes as f64 / KB as f64) }
    else { format!("{} B", bytes) }
}
