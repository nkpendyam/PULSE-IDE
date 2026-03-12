//! Generator — feeds file metadata + dependency graph to an Ollama LLM
//! and produces structured wiki pages in Markdown with Mermaid diagrams.

use super::{
    graph, DependencyGraph, FileEntry, RepoWikiConfig, SymbolKind, Visibility, WikiPage,
};
use std::collections::HashMap;

// ─── Public API ─────────────────────────────────────────────────────────

/// Generate all wiki pages from scanned files and dependency graph
pub async fn generate_pages(
    files: &[FileEntry],
    dep_graph: &DependencyGraph,
    config: &RepoWikiConfig,
    http: &reqwest::Client,
) -> Result<Vec<WikiPage>, String> {
    let mut pages = Vec::new();

    // 1. Overview page (always generated, uses graph stats)
    let overview = generate_overview(files, dep_graph, config, http).await?;
    pages.push(overview);

    // 2. Getting-started page (dependencies + setup heuristics)
    let getting_started = generate_getting_started(files, config, http).await?;
    pages.push(getting_started);

    // 3. Core-concepts: one page per module group
    let module_pages = generate_module_pages(files, dep_graph, config, http).await?;
    pages.extend(module_pages);

    // 4. API reference (all public symbols)
    let api_ref = generate_api_reference(files, config);
    pages.push(api_ref);

    Ok(pages)
}

// ─── 01-overview.md ─────────────────────────────────────────────────────

async fn generate_overview(
    files: &[FileEntry],
    dep_graph: &DependencyGraph,
    config: &RepoWikiConfig,
    http: &reqwest::Client,
) -> Result<WikiPage, String> {
    let stats = graph::graph_stats(dep_graph);

    // Build a concise project summary for the LLM
    let lang_breakdown = language_breakdown(files);
    let top_symbols = top_public_symbols(files, 20);
    let hub_files_summary: Vec<String> = stats
        .hub_files
        .iter()
        .take(5)
        .map(|(path, degree)| format!("- `{}` (imported by {} files)", path, degree))
        .collect();

    let prompt = format!(
        r#"Analyze this codebase and write a concise project architecture overview in Markdown.

## Project stats
- Files: {}
- Dependency edges: {}
- Module groups: {}
- Language breakdown: {}

## Hub files (most depended-upon)
{}

## Key public symbols
{}

Write:
1. A 2-3 sentence summary of what this project likely does
2. An "Architecture" section describing the high-level structure
3. A "Key Modules" section listing the most important module groups and their purpose
4. A "Design Decisions" section with 3-5 bullet points about patterns you can infer

Keep it factual and based on the data provided. Do NOT guess features that aren't evident."#,
        stats.total_files,
        stats.total_edges,
        stats.module_count,
        lang_breakdown,
        hub_files_summary.join("\n"),
        top_symbols.join("\n"),
    );

    let system = "You are an expert software architect writing internal documentation for a development team. Be concise, precise, and use Markdown formatting. Do not include the page title — it will be added automatically.";

    let llm_content = call_llm_or_fallback(http, config, system, &prompt).await;

    // Build the page
    let mermaid = if config.mermaid_diagrams {
        format!("\n## Dependency Graph\n\n{}\n", graph::graph_to_mermaid(dep_graph))
    } else {
        String::new()
    };

    let content = format!(
        "# Project Overview\n\n{}\n\n## Statistics\n\n| Metric | Value |\n|--------|-------|\n| Total files | {} |\n| Dependency edges | {} |\n| Module groups | {} |\n| Hub files | {} |\n| Leaf files | {} |\n{}\n",
        llm_content,
        stats.total_files,
        stats.total_edges,
        stats.module_count,
        stats.hub_files.len(),
        stats.leaf_count,
        mermaid,
    );

    Ok(WikiPage {
        rel_path: "01-overview.md".to_string(),
        title: "Project Overview".to_string(),
        content,
    })
}

// ─── 02-getting-started.md ──────────────────────────────────────────────

async fn generate_getting_started(
    files: &[FileEntry],
    config: &RepoWikiConfig,
    http: &reqwest::Client,
) -> Result<WikiPage, String> {
    // Detect build system and dependencies from file list
    let file_names: Vec<&str> = files.iter().map(|f| f.rel_path.as_str()).collect();
    let has_cargo = file_names.iter().any(|f| f.ends_with("Cargo.toml"));
    let has_package_json = file_names.iter().any(|f| f.ends_with("package.json"));
    let has_go_mod = file_names.iter().any(|f| f.ends_with("go.mod"));
    let has_requirements = file_names.iter().any(|f| f.ends_with("requirements.txt"));
    let has_pyproject = file_names.iter().any(|f| f.ends_with("pyproject.toml"));

    let mut setup_hints = Vec::new();
    if has_cargo {
        setup_hints.push("- **Rust/Cargo**: `cargo build` to compile, `cargo test` to run tests");
    }
    if has_package_json {
        setup_hints.push("- **Node.js**: `npm install` to install deps, `npm run dev` to start dev server");
    }
    if has_go_mod {
        setup_hints.push("- **Go**: `go build ./...` to compile, `go test ./...` to run tests");
    }
    if has_requirements {
        setup_hints.push("- **Python (pip)**: `pip install -r requirements.txt`");
    }
    if has_pyproject {
        setup_hints.push("- **Python (pyproject)**: `pip install -e .` or `poetry install`");
    }

    let lang_summary = language_breakdown(files);
    let prompt = format!(
        r#"Write a concise "Getting Started" guide for a developer joining this project.

## Build systems detected
{}

## Languages used
{}

## Total files: {}

Write:
1. "Prerequisites" — what tools/runtimes a developer needs
2. "Setup" — step-by-step to get the project running locally
3. "Project Structure" — brief description of the directory layout
4. "Development Workflow" — how to build, test, and contribute

Be concise. Use the detected build systems to guide your recommendations."#,
        setup_hints.join("\n"),
        lang_summary,
        files.len(),
    );

    let system = "You are writing developer onboarding documentation. Be concise and actionable. Do not include the page title.";
    let llm_content = call_llm_or_fallback(http, config, system, &prompt).await;

    let content = format!("# Getting Started\n\n{}\n", llm_content);

    Ok(WikiPage {
        rel_path: "02-getting-started.md".to_string(),
        title: "Getting Started".to_string(),
        content,
    })
}

// ─── 03-core-concepts/ ──────────────────────────────────────────────────

async fn generate_module_pages(
    files: &[FileEntry],
    dep_graph: &DependencyGraph,
    config: &RepoWikiConfig,
    http: &reqwest::Client,
) -> Result<Vec<WikiPage>, String> {
    // Group files by module group
    let mut groups: HashMap<String, Vec<&FileEntry>> = HashMap::new();
    for file in files {
        let group = dep_graph
            .nodes
            .get(&file.rel_path)
            .map(|n| n.module_group.clone())
            .unwrap_or_else(|| "other".to_string());
        groups.entry(group).or_default().push(file);
    }

    let mut pages = Vec::new();

    // Create an index page
    let mut index_content = "# Core Concepts\n\nModule breakdown of the codebase.\n\n| Module | Files | Symbols | Description |\n|--------|-------|---------|-------------|\n".to_string();

    let mut sorted_groups: Vec<(String, Vec<&FileEntry>)> = groups.into_iter().collect();
    sorted_groups.sort_by(|a, b| a.0.cmp(&b.0));

    for (group_name, group_files) in &sorted_groups {
        let total_symbols: usize = group_files.iter().map(|f| f.symbols.len()).sum();
        let safe_name = group_name.replace('/', "-");

        // Summary for index
        let file_list: Vec<String> = group_files
            .iter()
            .take(5)
            .map(|f| format!("`{}`", f.rel_path))
            .collect();
        let symbols_summary: Vec<String> = group_files
            .iter()
            .flat_map(|f| f.symbols.iter())
            .filter(|s| s.visibility == Visibility::Public)
            .take(10)
            .map(|s| format!("{}::{}", s.kind, s.name))
            .collect();

        let prompt = format!(
            r#"Write a concise module documentation page for the "{}" module.

## Files in this module
{}

## Public symbols
{}

## Imports from other modules
{}

Write:
1. "Purpose" — what this module does (1-2 sentences)
2. "Key Components" — the main types/functions and what they do
3. "Internal Flow" — how the components interact
4. "Dependencies" — what other modules this depends on

Be precise and concise. No page title."#,
            group_name,
            file_list.join(", "),
            symbols_summary.join("\n"),
            gather_imports(group_files, dep_graph),
        );

        let system = "You are writing internal module documentation for a software engineering team. Be precise and concise.";
        let llm_content = call_llm_or_fallback(http, config, system, &prompt).await;

        let page_path = format!("03-core-concepts/{}.md", safe_name);
        let first_line = llm_content.lines().next().unwrap_or("Module");
        index_content.push_str(&format!(
            "| [{}](03-core-concepts/{}.md) | {} | {} | {} |\n",
            group_name,
            safe_name,
            group_files.len(),
            total_symbols,
            first_line.chars().take(60).collect::<String>(),
        ));

        pages.push(WikiPage {
            rel_path: page_path,
            title: format!("Module: {}", group_name),
            content: format!("# Module: {}\n\n{}\n", group_name, llm_content),
        });
    }

    // Insert index page at the beginning
    pages.insert(
        0,
        WikiPage {
            rel_path: "03-core-concepts/README.md".to_string(),
            title: "Core Concepts".to_string(),
            content: index_content,
        },
    );

    Ok(pages)
}

// ─── 04-api-reference.md ────────────────────────────────────────────────

fn generate_api_reference(files: &[FileEntry], _config: &RepoWikiConfig) -> WikiPage {
    let mut content = "# API Reference\n\nPublic symbols exposed by this codebase.\n\n".to_string();

    // Group by file
    for file in files {
        let public_symbols: Vec<&super::SymbolInfo> = file
            .symbols
            .iter()
            .filter(|s| s.visibility == Visibility::Public)
            .collect();

        if public_symbols.is_empty() {
            continue;
        }

        content.push_str(&format!("## `{}`\n\n", file.rel_path));

        for sym in &public_symbols {
            let sig_display = sym
                .signature
                .as_deref()
                .unwrap_or(&sym.name);
            content.push_str(&format!(
                "### `{}` ({})\n\n```\n{}\n```\n\n",
                sym.name, sym.kind, sig_display,
            ));

            if let Some(doc) = &sym.doc_comment {
                content.push_str(&format!("{}\n\n", doc));
            }

            content.push_str(&format!(
                "Lines {}-{}\n\n---\n\n",
                sym.start_line + 1,
                sym.end_line + 1,
            ));
        }
    }

    WikiPage {
        rel_path: "04-api-reference.md".to_string(),
        title: "API Reference".to_string(),
        content,
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────

fn language_breakdown(files: &[FileEntry]) -> String {
    let mut counts: HashMap<&str, usize> = HashMap::new();
    for file in files {
        *counts.entry(&file.language).or_default() += 1;
    }
    let mut pairs: Vec<(&&str, &usize)> = counts.iter().collect();
    pairs.sort_by(|a, b| b.1.cmp(a.1));
    pairs
        .iter()
        .map(|(lang, count)| format!("{}: {}", lang, count))
        .collect::<Vec<_>>()
        .join(", ")
}

fn top_public_symbols(files: &[FileEntry], limit: usize) -> Vec<String> {
    let mut symbols: Vec<String> = files
        .iter()
        .flat_map(|f| {
            f.symbols
                .iter()
                .filter(|s| s.visibility == Visibility::Public)
                .map(move |s| format!("- `{}::{}` ({})", f.rel_path, s.name, s.kind))
        })
        .collect();
    symbols.truncate(limit);
    symbols
}

fn gather_imports(group_files: &[&FileEntry], dep_graph: &DependencyGraph) -> String {
    let group_paths: std::collections::HashSet<&str> =
        group_files.iter().map(|f| f.rel_path.as_str()).collect();

    let external_deps: Vec<String> = dep_graph
        .edges
        .iter()
        .filter(|e| group_paths.contains(e.from.as_str()) && !group_paths.contains(e.to.as_str()))
        .map(|e| format!("{} → {}", e.from, e.to))
        .take(10)
        .collect();

    if external_deps.is_empty() {
        "None detected".to_string()
    } else {
        external_deps.join("\n")
    }
}

/// Call Ollama LLM; if unavailable, return a fallback placeholder
async fn call_llm_or_fallback(
    http: &reqwest::Client,
    config: &RepoWikiConfig,
    system: &str,
    prompt: &str,
) -> String {
    match super::llm_chat(http, &config.ollama_url, &config.model, system, prompt).await {
        Ok(content) => content,
        Err(e) => {
            log::warn!("LLM call failed ({}), using fallback content", e);
            format!(
                "*Auto-generated documentation placeholder. LLM was unavailable: {}*\n\n\
                 > Re-run RepoWiki generation when Ollama is running to get AI-powered documentation.\n\n\
                 Raw prompt was:\n```\n{}\n```",
                e,
                prompt.chars().take(500).collect::<String>(),
            )
        }
    }
}
