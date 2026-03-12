//! Project-wide Search & Replace
//!
//! Fast file search using walkdir + regex, with gitignore-aware filtering.
//! Called by GlobalSearch.tsx via `search_in_project` and `replace_in_project`.

use regex::RegexBuilder;
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::command;
use walkdir::WalkDir;

/// A single match within a file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchMatch {
    pub line: usize,
    pub column: usize,
    pub text: String,
    pub context: String,
}

/// Search results for a single file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub file: String,
    pub matches: Vec<SearchMatch>,
}

/// Check if a path should be excluded from search
fn is_excluded(path: &Path, root: &Path, exclude_filter: &str) -> bool {
    let relative = path.strip_prefix(root).unwrap_or(path);
    let rel_str = relative.to_string_lossy();

    // Always skip common binary/build directories
    let skip_dirs = [
        "node_modules",
        ".git",
        "target",
        "dist",
        "build",
        ".next",
        "__pycache__",
        ".venv",
        "venv",
        ".tox",
        "out",
    ];
    for component in relative.components() {
        let s = component.as_os_str().to_string_lossy();
        if skip_dirs.iter().any(|d| s == *d) {
            return true;
        }
    }

    // User-supplied exclude globs (comma-separated simple patterns)
    if !exclude_filter.is_empty() {
        for pattern in exclude_filter.split(',').map(|s| s.trim()) {
            if !pattern.is_empty() {
                // Simple glob: *.log, test/*, etc.
                if let Ok(re) = glob_to_regex(pattern) {
                    if re.is_match(&rel_str) {
                        return true;
                    }
                }
            }
        }
    }

    false
}

/// Check if a file matches the include filter
fn matches_file_filter(path: &Path, root: &Path, file_filter: &str) -> bool {
    if file_filter.is_empty() {
        return true;
    }
    let relative = path.strip_prefix(root).unwrap_or(path);
    let rel_str = relative.to_string_lossy();
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy())
        .unwrap_or_default();

    for pattern in file_filter.split(',').map(|s| s.trim()) {
        if !pattern.is_empty() {
            if let Ok(re) = glob_to_regex(pattern) {
                if re.is_match(&rel_str) || re.is_match(&file_name) {
                    return true;
                }
            }
        }
    }
    false
}

/// Convert a simple glob pattern to a regex
fn glob_to_regex(glob: &str) -> Result<regex::Regex, regex::Error> {
    let mut re = String::with_capacity(glob.len() * 2);
    re.push('^');
    for c in glob.chars() {
        match c {
            '*' => re.push_str(".*"),
            '?' => re.push('.'),
            '.' => re.push_str("\\."),
            '/' | '\\' => re.push_str("[/\\\\]"),
            c => re.push(c),
        }
    }
    re.push('$');
    RegexBuilder::new(&re).case_insensitive(true).build()
}

/// Build the search regex from query and options
fn build_search_regex(
    query: &str,
    use_regex: bool,
    case_sensitive: bool,
    match_whole_word: bool,
) -> Result<regex::Regex, String> {
    let pattern = if use_regex {
        if match_whole_word {
            format!(r"\b(?:{})\b", query)
        } else {
            query.to_string()
        }
    } else {
        let escaped = regex::escape(query);
        if match_whole_word {
            format!(r"\b{}\b", escaped)
        } else {
            escaped
        }
    };

    RegexBuilder::new(&pattern)
        .case_insensitive(!case_sensitive)
        .build()
        .map_err(|e| format!("Invalid search pattern: {}", e))
}

/// Check if a file is likely binary
fn is_binary(path: &Path) -> bool {
    let binary_exts = [
        "png", "jpg", "jpeg", "gif", "bmp", "ico", "svg", "webp", "mp3", "mp4", "avi", "mov",
        "mkv", "wav", "flac", "zip", "tar", "gz", "bz2", "xz", "7z", "rar", "exe", "dll", "so",
        "dylib", "o", "a", "lib", "wasm", "class", "pyc", "pyo", "pdf", "doc", "docx", "xls",
        "xlsx", "ttf", "otf", "woff", "woff2", "eot", "db", "sqlite", "sqlite3",
    ];
    path.extension()
        .map(|ext| binary_exts.iter().any(|b| ext.eq_ignore_ascii_case(b)))
        .unwrap_or(false)
}

/// Search across all files in a project directory
#[command]
pub async fn search_in_project(
    path: String,
    query: String,
    use_regex: bool,
    case_sensitive: bool,
    match_whole_word: bool,
    file_filter: String,
    exclude_filter: String,
) -> Result<Vec<SearchResult>, String> {
    if query.is_empty() {
        return Ok(vec![]);
    }

    let re = build_search_regex(&query, use_regex, case_sensitive, match_whole_word)?;
    let root = Path::new(&path);

    if !root.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }

    let mut results: Vec<SearchResult> = Vec::new();
    let max_results = 5000; // Cap total matches
    let mut total_matches = 0;

    for entry in WalkDir::new(root)
        .follow_links(false)
        .max_depth(20)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if total_matches >= max_results {
            break;
        }

        let file_path = entry.path();

        if !file_path.is_file() {
            continue;
        }

        if is_excluded(file_path, root, &exclude_filter) {
            continue;
        }

        if !matches_file_filter(file_path, root, &file_filter) {
            continue;
        }

        if is_binary(file_path) {
            continue;
        }

        // Read file content
        let content = match std::fs::read_to_string(file_path) {
            Ok(c) => c,
            Err(_) => continue, // Skip unreadable files
        };

        let mut file_matches: Vec<SearchMatch> = Vec::new();

        for (line_idx, line) in content.lines().enumerate() {
            for mat in re.find_iter(line) {
                file_matches.push(SearchMatch {
                    line: line_idx + 1,
                    column: mat.start() + 1,
                    text: mat.as_str().to_string(),
                    context: line.to_string(),
                });
                total_matches += 1;
                if total_matches >= max_results {
                    break;
                }
            }
            if total_matches >= max_results {
                break;
            }
        }

        if !file_matches.is_empty() {
            let display_path = file_path
                .strip_prefix(root)
                .unwrap_or(file_path)
                .to_string_lossy()
                .replace('\\', "/");

            results.push(SearchResult {
                file: display_path,
                matches: file_matches,
            });
        }
    }

    Ok(results)
}

/// Replace all occurrences across files in a project
#[command]
pub async fn replace_in_project(
    path: String,
    query: String,
    replacement: String,
    use_regex: bool,
    case_sensitive: bool,
    match_whole_word: bool,
    file_filter: String,
    exclude_filter: String,
) -> Result<u32, String> {
    if query.is_empty() {
        return Ok(0);
    }

    let re = build_search_regex(&query, use_regex, case_sensitive, match_whole_word)?;
    let root = Path::new(&path);

    if !root.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }

    let mut files_changed: u32 = 0;

    for entry in WalkDir::new(root)
        .follow_links(false)
        .max_depth(20)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let file_path = entry.path();

        if !file_path.is_file() {
            continue;
        }

        if is_excluded(file_path, root, &exclude_filter) {
            continue;
        }

        if !matches_file_filter(file_path, root, &file_filter) {
            continue;
        }

        if is_binary(file_path) {
            continue;
        }

        let content = match std::fs::read_to_string(file_path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        if re.is_match(&content) {
            let new_content = re.replace_all(&content, replacement.as_str()).to_string();
            if new_content != content {
                std::fs::write(file_path, &new_content)
                    .map_err(|e| format!("Failed to write {}: {}", file_path.display(), e))?;
                files_changed += 1;
            }
        }
    }

    Ok(files_changed)
}
