//! Autonomous Planner Module
//!
//! Plans multi-step tasks for autonomous agents, implementing AST pruning
//! and dependency tracking for complex LLM executions.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

/// Status of a plan step
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum StepStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Skipped,
}

/// Pruning strategy for context management
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PruningStrategy {
    None,
    SignaturesOnly,       // Strip all function bodies
    TargetedSignatures,   // Keep body of target function only
    ImportsOnly,          // Show only imports and struct definitions
}

/// A discrete step in the autonomous plan
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanStep {
    pub id: String,
    pub description: String,
    pub tool_name: Option<String>,
    pub tool_args: serde_json::Value,
    pub dependencies: Vec<String>,
    pub status: StepStatus,
    /// Strategy to compress context sent to the LLM
    pub pruning_strategy: PruningStrategy,
}

/// Task planner state machine
#[derive(Debug, Serialize, Deserialize)]
pub struct Planner {
    pub task_objective: String,
    pub steps: HashMap<String, PlanStep>,
    pub execution_order: Vec<String>,
}

impl Planner {
    pub fn new(task_objective: &str) -> Self {
        Self {
            task_objective: task_objective.to_string(),
            steps: HashMap::new(),
            execution_order: Vec::new(),
        }
    }

    /// Add a new step to the plan
    pub fn add_step(&mut self, step: PlanStep) {
        if !self.execution_order.contains(&step.id) {
            self.execution_order.push(step.id.clone());
        }
        self.steps.insert(step.id.clone(), step);
    }

    /// Gets the next executable step whose dependencies are met
    pub fn next_executable_step(&self) -> Option<&PlanStep> {
        let completed_steps: HashSet<&String> = self
            .steps
            .iter()
            .filter(|(_, step)| step.status == StepStatus::Completed)
            .map(|(id, _)| id)
            .collect();

        for id in &self.execution_order {
            if let Some(step) = self.steps.get(id) {
                if step.status == StepStatus::Pending {
                    let can_execute = step.dependencies.iter().all(|dep| completed_steps.contains(dep));
                    if can_execute {
                        return Some(step);
                    }
                }
            }
        }
        None
    }

    /// Update the status of a specific step
    pub fn update_step_status(&mut self, id: &str, status: StepStatus) -> Result<(), String> {
        if let Some(step) = self.steps.get_mut(id) {
            step.status = status;
            Ok(())
        } else {
            Err(format!("Step ID {} not found", id))
        }
    }

    /// Check if the overall plan is complete
    pub fn is_complete(&self) -> bool {
        self.steps.values().all(|step| {
            step.status == StepStatus::Completed || step.status == StepStatus::Skipped
        })
    }
}
