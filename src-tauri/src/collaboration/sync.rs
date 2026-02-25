//! CRDT Synchronization Engine
//!
//! Based on yrs (Yjs Rust port) for conflict-free synchronization

use anyhow::Result;
use serde::{Deserialize, Serialize};
use yrs::{Doc, Text, Transact, ReadTxn, StateVector, Update};

/// Sync message types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SyncMessage {
    /// Sync step 1: Send state vector
    SyncStep1 { state_vector: Vec<u8> },
    /// Sync step 2: Send update
    SyncStep2 { update: Vec<u8> },
    /// Update message
    Update { update: Vec<u8> },
}

/// Document state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentState {
    pub content: String,
    pub version: u64,
    pub users: Vec<super::UserInfo>,
}

/// Sync engine
pub struct SyncEngine {
    doc: Doc,
    text: Text,
}

impl SyncEngine {
    pub fn new() -> Self {
        let doc = Doc::new();
        let text = doc.get_or_insert_text("content");
        Self { doc, text }
    }
    
    pub fn get_content(&self) -> String {
        let txn = self.doc.transact();
        self.text.get_string(&txn)
    }
    
    pub fn insert(&self, pos: usize, text: &str) -> Result<()> {
        let mut txn = self.doc.transact_mut();
        self.text.insert(&mut txn, pos, text)?;
        Ok(())
    }
    
    pub fn delete(&self, pos: usize, len: usize) -> Result<()> {
        let mut txn = self.doc.transact_mut();
        self.text.remove_range(&mut txn, pos, len)?;
        Ok(())
    }
    
    pub fn get_state_vector(&self) -> Vec<u8> {
        let txn = self.doc.transact();
        txn.state_vector().encode_v1()
    }
    
    pub fn encode_update(&self) -> Result<Vec<u8>> {
        let txn = self.doc.transact();
        Ok(txn.encode_update_v1()?)
    }
    
    pub fn apply_update(&self, update: &[u8]) -> Result<()> {
        let update = Update::decode_v1(update)?;
        let mut txn = self.doc.transact_mut();
        txn.apply_update(update);
        Ok(())
    }
}

impl Default for SyncEngine {
    fn default() -> Self {
        Self::new()
    }
}
