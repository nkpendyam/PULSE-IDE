//! Code-Aware Chat Features
//!
//! Special handling for code-related queries

use super::*;
use anyhow::Result;
use std::collections::HashMap;

/// Code-aware chat processor
pub struct CodeAwareChat {
    language_hints: HashMap<String, String>,
}

impl CodeAwareChat {
    pub fn new() -> Self {
        let mut language_hints = HashMap::new();

        // Add language-specific hints
        language_hints.insert("rust".to_string(), include_str!("prompts/rust_hints.txt").to_string());
        language_hints.insert("python".to_string(), include_str!("prompts/python_hints.txt").to_string());
        language_hints.insert("typescript".to_string(), include_str!("prompts/typescript_hints.txt").to_string());
        language_hints.insert("javascript".to_string(), include_str!("prompts/javascript_hints.txt").to_string());

        Self { language_hints }
    }

    /// Enhance prompt with code-specific context
    pub fn enhance_prompt(&self, prompt: &str, context: &CodeContext) -> String {
        let mut enhanced = String::new();

        // Add language hints
        let languages: std::collections::HashSet<&str> = context.snippets.iter()
            .map(|s| s.language.as_str())
            .collect();

        for lang in languages {
            if let Some(hints) = self.language_hints.get(lang) {
                enhanced.push_str(&format!("[{} HINTS]\n{}\n\n", lang.to_uppercase(), hints));
            }
        }

        // Add the original prompt
        enhanced.push_str(prompt);

        enhanced
    }

    /// Detect query type
    pub fn detect_query_type(&self, query: &str) -> QueryType {
        let query_lower = query.to_lowercase();

        if query_lower.contains("fix") || query_lower.contains("bug") || query_lower.contains("error") {
            QueryType::BugFix
        } else if query_lower.contains("refactor") {
            QueryType::Refactor
        } else if query_lower.contains("add") || query_lower.contains("implement") || query_lower.contains("create") {
            QueryType::AddFeature
        } else if query_lower.contains("explain") || query_lower.contains("what does") || query_lower.contains("how does") {
            QueryType::Explain
        } else if query_lower.contains("test") {
            QueryType::WriteTest
        } else if query_lower.contains("document") || query_lower.contains("comment") {
            QueryType::Documentation
        } else if query_lower.contains("optimize") || query_lower.contains("performance") {
            QueryType::Optimize
        } else if query_lower.contains("find") || query_lower.contains("search") || query_lower.contains("where") {
            QueryType::CodeSearch
        } else {
            QueryType::General
        }
    }

    /// Get system prompt enhancement based on query type
    pub fn get_query_type_hints(&self, query_type: &QueryType) -> &'static str {
        match query_type {
            QueryType::BugFix => "Focus on identifying the root cause. Check for edge cases, error handling, and potential null/undefined issues.",
            QueryType::Refactor => "Focus on improving code structure while preserving behavior. Consider SOLID principles and design patterns.",
            QueryType::AddFeature => "Focus on clean implementation. Consider backward compatibility and integration points.",
            QueryType::Explain => "Be thorough but accessible. Use analogies and provide context for technical concepts.",
            QueryType::WriteTest => "Focus on test coverage, edge cases, and meaningful assertions.",
            QueryType::Documentation => "Focus on clarity, examples, and documenting intent over implementation.",
            QueryType::Optimize => "Focus on measurable improvements. Consider algorithmic complexity and memory usage.",
            QueryType::CodeSearch => "Focus on finding relevant code quickly. Consider semantic matches and similar patterns.",
            QueryType::General => "Be helpful and concise. Ask clarifying questions if needed.",
        }
    }

    /// Extract code from message
    pub fn extract_code(&self, content: &str) -> Vec<ExtractedCode> {
        let mut code_blocks = Vec::new();

        // Find markdown code blocks
        let mut in_code_block = false;
        let mut current_lang = String::new();
        let mut current_code = String::new();
        let mut start_pos = 0;

        for (i, line) in content.lines().enumerate() {
            if line.starts_with("```") {
                if in_code_block {
                    // End of code block
                    code_blocks.push(ExtractedCode {
                        language: current_lang.clone(),
                        code: current_code.clone(),
                        start_line: start_pos,
                        end_line: i + 1,
                    });
                    current_code.clear();
                    in_code_block = false;
                } else {
                    // Start of code block
                    in_code_block = true;
                    start_pos = i + 1;
                    current_lang = line[3..].trim().to_string();
                }
            } else if in_code_block {
                current_code.push_str(line);
                current_code.push('\n');
            }
        }

        code_blocks
    }

    /// Check if code is valid for language
    pub fn validate_code(&self, code: &str, language: &str) -> ValidationResult {
        match language {
            "rust" => self.validate_rust(code),
            "python" => self.validate_python(code),
            "javascript" | "typescript" => self.validate_js_ts(code),
            _ => ValidationResult::default(),
        }
    }

    fn validate_rust(&self, code: &str) -> ValidationResult {
        let mut issues = Vec::new();

        // Check for common Rust issues
        if code.contains("unwrap()") && !code.contains("// safe: ") {
            issues.push(ValidationIssue {
                line: None,
                message: "Consider using expect() with a message or proper error handling".to_string(),
                severity: Severity::Warning,
            });
        }

        if code.contains(".clone()") && code.matches(".clone()").count() > 3 {
            issues.push(ValidationIssue {
                line: None,
                message: "Multiple clones detected - consider using references".to_string(),
                severity: Severity::Info,
            });
        }

        // Check for unhandled Result
        if code.contains("Result<") && !code.contains("?") && !code.contains("match") {
            issues.push(ValidationIssue {
                line: None,
                message: "Result type detected but no error handling".to_string(),
                severity: Severity::Warning,
            });
        }

        ValidationResult {
            is_valid: issues.iter().all(|i| i.severity != Severity::Error),
            issues,
        }
    }

    fn validate_python(&self, code: &str) -> ValidationResult {
        let mut issues = Vec::new();

        // Check for common Python issues
        if code.contains("print(") && !code.contains("# debug") {
            issues.push(ValidationIssue {
                line: None,
                message: "Debug print statement detected".to_string(),
                severity: Severity::Info,
            });
        }

        if code.contains("except:") {
            issues.push(ValidationIssue {
                line: None,
                message: "Bare except clause - consider catching specific exceptions".to_string(),
                severity: Severity::Warning,
            });
        }

        ValidationResult {
            is_valid: issues.iter().all(|i| i.severity != Severity::Error),
            issues,
        }
    }

    fn validate_js_ts(&self, code: &str) -> ValidationResult {
        let mut issues = Vec::new();

        // Check for common JS/TS issues
        if code.contains("var ") {
            issues.push(ValidationIssue {
                line: None,
                message: "Use 'const' or 'let' instead of 'var'".to_string(),
                severity: Severity::Warning,
            });
        }

        if code.contains("==") && !code.contains("===") {
            issues.push(ValidationIssue {
                line: None,
                message: "Use strict equality (===) instead of loose equality (==)".to_string(),
                severity: Severity::Warning,
            });
        }

        ValidationResult {
            is_valid: issues.iter().all(|i| i.severity != Severity::Error),
            issues,
        }
    }
}

impl Default for CodeAwareChat {
    fn default() -> Self {
        Self::new()
    }
}

/// Query type classification
#[derive(Debug, Clone, PartialEq)]
pub enum QueryType {
    BugFix,
    Refactor,
    AddFeature,
    Explain,
    WriteTest,
    Documentation,
    Optimize,
    CodeSearch,
    General,
}

/// Extracted code block
#[derive(Debug, Clone)]
pub struct ExtractedCode {
    pub language: String,
    pub code: String,
    pub start_line: usize,
    pub end_line: usize,
}

/// Code validation result
#[derive(Debug, Clone, Default)]
pub struct ValidationResult {
    pub is_valid: bool,
    pub issues: Vec<ValidationIssue>,
}

/// Validation issue
#[derive(Debug, Clone)]
pub struct ValidationIssue {
    pub line: Option<usize>,
    pub message: String,
    pub severity: Severity,
}

/// Issue severity
#[derive(Debug, Clone, PartialEq)]
pub enum Severity {
    Info,
    Warning,
    Error,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_query_type() {
        let chat = CodeAwareChat::new();

        assert_eq!(chat.detect_query_type("Fix the bug in auth.rs"), QueryType::BugFix);
        assert_eq!(chat.detect_query_type("Explain how this works"), QueryType::Explain);
        assert_eq!(chat.detect_query_type("Add a new feature"), QueryType::AddFeature);
    }

    #[test]
    fn test_extract_code() {
        let chat = CodeAwareChat::new();

        let content = "Here's some code:\n```rust\nfn main() {}\n```\nThat's it.";
        let blocks = chat.extract_code(content);

        assert_eq!(blocks.len(), 1);
        assert_eq!(blocks[0].language, "rust");
    }
}
