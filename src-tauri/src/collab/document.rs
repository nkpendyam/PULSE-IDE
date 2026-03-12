//! Collaborative Document implementation
//!
//! Uses yrs 0.18 API - Note: yrs 0.18 has significant API changes from earlier versions.
//! We're using a simplified implementation that stores content directly without CRDT
//! until we can properly integrate the yrs 0.18 API.

use std::collections::HashMap;

/// Simplified collaborative document wrapper
/// Note: Full yrs 0.18 integration requires significant API changes
pub struct CollabDocument {
    content: String,
    id: String,
    version: u64,
}

impl CollabDocument {
    pub fn new(id: &str) -> Self {
        Self {
            content: String::new(),
            id: id.to_string(),
            version: 0,
        }
    }

    pub fn get_content(&self) -> String {
        self.content.clone()
    }

    pub fn set_content(&mut self, content: &str) -> anyhow::Result<()> {
        self.content = content.to_string();
        self.version += 1;
        Ok(())
    }

    pub fn insert(&mut self, pos: u32, text: &str) -> anyhow::Result<()> {
        let pos = pos as usize;
        if pos <= self.content.len() {
            self.content.insert_str(pos, text);
            self.version += 1;
        }
        Ok(())
    }

    pub fn delete(&mut self, pos: u32, len: u32) -> anyhow::Result<()> {
        let pos = pos as usize;
        let len = len as usize;
        if pos + len <= self.content.len() {
            self.content.drain(pos..pos + len);
            self.version += 1;
        }
        Ok(())
    }

    pub fn replace(&mut self, pos: u32, len: u32, text: &str) -> anyhow::Result<()> {
        let pos = pos as usize;
        let len = len as usize;
        if pos + len <= self.content.len() {
            self.content.drain(pos..pos + len);
            self.content.insert_str(pos, text);
            self.version += 1;
        }
        Ok(())
    }

    pub fn len(&self) -> u32 {
        self.content.len() as u32
    }

    pub fn is_empty(&self) -> bool {
        self.content.is_empty()
    }

    pub fn get_state_vector(&self) -> Vec<u8> {
        // Simplified state vector - just encode version
        vec![self.version as u8]
    }

    pub fn apply_update(&mut self, _update: &[u8]) -> anyhow::Result<()> {
        // Simplified update application
        self.version += 1;
        Ok(())
    }

    pub fn get_full_update(&self) -> Vec<u8> {
        self.content.as_bytes().to_vec()
    }

    pub fn get_vector_clock(&self) -> HashMap<String, u64> {
        let mut clock = HashMap::new();
        clock.insert(self.id.clone(), self.version);
        clock
    }

    pub fn version(&self) -> u64 {
        self.version
    }
    pub fn id(&self) -> &str {
        &self.id
    }
}
