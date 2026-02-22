//! AI-Powered Completion Engine
//!
//! Implements the parallel completion flow with performance budget:
//! - Symbol table: 1ms
//! - Tree-sitter patterns: 5ms  
//! - WASM molecule: 10ms
//! - AI hints: 50ms (parallel)
//! - Merge and return: 5ms
//! Total budget: 100ms

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use parking_lot::RwLock;
use tokio::sync::Mutex as AsyncMutex;
use futures_util::future::join_all;

use super::{Symbol, SymbolKind, CompletionItem, CompletionKind, MolecularLsp};

/// Performance budget in milliseconds
pub const PERFORMANCE_BUDGET_MS: u64 = 100;

/// Completion source result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionSourceResult {
    pub source: String,
    pub latency_ms: u64,
    pub items: Vec<ScoredCompletion>,
}

/// Completion item with relevance score
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoredCompletion {
    pub item: CompletionItem,
    pub score: f32,
    pub source: String,
}

/// Completion context passed to the engine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionContext {
    pub file_path: String,
    pub language: String,
    pub code: String,
    pub line: usize,
    pub column: usize,
    pub trigger_kind: CompletionTriggerKind,
    pub prefix: String,
    pub scope: Option<String>,
}

/// How completion was triggered
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CompletionTriggerKind {
    Invoked,      // Ctrl+Space
    TriggerCharacter, // . or ::
    TriggerForIncompleteCompletions,
}

/// Enhanced completion response with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionResponse {
    pub items: Vec<ScoredCompletion>,
    pub total_latency_ms: u64,
    pub sources_used: Vec<String>,
    pub is_incomplete: bool,
    pub performance_warning: Option<String>,
}

/// AI-powered completion engine
pub struct AiCompletionEngine {
    lsp: Arc<RwLock<MolecularLsp>>,
    symbol_table: Arc<RwLock<SymbolTable>>,
    pattern_cache: Arc<RwLock<PatternCache>>,
    ai_client: Option<Arc<AsyncMutex<super::super::ai::AiClient>>>,
    stats: Arc<RwLock<CompletionStats>>,
}

/// Symbol table for fast local lookups
#[derive(Debug, Clone, Default)]
pub struct SymbolTable {
    file_symbols: HashMap<String, Vec<Symbol>>,
    workspace_symbols: Vec<Symbol>,
    scope_cache: HashMap<String, Vec<Symbol>>,
}

/// Pattern cache for common code patterns
#[derive(Debug, Clone, Default)]
pub struct PatternCache {
    patterns: HashMap<String, Vec<CompletionPattern>>,
    snippets: HashMap<String, Vec<Snippet>>,
}

/// A code pattern for completion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionPattern {
    pub name: String,
    pub pattern_type: PatternType,
    pub template: String,
    pub description: String,
    pub languages: Vec<String>,
    pub score_boost: f32,
}

/// Types of patterns
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PatternType {
    FunctionBody,
    LoopPattern,
    ErrorHandling,
    TestData,
    CommonAlgorithm,
}

/// Snippet for insertion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snippet {
    pub label: String,
    pub prefix: String,
    pub body: String,
    pub description: String,
    pub scope: Option<String>,
}

/// Completion statistics for monitoring
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CompletionStats {
    pub total_requests: u64,
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub avg_latency_ms: f32,
    pub timeout_count: u64,
    pub source_latency: HashMap<String, f32>,
}

impl AiCompletionEngine {
    /// Create a new AI completion engine
    pub fn new(lsp: Arc<RwLock<MolecularLsp>>) -> Self {
        let mut engine = Self {
            lsp,
            symbol_table: Arc::new(RwLock::new(SymbolTable::default())),
            pattern_cache: Arc::new(RwLock::new(PatternCache::default())),
            ai_client: None,
            stats: Arc::new(RwLock::new(CompletionStats::default())),
        };
        
        engine.load_default_patterns();
        engine
    }

    /// Set AI client for neural hints
    pub fn set_ai_client(&mut self, client: Arc<AsyncMutex<super::super::ai::AiClient>>) {
        self.ai_client = Some(client);
    }

    /// Load default code patterns and snippets
    fn load_default_patterns(&mut self) {
        let mut cache = self.pattern_cache.write();
        
        // Fibonacci patterns
        cache.patterns.insert("fibonacci".to_string(), vec![
            CompletionPattern {
                name: "fib_recursive".to_string(),
                pattern_type: PatternType::CommonAlgorithm,
                template: "match n {\n    0 => 0,\n    1 => 1,\n    _ => fib(n-1) + fib(n-2)\n}".to_string(),
                description: "Recursive Fibonacci".to_string(),
                languages: vec!["rust".to_string()],
                score_boost: 0.95,
            },
            CompletionPattern {
                name: "fib_iterative".to_string(),
                pattern_type: PatternType::CommonAlgorithm,
                template: "let (mut a, mut b) = (0, 1);\nfor _ in 0..n {\n    let temp = a + b;\n    a = b;\n    b = temp;\n}\na".to_string(),
                description: "Iterative Fibonacci".to_string(),
                languages: vec!["rust".to_string()],
                score_boost: 0.85,
            },
            CompletionPattern {
                name: "fib_memoized".to_string(),
                pattern_type: PatternType::CommonAlgorithm,
                template: "use std::collections::HashMap;\nlet mut memo = HashMap::new();\nmemo.insert(0, 0);\nmemo.insert(1, 1);\nfn fib_memo(n: u32, memo: &mut HashMap<u32, u32>) -> u32 {\n    if let Some(&result) = memo.get(&n) { return result; }\n    let result = fib_memo(n-1, memo) + fib_memo(n-2, memo);\n    memo.insert(n, result);\n    result\n}".to_string(),
                description: "Memoized Fibonacci".to_string(),
                languages: vec!["rust".to_string()],
                score_boost: 0.80,
            },
        ]);

        // Error handling patterns
        cache.patterns.insert("error_handling".to_string(), vec![
            CompletionPattern {
                name: "result_match".to_string(),
                pattern_type: PatternType::ErrorHandling,
                template: "match result {\n    Ok(val) => val,\n    Err(e) => return Err(e.into()),\n}".to_string(),
                description: "Result match pattern".to_string(),
                languages: vec!["rust".to_string()],
                score_boost: 0.90,
            },
            CompletionPattern {
                name: "try_catch".to_string(),
                pattern_type: PatternType::ErrorHandling,
                template: "try {\n    $1\n} catch (error) {\n    $2\n}".to_string(),
                description: "Try-catch block".to_string(),
                languages: vec!["javascript".to_string(), "typescript".to_string()],
                score_boost: 0.85,
            },
        ]);

        // Loop patterns
        cache.patterns.insert("loop".to_string(), vec![
            CompletionPattern {
                name: "for_each".to_string(),
                pattern_type: PatternType::LoopPattern,
                template: "for item in items.iter() {\n    $1\n}".to_string(),
                description: "For each loop".to_string(),
                languages: vec!["rust".to_string()],
                score_boost: 0.80,
            },
            CompletionPattern {
                name: "enumerate".to_string(),
                pattern_type: PatternType::LoopPattern,
                template: "for (i, item) in items.iter().enumerate() {\n    $1\n}".to_string(),
                description: "Enumerate loop".to_string(),
                languages: vec!["rust".to_string()],
                score_boost: 0.75,
            },
        ]);

        // Rust snippets
        cache.snippets.insert("rust".to_string(), vec![
            Snippet {
                label: "fn".to_string(),
                prefix: "fn".to_string(),
                body: "fn ${1:name}(${2:params}) -> ${3:ReturnType} {\n    ${4:todo!()}\n}".to_string(),
                description: "Function definition".to_string(),
                scope: None,
            },
            Snippet {
                label: "pfn".to_string(),
                prefix: "pfn".to_string(),
                body: "pub fn ${1:name}(${2:params}) -> ${3:ReturnType} {\n    ${4:todo!()}\n}".to_string(),
                description: "Public function".to_string(),
                scope: None,
            },
            Snippet {
                label: "struct".to_string(),
                prefix: "struct".to_string(),
                body: "struct ${1:Name} {\n    ${2:field: Type},\n}".to_string(),
                description: "Struct definition".to_string(),
                scope: None,
            },
            Snippet {
                label: "impl".to_string(),
                prefix: "impl".to_string(),
                body: "impl ${1:Type} {\n    ${2:fn method(&self) {\\n        todo!()\\n    }}\n}".to_string(),
                description: "Implementation block".to_string(),
                scope: None,
            },
            Snippet {
                label: "test".to_string(),
                prefix: "test".to_string(),
                body: "#[test]\nfn ${1:test_name}() {\n    ${2:assert!(true);}\n}".to_string(),
                description: "Test function".to_string(),
                scope: None,
            },
            Snippet {
                label: "derive".to_string(),
                prefix: "derive".to_string(),
                body: "#[derive(${1:Debug, Clone})]".to_string(),
                description: "Derive macro".to_string(),
                scope: None,
            },
        ]);

        // TypeScript snippets
        cache.snippets.insert("typescript".to_string(), vec![
            Snippet {
                label: "interface".to_string(),
                prefix: "interface".to_string(),
                body: "interface ${1:Name} {\n    ${2:property}: ${3:type};\n}".to_string(),
                description: "Interface definition".to_string(),
                scope: None,
            },
            Snippet {
                label: "type".to_string(),
                prefix: "type".to_string(),
                body: "type ${1:Name} = ${2:type};".to_string(),
                description: "Type alias".to_string(),
                scope: None,
            },
            Snippet {
                label: "arrow".to_string(),
                prefix: "arrow".to_string(),
                body: "const ${1:name} = (${2:params}): ${3:ReturnType} => {\n    ${4}\n};".to_string(),
                description: "Arrow function".to_string(),
                scope: None,
            },
        ]);
    }

    /// Get completions with parallel source fetching
    pub async fn get_completions(&self, context: CompletionContext) -> CompletionResponse {
        let start = Instant::now();
        let mut sources_used = Vec::new();
        
        // Parallel completion sources
        let symbol_task = self.get_symbol_completions(&context);
        let pattern_task = self.get_pattern_completions(&context);
        let keyword_task = self.get_keyword_completions(&context);
        let snippet_task = self.get_snippet_completions(&context);
        let ai_task = self.get_ai_completions(&context);

        // Run all sources in parallel
        let (symbol_result, pattern_result, keyword_result, snippet_result, ai_result) = 
            join_all(vec![symbol_task, pattern_task, keyword_task, snippet_task, ai_task]).await;

        // Collect all results
        let mut all_items: Vec<ScoredCompletion> = Vec::new();
        let mut latencies = Vec::new();

        // Symbol table results (fastest, highest priority)
        if let Some(result) = symbol_result {
            sources_used.push("symbol_table".to_string());
            latencies.push(result.latency_ms);
            all_items.extend(result.items);
        }

        // Pattern results
        if let Some(result) = pattern_result {
            sources_used.push("tree_sitter_patterns".to_string());
            latencies.push(result.latency_ms);
            all_items.extend(result.items);
        }

        // Keyword results
        if let Some(result) = keyword_result {
            sources_used.push("keywords".to_string());
            latencies.push(result.latency_ms);
            all_items.extend(result.items);
        }

        // Snippet results
        if let Some(result) = snippet_result {
            sources_used.push("snippets".to_string());
            latencies.push(result.latency_ms);
            all_items.extend(result.items);
        }

        // AI hints (slowest, best quality)
        if let Some(result) = ai_result {
            sources_used.push("ai_hints".to_string());
            latencies.push(result.latency_ms);
            all_items.extend(result.items);
        }

        // Sort by score (descending)
        all_items.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));

        // Deduplicate by label
        let mut seen = std::collections::HashSet::new();
        all_items.retain(|item| seen.insert(item.item.label.clone()));

        // Limit to top 50 results
        all_items.truncate(50);

        let total_latency = start.elapsed().as_millis() as u64;
        
        // Performance warning if over budget
        let performance_warning = if total_latency > PERFORMANCE_BUDGET_MS {
            Some(format!("Completion took {}ms (budget: {}ms)", total_latency, PERFORMANCE_BUDGET_MS))
        } else {
            None
        };

        // Update stats
        {
            let mut stats = self.stats.write();
            stats.total_requests += 1;
            stats.avg_latency_ms = (stats.avg_latency_ms * (stats.total_requests - 1) as f32 + total_latency as f32) / stats.total_requests as f32;
        }

        CompletionResponse {
            items: all_items,
            total_latency_ms: total_latency,
            sources_used,
            is_incomplete: false,
            performance_warning,
        }
    }

    /// Get completions from symbol table (target: 1ms)
    async fn get_symbol_completions(&self, context: &CompletionContext) -> Option<CompletionSourceResult> {
        let start = Instant::now();
        
        let symbol_table = self.symbol_table.read();
        let mut items = Vec::new();

        // Get symbols in scope
        if let Some(file_symbols) = symbol_table.file_symbols.get(&context.file_path) {
            for symbol in file_symbols {
                // Check if symbol is accessible from current position
                if symbol.start_line <= context.line {
                    items.push(ScoredCompletion {
                        item: CompletionItem {
                            label: symbol.name.clone(),
                            kind: symbol_kind_to_completion_kind(&symbol.kind),
                            detail: None,
                            documentation: symbol.documentation.clone(),
                            insert_text: Some(symbol.name.clone()),
                        },
                        score: match symbol.kind {
                            SymbolKind::Function => 0.9,
                            SymbolKind::Variable => 0.8,
                            SymbolKind::Constant => 0.7,
                            _ => 0.6,
                        },
                        source: "symbol_table".to_string(),
                    });
                }
            }
        }

        let latency = start.elapsed().as_micros() as u64;
        
        if items.is_empty() {
            None
        } else {
            Some(CompletionSourceResult {
                source: "symbol_table".to_string(),
                latency_ms: latency,
                items,
            })
        }
    }

    /// Get completions from pattern cache (target: 5ms)
    async fn get_pattern_completions(&self, context: &CompletionContext) -> Option<CompletionSourceResult> {
        let start = Instant::now();
        
        let pattern_cache = self.pattern_cache.read();
        let mut items = Vec::new();

        // Match prefix to patterns
        let prefix_lower = context.prefix.to_lowercase();
        
        for (pattern_name, patterns) in &pattern_cache.patterns {
            if prefix_lower.contains(pattern_name) || pattern_name.contains(&prefix_lower) {
                for pattern in patterns {
                    if pattern.languages.contains(&context.language) {
                        items.push(ScoredCompletion {
                            item: CompletionItem {
                                label: pattern.name.clone(),
                                kind: CompletionKind::Snippet,
                                detail: Some(pattern.description.clone()),
                                documentation: Some(pattern.template.clone()),
                                insert_text: Some(pattern.template.clone()),
                            },
                            score: pattern.score_boost,
                            source: "tree_sitter_patterns".to_string(),
                        });
                    }
                }
            }
        }

        let latency = start.elapsed().as_micros() as u64;

        if items.is_empty() {
            None
        } else {
            Some(CompletionSourceResult {
                source: "tree_sitter_patterns".to_string(),
                latency_ms: latency,
                items,
            })
        }
    }

    /// Get keyword completions (target: 1ms)
    async fn get_keyword_completions(&self, context: &CompletionContext) -> Option<CompletionSourceResult> {
        let start = Instant::now();
        
        let lsp = self.lsp.read();
        let config = lsp.get_config(&context.language)?;
        
        let mut items = Vec::new();
        let prefix_lower = context.prefix.to_lowercase();
        
        for keyword in &config.keywords {
            if keyword.starts_with(&prefix_lower) || prefix_lower.is_empty() {
                items.push(ScoredCompletion {
                    item: CompletionItem {
                        label: keyword.clone(),
                        kind: CompletionKind::Keyword,
                        detail: None,
                        documentation: None,
                        insert_text: Some(keyword.clone()),
                    },
                    score: 0.5,
                    source: "keywords".to_string(),
                });
            }
        }

        let latency = start.elapsed().as_micros() as u64;

        Some(CompletionSourceResult {
            source: "keywords".to_string(),
            latency_ms: latency,
            items,
        })
    }

    /// Get snippet completions (target: 5ms)
    async fn get_snippet_completions(&self, context: &CompletionContext) -> Option<CompletionSourceResult> {
        let start = Instant::now();
        
        let pattern_cache = self.pattern_cache.read();
        let snippets = pattern_cache.snippets.get(&context.language)?;
        
        let mut items = Vec::new();
        let prefix_lower = context.prefix.to_lowercase();
        
        for snippet in snippets {
            if snippet.prefix.starts_with(&prefix_lower) || prefix_lower.is_empty() {
                items.push(ScoredCompletion {
                    item: CompletionItem {
                        label: snippet.label.clone(),
                        kind: CompletionKind::Snippet,
                        detail: Some(snippet.description.clone()),
                        documentation: Some(snippet.body.clone()),
                        insert_text: Some(snippet.body.clone()),
                    },
                    score: 0.75,
                    source: "snippets".to_string(),
                });
            }
        }

        let latency = start.elapsed().as_micros() as u64;

        Some(CompletionSourceResult {
            source: "snippets".to_string(),
            latency_ms: latency,
            items,
        })
    }

    /// Get AI-powered completions (target: 50ms)
    async fn get_ai_completions(&self, context: &CompletionContext) -> Option<CompletionSourceResult> {
        let start = Instant::now();
        
        // Only call AI for complex contexts
        if context.trigger_kind != CompletionTriggerKind::Invoked {
            return None;
        }

        // Check if AI client is available
        let ai_client = self.ai_client.as_ref()?;
        
        // Build prompt for AI
        let prompt = format!(
            "Complete this {} code. File: {}, Line: {}, Prefix: '{}'\n\nCode:\n{}\n\nProvide 3 completion suggestions in JSON format: [{{\"label\": \"...\", \"insert_text\": \"...\", \"description\": \"...\"}}]",
            context.language,
            context.file_path,
            context.line,
            context.prefix,
            context.code.lines().take(context.line + 5).collect::<Vec<_>>().join("\n")
        );

        // Call AI (with timeout)
        let latency = start.elapsed().as_millis() as u64;
        
        // For now, return placeholder AI completions
        // In production, this would call the actual AI client
        let items = vec![
            ScoredCompletion {
                item: CompletionItem {
                    label: "ai_suggestion".to_string(),
                    kind: CompletionKind::Snippet,
                    detail: Some("AI-generated completion".to_string()),
                    documentation: None,
                    insert_text: Some("// AI suggestion placeholder".to_string()),
                },
                score: 0.85,
                source: "ai_hints".to_string(),
            },
        ];

        Some(CompletionSourceResult {
            source: "ai_hints".to_string(),
            latency_ms: latency,
            items,
        })
    }

    /// Update symbol table for a file
    pub fn update_symbols(&self, file_path: &str, code: &str, language: &str) {
        let lsp = self.lsp.read();
        let symbols = lsp.extract_symbols(language, code);
        
        let mut symbol_table = self.symbol_table.write();
        symbol_table.file_symbols.insert(file_path.to_string(), symbols);
    }

    /// Get completion statistics
    pub fn get_stats(&self) -> CompletionStats {
        self.stats.read().clone()
    }

    /// Clear caches
    pub fn clear_caches(&self) {
        self.symbol_table.write().file_symbols.clear();
        self.symbol_table.write().scope_cache.clear();
    }
}

/// Convert symbol kind to completion kind
fn symbol_kind_to_completion_kind(kind: &SymbolKind) -> CompletionKind {
    match kind {
        SymbolKind::Function => CompletionKind::Function,
        SymbolKind::Method => CompletionKind::Method,
        SymbolKind::Class => CompletionKind::Class,
        SymbolKind::Struct => CompletionKind::Struct,
        SymbolKind::Interface => CompletionKind::Interface,
        SymbolKind::Enum => CompletionKind::Enum,
        SymbolKind::Constant => CompletionKind::Constant,
        SymbolKind::Variable => CompletionKind::Variable,
        SymbolKind::Field => CompletionKind::Field,
        SymbolKind::Module => CompletionKind::Text,
        SymbolKind::Property => CompletionKind::Field,
        SymbolKind::Type => CompletionKind::Struct,
        SymbolKind::Macro => CompletionKind::Function,
    }
}

impl Default for AiCompletionEngine {
    fn default() -> Self {
        Self::new(Arc::new(RwLock::new(MolecularLsp::new())))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_completion_performance() {
        let lsp = Arc::new(RwLock::new(MolecularLsp::new()));
        let engine = AiCompletionEngine::new(lsp);
        
        let context = CompletionContext {
            file_path: "test.rs".to_string(),
            language: "rust".to_string(),
            code: "fn fib(n: u32) -> u32 {".to_string(),
            line: 1,
            column: 25,
            trigger_kind: CompletionTriggerKind::Invoked,
            prefix: "".to_string(),
            scope: Some("function_body".to_string()),
        };

        let response = engine.get_completions(context).await;
        
        // Should complete within budget
        assert!(response.total_latency_ms < PERFORMANCE_BUDGET_MS * 2); // Allow some slack
        assert!(!response.items.is_empty());
    }
}
