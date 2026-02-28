//! Context Builder for Chat
//!
//! Builds rich context for LLM from code, RAG, and project structure

use super::*;
use anyhow::{Result, Context};
use std::path::{Path, PathBuf};
use std::collections::HashSet;

/// Context builder for creating rich prompts
pub struct ContextBuilder {
    max_tokens: usize,
    token_estimator: TokenEstimator,
}

impl ContextBuilder {
    pub fn new(max_tokens: usize) -> Self {
        Self {
            max_tokens,
            token_estimator: TokenEstimator::new(),
        }
    }

    /// Build context from multiple sources
    pub fn build(
        &self,
        query: &str,
        current_file: Option<&CodeSnippet>,
        open_files: &[CodeSnippet],
        rag_results: &[RagSource],
        project_structure: Option<&ProjectStructure>,
    ) -> Result<BuildContext> {
        let mut parts = Vec::new();
        let mut used_tokens = 0;
        let mut included_files = HashSet::new();

        // Reserve tokens for system prompt and response
        let reserved_tokens = 1000;
        let available_tokens = self.max_tokens.saturating_sub(reserved_tokens);

        // Add project structure first (small footprint)
        if let Some(structure) = project_structure {
            let structure_context = self.format_project_structure(structure);
            let tokens = self.token_estimator.estimate(&structure_context);
            if used_tokens + tokens < available_tokens {
                parts.push(ContextPart::ProjectStructure(structure_context));
                used_tokens += tokens;
            }
        }

        // Add current file (high priority)
        if let Some(file) = current_file {
            let file_context = self.format_file_context(file, true);
            let tokens = self.token_estimator.estimate(&file_context);
            if used_tokens + tokens < available_tokens {
                parts.push(ContextPart::CurrentFile(file_context));
                included_files.insert(file.file_path.clone());
                used_tokens += tokens;
            }
        }

        // Add RAG results (medium priority)
        for source in rag_results {
            if included_files.contains(&source.file_path) {
                continue;
            }

            let rag_context = self.format_rag_source(source);
            let tokens = self.token_estimator.estimate(&rag_context);

            if used_tokens + tokens < available_tokens {
                parts.push(ContextPart::RagSource(rag_context));
                used_tokens += tokens;
            }
        }

        // Add open files (lower priority)
        for file in open_files {
            if included_files.contains(&file.file_path) {
                continue;
            }

            let file_context = self.format_file_context(file, false);
            let tokens = self.token_estimator.estimate(&file_context);

            if used_tokens + tokens < available_tokens {
                parts.push(ContextPart::OpenFile(file_context));
                included_files.insert(file.file_path.clone());
                used_tokens += tokens;
            }
        }

        Ok(BuildContext {
            parts,
            total_tokens: used_tokens,
            included_files: included_files.into_iter().collect(),
        })
    }

    /// Format project structure
    fn format_project_structure(&self, structure: &ProjectStructure) -> String {
        let mut result = String::from("[PROJECT STRUCTURE]\n");

        // Add directories
        result.push_str("Directories:\n");
        for dir in structure.directories.iter().take(20) {
            result.push_str(&format!("  {}/\n", dir));
        }

        // Add key files
        result.push_str("\nKey files:\n");
        for file in structure.key_files.iter().take(30) {
            result.push_str(&format!("  {}\n", file));
        }

        // Add language stats
        if !structure.languages.is_empty() {
            result.push_str("\nLanguages:\n");
            for (lang, count) in &structure.languages {
                result.push_str(&format!("  {}: {} files\n", lang, count));
            }
        }

        result
    }

    /// Format file context
    fn format_file_context(&self, file: &CodeSnippet, is_current: bool) -> String {
        let header = if is_current { "[CURRENT FILE]" } else { "[OPEN FILE]" };

        format!(
            "{} {} (lines {}-{})\n```{}\n{}\n```",
            header,
            file.file_path,
            file.start_line,
            file.end_line,
            file.language,
            file.content
        )
    }

    /// Format RAG source
    fn format_rag_source(&self, source: &RagSource) -> String {
        format!(
            "[RELEVANT: {}:{}-{} (relevance: {:.1}%)]\n{}\n",
            source.file_path,
            source.start_line,
            source.end_line,
            source.score * 100.0,
            source.preview
        )
    }

    /// Render context to string
    pub fn render(&self, context: &BuildContext) -> String {
        context.parts.iter()
            .map(|p| match p {
                ContextPart::ProjectStructure(s) => s.clone(),
                ContextPart::CurrentFile(s) => s.clone(),
                ContextPart::OpenFile(s) => s.clone(),
                ContextPart::RagSource(s) => s.clone(),
            })
            .collect::<Vec<_>>()
            .join("\n\n")
    }
}

/// Build context result
#[derive(Debug, Clone)]
pub struct BuildContext {
    pub parts: Vec<ContextPart>,
    pub total_tokens: usize,
    pub included_files: Vec<String>,
}

/// Context part types
#[derive(Debug, Clone)]
pub enum ContextPart {
    ProjectStructure(String),
    CurrentFile(String),
    OpenFile(String),
    RagSource(String),
}

/// Project structure info
#[derive(Debug, Clone, Default)]
pub struct ProjectStructure {
    pub directories: Vec<String>,
    pub key_files: Vec<String>,
    pub languages: std::collections::HashMap<String, usize>,
    pub total_files: usize,
    pub total_lines: usize,
}

/// Token estimator
pub struct TokenEstimator {
    // GPT-4 style tokenization approximation
    avg_chars_per_token: f32,
}

impl TokenEstimator {
    pub fn new() -> Self {
        // Rough approximation: 1 token ≈ 4 characters for English/code
        Self {
            avg_chars_per_token: 4.0,
        }
    }

    /// Estimate token count for text
    pub fn estimate(&self, text: &str) -> usize {
        // More accurate for code: count whitespace + punctuation separately
        let char_count = text.chars().count();
        let word_count = text.split_whitespace().count();

        // Code typically has more tokens per word due to symbols
        let base_estimate = (char_count as f32 / self.avg_chars_per_token) as usize;

        // Adjust for code symbols
        let symbol_count = text.chars()
            .filter(|c| matches!(c, '{' | '}' | '(' | ')' | '[' | ']' | ';' | ',' | '.' | ':' | '=' | '<' | '>'))
            .count();

        base_estimate + (symbol_count / 2)
    }
}

impl Default for TokenEstimator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_estimator() {
        let estimator = TokenEstimator::new();

        let simple = "hello world";
        let tokens = estimator.estimate(simple);
        assert!(tokens > 0);

        let code = "fn main() { println!(\"hello\"); }";
        let code_tokens = estimator.estimate(code);
        assert!(code_tokens > tokens);
    }

    #[test]
    fn test_context_builder() {
        let builder = ContextBuilder::new(4096);

        let file = CodeSnippet {
            file_path: "test.rs".to_string(),
            start_line: 1,
            end_line: 10,
            content: "fn main() {}".to_string(),
            language: "rust".to_string(),
        };

        let context = builder.build(
            "what does this code do?",
            Some(&file),
            &[],
            &[],
            None,
        ).unwrap();

        assert!(!context.parts.is_empty());
        assert!(context.included_files.contains(&"test.rs".to_string()));
    }
}
