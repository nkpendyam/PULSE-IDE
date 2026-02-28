//! Memory Compression Module
//!
//! Handles "AST Pruning" by stripping function bodies out of text sources
//! to violently reduce context token limits for the LLM.

use regex::Regex;

/// Compresses raw code by attempting to strip out implementation bodies,
/// leaving only the structural signatures and signatures for the LLM.
/// This is the "Systems Toon" aggressive context compression.
pub fn compress_ast_to_signatures(code: &str, language: &str) -> String {
    // Note: In a real implementation, this should hook directly into the
    // existing Tree-sitter trees. Since we are inside the `memory` module,
    // we use a crude fallback heuristic if Tree-sitter isn't passed down.
    
    if language == "rust" {
        // Crude heuristics for stripping Rust function bodies
        let re = Regex::new(r"(?m)^(.*?fn\s+.*?\s*\{).*?(\n\})").unwrap();
        re.replace_all(code, "$1\n    // ... [body pruned for context limits] ...\n}").to_string()
    } else if language == "typescript" || language == "javascript" {
        let re = Regex::new(r"(?m)^(.*?function\s+.*?\s*\{|.*?class\s+.*?\s*\{).*?(\n\})").unwrap();
        re.replace_all(code, "$1\n  // ... [body pruned] ...\n}").to_string()
    } else {
        // Fallback: Just truncate if we don't know the language
        if code.len() > 1000 {
            format!("{}... [{} chars pruned]", &code[..1000], code.len() - 1000)
        } else {
            code.to_string()
        }
    }
}

/// Aggressively compresses chat history by removing old reflection and reasoning steps
pub fn compress_chat_history(history_text: &str) -> String {
    if history_text.len() > 2000 {
        format!("... [prior history compressed] ...\n{}", &history_text[history_text.len() - 2000..])
    } else {
        history_text.to_string()
    }
}
