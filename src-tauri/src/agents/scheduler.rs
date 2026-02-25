//! Agent Scheduler
//!
//! Manages agent execution queue and resource allocation.
//! Ensures only one agent runs at a time.

use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use crate::agents::{AgentError, AgentConfig, AgentId};
use crate::agents::agent_lock::AgentLock;

/// Maximum queue size
pub const MAX_QUEUE_SIZE: usize = 10;

/// Agent task in queue
#[derive(Debug, Clone)]
pub struct AgentTask {
    pub id: AgentId,
    pub description: String,
    pub priority: TaskPriority,
    pub queued_at: i64,
    pub config: AgentConfig,
}

/// Task priority
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum TaskPriority {
    Low = 0,
    Normal = 1,
    High = 2,
    Critical = 3,
}

/// Running agent info
#[derive(Debug, Clone)]
pub struct RunningAgent {
    pub id: AgentId,
    pub started_at: Instant,
    pub task: String,
    pub memory_usage_mb: usize,
}

/// Agent scheduler
pub struct AgentScheduler {
    queue: Arc<Mutex<VecDeque<AgentTask>>>,
    current: Arc<Mutex<Option<RunningAgent>>>,
    max_runtime: Duration,
}

impl Default for AgentScheduler {
    fn default() -> Self {
        Self::new(Duration::from_secs(30 * 60)) // 30 minutes
    }
}

impl AgentScheduler {
    /// Create new scheduler
    pub fn new(max_runtime: Duration) -> Self {
        Self {
            queue: Arc::new(Mutex::new(VecDeque::new())),
            current: Arc::new(Mutex::new(None)),
            max_runtime,
        }
    }

    /// Queue a new agent task
    pub fn queue(&self, task: AgentTask) -> Result<usize, AgentError> {
        let mut queue = self.queue.lock().map_err(|_| {
            AgentError::SchedulerBusy(0)
        })?;

        if queue.len() >= MAX_QUEUE_SIZE {
            return Err(AgentError::SchedulerBusy(queue.len()));
        }

        queue.push_back(task);
        Ok(queue.len())
    }

    /// Get next task from queue
    pub fn next(&self) -> Option<AgentTask> {
        let mut queue = self.queue.lock().ok()?;
        
        // Sort by priority (highest first)
        let mut tasks: Vec<_> = queue.drain(..).collect();
        tasks.sort_by(|a, b| b.priority.cmp(&a.priority));
        
        // Re-queue lower priority tasks
        for task in tasks.iter().skip(1) {
            queue.push_back(task.clone());
        }
        
        tasks.into_iter().next()
    }

    /// Try to start an agent
    pub fn try_start(&self, task: AgentTask) -> Result<AgentExecutionGuard, AgentError> {
        // Check if another agent is running
        if AgentLock::is_agent_running() {
            return Err(AgentError::SchedulerBusy(self.queue_size()));
        }

        // Acquire lock
        let lock = AgentLock::acquire(&task.id.0)?;

        // Update current
        {
            let mut current = self.current.lock().map_err(|_| {
                AgentError::ProcessError("Failed to update current agent".to_string())
            })?;
            *current = Some(RunningAgent {
                id: task.id.clone(),
                started_at: Instant::now(),
                task: task.description.clone(),
                memory_usage_mb: 0,
            });
        }

        Ok(AgentExecutionGuard {
            lock,
            scheduler: self.clone_ref(),
        })
    }

    /// Get current running agent
    pub fn current(&self) -> Option<RunningAgent> {
        self.current.lock().ok()?.clone()
    }

    /// Check if current agent has exceeded runtime
    pub fn check_runtime(&self) -> Option<Duration> {
        let current = self.current()?;
        let elapsed = current.started_at.elapsed();
        
        if elapsed > self.max_runtime {
            Some(elapsed)
        } else {
            None
        }
    }

    /// Get queue size
    pub fn queue_size(&self) -> usize {
        self.queue.lock().map(|q| q.len()).unwrap_or(0)
    }

    /// Get estimated wait time
    pub fn estimated_wait(&self) -> Duration {
        let queue_size = self.queue_size();
        Duration::from_secs(queue_size as u64 * self.max_runtime.as_secs())
    }

    /// Clear queue
    pub fn clear_queue(&self) -> usize {
        let mut queue = self.queue.lock().unwrap();
        let count = queue.len();
        queue.clear();
        count
    }

    /// Get scheduler status
    pub fn status(&self) -> SchedulerStatus {
        let current = self.current();
        let queue_size = self.queue_size();

        SchedulerStatus {
            running: current.clone(),
            queue_size,
            estimated_wait: self.estimated_wait(),
            max_runtime: self.max_runtime,
        }
    }

    /// Clone reference for guard
    fn clone_ref(&self) -> Self {
        Self {
            queue: self.queue.clone(),
            current: self.current.clone(),
            max_runtime: self.max_runtime,
        }
    }
}

/// RAII guard for agent execution
pub struct AgentExecutionGuard {
    lock: AgentLock,
    scheduler: AgentScheduler,
}

impl AgentExecutionGuard {
    /// Get remaining time
    pub fn remaining_time(&self) -> Duration {
        let current = self.scheduler.current();
        if let Some(running) = current {
            let elapsed = running.started_at.elapsed();
            if elapsed < self.scheduler.max_runtime {
                self.scheduler.max_runtime - elapsed
            } else {
                Duration::ZERO
            }
        } else {
            Duration::ZERO
        }
    }

    /// Check if runtime is nearly exceeded
    pub fn should_checkpoint(&self) -> bool {
        let remaining = self.remaining_time();
        remaining < Duration::from_secs(5 * 60) // 5 minutes left
    }

    /// Update memory usage
    pub fn update_memory(&self, mb: usize) {
        if let Ok(mut current) = self.scheduler.current.lock() {
            if let Some(ref mut running) = *current {
                running.memory_usage_mb = mb;
            }
        }
    }

    /// Get the agent lock
    pub fn lock(&self) -> &AgentLock {
        &self.lock
    }
}

impl Drop for AgentExecutionGuard {
    fn drop(&mut self) {
        // Clear current agent
        if let Ok(mut current) = self.scheduler.current.lock() {
            *current = None;
        }
        // Lock is automatically released by AgentLock's Drop
    }
}

/// Scheduler status
#[derive(Debug, Clone)]
pub struct SchedulerStatus {
    pub running: Option<RunningAgent>,
    pub queue_size: usize,
    pub estimated_wait: Duration,
    pub max_runtime: Duration,
}

impl SchedulerStatus {
    /// Format for display
    pub fn format(&self) -> String {
        let mut output = String::new();

        if let Some(ref running) = self.running {
            output.push_str(&format!(
                "Running: {} (task: {}, {}m elapsed)\n",
                running.id.0,
                running.task,
                running.started_at.elapsed().as_secs() / 60
            ));
        } else {
            output.push_str("No agent running\n");
        }

        output.push_str(&format!("Queue: {} agents\n", self.queue_size));
        output.push_str(&format!("Estimated wait: {:?}\n", self.estimated_wait));
        output.push_str(&format!("Max runtime: {:?}", self.max_runtime));

        output
    }
}

/// Create a default agent task
pub fn create_task(id: &str, description: &str, priority: TaskPriority) -> AgentTask {
    AgentTask {
        id: AgentId(id.to_string()),
        description: description.to_string(),
        priority,
        queued_at: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64,
        config: AgentConfig::default(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scheduler_queue() {
        let scheduler = AgentScheduler::default();

        let task1 = create_task("agent1", "Task 1", TaskPriority::Normal);
        let task2 = create_task("agent2", "Task 2", TaskPriority::High);

        scheduler.queue(task1).unwrap();
        scheduler.queue(task2).unwrap();

        assert_eq!(scheduler.queue_size(), 2);
    }

    #[test]
    fn test_priority_ordering() {
        let low = TaskPriority::Low;
        let normal = TaskPriority::Normal;
        let high = TaskPriority::High;
        let critical = TaskPriority::Critical;

        assert!(critical > high);
        assert!(high > normal);
        assert!(normal > low);
    }

    #[test]
    fn test_status_format() {
        let status = SchedulerStatus {
            running: None,
            queue_size: 2,
            estimated_wait: Duration::from_secs(3600),
            max_runtime: Duration::from_secs(1800),
        };

        let formatted = status.format();
        assert!(formatted.contains("No agent running"));
        assert!(formatted.contains("Queue: 2"));
    }
}
