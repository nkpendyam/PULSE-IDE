//! AI commands for KYRO IDE - Real Ollama integration with multi-backend support
//!
//! Backends (in priority order):
//! 1. Local llama.cpp (when compiled with llama-cpp feature)
//! 2. Ollama (http://localhost:11434)
//! 3. LM Studio (http://localhost:1234)
//! 4. vLLM (http://localhost:8000)
//! 5. Pattern-based fallback (works offline)

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

#[derive(Debug, Serialize, Deserialize)]
pub struct BackendStatus {
    pub name: String,
    pub available: bool,
    pub endpoint: String,
}

/// Detect available AI backends
#[command]
pub async fn detect_ai_backends() -> Result<Vec<BackendStatus>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(2))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;
    
    let mut backends = Vec::new();
    
    // Check Ollama
    let ollama_available = client.get("http://localhost:11434/api/tags")
        .send().await
        .map(|r| r.status().is_success())
        .unwrap_or(false);
    backends.push(BackendStatus {
        name: "ollama".to_string(),
        available: ollama_available,
        endpoint: "http://localhost:11434".to_string(),
    });
    
    // Check LM Studio
    let lmstudio_available = client.get("http://localhost:1234/v1/models")
        .send().await
        .map(|r| r.status().is_success())
        .unwrap_or(false);
    backends.push(BackendStatus {
        name: "lmstudio".to_string(),
        available: lmstudio_available,
        endpoint: "http://localhost:1234/v1".to_string(),
    });
    
    // Check vLLM
    let vllm_available = client.get("http://localhost:8000/v1/models")
        .send().await
        .map(|r| r.status().is_success())
        .unwrap_or(false);
    backends.push(BackendStatus {
        name: "vllm".to_string(),
        available: vllm_available,
        endpoint: "http://localhost:8000/v1".to_string(),
    });
    
    // Local llama.cpp (always available when compiled)
    #[cfg(feature = "llama-cpp")]
    backends.push(BackendStatus {
        name: "local".to_string(),
        available: true,
        endpoint: "local".to_string(),
    });
    
    // Pattern fallback (always available)
    backends.push(BackendStatus {
        name: "fallback".to_string(),
        available: true,
        endpoint: "builtin".to_string(),
    });
    
    Ok(backends)
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

// ============ Ghost Text / Inline Completion Commands ============

/// AI code completion for ghost text
#[command]
pub async fn ai_code_completion(
    code: String,
    language: String,
    max_tokens: Option<u32>,
    temperature: Option<f32>,
) -> Result<String, String> {
    let max_tokens = max_tokens.unwrap_or(100);
    let temperature = temperature.unwrap_or(0.3);
    
    // Check if embedded LLM is available
    let state = crate::commands::embedded_llm::EmbeddedLLMState::default();
    
    if let Some(ref engine) = state.engine {
        let engine = engine.read().await;
        
        let request = crate::embedded_llm::InferenceRequest {
            prompt: code.clone(),
            max_tokens,
            temperature,
            top_p: 0.9,
            top_k: 40,
            repeat_penalty: 1.1,
            stop_sequences: vec!["\n\n".to_string(), "```".to_string()],
            stream: false,
            system_prompt: Some(format!(
                "You are an AI code completion assistant. Complete the {} code. Only output the completion, not the entire code.",
                language
            )),
            history: vec![],
        };
        
        let response = engine.complete(&request).await
            .map_err(|e| format!("Completion failed: {}", e))?;
        
        return Ok(response.text);
    }
    drop(state);
    
    // Fallback to Ollama
    let models = list_models().await?;
    let model = models.first()
        .map(|m| m.name.clone())
        .unwrap_or_else(|| "codellama:7b".to_string());
    
    let system_prompt = format!(
        "You are an AI code completion assistant. Complete the {} code naturally. Only output the completion, nothing else.",
        language
    );
    
    chat_completion(model, vec![
        ChatMessage { role: "system".to_string(), content: system_prompt },
        ChatMessage { role: "user".to_string(), content: format!("Complete this code:\n\n{}", code) },
    ]).await
}

/// Streaming AI completion
#[command]
pub async fn ai_stream_completion(
    code: String,
    language: String,
    max_tokens: Option<u32>,
    temperature: Option<f32>,
) -> Result<StreamCompletionResult, String> {
    let max_tokens = max_tokens.unwrap_or(100);
    let temperature = temperature.unwrap_or(0.3);
    
    // Get completion (streaming would require event-based communication)
    let text = ai_code_completion(code, language, Some(max_tokens), Some(temperature)).await?;
    
    // Split into tokens for streaming simulation
    let tokens: Vec<String> = text
        .split_whitespace()
        .map(|w| format!("{} ", w))
        .collect();
    
    Ok(StreamCompletionResult {
        text: text.clone(),
        tokens,
    })
}

/// Result for streaming completion
#[derive(Debug, Serialize, Deserialize)]
pub struct StreamCompletionResult {
    pub text: String,
    pub tokens: Vec<String>,
}

/// AI inline chat for code editing
#[command]
pub async fn ai_inline_chat(
    prompt: String,
    selected_code: String,
    language: String,
    context: String,
) -> Result<String, String> {
    let models = list_models().await?;
    let model = models.first()
        .map(|m| m.name.clone())
        .unwrap_or_else(|| "codellama:7b".to_string());
    
    let system_prompt = format!(
        "You are KYRO, an AI coding assistant integrated into an IDE. \
        The user has selected some {} code and wants to modify it. \
        Respond ONLY with the modified code, no explanations or markdown.",
        language
    );
    
    let user_content = if selected_code.is_empty() {
        format!(
            "Context (surrounding code):\n```\n{}\n```\n\nRequest: {}",
            context, prompt
        )
    } else {
        format!(
            "Selected code:\n```\n{}\n```\n\nContext:\n```\n{}\n```\n\nRequest: {}",
            selected_code, context, prompt
        )
    };
    
    chat_completion(model, vec![
        ChatMessage { role: "system".to_string(), content: system_prompt },
        ChatMessage { role: "user".to_string(), content: user_content },
    ]).await
}

/// Smart AI completion with automatic backend detection and fallback
/// This is the recommended command for all AI operations
#[command]
pub async fn smart_ai_completion(
    prompt: String,
    system_prompt: Option<String>,
    context: Option<String>,
    history: Vec<ChatMessage>,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
) -> Result<SmartCompletionResult, String> {
    use crate::ai::{AiService, AiBackendConfig, CompletionRequest};
    
    let config = AiBackendConfig {
        temperature: temperature.unwrap_or(0.7),
        max_tokens: max_tokens.unwrap_or(2048),
        ..Default::default()
    };
    
    let service = AiService::new(config);
    
    // Detect available backends
    let backends = service.detect_backends().await
        .map_err(|e| format!("Failed to detect backends: {}", e))?;
    
    log::info!("Available AI backends: {:?}", backends);
    
    let request = CompletionRequest {
        prompt: prompt.clone(),
        system_prompt,
        history: history.into_iter().map(|m| crate::ai::ConversationMessage {
            role: m.role,
            content: m.content,
        }).collect(),
        temperature,
        max_tokens,
        stop_sequences: vec![],
        context,
    };
    
    // Try to get completion
    match service.complete(request).await {
        Ok(response) => Ok(SmartCompletionResult {
            text: response.text,
            model: response.model,
            backend: response.backend,
            tokens_generated: response.tokens_generated,
            time_ms: response.total_time_ms,
            tokens_per_second: response.tokens_per_second,
            from_cache: response.from_cache,
        }),
        Err(e) => {
            log::warn!("AI completion failed: {}, using fallback", e);
            
            // Use pattern-based fallback
            let fallback_text = generate_fallback_response(&prompt);
            Ok(SmartCompletionResult {
                text: fallback_text,
                model: "pattern-fallback".to_string(),
                backend: "fallback".to_string(),
                tokens_generated: 50,
                time_ms: 25,
                tokens_per_second: 50.0,
                from_cache: false,
            })
        }
    }
}

/// Result for smart completion
#[derive(Debug, Serialize, Deserialize)]
pub struct SmartCompletionResult {
    pub text: String,
    pub model: String,
    pub backend: String,
    pub tokens_generated: u32,
    pub time_ms: u64,
    pub tokens_per_second: f32,
    pub from_cache: bool,
}

/// Generate fallback response using pattern matching
fn generate_fallback_response(prompt: &str) -> String {
    let prompt_lower = prompt.to_lowercase();
    
    if prompt_lower.contains("fix") || prompt_lower.contains("bug") || prompt_lower.contains("error") {
        format!("🔧 **Bug Analysis**\n\nLooking at the code, here are potential issues:\n\n1. Check for `unwrap()` calls - consider proper error handling\n2. Verify null/undefined checks are in place\n3. Ensure all edge cases are handled\n\nWould you like me to analyze specific code?")
    } else if prompt_lower.contains("explain") || prompt_lower.contains("what") {
        format!("📚 **Code Explanation**\n\nThis code appears to implement a specific functionality.\n\nTo provide a detailed explanation, please share the specific code snippet you'd like me to analyze.\n\n*Tip: Run Ollama locally for more detailed AI assistance*")
    } else if prompt_lower.contains("refactor") || prompt_lower.contains("improve") {
        format!("♻️ **Refactoring Suggestions**\n\nGeneral improvements:\n\n1. Extract repeated code into functions\n2. Add proper error handling\n3. Improve naming for clarity\n4. Consider the DRY principle\n\nShare your code for specific suggestions!")
    } else if prompt_lower.contains("test") {
        format!("🧪 **Test Generation**\n\nI can help generate tests! Please share:\n\n1. The code you want to test\n2. Any specific test scenarios\n\n*Run Ollama for full test generation capabilities*")
    } else if prompt_lower.contains("implement") || prompt_lower.contains("create") {
        format!("💡 **Implementation Guide**\n\nTo help you implement this:\n\n1. Break down the requirements\n2. Define the interfaces first\n3. Implement core logic\n4. Add error handling\n5. Write tests\n\nPlease provide more details about what you'd like to implement!")
    } else {
        format!("🤖 **AI Assistant**\n\nI understand you're asking about: \"{}\"\n\n**For full AI capabilities, please:**\n- Install and run Ollama: `ollama serve`\n- Pull a model: `ollama pull codellama:7b`\n- Or use LM Studio for local inference\n\nI can still help with pattern-based analysis!", 
            prompt.chars().take(100).collect::<String>())
    }
}


