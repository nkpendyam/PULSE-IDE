//! Approval Workflow for Agent Actions
//!
//! Manages pending edits that require user approval before execution

use super::*;
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

/// Approval workflow manager
pub struct ApprovalWorkflow {
    pending: HashMap<String, PendingEdit>,
}

impl ApprovalWorkflow {
    pub fn new() -> Self {
        Self {
            pending: HashMap::new(),
        }
    }

    /// Create a new pending edit
    pub fn create_pending(&self, actions: Vec<AgentAction>) -> Result<PendingEdit> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| anyhow::anyhow!("System time error: {}", e))?
            .as_secs();

        let pending = PendingEdit {
            id: id.clone(),
            actions,
            status: ApprovalStatus::Pending,
            created_at: now,
            expires_at: now + 3600, // 1 hour expiry
            approved: false,
        };

        Ok(pending)
    }

    /// Get a pending edit by ID
    pub fn get(&self, id: &str) -> Option<&PendingEdit> {
        self.pending.get(id)
    }

    /// Approve a pending edit
    pub fn approve(&mut self, id: &str) -> Result<PendingEdit> {
        let pending = self.pending.get_mut(id)
            .ok_or_else(|| anyhow::anyhow!("Pending edit not found: {}", id))?;

        if pending.status != ApprovalStatus::Pending {
            anyhow::bail!("Edit is not in pending state");
        }

        // Check expiry
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| anyhow::anyhow!("System time error: {}", e))?
            .as_secs();
        if now > pending.expires_at {
            pending.status = ApprovalStatus::Expired;
            anyhow::bail!("Edit has expired");
        }

        pending.status = ApprovalStatus::Approved;
        pending.approved = true;

        Ok(pending.clone())
    }

    /// Reject a pending edit
    pub fn reject(&mut self, id: &str) -> Result<()> {
        let pending = self.pending.get_mut(id)
            .ok_or_else(|| anyhow::anyhow!("Pending edit not found: {}", id))?;

        pending.status = ApprovalStatus::Rejected;
        Ok(())
    }

    /// Get all pending edits
    pub fn get_pending(&self) -> Vec<PendingEdit> {
        self.pending.values()
            .filter(|p| p.status == ApprovalStatus::Pending)
            .cloned()
            .collect()
    }

    /// Clear expired edits
    pub fn clear_expired(&mut self) -> usize {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| log::warn!("System time error in clear_expired"))
            .unwrap_or(0)
            .as_secs();

        let expired: Vec<String> = self.pending.iter()
            .filter(|(_, p)| p.expires_at < now)
            .map(|(id, _)| id.clone())
            .collect();

        let count = expired.len();
        for id in expired {
            self.pending.remove(&id);
        }

        count
    }

    /// Remove a pending edit
    pub fn remove(&mut self, id: &str) -> Option<PendingEdit> {
        self.pending.remove(id)
    }
}

impl Default for ApprovalWorkflow {
    fn default() -> Self {
        Self::new()
    }
}

/// Pending edit awaiting approval
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingEdit {
    /// Unique ID
    pub id: String,
    /// Actions to execute
    pub actions: Vec<AgentAction>,
    /// Current status
    pub status: ApprovalStatus,
    /// Creation timestamp
    pub created_at: u64,
    /// Expiry timestamp
    pub expires_at: u64,
    /// Whether approved
    pub approved: bool,
}

/// Approval status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalStatus {
    Pending,
    Approved,
    Rejected,
    Expired,
    Executed,
}

/// Edit diff for display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditDiff {
    pub file_path: String,
    pub hunks: Vec<DiffHunk>,
}

/// Diff hunk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffHunk {
    pub old_start: usize,
    pub old_lines: usize,
    pub new_start: usize,
    pub new_lines: usize,
    pub lines: Vec<DiffLine>,
}

/// Diff line
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffLine {
    pub line_type: DiffLineType,
    pub content: String,
    pub old_line: Option<usize>,
    pub new_line: Option<usize>,
}

/// Diff line type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DiffLineType {
    Context,
    Addition,
    Deletion,
}

impl PendingEdit {
    /// Generate a human-readable summary
    pub fn summary(&self) -> String {
        let mut summary = String::new();

        summary.push_str(&format!("Pending Edit: {}\n", self.id));
        summary.push_str(&format!("Status: {:?}\n", self.status));
        summary.push_str(&format!("Actions: {}\n\n", self.actions.len()));

        for (i, action) in self.actions.iter().enumerate() {
            summary.push_str(&format!("{}. {:?}: {}\n", i + 1, action.action_type, action.description));
            if let Some(file) = &action.target_file {
                summary.push_str(&format!("   File: {}\n", file));
            }
        }

        summary
    }

    /// Check if edit has expired
    pub fn is_expired(&self) -> bool {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|now| now.as_secs() > self.expires_at)
            .unwrap_or_else(|_| {
                log::warn!("System time error in is_expired, assuming expired");
                true // Safer to assume expired on error
            })
    }

    /// Get affected files
    pub fn affected_files(&self) -> Vec<String> {
        self.actions.iter()
            .filter_map(|a| a.target_file.clone())
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_pending() {
        let workflow = ApprovalWorkflow::new();
        let actions = vec![AgentAction {
            id: "1".to_string(),
            action_type: ActionType::EditLines,
            description: "Test edit".to_string(),
            target_file: Some("test.rs".to_string()),
            edits: vec![],
            confidence: 0.9,
            reasoning: "Test".to_string(),
        }];

        let pending = workflow.create_pending(actions).unwrap();
        assert_eq!(pending.status, ApprovalStatus::Pending);
        assert!(!pending.approved);
    }

    #[test]
    fn test_approve_edit() {
        let mut workflow = ApprovalWorkflow::new();
        let actions = vec![AgentAction {
            id: "1".to_string(),
            action_type: ActionType::EditLines,
            description: "Test edit".to_string(),
            target_file: Some("test.rs".to_string()),
            edits: vec![],
            confidence: 0.9,
            reasoning: "Test".to_string(),
        }];

        let pending = workflow.create_pending(actions).unwrap();
        let id = pending.id.clone();
        workflow.pending.insert(id.clone(), pending);

        let approved = workflow.approve(&id).unwrap();
        assert_eq!(approved.status, ApprovalStatus::Approved);
        assert!(approved.approved);
    }
}
