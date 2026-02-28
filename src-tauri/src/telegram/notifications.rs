//! Telegram Notification Manager
//!
//! Manages notifications sent from IDE to Telegram

use anyhow::Result;
use std::collections::VecDeque;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Notification manager
pub struct NotificationManager {
    queue: VecDeque<QueuedNotification>,
    history: Vec<SentNotification>,
    config: NotificationConfig,
}

#[derive(Debug, Clone)]
pub struct NotificationConfig {
    pub max_queue_size: usize,
    pub max_history_size: usize,
    pub rate_limit_per_minute: u32,
    pub quiet_hours_start: Option<u8>, // Hour in 24h format
    pub quiet_hours_end: Option<u8>,
}

impl Default for NotificationConfig {
    fn default() -> Self {
        Self {
            max_queue_size: 100,
            max_history_size: 1000,
            rate_limit_per_minute: 10,
            quiet_hours_start: Some(22), // 10 PM
            quiet_hours_end: Some(7),    // 7 AM
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueuedNotification {
    pub id: String,
    pub notification_type: String,
    pub message: String,
    pub priority: NotificationPriority,
    pub created_at: DateTime<Utc>,
    pub scheduled_for: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SentNotification {
    pub id: String,
    pub notification_type: String,
    pub message: String,
    pub chat_id: i64,
    pub sent_at: DateTime<Utc>,
    pub success: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum NotificationPriority {
    Low,
    Normal,
    High,
    Critical,
}

impl NotificationManager {
    /// Create a new notification manager
    pub fn new() -> Self {
        Self {
            queue: VecDeque::new(),
            history: Vec::new(),
            config: NotificationConfig::default(),
        }
    }

    /// Create with custom config
    pub fn with_config(config: NotificationConfig) -> Self {
        Self {
            queue: VecDeque::new(),
            history: Vec::new(),
            config,
        }
    }

    /// Queue a notification
    pub fn queue(&mut self, notification: QueuedNotification) -> Result<()> {
        if self.queue.len() >= self.config.max_queue_size {
            // Remove oldest low priority notification
            if let Some(pos) = self.queue.iter().position(|n| n.priority == NotificationPriority::Low) {
                self.queue.remove(pos);
            } else {
                // Remove oldest anyway
                self.queue.pop_front();
            }
        }

        // Insert by priority
        let insert_pos = self.queue.iter().position(|n| n.priority < notification.priority)
            .unwrap_or(self.queue.len());
        
        self.queue.insert(insert_pos, notification);
        Ok(())
    }

    /// Get next notification to send
    pub fn get_next(&mut self) -> Option<QueuedNotification> {
        self.queue.pop_front()
    }

    /// Record sent notification
    pub fn record_sent(&mut self, notification: SentNotification) {
        if self.history.len() >= self.config.max_history_size {
            self.history.remove(0);
        }
        self.history.push(notification);
    }

    /// Check if in quiet hours
    pub fn is_quiet_hours(&self) -> bool {
        if let (Some(start), Some(end)) = (self.config.quiet_hours_start, self.config.quiet_hours_end) {
            let hour = Utc::now().format("%H").to_string().parse::<u32>().unwrap_or(0) as u8;
            if start < end {
                hour >= start && hour < end
            } else {
                hour >= start || hour < end
            }
        } else {
            false
        }
    }

    /// Get queue length
    pub fn queue_length(&self) -> usize {
        self.queue.len()
    }

    /// Get history
    pub fn get_history(&self, limit: usize) -> &[SentNotification] {
        let start = self.history.len().saturating_sub(limit);
        &self.history[start..]
    }

    /// Clear queue
    pub fn clear_queue(&mut self) {
        self.queue.clear();
    }

    /// Get pending critical notifications
    pub fn get_critical_count(&self) -> usize {
        self.queue.iter().filter(|n| n.priority == NotificationPriority::Critical).count()
    }
}

impl Default for NotificationManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Notification templates
pub mod templates {
    pub fn build_success(project: &str, duration_ms: u64) -> String {
        format!(
            "✅ <b>Build Successful</b>\n\n\
             📁 Project: {}\n\
             ⏱ Duration: {}ms",
            project, duration_ms
        )
    }

    pub fn build_failed(project: &str, error: &str) -> String {
        format!(
            "❌ <b>Build Failed</b>\n\n\
             📁 Project: {}\n\
             🔴 Error: {}",
            project, error
        )
    }

    pub fn test_results(project: &str, passed: u32, failed: u32, duration_ms: u64) -> String {
        let status = if failed == 0 { "✅" } else { "⚠️" };
        format!(
            "{} <b>Test Results</b>\n\n\
             📁 Project: {}\n\
             ✅ Passed: {}\n\
             ❌ Failed: {}\n\
             ⏱ Duration: {}ms",
            status, project, passed, failed, duration_ms
        )
    }

    pub fn deploy_started(environment: &str) -> String {
        format!(
            "🚀 <b>Deployment Started</b>\n\n\
             🌍 Environment: {}\n\
             ⏳ Deploying...",
            environment
        )
    }

    pub fn deploy_success(environment: &str, url: Option<&str>) -> String {
        let url_info = url.map(|u| format!("\n🔗 URL: {}", u)).unwrap_or_default();
        format!(
            "✅ <b>Deployment Successful</b>\n\n\
             🌍 Environment: {}{}",
            environment, url_info
        )
    }

    pub fn code_review_ready(file: &str, author: &str) -> String {
        format!(
            "📝 <b>Code Review Request</b>\n\n\
             📄 File: {}\n\
             👤 Author: {}\n\n\
             Reply with your review comments.",
            file, author
        )
    }

    pub fn ai_task_complete(task_type: &str, summary: &str) -> String {
        format!(
            "🤖 <b>AI Task Completed</b>\n\n\
             📋 Task: {}\n\
             📝 Result: {}",
            task_type, summary
        )
    }

    pub fn error_alert(message: &str, severity: &str) -> String {
        let emoji = match severity {
            "critical" => "🚨",
            "error" => "❌",
            "warning" => "⚠️",
            _ => "ℹ️",
        };
        format!(
            "{} <b>Alert [{}]</b>\n\n\
             {}",
            emoji, severity.to_uppercase(), message
        )
    }
}
