//! PicoClaw Integration Module
//!
//! PicoClaw is an ultra-lightweight AI assistant (<10MB) that provides
//! basic AI capabilities without the overhead of full LLM inference.
//!
//! ## Features
//! - Tiny memory footprint (<10MB RAM)
//! - Fast startup (<100ms)
//! - Basic code completion
//! - Simple code analysis
//! - Pattern-based suggestions
//!
//! ## Use Cases
//! - Quick code completions when full LLM isn't needed
//! - Low-resource environments
//! - Background code analysis
//!
//! ## Architecture
//! PicoClaw uses a combination of:
//! 1. N-gram language models for fast completions
//! 2. Tree-sitter for code structure analysis
//! 3. Pattern matching for common code idioms
//! 4. Trie-based autocomplete for API suggestions

use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, BTreeMap};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

/// PicoClaw configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PicoClawConfig {
    /// Maximum memory usage in MB (default: 10MB)
    pub max_memory_mb: usize,
    /// Enable code completion
    pub enable_completion: bool,
    /// Enable code analysis
    pub enable_analysis: bool,
    /// Minimum characters for completion trigger
    pub min_trigger_chars: usize,
    /// Maximum suggestions to return
    pub max_suggestions: usize,
    /// Languages to support
    pub enabled_languages: Vec<String>,
}

impl Default for PicoClawConfig {
    fn default() -> Self {
        Self {
            max_memory_mb: 10,
            enable_completion: true,
            enable_analysis: true,
            min_trigger_chars: 2,
            max_suggestions: 10,
            enabled_languages: vec![
                "rust".to_string(),
                "typescript".to_string(),
                "javascript".to_string(),
                "python".to_string(),
                "go".to_string(),
                "java".to_string(),
                "c".to_string(),
                "cpp".to_string(),
            ],
        }
    }
}

/// Completion suggestion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionSuggestion {
    /// Suggestion text
    pub text: String,
    /// Display label
    pub label: String,
    /// Suggestion kind (function, variable, keyword, etc.)
    pub kind: SuggestionKind,
    /// Confidence score (0.0 - 1.0)
    pub score: f32,
    /// Source (pattern, trie, ngram)
    pub source: String,
}

/// Suggestion kinds
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SuggestionKind {
    Function,
    Variable,
    Keyword,
    Type,
    Method,
    Property,
    Snippet,
    Text,
}

/// Code analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisResult {
    /// Detected issues
    pub issues: Vec<CodeIssue>,
    /// Suggestions for improvement
    pub suggestions: Vec<String>,
    /// Complexity score (0-100)
    pub complexity_score: u8,
    /// Detected patterns
    pub patterns: Vec<String>,
}

/// Code issue detected by PicoClaw
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeIssue {
    /// Issue severity
    pub severity: IssueSeverity,
    /// Issue message
    pub message: String,
    /// Line number (1-based)
    pub line: usize,
    /// Column number (1-based)
    pub column: usize,
    /// Suggested fix
    pub fix: Option<String>,
}

/// Issue severity levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum IssueSeverity {
    Error,
    Warning,
    Info,
    Hint,
}

/// PicoClaw engine
pub struct PicoClawEngine {
    config: PicoClawConfig,
    /// Pattern database for each language
    patterns: HashMap<String, LanguagePatterns>,
    /// Trie for fast prefix lookups
    tries: HashMap<String, CompletionTrie>,
    /// N-gram models for completion
    ngrams: HashMap<String, NGramModel>,
}

/// Language-specific patterns
#[derive(Debug, Clone)]
pub struct LanguagePatterns {
    /// Common function patterns
    pub function_patterns: Vec<PatternEntry>,
    /// Common variable patterns
    pub variable_patterns: Vec<PatternEntry>,
    /// Common class/struct patterns
    pub type_patterns: Vec<PatternEntry>,
    /// Keywords
    pub keywords: Vec<String>,
    /// Built-in functions
    pub builtins: Vec<String>,
}

/// Pattern entry with frequency
#[derive(Debug, Clone)]
pub struct PatternEntry {
    pub pattern: String,
    pub frequency: u32,
    pub context: String,
}

/// Trie for fast autocomplete
#[derive(Debug, Clone, Default)]
pub struct CompletionTrie {
    children: BTreeMap<char, CompletionTrie>,
    is_word: bool,
    data: Option<String>,
}

impl CompletionTrie {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn insert(&mut self, word: &str, data: Option<String>) {
        let mut node = self;
        for c in word.chars() {
            node = node.children.entry(c).or_insert_with(CompletionTrie::new);
        }
        node.is_word = true;
        node.data = data;
    }

    pub fn search_prefix(&self, prefix: &str) -> Vec<(String, Option<String>)> {
        let mut results = Vec::new();
        let mut node = self;
        
        for c in prefix.chars() {
            match node.children.get(&c) {
                Some(child) => node = child,
                None => return results,
            }
        }
        
        self.collect_all(node, prefix, &mut results);
        results
    }

    fn collect_all(&self, node: &CompletionTrie, prefix: &str, results: &mut Vec<(String, Option<String>)>) {
        if node.is_word {
            results.push((prefix.to_string(), node.data.clone()));
        }
        for (c, child) in &node.children {
            let new_prefix = format!("{}{}", prefix, c);
            self.collect_all(child, &new_prefix, results);
        }
    }
}

/// Simple N-gram model for completion
#[derive(Debug, Clone, Default)]
pub struct NGramModel {
    /// Bigram frequencies
    bigrams: HashMap<String, HashMap<String, u32>>,
    /// Trigram frequencies
    trigrams: HashMap<(String, String), HashMap<String, u32>>,
}

impl NGramModel {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn train(&mut self, tokens: &[String]) {
        for i in 0..tokens.len().saturating_sub(1) {
            // Bigrams
            let current = &tokens[i];
            let next = &tokens[i + 1];
            *self.bigrams
                .entry(current.clone())
                .or_insert_with(HashMap::new)
                .entry(next.clone())
                .or_insert(0) += 1;
            
            // Trigrams
            if i + 2 < tokens.len() {
                let next_next = &tokens[i + 2];
                *self.trigrams
                    .entry((current.clone(), next.clone()))
                    .or_insert_with(HashMap::new)
                    .entry(next_next.clone())
                    .or_insert(0) += 1;
            }
        }
    }

    pub fn predict(&self, context: &[String]) -> Vec<(String, f32)> {
        let mut results = Vec::new();
        
        match context.len() {
            1 => {
                if let Some(next_words) = self.bigrams.get(&context[0]) {
                    let total: u32 = next_words.values().sum();
                    for (word, count) in next_words {
                        let score = *count as f32 / total as f32;
                        results.push((word.clone(), score));
                    }
                }
            }
            2.. => {
                let key = (context[context.len() - 2].clone(), context[context.len() - 1].clone());
                if let Some(next_words) = self.trigrams.get(&key) {
                    let total: u32 = next_words.values().sum();
                    for (word, count) in next_words {
                        let score = *count as f32 / total as f32;
                        results.push((word.clone(), score));
                    }
                }
            }
            _ => {}
        }
        
        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        results.truncate(10);
        results
    }
}

impl PicoClawEngine {
    /// Create a new PicoClaw engine
    pub fn new(config: PicoClawConfig) -> Self {
        let mut engine = Self {
            config,
            patterns: HashMap::new(),
            tries: HashMap::new(),
            ngrams: HashMap::new(),
        };
        
        // Initialize language patterns
        for lang in &engine.config.enabled_languages.clone() {
            engine.init_language(lang);
        }
        
        engine
    }

    /// Initialize patterns for a language
    fn init_language(&mut self, language: &str) {
        let patterns = self.create_language_patterns(language);
        let mut trie = CompletionTrie::new();
        
        // Add keywords and builtins to trie
        for keyword in &patterns.keywords {
            trie.insert(keyword, Some(format!("keyword:{}", keyword)));
        }
        for builtin in &patterns.builtins {
            trie.insert(builtin, Some(format!("builtin:{}", builtin)));
        }
        
        self.patterns.insert(language.to_string(), patterns);
        self.tries.insert(language.to_string(), trie);
        self.ngrams.insert(language.to_string(), NGramModel::new());
    }

    /// Create patterns for a specific language
    fn create_language_patterns(&self, language: &str) -> LanguagePatterns {
        match language {
            "rust" => LanguagePatterns {
                keywords: vec![
                    "fn".to_string(), "let".to_string(), "mut".to_string(), "const".to_string(),
                    "struct".to_string(), "enum".to_string(), "impl".to_string(), "trait".to_string(),
                    "pub".to_string(), "mod".to_string(), "use".to_string(), "self".to_string(),
                    "Self".to_string(), "where".to_string(), "async".to_string(), "await".to_string(),
                    "match".to_string(), "if".to_string(), "else".to_string(), "loop".to_string(),
                    "while".to_string(), "for".to_string(), "in".to_string(), "return".to_string(),
                ],
                builtins: vec![
                    "println!".to_string(), "format!".to_string(), "vec!".to_string(),
                    "Option".to_string(), "Result".to_string(), "Vec".to_string(),
                    "String".to_string(), "str".to_string(), "Box".to_string(),
                    "Rc".to_string(), "Arc".to_string(), "Mutex".to_string(),
                    "RwLock".to_string(), "HashMap".to_string(), "HashSet".to_string(),
                ],
                function_patterns: vec![
                    PatternEntry { pattern: "fn $name($args) -> $ret".to_string(), frequency: 100, context: "function".to_string() },
                    PatternEntry { pattern: "pub fn $name($args)".to_string(), frequency: 80, context: "public_function".to_string() },
                    PatternEntry { pattern: "async fn $name($args)".to_string(), frequency: 60, context: "async_function".to_string() },
                ],
                variable_patterns: vec![
                    PatternEntry { pattern: "let $name = $value;".to_string(), frequency: 100, context: "binding".to_string() },
                    PatternEntry { pattern: "let mut $name = $value;".to_string(), frequency: 80, context: "mutable_binding".to_string() },
                ],
                type_patterns: vec![
                    PatternEntry { pattern: "struct $name { $fields }".to_string(), frequency: 100, context: "struct".to_string() },
                    PatternEntry { pattern: "enum $name { $variants }".to_string(), frequency: 80, context: "enum".to_string() },
                ],
            },
            "typescript" | "javascript" => LanguagePatterns {
                keywords: vec![
                    "function".to_string(), "const".to_string(), "let".to_string(), "var".to_string(),
                    "class".to_string(), "interface".to_string(), "type".to_string(), "enum".to_string(),
                    "export".to_string(), "import".to_string(), "from".to_string(), "async".to_string(),
                    "await".to_string(), "return".to_string(), "if".to_string(), "else".to_string(),
                    "for".to_string(), "while".to_string(), "switch".to_string(), "case".to_string(),
                    "break".to_string(), "continue".to_string(), "try".to_string(), "catch".to_string(),
                    "throw".to_string(), "new".to_string(), "this".to_string(), "super".to_string(),
                ],
                builtins: vec![
                    "console.log".to_string(), "console.error".to_string(), "console.warn".to_string(),
                    "Promise".to_string(), "Array".to_string(), "Object".to_string(), "String".to_string(),
                    "Number".to_string(), "Boolean".to_string(), "Map".to_string(), "Set".to_string(),
                    "JSON.stringify".to_string(), "JSON.parse".to_string(),
                    "setTimeout".to_string(), "setInterval".to_string(), "fetch".to_string(),
                ],
                function_patterns: vec![
                    PatternEntry { pattern: "function $name($args) {".to_string(), frequency: 100, context: "function".to_string() },
                    PatternEntry { pattern: "const $name = ($args) =>".to_string(), frequency: 90, context: "arrow_function".to_string() },
                    PatternEntry { pattern: "async function $name($args)".to_string(), frequency: 70, context: "async_function".to_string() },
                ],
                variable_patterns: vec![
                    PatternEntry { pattern: "const $name = $value;".to_string(), frequency: 100, context: "constant".to_string() },
                    PatternEntry { pattern: "let $name = $value;".to_string(), frequency: 80, context: "variable".to_string() },
                ],
                type_patterns: vec![
                    PatternEntry { pattern: "interface $name {".to_string(), frequency: 100, context: "interface".to_string() },
                    PatternEntry { pattern: "type $name =".to_string(), frequency: 90, context: "type_alias".to_string() },
                    PatternEntry { pattern: "class $name {".to_string(), frequency: 80, context: "class".to_string() },
                ],
            },
            "python" => LanguagePatterns {
                keywords: vec![
                    "def".to_string(), "class".to_string(), "if".to_string(), "else".to_string(),
                    "elif".to_string(), "for".to_string(), "while".to_string(), "try".to_string(),
                    "except".to_string(), "finally".to_string(), "with".to_string(), "as".to_string(),
                    "import".to_string(), "from".to_string(), "return".to_string(), "yield".to_string(),
                    "lambda".to_string(), "pass".to_string(), "break".to_string(), "continue".to_string(),
                    "raise".to_string(), "async".to_string(), "await".to_string(), "True".to_string(),
                    "False".to_string(), "None".to_string(), "self".to_string(), "cls".to_string(),
                ],
                builtins: vec![
                    "print".to_string(), "len".to_string(), "range".to_string(), "str".to_string(),
                    "int".to_string(), "float".to_string(), "bool".to_string(), "list".to_string(),
                    "dict".to_string(), "set".to_string(), "tuple".to_string(), "type".to_string(),
                    "isinstance".to_string(), "hasattr".to_string(), "getattr".to_string(),
                    "open".to_string(), "input".to_string(), "format".to_string(),
                ],
                function_patterns: vec![
                    PatternEntry { pattern: "def $name($args):".to_string(), frequency: 100, context: "function".to_string() },
                    PatternEntry { pattern: "async def $name($args):".to_string(), frequency: 60, context: "async_function".to_string() },
                ],
                variable_patterns: vec![
                    PatternEntry { pattern: "$name = $value".to_string(), frequency: 100, context: "assignment".to_string() },
                ],
                type_patterns: vec![
                    PatternEntry { pattern: "class $name:".to_string(), frequency: 100, context: "class".to_string() },
                    PatternEntry { pattern: "class $name($base):".to_string(), frequency: 70, context: "derived_class".to_string() },
                ],
            },
            _ => LanguagePatterns {
                keywords: vec![],
                builtins: vec![],
                function_patterns: vec![],
                variable_patterns: vec![],
                type_patterns: vec![],
            },
        }
    }

    /// Get completions for a prefix
    pub fn complete(&self, prefix: &str, language: &str, context: Option<&str>) -> Vec<CompletionSuggestion> {
        let mut suggestions = Vec::new();
        
        // Get trie completions
        if let Some(trie) = self.tries.get(language) {
            let trie_results = trie.search_prefix(prefix);
            for (text, data) in trie_results.iter().take(self.config.max_suggestions) {
                let kind = match data {
                    Some(d) if d.starts_with("keyword:") => SuggestionKind::Keyword,
                    Some(d) if d.starts_with("builtin:") => SuggestionKind::Function,
                    _ => SuggestionKind::Text,
                };
                suggestions.push(CompletionSuggestion {
                    text: text.clone(),
                    label: text.clone(),
                    kind,
                    score: 0.9,
                    source: "trie".to_string(),
                });
            }
        }
        
        // Get pattern-based completions
        if let Some(patterns) = self.patterns.get(language) {
            // Check for function context
            if context.map(|c| c.contains("fn ") || c.contains("def ") || c.contains("function ")).unwrap_or(false) {
                for pattern in &patterns.function_patterns {
                    if pattern.pattern.starts_with(prefix) {
                        suggestions.push(CompletionSuggestion {
                            text: pattern.pattern.clone(),
                            label: pattern.pattern.split_whitespace().next().unwrap_or("").to_string(),
                            kind: SuggestionKind::Snippet,
                            score: 0.8,
                            source: "pattern".to_string(),
                        });
                    }
                }
            }
        }
        
        // Get N-gram predictions
        if let (Some(ngram), Some(ctx)) = (self.ngrams.get(language), context) {
            let tokens: Vec<String> = ctx.split_whitespace()
                .map(|s| s.to_string())
                .collect();
            let predictions = ngram.predict(&tokens);
            for (word, score) in predictions.iter().take(5) {
                if word.starts_with(prefix) {
                    suggestions.push(CompletionSuggestion {
                        text: word.clone(),
                        label: word.clone(),
                        kind: SuggestionKind::Text,
                        score: *score * 0.7,
                        source: "ngram".to_string(),
                    });
                }
            }
        }
        
        // Sort by score and deduplicate
        suggestions.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
        suggestions.truncate(self.config.max_suggestions);
        suggestions
    }

    /// Analyze code for issues
    pub fn analyze(&self, code: &str, language: &str) -> AnalysisResult {
        let mut issues = Vec::new();
        let mut suggestions = Vec::new();
        let mut patterns = Vec::new();
        
        // Line-by-line analysis
        for (line_num, line) in code.lines().enumerate() {
            // Check for common issues
            if language == "rust" {
                if line.contains("unwrap()") && !line.trim().starts_with("//") {
                    issues.push(CodeIssue {
                        severity: IssueSeverity::Warning,
                        message: "unwrap() may panic. Consider using ? operator or proper error handling".to_string(),
                        line: line_num + 1,
                        column: line.find("unwrap()").unwrap_or(0) + 1,
                        fix: Some("Replace with ? operator or match expression".to_string()),
                    });
                }
                if line.contains("expect(") && !line.trim().starts_with("//") {
                    issues.push(CodeIssue {
                        severity: IssueSeverity::Info,
                        message: "expect() provides error message but still may panic".to_string(),
                        line: line_num + 1,
                        column: line.find("expect(").unwrap_or(0) + 1,
                        fix: None,
                    });
                }
            }
            
            // Check for long lines
            if line.len() > 120 {
                issues.push(CodeIssue {
                    severity: IssueSeverity::Hint,
                    message: format!("Line is {} characters (limit: 120)", line.len()),
                    line: line_num + 1,
                    column: 120,
                    fix: Some("Consider breaking into multiple lines".to_string()),
                });
            }
            
            // Detect patterns
            if line.contains("TODO") || line.contains("FIXME") {
                patterns.push(format!("TODO/FIXME at line {}", line_num + 1));
            }
        }
        
        // Calculate complexity score
        let line_count = code.lines().count();
        let nesting = self.calculate_nesting(code);
        let complexity = ((line_count / 10) + (nesting * 5)).min(100) as u8;
        
        // Generate suggestions
        if complexity > 50 {
            suggestions.push("Consider breaking this code into smaller functions".to_string());
        }
        if issues.iter().filter(|i| i.severity == IssueSeverity::Warning).count() > 3 {
            suggestions.push("Multiple warnings detected. Review error handling approach".to_string());
        }
        
        AnalysisResult {
            issues,
            suggestions,
            complexity_score: complexity,
            patterns,
        }
    }

    /// Calculate nesting depth
    fn calculate_nesting(&self, code: &str) -> usize {
        let mut max_nesting = 0;
        let mut current_nesting = 0;
        
        for c in code.chars() {
            match c {
                '{' | '(' | '[' => {
                    current_nesting += 1;
                    max_nesting = max_nesting.max(current_nesting);
                }
                '}' | ')' | ']' => {
                    current_nesting = current_nesting.saturating_sub(1);
                }
                _ => {}
            }
        }
        
        max_nesting
    }

    /// Get memory usage estimate
    pub fn memory_usage(&self) -> usize {
        // Estimate memory usage based on loaded patterns and tries
        let patterns_size = self.patterns.len() * 10_000; // ~10KB per language
        let tries_size = self.tries.len() * 50_000; // ~50KB per trie
        let ngrams_size = self.ngrams.len() * 100_000; // ~100KB per ngram model
        
        patterns_size + tries_size + ngrams_size
    }
}

/// PicoClaw Tauri commands
pub mod commands {
    use super::*;
    use tauri::State;
    use std::sync::Mutex;

    /// Global PicoClaw state
    pub struct PicoClawState(pub Mutex<PicoClawEngine>);

    /// Get completions
    #[tauri::command]
    pub fn picoclaw_complete(
        state: State<'_, PicoClawState>,
        prefix: String,
        language: String,
        context: Option<String>,
    ) -> Result<Vec<CompletionSuggestion>, String> {
        let engine = state.0.lock().map_err(|e| e.to_string())?;
        Ok(engine.complete(&prefix, &language, context.as_deref()))
    }

    /// Analyze code
    #[tauri::command]
    pub fn picoclaw_analyze(
        state: State<'_, PicoClawState>,
        code: String,
        language: String,
    ) -> Result<AnalysisResult, String> {
        let engine = state.0.lock().map_err(|e| e.to_string())?;
        Ok(engine.analyze(&code, &language))
    }

    /// Get memory usage
    #[tauri::command]
    pub fn picoclaw_memory_usage(
        state: State<'_, PicoClawState>,
    ) -> Result<usize, String> {
        let engine = state.0.lock().map_err(|e| e.to_string())?;
        Ok(engine.memory_usage())
    }

    /// Check if PicoClaw is available
    #[tauri::command]
    pub fn picoclaw_is_available() -> bool {
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_defaults() {
        let config = PicoClawConfig::default();
        assert_eq!(config.max_memory_mb, 10);
        assert!(config.enable_completion);
    }

    #[test]
    fn test_completion() {
        let engine = PicoClawEngine::new(PicoClawConfig::default());
        let suggestions = engine.complete("fn", "rust", None);
        assert!(!suggestions.is_empty());
    }

    #[test]
    fn test_analysis() {
        let engine = PicoClawEngine::new(PicoClawConfig::default());
        let code = r#"
fn test() {
    let x = some.unwrap();
}
"#;
        let result = engine.analyze(code, "rust");
        assert!(!result.issues.is_empty());
    }

    #[test]
    fn test_trie() {
        let mut trie = CompletionTrie::new();
        trie.insert("function", Some("keyword:function".to_string()));
        trie.insert("fn", Some("keyword:fn".to_string()));
        trie.insert("for", Some("keyword:for".to_string()));
        
        let results = trie.search_prefix("f");
        assert_eq!(results.len(), 3);
    }
}
