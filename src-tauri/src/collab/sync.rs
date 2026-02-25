//! CRDT Document Sync using Yrs (Yjs Rust port)
//!
//! Implements conflict-free replicated data types for collaborative editing.

use std::collections::HashMap;
use yrs::{Doc, Text, TextRef, Transact, ReadTxn, StateVector, Update, UpdateEvent};
use yrs::updates::encoder::Encode;
use yrs::updates::decoder::Decode;
use serde::{Deserialize, Serialize};
use anyhow::{Result, Context};
use log::{debug, info};

/// CRDT-based collaborative document
pub struct CollabDocument {
    doc: Doc,
    text: TextRef,
    id: String,
    version: u64,
}

impl CollabDocument {
    /// Create a new collaborative document
    pub fn new(id: &str) -> Self {
        let doc = Doc::new();
        let text = doc.get_or_insert_text("content");
        
        Self {
            doc,
            text,
            id: id.to_string(),
            version: 0,
        }
    }
    
    /// Get document content
    pub fn get_content(&self) -> String {
        let txn = self.doc.transact();
        self.text.get_string(&txn)
    }
    
    /// Set document content
    pub fn set_content(&mut self, content: &str) -> Result<()> {
        let mut txn = self.doc.transact_mut();
        let len = self.text.len(&txn);
        self.text.remove_range(&mut txn, 0, len);
        self.text.insert(&mut txn, 0, content);
        self.version += 1;
        Ok(())
    }
    
    /// Insert text at position
    pub fn insert(&mut self, pos: u32, text: &str) -> Result<()> {
        let mut txn = self.doc.transact_mut();
        self.text.insert(&mut txn, pos, text);
        self.version += 1;
        debug!("Inserted {} chars at position {}", text.len(), pos);
        Ok(())
    }
    
    /// Delete text range
    pub fn delete(&mut self, pos: u32, len: u32) -> Result<()> {
        let mut txn = self.doc.transact_mut();
        self.text.remove_range(&mut txn, pos, len);
        self.version += 1;
        debug!("Deleted {} chars at position {}", len, pos);
        Ok(())
    }
    
    /// Replace text range
    pub fn replace(&mut self, pos: u32, len: u32, text: &str) -> Result<()> {
        let mut txn = self.doc.transact_mut();
        self.text.remove_range(&mut txn, pos, len);
        self.text.insert(&mut txn, pos, text);
        self.version += 1;
        Ok(())
    }
    
    /// Get document length
    pub fn len(&self) -> u32 {
        let txn = self.doc.transact();
        self.text.len(&txn)
    }
    
    /// Check if document is empty
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
    
    /// Get current state vector for sync
    pub fn get_state_vector(&self) -> Vec<u8> {
        let txn = self.doc.transact();
        txn.state_vector().encode_v1()
    }
    
    /// Get document update since given state vector
    pub fn get_update_since(&self, state_vector: &[u8]) -> Result<Vec<u8>> {
        let sv = StateVector::decode_v1(state_vector)
            .map_err(|e| anyhow::anyhow!("Failed to decode state vector: {:?}", e))?;
        let txn = self.doc.transact();
        let update = txn.encode_diff_v1(&sv);
        Ok(update)
    }
    
    /// Apply remote update
    pub fn apply_update(&mut self, update: &[u8]) -> Result<()> {
        let update = Update::decode_v1(update)
            .map_err(|e| anyhow::anyhow!("Failed to decode update: {:?}", e))?;
        let mut txn = self.doc.transact_mut();
        txn.apply_update(update);
        self.version += 1;
        info!("Applied update to document {}", self.id);
        Ok(())
    }
    
    /// Get full document update (for initial sync)
    pub fn get_full_update(&self) -> Vec<u8> {
        let txn = self.doc.transact();
        txn.encode_update_v1()
    }
    
    /// Get vector clock for conflict detection
    pub fn get_vector_clock(&self) -> HashMap<String, u64> {
        // Simplified vector clock using version
        let mut clock = HashMap::new();
        clock.insert(self.id.clone(), self.version);
        clock
    }
    
    /// Get document version
    pub fn version(&self) -> u64 {
        self.version
    }
    
    /// Get document ID
    pub fn id(&self) -> &str {
        &self.id
    }
}

/// Sync protocol implementation
pub struct SyncProtocol;

impl SyncProtocol {
    /// Create sync step 1 message (request state)
    pub fn create_sync_step1(doc: &CollabDocument) -> Vec<u8> {
        doc.get_state_vector()
    }
    
    /// Create sync step 2 message (send state)
    pub fn create_sync_step2(doc: &CollabDocument, state_vector: &[u8]) -> Result<Vec<u8>> {
        doc.get_update_since(state_vector)
    }
    
    /// Apply sync update
    pub fn apply_sync_update(doc: &mut CollabDocument, update: &[u8]) -> Result<()> {
        doc.apply_update(update)
    }
}

/// Text operation for CRDT
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextOperation {
    pub operation_type: TextOpType,
    pub position: u32,
    pub content: String,
    pub length: u32,
    pub origin: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TextOpType {
    Insert,
    Delete,
    Replace,
}

impl TextOperation {
    pub fn insert(position: u32, content: &str, origin: &str) -> Self {
        Self {
            operation_type: TextOpType::Insert,
            position,
            content: content.to_string(),
            length: content.len() as u32,
            origin: origin.to_string(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
        }
    }
    
    pub fn delete(position: u32, length: u32, origin: &str) -> Self {
        Self {
            operation_type: TextOpType::Delete,
            position,
            content: String::new(),
            length,
            origin: origin.to_string(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
        }
    }
    
    pub fn replace(position: u32, length: u32, content: &str, origin: &str) -> Self {
        Self {
            operation_type: TextOpType::Replace,
            position,
            content: content.to_string(),
            length,
            origin: origin.to_string(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
        }
    }
    
    /// Apply operation to document
    pub fn apply(&self, doc: &mut CollabDocument) -> Result<()> {
        match self.operation_type {
            TextOpType::Insert => doc.insert(self.position, &self.content)?,
            TextOpType::Delete => doc.delete(self.position, self.length)?,
            TextOpType::Replace => doc.replace(self.position, self.length, &self.content)?,
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_document_operations() {
        let mut doc = CollabDocument::new("test");
        assert!(doc.is_empty());
        
        doc.insert(0, "Hello").unwrap();
        assert_eq!(doc.get_content(), "Hello");
        
        doc.insert(5, " World").unwrap();
        assert_eq!(doc.get_content(), "Hello World");
        
        doc.delete(5, 6).unwrap();
        assert_eq!(doc.get_content(), "Hello");
    }
    
    #[test]
    fn test_sync_protocol() {
        let mut doc1 = CollabDocument::new("doc1");
        doc1.set_content("Hello World").unwrap();
        
        // Get state vector from doc1
        let sv = SyncProtocol::create_sync_step1(&doc1);
        
        // Create doc2 and sync
        let mut doc2 = CollabDocument::new("doc2");
        let update = SyncProtocol::create_sync_step2(&doc1, &sv).unwrap();
        SyncProtocol::apply_sync_update(&mut doc2, &update).unwrap();
        
        assert_eq!(doc1.get_content(), doc2.get_content());
    }
}
