//! Business Model - Tiered Pricing
//!
//! Sustainable monetization that respects user sovereignty.

use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// Subscription tier
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SubscriptionTier {
    Free,
    Pro,
    Team,
    Enterprise,
}

/// Usage limits per tier
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageLimits {
    pub daily_suggestions: u32,
    pub context_tokens: u32,
    pub model_sizes: Vec<String>,
    pub local_models: bool,
    pub cloud_fallback: bool,
    pub collaboration_users: u32,
    pub agent_executions: u32,
    pub rag_index_size_mb: u32,
}

impl SubscriptionTier {
    pub fn limits(&self) -> UsageLimits {
        match self {
            Self::Free => UsageLimits {
                daily_suggestions: 100,
                context_tokens: 2048,
                model_sizes: vec!["2B".to_string()],
                local_models: true,
                cloud_fallback: false,
                collaboration_users: 1,
                agent_executions: 10,
                rag_index_size_mb: 50,
            },
            Self::Pro => UsageLimits {
                daily_suggestions: u32::MAX,
                context_tokens: 8192,
                model_sizes: vec!["2B".to_string(), "7B".to_string(), "13B".to_string()],
                local_models: true,
                cloud_fallback: true,
                collaboration_users: 5,
                agent_executions: u32::MAX,
                rag_index_size_mb: 500,
            },
            Self::Team => UsageLimits {
                daily_suggestions: u32::MAX,
                context_tokens: 16384,
                model_sizes: vec!["2B".to_string(), "7B".to_string(), "13B".to_string(), "34B".to_string()],
                local_models: true,
                cloud_fallback: true,
                collaboration_users: 50,
                agent_executions: u32::MAX,
                rag_index_size_mb: 2000,
            },
            Self::Enterprise => UsageLimits {
                daily_suggestions: u32::MAX,
                context_tokens: 32768,
                model_sizes: vec!["all".to_string()],
                local_models: true,
                cloud_fallback: true,
                collaboration_users: u32::MAX,
                agent_executions: u32::MAX,
                rag_index_size_mb: u32::MAX,
            },
        }
    }
    
    pub fn price_monthly(&self) -> Option<u32> {
        match self {
            Self::Free => None,
            Self::Pro => Some(15),
            Self::Team => Some(25),
            Self::Enterprise => None, // Custom pricing
        }
    }
}

/// License manager
pub struct LicenseManager {
    current_tier: SubscriptionTier,
    license_key: Option<String>,
    usage: UsageTracker,
    expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Default)]
pub struct UsageTracker {
    pub suggestions_today: u32,
    pub suggestions_total: u32,
    pub last_reset: DateTime<Utc>,
    pub model_usage: HashMap<String, u32>,
}

impl LicenseManager {
    pub fn new() -> Self {
        Self {
            current_tier: SubscriptionTier::Free,
            license_key: None,
            usage: UsageTracker::default(),
            expires_at: None,
        }
    }
    
    /// Check if action is allowed
    pub fn can_perform(&self, action: &Action) -> Result<(), String> {
        let limits = self.current_tier.limits();
        
        match action {
            Action::Suggest => {
                if self.usage.suggestions_today >= limits.daily_suggestions {
                    return Err(format!(
                        "Daily suggestion limit reached ({}/{}). Upgrade to Pro for unlimited.",
                        self.usage.suggestions_today,
                        limits.daily_suggestions
                    ));
                }
            }
            Action::UseModel(size) => {
                if !limits.model_sizes.contains(&"all".to_string()) && 
                   !limits.model_sizes.contains(&size.to_string()) {
                    return Err(format!(
                        "Model size {} not available on {} tier",
                        size,
                        serde_json::to_string(&self.current_tier).unwrap_or_default()
                    ));
                }
            }
            Action::Collaborate(users) => {
                if *users > limits.collaboration_users {
                    return Err(format!(
                        "Collaboration limited to {} users on {} tier",
                        limits.collaboration_users,
                        serde_json::to_string(&self.current_tier).unwrap_or_default()
                    ));
                }
            }
            Action::RagIndex(size_mb) => {
                if *size_mb > limits.rag_index_size_mb {
                    return Err(format!(
                        "RAG index size limited to {}MB on {} tier",
                        limits.rag_index_size_mb,
                        serde_json::to_string(&self.current_tier).unwrap_or_default()
                    ));
                }
            }
            Action::AgentExecution => {
                // Check daily limit
            }
        }
        
        Ok(())
    }
    
    /// Record usage
    pub fn record_usage(&mut self, action: &Action) {
        match action {
            Action::Suggest => {
                self.usage.suggestions_today += 1;
                self.usage.suggestions_total += 1;
            }
            Action::UseModel(size) => {
                *self.usage.model_usage.entry(size.clone()).or_insert(0) += 1;
            }
            _ => {}
        }
    }
    
    /// Check and reset daily counters
    pub fn check_daily_reset(&mut self) {
        let now = Utc::now();
        let last_reset_date = self.usage.last_reset.date_naive();
        let today = now.date_naive();
        
        if last_reset_date < today {
            self.usage.suggestions_today = 0;
            self.usage.last_reset = now;
        }
    }
    
    /// Activate license
    pub fn activate(&mut self, key: &str) -> Result<SubscriptionTier, String> {
        // Validate license key
        let tier = validate_license_key(key)?;
        
        self.license_key = Some(key.to_string());
        self.current_tier = tier.clone();
        self.expires_at = Some(Utc::now() + chrono::Duration::days(365));
        
        Ok(tier)
    }
    
    /// Get current tier
    pub fn tier(&self) -> &SubscriptionTier {
        &self.current_tier
    }
    
    /// Get usage stats
    pub fn usage_stats(&self) -> &UsageTracker {
        &self.usage
    }
}

#[derive(Debug, Clone)]
pub enum Action {
    Suggest,
    UseModel(String),
    Collaborate(u32),
    RagIndex(u32),
    AgentExecution,
}

fn validate_license_key(key: &str) -> Result<SubscriptionTier, String> {
    // Simple validation - in production would verify with server
    if key.starts_with("KRO-PRO-") {
        Ok(SubscriptionTier::Pro)
    } else if key.starts_with("KRO-TEAM-") {
        Ok(SubscriptionTier::Team)
    } else if key.starts_with("KRO-ENT-") {
        Ok(SubscriptionTier::Enterprise)
    } else {
        Err("Invalid license key".to_string())
    }
}

impl Default for LicenseManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Conversion triggers for upgrade prompts
pub struct ConversionTrigger {
    pub usage_percent: f32,
    pub message: String,
    pub cta: String,
}

impl ConversionTrigger {
    pub fn suggestion_limit(limits: &UsageLimits, current: u32) -> Option<Self> {
        let percent = current as f32 / limits.daily_suggestions as f32;
        
        if percent >= 0.95 {
            Some(Self {
                usage_percent: percent,
                message: format!(
                    "You've used {}/{} AI suggestions today",
                    current, limits.daily_suggestions
                ),
                cta: "Upgrade to Pro for unlimited suggestions →".to_string(),
            })
        } else if percent >= 0.75 {
            Some(Self {
                usage_percent: percent,
                message: format!(
                    "{:.0}% of daily suggestions used",
                    percent * 100.0
                ),
                cta: "Consider upgrading for unlimited access →".to_string(),
            })
        } else {
            None
        }
    }
}

/// Viral mechanics for growth
pub struct ViralMechanics {
    referral_code: String,
    referrals: Vec<Referral>,
    credits_earned: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Referral {
    pub code: String,
    pub referred_email: String,
    pub status: ReferralStatus,
    pub credits_awarded: u32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReferralStatus {
    Pending,
    SignedUp,
    Converted,
}

impl ViralMechanics {
    pub fn new(user_id: &str) -> Self {
        Self {
            referral_code: generate_referral_code(user_id),
            referrals: Vec::new(),
            credits_earned: 0,
        }
    }
    
    /// Generate shareable link
    pub fn share_link(&self) -> String {
        format!("https://kro-ide.com/ref/{}", self.referral_code)
    }
    
    /// Award credits for successful referral
    pub fn award_referral(&mut self, email: &str) -> u32 {
        let credits = 7; // 7 days of Pro
        
        self.referrals.push(Referral {
            code: self.referral_code.clone(),
            referred_email: email.to_string(),
            status: ReferralStatus::Converted,
            credits_awarded: credits,
            created_at: Utc::now(),
        });
        
        self.credits_earned += credits;
        credits
    }
}

fn generate_referral_code(user_id: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    let mut hasher = DefaultHasher::new();
    user_id.hash(&mut hasher);
    format!("{:08x}", hasher.finish())
}
