//! Trust Requests Module
//!
//! Handles trust request prompts for untrusted workspaces

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Trust request from an extension or workspace
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrustRequest {
    pub id: String,
    pub source: String,
    pub path: PathBuf,
    pub reason: String,
    pub requested_at: String,
    pub status: TrustRequestStatus,
}

/// Status of a trust request
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TrustRequestStatus {
    Pending,
    Approved,
    Denied,
}

/// Trust request manager
pub struct TrustRequestManager {
    requests: Vec<TrustRequest>,
}

impl TrustRequestManager {
    pub fn new() -> Self {
        Self {
            requests: Vec::new(),
        }
    }

    /// Create a new trust request
    pub fn create_request(&mut self, source: &str, path: PathBuf, reason: &str) -> String {
        let id = uuid::Uuid::new_v4().to_string();
        self.requests.push(TrustRequest {
            id: id.clone(),
            source: source.to_string(),
            path,
            reason: reason.to_string(),
            requested_at: chrono::Utc::now().to_rfc3339(),
            status: TrustRequestStatus::Pending,
        });
        id
    }

    /// Get pending requests
    pub fn pending_requests(&self) -> Vec<&TrustRequest> {
        self.requests
            .iter()
            .filter(|r| r.status == TrustRequestStatus::Pending)
            .collect()
    }

    /// Approve a request
    pub fn approve(&mut self, id: &str) -> bool {
        if let Some(req) = self.requests.iter_mut().find(|r| r.id == id) {
            req.status = TrustRequestStatus::Approved;
            true
        } else {
            false
        }
    }

    /// Deny a request
    pub fn deny(&mut self, id: &str) -> bool {
        if let Some(req) = self.requests.iter_mut().find(|r| r.id == id) {
            req.status = TrustRequestStatus::Denied;
            true
        } else {
            false
        }
    }
}

impl Default for TrustRequestManager {
    fn default() -> Self {
        Self::new()
    }
}
