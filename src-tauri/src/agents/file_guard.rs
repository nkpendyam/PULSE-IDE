//! File Access Guard
//!
//! Enforces whitelist-only file access for agents.
//! Prevents modification of README, docs, and other protected files.

use std::path::{Path, PathBuf};
use regex::Regex;

use crate::agents::AgentError;

/// Default allowed paths for agent writes
pub const DEFAULT_ALLOWED_PATHS: &[&str] = &[
    "src/",
    "src-tauri/src/",
    "src-tauri/tests/",
    "Cargo.toml",
    "package.json",
    "tsconfig.json",
    "tailwind.config.js",
    "tailwind.config.ts",
    "vite.config.ts",
    "vite.config.js",
    "index.html",
];

/// Forbidden paths (never allowed)
pub const FORBIDDEN_PATHS: &[&str] = &[
    "README.md",
    "readme.md",
    "README",
    "README.*",
    "website/",
    "docs/",
    ".github/",
    "LICENSE",
    "LICENSE.*",
    "CHANGELOG.md",
    "CHANGELOG",
    ".git/",
    "node_modules/",
    "target/",
    "dist/",
    "build/",
    ".env",
    ".env.*",
    "*.lock",
    "*.log",
    "worklog.md",
    "AGENT_MEMORY.json",
    "kyro-status.json",
    "PROJECT_STATUS.md",
];

/// File access result
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileAccess {
    /// Access granted
    Allowed,
    /// Access denied - path not in whitelist
    NotWhitelisted,
    /// Access denied - path is explicitly forbidden
    Forbidden,
    /// Access denied - looks like website content
    SuspiciousContent,
}

/// File guard for access control
pub struct FileGuard {
    allowed_paths: Vec<String>,
    forbidden_patterns: Vec<Regex>,
    strict_mode: bool,
}

impl Default for FileGuard {
    fn default() -> Self {
        Self::new(DEFAULT_ALLOWED_PATHS, FORBIDDEN_PATHS, true)
    }
}

impl FileGuard {
    /// Create new file guard with custom paths
    pub fn new(allowed: &[&str], forbidden: &[&str], strict: bool) -> Self {
        let forbidden_patterns: Vec<Regex> = forbidden
            .iter()
            .filter_map(|pattern| {
                // Convert glob pattern to regex
                let regex_pattern = pattern
                    .replace(".", r"\.")
                    .replace("*", ".*")
                    .replace("?", ".");
                Regex::new(&format!("(?i)^{}$", regex_pattern)).ok()
            })
            .collect();

        Self {
            allowed_paths: allowed.iter().map(|s| s.to_string()).collect(),
            forbidden_patterns,
            strict_mode: strict,
        }
    }

    /// Check if a path is allowed for writing
    pub fn check_write(&self, path: &str) -> Result<FileAccess, AgentError> {
        let normalized = self.normalize_path(path);

        // Step 1: Check forbidden patterns first
        for pattern in &self.forbidden_patterns {
            if pattern.is_match(&normalized) {
                log::warn!("File access DENIED (forbidden): {}", path);
                return Ok(FileAccess::Forbidden);
            }
        }

        // Check if path contains forbidden components
        for forbidden in FORBIDDEN_PATHS {
            let forbidden_clean = forbidden.trim_end_matches('/').trim_end_matches('*');
            if normalized.contains(forbidden_clean) {
                log::warn!("File access DENIED (contains forbidden): {}", path);
                return Ok(FileAccess::Forbidden);
            }
        }

        // Step 2: Check allowed paths
        let is_allowed = self.allowed_paths.iter().any(|allowed| {
            if allowed.ends_with('/') {
                normalized.starts_with(allowed) || normalized.starts_with(&allowed.trim_end_matches('/'))
            } else {
                normalized == *allowed || normalized.starts_with(&format!("{}/", allowed))
            }
        });

        if !is_allowed && self.strict_mode {
            log::warn!("File access DENIED (not whitelisted): {}", path);
            return Ok(FileAccess::NotWhitelisted);
        }

        log::debug!("File access ALLOWED: {}", path);
        Ok(FileAccess::Allowed)
    }

    /// Check if content looks like valid code (not website/marketing)
    pub fn check_content(&self, content: &str, filename: &str) -> Result<FileAccess, AgentError> {
        // Skip content check for non-code files
        let extension = Path::new(filename)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");

        if !["ts", "tsx", "js", "jsx", "rs", "py", "json", "toml", "yaml", "yml"].contains(&extension) {
            return Ok(FileAccess::Allowed);
        }

        // Suspicious patterns for non-code content
        let suspicious_patterns = [
            // Marketing/website content
            (r"(?i)(deploy|hosting|netlify|vercel|github\.io|pages)", "hosting reference"),
            (r"(?i)(seo|meta\s*tag|google\s*analytics)", "marketing content"),
            (r"(?i)(landing\s*page|hero\s*section|cta|call\s*to\s*action)", "landing page content"),
            // Documentation patterns
            (r"(?i)^#\s+(readme|documentation|getting\s*started)", "documentation header"),
            // Website patterns
            (r"(?i)(<!DOCTYPE|<html|<head|<body)", "HTML structure"),
        ];

        for (pattern, reason) in suspicious_patterns {
            if let Ok(re) = Regex::new(pattern) {
                if re.is_match(content) {
                    // Only warn, don't block - let user decide
                    log::warn!(
                        "Suspicious content detected ({}): {}",
                        reason,
                        filename
                    );
                    // In strict mode, we still allow but log heavily
                    if self.strict_mode {
                        // Just log, don't block - the path check is the hard barrier
                    }
                }
            }
        }

        Ok(FileAccess::Allowed)
    }

    /// Combined check for path and content
    pub fn check(&self, path: &str, content: Option<&str>) -> Result<(), AgentError> {
        match self.check_write(path)? {
            FileAccess::Allowed => {}
            FileAccess::Forbidden => {
                return Err(AgentError::FileAccessDenied(format!(
                    "FORBIDDEN: Cannot write to '{}' - this path is protected",
                    path
                )));
            }
            FileAccess::NotWhitelisted => {
                return Err(AgentError::FileAccessDenied(format!(
                    "NOT ALLOWED: '{}' is not in the allowed paths list",
                    path
                )));
            }
            FileAccess::SuspiciousContent => {
                return Err(AgentError::FileAccessDenied(format!(
                    "SUSPICIOUS: Content in '{}' appears to be website/marketing material",
                    path
                )));
            }
        }

        if let Some(content) = content {
            self.check_content(content, path)?;
        }

        Ok(())
    }

    /// Normalize a path for comparison
    fn normalize_path(&self, path: &str) -> String {
        let mut normalized = path.replace('\\', "/");
        
        // Remove leading "./" or "/"
        while normalized.starts_with("./") || normalized.starts_with('/') {
            if normalized.starts_with("./") {
                normalized = normalized[2..].to_string();
            } else if normalized.starts_with('/') {
                normalized = normalized[1..].to_string();
            }
        }

        normalized.to_lowercase()
    }

    /// Add a temporary allowed path for this session
    pub fn add_temp_allowed(&mut self, path: &str) {
        let normalized = self.normalize_path(path);
        if !self.allowed_paths.contains(&normalized) {
            self.allowed_paths.push(normalized);
            log::info!("Temporarily allowed path: {}", path);
        }
    }

    /// Get list of allowed paths
    pub fn allowed_paths(&self) -> &[String] {
        &self.allowed_paths
    }

    /// Get list of forbidden patterns
    pub fn forbidden_patterns(&self) -> &[Regex] {
        &self.forbidden_patterns
    }
}

/// Create a backup of a file before modification
pub fn create_backup(path: &str) -> Result<PathBuf, AgentError> {
    let original = PathBuf::from(path);
    if !original.exists() {
        return Ok(original); // No backup needed for new files
    }

    let backup = original.with_extension(format!(
        "{}.bak",
        chrono::Local::now().format("%Y%m%d_%H%M%S")
    ));

    std::fs::copy(&original, &backup)
        .map_err(|e| AgentError::FileAccessDenied(format!("Failed to create backup: {}", e)))?;

    log::info!("Created backup: {:?}", backup);
    Ok(backup)
}

/// Verify write succeeded
pub fn verify_write(path: &str, expected_content: &str) -> Result<(), AgentError> {
    let actual = std::fs::read_to_string(path)
        .map_err(|e| AgentError::FileAccessDenied(format!("Failed to read file for verification: {}", e)))?;

    // Compare lengths (exact comparison might fail due to whitespace normalization)
    if actual.len() != expected_content.len() {
        // Check if difference is just trailing newline
        let trimmed_actual = actual.trim_end();
        let trimmed_expected = expected_content.trim_end();
        if trimmed_actual != trimmed_expected {
            return Err(AgentError::FileAccessDenied(
                "Write verification failed: content mismatch".to_string(),
            ));
        }
    }

    log::debug!("Write verified: {}", path);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_allowed_paths() {
        let guard = FileGuard::default();

        assert_eq!(guard.check_write("src/main.rs").unwrap(), FileAccess::Allowed);
        assert_eq!(guard.check_write("src-tauri/src/lib.rs").unwrap(), FileAccess::Allowed);
        assert_eq!(guard.check_write("Cargo.toml").unwrap(), FileAccess::Allowed);
        assert_eq!(guard.check_write("package.json").unwrap(), FileAccess::Allowed);
    }

    #[test]
    fn test_forbidden_paths() {
        let guard = FileGuard::default();

        assert_eq!(guard.check_write("README.md").unwrap(), FileAccess::Forbidden);
        assert_eq!(guard.check_write("docs/api.md").unwrap(), FileAccess::Forbidden);
        assert_eq!(guard.check_write(".github/workflows/ci.yml").unwrap(), FileAccess::Forbidden);
        assert_eq!(guard.check_write("website/index.html").unwrap(), FileAccess::Forbidden);
    }

    #[test]
    fn test_not_whitelisted() {
        let guard = FileGuard::default();

        assert_eq!(guard.check_write("random_file.txt").unwrap(), FileAccess::NotWhitelisted);
        assert_eq!(guard.check_write("tests/test.rs").unwrap(), FileAccess::NotWhitelisted);
    }

    #[test]
    fn test_path_normalization() {
        let guard = FileGuard::default();

        // Should handle different path formats
        assert_eq!(guard.check_write("./src/main.rs").unwrap(), FileAccess::Allowed);
        assert_eq!(guard.check_write("/src/main.rs").unwrap(), FileAccess::Allowed);
        assert_eq!(guard.check_write("SRC/main.rs").unwrap(), FileAccess::Allowed);
    }
}
