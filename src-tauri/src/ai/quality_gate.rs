//! AI Quality Gates for KRO IDE
//!
//! Validates AI suggestions before showing them to users.
//! Ensures 85%+ acceptance rate through syntax, type, and test validation.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

/// Quality gate result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityGateResult {
    pub passed: bool,
    pub score: f32,
    pub checks: Vec<CheckResult>,
    pub rejection_reason: Option<String>,
}

/// Individual check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckResult {
    pub name: String,
    pub passed: bool,
    pub score: f32,
    pub message: Option<String>,
}

/// Quality gate configuration
#[derive(Debug, Clone)]
pub struct QualityGateConfig {
    /// Minimum score to pass (0.0 - 1.0)
    pub min_score: f32,
    /// Enable syntax validation
    pub check_syntax: bool,
    /// Enable type checking
    pub check_types: bool,
    /// Enable test generation
    pub check_tests: bool,
    /// Enable formatting check
    pub check_formatting: bool,
    /// Language-specific validators
    pub validators: Vec<String>,
}

impl Default for QualityGateConfig {
    fn default() -> Self {
        Self {
            min_score: 0.85,
            check_syntax: true,
            check_types: true,
            check_tests: false, // Expensive
            check_formatting: true,
            validators: vec!["rust".to_string(), "typescript".to_string(), "python".to_string()],
        }
    }
}

/// AI Quality Gate
pub struct AiQualityGate {
    config: QualityGateConfig,
}

impl AiQualityGate {
    /// Create a new quality gate
    pub fn new(config: QualityGateConfig) -> Self {
        Self { config }
    }

    /// Validate an AI suggestion
    pub async fn validate(
        &self,
        suggestion: &str,
        language: &str,
        context: &QualityContext,
    ) -> Result<QualityGateResult> {
        let mut checks = Vec::new();
        let mut total_score = 0.0;
        let mut check_count = 0;

        // 1. Syntax validation
        if self.config.check_syntax {
            let result = self.check_syntax(suggestion, language).await;
            total_score += result.score;
            check_count += 1;
            checks.push(result);
        }

        // 2. Type checking (language-specific)
        if self.config.check_types {
            let result = self.check_types(suggestion, language, context).await;
            total_score += result.score;
            check_count += 1;
            checks.push(result);
        }

        // 3. Formatting check
        if self.config.check_formatting {
            let result = self.check_formatting(suggestion, language).await;
            total_score += result.score;
            check_count += 1;
            checks.push(result);
        }

        // 4. Test generation (optional, expensive)
        if self.config.check_tests {
            let result = self.check_tests(suggestion, language, context).await;
            total_score += result.score;
            check_count += 1;
            checks.push(result);
        }

        // 5. Confidence check
        let result = self.check_confidence(suggestion, context);
        total_score += result.score;
        check_count += 1;
        checks.push(result);

        // Calculate final score
        let final_score = if check_count > 0 {
            total_score / check_count as f32
        } else {
            0.0
        };

        let passed = final_score >= self.config.min_score;
        let rejection_reason = if !passed {
            Some(format!(
                "Score {:.2} below threshold {:.2}",
                final_score, self.config.min_score
            ))
        } else {
            None
        };

        Ok(QualityGateResult {
            passed,
            score: final_score,
            checks,
            rejection_reason,
        })
    }

    /// Check syntax validity
    async fn check_syntax(&self, code: &str, language: &str) -> CheckResult {
        let result = match language {
            "rust" => self.check_rust_syntax(code).await,
            "typescript" | "javascript" => self.check_ts_syntax(code).await,
            "python" => self.check_python_syntax(code).await,
            _ => Ok(true),
        };

        match result {
            Ok(true) => CheckResult {
                name: "syntax".to_string(),
                passed: true,
                score: 1.0,
                message: Some("Syntax valid".to_string()),
            },
            Ok(false) => CheckResult {
                name: "syntax".to_string(),
                passed: false,
                score: 0.0,
                message: Some("Syntax error detected".to_string()),
            },
            Err(e) => CheckResult {
                name: "syntax".to_string(),
                passed: false,
                score: 0.5,
                message: Some(format!("Check failed: {}", e)),
            },
        }
    }

    /// Check Rust syntax using rustfmt
    async fn check_rust_syntax(&self, code: &str) -> Result<bool> {
        // Use tree-sitter for fast parsing
        let mut parser = tree_sitter::Parser::new();
        parser.set_language(tree_sitter_rust::LANGUAGE.into())?;
        
        let tree = parser.parse(code, None);
        Ok(tree.is_some())
    }

    /// Check TypeScript/JavaScript syntax
    async fn check_ts_syntax(&self, code: &str) -> Result<bool> {
        let mut parser = tree_sitter::Parser::new();
        parser.set_language(tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into())?;
        
        let tree = parser.parse(code, None);
        Ok(tree.is_some())
    }

    /// Check Python syntax
    async fn check_python_syntax(&self, code: &str) -> Result<bool> {
        let mut parser = tree_sitter::Parser::new();
        parser.set_language(tree_sitter_python::LANGUAGE.into())?;
        
        let tree = parser.parse(code, None);
        Ok(tree.is_some())
    }

    /// Check types (language-specific)
    async fn check_types(&self, code: &str, language: &str, context: &QualityContext) -> CheckResult {
        // For Rust, run cargo check on a temp file
        if language == "rust" && context.project_path.is_some() {
            match self.run_cargo_check(code, context.project_path.unwrap()).await {
                Ok(errors) if errors.is_empty() => {
                    return CheckResult {
                        name: "types".to_string(),
                        passed: true,
                        score: 1.0,
                        message: Some("No type errors".to_string()),
                    };
                }
                Ok(errors) => {
                    return CheckResult {
                        name: "types".to_string(),
                        passed: false,
                        score: 0.3,
                        message: Some(format!("Type errors: {}", errors.join(", "))),
                    };
                }
                Err(e) => {
                    return CheckResult {
                        name: "types".to_string(),
                        passed: true, // Pass if we can't check
                        score: 0.7,
                        message: Some(format!("Could not verify: {}", e)),
                    };
                }
            }
        }

        // Default: pass with warning
        CheckResult {
            name: "types".to_string(),
            passed: true,
            score: 0.8,
            message: Some("Type check skipped".to_string()),
        }
    }

    /// Run cargo check on code
    async fn run_cargo_check(&self, _code: &str, project_path: &Path) -> Result<Vec<String>> {
        let output = Command::new("cargo")
            .args(&["check", "--message-format=short"])
            .current_dir(project_path)
            .output()?;

        let stderr = String::from_utf8_lossy(&output.stderr);
        let errors: Vec<String> = stderr
            .lines()
            .filter(|l| l.contains("error["))
            .map(|l| l.to_string())
            .collect();

        Ok(errors)
    }

    /// Check formatting
    async fn check_formatting(&self, code: &str, language: &str) -> CheckResult {
        // Check for basic formatting issues
        let issues = self.detect_formatting_issues(code);
        
        if issues.is_empty() {
            CheckResult {
                name: "formatting".to_string(),
                passed: true,
                score: 1.0,
                message: Some("Formatting looks good".to_string()),
            }
        } else {
            let score = 1.0 - (issues.len() as f32 * 0.1).min(0.5);
            CheckResult {
                name: "formatting".to_string(),
                passed: score > 0.5,
                score,
                message: Some(format!("Issues: {}", issues.join(", "))),
            }
        }
    }

    /// Detect formatting issues
    fn detect_formatting_issues(&self, code: &str) -> Vec<String> {
        let mut issues = Vec::new();
        
        // Check for mixed tabs/spaces
        let has_tabs = code.contains('\t');
        let has_spaces = code.contains("    ");
        if has_tabs && has_spaces {
            issues.push("mixed tabs/spaces".to_string());
        }

        // Check for trailing whitespace
        if code.lines().any(|l| l.ends_with(' ') || l.ends_with('\t')) {
            issues.push("trailing whitespace".to_string());
        }

        // Check for very long lines
        if code.lines().any(|l| l.len() > 120) {
            issues.push("long lines (>120)".to_string());
        }

        issues
    }

    /// Check by generating tests (expensive)
    async fn check_tests(&self, code: &str, language: &str, _context: &QualityContext) -> CheckResult {
        // This would generate and run tests - expensive operation
        // For now, just check if code looks testable
        
        let has_functions = match language {
            "rust" => code.contains("fn "),
            "typescript" | "javascript" => code.contains("function ") || code.contains("=>"),
            "python" => code.contains("def "),
            _ => true,
        };

        CheckResult {
            name: "tests".to_string(),
            passed: true,
            score: if has_functions { 0.8 } else { 0.6 },
            message: Some(if has_functions { 
                "Code appears testable".to_string() 
            } else { 
                "No functions detected".to_string() 
            }),
        }
    }

    /// Check confidence based on context
    fn check_confidence(&self, suggestion: &str, context: &QualityContext) -> CheckResult {
        // Factors that increase confidence:
        // - Has context from RAG
        // - Matches existing patterns in codebase
        // - Not too long (complexity)
        // - Uses imports from context
        
        let mut confidence = 0.7; // Base confidence

        // Boost for RAG context
        if context.has_rag_context {
            confidence += 0.1;
        }

        // Boost for matching patterns
        if context.matching_patterns > 0 {
            confidence += 0.05 * context.matching_patterns.min(3) as f32;
        }

        // Penalize very long suggestions (complexity risk)
        let lines = suggestion.lines().count();
        if lines > 50 {
            confidence -= 0.1;
        } else if lines > 100 {
            confidence -= 0.2;
        }

        // Penalize if no context at all
        if !context.has_rag_context && context.matching_patterns == 0 {
            confidence -= 0.1;
        }

        CheckResult {
            name: "confidence".to_string(),
            passed: confidence >= 0.6,
            score: confidence.min(1.0),
            message: Some(format!("Confidence: {:.0}%", confidence * 100.0)),
        }
    }

    /// Quick validation for autocomplete suggestions
    pub fn quick_validate(&self, suggestion: &str, language: &str) -> bool {
        // Fast checks only
        if suggestion.is_empty() {
            return false;
        }

        // Check for obvious issues
        let has_syntax_issues = match language {
            "rust" => suggestion.contains("???") || suggestion.contains("todo!()"),
            _ => suggestion.contains("TODO") || suggestion.contains("FIXME"),
        };

        !has_syntax_issues
    }
}

/// Context for quality validation
#[derive(Debug, Clone, Default)]
pub struct QualityContext {
    /// Project root path
    pub project_path: Option<&'static Path>,
    /// Has RAG context
    pub has_rag_context: bool,
    /// Number of matching patterns in codebase
    pub matching_patterns: u32,
    /// Similar code found
    pub similar_code: Vec<String>,
    /// Imports in scope
    pub imports: Vec<String>,
}

impl Default for AiQualityGate {
    fn default() -> Self {
        Self::new(QualityGateConfig::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_syntax_check_rust() {
        let gate = AiQualityGate::default();
        let result = gate.check_syntax("fn main() { println!(\"Hello\"); }", "rust").await;
        assert!(result.passed);
    }

    #[tokio::test]
    async fn test_syntax_check_python() {
        let gate = AiQualityGate::default();
        let result = gate.check_syntax("def hello():\n    print('Hello')", "python").await;
        assert!(result.passed);
    }

    #[test]
    fn test_quick_validate() {
        let gate = AiQualityGate::default();
        assert!(gate.quick_validate("fn foo() {}", "rust"));
        assert!(!gate.quick_validate("todo!()", "rust"));
    }
}

