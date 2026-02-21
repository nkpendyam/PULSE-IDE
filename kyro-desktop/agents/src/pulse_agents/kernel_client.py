"""
PULSE Kernel Client - JSON-RPC client for kernel communication
"""

import asyncio
import json
import uuid
from typing import Any, Dict, Optional, Callable
import logging
import aiohttp
import websockets

logger = logging.getLogger(__name__)


class KernelClient:
    """
    JSON-RPC client for communicating with the PULSE kernel
    """
    
    def __init__(
        self,
        kernel_url: str = "ws://localhost:9876",
        http_url: str = "http://localhost:8080",
    ):
        self.kernel_url = kernel_url
        self.http_url = http_url
        self._ws: Optional[websockets.WebSocketClientProtocol] = None
        self._session: Optional[aiohttp.ClientSession] = None
        self._request_id = 0
    
    async def connect(self):
        """Connect to the kernel"""
        logger.info(f"Connecting to kernel at {self.kernel_url}")
        self._ws = await websockets.connect(self.kernel_url)
        self._session = aiohttp.ClientSession()
        logger.info("Connected to kernel")
    
    async def disconnect(self):
        """Disconnect from kernel"""
        if self._ws:
            await self._ws.close()
            self._ws = None
        if self._session:
            await self._session.close()
            self._session = None
        logger.info("Disconnected from kernel")
    
    async def _next_id(self) -> int:
        """Get next request ID"""
        self._request_id += 1
        return self._request_id
    
    async def call(
        self,
        method: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> Any:
        """
        Make a JSON-RPC call
        
        Args:
            method: RPC method name
            params: Method parameters
        
        Returns:
            Result from the call
        """
        if not self._session:
            raise RuntimeError("Not connected to kernel")
        
        request_id = await self._next_id()
        request = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": params or {},
        }
        
        async with self._session.post(
            f"{self.http_url}/rpc",
            json=request,
        ) as response:
            result = await response.json()
            
            if "error" in result:
                raise Exception(result["error"].get("message", "RPC error"))
            
            return result.get("result")
    
    async def subscribe(
        self,
        event_type: str,
        handler: Callable[[Dict[str, Any]], None],
    ):
        """
        Subscribe to events via WebSocket
        
        Args:
            event_type: Event type to subscribe to
            handler: Callback for events
        """
        if not self._ws:
            raise RuntimeError("WebSocket not connected")
        
        # Send subscription request
        await self._ws.send(json.dumps({
            "type": "subscribe",
            "event_type": event_type,
        }))
        
        # Start listening for events
        async for message in self._ws:
            data = json.loads(message)
            if data.get("event_type") == event_type:
                handler(data)
    
    # Kernel API methods
    
    async def get_status(self) -> Dict[str, Any]:
        """Get kernel status"""
        return await self.call("kernel.status")
    
    async def pause(self):
        """Pause the kernel"""
        return await self.call("kernel.pause")
    
    async def resume(self):
        """Resume the kernel"""
        return await self.call("kernel.resume")
    
    async def shutdown(self):
        """Shutdown the kernel"""
        return await self.call("kernel.shutdown")
    
    async def submit_event(
        self,
        event_type: str,
        source_id: str,
        payload: Dict[str, Any],
    ) -> str:
        """Submit an event"""
        result = await self.call("event.submit", {
            "event_type": event_type,
            "source_id": source_id,
            "payload": payload,
        })
        return result
    
    async def submit_task(
        self,
        name: str,
        source_id: str,
        payload: Dict[str, Any],
    ) -> str:
        """Submit a task"""
        result = await self.call("task.submit", {
            "name": name,
            "source_id": source_id,
            "payload": payload,
        })
        return result
    
    async def get_task_status(self, task_id: str) -> Optional[str]:
        """Get task status"""
        return await self.call("task.status", {"task_id": task_id})
    
    async def cancel_task(self, task_id: str) -> bool:
        """Cancel a task"""
        return await self.call("task.cancel", {"task_id": task_id})
    
    async def send_heartbeat(self, agent_id: str):
        """Send agent heartbeat"""
        await self.submit_event("AgentHeartbeat", agent_id, {
            "timestamp": asyncio.get_event_loop().time(),
        })
    
    async def grant_capabilities(
        self,
        entity_id: str,
        entity_type: str,
        capabilities: list,
    ):
        """Grant capabilities to an entity"""
        return await self.call("capability.grant", {
            "entity_id": entity_id,
            "entity_type": entity_type,
            "capabilities": capabilities,
        })
    
    async def check_capability(
        self,
        entity_id: str,
        capability: str,
    ) -> bool:
        """Check if entity has capability"""
        return await self.call("capability.check", {
            "entity_id": entity_id,
            "capability": capability,
        })
    
    async def get_memory_usage(self) -> int:
        """Get memory usage"""
        return await self.call("resource.memory")
    
    async def store_memory(
        self,
        key: str,
        value: str,
        memory_type: str,
    ):
        """Store memory entry"""
        return await self.call("memory.store", {
            "key": key,
            "value": value,
            "memory_type": memory_type,
        })
    
    async def get_memory(self, key: str) -> Optional[str]:
        """Get memory entry"""
        return await self.call("memory.get", {"key": key})
    
    async def create_checkpoint(
        self,
        entity_type: str,
        entity_id: str,
        state: str,
    ) -> str:
        """Create a checkpoint"""
        return await self.call("checkpoint.create", {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "state": state,
        })
    
    async def restore_checkpoint(
        self,
        entity_type: str,
        entity_id: str,
    ) -> Optional[str]:
        """Restore from checkpoint"""
        return await self.call("checkpoint.restore", {
            "entity_type": entity_type,
            "entity_id": entity_id,
        })
