//! Breakpoint Management
//!
//! Advanced breakpoint features including conditions and logpoints

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

/// Breakpoint manager
pub struct BreakpointManager {
    breakpoints: HashMap<String, Vec<ManagedBreakpoint>>,
    id_counter: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManagedBreakpoint {
    pub id: u64,
    pub path: String,
    pub line: u32,
    pub column: Option<u32>,
    pub enabled: bool,
    pub condition: Option<String>,
    pub hit_condition: Option<HitCondition>,
    pub log_message: Option<String>,
    pub verified: bool,
    pub adapter_id: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HitCondition {
    pub count: u32,
    pub operator: HitOperator,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HitOperator {
    Equal,
    GreaterThan,
    GreaterThanOrEqual,
    LessThan,
    MultipleOf,
}

impl HitOperator {
    pub fn evaluate(&self, current: u32, target: u32) -> bool {
        match self {
            HitOperator::Equal => current == target,
            HitOperator::GreaterThan => current > target,
            HitOperator::GreaterThanOrEqual => current >= target,
            HitOperator::LessThan => current < target,
            HitOperator::MultipleOf => current % target == 0,
        }
    }
}

impl BreakpointManager {
    pub fn new() -> Self {
        Self {
            breakpoints: HashMap::new(),
            id_counter: 0,
        }
    }
    
    /// Add a breakpoint
    pub fn add(&mut self, path: &str, line: u32) -> ManagedBreakpoint {
        self.id_counter += 1;
        let bp = ManagedBreakpoint {
            id: self.id_counter,
            path: path.to_string(),
            line,
            column: None,
            enabled: true,
            condition: None,
            hit_condition: None,
            log_message: None,
            verified: false,
            adapter_id: None,
        };
        
        self.breakpoints.entry(path.to_string())
            .or_default()
            .push(bp.clone());
        
        bp
    }
    
    /// Add a conditional breakpoint
    pub fn add_conditional(&mut self, path: &str, line: u32, condition: &str) -> ManagedBreakpoint {
        let mut bp = self.add(path, line);
        bp.condition = Some(condition.to_string());
        bp
    }
    
    /// Add a logpoint
    pub fn add_logpoint(&mut self, path: &str, line: u32, message: &str) -> ManagedBreakpoint {
        let mut bp = self.add(path, line);
        bp.log_message = Some(message.to_string());
        bp
    }
    
    /// Add a hit-conditional breakpoint
    pub fn add_hit_conditional(&mut self, path: &str, line: u32, operator: HitOperator, count: u32) -> ManagedBreakpoint {
        let mut bp = self.add(path, line);
        bp.hit_condition = Some(HitCondition { count, operator });
        bp
    }
    
    /// Remove a breakpoint
    pub fn remove(&mut self, id: u64) -> Option<ManagedBreakpoint> {
        for (_, bps) in self.breakpoints.iter_mut() {
            if let Some(idx) = bps.iter().position(|b| b.id == id) {
                return Some(bps.remove(idx));
            }
        }
        None
    }
    
    /// Toggle breakpoint
    pub fn toggle(&mut self, id: u64) -> Option<bool> {
        for (_, bps) in self.breakpoints.iter_mut() {
            if let Some(bp) = bps.iter_mut().find(|b| b.id == id) {
                bp.enabled = !bp.enabled;
                return Some(bp.enabled);
            }
        }
        None
    }
    
    /// Update breakpoint verification status
    pub fn update_verification(&mut self, id: u64, verified: bool, adapter_id: Option<u64>) {
        for (_, bps) in self.breakpoints.iter_mut() {
            if let Some(bp) = bps.iter_mut().find(|b| b.id == id) {
                bp.verified = verified;
                bp.adapter_id = adapter_id;
            }
        }
    }
    
    /// Get all breakpoints for a file
    pub fn get_for_file(&self, path: &str) -> Vec<&ManagedBreakpoint> {
        self.breakpoints.get(path)
            .map(|bps| bps.iter().filter(|b| b.enabled).collect())
            .unwrap_or_default()
    }
    
    /// Get all breakpoints
    pub fn get_all(&self) -> Vec<&ManagedBreakpoint> {
        self.breakpoints.values()
            .flat_map(|bps| bps.iter())
            .filter(|b| b.enabled)
            .collect()
    }
    
    /// Parse hit condition string
    pub fn parse_hit_condition(s: &str) -> Option<HitCondition> {
        let s = s.trim();
        
        if let Some(count) = s.strip_prefix("==").or_else(|| s.strip_prefix("=")) {
            let count = count.trim().parse().ok()?;
            Some(HitCondition { count, operator: HitOperator::Equal })
        } else if let Some(count) = s.strip_prefix('>') {
            let count = count.trim().parse().ok()?;
            if s.starts_with(">=") {
                Some(HitCondition { count, operator: HitOperator::GreaterThanOrEqual })
            } else {
                Some(HitCondition { count, operator: HitOperator::GreaterThan })
            }
        } else if let Some(count) = s.strip_prefix('<') {
            let count = count.trim().parse().ok()?;
            Some(HitCondition { count, operator: HitOperator::LessThan })
        } else if let Some(count) = s.strip_prefix('%') {
            let count = count.trim().parse().ok()?;
            Some(HitCondition { count, operator: HitOperator::MultipleOf })
        } else if let Ok(count) = s.parse() {
            Some(HitCondition { count, operator: HitOperator::Equal })
        } else {
            None
        }
    }
    
    /// Clear all breakpoints for a file
    pub fn clear_file(&mut self, path: &str) {
        self.breakpoints.remove(path);
    }
    
    /// Clear all breakpoints
    pub fn clear_all(&mut self) {
        self.breakpoints.clear();
    }
    
    /// Import breakpoints
    pub fn import(&mut self, breakpoints: Vec<ManagedBreakpoint>) {
        for bp in breakpoints {
            self.breakpoints.entry(bp.path.clone())
                .or_default()
                .push(bp);
        }
    }
    
    /// Export breakpoints
    pub fn export(&self) -> Vec<ManagedBreakpoint> {
        self.breakpoints.values()
            .flat_map(|bps| bps.iter().cloned())
            .collect()
    }
}

impl Default for BreakpointManager {
    fn default() -> Self {
        Self::new()
    }
}
