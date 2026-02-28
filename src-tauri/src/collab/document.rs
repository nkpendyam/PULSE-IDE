//! Collaborative Document implementation

use std::collections::HashMap;
use yrs::{Doc, Text, TextRef, Transact, ReadTxn, StateVector, Update};
use yrs::updates::encoder::Encode;
use yrs::updates::decoder::Decode;
use serde::{Deserialize, Serialize};
use anyhow::Result;

/// Collaborative document wrapper
pub struct CollabDocument {
    doc: Doc,
    text: TextRef,
    id: String,
    version: u64,
}

impl CollabDocument {
    pub fn new(id: &str) -> Self {
        let doc = Doc::new();
        let text = doc.get_or_insert_text("content");
        Self { doc, text, id: id.to_string(), version: 0 }
    }
    
    pub fn get_content(&self) -> String {
        let txn = self.doc.transact();
        self.text.get_string(&txn)
    }
    
    pub fn set_content(&mut self, content: &str) -> anyhow::Result<()> {
        let mut txn = self.doc.transact_mut();
        let len = self.text.len(&txn);
        self.text.remove_range(&mut txn, 0, len);
        self.text.insert(&mut txn, 0, content);
        self.version += 1;
        Ok(())
    }
    
    pub fn insert(&mut self, pos: u32, text: &str) -> anyhow::Result<()> {
        let mut txn = self.doc.transact_mut();
        self.text.insert(&mut txn, pos, text);
        self.version += 1;
        Ok(())
    }
    
    pub fn delete(&mut self, pos: u32, len: u32) -> anyhow::Result<()> {
        let mut txn = self.doc.transact_mut();
        self.text.remove_range(&mut txn, pos, len);
        self.version += 1;
        Ok(())
    }
    
    pub fn replace(&mut self, pos: u32, len: u32, text: &str) -> anyhow::Result<()> {
        let mut txn = self.doc.transact_mut();
        self.text.remove_range(&mut txn, pos, len);
        self.text.insert(&mut txn, pos, text);
        self.version += 1;
        Ok(())
    }
    
    pub fn len(&self) -> u32 {
        let txn = self.doc.transact();
        self.text.len(&txn)
    }
    
    pub fn is_empty(&self) -> bool { self.len() == 0 }
    
    pub fn get_state_vector(&self) -> Vec<u8> {
        let txn = self.doc.transact();
        txn.state_vector().encode_v1()
    }
    
    pub fn apply_update(&mut self, update: &[u8]) -> anyhow::Result<()> {
        let update = Update::decode_v1(update)
            .map_err(|e| anyhow::anyhow!("Failed to decode update: {:?}", e))?;
        let mut txn = self.doc.transact_mut();
        txn.apply_update(update);
        self.version += 1;
        Ok(())
    }
    
    pub fn get_full_update(&self) -> Vec<u8> {
        let txn = self.doc.transact();
        txn.encode_v1()
    }
    
    pub fn get_vector_clock(&self) -> HashMap<String, u64> {
        let mut clock = HashMap::new();
        clock.insert(self.id.clone(), self.version);
        clock
    }
    
    pub fn version(&self) -> u64 { self.version }
    pub fn id(&self) -> &str { &self.id }
}
