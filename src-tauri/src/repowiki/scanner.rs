//! Scanner — walks the project tree, parses each file with tree-sitter,
//! and extracts symbols, imports, and exports.

use super::{
    ExportInfo, FileEntry, ImportInfo, RepoWikiConfig, SymbolInfo, SymbolKind, Visibility,
};
use sha2::{Digest, Sha256};
use std::path::Path;
use walkdir::WalkDir;

// ─── Public API ─────────────────────────────────────────────────────────

/// Scan the entire project and return a list of FileEntries
pub fn scan_project(config: &RepoWikiConfig) -> Result<Vec<FileEntry>, String> {
    let root = &config.project_path;
    if !root.exists() {
        return Err(format!("Project path does not exist: {:?}", root));
    }

    let mut entries = Vec::new();
    for entry in WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        if should_ignore(path, root, config) {
            continue;
        }
        if let Ok(fe) = scan_single_file(path, config) {
            entries.push(fe);
        }
    }
    Ok(entries)
}

/// Scan a single file and return a FileEntry
pub fn scan_single_file(path: &Path, config: &RepoWikiConfig) -> Result<FileEntry, String> {
    let root = &config.project_path;
    let rel_path = path
        .strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/");

    let content =
        std::fs::read_to_string(path).map_err(|e| format!("Cannot read {:?}: {}", path, e))?;

    let language = detect_language(path);
    let line_count = content.lines().count();
    let content_hash = {
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        hex::encode(hasher.finalize())
    };

    let (symbols, imports, exports) = extract_ast(&content, &language);

    Ok(FileEntry {
        rel_path,
        language,
        line_count,
        symbols,
        imports,
        exports,
        content_hash,
    })
}

// ─── Filtering ──────────────────────────────────────────────────────────

fn should_ignore(path: &Path, root: &Path, config: &RepoWikiConfig) -> bool {
    let rel = path.strip_prefix(root).unwrap_or(path);

    // Check ignored directories
    for component in rel.components() {
        let s = component.as_os_str().to_string_lossy();
        if config.ignore_dirs.iter().any(|d| d == s.as_ref()) {
            return true;
        }
    }

    // Check extension whitelist
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        if !config.extensions.iter().any(|e| e == ext) {
            return true;
        }
    } else {
        return true; // no extension → skip
    }

    false
}

fn detect_language(path: &Path) -> String {
    match path.extension().and_then(|e| e.to_str()) {
        Some("rs") => "rust",
        Some("ts") | Some("tsx") => "typescript",
        Some("js") | Some("jsx") => "javascript",
        Some("py") => "python",
        Some("go") => "go",
        Some("java") => "java",
        Some("c") | Some("h") => "c",
        Some("cpp") | Some("hpp") | Some("cc") | Some("cxx") => "cpp",
        _ => "unknown",
    }
    .to_string()
}

// ─── Tree-sitter AST Extraction ─────────────────────────────────────────

fn extract_ast(
    content: &str,
    language: &str,
) -> (Vec<SymbolInfo>, Vec<ImportInfo>, Vec<ExportInfo>) {
    let ts_lang = match language {
        "rust" => tree_sitter_rust::LANGUAGE,
        "typescript" => tree_sitter_typescript::LANGUAGE_TYPESCRIPT,
        "javascript" => tree_sitter_typescript::LANGUAGE_TSX,
        "python" => tree_sitter_python::LANGUAGE,
        "go" => tree_sitter_go::LANGUAGE,
        "java" => tree_sitter_java::LANGUAGE,
        "c" => tree_sitter_c::LANGUAGE,
        "cpp" => tree_sitter_cpp::LANGUAGE,
        _ => return (Vec::new(), Vec::new(), Vec::new()),
    };

    let mut parser = tree_sitter::Parser::new();
    if parser.set_language(&ts_lang.into()).is_err() {
        return (Vec::new(), Vec::new(), Vec::new());
    }
    let tree = match parser.parse(content, None) {
        Some(t) => t,
        None => return (Vec::new(), Vec::new(), Vec::new()),
    };

    let root = tree.root_node();
    let bytes = content.as_bytes();
    let mut symbols = Vec::new();
    let mut imports = Vec::new();
    let mut exports = Vec::new();

    collect_nodes(
        root,
        bytes,
        language,
        &mut symbols,
        &mut imports,
        &mut exports,
    );
    (symbols, imports, exports)
}

// ─── Recursive AST Visitor ──────────────────────────────────────────────

fn collect_nodes(
    node: tree_sitter::Node,
    source: &[u8],
    language: &str,
    symbols: &mut Vec<SymbolInfo>,
    imports: &mut Vec<ImportInfo>,
    exports: &mut Vec<ExportInfo>,
) {
    let _kind = node.kind();

    // ── Symbols ─────────────────────────────────────────────
    if let Some(sym) = try_extract_symbol(node, source, language) {
        // Also register as export if public
        if sym.visibility == Visibility::Public {
            exports.push(ExportInfo {
                name: sym.name.clone(),
                kind: sym.kind.clone(),
                line: sym.start_line,
            });
        }
        symbols.push(sym);
    }

    // ── Imports ─────────────────────────────────────────────
    if let Some(imp) = try_extract_import(node, source, language) {
        imports.push(imp);
    }

    // Recurse into children
    let child_count = node.child_count();
    for i in 0..child_count {
        if let Some(child) = node.child(i) {
            collect_nodes(child, source, language, symbols, imports, exports);
        }
    }
}

// ─── Symbol Extraction ──────────────────────────────────────────────────

fn try_extract_symbol(
    node: tree_sitter::Node,
    source: &[u8],
    language: &str,
) -> Option<SymbolInfo> {
    let kind_str = node.kind();

    let (sym_kind, vis_default) = match language {
        "rust" => match kind_str {
            "function_item" => (SymbolKind::Function, Visibility::Private),
            "impl_item" => (SymbolKind::Struct, Visibility::Private), // impl block
            "struct_item" => (SymbolKind::Struct, Visibility::Private),
            "enum_item" => (SymbolKind::Enum, Visibility::Private),
            "trait_item" => (SymbolKind::Trait, Visibility::Private),
            "mod_item" => (SymbolKind::Module, Visibility::Private),
            "macro_definition" => (SymbolKind::Macro, Visibility::Private),
            "const_item" | "static_item" => (SymbolKind::Constant, Visibility::Private),
            "type_item" => (SymbolKind::TypeAlias, Visibility::Private),
            _ => return None,
        },
        "typescript" | "javascript" => match kind_str {
            "function_declaration" => (SymbolKind::Function, Visibility::Private),
            "class_declaration" => (SymbolKind::Class, Visibility::Private),
            "interface_declaration" => (SymbolKind::Interface, Visibility::Private),
            "type_alias_declaration" => (SymbolKind::TypeAlias, Visibility::Private),
            "method_definition" => (SymbolKind::Method, Visibility::Private),
            _ => return None,
        },
        "python" => match kind_str {
            "function_definition" => (SymbolKind::Function, Visibility::Public),
            "class_definition" => (SymbolKind::Class, Visibility::Public),
            _ => return None,
        },
        "go" => match kind_str {
            "function_declaration" => (SymbolKind::Function, Visibility::Private),
            "method_declaration" => (SymbolKind::Method, Visibility::Private),
            "type_declaration" => (SymbolKind::TypeAlias, Visibility::Private),
            _ => return None,
        },
        "java" => match kind_str {
            "class_declaration" => (SymbolKind::Class, Visibility::Private),
            "method_declaration" => (SymbolKind::Method, Visibility::Private),
            "interface_declaration" => (SymbolKind::Interface, Visibility::Private),
            "enum_declaration" => (SymbolKind::Enum, Visibility::Private),
            _ => return None,
        },
        "c" | "cpp" => match kind_str {
            "function_definition" => (SymbolKind::Function, Visibility::Public),
            "struct_specifier" => (SymbolKind::Struct, Visibility::Public),
            "class_specifier" => (SymbolKind::Class, Visibility::Private),
            "enum_specifier" => (SymbolKind::Enum, Visibility::Public),
            _ => return None,
        },
        _ => return None,
    };

    let name = extract_name(node, source).unwrap_or_else(|| "<anonymous>".to_string());
    let start_line = node.start_position().row;
    let end_line = node.end_position().row;

    // Extract first line as signature
    let node_text = &source[node.start_byte()..node.end_byte()];
    let text = String::from_utf8_lossy(node_text);
    let signature = text.lines().next().map(|l| l.trim().to_string());

    // Extract doc comment (look at preceding sibling)
    let doc_comment = extract_doc_comment(node, source);

    // Check visibility
    let visibility = detect_visibility(node, source, language, vis_default);

    Some(SymbolInfo {
        name,
        kind: sym_kind,
        start_line,
        end_line,
        signature,
        doc_comment,
        visibility,
    })
}

fn extract_name(node: tree_sitter::Node, source: &[u8]) -> Option<String> {
    // Try "name" field first (most grammars use this)
    if let Some(name_node) = node.child_by_field_name("name") {
        let text = &source[name_node.start_byte()..name_node.end_byte()];
        return Some(String::from_utf8_lossy(text).to_string());
    }
    // Fallback: find first identifier child
    for i in 0..node.child_count() {
        if let Some(child) = node.child(i) {
            if child.kind() == "identifier" || child.kind() == "type_identifier" {
                let text = &source[child.start_byte()..child.end_byte()];
                return Some(String::from_utf8_lossy(text).to_string());
            }
        }
    }
    None
}

fn extract_doc_comment(node: tree_sitter::Node, source: &[u8]) -> Option<String> {
    let mut prev = node.prev_sibling();
    let mut doc_lines = Vec::new();
    while let Some(sib) = prev {
        let kind = sib.kind();
        if kind == "line_comment" || kind == "comment" || kind == "block_comment" {
            let text = &source[sib.start_byte()..sib.end_byte()];
            let text = String::from_utf8_lossy(text).trim().to_string();
            // Only collect doc comments (/// or /** or #)
            if text.starts_with("///") || text.starts_with("/**") || text.starts_with("//!") {
                doc_lines.push(text);
            } else {
                break;
            }
            prev = sib.prev_sibling();
        } else {
            break;
        }
    }
    if doc_lines.is_empty() {
        None
    } else {
        doc_lines.reverse();
        Some(doc_lines.join("\n"))
    }
}

fn detect_visibility(
    node: tree_sitter::Node,
    source: &[u8],
    language: &str,
    default: Visibility,
) -> Visibility {
    match language {
        "rust" => {
            // Check for visibility_modifier child
            for i in 0..node.child_count() {
                if let Some(child) = node.child(i) {
                    if child.kind() == "visibility_modifier" {
                        let text = &source[child.start_byte()..child.end_byte()];
                        let t = String::from_utf8_lossy(text);
                        if t.contains("pub(crate)") {
                            return Visibility::Internal;
                        }
                        return Visibility::Public;
                    }
                }
            }
            default
        }
        "go" => {
            // Go: uppercase first letter = public
            if let Some(name) = extract_name(node, source) {
                if name.starts_with(|c: char| c.is_uppercase()) {
                    return Visibility::Public;
                }
            }
            Visibility::Private
        }
        "java" => {
            // Check for "public", "private", "protected" modifiers
            for i in 0..node.child_count() {
                if let Some(child) = node.child(i) {
                    if child.kind() == "modifiers" {
                        let text = &source[child.start_byte()..child.end_byte()];
                        let t = String::from_utf8_lossy(text);
                        if t.contains("public") {
                            return Visibility::Public;
                        }
                        if t.contains("private") {
                            return Visibility::Private;
                        }
                    }
                }
            }
            default
        }
        "typescript" | "javascript" => {
            // Check for export_statement parent
            if let Some(parent) = node.parent() {
                if parent.kind() == "export_statement" {
                    return Visibility::Public;
                }
            }
            default
        }
        _ => default,
    }
}

// ─── Import Extraction ──────────────────────────────────────────────────

fn try_extract_import(
    node: tree_sitter::Node,
    source: &[u8],
    language: &str,
) -> Option<ImportInfo> {
    let kind = node.kind();

    match language {
        "rust" => {
            if kind != "use_declaration" {
                return None;
            }
            let text = node_text(node, source);
            // Parse "use std::collections::HashMap;"
            let path = text
                .trim_start_matches("use ")
                .trim_start_matches("pub use ")
                .trim_end_matches(';')
                .trim();
            let (mod_path, items) = split_rust_use(path);
            Some(ImportInfo {
                path: mod_path,
                items,
                line: node.start_position().row,
            })
        }
        "typescript" | "javascript" => {
            if kind != "import_statement" {
                return None;
            }
            let text = node_text(node, source);
            parse_js_import(&text, node.start_position().row)
        }
        "python" => {
            if kind != "import_statement" && kind != "import_from_statement" {
                return None;
            }
            let text = node_text(node, source);
            parse_python_import(&text, node.start_position().row)
        }
        "go" => {
            if kind != "import_spec" {
                return None;
            }
            let text = node_text(node, source).trim().replace('"', "");
            Some(ImportInfo {
                path: text,
                items: vec![],
                line: node.start_position().row,
            })
        }
        "java" => {
            if kind != "import_declaration" {
                return None;
            }
            let text = node_text(node, source);
            let path = text
                .trim_start_matches("import ")
                .trim_start_matches("static ")
                .trim_end_matches(';')
                .trim()
                .to_string();
            Some(ImportInfo {
                path,
                items: vec![],
                line: node.start_position().row,
            })
        }
        "c" | "cpp" => {
            if kind != "preproc_include" {
                return None;
            }
            let text = node_text(node, source);
            let path = text
                .trim_start_matches("#include")
                .trim()
                .trim_matches(|c| c == '"' || c == '<' || c == '>')
                .to_string();
            Some(ImportInfo {
                path,
                items: vec![],
                line: node.start_position().row,
            })
        }
        _ => None,
    }
}

fn node_text(node: tree_sitter::Node, source: &[u8]) -> String {
    String::from_utf8_lossy(&source[node.start_byte()..node.end_byte()]).to_string()
}

/// Split Rust `use` path, e.g. "std::collections::{HashMap, HashSet}"
fn split_rust_use(path: &str) -> (String, Vec<String>) {
    if let Some(brace_start) = path.find('{') {
        let mod_path = path[..brace_start].trim_end_matches("::").to_string();
        let items_str = &path[brace_start + 1..path.rfind('}').unwrap_or(path.len())];
        let items: Vec<String> = items_str
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        (mod_path, items)
    } else {
        // Single import
        let parts: Vec<&str> = path.rsplitn(2, "::").collect();
        if parts.len() == 2 {
            (parts[1].to_string(), vec![parts[0].to_string()])
        } else {
            (path.to_string(), vec![])
        }
    }
}

/// Parse JS/TS import statement text
fn parse_js_import(text: &str, line: usize) -> Option<ImportInfo> {
    // import { X, Y } from "./module"
    // import X from "module"
    let from_idx = text.find("from")?;
    let specifier = text[from_idx + 4..]
        .trim()
        .trim_matches(|c| c == '\'' || c == '"' || c == ';')
        .to_string();

    let items_part = &text[..from_idx];
    let mut items = Vec::new();
    if let Some(brace_start) = items_part.find('{') {
        let brace_end = items_part.find('}').unwrap_or(items_part.len());
        let inner = &items_part[brace_start + 1..brace_end];
        for item in inner.split(',') {
            let cleaned = item.trim().split(" as ").next().unwrap_or("").trim();
            if !cleaned.is_empty() {
                items.push(cleaned.to_string());
            }
        }
    } else {
        // default import
        let name = items_part
            .trim_start_matches("import ")
            .split_whitespace()
            .next()
            .unwrap_or("");
        if !name.is_empty() && name != "*" {
            items.push(name.to_string());
        }
    }

    Some(ImportInfo {
        path: specifier,
        items,
        line,
    })
}

/// Parse Python import statement text
fn parse_python_import(text: &str, line: usize) -> Option<ImportInfo> {
    let text = text.trim();
    if text.starts_with("from ") {
        // from module import X, Y
        let parts: Vec<&str> = text.splitn(2, " import ").collect();
        if parts.len() == 2 {
            let module = parts[0].trim_start_matches("from ").trim().to_string();
            let items: Vec<String> = parts[1]
                .split(',')
                .map(|s| {
                    s.trim()
                        .split(" as ")
                        .next()
                        .unwrap_or("")
                        .trim()
                        .to_string()
                })
                .filter(|s| !s.is_empty())
                .collect();
            return Some(ImportInfo {
                path: module,
                items,
                line,
            });
        }
    } else if text.starts_with("import ") {
        let module = text.trim_start_matches("import ").trim().to_string();
        return Some(ImportInfo {
            path: module,
            items: vec![],
            line,
        });
    }
    None
}
