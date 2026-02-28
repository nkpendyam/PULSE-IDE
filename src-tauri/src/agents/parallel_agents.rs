//! Parallel AI Agents System
//!
//! This module provides parallel execution of multiple AI agents,
//! inspired by Antigravity's multi-agent architecture.
//!
//! ## Features
//! - Run multiple agents in parallel for faster task completion
//! - Agent specialization (code, test, review, deploy, etc.)
//! - Shared context and memory between agents
//! - Task queuing and prioritization

use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use tokio::sync::{RwLock, Mutex, mpsc, Semaphore};
use std::time::{Duration, Instant};
use uuid::Uuid;

/// Maximum number of parallel agents
pub const MAX_PARALLEL_AGENTS: usize = 8;

/// Agent types with specialized capabilities
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum AgentType {
    /// Code generation agent
    CodeGenerator,
    /// Code review agent
    CodeReviewer,
    /// Test generation agent
    TestGenerator,
    /// Documentation agent
    Documenter,
    /// Refactoring agent
    Refactorer,
    /// Bug fixer agent
    BugFixer,
    /// Security analyzer agent
    SecurityAnalyzer,
    /// Performance optimizer agent
    PerformanceOptimizer,
    /// Custom agent
    Custom(String),
}

impl AgentType {
    pub fn default_model(&self) -> &'static str {
        match self {
            AgentType::CodeGenerator => "codellama:34b-instruct",
            AgentType::CodeReviewer => "llama3:70b",
            AgentType::TestGenerator => "codellama:13b-instruct",
            AgentType::Documenter => "llama3:8b",
            AgentType::Refactorer => "codellama:34b-instruct",
            AgentType::BugFixer => "llama3:70b",
            AgentType::SecurityAnalyzer => "llama3:70b",
            AgentType::PerformanceOptimizer => "codellama:34b-instruct",
            AgentType::Custom(_) => "llama3:8b",
        }
    }

    pub fn priority(&self) -> u8 {
        match self {
            AgentType::SecurityAnalyzer => 10,
            AgentType::BugFixer => 9,
            AgentType::CodeReviewer => 8,
            AgentType::TestGenerator => 7,
            AgentType::CodeGenerator => 6,
            AgentType::PerformanceOptimizer => 5,
            AgentType::Refactorer => 4,
            AgentType::Documenter => 3,
            AgentType::Custom(_) => 5,
        }
    }
}

/// Agent configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub agent_type: AgentType,
    pub model: String,
    pub max_tokens: usize,
    pub temperature: f32,
    pub timeout_secs: u64,
    pub retry_count: usize,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            agent_type: AgentType::CodeGenerator,
            model: "codellama:7b".to_string(),
            max_tokens: 2048,
            temperature: 0.7,
            timeout_secs: 120,
            retry_count: 3,
        }
    }
}

/// Agent task
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentTask {
    pub id: String,
    pub agent_type: AgentType,
    pub prompt: String,
    pub context: Option<String>,
    pub priority: u8,
    pub created_at: Instant,
    pub status: TaskStatus,
}

/// Task status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TaskStatus {
    Pending,
    Running,
    Completed,
    Failed(String),
    Cancelled,
}

/// Agent result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentResult {
    pub task_id: String,
    pub agent_type: AgentType,
    pub output: String,
    pub tokens_used: usize,
    pub execution_time_ms: u64,
    pub success: bool,
    pub error: Option<String>,
}

/// Running agent instance
#[derive(Debug)]
pub struct RunningAgent {
    pub id: String,
    pub config: AgentConfig,
    pub status: AgentStatus,
    pub current_task: Option<String>,
    pub completed_tasks: usize,
    pub failed_tasks: usize,
}

/// Agent status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AgentStatus {
    Idle,
    Busy,
    Error,
    Offline,
}

/// Parallel agents orchestrator
pub struct ParallelAgentsOrchestrator {
    /// Agent pool
    agents: Arc<RwLock<HashMap<String, RunningAgent>>>,
    /// Task queue (priority queue)
    task_queue: Arc<Mutex<VecDeque<AgentTask>>>,
    /// Results storage
    results: Arc<RwLock<HashMap<String, AgentResult>>>,
    /// Shared context/memory
    shared_memory: Arc<RwLock<HashMap<String, String>>>,
    /// Semaphore for limiting parallel execution
    semaphore: Arc<Semaphore>,
    /// Configuration
    config: OrchestratorConfig,
    /// Shutdown signal
    shutdown_tx: mpsc::Sender<()>,
    shutdown_rx: Option<mpsc::Receiver<()>>,
}

/// Orchestrator configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestratorConfig {
    pub max_parallel_agents: usize,
    pub task_timeout_secs: u64,
    pub max_queue_size: usize,
    pub enable_priority_queue: bool,
    pub agent_configs: HashMap<AgentType, AgentConfig>,
}

impl Default for OrchestratorConfig {
    fn default() -> Self {
        let mut agent_configs = HashMap::new();
        agent_configs.insert(AgentType::CodeGenerator, AgentConfig {
            agent_type: AgentType::CodeGenerator,
            model: "codellama:34b-instruct".to_string(),
            max_tokens: 4096,
            temperature: 0.7,
            timeout_secs: 180,
            retry_count: 3,
        });
        agent_configs.insert(AgentType::CodeReviewer, AgentConfig {
            agent_type: AgentType::CodeReviewer,
            model: "llama3:70b".to_string(),
            max_tokens: 2048,
            temperature: 0.3,
            timeout_secs: 120,
            retry_count: 2,
        });
        agent_configs.insert(AgentType::TestGenerator, AgentConfig {
            agent_type: AgentType::TestGenerator,
            model: "codellama:13b-instruct".to_string(),
            max_tokens: 2048,
            temperature: 0.5,
            timeout_secs: 120,
            retry_count: 3,
        });

        Self {
            max_parallel_agents: MAX_PARALLEL_AGENTS,
            task_timeout_secs: 180,
            max_queue_size: 100,
            enable_priority_queue: true,
            agent_configs,
        }
    }
}

impl ParallelAgentsOrchestrator {
    /// Create a new parallel agents orchestrator
    pub fn new(config: OrchestratorConfig) -> Self {
        let (shutdown_tx, shutdown_rx) = mpsc::channel(1);
        let semaphore = Arc::new(Semaphore::new(config.max_parallel_agents));
        
        Self {
            agents: Arc::new(RwLock::new(HashMap::new())),
            task_queue: Arc::new(Mutex::new(VecDeque::new())),
            results: Arc::new(RwLock::new(HashMap::new())),
            shared_memory: Arc::new(RwLock::new(HashMap::new())),
            semaphore,
            config,
            shutdown_tx,
            shutdown_rx: Some(shutdown_rx),
        }
    }

    /// Register an agent
    pub async fn register_agent(&self, config: AgentConfig) -> Result<String> {
        let id = Uuid::new_v4().to_string();
        let agent = RunningAgent {
            id: id.clone(),
            config,
            status: AgentStatus::Idle,
            current_task: None,
            completed_tasks: 0,
            failed_tasks: 0,
        };
        
        self.agents.write().await.insert(id.clone(), agent);
        log::info!("Registered agent: {}", id);
        Ok(id)
    }

    /// Unregister an agent
    pub async fn unregister_agent(&self, agent_id: &str) -> Result<()> {
        self.agents.write().await.remove(agent_id);
        log::info!("Unregistered agent: {}", agent_id);
        Ok(())
    }

    /// Submit a task
    pub async fn submit_task(&self, agent_type: AgentType, prompt: String, context: Option<String>) -> Result<String> {
        let task_id = Uuid::new_v4().to_string();
        let priority = agent_type.priority();
        
        let task = AgentTask {
            id: task_id.clone(),
            agent_type,
            prompt,
            context,
            priority,
            created_at: Instant::now(),
            status: TaskStatus::Pending,
        };

        let mut queue = self.task_queue.lock().await;
        if queue.len() >= self.config.max_queue_size {
            anyhow::bail!("Task queue is full");
        }

        // Insert by priority
        if self.config.enable_priority_queue {
            let pos = queue.iter()
                .position(|t| t.priority < task.priority)
                .unwrap_or(queue.len());
            queue.insert(pos, task);
        } else {
            queue.push_back(task);
        }

        log::info!("Submitted task: {}", task_id);
        Ok(task_id)
    }

    /// Execute a task with an available agent
    pub async fn execute_next_task(&self) -> Result<Option<AgentResult>> {
        // Get next task from queue
        let task = {
            let mut queue = self.task_queue.lock().await;
            queue.pop_front()
        };

        let task = match task {
            Some(t) => t,
            None => return Ok(None),
        };

        // Acquire semaphore permit
        let _permit = self.semaphore.acquire().await
            .map_err(|e| anyhow::anyhow!("Semaphore error: {}", e))?;

        // Find available agent
        let agent_id = self.find_available_agent(&task.agent_type).await?;
        
        // Execute task
        let result = self.execute_task(task, &agent_id).await?;
        Ok(Some(result))
    }

    /// Find an available agent for the task type
    async fn find_available_agent(&self, agent_type: &AgentType) -> Result<String> {
        let agents = self.agents.read().await;
        
        for (id, agent) in agents.iter() {
            if agent.status == AgentStatus::Idle && 
               agent.config.agent_type == *agent_type {
                return Ok(id.clone());
            }
        }

        // If no specific agent found, find any idle agent
        for (id, agent) in agents.iter() {
            if agent.status == AgentStatus::Idle {
                return Ok(id.clone());
            }
        }

        anyhow::bail!("No available agent for type: {:?}", agent_type)
    }

    /// Execute a task
    async fn execute_task(&self, mut task: AgentTask, agent_id: &str) -> Result<AgentResult> {
        let start_time = Instant::now();
        task.status = TaskStatus::Running;

        // Update agent status
        {
            let mut agents = self.agents.write().await;
            if let Some(agent) = agents.get_mut(agent_id) {
                agent.status = AgentStatus::Busy;
                agent.current_task = Some(task.id.clone());
            }
        }

        // Get agent config
        let agent_config = {
            let agents = self.agents.read().await;
            agents.get(agent_id)
                .map(|a| a.config.clone())
                .ok_or_else(|| anyhow::anyhow!("Agent not found"))?
        };

        // Execute with timeout
        let result = tokio::time::timeout(
            Duration::from_secs(agent_config.timeout_secs),
            self.run_agent_inference(&task, &agent_config)
        ).await;

        let execution_time_ms = start_time.elapsed().as_millis() as u64;

        // Update agent status
        {
            let mut agents = self.agents.write().await;
            if let Some(agent) = agents.get_mut(agent_id) {
                agent.status = AgentStatus::Idle;
                agent.current_task = None;
            }
        }

        let result = match result {
            Ok(Ok(output)) => {
                task.status = TaskStatus::Completed;
                AgentResult {
                    task_id: task.id.clone(),
                    agent_type: task.agent_type,
                    output,
                    tokens_used: 0, // Would be filled by actual inference
                    execution_time_ms,
                    success: true,
                    error: None,
                }
            }
            Ok(Err(e)) => {
                task.status = TaskStatus::Failed(e.to_string());
                AgentResult {
                    task_id: task.id.clone(),
                    agent_type: task.agent_type,
                    output: String::new(),
                    tokens_used: 0,
                    execution_time_ms,
                    success: false,
                    error: Some(e.to_string()),
                }
            }
            Err(_) => {
                task.status = TaskStatus::Failed("Task timeout".to_string());
                AgentResult {
                    task_id: task.id.clone(),
                    agent_type: task.agent_type,
                    output: String::new(),
                    tokens_used: 0,
                    execution_time_ms,
                    success: false,
                    error: Some("Task timeout".to_string()),
                }
            }
        };

        // Store result
        self.results.write().await.insert(task.id.clone(), result.clone());

        // Update agent stats
        {
            let mut agents = self.agents.write().await;
            if let Some(agent) = agents.get_mut(agent_id) {
                if result.success {
                    agent.completed_tasks += 1;
                } else {
                    agent.failed_tasks += 1;
                }
            }
        }

        Ok(result)
    }

    /// Run agent inference (placeholder - would integrate with actual LLM)
    async fn run_agent_inference(&self, task: &AgentTask, config: &AgentConfig) -> Result<String> {
        // Get shared memory for context
        let memory = self.shared_memory.read().await;
        let context = task.context.as_ref()
            .or(memory.get(&format!("context_{}", task.agent_type.priority())))
            .cloned();

        // Build prompt with context
        let full_prompt = match context {
            Some(ctx) => format!("Context:\n{}\n\nTask:\n{}", ctx, task.prompt),
            None => task.prompt.clone(),
        };

        // This would call the actual LLM inference
        // For now, return a placeholder
        log::info!("Agent {} executing task with prompt: {}", 
            config.agent_type.default_model(), 
            full_prompt.chars().take(100).collect::<String>());

        Ok(format!("Task completed by {:?} agent", task.agent_type))
    }

    /// Store shared memory
    pub async fn store_memory(&self, key: String, value: String) {
        self.shared_memory.write().await.insert(key, value);
    }

    /// Get shared memory
    pub async fn get_memory(&self, key: &str) -> Option<String> {
        self.shared_memory.read().await.get(key).cloned()
    }

    /// Get task result
    pub async fn get_result(&self, task_id: &str) -> Option<AgentResult> {
        self.results.read().await.get(task_id).cloned()
    }

    /// Get orchestrator status
    pub async fn status(&self) -> OrchestratorStatus {
        let agents = self.agents.read().await;
        let queue = self.task_queue.lock().await;
        let results = self.results.read().await;

        let active_agents = agents.values()
            .filter(|a| a.status == AgentStatus::Busy)
            .count();
        let idle_agents = agents.values()
            .filter(|a| a.status == AgentStatus::Idle)
            .count();

        OrchestratorStatus {
            total_agents: agents.len(),
            active_agents,
            idle_agents,
            queued_tasks: queue.len(),
            completed_tasks: results.values().filter(|r| r.success).count(),
            failed_tasks: results.values().filter(|r| !r.success).count(),
        }
    }

    /// Shutdown the orchestrator
    pub async fn shutdown(&self) -> Result<()> {
        self.shutdown_tx.send(()).await
            .map_err(|e| anyhow::anyhow!("Shutdown error: {}", e))
    }

    /// Run multiple tasks in parallel
    pub async fn run_parallel(&self, tasks: Vec<(AgentType, String)>) -> Result<Vec<AgentResult>> {
        let mut task_ids = Vec::new();
        
        // Submit all tasks
        for (agent_type, prompt) in tasks {
            let task_id = self.submit_task(agent_type, prompt, None).await?;
            task_ids.push(task_id);
        }

        // Execute tasks and collect results
        let mut results = Vec::new();
        for task_id in task_ids {
            // Execute and wait for result
            while self.get_result(&task_id).await.is_none() {
                if let Some(result) = self.execute_next_task().await? {
                    if result.task_id == task_id {
                        results.push(result);
                        break;
                    }
                }
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
            
            // Get stored result
            if let Some(result) = self.get_result(&task_id).await {
                results.push(result);
            }
        }

        Ok(results)
    }
}

/// Orchestrator status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestratorStatus {
    pub total_agents: usize,
    pub active_agents: usize,
    pub idle_agents: usize,
    pub queued_tasks: usize,
    pub completed_tasks: usize,
    pub failed_tasks: usize,
}

/// Tauri commands for parallel agents
pub mod commands {
    use super::*;
    use tauri::State;
    use std::sync::Mutex as StdMutex;

    /// Global orchestrator state
    pub struct OrchestratorState(pub StdMutex<Option<ParallelAgentsOrchestrator>>);

    /// Initialize parallel agents
    #[tauri::command]
    pub fn init_parallel_agents(
        state: State<'_, OrchestratorState>,
        config: Option<OrchestratorConfig>,
    ) -> Result<(), String> {
        let config = config.unwrap_or_default();
        let orchestrator = ParallelAgentsOrchestrator::new(config);
        
        let mut state = state.0.lock().map_err(|e| e.to_string())?;
        *state = Some(orchestrator);
        Ok(())
    }

    /// Register an agent
    #[tauri::command]
    pub async fn register_agent(
        state: State<'_, OrchestratorState>,
        config: AgentConfig,
    ) -> Result<String, String> {
        let state = state.0.lock().map_err(|e| e.to_string())?;
        let orchestrator = state.as_ref()
            .ok_or_else(|| "Orchestrator not initialized".to_string())?;
        
        orchestrator.register_agent(config).await
            .map_err(|e| e.to_string())
    }

    /// Submit a task
    #[tauri::command]
    pub async fn submit_agent_task(
        state: State<'_, OrchestratorState>,
        agent_type: AgentType,
        prompt: String,
        context: Option<String>,
    ) -> Result<String, String> {
        let state = state.0.lock().map_err(|e| e.to_string())?;
        let orchestrator = state.as_ref()
            .ok_or_else(|| "Orchestrator not initialized".to_string())?;
        
        orchestrator.submit_task(agent_type, prompt, context).await
            .map_err(|e| e.to_string())
    }

    /// Get task result
    #[tauri::command]
    pub async fn get_task_result(
        state: State<'_, OrchestratorState>,
        task_id: String,
    ) -> Result<Option<AgentResult>, String> {
        let state = state.0.lock().map_err(|e| e.to_string())?;
        let orchestrator = state.as_ref()
            .ok_or_else(|| "Orchestrator not initialized".to_string())?;
        
        Ok(orchestrator.get_result(&task_id).await)
    }

    /// Get orchestrator status
    #[tauri::command]
    pub async fn get_orchestrator_status(
        state: State<'_, OrchestratorState>,
    ) -> Result<OrchestratorStatus, String> {
        let state = state.0.lock().map_err(|e| e.to_string())?;
        let orchestrator = state.as_ref()
            .ok_or_else(|| "Orchestrator not initialized".to_string())?;
        
        Ok(orchestrator.status().await)
    }

    /// Run parallel tasks
    #[tauri::command]
    pub async fn run_parallel_tasks(
        state: State<'_, OrchestratorState>,
        tasks: Vec<(AgentType, String)>,
    ) -> Result<Vec<AgentResult>, String> {
        let state = state.0.lock().map_err(|e| e.to_string())?;
        let orchestrator = state.as_ref()
            .ok_or_else(|| "Orchestrator not initialized".to_string())?;
        
        orchestrator.run_parallel(tasks).await
            .map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_orchestrator_creation() {
        let config = OrchestratorConfig::default();
        let orchestrator = ParallelAgentsOrchestrator::new(config);
        let status = orchestrator.status().await;
        assert_eq!(status.total_agents, 0);
    }

    #[tokio::test]
    async fn test_agent_registration() {
        let orchestrator = ParallelAgentsOrchestrator::new(OrchestratorConfig::default());
        let config = AgentConfig::default();
        let id = orchestrator.register_agent(config).await.unwrap();
        assert!(!id.is_empty());
    }

    #[tokio::test]
    async fn test_task_submission() {
        let orchestrator = ParallelAgentsOrchestrator::new(OrchestratorConfig::default());
        let task_id = orchestrator.submit_task(
            AgentType::CodeGenerator,
            "Write a hello world function".to_string(),
            None,
        ).await.unwrap();
        assert!(!task_id.is_empty());
    }
}
