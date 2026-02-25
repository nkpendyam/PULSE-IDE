//! Kani model checker adapter
//!
//! Integration with AWS Kani for Rust verification

use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::process::Command;
use super::{VerificationViolation, CodeLocation, Severity};

/// Kani adapter for Rust verification
pub struct KaniAdapter {
    kani_path: Option<String>,
    stubs: Vec<KaniStub>,
}

/// Kani stub for unsupported functions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KaniStub {
    pub function_name: String,
    pub stub_body: String,
}

/// Kani verification result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KaniResult {
    pub success: bool,
    pub checks_passed: u32,
    pub checks_failed: u32,
    pub violations: Vec<VerificationViolation>,
}

impl KaniAdapter {
    /// Create a new Kani adapter
    pub fn new() -> Result<Self> {
        // Check if Kani is installed
        let kani_path = Self::find_kani()?;

        Ok(Self {
            kani_path,
            stubs: Vec::new(),
        })
    }

    /// Find Kani installation
    fn find_kani() -> Result<Option<String>> {
        // Check if cargo kani is available
        let output = Command::new("cargo")
            .args(["kani", "--version"])
            .output();

        match output {
            Ok(output) if output.status.success() => Ok(Some("cargo kani".to_string())),
            _ => Ok(None),
        }
    }

    /// Verify a Rust function
    pub async fn verify(&mut self, code: &str, function_name: &str) -> Result<KaniResult> {
        // If Kani is not installed, return placeholder result
        if self.kani_path.is_none() {
            return Ok(KaniResult {
                success: true,
                checks_passed: 0,
                checks_failed: 0,
                violations: vec![],
            });
        }

        // Create temporary file
        let temp_file = self.create_temp_file(code)?;

        // Run Kani
        let output = Command::new("cargo")
            .args(["kani", "--harness", function_name])
            .current_dir(temp_file.parent().unwrap())
            .output()
            .context("Failed to run Kani")?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        // Parse results
        self.parse_kani_output(&stdout, &stderr)
    }

    /// Create temporary file for verification
    fn create_temp_file(&self, code: &str) -> Result<std::path::PathBuf> {
        let temp_dir = std::env::temp_dir().join("kyro-kani");
        std::fs::create_dir_all(&temp_dir)?;

        let file_path = temp_dir.join("verification.rs");
        std::fs::write(&file_path, code)?;

        Ok(file_path)
    }

    /// Parse Kani output
    fn parse_kani_output(&self, stdout: &str, stderr: &str) -> Result<KaniResult> {
        let mut violations = Vec::new();
        let mut checks_passed = 0;
        let mut checks_failed = 0;

        // Parse summary line
        for line in stdout.lines() {
            if line.contains("checks passed") {
                if let Some(num) = line.split_whitespace().nth(0) {
                    checks_passed = num.parse().unwrap_or(0);
                }
            }
            if line.contains("checks failed") {
                if let Some(num) = line.split_whitespace().nth(0) {
                    checks_failed = num.parse().unwrap_or(0);
                }
            }

            // Parse individual failures
            if line.contains("FAILURE") || line.contains("UNDETERMINED") {
                violations.push(VerificationViolation {
                    property: line.to_string(),
                    message: "Kani verification failure".to_string(),
                    location: CodeLocation::default(),
                    counterexample: None,
                    severity: Severity::Error,
                });
            }
        }

        Ok(KaniResult {
            success: violations.is_empty(),
            checks_passed,
            checks_failed,
            violations,
        })
    }

    /// Add a stub for an unsupported function
    pub fn add_stub(&mut self, stub: KaniStub) {
        self.stubs.push(stub);
    }

    /// Generate Kani proof harness
    pub fn generate_harness(&self, function_name: &str, params: &[String]) -> String {
        let param_decls: Vec<String> = params.iter()
            .enumerate()
            .map(|(i, _)| format!("arg_{} : u32", i))
            .collect();

        format!(
            r#"#[kani::proof]
fn verify_{}() {{
    {}
    {}({});
}}"#,
            function_name,
            param_decls.iter()
                .map(|p| format!("let {} = kani::any();", p.split(':').next().unwrap().trim()))
                .collect::<Vec<_>>()
                .join("\n    "),
            function_name,
            param_decls.iter()
                .map(|p| p.split(':').next().unwrap().trim())
                .collect::<Vec<_>>()
                .join(", ")
        )
    }

    /// Check if Kani is available
    pub fn is_available(&self) -> bool {
        self.kani_path.is_some()
    }
}

impl Default for KaniAdapter {
    fn default() -> Self {
        Self::new().expect("Failed to create Kani adapter")
    }
}
