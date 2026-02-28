//! Local History - Time-machine for file changes
//!
//! Tracks file changes locally without git, allowing undo of saves

use std::collections::HashMap;
use std::path::PathBuf;
use std::fs;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use anyhow::Result;

/// Local history manager
pub struct LocalHistory {
    history_dir: PathBuf,
    max_entries_per_file: usize,
    max_age_days: u32,
    history: HashMap<String, Vec<FileSnapshot>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSnapshot {
    pub id: String,
    pub path: String,
    pub timestamp: DateTime<Utc>,
    pub content_hash: String,
    pub content_path: PathBuf,
    pub size: u64,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub snapshot: FileSnapshot,
    pub diff_summary: Option<String>,
}

impl LocalHistory {
    pub fn new(history_dir: PathBuf) -> Self {
        std::fs::create_dir_all(&history_dir).ok();
        
        Self {
            history_dir,
            max_entries_per_file: 100,
            max_age_days: 30,
            history: HashMap::new(),
        }
    }
    
    /// Record a file save
    pub fn record_save(&mut self, path: &str, content: &str) -> Result<FileSnapshot> {
        let content_hash = self.hash_content(content);
        
        // Check if content changed
        if let Some(snapshots) = self.history.get(path) {
            if let Some(last) = snapshots.last() {
                if last.content_hash == content_hash {
                    return Ok(last.clone());
                }
            }
        }
        
        let timestamp = Utc::now();
        let id = format!("{}_{}", 
            timestamp.format("%Y%m%d_%H%M%S"),
            &content_hash[..8]
        );
        
        // Save content to history file
        let content_path = self.history_dir
            .join("content")
            .join(&id);
        
        std::fs::create_dir_all(content_path.parent().unwrap_or_default()).ok();
        std::fs::write(&content_path, content)?;
        
        let snapshot = FileSnapshot {
            id: id.clone(),
            path: path.to_string(),
            timestamp,
            content_hash,
            content_path,
            size: content.len() as u64,
            label: None,
        };
        
        // Add to history
        let snapshots = self.history.entry(path.to_string()).or_default();
        snapshots.push(snapshot.clone());
        
        // Trim old entries
        if snapshots.len() > self.max_entries_per_file {
            let to_remove = snapshots.len() - self.max_entries_per_file;
            for old in snapshots.drain(0..to_remove) {
                let _ = std::fs::remove_file(&old.content_path);
            }
        }
        
        // Save history index
        self.save_index()?;
        
        Ok(snapshot)
    }
    
    /// Get history for a file
    pub fn get_history(&self, path: &str) -> Vec<&FileSnapshot> {
        self.history.get(path)
            .map(|s| s.iter().collect())
            .unwrap_or_default()
    }
    
    /// Get snapshot content
    pub fn get_content(&self, snapshot_id: &str) -> Result<String> {
        let content_path = self.history_dir
            .join("content")
            .join(snapshot_id);
        
        fs::read_to_string(content_path).map_err(Into::into)
    }
    
    /// Restore a snapshot
    pub fn restore(&self, snapshot: &FileSnapshot, target_path: &str) -> Result<()> {
        let content = self.get_content(&snapshot.id)?;
        fs::write(target_path, content)?;
        Ok(())
    }
    
    /// Label a snapshot
    pub fn label_snapshot(&mut self, path: &str, snapshot_id: &str, label: &str) -> Result<()> {
        if let Some(snapshots) = self.history.get_mut(path) {
            if let Some(snapshot) = snapshots.iter_mut().find(|s| s.id == snapshot_id) {
                snapshot.label = Some(label.to_string());
                self.save_index()?;
            }
        }
        Ok(())
    }
    
    /// Delete a snapshot
    pub fn delete_snapshot(&mut self, path: &str, snapshot_id: &str) -> Result<()> {
        if let Some(snapshots) = self.history.get_mut(path) {
            if let Some(idx) = snapshots.iter().position(|s| s.id == snapshot_id) {
                let snapshot = snapshots.remove(idx);
                let _ = std::fs::remove_file(&snapshot.content_path);
                self.save_index()?;
            }
        }
        Ok(())
    }
    
    /// Clear all history for a file
    pub fn clear_file_history(&mut self, path: &str) -> Result<()> {
        if let Some(snapshots) = self.history.remove(path) {
            for snapshot in snapshots {
                let _ = std::fs::remove_file(&snapshot.content_path);
            }
            self.save_index()?;
        }
        Ok(())
    }
    
    /// Clear all history
    pub fn clear_all(&mut self) -> Result<()> {
        for snapshots in self.history.values() {
            for snapshot in snapshots {
                let _ = std::fs::remove_file(&snapshot.content_path);
            }
        }
        self.history.clear();
        self.save_index()?;
        Ok(())
    }
    
    /// Clean old entries based on age
    pub fn clean_old_entries(&mut self) -> Result<usize> {
        let cutoff = Utc::now() - chrono::Duration::days(self.max_age_days as i64);
        let mut removed = 0;
        
        for snapshots in self.history.values_mut() {
            let before = snapshots.len();
            snapshots.retain(|s| s.timestamp > cutoff);
            removed += before - snapshots.len();
        }
        
        if removed > 0 {
            self.save_index()?;
        }
        
        Ok(removed)
    }
    
    /// Get diff between two snapshots
    pub fn get_diff(&self, old_id: &str, new_id: &str) -> Result<String> {
        let old_content = self.get_content(old_id)?;
        let new_content = self.get_content(new_id)?;
        
        // Simple line-based diff
        let old_lines: Vec<&str> = old_content.lines().collect();
        let new_lines: Vec<&str> = new_content.lines().collect();
        
        let mut diff = String::new();
        
        // Find changes using simple comparison
        let max_lines = old_lines.len().max(new_lines.len());
        
        for i in 0..max_lines {
            let old_line = old_lines.get(i);
            let new_line = new_lines.get(i);
            
            match (old_line, new_line) {
                (Some(o), Some(n)) if o != n => {
                    diff.push_str(&format!("- {}\n", o));
                    diff.push_str(&format!("+ {}\n", n));
                }
                (Some(o), None) => {
                    diff.push_str(&format!("- {}\n", o));
                }
                (None, Some(n)) => {
                    diff.push_str(&format!("+ {}\n", n));
                }
                (Some(_), Some(_)) => {
                    // Lines are the same, skip in diff
                }
                (None, None) => {}
            }
        }
        
        Ok(diff)
    }
    
    /// Save history index to disk
    fn save_index(&self) -> Result<()> {
        let index_path = self.history_dir.join("index.json");
        let content = serde_json::to_string(&self.history)?;
        fs::write(index_path, content)?;
        Ok(())
    }
    
    /// Load history index from disk
    pub fn load_index(&mut self) -> Result<()> {
        let index_path = self.history_dir.join("index.json");
        
        if index_path.exists() {
            let content = fs::read_to_string(index_path)?;
            self.history = serde_json::from_str(&content)?;
        }
        
        Ok(())
    }
    
    /// Hash content for deduplication
    fn hash_content(&self, content: &str) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        content.hash(&mut hasher);
        format!("{:x}", hasher.finish())
    }
    
    /// Get statistics
    pub fn stats(&self) -> HistoryStats {
        let total_snapshots: usize = self.history.values().map(|v| v.len()).sum();
        let total_size: u64 = self.history.values()
            .flat_map(|v| v.iter().map(|s| s.size))
            .sum();
        
        HistoryStats {
            files_tracked: self.history.len(),
            total_snapshots,
            total_size_bytes: total_size,
            history_dir: self.history_dir.clone(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryStats {
    pub files_tracked: usize,
    pub total_snapshots: usize,
    pub total_size_bytes: u64,
    pub history_dir: PathBuf,
}

impl Default for LocalHistory {
    fn default() -> Self {
        let history_dir = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("kro_ide")
            .join("local_history");
        
        Self::new(history_dir)
    }
}
