//! Memory Compression Module
//!
//! Uses tree-sitter to strip function/method bodies, keeping only
//! structural signatures to reduce context token usage for the LLM.

/// Compresses code by stripping implementation bodies using tree-sitter,
/// keeping only signatures. Falls back to line-based heuristics if
/// tree-sitter parsing fails for the given language.
pub fn compress_ast_to_signatures(code: &str, language: &str) -> String {
    let ts_lang: Option<tree_sitter::Language> = match language {
        "rust" => Some(tree_sitter_rust::LANGUAGE.into()),
        "typescript" => Some(tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into()),
        "javascript" => Some(tree_sitter_typescript::LANGUAGE_TSX.into()),
        "python" => Some(tree_sitter_python::LANGUAGE.into()),
        "go" => Some(tree_sitter_go::LANGUAGE.into()),
        "java" => Some(tree_sitter_java::LANGUAGE.into()),
        "c" => Some(tree_sitter_c::LANGUAGE.into()),
        "cpp" => Some(tree_sitter_cpp::LANGUAGE.into()),
        _ => None,
    };

    if let Some(lang) = ts_lang {
        let mut parser = tree_sitter::Parser::new();
        if parser.set_language(&lang).is_ok() {
            if let Some(tree) = parser.parse(code, None) {
                let mut result = String::new();
                collect_signatures(tree.root_node(), code.as_bytes(), language, &mut result, 0);
                if !result.is_empty() {
                    return result;
                }
            }
        }
    }

    // Fallback: line-based heuristic
    compress_by_lines(code, language)
}

/// Walk the AST and emit only declaration signatures (skip bodies)
fn collect_signatures(
    node: tree_sitter::Node,
    source: &[u8],
    language: &str,
    out: &mut String,
    depth: usize,
) {
    let kind = node.kind();
    let body_kinds = match language {
        "rust" => &["block", "field_declaration_list", "declaration_list"][..],
        "typescript" | "javascript" => &["statement_block", "class_body"][..],
        "python" => &["block"][..],
        "go" => &["block"][..],
        "java" => &["block", "class_body", "interface_body"][..],
        "c" | "cpp" => &["compound_statement", "field_declaration_list"][..],
        _ => &[][..],
    };

    let is_declaration = matches!(
        kind,
        "function_item"
            | "function_declaration"
            | "function_definition"
            | "method_definition"
            | "struct_item"
            | "class_declaration"
            | "class_definition"
            | "enum_item"
            | "enum_declaration"
            | "trait_item"
            | "interface_declaration"
            | "impl_item"
            | "type_item"
            | "type_alias_declaration"
            | "const_item"
            | "static_item"
    );

    if is_declaration {
        // Emit everything EXCEPT the body block
        let text = node.utf8_text(source).unwrap_or("");
        // Find the body child and take text up to it
        let mut body_start = None;
        for i in 0..node.child_count() {
            if let Some(child) = node.child(i) {
                if body_kinds.contains(&child.kind()) {
                    body_start = Some(child.start_byte() - node.start_byte());
                    break;
                }
            }
        }
        let indent = "  ".repeat(depth);
        match body_start {
            Some(offset) => {
                let sig = &text[..offset].trim_end();
                out.push_str(&format!("{}{} {{ /* ... */ }}\n", indent, sig));
            }
            None => {
                let first_line = text.lines().next().unwrap_or(text);
                out.push_str(&format!("{}{}\n", indent, first_line.trim()));
            }
        }
        // For containers (impl, class), recurse into body to find nested decls
        if matches!(
            kind,
            "impl_item"
                | "class_declaration"
                | "class_definition"
                | "class_body"
                | "interface_declaration"
        ) {
            for i in 0..node.child_count() {
                if let Some(child) = node.child(i) {
                    if body_kinds.contains(&child.kind()) {
                        for j in 0..child.child_count() {
                            if let Some(inner) = child.child(j) {
                                collect_signatures(inner, source, language, out, depth + 1);
                            }
                        }
                    }
                }
            }
        }
    } else if matches!(
        kind,
        "use_declaration" | "import_statement" | "import_declaration" | "preproc_include"
    ) {
        // Keep imports as-is
        let text = node.utf8_text(source).unwrap_or("").trim();
        out.push_str(text);
        out.push('\n');
    } else {
        // Recurse (for top-level items in source_file, etc.)
        for i in 0..node.child_count() {
            if let Some(child) = node.child(i) {
                collect_signatures(child, source, language, out, depth);
            }
        }
    }
}

/// Compresses chat history by keeping only the tail when too large
pub fn compress_chat_history(history_text: &str) -> String {
    if history_text.len() > 2000 {
        format!(
            "... [prior history compressed] ...\n{}",
            &history_text[history_text.len() - 2000..]
        )
    } else {
        history_text.to_string()
    }
}

/// Line-based fallback compression
fn compress_by_lines(code: &str, _language: &str) -> String {
    let mut result = String::new();
    let mut brace_depth = 0i32;
    let mut in_body = false;

    for line in code.lines() {
        let trimmed = line.trim();
        let opens = trimmed.matches('{').count() as i32;
        let closes = trimmed.matches('}').count() as i32;

        if !in_body {
            result.push_str(line);
            result.push('\n');
        }

        brace_depth += opens - closes;

        if opens > 0 && !in_body && brace_depth > 1 {
            in_body = true;
            result.push_str("  // ... [body pruned]\n");
        }
        if brace_depth <= 1 && in_body {
            in_body = false;
            if closes > 0 {
                result.push_str("}\n");
            }
        }
    }
    result
}
