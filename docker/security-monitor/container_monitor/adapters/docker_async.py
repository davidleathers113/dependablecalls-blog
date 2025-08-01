"""
Async Docker client adapter with fallback support.

Provides non-blocking Docker operations with graceful degradation:
- Primary: aiodocker for async operations
- Fallback: ThreadPoolExecutor wrapping sync docker-py
- Circuit breaker for fault tolerance
"""

import asyncio
import functools
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Any, Optional, Protocol
from datetime import datetime, timedelta

import docker
from docker.errors import DockerException
import structlog

from container_monitor.models.config import MonitorConfig

logger = structlog.get_logger(__name__)

# Try to import aiodocker, fallback to sync if unavailable
try:
    import aiodocker
    AIODOCKER_AVAILABLE = True
except ImportError:
    logger.warning("aiodocker not available, using sync fallback")
    AIODOCKER_AVAILABLE = False


class ContainerProtocol(Protocol):
    """Protocol for container objects across implementations."""
    
    @property
    def id(self) -> str: ...
    
    @property
    def name(self) -> str: ...
    
    @property  
    def status(self) -> str: ...
    
    @property
    def attrs(self) -> Dict[str, Any]: ...


class CircuitBreaker:
    """
    Simple circuit breaker for Docker connection failures.
    
    States:
    - CLOSED: Normal operation
    - OPEN: Failing, reject calls
    - HALF_OPEN: Testing recovery
    """
    
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.state = "CLOSED"
        
    def record_success(self):
        """Record successful operation."""
        self.failure_count = 0
        self.state = "CLOSED"
        
    def record_failure(self):
        """Record failed operation."""
        self.failure_count += 1
        self.last_failure_time = datetime.now()
        
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            logger.error("Circuit breaker opened", failures=self.failure_count)
            
    def can_execute(self) -> bool:
        """Check if operation can be executed."""
        if self.state == "CLOSED":
            return True
            
        if self.state == "OPEN":
            if self.last_failure_time:
                time_since_failure = datetime.now() - self.last_failure_time
                if time_since_failure > timedelta(seconds=self.recovery_timeout):
                    self.state = "HALF_OPEN"
                    logger.info("Circuit breaker half-open, testing recovery")
                    return True
            return False
            
        return True  # HALF_OPEN state


class AsyncDockerClient:
    """
    Async Docker client with automatic fallback.
    
    Attempts to use aiodocker for true async operations,
    falls back to ThreadPoolExecutor for compatibility.
    """
    
    def __init__(self, config: MonitorConfig):
        self.config = config
        self.circuit_breaker = CircuitBreaker()
        
        # Client instances
        self._async_client: Optional['aiodocker.Docker'] = None
        self._sync_client: Optional[docker.DockerClient] = None
        self._executor: Optional[ThreadPoolExecutor] = None
        
        # Mode tracking
        self.mode = "async" if AIODOCKER_AVAILABLE else "sync"
        
    async def __aenter__(self) -> 'AsyncDockerClient':
        """Async context manager entry."""
        await self.initialize()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()
        
    async def initialize(self):
        """Initialize the appropriate Docker client."""
        try:
            if AIODOCKER_AVAILABLE:
                self._async_client = aiodocker.Docker()
                logger.info("Initialized aiodocker client")
            else:
                self._sync_client = docker.from_env()
                self._executor = ThreadPoolExecutor(
                    max_workers=self.config.get_concurrency_limit()
                )
                logger.info("Initialized sync Docker client with executor")
                
        except Exception as e:
            logger.error(f"Failed to initialize Docker client: {e}")
            raise
            
    async def close(self):
        """Clean up resources."""
        if self._async_client:
            await self._async_client.close()
            
        if self._executor:
            self._executor.shutdown(wait=True)
            
    async def list_containers(self, all: bool = False) -> List[Dict[str, Any]]:
        """
        List containers asynchronously.
        
        Args:
            all: Include stopped containers
            
        Returns:
            List of container dictionaries
        """
        if not self.circuit_breaker.can_execute():
            logger.warning("Circuit breaker open, returning empty list")
            return []
            
        try:
            if self._async_client:
                containers = await self._async_client.containers.list(all=all)
                result = []
                for container in containers:
                    info = await container.show()
                    result.append(info)
                    
            else:
                # Sync fallback
                containers = await self._run_sync(
                    lambda: self._sync_client.containers.list(all=all)
                )
                result = [c.attrs for c in containers]
                
            self.circuit_breaker.record_success()
            return result
            
        except Exception as e:
            self.circuit_breaker.record_failure()
            logger.error(f"Failed to list containers: {e}")
            raise
            
    async def get_container_stats(
        self, 
        container_id: str, 
        stream: bool = False
    ) -> Dict[str, Any]:
        """
        Get container statistics asynchronously.
        
        Args:
            container_id: Container ID
            stream: Stream stats (not supported in async)
            
        Returns:
            Statistics dictionary
        """
        if not self.circuit_breaker.can_execute():
            raise DockerException("Circuit breaker open")
            
        try:
            if self._async_client:
                container = await self._async_client.containers.get(container_id)
                stats = await container.stats(stream=False)
                
            else:
                # Sync fallback
                container = await self._run_sync(
                    lambda: self._sync_client.containers.get(container_id)
                )
                stats = await self._run_sync(
                    lambda: container.stats(stream=False)
                )
                
            self.circuit_breaker.record_success()
            return stats
            
        except Exception as e:
            self.circuit_breaker.record_failure()
            logger.error(f"Failed to get container stats: {e}")
            raise
            
    async def get_container_processes(
        self, 
        container_id: str
    ) -> Dict[str, Any]:
        """
        Get processes running in container.
        
        Args:
            container_id: Container ID
            
        Returns:
            Process information
        """
        if not self.circuit_breaker.can_execute():
            raise DockerException("Circuit breaker open")
            
        try:
            if self._async_client:
                container = await self._async_client.containers.get(container_id)
                # aiodocker doesn't have top() method directly
                response = await container._query(
                    f"containers/{container_id}/top"
                )
                processes = await response.json()
                
            else:
                # Sync fallback
                container = await self._run_sync(
                    lambda: self._sync_client.containers.get(container_id)
                )
                processes = await self._run_sync(
                    lambda: container.top()
                )
                
            self.circuit_breaker.record_success()
            return processes
            
        except Exception as e:
            self.circuit_breaker.record_failure()
            logger.error(f"Failed to get container processes: {e}")
            raise
            
    async def inspect_container(self, container_id: str) -> Dict[str, Any]:
        """
        Get detailed container information.
        
        Args:
            container_id: Container ID
            
        Returns:
            Container inspect data
        """
        if not self.circuit_breaker.can_execute():
            raise DockerException("Circuit breaker open")
            
        try:
            if self._async_client:
                container = await self._async_client.containers.get(container_id)
                # Get container details using show method
                details = await container.show()
                
            else:
                # Sync fallback
                container = await self._run_sync(
                    lambda: self._sync_client.containers.get(container_id)
                )
                details = await self._run_sync(
                    lambda: container.attrs
                )
                
            self.circuit_breaker.record_success()
            return details
            
        except Exception as e:
            self.circuit_breaker.record_failure()
            logger.error(f"Failed to inspect container: {e}")
            raise
            
    async def execute_command(
        self,
        container_id: str,
        command: List[str]
    ) -> str:
        """
        Execute command in container asynchronously.
        
        Args:
            container_id: Container ID
            command: Command to execute
            
        Returns:
            Command output
        """
        if not self.circuit_breaker.can_execute():
            raise DockerException("Circuit breaker open")
            
        try:
            if self._async_client:
                container = await self._async_client.containers.get(container_id)
                exec_instance = await container.exec(command)
                output = await exec_instance.start()
                result = output.decode('utf-8')
                
            else:
                # Sync fallback
                container = await self._run_sync(
                    lambda: self._sync_client.containers.get(container_id)
                )
                result = await self._run_sync(
                    lambda: container.exec_run(command).output.decode('utf-8')
                )
                
            self.circuit_breaker.record_success()
            return result
            
        except Exception as e:
            self.circuit_breaker.record_failure()
            logger.error(f"Failed to execute command: {e}")
            raise
            
    async def _run_sync(self, func):
        """Run synchronous function in executor."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self._executor, func)
        
    def get_client_info(self) -> Dict[str, Any]:
        """Get information about the Docker client."""
        return {
            "mode": self.mode,
            "circuit_breaker_state": self.circuit_breaker.state,
            "failure_count": self.circuit_breaker.failure_count,
            "aiodocker_available": AIODOCKER_AVAILABLE
        }