//! Autonomous Verifier Module
//!
//! Verifies execution results and proposed actions for autonomous agents,
//! acting as the primary security sandbox boundary.

use serde::{Deserialize, Serialize};
use std::path::Path;

/// Verification result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationResult {
    pub step_id: String,
    pub passed: bool,
    pub checks: Vec<Check>,
}

/// Individual check
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Check {
    pub name: String,
    pub passed: bool,
    pub message: String,
}

/// Result and Action verifier
pub struct Verifier {
    forbidden_commands: Vec<&'static str>,
    allowed_dirs: Vec<String>,
}

impl Verifier {
    pub fn new(allowed_dirs: Vec<String>) -> Self { 
        Self {
            // Basic sandboxing: Prevent destructive base commands
            forbidden_commands: vec!["rm", "del", "format", "mkfs", "dd", "mv", "chmod", "chown", "sudo", "su"],
            allowed_dirs,
        }
    }
    
    /// Verify a proposed terminal command before execution (Pre-execution Sandbox)
    pub fn verify_command(&self, step_id: &str, command: &str) -> VerificationResult {
        let mut checks = Vec::new();
        let cmd_base = command.split_whitespace().next().unwrap_or("").to_lowercase();
        
        let is_safe_cmd = !self.forbidden_commands.contains(&cmd_base.as_str());
        checks.push(Check {
            name: "forbidden_command_check".to_string(),
            passed: is_safe_cmd,
            message: if is_safe_cmd { "Command is allowed.".to_string() } else { format!("Command '{}' is forbidden.", cmd_base) },
        });

        VerificationResult {
            step_id: step_id.to_string(),
            passed: checks.iter().all(|c| c.passed),
            checks,
        }
    }

    /// Verify a proposed file system path (Pre-execution Sandbox)
    pub fn verify_path(&self, step_id: &str, file_path: &str) -> VerificationResult {
        let mut checks = Vec::new();
        let path = Path::new(file_path);
        
        // Check for directory escape attacks
        let no_escape = !file_path.contains("..");
        checks.push(Check {
            name: "path_escape_check".to_string(),
            passed: no_escape,
            message: if no_escape { "Path does not contain escapes.".to_string() } else { "Path traversal (..) is forbidden.".to_string() },
        });

        // Simplified root check against allowed dirs
        // In a real implementation, use `std::fs::canonicalize` and `starts_with`
        let within_sandbox = self.allowed_dirs.is_empty() || self.allowed_dirs.iter().any(|dir| file_path.starts_with(dir));
        checks.push(Check {
            name: "sandbox_boundary_check".to_string(),
            passed: within_sandbox,
            message: if within_sandbox { "Path is within allowed workspace.".to_string() } else { "Path is outside the active workspace sandbox.".to_string() },
        });

        VerificationResult {
            step_id: step_id.to_string(),
            passed: checks.iter().all(|c| c.passed),
            checks,
        }
    }

    /// Verify an execution result output (Post-execution)
    pub fn verify(&self, step_id: &str, output: &str) -> VerificationResult {
        VerificationResult {
            step_id: step_id.to_string(),
            passed: !output.is_empty(),
            checks: vec![Check {
                name: "output_not_empty".to_string(),
                passed: !output.is_empty(),
                message: "Checking that output is not empty".to_string(),
            }],
        }
    }
}

impl Default for Verifier {
    fn default() -> Self { Self::new(Vec::new()) }
}
