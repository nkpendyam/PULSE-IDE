use crate::agent_editor::tools::FileOperation;
use crate::agent_editor::approval::DiffLineType;
// Edit Executor - Safely executes file edits with rollback support

use super::*;
use crate::agent_editor::tools::{FileEditor, EditOperation, EditResult};

use anyhow::{Result, Context};
use std::path::PathBuf;
use std::collections::HashMap;
use tokio::sync::RwLock;
use std::sync::Arc;

/// Edit executor with transaction support
pub struct EditExecutor {
    editor: FileEditor,
    config: AgentConfig,
    rollback_log: Arc<RwLock<HashMap<String, RollbackInfo>>>,
}

impl EditExecutor {
    pub fn new(config: AgentConfig) -> Self {
        Self {
            editor: FileEditor::new(),
            config,
            rollback_log: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Execute a single edit with rollback support
    pub async fn execute_edit(&self, edit: &FileEdit) -> Result<EditResult> {
        // Validate edit
        self.validate_edit(edit)?;

        // Create rollback point
        let rollback = self.create_rollback(edit).await?;

        // Execute edit
        let result = match edit.operation {
            FileOperation::Create => {
                self.editor.create(&edit.path, &edit.new_content).await?;
                EditResult {
                    path: edit.path.clone(),
                    applied: vec![],
                    failed: vec![],
                    diff: edit.diff.clone(),
                    backup_path: None,
                }
            }
            FileOperation::Modify => {
                let edits = self.extract_edits(edit)?;
                self.editor.edit(&edit.path, &edits).await?
            }
            FileOperation::Delete => {
                // Save rollback info before delete
                if let Some(old) = &edit.old_content {
                    let backup_path = format!("{}.deleted", edit.path);
                    tokio::fs::write(&backup_path, old).await?;
                }
                tokio::fs::remove_file(&edit.path).await?;
                EditResult {
                    path: edit.path.clone(),
                    applied: vec![],
                    failed: vec![],
                    diff: vec![],
                    backup_path: Some(format!("{}.deleted", edit.path)),
                }
            }
            FileOperation::Rename => {
                // For rename, new_content is the new path
                if let Some(old_path) = &edit.old_content {
                    tokio::fs::rename(old_path, &edit.new_content).await?;
                }
                EditResult {
                    path: edit.new_content.clone(),
                    applied: vec![],
                    failed: vec![],
                    diff: vec![],
                    backup_path: None,
                }
            }
        };

        // Store rollback info
        if self.config.enable_rollback {
            self.rollback_log.write().await.insert(edit.path.clone(), rollback);
        }

        Ok(result)
    }

    /// Execute multiple edits as a transaction
    pub async fn execute_transaction(&self, edits: &[FileEdit]) -> Result<Vec<EditResult>> {
        let mut results = Vec::new();
        let mut executed = Vec::new();

        for edit in edits {
            match self.execute_edit(edit).await {
                Ok(result) => {
                    executed.push(edit.path.clone());
                    results.push(result);
                }
                Err(e) => {
                    // Rollback on failure
                    if self.config.enable_rollback {
                        log::warn!("Edit failed, rolling back {} files: {}", executed.len(), e);
                        self.rollback(&executed).await?;
                    }
                    return Err(e);
                }
            }
        }

        Ok(results)
    }

    /// Rollback changes
    pub async fn rollback(&self, paths: &[String]) -> Result<()> {
        let log = self.rollback_log.read().await;

        for path in paths {
            if let Some(rollback) = log.get(path) {
                self.apply_rollback(rollback).await?;
                log::info!("Rolled back: {}", path);
            }
        }

        Ok(())
    }

    /// Validate an edit operation
    fn validate_edit(&self, edit: &FileEdit) -> Result<()> {
        let path = PathBuf::from(&edit.path);

        // Check blocked patterns
        for pattern in &self.config.blocked_patterns {
            if glob_match::glob_match(pattern, &edit.path) {
                anyhow::bail!("Path {} matches blocked pattern {}", edit.path, pattern);
            }
        }

        // Check file size for modifications
        if edit.operation == FileOperation::Modify && path.exists() {
            let metadata = std::fs::metadata(&path)?;
            if metadata.len() > self.config.max_file_size {
                anyhow::bail!("File {} exceeds size limit", edit.path);
            }
        }

        // Check allowed patterns
        let allowed = self.config.allowed_patterns.iter()
            .any(|pattern| glob_match::glob_match(pattern, &edit.path));

        if !allowed {
            anyhow::bail!("Path {} does not match any allowed pattern", edit.path);
        }

        Ok(())
    }

    /// Create rollback info before edit
    async fn create_rollback(&self, edit: &FileEdit) -> Result<RollbackInfo> {
        let path = PathBuf::from(&edit.path);

        let (exists, content, metadata) = if path.exists() {
            let content = tokio::fs::read_to_string(&path).await?;
            let metadata = tokio::fs::metadata(&path).await?;
            (true, Some(content), Some(metadata))
        } else {
            (false, None, None)
        };

        Ok(RollbackInfo {
            path: edit.path.clone(),
            operation: edit.operation.clone(),
            original_content: content,
            original_exists: exists,
            original_metadata: metadata.map(|m| FileMeta {
                modified: m.modified().ok(),
                permissions: m.permissions().mode(),
            }),
            timestamp: std::time::SystemTime::now(),
        })
    }

    /// Apply rollback
    async fn apply_rollback(&self, rollback: &RollbackInfo) -> Result<()> {
        let path = PathBuf::from(&rollback.path);

        match rollback.operation {
            FileOperation::Create => {
                // Created file should be deleted
                if path.exists() {
                    tokio::fs::remove_file(&path).await?;
                }
            }
            FileOperation::Modify | FileOperation::Delete => {
                // Restore original content
                if let Some(content) = &rollback.original_content {
                    tokio::fs::write(&path, content).await?;

                    // Restore metadata if available
                    if let Some(meta) = &rollback.original_metadata {
                        // Note: Full metadata restoration would require platform-specific code
                        log::debug!("Would restore metadata for {}", rollback.path);
                    }
                } else if rollback.original_exists {
                    // File existed but was empty or we couldn't read it
                    tokio::fs::write(&path, "").await?;
                } else {
                    // File didn't exist originally
                    if path.exists() {
                        tokio::fs::remove_file(&path).await?;
                    }
                }
            }
            FileOperation::Rename => {
                // Reverse the rename
                if let Some(old_path) = &rollback.original_content {
                    if path.exists() {
                        tokio::fs::rename(&path, old_path).await?;
                    }
                }
            }
        }

        Ok(())
    }

    /// Extract edit operations from file edit
    fn extract_edits(&self, edit: &FileEdit) -> Result<Vec<EditOperation>> {
        // Parse diff hunks to create edit operations
        let mut edits = Vec::new();

        for hunk in &edit.diff {
            let mut current_start = hunk.new_start;
            let mut current_end = hunk.new_start;
            let mut new_content = String::new();

            for line in &hunk.lines {
                match line.line_type {
                    DiffLineType::Context => {
                        current_end = line.new_line.unwrap_or(current_end);
                    }
                    DiffLineType::Addition => {
                        new_content.push_str(&line.content);
                        new_content.push('\n');
                    }
                    DiffLineType::Deletion => {
                        // Track deleted lines
                    }
                }
            }

            if !new_content.is_empty() {
                edits.push(EditOperation {
                    start_line: current_start,
                    end_line: current_end,
                    new_content,
                });
            }
        }

        Ok(edits)
    }

    /// Clear rollback log
    pub async fn clear_rollback_log(&self) {
        self.rollback_log.write().await.clear();
    }

    /// Get rollback info for a file
    pub async fn get_rollback_info(&self, path: &str) -> Option<RollbackInfo> {
        self.rollback_log.read().await.get(path).cloned()
    }
}

/// Rollback information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RollbackInfo {
    pub path: String,
    pub operation: FileOperation,
    pub original_content: Option<String>,
    pub original_exists: bool,
    pub original_metadata: Option<FileMeta>,
    pub timestamp: std::time::SystemTime,
}

/// File metadata for restoration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMeta {
    pub modified: Option<std::time::SystemTime>,
    pub permissions: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_executor_creation() {
        let config = AgentConfig::default();
        let executor = EditExecutor::new(config);
        assert!(executor.config.enable_rollback);
    }
}



