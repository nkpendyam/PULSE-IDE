// Enhanced LSP Commands — Tree-sitter powered + real LSP server subprocess
use crate::lsp_transport::transport::{get_language_server_config, LspTransport};
use log::{info, warn};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::command;
use tokio::sync::RwLock;

lazy_static::lazy_static! {
    static ref LSP_STATE: Arc<RwLock<LspState>> = Arc::new(RwLock::new(LspState::default()));
}

/// LSP capabilities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspCapabilities {
    pub completion: bool,
    pub hover: bool,
    pub definition: bool,
    pub references: bool,
    pub formatting: bool,
    pub diagnostics: bool,
    pub code_actions: bool,
    pub rename: bool,
    pub signature_help: bool,
}

impl Default for LspCapabilities {
    fn default() -> Self {
        Self {
            completion: true,
            hover: true,
            definition: true,
            references: true,
            formatting: true,
            diagnostics: true,
            code_actions: true,
            rename: true,
            signature_help: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspServerStatus {
    pub language: String,
    pub running: bool,
    pub server_name: String,
    pub capabilities: LspCapabilities,
    pub pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionItem {
    pub label: String,
    pub kind: String,
    pub detail: Option<String>,
    pub documentation: Option<String>,
    pub insert_text: Option<String>,
    pub sort_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    pub uri: String,
    pub range: Range,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Range {
    pub start: Position,
    pub end: Position,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub line: u32,
    pub character: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnostic {
    pub range: Range,
    pub severity: String,
    pub message: String,
    pub source: Option<String>,
    pub code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HoverResult {
    pub contents: String,
    pub range: Option<Range>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextEdit {
    pub range: Range,
    pub new_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeAction {
    pub title: String,
    pub kind: Option<String>,
    pub diagnostics: Vec<Diagnostic>,
    pub is_preferred: bool,
}

#[derive(Default)]
pub struct LspState {
    servers: HashMap<String, LspServerStatus>,
    diagnostics: HashMap<String, Vec<Diagnostic>>,
    /// Cache of parsed file contents for tree-sitter queries
    file_cache: HashMap<String, String>,
    /// Real LSP transport handles — key is language name
    transports: HashMap<String, Arc<RwLock<LspTransport>>>,
}

/// Get the tree-sitter language for a file extension
fn get_ts_language(ext: &str) -> Option<tree_sitter::Language> {
    match ext {
        "rs" => Some(tree_sitter_rust::LANGUAGE.into()),
        "js" | "jsx" | "mjs" | "ts" | "tsx" => {
            Some(tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into())
        }
        "py" => Some(tree_sitter_python::LANGUAGE.into()),
        "go" => Some(tree_sitter_go::LANGUAGE.into()),
        "c" | "h" => Some(tree_sitter_c::LANGUAGE.into()),
        "cpp" | "hpp" | "cc" | "cxx" => Some(tree_sitter_cpp::LANGUAGE.into()),
        "json" => Some(tree_sitter_json::LANGUAGE.into()),
        "yaml" | "yml" => Some(tree_sitter_yaml::LANGUAGE.into()),
        _ => None,
    }
}

fn detect_extension(uri: &str) -> &str {
    uri.rsplit('.').next().unwrap_or("")
}

/// Map file extension to language name used by transport config
fn ext_to_language(ext: &str) -> &str {
    match ext {
        "rs" => "rust",
        "ts" | "tsx" | "js" | "jsx" | "mjs" => "typescript",
        "py" => "python",
        "go" => "go",
        "c" | "h" => "c",
        "cpp" | "hpp" | "cc" | "cxx" => "cpp",
        "java" => "java",
        "rb" => "ruby",
        "php" => "php",
        _ => ext,
    }
}

/// Convert LSP CompletionItemKind number to string
fn completion_kind_to_str(kind: u64) -> String {
    match kind {
        1 => "text",
        2 => "method",
        3 => "function",
        4 => "constructor",
        5 => "field",
        6 => "variable",
        7 => "class",
        8 => "interface",
        9 => "module",
        10 => "property",
        11 => "unit",
        12 => "value",
        13 => "enum",
        14 => "keyword",
        15 => "snippet",
        16 => "color",
        17 => "file",
        18 => "reference",
        19 => "folder",
        20 => "enum_member",
        21 => "constant",
        22 => "struct",
        23 => "event",
        24 => "operator",
        25 => "type_parameter",
        _ => "text",
    }
    .to_string()
}

/// Parse LSP Range JSON into our Range type
fn parse_lsp_range(range: &serde_json::Value) -> Range {
    let default_pos = json!({"line": 0, "character": 0});
    let start = range.get("start").unwrap_or(&default_pos);
    let end = range.get("end").unwrap_or(&default_pos);
    Range {
        start: Position {
            line: start.get("line").and_then(|l| l.as_u64()).unwrap_or(0) as u32,
            character: start.get("character").and_then(|c| c.as_u64()).unwrap_or(0) as u32,
        },
        end: Position {
            line: end.get("line").and_then(|l| l.as_u64()).unwrap_or(0) as u32,
            character: end.get("character").and_then(|c| c.as_u64()).unwrap_or(0) as u32,
        },
    }
}

/// Parse a file with tree-sitter and return the tree
fn parse_source(source: &str, ext: &str) -> Option<tree_sitter::Tree> {
    let lang = get_ts_language(ext)?;
    let mut parser = tree_sitter::Parser::new();
    parser.set_language(&lang).ok()?;
    parser.parse(source, None)
}

/// Find the node at a specific position
fn node_at_position<'a>(
    node: tree_sitter::Node<'a>,
    line: u32,
    character: u32,
) -> Option<tree_sitter::Node<'a>> {
    let point = tree_sitter::Point::new(line as usize, character as usize);

    // If point is outside this node, return None
    if point < node.start_position() || point > node.end_position() {
        return None;
    }

    // Try to find a more specific child node
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        if let Some(found) = node_at_position(child, line, character) {
            return Some(found);
        }
    }

    // Return this node if no child matches more specifically
    Some(node)
}

/// Collect all identifier nodes matching a name
fn find_all_identifiers(
    node: tree_sitter::Node,
    source: &str,
    name: &str,
) -> Vec<(u32, u32, u32, u32)> {
    let mut results = Vec::new();
    let _cursor = node.walk();

    fn walk_recursive(
        node: tree_sitter::Node,
        source: &str,
        name: &str,
        results: &mut Vec<(u32, u32, u32, u32)>,
    ) {
        let kind = node.kind();
        if kind == "identifier"
            || kind == "type_identifier"
            || kind == "field_identifier"
            || kind == "property_identifier"
            || kind == "shorthand_property_identifier"
        {
            if let Ok(text) = node.utf8_text(source.as_bytes()) {
                if text == name {
                    results.push((
                        node.start_position().row as u32,
                        node.start_position().column as u32,
                        node.end_position().row as u32,
                        node.end_position().column as u32,
                    ));
                }
            }
        }
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            walk_recursive(child, source, name, results);
        }
    }

    walk_recursive(node, source, name, &mut results);
    results
}

/// Find definition-like nodes (function_item, class_declaration, etc.)
fn find_definition_nodes(
    node: tree_sitter::Node,
    source: &str,
    name: &str,
) -> Vec<(u32, u32, u32, u32)> {
    let mut results = Vec::new();

    fn walk(
        node: tree_sitter::Node,
        source: &str,
        name: &str,
        results: &mut Vec<(u32, u32, u32, u32)>,
    ) {
        let kind = node.kind();
        // Common definition node types across languages
        let is_definition = matches!(
            kind,
            "function_item"
                | "function_definition"
                | "function_declaration"
                | "method_definition"
                | "struct_item"
                | "class_declaration"
                | "class_definition"
                | "impl_item"
                | "enum_item"
                | "type_alias_declaration"
                | "interface_declaration"
                | "variable_declarator"
                | "let_declaration"
                | "const_item"
                | "static_item"
                | "lexical_declaration"
                | "variable_declaration"
                | "assignment_expression"
        );

        if is_definition {
            // Check if this definition contains an identifier matching our name
            let mut cursor = node.walk();
            for child in node.children(&mut cursor) {
                let ck = child.kind();
                if ck == "identifier" || ck == "type_identifier" || ck == "name" {
                    if let Ok(text) = child.utf8_text(source.as_bytes()) {
                        if text == name {
                            results.push((
                                child.start_position().row as u32,
                                child.start_position().column as u32,
                                child.end_position().row as u32,
                                child.end_position().column as u32,
                            ));
                        }
                    }
                }
            }
        }

        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            walk(child, source, name, results);
        }
    }

    walk(node, source, name, &mut results);
    results
}

/// Get language-specific keyword completions
fn get_keyword_completions(ext: &str) -> Vec<CompletionItem> {
    let keywords: Vec<(&str, &str)> = match ext {
        "rs" => vec![
            ("fn", "Function declaration"),
            ("let", "Variable binding"),
            ("mut", "Mutable binding"),
            ("struct", "Struct declaration"),
            ("enum", "Enum declaration"),
            ("impl", "Implementation block"),
            ("trait", "Trait declaration"),
            ("pub", "Public visibility"),
            ("use", "Use declaration"),
            ("mod", "Module declaration"),
            ("match", "Match expression"),
            ("if", "If expression"),
            ("for", "For loop"),
            ("while", "While loop"),
            ("loop", "Infinite loop"),
            ("return", "Return from function"),
            ("async", "Async function"),
            ("await", "Await future"),
            ("println!", "Print to stdout"),
            ("eprintln!", "Print to stderr"),
            ("vec!", "Create Vec"),
            ("format!", "Format string"),
        ],
        "ts" | "tsx" | "js" | "jsx" => vec![
            ("function", "Function declaration"),
            ("const", "Constant declaration"),
            ("let", "Variable declaration"),
            ("class", "Class declaration"),
            ("interface", "Interface declaration"),
            ("type", "Type alias"),
            ("import", "Import declaration"),
            ("export", "Export declaration"),
            ("async", "Async function"),
            ("await", "Await promise"),
            ("if", "If statement"),
            ("for", "For loop"),
            ("while", "While loop"),
            ("return", "Return statement"),
            ("try", "Try block"),
            ("catch", "Catch block"),
            ("throw", "Throw exception"),
            ("new", "New instance"),
            ("console.log", "Log to console"),
            ("React.useState", "React state hook"),
        ],
        "py" => vec![
            ("def", "Function definition"),
            ("class", "Class definition"),
            ("import", "Import module"),
            ("from", "From import"),
            ("if", "If statement"),
            ("for", "For loop"),
            ("while", "While loop"),
            ("return", "Return statement"),
            ("try", "Try block"),
            ("except", "Except block"),
            ("with", "Context manager"),
            ("async", "Async function"),
            ("await", "Await coroutine"),
            ("print", "Print function"),
            ("self", "Instance reference"),
            ("None", "None value"),
        ],
        "go" => vec![
            ("func", "Function declaration"),
            ("type", "Type declaration"),
            ("struct", "Struct type"),
            ("interface", "Interface type"),
            ("package", "Package declaration"),
            ("import", "Import"),
            ("if", "If statement"),
            ("for", "For loop"),
            ("return", "Return statement"),
            ("go", "Goroutine"),
            ("chan", "Channel"),
            ("select", "Select statement"),
            ("defer", "Defer execution"),
            ("fmt.Println", "Print line"),
        ],
        _ => vec![],
    };

    keywords
        .into_iter()
        .enumerate()
        .map(|(i, (label, detail))| CompletionItem {
            label: label.to_string(),
            kind: "keyword".to_string(),
            detail: Some(detail.to_string()),
            documentation: None,
            insert_text: Some(label.to_string()),
            sort_text: Some(format!("{:04}", i)),
        })
        .collect()
}

// Read file content (from cache or disk)
async fn read_file_content(uri: &str) -> Result<String, String> {
    let state = LSP_STATE.read().await;
    if let Some(content) = state.file_cache.get(uri) {
        return Ok(content.clone());
    }
    drop(state);

    // Try to read from disk
    let path = uri.strip_prefix("file://").unwrap_or(uri);
    let content = tokio::fs::read_to_string(path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Cache it
    let mut state = LSP_STATE.write().await;
    state.file_cache.insert(uri.to_string(), content.clone());
    Ok(content)
}

#[command]
pub async fn lsp_start_server(
    language: String,
    root_uri: String,
) -> Result<LspServerStatus, String> {
    let mut state = LSP_STATE.write().await;

    // Try to spawn a real language server via LspTransport
    if let Some(config) = get_language_server_config(&language) {
        let server_cmd = config.command.clone();
        match LspTransport::new(config) {
            Ok(mut transport) => {
                // Send LSP initialize handshake
                let init_caps = json!({
                    "textDocument": {
                        "completion": { "completionItem": { "snippetSupport": true } },
                        "hover": { "contentFormat": ["markdown", "plaintext"] },
                        "definition": {},
                        "references": {},
                        "formatting": {},
                        "codeAction": {},
                        "publishDiagnostics": { "relatedInformation": true }
                    },
                    "workspace": {
                        "workspaceFolders": true,
                        "didChangeConfiguration": { "dynamicRegistration": true }
                    }
                });

                match transport.initialize(&root_uri, init_caps).await {
                    Ok(_result) => {
                        info!("Real LSP server started: {} for {}", server_cmd, language);
                        let transport_handle = Arc::new(RwLock::new(transport));
                        state.transports.insert(language.clone(), transport_handle);

                        let status = LspServerStatus {
                            language: language.clone(),
                            running: true,
                            server_name: server_cmd,
                            capabilities: LspCapabilities::default(),
                            pid: None, // real server PID managed by transport
                        };
                        state.servers.insert(language, status.clone());
                        return Ok(status);
                    }
                    Err(e) => {
                        warn!(
                            "LSP {} init failed, falling back to tree-sitter: {}",
                            server_cmd, e
                        );
                    }
                }
            }
            Err(e) => {
                warn!(
                    "Cannot spawn {}: {} — falling back to tree-sitter",
                    server_cmd, e
                );
            }
        }
    }

    // Fallback: register tree-sitter-only server
    let status = LspServerStatus {
        language: language.clone(),
        running: true,
        server_name: format!("kyro-{}-ts", language),
        capabilities: LspCapabilities::default(),
        pid: None,
    };
    state.servers.insert(language, status.clone());
    Ok(status)
}

#[command]
pub async fn lsp_stop_server(language: String) -> Result<(), String> {
    let mut state = LSP_STATE.write().await;
    // Shutdown real transport if it exists
    if let Some(transport) = state.transports.remove(&language) {
        let mut t = transport.write().await;
        if let Err(e) = t.shutdown().await {
            warn!("LSP shutdown error for {}: {}", language, e);
        }
    }
    state.servers.remove(&language);
    Ok(())
}

#[command]
pub async fn lsp_get_servers() -> Result<Vec<LspServerStatus>, String> {
    let state = LSP_STATE.read().await;
    Ok(state.servers.values().cloned().collect())
}

#[command]
pub async fn lsp_get_completions(
    uri: String,
    line: u32,
    character: u32,
) -> Result<Vec<CompletionItem>, String> {
    let ext = detect_extension(&uri);

    // Try real LSP server first
    {
        let state = LSP_STATE.read().await;
        let lang = ext_to_language(ext);
        if let Some(transport) = state.transports.get(lang) {
            let mut t = transport.write().await;
            let params = json!({
                "textDocument": { "uri": uri },
                "position": { "line": line, "character": character }
            });
            if let Ok(result) = t
                .send_request("textDocument/completion", Some(params))
                .await
            {
                // Parse LSP CompletionList or CompletionItem[]
                let items = if let Some(items) = result.get("items") {
                    items.as_array().cloned().unwrap_or_default()
                } else if result.is_array() {
                    result.as_array().cloned().unwrap_or_default()
                } else {
                    vec![]
                };

                if !items.is_empty() {
                    return Ok(items
                        .into_iter()
                        .filter_map(|item| {
                            Some(CompletionItem {
                                label: item.get("label")?.as_str()?.to_string(),
                                kind: completion_kind_to_str(
                                    item.get("kind").and_then(|k| k.as_u64()).unwrap_or(1),
                                ),
                                detail: item
                                    .get("detail")
                                    .and_then(|d| d.as_str())
                                    .map(|s| s.to_string()),
                                documentation: item.get("documentation").and_then(|d| {
                                    d.as_str().map(|s| s.to_string()).or_else(|| {
                                        d.get("value")
                                            .and_then(|v| v.as_str())
                                            .map(|s| s.to_string())
                                    })
                                }),
                                insert_text: item
                                    .get("insertText")
                                    .and_then(|t| t.as_str())
                                    .map(|s| s.to_string())
                                    .or_else(|| {
                                        item.get("label")
                                            .and_then(|l| l.as_str())
                                            .map(|s| s.to_string())
                                    }),
                                sort_text: item
                                    .get("sortText")
                                    .and_then(|s| s.as_str())
                                    .map(|s| s.to_string()),
                            })
                        })
                        .collect());
                }
            }
        }
    }

    // Fallback: tree-sitter + keyword completions
    let mut completions = Vec::new();

    // Add keyword completions for the language
    completions.extend(get_keyword_completions(ext));

    // Try tree-sitter based completions from the file
    if let Ok(content) = read_file_content(&uri).await {
        if let Some(tree) = parse_source(&content, ext) {
            // Collect all unique identifiers in the file as completion candidates
            let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
            let _cursor = tree.root_node().walk();
            fn collect_identifiers(
                node: tree_sitter::Node,
                source: &str,
                seen: &mut std::collections::HashSet<String>,
                completions: &mut Vec<CompletionItem>,
                idx: &mut usize,
            ) {
                let kind = node.kind();
                if kind == "identifier" || kind == "type_identifier" || kind == "field_identifier" {
                    if let Ok(text) = node.utf8_text(source.as_bytes()) {
                        if text.len() > 1 && seen.insert(text.to_string()) {
                            completions.push(CompletionItem {
                                label: text.to_string(),
                                kind: "variable".to_string(),
                                detail: Some(format!("({})", kind)),
                                documentation: None,
                                insert_text: Some(text.to_string()),
                                sort_text: Some(format!("{:04}", 100 + *idx)),
                            });
                            *idx += 1;
                        }
                    }
                }
                let mut cursor = node.walk();
                for child in node.children(&mut cursor) {
                    collect_identifiers(child, source, seen, completions, idx);
                }
            }
            let mut idx = 0usize;
            collect_identifiers(
                tree.root_node(),
                &content,
                &mut seen,
                &mut completions,
                &mut idx,
            );
        }
    }

    Ok(completions)
}

#[command]
pub async fn lsp_goto_definition(
    uri: String,
    line: u32,
    character: u32,
) -> Result<Option<Location>, String> {
    let ext = detect_extension(&uri);

    // Try real LSP server first
    {
        let state = LSP_STATE.read().await;
        let lang = ext_to_language(ext);
        if let Some(transport) = state.transports.get(lang) {
            let mut t = transport.write().await;
            let params = json!({
                "textDocument": { "uri": uri },
                "position": { "line": line, "character": character }
            });
            if let Ok(result) = t
                .send_request("textDocument/definition", Some(params))
                .await
            {
                // Parse Location or Location[]
                let loc = if result.is_array() {
                    result.as_array().and_then(|a| a.first()).cloned()
                } else if result.get("uri").is_some() {
                    Some(result)
                } else {
                    None
                };
                if let Some(l) = loc {
                    if let (Some(loc_uri), Some(range)) =
                        (l.get("uri").and_then(|u| u.as_str()), l.get("range"))
                    {
                        return Ok(Some(Location {
                            uri: loc_uri.to_string(),
                            range: parse_lsp_range(range),
                        }));
                    }
                }
            }
        }
    }

    // Fallback: tree-sitter definition search
    let content = read_file_content(&uri).await?;

    let tree = parse_source(&content, ext).ok_or("Failed to parse file")?;

    // Find the node at the cursor position
    let target_node =
        node_at_position(tree.root_node(), line, character).ok_or("No node at position")?;

    let name = target_node
        .utf8_text(content.as_bytes())
        .map_err(|e| format!("UTF-8 error: {}", e))?;

    // Find definition nodes matching this name
    let defs = find_definition_nodes(tree.root_node(), &content, name);

    // Return the first definition that isn't the current position
    for (sl, sc, el, ec) in defs {
        if sl != line || sc != character {
            return Ok(Some(Location {
                uri: uri.clone(),
                range: Range {
                    start: Position {
                        line: sl,
                        character: sc,
                    },
                    end: Position {
                        line: el,
                        character: ec,
                    },
                },
            }));
        }
    }

    Ok(None)
}

#[command]
pub async fn lsp_hover(
    uri: String,
    line: u32,
    character: u32,
) -> Result<Option<HoverResult>, String> {
    let ext = detect_extension(&uri);

    // Try real LSP server first
    {
        let state = LSP_STATE.read().await;
        let lang = ext_to_language(ext);
        if let Some(transport) = state.transports.get(lang) {
            let mut t = transport.write().await;
            let params = json!({
                "textDocument": { "uri": uri },
                "position": { "line": line, "character": character }
            });
            if let Ok(result) = t.send_request("textDocument/hover", Some(params)).await {
                if !result.is_null() {
                    let contents = if let Some(c) = result.get("contents") {
                        if let Some(s) = c.as_str() {
                            s.to_string()
                        } else if let Some(v) = c.get("value").and_then(|v| v.as_str()) {
                            v.to_string()
                        } else {
                            c.to_string()
                        }
                    } else {
                        result.to_string()
                    };
                    let range = result.get("range").map(parse_lsp_range);
                    return Ok(Some(HoverResult { contents, range }));
                }
            }
        }
    }

    // Fallback: tree-sitter hover
    let content = read_file_content(&uri).await?;

    let tree = parse_source(&content, ext).ok_or("Failed to parse file")?;

    let target =
        node_at_position(tree.root_node(), line, character).ok_or("No node at position")?;

    let text = target
        .utf8_text(content.as_bytes())
        .map_err(|e| format!("UTF-8 error: {}", e))?;

    // Walk up to find the containing declaration
    let mut parent = target.parent();
    let mut context = String::new();
    while let Some(p) = parent {
        let kind = p.kind();
        if matches!(
            kind,
            "function_item"
                | "function_definition"
                | "function_declaration"
                | "method_definition"
                | "struct_item"
                | "class_declaration"
                | "impl_item"
                | "enum_item"
                | "type_alias_declaration"
                | "interface_declaration"
                | "variable_declarator"
                | "let_declaration"
        ) {
            // Get the first line of the declaration as signature
            if let Ok(decl_text) = p.utf8_text(content.as_bytes()) {
                context = decl_text.lines().next().unwrap_or(decl_text).to_string();
            }
            break;
        }
        parent = p.parent();
    }

    let hover_text = if context.is_empty() {
        format!("```\n{}\n```\n\n*Node: {}*", text, target.kind())
    } else {
        format!(
            "```{}\n{}\n```\n\n**{}** — *{}*",
            ext,
            context,
            text,
            target.kind()
        )
    };

    Ok(Some(HoverResult {
        contents: hover_text,
        range: Some(Range {
            start: Position {
                line: target.start_position().row as u32,
                character: target.start_position().column as u32,
            },
            end: Position {
                line: target.end_position().row as u32,
                character: target.end_position().column as u32,
            },
        }),
    }))
}

#[command]
pub async fn lsp_get_diagnostics(uri: String) -> Result<Vec<Diagnostic>, String> {
    let ext = detect_extension(&uri);
    let content = match read_file_content(&uri).await {
        Ok(c) => c,
        Err(_) => return Ok(vec![]),
    };

    let mut diagnostics = Vec::new();

    // Check for parse errors using tree-sitter
    if let Some(tree) = parse_source(&content, ext) {
        fn find_errors(node: tree_sitter::Node, diagnostics: &mut Vec<Diagnostic>, source: &str) {
            if node.is_error() || node.is_missing() {
                let snippet = node
                    .utf8_text(source.as_bytes())
                    .unwrap_or("")
                    .chars()
                    .take(50)
                    .collect::<String>();
                diagnostics.push(Diagnostic {
                    range: Range {
                        start: Position {
                            line: node.start_position().row as u32,
                            character: node.start_position().column as u32,
                        },
                        end: Position {
                            line: node.end_position().row as u32,
                            character: node.end_position().column as u32,
                        },
                    },
                    severity: "error".to_string(),
                    message: if node.is_missing() {
                        "Missing expected syntax element".to_string()
                    } else {
                        format!("Syntax error near: {}", snippet)
                    },
                    source: Some("kyro-treesitter".to_string()),
                    code: Some("E0001".to_string()),
                });
            }
            let mut cursor = node.walk();
            for child in node.children(&mut cursor) {
                find_errors(child, diagnostics, source);
            }
        }
        find_errors(tree.root_node(), &mut diagnostics, &content);
    }

    // Store diagnostics in state
    {
        let mut state = LSP_STATE.write().await;
        state.diagnostics.insert(uri, diagnostics.clone());
    }

    Ok(diagnostics)
}

#[command]
pub async fn lsp_format_document(uri: String) -> Result<Vec<TextEdit>, String> {
    let content = read_file_content(&uri).await?;
    let mut edits = Vec::new();

    // Basic formatting: normalize trailing whitespace and ensure final newline
    for (i, line) in content.lines().enumerate() {
        let trimmed = line.trim_end();
        if trimmed.len() != line.len() {
            edits.push(TextEdit {
                range: Range {
                    start: Position {
                        line: i as u32,
                        character: trimmed.len() as u32,
                    },
                    end: Position {
                        line: i as u32,
                        character: line.len() as u32,
                    },
                },
                new_text: String::new(),
            });
        }
    }

    // Ensure file ends with newline
    if !content.ends_with('\n') {
        let line_count = content.lines().count();
        let last_line_len = content.lines().last().map(|l| l.len()).unwrap_or(0);
        edits.push(TextEdit {
            range: Range {
                start: Position {
                    line: line_count as u32 - 1,
                    character: last_line_len as u32,
                },
                end: Position {
                    line: line_count as u32 - 1,
                    character: last_line_len as u32,
                },
            },
            new_text: "\n".to_string(),
        });
    }

    Ok(edits)
}

#[command]
pub async fn lsp_code_actions(
    uri: String,
    start_line: u32,
    end_line: u32,
) -> Result<Vec<CodeAction>, String> {
    let _ext = detect_extension(&uri);
    let content = read_file_content(&uri).await?;
    let mut actions = Vec::new();

    // Check for common patterns to suggest actions
    let lines: Vec<&str> = content.lines().collect();
    for i in start_line..=end_line.min(lines.len() as u32 - 1) {
        let line = lines[i as usize];

        // Suggest removing unused imports
        if (line.trim_start().starts_with("use ") || line.trim_start().starts_with("import "))
            && line.contains("unused")
        {
            actions.push(CodeAction {
                title: "Remove unused import".to_string(),
                kind: Some("quickfix".to_string()),
                diagnostics: vec![],
                is_preferred: true,
            });
        }

        // Suggest extracting function for long blocks
        if end_line - start_line > 10 {
            actions.push(CodeAction {
                title: "Extract to function".to_string(),
                kind: Some("refactor.extract".to_string()),
                diagnostics: vec![],
                is_preferred: false,
            });
        }
    }

    Ok(actions)
}

#[command]
pub async fn lsp_find_references(
    uri: String,
    line: u32,
    character: u32,
) -> Result<Vec<Location>, String> {
    let ext = detect_extension(&uri);
    let content = read_file_content(&uri).await?;

    let tree = parse_source(&content, ext).ok_or("Failed to parse file")?;

    let target =
        node_at_position(tree.root_node(), line, character).ok_or("No node at position")?;

    let name = target
        .utf8_text(content.as_bytes())
        .map_err(|e| format!("UTF-8 error: {}", e))?;

    let refs = find_all_identifiers(tree.root_node(), &content, name);

    Ok(refs
        .into_iter()
        .map(|(sl, sc, el, ec)| Location {
            uri: uri.clone(),
            range: Range {
                start: Position {
                    line: sl,
                    character: sc,
                },
                end: Position {
                    line: el,
                    character: ec,
                },
            },
        })
        .collect())
}

#[command]
pub async fn lsp_rename(
    uri: String,
    line: u32,
    character: u32,
    new_name: String,
) -> Result<Vec<TextEdit>, String> {
    let ext = detect_extension(&uri);
    let content = read_file_content(&uri).await?;

    let tree = parse_source(&content, ext).ok_or("Failed to parse file")?;

    let target =
        node_at_position(tree.root_node(), line, character).ok_or("No node at position")?;

    let old_name = target
        .utf8_text(content.as_bytes())
        .map_err(|e| format!("UTF-8 error: {}", e))?;

    let refs = find_all_identifiers(tree.root_node(), &content, old_name);

    Ok(refs
        .into_iter()
        .map(|(sl, sc, el, ec)| TextEdit {
            range: Range {
                start: Position {
                    line: sl,
                    character: sc,
                },
                end: Position {
                    line: el,
                    character: ec,
                },
            },
            new_text: new_name.clone(),
        })
        .collect())
}

#[command]
pub async fn lsp_signature_help(
    uri: String,
    line: u32,
    character: u32,
) -> Result<Option<String>, String> {
    let ext = detect_extension(&uri);
    let content = read_file_content(&uri).await?;

    let tree = match parse_source(&content, ext) {
        Some(t) => t,
        None => return Ok(None),
    };

    // Find call expression at position
    let target = match node_at_position(tree.root_node(), line, character) {
        Some(n) => n,
        None => return Ok(None),
    };

    // Walk up to find a call expression
    let mut node = Some(target);
    while let Some(n) = node {
        if matches!(
            n.kind(),
            "call_expression" | "function_call" | "method_call"
        ) {
            // Extract the function name and try to find its signature
            let call_text = n
                .utf8_text(content.as_bytes())
                .unwrap_or("")
                .lines()
                .next()
                .unwrap_or("");
            return Ok(Some(format!("Signature: {}", call_text)));
        }
        node = n.parent();
    }

    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn detect_extension_handles_common_inputs() {
        assert_eq!(detect_extension("file:///tmp/main.ts"), "ts");
        assert_eq!(detect_extension("C:/repo/src/lib.rs"), "rs");
        assert_eq!(detect_extension("no_extension"), "no_extension");
    }

    #[test]
    fn ext_to_language_maps_expected_groups() {
        assert_eq!(ext_to_language("ts"), "typescript");
        assert_eq!(ext_to_language("tsx"), "typescript");
        assert_eq!(ext_to_language("js"), "typescript");
        assert_eq!(ext_to_language("py"), "python");
        assert_eq!(ext_to_language("rs"), "rust");
        assert_eq!(ext_to_language("java"), "java");
    }

    #[test]
    fn completion_kind_to_str_maps_known_and_default() {
        assert_eq!(completion_kind_to_str(3), "function");
        assert_eq!(completion_kind_to_str(6), "variable");
        assert_eq!(completion_kind_to_str(14), "keyword");
        assert_eq!(completion_kind_to_str(999), "text");
    }

    #[test]
    fn parse_lsp_range_parses_values_and_defaults() {
        let parsed = parse_lsp_range(&json!({
            "start": { "line": 2, "character": 4 },
            "end": { "line": 3, "character": 9 }
        }));
        assert_eq!(parsed.start.line, 2);
        assert_eq!(parsed.start.character, 4);
        assert_eq!(parsed.end.line, 3);
        assert_eq!(parsed.end.character, 9);

        let defaulted = parse_lsp_range(&json!({}));
        assert_eq!(defaulted.start.line, 0);
        assert_eq!(defaulted.start.character, 0);
        assert_eq!(defaulted.end.line, 0);
        assert_eq!(defaulted.end.character, 0);
    }

    #[test]
    fn keyword_completions_return_language_specific_results() {
        let rust_keywords = get_keyword_completions("rs");
        assert!(rust_keywords.iter().any(|item| item.label == "fn"));
        assert!(rust_keywords.iter().all(|item| item.kind == "keyword"));

        let ts_keywords = get_keyword_completions("ts");
        assert!(ts_keywords.iter().any(|item| item.label == "function"));

        let unknown_keywords = get_keyword_completions("unknown");
        assert!(unknown_keywords.is_empty());
    }
}
