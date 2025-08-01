"""
Concurrency control for bounded parallel operations.

Provides:
- Semaphore-based rate limiting
- Backpressure handling
- Resource pool management
- Graceful degradation under load
"""

import asyncio
from typing import TypeVar, Callable, List, Any, Optional, Dict
from collections import deque
from datetime import datetime, timedelta
import structlog

from container_monitor.models.config import MonitorConfig

logger = structlog.get_logger(__name__)

T = TypeVar('T')


class BoundedExecutor:
    """
    Executes async operations with concurrency limits.
    
    Features:
    - Configurable concurrency limit
    - Queue overflow handling
    - Execution metrics
    - Adaptive rate limiting
    """
    
    def __init__(self, config: MonitorConfig):
        """
        Initialize the bounded executor.
        
        Args:
            config: Monitor configuration
        """
        self.config = config
        self.max_concurrent = config.get_concurrency_limit()
        
        # Concurrency control
        self.semaphore = asyncio.Semaphore(self.max_concurrent)
        self.queue: deque = deque(maxlen=self.max_concurrent * 10)
        
        # Metrics
        self.total_executed = 0
        self.total_failed = 0
        self.total_queued = 0
        self.execution_times: deque = deque(maxlen=100)
        
        # Rate limiting
        self.rate_limiter = AdaptiveRateLimiter()
        
    async def execute(
        self,
        func: Callable[..., T],
        *args,
        **kwargs
    ) -> T:
        """
        Execute a single async operation with bounds.
        
        Args:
            func: Async function to execute
            *args: Positional arguments
            **kwargs: Keyword arguments
            
        Returns:
            Function result
        """
        # Wait for rate limit
        await self.rate_limiter.acquire()
        
        # Wait for semaphore
        async with self.semaphore:
            start_time = datetime.now()
            
            try:
                result = await func(*args, **kwargs)
                self.total_executed += 1
                
                # Record execution time
                execution_time = (datetime.now() - start_time).total_seconds()
                self.execution_times.append(execution_time)
                
                # Adjust rate limit based on performance
                self.rate_limiter.record_success(execution_time)
                
                return result
                
            except Exception as e:
                self.total_failed += 1
                self.rate_limiter.record_failure()
                logger.error(
                    "Bounded execution failed",
                    func=func.__name__,
                    error=str(e)
                )
                raise
                
    async def execute_many(
        self,
        func: Callable[..., T],
        items: List[Any],
        *args,
        **kwargs
    ) -> List[T]:
        """
        Execute function for multiple items with concurrency control.
        
        Args:
            func: Async function to execute
            items: Items to process
            *args: Additional positional arguments
            **kwargs: Additional keyword arguments
            
        Returns:
            List of results
        """
        # Create tasks with bounded execution
        tasks = [
            self.execute(func, item, *args, **kwargs)
            for item in items
        ]
        
        # Execute with gathering
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter exceptions if needed
        return [r for r in results if not isinstance(r, Exception)]
        
    async def map_bounded(
        self,
        func: Callable[[T], Any],
        items: List[T],
        preserve_order: bool = True
    ) -> List[Any]:
        """
        Map function over items with concurrency bounds.
        
        Args:
            func: Function to apply
            items: Items to process
            preserve_order: Maintain input order
            
        Returns:
            Mapped results
        """
        if not items:
            return []
            
        # Create indexed tasks
        indexed_tasks = [
            (i, self.execute(func, item))
            for i, item in enumerate(items)
        ]
        
        # Execute concurrently
        if preserve_order:
            # Maintain order
            results = [None] * len(items)
            for i, task in indexed_tasks:
                try:
                    results[i] = await task
                except Exception as e:
                    logger.error(f"Task {i} failed: {e}")
                    results[i] = None
            return results
        else:
            # Return as completed
            results = []
            for task in asyncio.as_completed([t[1] for t in indexed_tasks]):
                try:
                    result = await task
                    results.append(result)
                except Exception:
                    pass
            return results
            
    def get_stats(self) -> Dict[str, Any]:
        """Get execution statistics."""
        avg_execution_time = (
            sum(self.execution_times) / len(self.execution_times)
            if self.execution_times else 0
        )
        
        return {
            "total_executed": self.total_executed,
            "total_failed": self.total_failed,
            "success_rate": (
                self.total_executed / (self.total_executed + self.total_failed)
                if (self.total_executed + self.total_failed) > 0
                else 0
            ),
            "avg_execution_time": avg_execution_time,
            "current_rate_limit": self.rate_limiter.current_rate,
            "semaphore_available": self.semaphore._value
        }


class AdaptiveRateLimiter:
    """
    Adaptive rate limiting based on system performance.
    
    Automatically adjusts rate based on:
    - Success/failure ratio
    - Execution times
    - System load
    """
    
    def __init__(
        self,
        initial_rate: float = 10.0,
        min_rate: float = 1.0,
        max_rate: float = 100.0
    ):
        self.current_rate = initial_rate
        self.min_rate = min_rate
        self.max_rate = max_rate
        
        # Tracking
        self.last_acquire = datetime.now()
        self.success_count = 0
        self.failure_count = 0
        self.execution_times: deque = deque(maxlen=100)
        
    async def acquire(self):
        """Acquire permission to execute."""
        # Calculate delay based on rate
        now = datetime.now()
        time_since_last = (now - self.last_acquire).total_seconds()
        required_delay = 1.0 / self.current_rate
        
        if time_since_last < required_delay:
            await asyncio.sleep(required_delay - time_since_last)
            
        self.last_acquire = datetime.now()
        
    def record_success(self, execution_time: float):
        """Record successful execution."""
        self.success_count += 1
        self.execution_times.append(execution_time)
        
        # Increase rate if performing well
        if self.success_count % 10 == 0:
            success_ratio = self.success_count / (self.success_count + self.failure_count)
            avg_execution_time = sum(self.execution_times) / len(self.execution_times)
            
            if success_ratio > 0.95 and avg_execution_time < 0.5:
                self.current_rate = min(self.current_rate * 1.1, self.max_rate)
                logger.debug(f"Increased rate limit to {self.current_rate:.1f}")
                
    def record_failure(self):
        """Record failed execution."""
        self.failure_count += 1
        
        # Decrease rate on failures
        if self.failure_count % 3 == 0:
            self.current_rate = max(self.current_rate * 0.8, self.min_rate)
            logger.warning(f"Decreased rate limit to {self.current_rate:.1f}")


class ResourcePool:
    """
    Manages a pool of reusable resources.
    
    Useful for:
    - Connection pooling
    - Client instance management
    - Resource lifecycle
    """
    
    def __init__(self, factory: Callable, max_size: int = 10):
        self.factory = factory
        self.max_size = max_size
        self.pool: deque = deque()
        self.in_use = set()
        self.created = 0
        
    async def acquire(self):
        """Acquire a resource from the pool."""
        # Try to get from pool
        while self.pool:
            resource = self.pool.popleft()
            if await self._validate(resource):
                self.in_use.add(id(resource))
                return resource
                
        # Create new if under limit
        if self.created < self.max_size:
            resource = await self.factory()
            self.created += 1
            self.in_use.add(id(resource))
            return resource
            
        # Wait for available resource
        while not self.pool:
            await asyncio.sleep(0.1)
            
        return await self.acquire()
        
    def release(self, resource):
        """Release resource back to pool."""
        resource_id = id(resource)
        if resource_id in self.in_use:
            self.in_use.remove(resource_id)
            self.pool.append(resource)
            
    async def _validate(self, resource) -> bool:
        """Validate resource is still usable."""
        # Override in subclasses
        return True
        
    async def close_all(self):
        """Close all pooled resources."""
        # Close pooled resources
        while self.pool:
            resource = self.pool.popleft()
            if hasattr(resource, 'close'):
                await resource.close()
                
        # Note: in-use resources should be closed by their users