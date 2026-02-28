//! Agent Tools - File Operations
//!
//! Tools for reading, writing, and editing files

use super::*;
use serde::{Deserialize, Serialize};
use crate::agent_editor::approval::{DiffHunk, DiffLine, DiffLineType};

/// Agent tools registry
pub struct AgentTools {
    file_editor: FileEditor,
}

impl AgentTools {
    pub fn new() -> Self {
        Self {
            file_editor: FileEditor::new(),
        }
    }

    /// Read a file
    pub async fn read_file(&self, path: &str) -> anyhow::Result<FileContent> {
        self.file_editor.read(path).await
    }

    /// Write a file
    pub async fn write_file(&self, path: &str, content: &str) -> anyhow::Result<()> {
        self.file_editor.write(path, content).await
    }

    /// Edit a file
    pub async fn edit_file(&self, path: &str, edits: &[EditOperation]) -> anyhow::Result<EditResult> {
        self.file_editor.edit(path, edits).await
    }

    /// Create a file
    pub async fn create_file(&self, path: &str, content: &str) -> anyhow::Result<()> {
        self.file_editor.create(path, content).await
    }

    /// Compute diff between two texts
    pub fn compute_diff(&self, old: &str, new: &str) -> Vec<DiffHunk> {
        self.file_editor.compute_diff(old, new)
    }
}

impl Default for AgentTools {
    fn default() -> Self {
        Self::new()
    }
}

/// File editor operations
pub struct FileEditor {
    max_file_size: u64,
}

impl FileEditor {
    pub fn new() -> Self {
        Self {
            max_file_size: 10_000_000, // 10MB
        }
    }

    pub async fn read(&self, path: &str) -> anyhow::Result<FileContent> {
        let path = std::path::Path::new(path);

        // Check file exists
        if !path.exists() {
            anyhow::bail!("File does not exist: {}", path.display());
        }

        // Check file size
        let metadata = std::fs::metadata(path)?;
        if metadata.len() > self.max_file_size {
            anyhow::bail!("File too large: {} bytes", metadata.len());
        }

        // Read content
        let content = tokio::fs::read_to_string(path).await?;

        // Detect language
        let language = self.detect_language(path);

        // Count lines
        let lines = content.lines().count();

        Ok(FileContent {
            path: path.to_string_lossy().to_string(),
            content,
            language,
            line_count: lines,
        })
    }

    pub async fn write(&self, path: &str, content: &str) -> anyhow::Result<()> {
        let path = std::path::Path::new(path);

        // Create parent directories if needed
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        // Write file
        tokio::fs::write(path, content).await?;

        log::info!("Wrote {} bytes to {}", content.len(), path.display());
        Ok(())
    }

    pub async fn edit(&self, path: &str, edits: &[EditOperation]) -> anyhow::Result<EditResult> {
        let path = std::path::Path::new(path);

        // Read current content
        let old_content = tokio::fs::read_to_string(path).await?;
        let old_lines: Vec<&str> = old_content.lines().collect();

        // Create backup
        let backup_path = format!("{}.backup", path.display());
        tokio::fs::write(&backup_path, &old_content).await?;

        // Apply edits
        let mut new_lines = old_lines.clone();
        let mut applied = Vec::new();
        let mut failed = Vec::new();

        // Sort edits by line number (descending) to preserve indices
        let mut sorted_edits: Vec<_> = edits.iter().enumerate().collect();
        sorted_edits.sort_by(|a, b| b.1.start_line.cmp(&a.1.start_line));

        for (idx, edit) in sorted_edits {
            let start = edit.start_line.saturating_sub(1); // 0-index
            let end = edit.end_line.saturating_sub(1);

            if start >= new_lines.len() {
                failed.push(EditFailure {
                    edit_index: idx,
                    reason: format!("Start line {} out of bounds", edit.start_line),
                });
                continue;
            }

            let end = end.min(new_lines.len().saturating_sub(1));

            // Replace lines
            let new_content_lines: Vec<&str> = edit.new_content.lines().collect();
            new_lines.splice(start..=end, new_content_lines);

            applied.push(EditApplied {
                edit_index: idx,
                lines_removed: end - start + 1,
                lines_added: edit.new_content.lines().count(),
            });
        }

        // Write new content
        let new_content = new_lines.join("\n");
        tokio::fs::write(path, &new_content).await?;

        // Compute diff
        let diff = self.compute_diff(&old_content, &new_content);

        Ok(EditResult {
            path: path.to_string_lossy().to_string(),
            applied,
            failed,
            diff,
            backup_path: Some(backup_path),
        })
    }

    pub async fn create(&self, path: &str, content: &str) -> anyhow::Result<()> {
        let path = std::path::Path::new(path);

        if path.exists() {
            anyhow::bail!("File already exists: {}", path.display());
        }

        // Create parent directories
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        // Write file
        tokio::fs::write(path, content).await?;

        log::info!("Created file: {}", path.display());
        Ok(())
    }

    fn detect_language(&self, path: &std::path::Path) -> String {
        path.extension()
            .and_then(|e| e.to_str())
            .map(|e| match e {
                "rs" => "rust",
                "py" => "python",
                "js" => "javascript",
                "ts" => "typescript",
                "tsx" => "typescriptreact",
                "jsx" => "javascriptreact",
                "go" => "go",
                "java" => "java",
                "cpp" | "cc" | "cxx" => "cpp",
                "c" => "c",
                "h" => "c",
                "hpp" => "cpp",
                "rb" => "ruby",
                "php" => "php",
                "swift" => "swift",
                "kt" => "kotlin",
                "scala" => "scala",
                "rs" => "rust",
                "json" => "json",
                "yaml" | "yml" => "yaml",
                "toml" => "toml",
                "md" => "markdown",
                "html" => "html",
                "css" => "css",
                "scss" => "scss",
                "sql" => "sql",
                "sh" => "shell",
                "bash" => "shell",
                _ => "plaintext",
            })
            .unwrap_or("plaintext")
            .to_string()
    }

    /// Compute unified diff
    pub fn compute_diff(&self, old: &str, new: &str) -> Vec<DiffHunk> {
        let old_lines: Vec<&str> = old.lines().collect();
        let new_lines: Vec<&str> = new.lines().collect();

        let mut hunks = Vec::new();
        let mut current_hunk: Option<DiffHunk> = None;

        // Simple line-by-line diff (would use patience diff or similar in production)
        let mut old_idx = 0;
        let mut new_idx = 0;

        while old_idx < old_lines.len() || new_idx < new_lines.len() {
            if old_idx >= old_lines.len() {
                // Addition
                if current_hunk.is_none() {
                    current_hunk = Some(DiffHunk {
                        old_start: old_idx + 1,
                        old_lines: 0,
                        new_start: new_idx + 1,
                        new_lines: 0,
                        lines: Vec::new(),
                    });
                }

                current_hunk.as_mut().unwrap().lines.push(DiffLine {
                    line_type: DiffLineType::Addition,
                    content: new_lines[new_idx].to_string(),
                    old_line: None,
                    new_line: Some(new_idx + 1),
                });
                current_hunk.as_mut().unwrap().new_lines += 1;
                new_idx += 1;
            } else if new_idx >= new_lines.len() {
                // Deletion
                if current_hunk.is_none() {
                    current_hunk = Some(DiffHunk {
                        old_start: old_idx + 1,
                        old_lines: 0,
                        new_start: new_idx + 1,
                        new_lines: 0,
                        lines: Vec::new(),
                    });
                }

                current_hunk.as_mut().unwrap().lines.push(DiffLine {
                    line_type: DiffLineType::Deletion,
                    content: old_lines[old_idx].to_string(),
                    old_line: Some(old_idx + 1),
                    new_line: None,
                });
                current_hunk.as_mut().unwrap().old_lines += 1;
                old_idx += 1;
            } else if old_lines[old_idx] == new_lines[new_idx] {
                // Context
                if let Some(hunk) = &mut current_hunk {
                    // End hunk after 3 context lines
                    if hunk.lines.iter().rev().take(3).all(|l| l.line_type == DiffLineType::Context) {
                        hunks.push(hunk.clone());
                        current_hunk = None;
                    } else {
                        hunk.lines.push(DiffLine {
                            line_type: DiffLineType::Context,
                            content: old_lines[old_idx].to_string(),
                            old_line: Some(old_idx + 1),
                            new_line: Some(new_idx + 1),
                        });
                    }
                }
                old_idx += 1;
                new_idx += 1;
            } else {
                // Different - check if addition or deletion
                if current_hunk.is_none() {
                    current_hunk = Some(DiffHunk {
                        old_start: old_idx + 1,
                        old_lines: 0,
                        new_start: new_idx + 1,
                        new_lines: 0,
                        lines: Vec::new(),
                    });
                }

                // Check for addition
                if old_idx + 1 < old_lines.len() && old_lines[old_idx + 1] == new_lines[new_idx] {
                    // Deletion
                    current_hunk.as_mut().unwrap().lines.push(DiffLine {
                        line_type: DiffLineType::Deletion,
                        content: old_lines[old_idx].to_string(),
                        old_line: Some(old_idx + 1),
                        new_line: None,
                    });
                    current_hunk.as_mut().unwrap().old_lines += 1;
                    old_idx += 1;
                } else if new_idx + 1 < new_lines.len() && new_lines[new_idx + 1] == old_lines[old_idx] {
                    // Addition
                    current_hunk.as_mut().unwrap().lines.push(DiffLine {
                        line_type: DiffLineType::Addition,
                        content: new_lines[new_idx].to_string(),
                        old_line: None,
                        new_line: Some(new_idx + 1),
                    });
                    current_hunk.as_mut().unwrap().new_lines += 1;
                    new_idx += 1;
                } else {
                    // Both changed
                    current_hunk.as_mut().unwrap().lines.push(DiffLine {
                        line_type: DiffLineType::Deletion,
                        content: old_lines[old_idx].to_string(),
                        old_line: Some(old_idx + 1),
                        new_line: None,
                    });
                    current_hunk.as_mut().unwrap().old_lines += 1;

                    current_hunk.as_mut().unwrap().lines.push(DiffLine {
                        line_type: DiffLineType::Addition,
                        content: new_lines[new_idx].to_string(),
                        old_line: None,
                        new_line: Some(new_idx + 1),
                    });
                    current_hunk.as_mut().unwrap().new_lines += 1;

                    old_idx += 1;
                    new_idx += 1;
                }
            }
        }

        if let Some(hunk) = current_hunk {
            hunks.push(hunk);
        }

        hunks
    }
}

impl Default for FileEditor {
    fn default() -> Self {
        Self::new()
    }
}

/// File content result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileContent {
    pub path: String,
    pub content: String,
    pub language: String,
    pub line_count: usize,
}

/// Edit operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditOperation {
    pub start_line: usize,
    pub end_line: usize,
    pub new_content: String,
}

/// Edit result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditResult {
    pub path: String,
    pub applied: Vec<EditApplied>,
    pub failed: Vec<EditFailure>,
    pub diff: Vec<DiffHunk>,
    pub backup_path: Option<String>,
}

/// Applied edit info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditApplied {
    pub edit_index: usize,
    pub lines_removed: usize,
    pub lines_added: usize,
}

/// Failed edit info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditFailure {
    pub edit_index: usize,
    pub reason: String,
}

/// File edit for approval
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEdit {
    pub path: String,
    pub operation: FileOperation,
    pub old_content: Option<String>,
    pub new_content: String,
    pub diff: Vec<DiffHunk>,
}

/// File operation type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum FileOperation {
    Create,
    Modify,
    Delete,
    Rename,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_diff() {
        let editor = FileEditor::new();

        let old = "line1\nline2\nline3\nline4";
        let new = "line1\nline2_modified\nline3\nline4\nline5";

        let hunks = editor.compute_diff(old, new);

        assert!(!hunks.is_empty());
    }

    #[test]
    fn test_detect_language() {
        let editor = FileEditor::new();

        assert_eq!(editor.detect_language(std::path::Path::new("test.rs")), "rust");
        assert_eq!(editor.detect_language(std::path::Path::new("test.py")), "python");
        assert_eq!(editor.detect_language(std::path::Path::new("test.ts")), "typescript");
    }
}
