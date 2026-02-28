//! Telegram Bot Implementation
//!
//! Handles Telegram Bot API communication

use anyhow::{Result, Context};
use crate::telegram::TelegramConfig;
use reqwest::Client;
use serde_json::json;

/// Telegram Bot API wrapper
pub struct TelegramBot {
    config: TelegramConfig,
    client: Client,
    base_url: String,
}

impl TelegramBot {
    /// Create a new Telegram bot
    pub fn new(config: TelegramConfig) -> Result<Self> {
        let base_url = format!("https://api.telegram.org/bot{}", config.bot_token);
        
        Ok(Self {
            config,
            client: Client::new(),
            base_url,
        })
    }

    /// Send a text message
    pub async fn send_message(&self, chat_id: i64, text: &str) -> Result<()> {
        let url = format!("{}/sendMessage", self.base_url);
        
        let response = self.client
            .post(&url)
            .json(&json!({
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "HTML",
            }))
            .send()
            .await
            .context("Failed to send Telegram message")?;

        if !response.status().is_success() {
            let error = response.text().await.unwrap_or_default();
            log::error!("Telegram API error: {}", error);
        }

        Ok(())
    }

    /// Send a message with keyboard
    pub async fn send_message_with_keyboard(
        &self, 
        chat_id: i64, 
        text: &str, 
        buttons: Vec<Vec<String>>
    ) -> Result<()> {
        let url = format!("{}/sendMessage", self.base_url);
        
        let keyboard: Vec<Vec<serde_json::Value>> = buttons
            .into_iter()
            .map(|row| row.into_iter().map(|btn| json!({ "text": btn })).collect())
            .collect();

        let response = self.client
            .post(&url)
            .json(&json!({
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "HTML",
                "reply_markup": {
                    "keyboard": keyboard,
                    "resize_keyboard": true,
                    "one_time_keyboard": true,
                }
            }))
            .send()
            .await
            .context("Failed to send Telegram message with keyboard")?;

        if !response.status().is_success() {
            let error = response.text().await.unwrap_or_default();
            log::error!("Telegram API error: {}", error);
        }

        Ok(())
    }

    /// Send a code snippet
    pub async fn send_code(&self, chat_id: i64, code: &str, language: &str) -> Result<()> {
        let text = format!("```{}\n{}\n```", language, code);
        self.send_message(chat_id, &text).await
    }

    /// Send a document
    pub async fn send_document(&self, chat_id: i64, file_path: &str, caption: Option<&str>) -> Result<()> {
        let url = format!("{}/sendDocument", self.base_url);
        
        let response = self.client
            .post(&url)
            .json(&json!({
                "chat_id": chat_id,
                "document": file_path,
                "caption": caption,
            }))
            .send()
            .await
            .context("Failed to send Telegram document")?;

        if !response.status().is_success() {
            let error = response.text().await.unwrap_or_default();
            log::error!("Telegram API error: {}", error);
        }

        Ok(())
    }

    /// Get updates (polling mode)
    pub async fn get_updates(&self, offset: Option<i64>) -> Result<Vec<serde_json::Value>> {
        let url = format!("{}/getUpdates", self.base_url);
        
        let mut params = vec![];
        if let Some(o) = offset {
            params.push(("offset", o.to_string()));
        }
        params.push(("timeout", "30".to_string()));

        let response = self.client
            .get(&url)
            .query(&params)
            .send()
            .await
            .context("Failed to get Telegram updates")?;

        let body: serde_json::Value = response.json().await?;
        
        let updates = body["result"].as_array()
            .cloned()
            .unwrap_or_default();

        Ok(updates)
    }

    /// Set webhook for production
    pub async fn set_webhook(&self, webhook_url: &str) -> Result<()> {
        let url = format!("{}/setWebhook", self.base_url);
        
        let response = self.client
            .post(&url)
            .json(&json!({
                "url": webhook_url,
            }))
            .send()
            .await
            .context("Failed to set Telegram webhook")?;

        if response.status().is_success() {
            log::info!("Telegram webhook set to {}", webhook_url);
        } else {
            let error = response.text().await.unwrap_or_default();
            log::error!("Failed to set webhook: {}", error);
        }

        Ok(())
    }
}
