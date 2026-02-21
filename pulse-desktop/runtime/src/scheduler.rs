//! PULSE Runtime Kernel - Task Scheduler
//!
//! Priority-based task scheduling with dependency resolution.

use crate::event::{Event, EventBus, EventType};
use anyhow::Result;
use serde::{Serialize, Deserialize};
use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use tracing::{info, debug, warn};
use uuid::Uuid;

/// Task identifier
pub type TaskId = String;

/// Task status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TaskStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

/// Task priority
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum TaskPriority {
    Low = 0,
    Normal = 1,
    High = 2,
    Critical = 3,
}

impl Default for TaskPriority {
    fn default() -> Self {
        Self::Normal
    }
}

/// Task definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    /// Unique task identifier
    pub id: TaskId,
    /// Task name
    pub name: String,
    /// Task type
    pub task_type: String,
    /// Priority
    pub priority: TaskPriority,
    /// Status
    pub status: TaskStatus,
    /// Payload
    pub payload: serde_json::Value,
    /// Source entity ID
    pub source_id: String,
    /// Dependencies (task IDs that must complete first)
    pub dependencies: HashSet<TaskId>,
    /// Maximum execution time in milliseconds
    pub timeout_ms: u64,
    /// Retry count
    pub retry_count: u32,
    /// Maximum retries
    pub max_retries: u32,
    /// Result
    pub result: Option<serde_json::Value>,
    /// Error message
    pub error: Option<String>,
    /// Creation timestamp
    pub created_at: chrono::DateTime<chrono::Utc>,
    /// Start timestamp
    pub started_at: Option<chrono::DateTime<chrono::Utc>>,
    /// Completion timestamp
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
}

impl Task {
    /// Create a new task
    pub fn new(name: impl Into<String>, source_id: impl Into<String>, payload: serde_json::Value) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name: name.into(),
            task_type: "generic".to_string(),
            priority: TaskPriority::Normal,
            status: TaskStatus::Pending,
            payload,
            source_id: source_id.into(),
            dependencies: HashSet::new(),
            timeout_ms: 300_000, // 5 minutes
            retry_count: 0,
            max_retries: 3,
            result: None,
            error: None,
            created_at: chrono::Utc::now(),
            started_at: None,
            completed_at: None,
        }
    }

    /// Set task priority
    pub fn with_priority(mut self, priority: TaskPriority) -> Self {
        self.priority = priority;
        self
    }

    /// Add a dependency
    pub fn depends_on(mut self, task_id: impl Into<String>) -> Self {
        self.dependencies.insert(task_id.into());
        self
    }

    /// Set timeout
    pub fn with_timeout(mut self, timeout_ms: u64) -> Self {
        self.timeout_ms = timeout_ms;
        self
    }
}

/// Task executor trait
#[async_trait::async_trait]
pub trait TaskExecutor: Send + Sync {
    async fn execute(&self, task: Task) -> Result<serde_json::Value>;
}

/// Internal queued task
struct QueuedTask {
    task: Task,
    sequence: u64,
}

/// Task scheduler
pub struct TaskScheduler {
    /// Event bus reference
    event_bus: Arc<EventBus>,
    /// Task queue (priority queue)
    queue: Arc<RwLock<VecDeque<QueuedTask>>>,
    /// Running tasks
    running: Arc<RwLock<HashMap<TaskId, Task>>>,
    /// Completed tasks
    completed: Arc<RwLock<HashMap<TaskId, Task>>>,
    /// Maximum concurrent tasks
    max_concurrent: usize,
    /// Sequence counter
    sequence: Arc<RwLock<u64>>,
    /// Shutdown signal
    shutdown: Arc<RwLock<bool>>,
}

impl TaskScheduler {
    /// Create a new task scheduler
    pub fn new(event_bus: Arc<EventBus>) -> Self {
        Self {
            event_bus,
            queue: Arc::new(RwLock::new(VecDeque::new())),
            running: Arc::new(RwLock::new(HashMap::new())),
            completed: Arc::new(RwLock::new(HashMap::new())),
            max_concurrent: 4,
            sequence: Arc::new(RwLock::new(0)),
            shutdown: Arc::new(RwLock::new(false)),
        }
    }

    /// Submit a task for execution
    pub async fn submit(&self, event: Event) -> Result<TaskId> {
        let task: Task = serde_json::from_value(event.payload)?;
        let task_id = task.id.clone();

        let seq = {
            let mut seq = self.sequence.write().await;
            *seq += 1;
            *seq
        };

        // Check dependencies
        let completed = self.completed.read().await;
        let pending_deps: Vec<_> = task.dependencies
            .iter()
            .filter(|dep| !completed.contains_key(*dep))
            .collect();

        if pending_deps.is_empty() {
            // Add to queue
            let mut queue = self.queue.write().await;
            queue.push_back(QueuedTask {
                task,
                sequence: seq,
            });

            // Sort by priority
            let mut queue_vec: Vec<_> = queue.drain(..).collect();
            queue_vec.sort_by(|a, b| {
                b.task.priority.cmp(&a.task.priority)
                    .then_with(|| a.sequence.cmp(&b.sequence))
            });
            *queue = queue_vec.into();

            info!(
                task_id = %task_id,
                priority = ?task.priority,
                "Task submitted"
            );

            // Try to execute
            drop(queue);
            drop(completed);
            self.try_execute().await?;
        } else {
            // Queue for later
            warn!(
                task_id = %task_id,
                pending_deps = ?pending_deps,
                "Task waiting for dependencies"
            );
        }

        Ok(task_id)
    }

    /// Try to execute the next task
    async fn try_execute(&self) -> Result<()> {
        let running = self.running.read().await;
        if running.len() >= self.max_concurrent {
            return Ok(());
        }
        drop(running);

        let mut queue = self.queue.write().await;
        if let Some(queued) = queue.pop_front() {
            let task = queued.task;
            let task_id = task.id.clone();

            // Mark as running
            {
                let mut running = self.running.write().await;
                running.insert(task_id.clone(), task.clone());
            }

            // Publish TaskStarted event
            self.event_bus.publish(Event::new(
                EventType::TaskStarted,
                "scheduler",
                serde_json::to_value(&task)?,
            ))?;

            info!(task_id = %task_id, "Task started");

            // Spawn execution
            let running = Arc::clone(&self.running);
            let completed = Arc::clone(&self.completed);
            let event_bus = Arc::clone(&self.event_bus);

            tokio::spawn(async move {
                // Simulate execution (in real impl, would call executor)
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

                // Mark as completed
                let mut running = running.write().await;
                if let Some(mut task) = running.remove(&task_id) {
                    task.status = TaskStatus::Completed;
                    task.completed_at = Some(chrono::Utc::now());

                    let mut completed = completed.write().await;
                    completed.insert(task_id.clone(), task.clone());

                    // Publish TaskCompleted event
                    event_bus.publish(Event::new(
                        EventType::TaskCompleted,
                        "scheduler",
                        serde_json::to_value(&task).unwrap_or_default(),
                    )).ok();

                    info!(task_id = %task_id, "Task completed");
                }
            });
        }

        Ok(())
    }

    /// Cancel a task
    pub async fn cancel(&self, task_id: &str) -> Result<bool> {
        // Check queue
        {
            let mut queue = self.queue.write().await;
            if let Some(pos) = queue.iter().position(|t| t.task.id == task_id) {
                queue.remove(pos);
                return Ok(true);
            }
        }

        // Check running
        {
            let mut running = self.running.write().await;
            if let Some(mut task) = running.remove(task_id) {
                task.status = TaskStatus::Cancelled;
                self.completed.write().await.insert(task_id.to_string(), task);
                return Ok(true);
            }
        }

        Ok(false)
    }

    /// Get task status
    pub async fn get_status(&self, task_id: &str) -> Option<TaskStatus> {
        // Check queue
        {
            let queue = self.queue.read().await;
            if queue.iter().any(|t| t.task.id == task_id) {
                return Some(TaskStatus::Pending);
            }
        }

        // Check running
        {
            let running = self.running.read().await;
            if let Some(task) = running.get(task_id) {
                return Some(task.status);
            }
        }

        // Check completed
        {
            let completed = self.completed.read().await;
            completed.get(task_id).map(|t| t.status)
        }
    }

    /// Get active task count
    pub fn active_count(&self) -> usize {
        self.running.blocking_read().len()
    }

    /// Shutdown the scheduler
    pub async fn shutdown(&self) -> Result<()> {
        let mut shutdown = self.shutdown.write().await;
        *shutdown = true;

        // Wait for running tasks
        loop {
            let running = self.running.read().await;
            if running.is_empty() {
                break;
            }
            drop(running);
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        }

        info!("Scheduler shutdown complete");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_task_creation() {
        let task = Task::new("test-task", "agent-1", serde_json::json!({"input": "test"}));
        assert_eq!(task.status, TaskStatus::Pending);
        assert_eq!(task.priority, TaskPriority::Normal);
    }

    #[tokio::test]
    async fn test_task_with_options() {
        let task = Task::new("test", "agent", serde_json::json!({}))
            .with_priority(TaskPriority::High)
            .with_timeout(60000);

        assert_eq!(task.priority, TaskPriority::High);
        assert_eq!(task.timeout_ms, 60000);
    }
}
