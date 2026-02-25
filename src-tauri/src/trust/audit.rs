//! Agent Thought Visualization
//!
//! Shows the agent's "thinking process" (Chain of Thought) for trust.

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// Thought step in agent reasoning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThoughtStep {
    pub id: String,
    pub agent_id: String,
    pub step_number: u32,
    pub thought_type: ThoughtType,
    pub content: String,
    pub confidence: Option<f32>,
    pub duration_ms: u64,
    pub timestamp: DateTime<Utc>,
    pub sub_steps: Vec<String>,
    pub sources: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ThoughtType {
    /// Understanding the request
    Understanding,
    /// Analyzing codebase
    Analysis,
    /// Planning the approach
    Planning,
    /// Considering alternatives
    Reasoning,
    /// Making a decision
    Decision,
    /// Executing an action
    Action,
    /// Verifying the result
    Verification,
    /// Reflecting on outcome
    Reflection,
}

/// Thought chain (complete reasoning process)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThoughtChain {
    pub id: String,
    pub agent_id: String,
    pub task: String,
    pub steps: Vec<String>, // Step IDs
    pub status: ChainStatus,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub total_tokens: u32,
    pub success: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ChainStatus {
    InProgress,
    Completed,
    Failed,
    Cancelled,
}

/// Thought visualizer
pub struct ThoughtVisualizer {
    chains: std::collections::HashMap<String, ThoughtChain>,
    steps: std::collections::HashMap<String, ThoughtStep>,
    current_chain: Option<String>,
    max_history: usize,
}

impl ThoughtVisualizer {
    pub fn new() -> Self {
        Self {
            chains: std::collections::HashMap::new(),
            steps: std::collections::HashMap::new(),
            current_chain: None,
            max_history: 100,
        }
    }
    
    /// Start a new thought chain
    pub fn start_chain(&mut self, agent_id: &str, task: &str) -> String {
        let chain_id = uuid::Uuid::new_v4().to_string();
        
        let chain = ThoughtChain {
            id: chain_id.clone(),
            agent_id: agent_id.to_string(),
            task: task.to_string(),
            steps: Vec::new(),
            status: ChainStatus::InProgress,
            started_at: Utc::now(),
            completed_at: None,
            total_tokens: 0,
            success: None,
        };
        
        self.chains.insert(chain_id.clone(), chain);
        self.current_chain = Some(chain_id.clone());
        
        chain_id
    }
    
    /// Add a thought step
    pub fn add_step(&mut self, step: ThoughtStep) -> String {
        let step_id = step.id.clone();
        let chain_id = step.id.clone(); // Use step chain context
        
        // Add step
        self.steps.insert(step_id.clone(), step.clone());
        
        // Link to chain
        if let Some(chain) = self.chains.get_mut(&chain_id) {
            chain.steps.push(step_id.clone());
            chain.total_tokens += step.content.len() as u32 / 4; // Rough estimate
        }
        
        step_id
    }
    
    /// Add step to current chain
    pub fn add_step_to_current(
        &mut self,
        agent_id: &str,
        thought_type: ThoughtType,
        content: &str,
        confidence: Option<f32>,
        duration_ms: u64,
    ) -> Option<String> {
        let chain_id = self.current_chain.clone()?;
        
        let chain = self.chains.get(&chain_id)?;
        let step_number = chain.steps.len() as u32 + 1;
        
        let step = ThoughtStep {
            id: uuid::Uuid::new_v4().to_string(),
            agent_id: agent_id.to_string(),
            step_number,
            thought_type,
            content: content.to_string(),
            confidence,
            duration_ms,
            timestamp: Utc::now(),
            sub_steps: Vec::new(),
            sources: Vec::new(),
        };
        
        let step_id = step.id.clone();
        self.steps.insert(step_id.clone(), step);
        
        if let Some(chain) = self.chains.get_mut(&chain_id) {
            chain.steps.push(step_id.clone());
        }
        
        Some(step_id)
    }
    
    /// Complete the current chain
    pub fn complete_chain(&mut self, success: bool) -> Option<String> {
        let chain_id = self.current_chain.take()?;
        
        if let Some(chain) = self.chains.get_mut(&chain_id) {
            chain.status = ChainStatus::Completed;
            chain.completed_at = Some(Utc::now());
            chain.success = Some(success);
        }
        
        Some(chain_id)
    }
    
    /// Get chain with steps
    pub fn get_chain_with_steps(&self, chain_id: &str) -> Option<(&ThoughtChain, Vec<&ThoughtStep>)> {
        let chain = self.chains.get(chain_id)?;
        let steps: Vec<_> = chain.steps.iter()
            .filter_map(|id| self.steps.get(id))
            .collect();
        
        Some((chain, steps))
    }
    
    /// Get formatted thought process for display
    pub fn format_chain(&self, chain_id: &str) -> Option<String> {
        let (chain, steps) = self.get_chain_with_steps(chain_id)?;
        
        let mut output = String::new();
        
        output.push_str(&format!("🎯 Task: {}\n\n", chain.task));
        output.push_str(&format!("Agent: {}\n", chain.agent_id));
        output.push_str(&format!("Status: {:?}\n", chain.status));
        output.push_str(&format!("Started: {}\n\n", chain.started_at.format("%H:%M:%S"));
        output.push_str("━".repeat(50).as_str());
        output.push_str("\n\n💭 Thought Process:\n\n");
        
        for step in steps {
            let icon = match step.thought_type {
                ThoughtType::Understanding => "🔍",
                ThoughtType::Analysis => "📊",
                ThoughtType::Planning => "📋",
                ThoughtType::Reasoning => "🤔",
                ThoughtType::Decision => "✅",
                ThoughtType::Action => "⚡",
                ThoughtType::Verification => "✔️",
                ThoughtType::Reflection => "📝",
            };
            
            output.push_str(&format!("{} [Step {}] {:?}\n", icon, step.step_number, step.thought_type));
            output.push_str(&format!("   {}\n", step.content));
            
            if let Some(conf) = step.confidence {
                output.push_str(&format!("   Confidence: {:.0}%\n", conf * 100.0));
            }
            
            output.push_str(&format!("   ⏱ {}ms\n\n", step.duration_ms));
        }
        
        if let Some(completed) = chain.completed_at {
            output.push_str(&format!("\n⏰ Completed: {}\n", completed.format("%H:%M:%S")));
        }
        
        if let Some(success) = chain.success {
            output.push_str(&format!("📊 Result: {}\n", if success { "✓ Success" } else { "✗ Failed" }));
        }
        
        Some(output)
    }
    
    /// Get recent chains
    pub fn get_recent_chains(&self, limit: usize) -> Vec<&ThoughtChain> {
        let mut chains: Vec<_> = self.chains.values().collect();
        chains.sort_by(|a, b| b.started_at.cmp(&a.started_at));
        chains.into_iter().take(limit).collect()
    }
}

impl Default for ThoughtVisualizer {
    fn default() -> Self {
        Self::new()
    }
}
