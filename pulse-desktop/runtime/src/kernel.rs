//! PULSE Runtime Kernel - Core Kernel Implementation
//!
//! The kernel is the central authority managing all platform operations.

pub mod replay;

use crate::state::{StateMachine, KernelState};
use crate::event::{EventBus, Event, EventType};
use crate::capability::CapabilityManager;
use crate::scheduler::TaskScheduler;
use crate::resource::ResourceManager;
use crate::sandbox::SandboxManager;
use crate::storage::StorageEngine;
use crate::picoclaw::PicoClawBridge;
use crate::policy::PolicyEngine;
use crate::metrics::MetricsCollector;
use crate::api::JsonRpcServer;

use anyhow::Result;
use serde::{Serialize, Deserialize};
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tracing::{info, warn, error, debug};

/// Kernel configuration
#[derive(Debug, Clone)]
pub struct KernelConfig {
    pub socket_path: String,
    pub http_port: u16,
    pub ws_port: u16,
    pub ram_budget_mb: u64,
    pub policy_mode: crate::policy::PolicyMode,
}

impl Default for KernelConfig {
    fn default() -> Self {
        Self {
            socket_path: "pulse.sock".to_string(),
            http_port: 0,
            ws_port: 9876,
            ram_budget_mb: 4096,
            policy_mode: crate::policy::PolicyMode::Review,
        }
    }
}

/// Kernel status response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KernelStatus {
    pub state: String,
    pub uptime_secs: u64,
    pub version: String,
    pub monotonic_clock: u64,
    pub event_queue_length: usize,
    pub active_tasks: usize,
    pub loaded_modules: usize,
    pub active_agents: usize,
    pub ram_usage_mb: u64,
    pub ram_budget_mb: u64,
    pub policy_mode: String,
}

/// The main kernel structure
pub struct Kernel {
    config: KernelConfig,
    state_machine: Arc<RwLock<StateMachine>>,
    event_bus: Arc<EventBus>,
    capability_manager: Arc<RwLock<CapabilityManager>>,
    task_scheduler: Arc<TaskScheduler>,
    resource_manager: Arc<ResourceManager>,
    sandbox_manager: Arc<RwLock<SandboxManager>>,
    storage: Arc<StorageEngine>,
    picoclaw_bridge: Option<Arc<PicoClawBridge>>,
    policy_engine: Arc<RwLock<PolicyEngine>>,
    metrics: Arc<MetricsCollector>,
    api_server: Option<JsonRpcServer>,
    start_time: std::time::Instant,
    shutdown_tx: Option<mpsc::Sender<()>>,
}

impl Kernel {
    /// Create a new kernel instance
    pub fn new(config: KernelConfig) -> Result<Self> {
        info!("Initializing PULSE kernel");

        let state_machine = Arc::new(RwLock::new(StateMachine::new()));
        let event_bus = Arc::new(EventBus::new());
        let capability_manager = Arc::new(RwLock::new(CapabilityManager::new()));
        let storage = Arc::new(StorageEngine::new("pulse.db")?);
        let task_scheduler = Arc::new(TaskScheduler::new(Arc::clone(&event_bus)));
        let resource_manager = Arc::new(ResourceManager::new(config.ram_budget_mb));
        let sandbox_manager = Arc::new(RwLock::new(SandboxManager::new()));
        let policy_engine = Arc::new(RwLock::new(PolicyEngine::new(config.policy_mode.clone())));
        let metrics = Arc::new(MetricsCollector::new());

        // Initialize PicoClaw bridge if enabled
        let picoclaw_bridge = if config.ws_port > 0 {
            Some(Arc::new(PicoClawBridge::new(config.ws_port)))
        } else {
            None
        };

        Ok(Self {
            config,
            state_machine,
            event_bus,
            capability_manager,
            task_scheduler,
            resource_manager,
            sandbox_manager,
            storage,
            picoclaw_bridge,
            policy_engine,
            metrics,
            api_server: None,
            start_time: std::time::Instant::now(),
            shutdown_tx: None,
        })
    }

    /// Initialize all subsystems
    pub async fn initialize(&mut self) -> Result<()> {
        info!("Initializing subsystems");

        // Transition to initializing state
        {
            let mut sm = self.state_machine.write().await;
            sm.transition(KernelState::Initializing)?;
        }

        // Initialize storage
        self.storage.initialize().await?;

        // Initialize capability manager with default capabilities
        {
            let mut cm = self.capability_manager.write().await;
            cm.register_default_capabilities();
        }

        // Start metrics collection
        self.metrics.start()?;

        // Initialize sandbox manager
        {
            let mut sandbox = self.sandbox_manager.write().await;
            sandbox.initialize()?;
        }

        // Start API server
        let api_server = JsonRpcServer::new(
            self.config.socket_path.clone(),
            self.config.http_port,
            Arc::clone(&self.state_machine),
            Arc::clone(&self.event_bus),
            Arc::clone(&self.capability_manager),
            Arc::clone(&self.task_scheduler),
            Arc::clone(&self.resource_manager),
        );
        self.api_server = Some(api_server);

        info!("Subsystems initialized");
        Ok(())
    }

    /// Run the main event loop
    pub async fn run(&mut self) -> Result<()> {
        // Transition to running state
        {
            let mut sm = self.state_machine.write().await;
            sm.transition(KernelState::Running)?;
        }

        info!("Kernel running");

        // Create shutdown channel
        let (shutdown_tx, mut shutdown_rx) = mpsc::channel(1);
        self.shutdown_tx = Some(shutdown_tx);

        // Subscribe to shutdown events
        let state_machine = Arc::clone(&self.state_machine);
        let event_bus = Arc::clone(&self.event_bus);
        
        event_bus.subscribe(EventType::KernelShutdown, move |_event| {
            let sm = Arc::clone(&state_machine);
            async move {
                let mut sm = sm.write().await;
                let _ = sm.transition(KernelState::ShuttingDown);
            }
        })?;

        // Main event loop
        loop {
            tokio::select! {
                // Check for shutdown signal
                _ = shutdown_rx.recv() => {
                    info!("Shutdown signal received");
                    break;
                }

                // Process events from the bus
                event = self.event_bus.recv() => {
                    match event {
                        Some(event) => {
                            self.handle_event(event).await?;
                        }
                        None => break,
                    }
                }

                // Periodic health check
                _ = tokio::time::sleep(tokio::time::Duration::from_secs(5)) => {
                    self.health_check().await?;
                }
            }
        }

        // Shutdown sequence
        self.shutdown().await?;
        Ok(())
    }

    /// Handle an incoming event
    async fn handle_event(&self, event: Event) -> Result<()> {
        debug!(event_type = ?event.event_type, "Processing event");

        // Store event
        self.storage.store_event(&event).await?;

        // Update metrics
        self.metrics.record_event(&event);

        match event.event_type {
            EventType::TaskRequested => {
                self.handle_task_request(event).await?;
            }
            EventType::PlanProposed => {
                self.handle_plan_proposed(event).await?;
            }
            EventType::ModelCall => {
                self.handle_model_call(event).await?;
            }
            EventType::AgentHeartbeat => {
                self.handle_agent_heartbeat(event).await?;
            }
            _ => {
                debug!(event_type = ?event.event_type, "Unhandled event type");
            }
        }

        Ok(())
    }

    async fn handle_task_request(&self, event: Event) -> Result<()> {
        // Check capabilities
        let cm = self.capability_manager.read().await;
        if !cm.check_capability(&event.source_id, "task:execute")? {
            warn!(source = %event.source_id, "Task request denied - missing capability");
            return Ok(());
        }

        // Submit to scheduler
        self.task_scheduler.submit(event).await?;
        Ok(())
    }

    async fn handle_plan_proposed(&self, event: Event) -> Result<()> {
        // Validate with policy engine
        let policy = self.policy_engine.read().await;
        let validation = policy.validate_plan(&event)?;

        if validation.requires_review {
            // Queue for manual review
            self.event_bus.publish(Event {
                id: uuid::Uuid::new_v4().to_string(),
                event_type: EventType::PlanQueued,
                source_id: "kernel".to_string(),
                payload: event.payload.clone(),
                timestamp: chrono::Utc::now(),
                metadata: serde_json::to_value(validation)?,
            })?;
        } else {
            // Auto-approve
            self.event_bus.publish(Event {
                id: uuid::Uuid::new_v4().to_string(),
                event_type: EventType::PlanApproved,
                source_id: "kernel".to_string(),
                payload: event.payload,
                timestamp: chrono::Utc::now(),
                metadata: serde_json::json!({"auto_approved": true}),
            })?;
        }

        Ok(())
    }

    async fn handle_model_call(&self, event: Event) -> Result<()> {
        // Check memory budget
        let usage = self.resource_manager.current_memory_usage().await;
        if usage > self.config.ram_budget_mb * 1024 * 1024 {
            warn!("Memory budget exceeded, requesting model swap");
            // Signal memory governor
            self.resource_manager.request_model_swap().await?;
        }

        Ok(())
    }

    async fn handle_agent_heartbeat(&self, event: Event) -> Result<()> {
        // Update agent health status
        self.metrics.record_heartbeat(&event.source_id);
        Ok(())
    }

    async fn health_check(&self) -> Result<()> {
        let state = {
            let sm = self.state_machine.read().await;
            sm.current_state()
        };

        if state != KernelState::Running {
            return Ok(());
        }

        // Collect metrics
        let ram_usage = self.resource_manager.current_memory_usage().await;
        let queue_length = self.event_bus.queue_length();

        // Record metrics
        self.metrics.record_gauge("ram_usage_mb", ram_usage as f64 / (1024.0 * 1024.0));
        self.metrics.record_gauge("event_queue_length", queue_length as f64);

        debug!(
            ram_usage_mb = ram_usage / (1024 * 1024),
            queue_length = queue_length,
            "Health check complete"
        );

        Ok(())
    }

    /// Get current kernel status
    pub async fn status(&self) -> KernelStatus {
        let state = {
            let sm = self.state_machine.read().await;
            sm.current_state()
        };

        let ram_usage = self.resource_manager.current_memory_usage().await;

        KernelStatus {
            state: format!("{:?}", state),
            uptime_secs: self.start_time.elapsed().as_secs(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            monotonic_clock: self.start_time.elapsed().as_millis() as u64,
            event_queue_length: self.event_bus.queue_length(),
            active_tasks: self.task_scheduler.active_count(),
            loaded_modules: 0, // TODO: track modules
            active_agents: 0,  // TODO: track agents
            ram_usage_mb: ram_usage / (1024 * 1024),
            ram_budget_mb: self.config.ram_budget_mb,
            policy_mode: format!("{:?}", self.config.policy_mode),
        }
    }

    /// Shutdown the kernel
    async fn shutdown(&self) -> Result<()> {
        info!("Initiating shutdown sequence");

        // Transition state
        {
            let mut sm = self.state_machine.write().await;
            sm.transition(KernelState::ShuttingDown)?;
        }

        // Stop accepting new events
        self.event_bus.shutdown();

        // Wait for tasks to complete
        self.task_scheduler.shutdown().await?;

        // Close storage
        self.storage.close()?;

        // Transition to shutdown
        {
            let mut sm = self.state_machine.write().await;
            sm.transition(KernelState::Shutdown)?;
        }

        info!("Kernel shutdown complete");
        Ok(())
    }

    /// Request kernel shutdown
    pub fn request_shutdown(&self) -> Result<()> {
        if let Some(tx) = &self.shutdown_tx {
            tx.try_send(())?;
        }
        Ok(())
    }
}
