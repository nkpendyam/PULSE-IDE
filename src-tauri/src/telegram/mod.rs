//! Telegram Bridge for KRO_IDE
//!
//! This module provides Telegram bot integration for remote coding assistance,
//! notifications, and code review requests. Users can interact with their IDE
//! from Telegram mobile app.
//!
//! ## Features
//! - Remote code review requests
//! - Build/deploy notifications
//! - Quick commands via Telegram
//! - AI chat integration
//! - File sharing and snippets

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;
use chrono::{DateTime, Utc};

pub mod bot;
pub mod commands;
pub mod notifications;

pub use bot::TelegramBot;
pub use commands::TelegramCommandHandler;
pub use notifications::NotificationManager;

/// Telegram bridge configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelegramConfig {
    /// Bot token from BotFather
    pub bot_token: String,
    /// Allowed chat IDs (whitelist)
    pub allowed_chat_ids: Vec<i64>,
    /// Enable notifications
    pub enable_notifications: bool,
    /// Enable remote commands
    pub enable_remote_commands: bool,
    /// Webhook URL (optional, for production)
    pub webhook_url: Option<String>,
    /// Maximum message length
    pub max_message_length: usize,
    /// Rate limit messages per minute
    pub rate_limit_per_minute: u32,
}

impl Default for TelegramConfig {
    fn default() -> Self {
        Self {
            bot_token: String::new(),
            allowed_chat_ids: Vec::new(),
            enable_notifications: true,
            enable_remote_commands: true,
            webhook_url: None,
            max_message_length: 4096,
            rate_limit_per_minute: 20,
        }
    }
}

/// Telegram user session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelegramSession {
    pub chat_id: i64,
    pub user_id: i64,
    pub username: Option<String>,
    pub first_name: String,
    pub last_name: Option<String>,
    pub authenticated: bool,
    pub created_at: DateTime<Utc>,
    pub last_activity: DateTime<Utc>,
    pub current_project: Option<String>,
    pub pending_action: Option<PendingAction>,
}

/// Pending user action
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PendingAction {
    AwaitingCodeReview { file_path: String },
    AwaitingConfirmation { command: String },
    AwaitingFileSelection { files: Vec<String> },
    AwaitingAiPrompt { context: String },
}

/// Telegram message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelegramMessage {
    pub message_id: i64,
    pub chat_id: i64,
    pub user_id: i64,
    pub text: Option<String>,
    pub timestamp: DateTime<Utc>,
    pub reply_to: Option<i64>,
    pub attachments: Vec<TelegramAttachment>,
}

/// Message attachment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelegramAttachment {
    pub file_id: String,
    pub file_name: Option<String>,
    pub file_type: AttachmentType,
    pub file_size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AttachmentType {
    Document,
    Photo,
    Code,
    Text,
    Other,
}

/// Telegram notification types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NotificationType {
    BuildCompleted { success: bool, duration_ms: u64 },
    TestResults { passed: u32, failed: u32 },
    CodeReviewReady { file_path: String, author: String },
    DeployCompleted { environment: String, url: Option<String> },
    ErrorAlert { message: String, severity: Severity },
    AiTaskCompleted { task_type: String, summary: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Severity {
    Info,
    Warning,
    Error,
    Critical,
}

/// Telegram Bridge Manager
pub struct TelegramBridge {
    config: TelegramConfig,
    sessions: Arc<RwLock<HashMap<i64, TelegramSession>>>,
    notification_manager: Arc<RwLock<NotificationManager>>,
    command_handler: Arc<RwLock<TelegramCommandHandler>>,
    bot: Option<Arc<RwLock<TelegramBot>>>,
}

impl TelegramBridge {
    /// Create a new Telegram bridge
    pub fn new(config: TelegramConfig) -> Self {
        Self {
            config,
            sessions: Arc::new(RwLock::new(HashMap::new())),
            notification_manager: Arc::new(RwLock::new(NotificationManager::new())),
            command_handler: Arc::new(RwLock::new(TelegramCommandHandler::new())),
            bot: None,
        }
    }

    /// Start the Telegram bot
    pub async fn start(&mut self) -> Result<()> {
        if self.config.bot_token.is_empty() {
            log::warn!("Telegram bot token not configured, bridge disabled");
            return Ok(());
        }

        let bot = TelegramBot::new(self.config.clone())?;
        self.bot = Some(Arc::new(RwLock::new(bot)));

        log::info!("Telegram bridge started");
        Ok(())
    }

    /// Stop the Telegram bot
    pub async fn stop(&mut self) -> Result<()> {
        self.bot = None;
        log::info!("Telegram bridge stopped");
        Ok(())
    }

    /// Handle incoming message
    pub async fn handle_message(&self, message: TelegramMessage) -> Result<()> {
        // Check if chat is allowed
        if !self.config.allowed_chat_ids.is_empty() 
            && !self.config.allowed_chat_ids.contains(&message.chat_id) {
            log::warn!("Message from unauthorized chat: {}", message.chat_id);
            return Ok(());
        }

        // Update session
        self.update_session(&message).await?;

        // Process message
        let text = match &message.text {
            Some(t) => t.clone(),
            None => return Ok(()),
        };

        // Handle commands
        if text.starts_with('/') {
            let mut handler = self.command_handler.write().await;
            handler.handle_command(&message, &text).await?;
        } else {
            // Handle as message
            self.handle_text_message(&message, &text).await?;
        }

        Ok(())
    }

    /// Update session from message
    async fn update_session(&self, message: &TelegramMessage) -> Result<()> {
        let mut sessions = self.sessions.write().await;
        
        let session = sessions.entry(message.chat_id).or_insert(TelegramSession {
            chat_id: message.chat_id,
            user_id: message.user_id,
            username: None,
            first_name: "User".to_string(),
            last_name: None,
            authenticated: true,
            created_at: Utc::now(),
            last_activity: Utc::now(),
            current_project: None,
            pending_action: None,
        });

        session.last_activity = Utc::now();
        Ok(())
    }

    /// Handle text message (non-command)
    async fn handle_text_message(&self, message: &TelegramMessage, text: &str) -> Result<()> {
        let sessions = self.sessions.read().await;
        
        if let Some(session) = sessions.get(&message.chat_id) {
            if let Some(action) = &session.pending_action {
                match action {
                    PendingAction::AwaitingCodeReview { file_path } => {
                        log::info!("Code review response for {}: {}", file_path, text);
                    }
                    PendingAction::AwaitingConfirmation { command } => {
                        if text.to_lowercase() == "yes" || text.to_lowercase() == "y" {
                            log::info!("Confirmed command: {}", command);
                        }
                    }
                    PendingAction::AwaitingAiPrompt { context } => {
                        log::info!("AI prompt in context {}: {}", context, text);
                    }
                    _ => {}
                }
            }
        }

        Ok(())
    }

    /// Send notification
    pub async fn send_notification(&self, chat_id: i64, notification: NotificationType) -> Result<()> {
        if !self.config.enable_notifications {
            return Ok(());
        }

        let message = self.format_notification(&notification);
        
        if let Some(bot) = &self.bot {
            let bot = bot.read().await;
            bot.send_message(chat_id, &message).await?;
        }

        Ok(())
    }

    /// Broadcast notification to all allowed chats
    pub async fn broadcast_notification(&self, notification: NotificationType) -> Result<()> {
        let message = self.format_notification(&notification);
        
        for chat_id in &self.config.allowed_chat_ids {
            if let Some(bot) = &self.bot {
                let bot = bot.read().await;
                bot.send_message(*chat_id, &message).await?;
            }
        }

        Ok(())
    }

    /// Format notification as message
    fn format_notification(&self, notification: &NotificationType) -> String {
        match notification {
            NotificationType::BuildCompleted { success, duration_ms } => {
                let status = if *success { "✅ SUCCESS" } else { "❌ FAILED" };
                format!("🔨 Build {}\n⏱ Duration: {}ms", status, duration_ms)
            }
            NotificationType::TestResults { passed, failed } => {
                let total = passed + failed;
                let status = if *failed == 0 { "✅" } else { "⚠️" };
                format!("{} Test Results\n✅ Passed: {}\n❌ Failed: {}\n📊 Total: {}", 
                    status, passed, failed, total)
            }
            NotificationType::CodeReviewReady { file_path, author } => {
                format!("📝 Code Review Request\n📄 File: {}\n👤 Author: {}", file_path, author)
            }
            NotificationType::DeployCompleted { environment, url } => {
                let url_info = url.as_ref()
                    .map(|u| format!("\n🔗 URL: {}", u))
                    .unwrap_or_default();
                format!("🚀 Deployed to {}\n✅ Deployment successful{}", environment, url_info)
            }
            NotificationType::ErrorAlert { message, severity } => {
                let emoji = match severity {
                    Severity::Info => "ℹ️",
                    Severity::Warning => "⚠️",
                    Severity::Error => "❌",
                    Severity::Critical => "🚨",
                };
                format!("{} Alert [{}]\n{}", emoji, match severity {
                    Severity::Info => "INFO",
                    Severity::Warning => "WARNING",
                    Severity::Error => "ERROR",
                    Severity::Critical => "CRITICAL",
                }, message)
            }
            NotificationType::AiTaskCompleted { task_type, summary } => {
                format!("🤖 AI Task Completed\n📋 Type: {}\n📝 Summary: {}", task_type, summary)
            }
        }
    }

    /// Get session for chat
    pub async fn get_session(&self, chat_id: i64) -> Option<TelegramSession> {
        let sessions = self.sessions.read().await;
        sessions.get(&chat_id).cloned()
    }

    /// Set pending action for session
    pub async fn set_pending_action(&self, chat_id: i64, action: PendingAction) -> Result<()> {
        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.get_mut(&chat_id) {
            session.pending_action = Some(action);
        }
        Ok(())
    }
}

impl Default for TelegramBridge {
    fn default() -> Self {
        Self::new(TelegramConfig::default())
    }
}
