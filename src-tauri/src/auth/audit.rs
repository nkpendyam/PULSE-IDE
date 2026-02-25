//! Audit Log Module
//! 
//! Comprehensive audit logging for security-sensitive operations

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use std::sync::Arc;
use parking_lot::RwLock;

/// Audit actions that can be logged
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AuditAction {
    // Authentication events
    UserRegistered,
    LoginSuccess,
    LoginFailed,
    LoginFailedLocked,
    Logout,
    TokenRefreshed,
    AccountLocked,
    AccountUnlocked,
    PasswordChanged,
    
    // Authorization events
    RoleChanged,
    PermissionDenied,
    
    // Rate limiting
    RateLimited,
    
    // Session events
    SessionCreated,
    SessionExpired,
    SessionRevoked,
    
    // Security events
    SuspiciousActivity,
    MultipleFailedAttempts,
    IpAddressChanged,
    
    // Admin actions
    UserDeleted,
    UserSuspended,
    ConfigChanged,
}

/// Audit log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub action: AuditAction,
    pub user_id: Uuid,
    pub details: Option<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub session_id: Option<Uuid>,
}

/// Audit log storage
pub struct AuditLog {
    entries: Arc<RwLock<Vec<AuditEntry>>>,
    max_entries: usize,
}

impl AuditLog {
    pub fn new() -> Self {
        Self {
            entries: Arc::new(RwLock::new(Vec::new())),
            max_entries: 10000,
        }
    }

    pub fn with_max_entries(max_entries: usize) -> Self {
        Self {
            entries: Arc::new(RwLock::new(Vec::new())),
            max_entries,
        }
    }

    /// Log an audit event
    pub fn log(&self, action: AuditAction, user_id: Uuid, details: Option<String>) {
        self.log_with_context(action, user_id, details, None, None, None);
    }

    /// Log an audit event with full context
    pub fn log_with_context(
        &self,
        action: AuditAction,
        user_id: Uuid,
        details: Option<String>,
        ip_address: Option<String>,
        user_agent: Option<String>,
        session_id: Option<Uuid>,
    ) {
        let entry = AuditEntry {
            id: Uuid::new_v4(),
            timestamp: Utc::now(),
            action,
            user_id,
            details,
            ip_address,
            user_agent,
            session_id,
        };

        let mut entries = self.entries.write();
        entries.push(entry);

        // Trim if over max
        if entries.len() > self.max_entries {
            let drain = entries.len() - self.max_entries;
            entries.drain(0..drain);
        }
    }

    /// Get entries (most recent first)
    pub fn get_entries(&self, limit: usize) -> Vec<&AuditEntry> {
        let entries = self.entries.read();
        entries.iter().rev().take(limit).collect()
    }

    /// Get entries for a specific user
    pub fn get_user_entries(&self, user_id: Uuid, limit: usize) -> Vec<AuditEntry> {
        let entries = self.entries.read();
        entries.iter()
            .rev()
            .filter(|e| e.user_id == user_id)
            .take(limit)
            .cloned()
            .collect()
    }

    /// Get entries by action type
    pub fn get_entries_by_action(&self, action: &AuditAction, limit: usize) -> Vec<AuditEntry> {
        let entries = self.entries.read();
        entries.iter()
            .rev()
            .filter(|e| &e.action == action)
            .take(limit)
            .cloned()
            .collect()
    }

    /// Get entries in time range
    pub fn get_entries_in_range(
        &self,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
        limit: usize,
    ) -> Vec<AuditEntry> {
        let entries = self.entries.read();
        entries.iter()
            .rev()
            .filter(|e| e.timestamp >= start && e.timestamp <= end)
            .take(limit)
            .cloned()
            .collect()
    }

    /// Get recent security events (failed logins, lockouts, etc.)
    pub fn get_security_events(&self, limit: usize) -> Vec<AuditEntry> {
        let entries = self.entries.read();
        entries.iter()
            .rev()
            .filter(|e| matches!(
                e.action,
                AuditAction::LoginFailed |
                AuditAction::LoginFailedLocked |
                AuditAction::AccountLocked |
                AuditAction::RateLimited |
                AuditAction::SuspiciousActivity |
                AuditAction::MultipleFailedAttempts |
                AuditAction::PermissionDenied
            ))
            .take(limit)
            .cloned()
            .collect()
    }

    /// Count entries in time range
    pub fn count_in_range(&self, start: DateTime<Utc>, end: DateTime<Utc>) -> usize {
        let entries = self.entries.read();
        entries.iter()
            .filter(|e| e.timestamp >= start && e.timestamp <= end)
            .count()
    }

    /// Export entries as JSON
    pub fn export_json(&self, limit: usize) -> String {
        let entries = self.entries.read();
        let export: Vec<_> = entries.iter().rev().take(limit).collect();
        serde_json::to_string_pretty(&export).unwrap_or_else(|_| "[]".to_string())
    }

    /// Clear all entries
    pub fn clear(&self) {
        let mut entries = self.entries.write();
        entries.clear();
    }

    /// Get total entry count
    pub fn len(&self) -> usize {
        self.entries.read().len()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.entries.read().is_empty()
    }
}

impl Default for AuditLog {
    fn default() -> Self {
        Self::new()
    }
}

impl Clone for AuditLog {
    fn clone(&self) -> Self {
        Self {
            entries: self.entries.clone(),
            max_entries: self.max_entries,
        }
    }
}

/// Audit log analyzer for detecting suspicious patterns
pub struct AuditAnalyzer<'a> {
    entries: &'a [AuditEntry],
}

impl<'a> AuditAnalyzer<'a> {
    pub fn new(entries: &'a [AuditEntry]) -> Self {
        Self { entries }
    }

    /// Detect brute force attempts (many failed logins from same IP)
    pub fn detect_brute_force(&self, threshold: usize) -> Vec<SuspiciousActivity> {
        use std::collections::HashMap;
        
        let mut ip_failures: HashMap<String, Vec<&AuditEntry>> = HashMap::new();
        
        for entry in self.entries {
            if matches!(entry.action, AuditAction::LoginFailed) {
                if let Some(ip) = &entry.ip_address {
                    ip_failures.entry(ip.clone())
                        .or_insert_with(Vec::new)
                        .push(entry);
                }
            }
        }
        
        ip_failures.into_iter()
            .filter(|(_, failures)| failures.len() >= threshold)
            .map(|(ip, failures)| SuspiciousActivity {
                activity_type: "brute_force".to_string(),
                ip_address: ip,
                count: failures.len(),
                first_seen: failures.first().map(|e| e.timestamp),
                last_seen: failures.last().map(|e| e.timestamp),
            })
            .collect()
    }

    /// Detect credential stuffing (multiple usernames from same IP)
    pub fn detect_credential_stuffing(&self, threshold: usize) -> Vec<SuspiciousActivity> {
        use std::collections::HashMap;
        
        let mut ip_usernames: HashMap<String, std::collections::HashSet<String>> = HashMap::new();
        
        for entry in self.entries {
            if matches!(entry.action, AuditAction::LoginFailed) {
                if let (Some(ip), Some(details)) = (&entry.ip_address, &entry.details) {
                    if details.starts_with("Username: ") {
                        let username = details.strip_prefix("Username: ").unwrap_or("");
                        ip_usernames.entry(ip.clone())
                            .or_insert_with(std::collections::HashSet::new)
                            .insert(username.to_string());
                    }
                }
            }
        }
        
        ip_usernames.into_iter()
            .filter(|(_, usernames)| usernames.len() >= threshold)
            .map(|(ip, usernames)| SuspiciousActivity {
                activity_type: "credential_stuffing".to_string(),
                ip_address: ip,
                count: usernames.len(),
                first_seen: None,
                last_seen: None,
            })
            .collect()
    }
}

/// Detected suspicious activity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuspiciousActivity {
    pub activity_type: String,
    pub ip_address: String,
    pub count: usize,
    pub first_seen: Option<DateTime<Utc>>,
    pub last_seen: Option<DateTime<Utc>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audit_log_basic() {
        let log = AuditLog::new();
        let user_id = Uuid::new_v4();
        
        log.log(AuditAction::UserRegistered, user_id, None);
        log.log(AuditAction::LoginSuccess, user_id, Some("127.0.0.1".to_string()));
        
        assert_eq!(log.len(), 2);
    }

    #[test]
    fn test_audit_log_get_user_entries() {
        let log = AuditLog::new();
        let user_id1 = Uuid::new_v4();
        let user_id2 = Uuid::new_v4();
        
        log.log(AuditAction::LoginSuccess, user_id1, None);
        log.log(AuditAction::LoginSuccess, user_id2, None);
        log.log(AuditAction::LoginFailed, user_id1, None);
        
        let user1_entries = log.get_user_entries(user_id1, 10);
        assert_eq!(user1_entries.len(), 2);
    }

    #[test]
    fn test_audit_log_max_entries() {
        let log = AuditLog::with_max_entries(5);
        let user_id = Uuid::new_v4();
        
        for i in 0..10 {
            log.log(AuditAction::LoginSuccess, user_id, Some(format!("entry {}", i)));
        }
        
        assert_eq!(log.len(), 5);
    }

    #[test]
    fn test_audit_analyzer_brute_force() {
        let log = AuditLog::new();
        let user_id = Uuid::new_v4();
        
        // Simulate 5 failed logins from same IP
        for _ in 0..5 {
            log.log_with_context(
                AuditAction::LoginFailed,
                user_id,
                None,
                Some("192.168.1.100".to_string()),
                None,
                None,
            );
        }
        
        let entries = log.get_entries(100);
        let analyzer = AuditAnalyzer::new(&entries.iter().cloned().collect::<Vec<_>>());
        let brute_force = analyzer.detect_brute_force(3);
        
        assert_eq!(brute_force.len(), 1);
        assert_eq!(brute_force[0].ip_address, "192.168.1.100");
        assert_eq!(brute_force[0].count, 5);
    }

    #[test]
    fn test_security_events() {
        let log = AuditLog::new();
        let user_id = Uuid::new_v4();
        
        log.log(AuditAction::LoginSuccess, user_id, None);
        log.log(AuditAction::LoginFailed, user_id, None);
        log.log(AuditAction::AccountLocked, user_id, None);
        log.log(AuditAction::RateLimited, user_id, None);
        
        let security_events = log.get_security_events(10);
        assert_eq!(security_events.len(), 3); // Failed, Locked, RateLimited
    }
}
