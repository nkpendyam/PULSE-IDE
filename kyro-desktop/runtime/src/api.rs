//! PULSE Runtime Kernel - JSON-RPC API
//!
//! Control API for kernel management and operations.

pub mod client;

use crate::event::{Event, EventBus, EventType};
use crate::state::{StateMachine, KernelState};
use crate::capability::CapabilityManager;
use crate::scheduler::TaskScheduler;
use crate::resource::ResourceManager;
use crate::kernel::KernelStatus;

use anyhow::Result;
use jsonrpc_core::*;
use jsonrpc_derive::rpc;
use serde::{Serialize, Deserialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, debug};

/// JSON-RPC API trait
#[rpc(server)]
pub trait KernelApi {
    /// Get kernel status
    #[rpc(name = "kernel.status")]
    fn status(&self) -> Result<KernelStatus>;

    /// Pause the kernel
    #[rpc(name = "kernel.pause")]
    fn pause(&self) -> Result<()>;

    /// Resume the kernel
    #[rpc(name = "kernel.resume")]
    fn resume(&self) -> Result<()>;

    /// Shutdown the kernel
    #[rpc(name = "kernel.shutdown")]
    fn shutdown(&self) -> Result<()>;

    /// Submit an event
    #[rpc(name = "event.submit")]
    fn submit_event(&self, event_type: String, source_id: String, payload: serde_json::Value) -> Result<String>;

    /// Submit a task
    #[rpc(name = "task.submit")]
    fn submit_task(&self, name: String, source_id: String, payload: serde_json::Value) -> Result<String>;

    /// Get task status
    #[rpc(name = "task.status")]
    fn task_status(&self, task_id: String) -> Result<Option<String>>;

    /// Cancel a task
    #[rpc(name = "task.cancel")]
    fn cancel_task(&self, task_id: String) -> Result<bool>;

    /// Grant capabilities
    #[rpc(name = "capability.grant")]
    fn grant_capabilities(&self, entity_id: String, entity_type: String, capabilities: Vec<String>) -> Result<()>;

    /// Check capability
    #[rpc(name = "capability.check")]
    fn check_capability(&self, entity_id: String, capability: String) -> Result<bool>;

    /// Get memory usage
    #[rpc(name = "resource.memory")]
    fn get_memory_usage(&self) -> Result<u64>;

    /// Execute sandboxed command
    #[rpc(name = "sandbox.execute")]
    fn execute_sandbox(&self, command: String, args: Vec<String>, config: Option<serde_json::Value>) -> Result<serde_json::Value>;

    /// Store memory entry
    #[rpc(name = "memory.store")]
    fn store_memory(&self, key: String, value: String, memory_type: String) -> Result<()>;

    /// Get memory entry
    #[rpc(name = "memory.get")]
    fn get_memory(&self, key: String) -> Result<Option<String>>;

    /// Create checkpoint
    #[rpc(name = "checkpoint.create")]
    fn create_checkpoint(&self, entity_type: String, entity_id: String, state: String) -> Result<String>;

    /// Restore checkpoint
    #[rpc(name = "checkpoint.restore")]
    fn restore_checkpoint(&self, entity_type: String, entity_id: String) -> Result<Option<String>>;
}

/// API implementation
pub struct KernelApiImpl {
    state_machine: Arc<RwLock<StateMachine>>,
    event_bus: Arc<EventBus>,
    capability_manager: Arc<RwLock<CapabilityManager>>,
    task_scheduler: Arc<TaskScheduler>,
    resource_manager: Arc<ResourceManager>,
}

impl KernelApiImpl {
    pub fn new(
        state_machine: Arc<RwLock<StateMachine>>,
        event_bus: Arc<EventBus>,
        capability_manager: Arc<RwLock<CapabilityManager>>,
        task_scheduler: Arc<TaskScheduler>,
        resource_manager: Arc<ResourceManager>,
    ) -> Self {
        Self {
            state_machine,
            event_bus,
            capability_manager,
            task_scheduler,
            resource_manager,
        }
    }
}

impl KernelApi for KernelApiImpl {
    fn status(&self) -> Result<KernelStatus> {
        let rt = tokio::runtime::Handle::current();
        let sm = rt.block_on(self.state_machine.read());
        let state = sm.current_state();
        
        Ok(KernelStatus {
            state: format!("{:?}", state),
            uptime_secs: 0, // Would track actual uptime
            version: env!("CARGO_PKG_VERSION").to_string(),
            monotonic_clock: 0,
            event_queue_length: self.event_bus.queue_length(),
            active_tasks: self.task_scheduler.active_count(),
            loaded_modules: 0,
            active_agents: 0,
            ram_usage_mb: 0,
            ram_budget_mb: 0,
            policy_mode: "review".to_string(),
        })
    }

    fn pause(&self) -> Result<()> {
        let rt = tokio::runtime::Handle::current();
        rt.block_on(async {
            let mut sm = self.state_machine.write().await;
            sm.transition(KernelState::Paused)
                .map_err(|e| Error::invalid_params(e.to_string()))
        })
    }

    fn resume(&self) -> Result<()> {
        let rt = tokio::runtime::Handle::current();
        rt.block_on(async {
            let mut sm = self.state_machine.write().await;
            sm.transition(KernelState::Running)
                .map_err(|e| Error::invalid_params(e.to_string()))
        })
    }

    fn shutdown(&self) -> Result<()> {
        self.event_bus.publish(Event::new(
            EventType::KernelShutdown,
            "api",
            serde_json::json!({}),
        )).map_err(|e| Error::internal_error(e.to_string()))
    }

    fn submit_event(&self, event_type: String, source_id: String, payload: serde_json::Value) -> Result<String> {
        let event_type: EventType = event_type.parse()
            .map_err(|_| Error::invalid_params("Invalid event type"))?;
        
        let event = Event::new(event_type, source_id, payload);
        let id = event.id.clone();
        
        self.event_bus.publish(event)
            .map_err(|e| Error::internal_error(e.to_string()))?;
        
        Ok(id)
    }

    fn submit_task(&self, name: String, source_id: String, payload: serde_json::Value) -> Result<String> {
        let rt = tokio::runtime::Handle::current();
        
        let task = crate::scheduler::Task::new(name, source_id, payload);
        let task_id = task.id.clone();
        
        let event = Event::new(
            EventType::TaskRequested,
            "api",
            serde_json::to_value(&task).map_err(|e| Error::internal_error(e.to_string()))?,
        );
        
        rt.block_on(self.task_scheduler.submit(event))
            .map_err(|e| Error::internal_error(e.to_string()))?;
        
        Ok(task_id)
    }

    fn task_status(&self, task_id: String) -> Result<Option<String>> {
        let rt = tokio::runtime::Handle::current();
        let status = rt.block_on(self.task_scheduler.get_status(&task_id));
        Ok(status.map(|s| format!("{:?}", s)))
    }

    fn cancel_task(&self, task_id: String) -> Result<bool> {
        let rt = tokio::runtime::Handle::current();
        rt.block_on(self.task_scheduler.cancel(&task_id))
            .map_err(|e| Error::internal_error(e.to_string()))
    }

    fn grant_capabilities(&self, entity_id: String, entity_type: String, capabilities: Vec<String>) -> Result<()> {
        let rt = tokio::runtime::Handle::current();
        let entity_type = match entity_type.as_str() {
            "agent" => crate::capability::EntityType::Agent,
            "module" => crate::capability::EntityType::Module,
            "user" => crate::capability::EntityType::User,
            "system" => crate::capability::EntityType::System,
            _ => return Err(Error::invalid_params("Invalid entity type")),
        };
        
        rt.block_on(async {
            let mut cm = self.capability_manager.write().await;
            cm.grant(entity_id, entity_type, capabilities, None)
                .map_err(|e| Error::internal_error(e.to_string()))
        })
    }

    fn check_capability(&self, entity_id: String, capability: String) -> Result<bool> {
        let rt = tokio::runtime::Handle::current();
        rt.block_on(async {
            let cm = self.capability_manager.read().await;
            cm.check_capability(&entity_id, &capability)
                .map_err(|e| Error::internal_error(e.to_string()))
        })
    }

    fn get_memory_usage(&self) -> Result<u64> {
        let rt = tokio::runtime::Handle::current();
        Ok(rt.block_on(self.resource_manager.current_memory_usage()))
    }

    fn execute_sandbox(&self, command: String, args: Vec<String>, config: Option<serde_json::Value>) -> Result<serde_json::Value> {
        // Would integrate with sandbox manager
        Err(Error::method_not_found())
    }

    fn store_memory(&self, key: String, value: String, memory_type: String) -> Result<()> {
        // Would integrate with storage
        Ok(())
    }

    fn get_memory(&self, key: String) -> Result<Option<String>> {
        // Would integrate with storage
        Ok(None)
    }

    fn create_checkpoint(&self, entity_type: String, entity_id: String, state: String) -> Result<String> {
        Ok(uuid::Uuid::new_v4().to_string())
    }

    fn restore_checkpoint(&self, entity_type: String, entity_id: String) -> Result<Option<String>> {
        Ok(None)
    }
}

/// JSON-RPC server
pub struct JsonRpcServer {
    socket_path: String,
    http_port: u16,
}

impl JsonRpcServer {
    pub fn new(
        socket_path: String,
        http_port: u16,
        state_machine: Arc<RwLock<StateMachine>>,
        event_bus: Arc<EventBus>,
        capability_manager: Arc<RwLock<CapabilityManager>>,
        task_scheduler: Arc<TaskScheduler>,
        resource_manager: Arc<ResourceManager>,
    ) -> Self {
        let api = KernelApiImpl::new(
            state_machine,
            event_bus,
            capability_manager,
            task_scheduler,
            resource_manager,
        );

        // Set up JSON-RPC server
        let mut io = IoHandler::new();
        io.extend_with(api.to_delegate());

        // Start HTTP server if port specified
        if http_port > 0 {
            let server = jsonrpc_http_server::ServerBuilder::new(io.clone())
                .start_http(&format!("127.0.0.1:{}", http_port).parse().unwrap())
                .expect("Failed to start HTTP server");
            
            info!("HTTP API listening on port {}", http_port);
            
            // Keep server running
            tokio::spawn(async move {
                server.wait();
            });
        }

        Self {
            socket_path,
            http_port,
        }
    }
}

/// Client for connecting to kernel
pub struct KernelClient {
    socket_path: String,
}

impl KernelClient {
    pub fn new(socket_path: &str) -> Self {
        Self {
            socket_path: socket_path.to_string(),
        }
    }

    pub async fn health_check(&self) -> Result<KernelStatus> {
        // Would implement actual JSON-RPC client
        Ok(KernelStatus {
            state: "running".to_string(),
            uptime_secs: 0,
            version: "1.0.0".to_string(),
            monotonic_clock: 0,
            event_queue_length: 0,
            active_tasks: 0,
            loaded_modules: 0,
            active_agents: 0,
            ram_usage_mb: 0,
            ram_budget_mb: 4096,
            policy_mode: "review".to_string(),
        })
    }

    pub async fn shutdown(&self) -> Result<()> {
        // Would implement actual JSON-RPC call
        Ok(())
    }
}
