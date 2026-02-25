//! Update Channels for KRO_IDE
//!
//! Multi-channel release system for different user needs

use serde::{Deserialize, Serialize};

/// Update channel
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum UpdateChannel {
    /// Nightly builds - bleeding edge, may be unstable
    Nightly,
    /// Beta - early access, mostly stable
    Beta,
    /// Stable - recommended for most users
    Stable,
    /// Enterprise - LTS, IT-controlled
    Enterprise,
    /// Locked - no updates (air-gapped)
    Locked,
}

impl UpdateChannel {
    /// Get update frequency for this channel
    pub fn update_frequency(&self) -> ChannelFrequency {
        match self {
            Self::Nightly => ChannelFrequency::Every6Hours,
            Self::Beta => ChannelFrequency::Every3Days,
            Self::Stable => ChannelFrequency::Every2Weeks,
            Self::Enterprise => ChannelFrequency::Quarterly,
            Self::Locked => ChannelFrequency::Never,
        }
    }
    
    /// Get restart behavior for this channel
    pub fn restart_behavior(&self) -> RestartBehavior {
        match self {
            Self::Nightly => RestartBehavior::AutoRestart,
            Self::Beta => RestartBehavior::PromptRestart,
            Self::Stable => RestartBehavior::ScheduledRestart,
            Self::Enterprise => RestartBehavior::ManualRestart,
            Self::Locked => RestartBehavior::Never,
        }
    }
    
    /// Get channel name
    pub fn name(&self) -> &'static str {
        match self {
            Self::Nightly => "nightly",
            Self::Beta => "beta",
            Self::Stable => "stable",
            Self::Enterprise => "enterprise",
            Self::Locked => "locked",
        }
    }
    
    /// Parse from string
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "nightly" => Some(Self::Nightly),
            "beta" => Some(Self::Beta),
            "stable" => Some(Self::Stable),
            "enterprise" => Some(Self::Enterprise),
            "locked" => Some(Self::Locked),
            _ => None,
        }
    }
}

impl std::fmt::Display for UpdateChannel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.name())
    }
}

/// Update frequency
#[derive(Debug, Clone, Copy)]
pub enum ChannelFrequency {
    Every6Hours,
    Every3Days,
    Every2Weeks,
    Quarterly,
    Never,
}

/// Restart behavior
#[derive(Debug, Clone, Copy)]
pub enum RestartBehavior {
    /// Automatically restart after update
    AutoRestart,
    /// Prompt user to restart
    PromptRestart,
    /// Schedule restart during allowed hours
    ScheduledRestart,
    /// Require manual restart
    ManualRestart,
    /// Never restart
    Never,
}

/// Update policy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePolicy {
    /// Current channel
    pub channel: UpdateChannel,
    /// Automatically download updates
    pub auto_download: bool,
    /// Automatically install updates
    pub auto_install: bool,
    /// Allowed hours for updates (start, end)
    pub allowed_hours: Option<(u8, u8)>,
    /// Require signed updates
    pub require_signature: bool,
    /// Auto-rollback on failure
    pub auto_rollback: bool,
}

impl Default for UpdatePolicy {
    fn default() -> Self {
        Self {
            channel: UpdateChannel::Stable,
            auto_download: true,
            auto_install: false,
            allowed_hours: Some((2, 4)), // 2-4 AM
            require_signature: true,
            auto_rollback: true,
        }
    }
}

impl UpdatePolicy {
    /// Check if update is allowed at current time
    pub fn is_update_allowed_now(&self) -> bool {
        if let Some((start, end)) = self.allowed_hours {
            let now = chrono::Utc::now().hour() as u8;
            now >= start && now <= end
        } else {
            true
        }
    }
    
    /// Create policy for channel
    pub fn for_channel(channel: UpdateChannel) -> Self {
        match channel {
            UpdateChannel::Nightly => Self {
                channel,
                auto_download: true,
                auto_install: true,
                allowed_hours: None,
                require_signature: false,
                auto_rollback: true,
            },
            UpdateChannel::Beta => Self {
                channel,
                auto_download: true,
                auto_install: false,
                allowed_hours: None,
                require_signature: true,
                auto_rollback: true,
            },
            UpdateChannel::Stable => Self::default(),
            UpdateChannel::Enterprise => Self {
                channel,
                auto_download: false,
                auto_install: false,
                allowed_hours: Some((0, 6)), // Midnight to 6 AM
                require_signature: true,
                auto_rollback: true,
            },
            UpdateChannel::Locked => Self {
                channel,
                auto_download: false,
                auto_install: false,
                allowed_hours: None,
                require_signature: true,
                auto_rollback: false,
            },
        }
    }
}
