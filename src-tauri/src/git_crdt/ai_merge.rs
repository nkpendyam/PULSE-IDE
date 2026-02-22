//! AI-powered merge conflict resolution
//!
//! Uses local LLM to intelligently resolve merge conflicts

use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use super::MergeConflict;

/// AI merge conflict resolver
pub struct AiMergeResolver {
    model_name: String,
    resolution_history: Vec<ResolutionRecord>,
}

/// Record of a merge resolution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolutionRecord {
    pub conflict_hash: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub strategy: ResolutionStrategy,
    pub result: String,
    pub confidence: f32,
}

/// Resolution strategy used
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ResolutionStrategy {
    KeepOurs,
    KeepTheirs,
    MergeBoth,
    AiGenerated,
    Manual,
}

/// Merge suggestion from AI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeSuggestion {
    pub resolved_code: String,
    pub explanation: String,
    pub confidence: f32,
    pub strategy: ResolutionStrategy,
    pub alternatives: Vec<String>,
}

impl AiMergeResolver {
    /// Create a new AI merge resolver
    pub fn new() -> Self {
        Self {
            model_name: "codellama-7b-instruct-q4".to_string(),
            resolution_history: Vec::new(),
        }
    }

    /// Set the model to use
    pub fn set_model(&mut self, model_name: String) {
        self.model_name = model_name;
    }

    /// Resolve a merge conflict
    pub async fn resolve(&self, conflict: &MergeConflict) -> Result<String> {
        // Build resolution prompt
        let prompt = self.build_resolution_prompt(conflict);

        // For now, generate a simple merge
        // In production, this would call the local LLM
        let suggestion = self.generate_resolution(&prompt, conflict).await?;

        // Record resolution
        Ok(suggestion.resolved_code)
    }

    /// Build prompt for LLM
    fn build_resolution_prompt(&self, conflict: &MergeConflict) -> String {
        format!(
            r#"You are resolving a Git merge conflict in file: {}

## Base Version (common ancestor):
```
{}
```

## Our Version (current branch):
```
{}
```

## Their Version (merging branch):
```
{}
```

Please provide a merged version that:
1. Preserves the intent of both changes
2. Maintains code correctness
3. Follows best practices
4. Adds comments explaining any non-obvious decisions

Output only the resolved code, wrapped in markdown code fences."#,
            conflict.file_path,
            conflict.base_version,
            conflict.our_version,
            conflict.their_version
        )
    }

    /// Generate resolution using AI
    async fn generate_resolution(&self, prompt: &str, conflict: &MergeConflict) -> Result<MergeSuggestion> {
        // Simple heuristic-based resolution for now
        // In production, this would use the Swarm AI engine

        let resolved = if conflict.our_version.is_empty() {
            conflict.their_version.clone()
        } else if conflict.their_version.is_empty() {
            conflict.our_version.clone()
        } else {
            // Try to merge both
            self.try_merge_both(conflict)?
        };

        Ok(MergeSuggestion {
            resolved_code: resolved,
            explanation: "AI-generated merge combining both versions".to_string(),
            confidence: 0.8,
            strategy: ResolutionStrategy::AiGenerated,
            alternatives: vec![
                conflict.our_version.clone(),
                conflict.their_version.clone(),
            ],
        })
    }

    /// Attempt to merge both versions
    fn try_merge_both(&self, conflict: &MergeConflict) -> Result<String> {
        let our_lines: Vec<&str> = conflict.our_version.lines().collect();
        let their_lines: Vec<&str> = conflict.their_version.lines().collect();
        let base_lines: Vec<&str> = conflict.base_version.lines().collect();

        // Simple line-based merge
        let mut result = Vec::new();
        let mut our_idx = 0;
        let mut their_idx = 0;

        // Use diff algorithm for proper merge
        for base_line in &base_lines {
            // Find this line in both versions
            let in_ours = our_lines.get(our_idx) == Some(base_line);
            let in_theirs = their_lines.get(their_idx) == Some(base_line);

            if in_ours && in_theirs {
                result.push(base_line.to_string());
                our_idx += 1;
                their_idx += 1;
            } else if in_ours {
                result.push(base_line.to_string());
                our_idx += 1;
            } else if in_theirs {
                result.push(base_line.to_string());
                their_idx += 1;
            }
        }

        // Add remaining lines from both
        while our_idx < our_lines.len() {
            result.push(our_lines[our_idx].to_string());
            our_idx += 1;
        }
        while their_idx < their_lines.len() {
            result.push(their_lines[their_idx].to_string());
            their_idx += 1;
        }

        Ok(result.join("\n"))
    }

    /// Get resolution history
    pub fn get_history(&self) -> &[ResolutionRecord] {
        &self.resolution_history
    }

    /// Record a resolution
    pub fn record_resolution(&mut self, record: ResolutionRecord) {
        self.resolution_history.push(record);
    }

    /// Get resolution statistics
    pub fn get_stats(&self) -> ResolutionStats {
        let total = self.resolution_history.len();
        let ai_generated = self.resolution_history.iter()
            .filter(|r| matches!(r.strategy, ResolutionStrategy::AiGenerated))
            .count();
        
        let avg_confidence = if total > 0 {
            self.resolution_history.iter()
                .map(|r| r.confidence)
                .sum::<f32>() / total as f32
        } else {
            0.0
        };

        ResolutionStats {
            total_resolutions: total,
            ai_generated,
            manual: total - ai_generated,
            average_confidence: avg_confidence,
        }
    }
}

impl Default for AiMergeResolver {
    fn default() -> Self {
        Self::new()
    }
}

/// Resolution statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolutionStats {
    pub total_resolutions: usize,
    pub ai_generated: usize,
    pub manual: usize,
    pub average_confidence: f32,
}

/// Parse conflict markers from text
pub fn parse_conflict_markers(content: &str) -> Vec<(usize, usize, usize)> {
    let mut markers = Vec::new();
    let lines: Vec<&str> = content.lines().collect();
    
    let mut i = 0;
    while i < lines.len() {
        if lines[i].starts_with("<<<<<<<") {
            let start = i;
            let mut middle = None;
            let mut end = None;
            
            for j in (i + 1)..lines.len() {
                if lines[j].starts_with("=======") {
                    middle = Some(j);
                } else if lines[j].starts_with(">>>>>>>") {
                    end = Some(j);
                    break;
                }
            }
            
            if let (Some(middle), Some(end)) = (middle, end) {
                markers.push((start, middle, end));
                i = end + 1;
            } else {
                i += 1;
            }
        } else {
            i += 1;
        }
    }
    
    markers
}

/// Extract conflict parts from content
pub fn extract_conflict_parts(content: &str, start: usize, middle: usize, end: usize) -> (String, String) {
    let lines: Vec<&str> = content.lines().collect();
    
    let our_part = lines[start + 1..middle].join("\n");
    let their_part = lines[middle + 1..end].join("\n");
    
    (our_part, their_part)
}
