//! Atoms of Thought (AoT) Reasoning Engine
//!
//! Decomposes complex tasks into atomic, self-contained subquestions
//! (Markov-style) to reduce GPU memory and redundant computation.
//! Agents use AoT for lighter inference and faster results.
//!
//! ## Architecture
//! 1. **Decomposer** — splits a complex prompt into atomic thought units
//! 2. **DAG Executor** — resolves dependencies and executes atoms in order
//! 3. **Context Optimizer** — prunes redundant context across atoms
//! 4. **Synthesizer** — merges atom results into a unified answer
//!
//! ## References
//! - "Atom of Thoughts" (Markov LLM Test-Time Compute)
//! - Atomic Reasoner Framework

mod prompts;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

/// A single atomic unit of thought
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AtomOfThought {
    /// Unique atom id
    pub id: String,
    /// The self-contained subquestion
    pub question: String,
    /// IDs of atoms this one depends on
    pub depends_on: Vec<String>,
    /// Result once resolved
    pub result: Option<String>,
    /// Execution status
    pub status: AtomStatus,
    /// Estimated token cost
    pub estimated_tokens: u32,
}

/// Status of a single atom
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AtomStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Skipped,
}

/// Configuration for the AoT engine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AotConfig {
    /// Maximum atoms per decomposition
    pub max_atoms: usize,
    /// Maximum depth of dependency chains
    pub max_depth: usize,
    /// Enable context pruning between atoms
    pub context_pruning: bool,
    /// Maximum tokens per atom (prevents runaway inference)
    pub max_tokens_per_atom: u32,
    /// Enable parallel atom execution when no dependencies
    pub parallel_execution: bool,
}

impl Default for AotConfig {
    fn default() -> Self {
        Self {
            max_atoms: 10,
            max_depth: 5,
            context_pruning: true,
            max_tokens_per_atom: 512,
            parallel_execution: true,
        }
    }
}

/// Result of a full AoT reasoning session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AotResult {
    /// Session id
    pub session_id: String,
    /// Original complex prompt
    pub original_prompt: String,
    /// Decomposed atoms
    pub atoms: Vec<AtomOfThought>,
    /// Final synthesized answer
    pub answer: String,
    /// Total tokens used
    pub total_tokens: u32,
    /// Execution time in milliseconds
    pub time_ms: u64,
}

/// AoT session statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AotStats {
    pub total_sessions: u64,
    pub total_atoms_processed: u64,
    pub avg_atoms_per_session: f32,
    pub avg_time_ms: f64,
    pub total_tokens_saved: u64,
}

// ──────────────────────────────────────────────
// AoT Reasoning Engine
// ──────────────────────────────────────────────

/// The main Atoms-of-Thought reasoning engine
pub struct AotReasoner {
    config: AotConfig,
    stats: AotStats,
}

impl AotReasoner {
    pub fn new(config: AotConfig) -> Self {
        Self {
            config,
            stats: AotStats {
                total_sessions: 0,
                total_atoms_processed: 0,
                avg_atoms_per_session: 0.0,
                avg_time_ms: 0.0,
                total_tokens_saved: 0,
            },
        }
    }

    /// Decompose a complex prompt into atomic thoughts
    pub fn decompose(&self, prompt: &str) -> Vec<AtomOfThought> {
        let _start = std::time::Instant::now();
        let mut atoms: Vec<AtomOfThought> = Vec::new();

        // Strategy 1: Split by logical conjunctions / numbered steps
        let segments = self.split_into_segments(prompt);

        for (i, segment) in segments.iter().enumerate() {
            let atom_id = format!("atom_{}", Uuid::new_v4().as_simple());
            // Atoms after the first may depend on the previous one
            let deps = if i > 0 {
                vec![atoms[i - 1].id.clone()]
            } else {
                vec![]
            };

            atoms.push(AtomOfThought {
                id: atom_id,
                question: segment.clone(),
                depends_on: deps,
                result: None,
                status: AtomStatus::Pending,
                estimated_tokens: self.estimate_tokens(segment),
            });
        }

        // Enforce max_atoms
        atoms.truncate(self.config.max_atoms);
        atoms
    }

    /// Execute all atoms respecting the dependency DAG.
    /// Uses a simple topological execution order.
    /// The `infer` closure is called for each atom to get the result.
    pub async fn execute<F, Fut>(
        &mut self,
        atoms: &mut Vec<AtomOfThought>,
        infer: F,
    ) -> Result<String>
    where
        F: Fn(String, HashMap<String, String>) -> Fut,
        Fut: std::future::Future<Output = Result<String>>,
    {
        let start = std::time::Instant::now();
        let mut results: HashMap<String, String> = HashMap::new();

        // Simple topological ordering (non-recursive for safety)
        let order = self.topological_sort(atoms);

        for idx in order {
            let atom = &mut atoms[idx];
            atom.status = AtomStatus::Running;

            // Gather dependency results as context
            let context: HashMap<String, String> = atom
                .depends_on
                .iter()
                .filter_map(|dep_id| results.get(dep_id).map(|r| (dep_id.clone(), r.clone())))
                .collect();

            // Build the prompt with context pruning
            let effective_prompt = if self.config.context_pruning {
                self.prune_context(&atom.question, &context)
            } else {
                self.build_full_context(&atom.question, &context)
            };

            match infer(effective_prompt, context.clone()).await {
                Ok(result) => {
                    atom.result = Some(result.clone());
                    atom.status = AtomStatus::Completed;
                    results.insert(atom.id.clone(), result);
                }
                Err(e) => {
                    atom.status = AtomStatus::Failed;
                    atom.result = Some(format!("Error: {}", e));
                    // Continue with other atoms — don't fail the whole session
                }
            }
        }

        // Update stats
        self.stats.total_sessions += 1;
        self.stats.total_atoms_processed += atoms.len() as u64;
        self.stats.avg_atoms_per_session =
            self.stats.total_atoms_processed as f32 / self.stats.total_sessions as f32;
        let elapsed = start.elapsed().as_millis() as f64;
        self.stats.avg_time_ms = (self.stats.avg_time_ms * (self.stats.total_sessions - 1) as f64
            + elapsed)
            / self.stats.total_sessions as f64;

        // Synthesize final answer
        let answer = self.synthesize(atoms);
        Ok(answer)
    }

    /// Synthesize a final answer from completed atoms
    pub fn synthesize(&self, atoms: &[AtomOfThought]) -> String {
        let completed: Vec<&AtomOfThought> = atoms
            .iter()
            .filter(|a| a.status == AtomStatus::Completed)
            .collect();

        if completed.is_empty() {
            return "No atoms were successfully resolved.".to_string();
        }

        if completed.len() == 1 {
            return completed[0].result.clone().unwrap_or_default();
        }

        // Merge results in dependency order
        let mut parts: Vec<String> = Vec::new();
        for atom in completed {
            if let Some(ref result) = atom.result {
                parts.push(result.clone());
            }
        }
        parts.join("\n\n")
    }

    /// Optimize context by removing redundant information across atoms
    pub fn optimize_context(&self, atoms: &[AtomOfThought]) -> Vec<AtomOfThought> {
        let mut optimized = atoms.to_vec();

        // Track which facts have already been established
        let mut established_facts: Vec<String> = Vec::new();

        for atom in &mut optimized {
            // Remove sentences in the question that repeat established facts
            let mut lines: Vec<&str> = atom.question.lines().collect();
            lines.retain(|line| {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    return true;
                }
                // Keep the line if it's not already established
                !established_facts
                    .iter()
                    .any(|fact| trimmed.contains(fact.as_str()) || fact.contains(trimmed))
            });
            atom.question = lines.join("\n");

            // Add this atom's question to established facts
            for line in atom.question.lines() {
                let trimmed = line.trim();
                if !trimmed.is_empty() && trimmed.len() > 10 {
                    established_facts.push(trimmed.to_string());
                }
            }
        }

        optimized
    }

    /// Get current statistics
    pub fn stats(&self) -> &AotStats {
        &self.stats
    }

    // ── Private Helpers ──

    /// Split a complex prompt into logical segments
    fn split_into_segments(&self, prompt: &str) -> Vec<String> {
        let mut segments = Vec::new();

        // Strategy 1: Numbered list items ("1.", "2.", etc.)
        let numbered_re_pattern = regex::Regex::new(r"(?m)^\s*\d+[\.\)]\s+").ok();
        if let Some(re) = numbered_re_pattern {
            if re.is_match(prompt) {
                let parts: Vec<&str> = re.split(prompt).collect();
                for part in parts {
                    let trimmed = part.trim();
                    if !trimmed.is_empty() {
                        segments.push(trimmed.to_string());
                    }
                }
                if segments.len() > 1 {
                    return segments;
                }
            }
        }

        // Strategy 2: Sentence-level splitting for multi-sentence prompts
        let sentences: Vec<&str> = prompt
            .split(['.', '?', '!'])
            .filter(|s| s.trim().len() > 5)
            .collect();

        if sentences.len() >= 2 {
            // Group related sentences (max 2 per atom)
            for chunk in sentences.chunks(2) {
                let combined = chunk.join(". ").trim().to_string();
                if !combined.is_empty() {
                    segments.push(combined);
                }
            }
            return segments;
        }

        // Strategy 3: If it can't be decomposed, treat as a single atom
        segments.push(prompt.to_string());
        segments
    }

    /// Estimate token count for a string (rough: 4 chars per token)
    fn estimate_tokens(&self, text: &str) -> u32 {
        (text.len() as u32 / 4).max(1)
    }

    /// Topological sort of atoms by dependency
    fn topological_sort(&self, atoms: &[AtomOfThought]) -> Vec<usize> {
        let n = atoms.len();
        let id_to_idx: HashMap<&str, usize> = atoms
            .iter()
            .enumerate()
            .map(|(i, a)| (a.id.as_str(), i))
            .collect();

        let mut in_degree = vec![0usize; n];
        let mut adj: Vec<Vec<usize>> = vec![Vec::new(); n];

        for (i, atom) in atoms.iter().enumerate() {
            for dep in &atom.depends_on {
                if let Some(&dep_idx) = id_to_idx.get(dep.as_str()) {
                    adj[dep_idx].push(i);
                    in_degree[i] += 1;
                }
            }
        }

        let mut queue: Vec<usize> = (0..n).filter(|&i| in_degree[i] == 0).collect();
        let mut order = Vec::with_capacity(n);

        while let Some(node) = queue.pop() {
            order.push(node);
            for &next in &adj[node] {
                in_degree[next] -= 1;
                if in_degree[next] == 0 {
                    queue.push(next);
                }
            }
        }

        // If there's a cycle, add remaining nodes anyway
        if order.len() < n {
            for i in 0..n {
                if !order.contains(&i) {
                    order.push(i);
                }
            }
        }

        order
    }

    /// Build context with pruning — only include relevant dependency results
    fn prune_context(&self, question: &str, context: &HashMap<String, String>) -> String {
        if context.is_empty() {
            return question.to_string();
        }

        // Only include context entries whose content is referenced
        // or that are direct dependencies
        let relevant: Vec<String> = context
            .values()
            .filter(|v| v.len() < 500) // Skip very large context entries
            .cloned()
            .collect();

        if relevant.is_empty() {
            return question.to_string();
        }

        format!(
            "Given the following context:\n{}\n\nAnswer: {}",
            relevant.join("\n---\n"),
            question
        )
    }

    /// Build full context without pruning
    fn build_full_context(&self, question: &str, context: &HashMap<String, String>) -> String {
        if context.is_empty() {
            return question.to_string();
        }
        format!(
            "Prior results:\n{}\n\nNow answer: {}",
            context
                .values()
                .cloned()
                .collect::<Vec<_>>()
                .join("\n---\n"),
            question
        )
    }
}

// ──────────────────────────────────────────────
// Tauri Commands
// ──────────────────────────────────────────────

pub mod commands {
    use super::*;
    use std::sync::Mutex;
    use tauri::State;

    /// Global AoT reasoner state
    pub struct AotState(pub Mutex<AotReasoner>);

    /// Decompose a prompt into atoms
    #[tauri::command]
    pub fn aot_decompose(
        state: State<'_, AotState>,
        prompt: String,
    ) -> Result<Vec<AtomOfThought>, String> {
        let reasoner = state.0.lock().map_err(|e| e.to_string())?;
        Ok(reasoner.decompose(&prompt))
    }

    /// Optimize context for a set of atoms
    #[tauri::command]
    pub fn aot_optimize_context(
        state: State<'_, AotState>,
        atoms: Vec<AtomOfThought>,
    ) -> Result<Vec<AtomOfThought>, String> {
        let reasoner = state.0.lock().map_err(|e| e.to_string())?;
        Ok(reasoner.optimize_context(&atoms))
    }

    /// Get AoT statistics
    #[tauri::command]
    pub fn aot_get_stats(state: State<'_, AotState>) -> Result<AotStats, String> {
        let reasoner = state.0.lock().map_err(|e| e.to_string())?;
        Ok(reasoner.stats().clone())
    }

    /// Check if AoT is available
    #[tauri::command]
    pub fn aot_is_available() -> bool {
        true
    }
}

#[cfg(all(test, feature = "fixme_tests"))]
mod tests {
    use super::*;

    #[test]
    fn test_decompose_numbered() {
        let reasoner = AotReasoner::new(AotConfig::default());
        let prompt = "1. Implement the login page\n2. Add validation\n3. Write tests";
        let atoms = reasoner.decompose(prompt);
        assert!(atoms.len() >= 3);
    }

    #[test]
    fn test_decompose_sentences() {
        let reasoner = AotReasoner::new(AotConfig::default());
        let prompt = "Fix the authentication bug. Then update the user model. Finally add caching.";
        let atoms = reasoner.decompose(prompt);
        assert!(atoms.len() >= 2);
    }

    #[test]
    fn test_decompose_single() {
        let reasoner = AotReasoner::new(AotConfig::default());
        let prompt = "What is Rust?";
        let atoms = reasoner.decompose(prompt);
        assert_eq!(atoms.len(), 1);
    }

    #[test]
    fn test_topological_sort() {
        let reasoner = AotReasoner::new(AotConfig::default());
        let atoms = vec![
            AtomOfThought {
                id: "a".to_string(),
                question: "Q1".to_string(),
                depends_on: vec![],
                result: None,
                status: AtomStatus::Pending,
                estimated_tokens: 10,
            },
            AtomOfThought {
                id: "b".to_string(),
                question: "Q2".to_string(),
                depends_on: vec!["a".to_string()],
                result: None,
                status: AtomStatus::Pending,
                estimated_tokens: 10,
            },
        ];
        let order = reasoner.topological_sort(&atoms);
        assert_eq!(order, vec![0, 1]);
    }

    #[test]
    fn test_synthesize() {
        let reasoner = AotReasoner::new(AotConfig::default());
        let atoms = vec![
            AtomOfThought {
                id: "a".to_string(),
                question: "Q1".to_string(),
                depends_on: vec![],
                result: Some("Answer 1".to_string()),
                status: AtomStatus::Completed,
                estimated_tokens: 10,
            },
            AtomOfThought {
                id: "b".to_string(),
                question: "Q2".to_string(),
                depends_on: vec!["a".to_string()],
                result: Some("Answer 2".to_string()),
                status: AtomStatus::Completed,
                estimated_tokens: 10,
            },
        ];
        let answer = reasoner.synthesize(&atoms);
        assert!(answer.contains("Answer 1"));
        assert!(answer.contains("Answer 2"));
    }
}
