"""
PULSE Agent - Core agent implementation
"""

import asyncio
import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Callable
import logging

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class AgentStatus(str, Enum):
    """Agent status"""
    IDLE = "idle"
    PLANNING = "planning"
    EXECUTING = "executing"
    WAITING = "waiting"
    ERROR = "error"


class AgentHealth(str, Enum):
    """Agent health status"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


class AgentType(str, Enum):
    """Agent types"""
    REACTIVE = "reactive"
    DELIBERATIVE = "deliberative"
    HYBRID = "hybrid"


@dataclass
class AgentConfig:
    """Agent configuration"""
    max_concurrent_tasks: int = 1
    heartbeat_interval_ms: int = 30000
    task_timeout_ms: int = 300000
    max_retries: int = 3
    backoff_multiplier: float = 2.0
    initial_delay_ms: int = 1000
    max_delay_ms: int = 30000


class Task(BaseModel):
    """Task definition"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    task_type: str = "generic"
    priority: int = 5
    status: str = "pending"
    payload: Dict[str, Any] = Field(default_factory=dict)
    source_id: Optional[str] = None
    dependencies: List[str] = Field(default_factory=list)
    timeout_ms: int = 300000
    retry_count: int = 0
    max_retries: int = 3
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class Agent:
    """
    PULSE Agent - Autonomous agent for code intelligence
    
    Agents run as isolated processes and communicate with the kernel
    via JSON-RPC over WebSocket.
    """
    
    def __init__(
        self,
        name: str,
        agent_type: AgentType = AgentType.HYBRID,
        config: AgentConfig = None,
        kernel_client: Optional['KernelClient'] = None,
    ):
        self.id = str(uuid.uuid4())
        self.name = name
        self.agent_type = agent_type
        self.config = config or AgentConfig()
        self.kernel_client = kernel_client
        
        self.status = AgentStatus.IDLE
        self.health = AgentHealth.HEALTHY
        self.current_task: Optional[Task] = None
        self.task_count = 0
        self.success_count = 0
        self.failure_count = 0
        self.last_heartbeat: Optional[datetime] = None
        self.last_error: Optional[str] = None
        
        self._state: Dict[str, Any] = {}
        self._handlers: Dict[str, Callable] = {}
        self._running = False
        self._task_queue: asyncio.Queue = asyncio.Queue()
        
        # Register default handlers
        self._register_default_handlers()
    
    def _register_default_handlers(self):
        """Register default task handlers"""
        self._handlers["ping"] = self._handle_ping
        self._handlers["status"] = self._handle_status
        self._handlers["execute"] = self._handle_execute
    
    async def _handle_ping(self, task: Task) -> Dict[str, Any]:
        """Handle ping task"""
        return {"pong": True, "timestamp": datetime.utcnow().isoformat()}
    
    async def _handle_status(self, task: Task) -> Dict[str, Any]:
        """Handle status request"""
        return {
            "id": self.id,
            "name": self.name,
            "status": self.status.value,
            "health": self.health.value,
            "task_count": self.task_count,
            "success_count": self.success_count,
            "failure_count": self.failure_count,
        }
    
    async def _handle_execute(self, task: Task) -> Dict[str, Any]:
        """Handle generic execute task - override in subclasses"""
        # Default implementation just returns success
        return {"executed": True, "task_id": task.id}
    
    def register_handler(self, task_type: str, handler: Callable):
        """Register a task handler"""
        self._handlers[task_type] = handler
        logger.info(f"Registered handler for task type: {task_type}")
    
    async def start(self):
        """Start the agent"""
        logger.info(f"Starting agent {self.name} ({self.id})")
        self._running = True
        
        # Start heartbeat task
        asyncio.create_task(self._heartbeat_loop())
        
        # Start task processing loop
        await self._process_loop()
    
    async def stop(self):
        """Stop the agent"""
        logger.info(f"Stopping agent {self.name}")
        self._running = False
    
    async def _heartbeat_loop(self):
        """Send heartbeats to kernel"""
        while self._running:
            self.last_heartbeat = datetime.utcnow()
            
            if self.kernel_client:
                try:
                    await self.kernel_client.send_heartbeat(self.id)
                except Exception as e:
                    logger.warning(f"Heartbeat failed: {e}")
            
            await asyncio.sleep(self.config.heartbeat_interval_ms / 1000)
    
    async def _process_loop(self):
        """Process tasks from queue"""
        while self._running:
            try:
                task = await asyncio.wait_for(
                    self._task_queue.get(),
                    timeout=1.0
                )
                await self._process_task(task)
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Error in process loop: {e}")
    
    async def _process_task(self, task: Task):
        """Process a single task"""
        logger.info(f"Processing task {task.id}: {task.name}")
        
        self.status = AgentStatus.EXECUTING
        self.current_task = task
        task.started_at = datetime.utcnow()
        task.status = "running"
        
        try:
            # Get handler
            handler = self._handlers.get(task.task_type)
            if not handler:
                raise ValueError(f"No handler for task type: {task.task_type}")
            
            # Execute with timeout
            result = await asyncio.wait_for(
                handler(task),
                timeout=task.timeout_ms / 1000
            )
            
            task.result = result if isinstance(result, dict) else {"result": result}
            task.status = "completed"
            task.completed_at = datetime.utcnow()
            
            self.success_count += 1
            logger.info(f"Task {task.id} completed successfully")
            
        except asyncio.TimeoutError:
            task.error = f"Task timed out after {task.timeout_ms}ms"
            task.status = "failed"
            self.failure_count += 1
            self.last_error = task.error
            logger.error(f"Task {task.id} timed out")
            
        except Exception as e:
            task.error = str(e)
            task.status = "failed"
            self.failure_count += 1
            self.last_error = task.error
            logger.error(f"Task {task.id} failed: {e}")
            
        finally:
            self.status = AgentStatus.IDLE
            self.current_task = None
            self.task_count += 1
    
    def submit_task(self, task: Task):
        """Submit a task to the agent"""
        self._task_queue.put_nowait(task)
        logger.debug(f"Task {task.id} submitted to agent {self.name}")
    
    def get_state(self) -> Dict[str, Any]:
        """Get agent state"""
        return {
            "id": self.id,
            "name": self.name,
            "type": self.agent_type.value,
            "status": self.status.value,
            "health": self.health.value,
            "task_count": self.task_count,
            "success_count": self.success_count,
            "failure_count": self.failure_count,
            "current_task": self.current_task.id if self.current_task else None,
            "last_heartbeat": self.last_heartbeat.isoformat() if self.last_heartbeat else None,
            "last_error": self.last_error,
        }
    
    def set_state(self, state: Dict[str, Any]):
        """Set agent state"""
        self._state.update(state)


# Import for type hints
from .kernel_client import KernelClient
