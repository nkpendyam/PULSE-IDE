//! Quality Control Gate for AI Suggestions
//!
//! Validates AI suggestions before applying them.
//! Prevents "silent failures" - code that runs but is subtly wrong.

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

/// Quality gate for AI suggestions
pub struct QualityGate {
    validators: Vec<Box<dyn Validator>>,
    min_confidence: f32,
    min_acceptance_rate: f32,
    validation_history: Vec<ValidationResult>,
}

/// Validation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub suggestion_id: String,
    pub passed: bool,
    pub confidence: f32,
    pub checks: Vec<CheckResult>,
    pub rejection_reasons: Vec<String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckResult {
    pub name: String,
    pub passed: bool,
    pub score: f32,
    pub message: String,
}

/// Validator trait
pub trait Validator: Send + Sync {
    fn name(&self) -> &str;
    fn validate(&self, suggestion: &CodeSuggestion) -> CheckResult;
}

/// Code suggestion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeSuggestion {
    pub id: String,
    pub original_code: String,
    pub suggested_code: String,
    pub language: String,
    pub file_path: String,
    pub context: String,
    pub agent_id: String,
    pub prompt: String,
}

impl QualityGate {
    pub fn new() -> Self {
        let mut gate = Self {
            validators: Vec::new(),
            min_confidence: 0.85,
            min_acceptance_rate: 0.85,
            validation_history: Vec::new(),
        };
        
        // Add default validators
        gate.add_validator(Box::new(SyntaxValidator));
        gate.add_validator(Box::new(SecurityValidator));
        gate.add_validator(Box::new(EntropyValidator));
        gate.add_validator(Box::new(StyleValidator));
        gate.add_validator(Box::new(SemanticValidator));
        
        gate
    }
    
    pub fn add_validator(&mut self, validator: Box<dyn Validator>) {
        self.validators.push(validator);
    }
    
    /// Validate a suggestion
    pub fn validate(&mut self, suggestion: &CodeSuggestion) -> ValidationResult {
        let mut checks = Vec::new();
        let mut total_score = 0.0;
        let mut rejection_reasons = Vec::new();
        
        for validator in &self.validators {
            let result = validator.validate(suggestion);
            
            if !result.passed {
                rejection_reasons.push(format!("{}: {}", validator.name(), result.message));
            }
            
            total_score += result.score;
            checks.push(result);
        }
        
        let confidence = total_score / self.validators.len() as f32;
        let passed = confidence >= self.min_confidence && rejection_reasons.is_empty();
        
        let result = ValidationResult {
            suggestion_id: suggestion.id.clone(),
            passed,
            confidence,
            checks,
            rejection_reasons,
            timestamp: chrono::Utc::now(),
        };
        
        self.validation_history.push(result.clone());
        result
    }
    
    /// Get acceptance rate
    pub fn acceptance_rate(&self) -> f32 {
        if self.validation_history.is_empty() {
            return 0.0;
        }
        
        let passed = self.validation_history.iter().filter(|r| r.passed).count();
        passed as f32 / self.validation_history.len() as f32
    }
    
    /// Check if quality is acceptable
    pub fn is_quality_acceptable(&self) -> bool {
        self.acceptance_rate() >= self.min_acceptance_rate
    }
}

impl Default for QualityGate {
    fn default() -> Self {
        Self::new()
    }
}

// ============ Validators ============

/// Syntax validator
struct SyntaxValidator;

impl Validator for SyntaxValidator {
    fn name(&self) -> &str {
        "syntax"
    }
    
    fn validate(&self, suggestion: &CodeSuggestion) -> CheckResult {
        // Check for syntax errors using tree-sitter
        let issues = check_syntax(&suggestion.suggested_code, &suggestion.language);
        
        if issues.is_empty() {
            CheckResult {
                name: "syntax".to_string(),
                passed: true,
                score: 1.0,
                message: "No syntax errors".to_string(),
            }
        } else {
            CheckResult {
                name: "syntax".to_string(),
                passed: false,
                score: 0.0,
                message: format!("Syntax errors: {}", issues.join(", ")),
            }
        }
    }
}

/// Security validator
struct SecurityValidator;

impl Validator for SecurityValidator {
    fn name(&self) -> &str {
        "security"
    }
    
    fn validate(&self, suggestion: &CodeSuggestion) -> CheckResult {
        let code = &suggestion.suggested_code.to_lowercase();
        
        let mut issues = Vec::new();
        
        // Check for dangerous patterns
        let dangerous_patterns = [
            ("rm -rf", "destructive file operation"),
            ("sudo", "elevated privileges"),
            ("password", "possible credential exposure"),
            ("api_key", "possible credential exposure"),
            ("secret", "possible credential exposure"),
            ("eval(", "code injection risk"),
            ("exec(", "code execution risk"),
            ("system(", "system command execution"),
            ("shell(", "shell execution"),
            ("dangerouslySetInnerHTML", "XSS risk"),
            ("innerHTML", "XSS risk"),
        ];
        
        for (pattern, issue) in dangerous_patterns {
            if code.contains(pattern) {
                issues.push(issue.to_string());
            }
        }
        
        if issues.is_empty() {
            CheckResult {
                name: "security".to_string(),
                passed: true,
                score: 1.0,
                message: "No security issues".to_string(),
            }
        } else {
            CheckResult {
                name: "security".to_string(),
                passed: false,
                score: issues.len() as f32 * 0.2,
                message: format!("Security concerns: {}", issues.join(", ")),
            }
        }
    }
}

/// Entropy validator (detects "weird" code)
struct EntropyValidator;

impl Validator for EntropyValidator {
    fn name(&self) -> &str {
        "entropy"
    }
    
    fn validate(&self, suggestion: &CodeSuggestion) -> CheckResult {
        let code = &suggestion.suggested_code;
        
        // Calculate character entropy
        let entropy = calculate_entropy(code);
        
        // Normal code has entropy between 4.0 and 5.5
        // Very low = repetitive, very high = random/obfuscated
        let normal = entropy >= 3.5 && entropy <= 5.5;
        
        // Check for suspicious patterns
        let suspicious = [
            code.matches("TODO").count() > 5,
            code.matches("FIXME").count() > 5,
            code.matches("XXX").count() > 5,
            code.matches("...").count() > 10, // Placeholder
            code.matches("???").count() > 5,  // Uncertainty
        ];
        
        let suspicious_count = suspicious.iter().filter(|&&x| x).count();
        
        let score = if normal && suspicious_count == 0 {
            1.0
        } else if normal {
            0.7
        } else {
            0.3
        };
        
        CheckResult {
            name: "entropy".to_string(),
            passed: score >= 0.7,
            score,
            message: format!("Entropy: {:.2}, Suspicious patterns: {}", entropy, suspicious_count),
        }
    }
}

/// Style validator
struct StyleValidator;

impl Validator for StyleValidator {
    fn name(&self) -> &str {
        "style"
    }
    
    fn validate(&self, suggestion: &CodeSuggestion) -> CheckResult {
        let code = &suggestion.suggested_code;
        
        let mut issues = Vec::new();
        
        // Check line length
        let long_lines = code.lines().filter(|l| l.len() > 120).count();
        if long_lines > 5 {
            issues.push(format!("{} lines > 120 chars", long_lines));
        }
        
        // Check indentation consistency
        let tabs = code.lines().filter(|l| l.starts_with('\t')).count();
        let spaces = code.lines().filter(|l| l.starts_with(' ')).count();
        if tabs > 0 && spaces > 0 {
            issues.push("Mixed tabs and spaces".to_string());
        }
        
        // Check trailing whitespace
        let trailing = code.lines().filter(|l| l.ends_with(' ')).count();
        if trailing > 3 {
            issues.push(format!("{} lines with trailing whitespace", trailing));
        }
        
        let score = if issues.is_empty() { 1.0 } else { 0.8 - issues.len() as f32 * 0.1 };
        
        CheckResult {
            name: "style".to_string(),
            passed: issues.is_empty(),
            score: score.max(0.0),
            message: if issues.is_empty() {
                "Style OK".to_string()
            } else {
                issues.join("; ")
            },
        }
    }
}

/// Semantic validator
struct SemanticValidator;

impl Validator for SemanticValidator {
    fn name(&self) -> &str {
        "semantic"
    }
    
    fn validate(&self, suggestion: &CodeSuggestion) -> CheckResult {
        // Check that the suggestion is relevant to the context
        let context_words: std::collections::HashSet<&str> = 
            suggestion.context.split_whitespace().collect();
        let code_words: std::collections::HashSet<&str> = 
            suggestion.suggested_code.split_whitespace().collect();
        
        let overlap = context_words.intersection(&code_words).count();
        let relevance = if context_words.is_empty() {
            0.5
        } else {
            overlap as f32 / context_words.len() as f32
        };
        
        // Check for hallucinated imports
        let imports = extract_imports(&suggestion.suggested_code, &suggestion.language);
        let suspicious_imports = imports.iter().filter(|i| {
            i.contains("fake") || i.contains("mock") || i.contains("example")
        }).count();
        
        let score = if suspicious_imports > 0 {
            relevance * 0.5
        } else {
            relevance
        };
        
        CheckResult {
            name: "semantic".to_string(),
            passed: score >= 0.3,
            score,
            message: format!("Relevance: {:.0}%", relevance * 100.0),
        }
    }
}

// Helper functions
fn check_syntax(code: &str, _language: &str) -> Vec<String> {
    // Would use tree-sitter in real impl
    let mut issues = Vec::new();
    
    // Simple bracket matching
    let mut brackets = 0;
    let mut braces = 0;
    let mut parens = 0;
    
    for c in code.chars() {
        match c {
            '[' => brackets += 1,
            ']' => brackets -= 1,
            '{' => braces += 1,
            '}' => braces -= 1,
            '(' => parens += 1,
            ')' => parens -= 1,
            _ => {}
        }
    }
    
    if brackets != 0 {
        issues.push("Unmatched brackets".to_string());
    }
    if braces != 0 {
        issues.push("Unmatched braces".to_string());
    }
    if parens != 0 {
        issues.push("Unmatched parentheses".to_string());
    }
    
    issues
}

fn calculate_entropy(text: &str) -> f32 {
    use std::collections::HashMap;
    
    let mut freq: HashMap<char, usize> = HashMap::new();
    let len = text.len();
    
    if len == 0 {
        return 0.0;
    }
    
    for c in text.chars() {
        *freq.entry(c).or_insert(0) += 1;
    }
    
    let mut entropy = 0.0;
    for count in freq.values() {
        let p = *count as f64 / len as f64;
        entropy -= p * p.log2();
    }
    
    entropy as f32
}

fn extract_imports(code: &str, language: &str) -> Vec<String> {
    let mut imports = Vec::new();
    
    for line in code.lines() {
        let line = line.trim();
        
        match language {
            "rust" if line.starts_with("use ") => {
                imports.push(line.to_string());
            }
            "python" if line.starts_with("import ") || line.starts_with("from ") => {
                imports.push(line.to_string());
            }
            "javascript" | "typescript" if line.starts_with("import ") => {
                imports.push(line.to_string());
            }
            _ => {}
        }
    }
    
    imports
}
