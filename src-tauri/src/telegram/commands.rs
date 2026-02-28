//! Telegram Command Handler
//!
//! Processes commands received from Telegram

use anyhow::Result;
use crate::telegram::{TelegramMessage, TelegramSession, PendingAction};

/// Telegram command handler
pub struct TelegramCommandHandler {
    commands: Vec<CommandInfo>,
}

struct CommandInfo {
    name: String,
    description: String,
    handler: fn(&TelegramMessage, &[&str]) -> Result<String>,
}

/// Command handler result
pub struct CommandResult {
    pub response: String,
    pub keyboard: Option<Vec<Vec<String>>>,
    pub pending_action: Option<PendingAction>,
}

impl TelegramCommandHandler {
    /// Create a new command handler
    pub fn new() -> Self {
        Self {
            commands: vec![
                CommandInfo {
                    name: "start".to_string(),
                    description: "Start using KYRO IDE Bot".to_string(),
                    handler: cmd_start,
                },
                CommandInfo {
                    name: "help".to_string(),
                    description: "Show available commands".to_string(),
                    handler: cmd_help,
                },
                CommandInfo {
                    name: "status".to_string(),
                    description: "Show IDE status".to_string(),
                    handler: cmd_status,
                },
                CommandInfo {
                    name: "review".to_string(),
                    description: "Request code review".to_string(),
                    handler: cmd_review,
                },
                CommandInfo {
                    name: "build".to_string(),
                    description: "Trigger build".to_string(),
                    handler: cmd_build,
                },
                CommandInfo {
                    name: "test".to_string(),
                    description: "Run tests".to_string(),
                    handler: cmd_test,
                },
                CommandInfo {
                    name: "ai".to_string(),
                    description: "AI assistant query".to_string(),
                    handler: cmd_ai,
                },
                CommandInfo {
                    name: "files".to_string(),
                    description: "List project files".to_string(),
                    handler: cmd_files,
                },
            ],
        }
    }

    /// Handle a command
    pub async fn handle_command(&mut self, message: &TelegramMessage, text: &str) -> Result<()> {
        let parts: Vec<&str> = text.split_whitespace().collect();
        let command = parts.get(0).unwrap_or(&"").trim_start_matches('/');

        let response = if let Some(cmd) = self.commands.iter().find(|c| c.name == command) {
            (cmd.handler)(message, &parts[1..]).unwrap_or_else(|e| format!("Error: {}", e))
        } else {
            format!("Unknown command: /{}\n\nUse /help to see available commands.", command)
        };

        // In production, send response via bot
        log::info!("Command response: {}", response);

        Ok(())
    }

    /// Get list of commands for help
    pub fn get_help_text(&self) -> String {
        let mut help = "🤖 <b>KYRO IDE Bot Commands</b>\n\n".to_string();
        for cmd in &self.commands {
            help.push_str(&format!("/{} - {}\n", cmd.name, cmd.description));
        }
        help
    }
}

impl Default for TelegramCommandHandler {
    fn default() -> Self {
        Self::new()
    }
}

// Command handlers

fn cmd_start(_message: &TelegramMessage, _args: &[&str]) -> Result<String> {
    Ok("🚀 Welcome to KYRO IDE Bot!\n\n\
        I can help you:\n\
        • Get code reviews\n\
        • Monitor builds and tests\n\
        • AI-assisted coding\n\
        • Remote notifications\n\n\
        Use /help to see all commands.".to_string())
}

fn cmd_help(message: &TelegramMessage, _args: &[&str]) -> Result<String> {
    Ok(format!("🤖 <b>KYRO IDE Bot Commands</b>\n\n\
        /start - Start using the bot\n\
        /help - Show this help\n\
        /status - Show IDE and project status\n\
        /review [file] - Request code review\n\
        /build - Trigger a build\n\
        /test - Run test suite\n\
        /ai [prompt] - Ask AI assistant\n\
        /files [path] - List project files\n\n\
        <i>Chat ID: {}</i>", message.chat_id))
}

fn cmd_status(_message: &TelegramMessage, _args: &[&str]) -> Result<String> {
    // In production, this would query actual IDE state
    Ok("📊 <b>KYRO IDE Status</b>\n\n\
        🟢 IDE: Running\n\
        📁 Project: Not opened\n\
        🤖 AI: Connected (Ollama)\n\
        🌿 Git: Not initialized\n\
        💾 Memory: 512 MB\n\n\
        Use /open to open a project.".to_string())
}

fn cmd_review(_message: &TelegramMessage, args: &[&str]) -> Result<String> {
    if args.is_empty() {
        Ok("📝 <b>Code Review</b>\n\n\
            Usage: /review [file_path]\n\n\
            Example: /review src/main.rs".to_string())
    } else {
        let file = args.join(" ");
        Ok(format!("📝 <b>Code Review Requested</b>\n\n\
            📄 File: {}\n\n\
            Review will be sent when ready. You can also reply with specific questions.", file))
    }
}

fn cmd_build(_message: &TelegramMessage, _args: &[&str]) -> Result<String> {
    Ok("🔨 <b>Build Started</b>\n\n\
        Building project...\n\n\
        You will receive a notification when the build completes.\n\n\
        <i>Use /cancel to abort.</i>".to_string())
}

fn cmd_test(_message: &TelegramMessage, _args: &[&str]) -> Result<String> {
    Ok("🧪 <b>Running Tests</b>\n\n\
        Executing test suite...\n\n\
        Results will be sent when all tests complete.".to_string())
}

fn cmd_ai(_message: &TelegramMessage, args: &[&str]) -> Result<String> {
    if args.is_empty() {
        Ok("🤖 <b>AI Assistant</b>\n\n\
            Usage: /ai [your question]\n\n\
            Examples:\n\
            /ai How do I optimize this loop?\n\
            /ai Explain this regex pattern\n\
            /ai Generate a unit test for this function".to_string())
    } else {
        let prompt = args.join(" ");
        // In production, this would call the AI engine
        Ok(format!("🤖 <b>AI Response</b>\n\n\
            Processing: \"{}\"\n\n\
            <i>Response will be generated by the AI engine...</i>", prompt))
    }
}

fn cmd_files(_message: &TelegramMessage, _args: &[&str]) -> Result<String> {
    // In production, this would list actual files
    Ok("📁 <b>Project Files</b>\n\n\
        📂 src/\n\
          📄 main.rs\n\
          📄 lib.rs\n\
          📂 components/\n\
        📂 tests/\n\
        📄 Cargo.toml\n\
        📄 README.md\n\n\
        Use /open [file] to open a file.".to_string())
}
