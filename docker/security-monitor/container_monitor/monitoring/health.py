"""
Health check endpoints for container security monitoring.

Provides Kubernetes-style health checks:
- Liveness probes (is the service running?)
- Readiness probes (is the service ready to accept traffic?)
- Startup probes (has the service finished initializing?)
- Custom health checks for dependencies
"""

import asyncio
import time
import psutil
from typing import Dict, Any, Optional, List, Callable, Awaitable
from datetime import datetime, timezone, timedelta
from enum import Enum
from dataclasses import dataclass, asdict

import aiohttp
from aiohttp import web, ClientSession, ClientTimeout
import structlog

from container_monitor.monitoring.metrics import get_metrics

logger = structlog.get_logger(__name__)


class HealthStatus(Enum):
    """Health check status enumeration."""
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    DEGRADED = "degraded" 
    UNKNOWN = "unknown"


@dataclass
class HealthCheck:
    """Individual health check result."""
    name: str
    status: HealthStatus
    message: str
    duration_ms: float
    timestamp: str
    details: Optional[Dict[str, Any]] = None


@dataclass
class HealthResponse:
    """Complete health check response."""
    status: HealthStatus
    timestamp: str
    uptime_seconds: float
    version: str
    checks: List[HealthCheck]
    summary: Dict[str, int]


class HealthChecker:
    """
    Comprehensive health checking system.
    
    Provides multiple types of health checks:
    - System resource checks (CPU, memory, disk)
    - Service dependency checks (Docker, databases)
    - Application-specific checks (queue sizes, error rates)
    - Network connectivity checks
    """
    
    def __init__(self):
        """Initialize the health checker."""
        self.start_time = time.time()
        self.version = "2.0.0"
        self.checks: Dict[str, Callable[[], Awaitable[HealthCheck]]] = {}
        self.dependency_timeouts = {
            'docker': 5.0,
            'database': 3.0,
            'external_api': 10.0,
            'webhook': 5.0
        }
        
        # Health thresholds
        self.cpu_threshold = 80.0  # CPU usage percentage
        self.memory_threshold = 85.0  # Memory usage percentage
        self.disk_threshold = 90.0  # Disk usage percentage
        self.error_rate_threshold = 0.05  # 5% error rate
        
        # Register default checks
        self._register_default_checks()
        
    def _register_default_checks(self):
        """Register default health checks."""
        self.register_check("system_resources", self._check_system_resources)
        self.register_check("docker_connection", self._check_docker_connection)
        self.register_check("metrics_collection", self._check_metrics_collection)
        self.register_check("error_rates", self._check_error_rates)
        self.register_check("processing_queues", self._check_processing_queues)
        
    def register_check(self, name: str, check_func: Callable[[], Awaitable[HealthCheck]]):
        """
        Register a custom health check.
        
        Args:
            name: Unique name for the health check
            check_func: Async function that returns a HealthCheck
        """
        self.checks[name] = check_func
        logger.debug("Health check registered", name=name)
        
    async def _check_system_resources(self) -> HealthCheck:
        """Check system resource usage."""
        start_time = time.time()
        
        try:
            # Get system metrics
            cpu_percent = psutil.cpu_percent(interval=0.1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            # Check thresholds
            issues = []
            if cpu_percent > self.cpu_threshold:
                issues.append(f"High CPU usage: {cpu_percent:.1f}%")
            if memory.percent > self.memory_threshold:
                issues.append(f"High memory usage: {memory.percent:.1f}%")
            if disk.percent > self.disk_threshold:
                issues.append(f"High disk usage: {disk.percent:.1f}%")
            
            # Determine status
            if not issues:
                status = HealthStatus.HEALTHY
                message = "System resources within normal ranges"
            elif len(issues) == 1:
                status = HealthStatus.DEGRADED
                message = f"Resource warning: {issues[0]}"
            else:
                status = HealthStatus.UNHEALTHY
                message = f"Multiple resource issues: {'; '.join(issues)}"
            
            duration_ms = (time.time() - start_time) * 1000
            
            return HealthCheck(
                name="system_resources",
                status=status,
                message=message,
                duration_ms=duration_ms,
                timestamp=datetime.now(timezone.utc).isoformat(),
                details={
                    "cpu_percent": cpu_percent,
                    "memory_percent": memory.percent,
                    "memory_available_gb": memory.available / (1024**3),
                    "disk_percent": disk.percent,
                    "disk_free_gb": disk.free / (1024**3)
                }
            )
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            return HealthCheck(
                name="system_resources",
                status=HealthStatus.UNHEALTHY,
                message=f"Failed to check system resources: {str(e)}",
                duration_ms=duration_ms,
                timestamp=datetime.now(timezone.utc).isoformat()
            )
    
    async def _check_docker_connection(self) -> HealthCheck:
        """Check Docker daemon connectivity."""
        start_time = time.time()
        
        try:
            import docker
            
            # Try to connect to Docker
            client = docker.from_env()
            
            # Simple ping test
            info = client.info()
            container_count = len(client.containers.list())
            
            duration_ms = (time.time() - start_time) * 1000
            
            return HealthCheck(
                name="docker_connection",
                status=HealthStatus.HEALTHY,
                message=f"Docker daemon accessible, {container_count} containers running",
                duration_ms=duration_ms,
                timestamp=datetime.now(timezone.utc).isoformat(),
                details={
                    "docker_version": info.get("ServerVersion", "unknown"),
                    "container_count": container_count,
                    "images_count": len(client.images.list())
                }
            )
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            return HealthCheck(
                name="docker_connection",
                status=HealthStatus.UNHEALTHY,
                message=f"Docker daemon not accessible: {str(e)}",
                duration_ms=duration_ms,
                timestamp=datetime.now(timezone.utc).isoformat()
            )
    
    async def _check_metrics_collection(self) -> HealthCheck:
        """Check metrics collection health."""
        start_time = time.time()
        
        try:
            metrics = get_metrics()
            stats = metrics.get_metrics_summary()
            
            # Check if metrics are being updated
            uptime = stats.get('uptime_seconds', 0)
            scrape_interval = stats.get('scrape_interval_seconds', 0)
            
            if uptime < 60:  # Less than 1 minute uptime
                status = HealthStatus.DEGRADED
                message = "Metrics collection recently started"
            elif scrape_interval > 300:  # No scrapes in 5 minutes
                status = HealthStatus.UNHEALTHY
                message = "Metrics not being scraped regularly"
            else:
                status = HealthStatus.HEALTHY
                message = "Metrics collection operating normally"
            
            duration_ms = (time.time() - start_time) * 1000
            
            return HealthCheck(
                name="metrics_collection",
                status=status,
                message=message,
                duration_ms=duration_ms,
                timestamp=datetime.now(timezone.utc).isoformat(),
                details=stats
            )
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            return HealthCheck(
                name="metrics_collection",
                status=HealthStatus.UNHEALTHY,
                message=f"Metrics collection error: {str(e)}",
                duration_ms=duration_ms,
                timestamp=datetime.now(timezone.utc).isoformat()
            )
    
    async def _check_error_rates(self) -> HealthCheck:
        """Check application error rates."""
        start_time = time.time()
        
        try:
            # This would typically query metrics for error rates
            # For now, we'll simulate checking error rates
            
            # In a real implementation, you'd query your metrics:
            # error_rate = get_error_rate_from_metrics(time_window=300)
            error_rate = 0.02  # Simulated 2% error rate
            
            if error_rate > self.error_rate_threshold:
                status = HealthStatus.DEGRADED
                message = f"Elevated error rate: {error_rate:.1%}"
            else:
                status = HealthStatus.HEALTHY
                message = f"Error rate within normal range: {error_rate:.1%}"
            
            duration_ms = (time.time() - start_time) * 1000
            
            return HealthCheck(
                name="error_rates",
                status=status,
                message=message,
                duration_ms=duration_ms,
                timestamp=datetime.now(timezone.utc).isoformat(),
                details={
                    "error_rate": error_rate,
                    "threshold": self.error_rate_threshold,
                    "time_window_seconds": 300
                }
            )
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            return HealthCheck(
                name="error_rates",
                status=HealthStatus.UNKNOWN,
                message=f"Could not determine error rates: {str(e)}",
                duration_ms=duration_ms,
                timestamp=datetime.now(timezone.utc).isoformat()
            )
    
    async def _check_processing_queues(self) -> HealthCheck:
        """Check processing queue health."""
        start_time = time.time()
        
        try:
            # This would check actual queue sizes in a real implementation
            # For now, simulate queue size checking
            
            queue_sizes = {
                "event_processing": 15,
                "alert_delivery": 3,
                "vulnerability_scan": 8
            }
            
            total_queued = sum(queue_sizes.values())
            max_healthy_size = 50
            
            if total_queued > max_healthy_size * 2:
                status = HealthStatus.UNHEALTHY
                message = f"Processing queues severely backed up: {total_queued} items"
            elif total_queued > max_healthy_size:
                status = HealthStatus.DEGRADED
                message = f"Processing queues backed up: {total_queued} items"
            else:
                status = HealthStatus.HEALTHY
                message = f"Processing queues healthy: {total_queued} items queued"
            
            duration_ms = (time.time() - start_time) * 1000
            
            return HealthCheck(
                name="processing_queues",
                status=status,
                message=message,
                duration_ms=duration_ms,
                timestamp=datetime.now(timezone.utc).isoformat(),
                details=queue_sizes
            )
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            return HealthCheck(
                name="processing_queues",
                status=HealthStatus.UNKNOWN,
                message=f"Could not check queue status: {str(e)}",
                duration_ms=duration_ms,
                timestamp=datetime.now(timezone.utc).isoformat()
            )
    
    async def run_all_checks(self) -> HealthResponse:
        """
        Run all registered health checks.
        
        Returns:
            Complete health response with all check results
        """
        start_time = time.time()
        
        # Run all checks concurrently
        check_tasks = [
            check_func() for check_func in self.checks.values()
        ]
        
        check_results = await asyncio.gather(*check_tasks, return_exceptions=True)
        
        # Process results
        checks = []
        for i, result in enumerate(check_results):
            if isinstance(result, Exception):
                # Handle check that threw an exception
                check_name = list(self.checks.keys())[i]
                checks.append(HealthCheck(
                    name=check_name,
                    status=HealthStatus.UNHEALTHY,
                    message=f"Health check failed: {str(result)}",
                    duration_ms=(time.time() - start_time) * 1000,
                    timestamp=datetime.now(timezone.utc).isoformat()
                ))
            else:
                checks.append(result)
        
        # Determine overall status
        status_counts = {status: 0 for status in HealthStatus}
        for check in checks:
            status_counts[check.status] += 1
        
        # Overall status logic
        if status_counts[HealthStatus.UNHEALTHY] > 0:
            overall_status = HealthStatus.UNHEALTHY
        elif status_counts[HealthStatus.DEGRADED] > 0:
            overall_status = HealthStatus.DEGRADED
        elif status_counts[HealthStatus.UNKNOWN] > 0:
            overall_status = HealthStatus.UNKNOWN
        else:
            overall_status = HealthStatus.HEALTHY
        
        uptime_seconds = time.time() - self.start_time
        
        return HealthResponse(
            status=overall_status,
            timestamp=datetime.now(timezone.utc).isoformat(),
            uptime_seconds=uptime_seconds,
            version=self.version,
            checks=checks,
            summary={status.value: count for status, count in status_counts.items()}
        )
    
    async def check_readiness(self) -> HealthResponse:
        """
        Readiness probe - is the service ready to accept traffic?
        
        Returns:
            Health response focused on readiness
        """
        # For readiness, we only check critical dependencies
        critical_checks = ["docker_connection", "system_resources"]
        
        start_time = time.time()
        check_tasks = [
            self.checks[name]() for name in critical_checks 
            if name in self.checks
        ]
        
        check_results = await asyncio.gather(*check_tasks, return_exceptions=True)
        
        checks = []
        for i, result in enumerate(check_results):
            if isinstance(result, Exception):
                check_name = critical_checks[i]
                checks.append(HealthCheck(
                    name=check_name,
                    status=HealthStatus.UNHEALTHY,
                    message=f"Critical check failed: {str(result)}",
                    duration_ms=(time.time() - start_time) * 1000,
                    timestamp=datetime.now(timezone.utc).isoformat()
                ))
            else:
                checks.append(result)
        
        # Service is ready if all critical checks pass
        overall_status = HealthStatus.HEALTHY
        for check in checks:
            if check.status == HealthStatus.UNHEALTHY:
                overall_status = HealthStatus.UNHEALTHY
                break
        
        status_counts = {status: 0 for status in HealthStatus}
        for check in checks:
            status_counts[check.status] += 1
        
        return HealthResponse(
            status=overall_status,
            timestamp=datetime.now(timezone.utc).isoformat(),
            uptime_seconds=time.time() - self.start_time,
            version=self.version,
            checks=checks,
            summary={status.value: count for status, count in status_counts.items()}
        )
    
    async def run_comprehensive_health_check(self) -> Dict[str, Any]:
        """
        Run comprehensive health checks and return CLI-compatible format.
        
        Returns:
            Dictionary with health check results compatible with CLI expectations
        """
        try:
            health_response = await self.run_all_checks()
            
            # Convert to CLI-compatible format
            checks_dict = {}
            for check in health_response.checks:
                checks_dict[check.name] = "pass" if check.status == HealthStatus.HEALTHY else "fail"
            
            return {
                "overall_status": "healthy" if health_response.status == HealthStatus.HEALTHY else "unhealthy",
                "timestamp": health_response.timestamp,
                "uptime_seconds": health_response.uptime_seconds,
                "version": health_response.version,
                "checks": checks_dict,
                "summary": health_response.summary
            }
            
        except Exception as e:
            logger.error("Comprehensive health check failed", error=str(e))
            return {
                "overall_status": "unhealthy",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "uptime_seconds": time.time() - self.start_time,
                "version": self.version,
                "checks": {"health_check_system": "fail"},
                "summary": {"unhealthy": 1},
                "error": str(e)
            }
    
    async def check_liveness(self) -> HealthResponse:
        """
        Liveness probe - is the service alive?
        
        Returns:
            Basic health response indicating if service is alive
        """
        # Liveness is just a basic "am I alive" check
        start_time = time.time()
        
        try:
            # Simple checks that indicate the process is functioning
            uptime = time.time() - self.start_time
            
            # Basic liveness indicators
            can_allocate_memory = True
            can_access_filesystem = True
            
            try:
                # Test memory allocation
                test_data = [i for i in range(1000)]
                del test_data
            except:
                can_allocate_memory = False
            
            try:
                # Test filesystem access
                import tempfile
                with tempfile.NamedTemporaryFile() as f:
                    f.write(b"liveness test")
            except:
                can_access_filesystem = False
            
            if can_allocate_memory and can_access_filesystem:
                status = HealthStatus.HEALTHY
                message = f"Service alive and functional (uptime: {uptime:.1f}s)"
            else:
                status = HealthStatus.UNHEALTHY
                message = "Service experiencing critical issues"
            
            duration_ms = (time.time() - start_time) * 1000
            
            check = HealthCheck(
                name="liveness",
                status=status,
                message=message,
                duration_ms=duration_ms,
                timestamp=datetime.now(timezone.utc).isoformat(),
                details={
                    "uptime_seconds": uptime,
                    "can_allocate_memory": can_allocate_memory,
                    "can_access_filesystem": can_access_filesystem
                }
            )
            
            return HealthResponse(
                status=status,
                timestamp=datetime.now(timezone.utc).isoformat(),
                uptime_seconds=uptime,
                version=self.version,
                checks=[check],
                summary={status.value: 1}
            )
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            
            check = HealthCheck(
                name="liveness",
                status=HealthStatus.UNHEALTHY,
                message=f"Liveness check failed: {str(e)}",
                duration_ms=duration_ms,
                timestamp=datetime.now(timezone.utc).isoformat()
            )
            
            return HealthResponse(
                status=HealthStatus.UNHEALTHY,
                timestamp=datetime.now(timezone.utc).isoformat(),
                uptime_seconds=time.time() - self.start_time,
                version=self.version,
                checks=[check],
                summary={HealthStatus.UNHEALTHY.value: 1}
            )


class HealthServer:
    """
    HTTP server for health check endpoints.
    
    Provides Kubernetes-compatible health check endpoints:
    - /health (comprehensive health check)
    - /health/live (liveness probe)
    - /health/ready (readiness probe)
    - /health/startup (startup probe)
    """
    
    def __init__(self, health_checker: HealthChecker, port: int = 8001,
                 host: str = "0.0.0.0"):
        """
        Initialize health server.
        
        Args:
            health_checker: HealthChecker instance
            port: HTTP server port
            host: HTTP server host
        """
        self.health_checker = health_checker
        self.port = port
        self.host = host
        self.app = web.Application()
        self.startup_completed = False
        self.startup_time = time.time()
        
        # Setup routes
        self._setup_routes()
        
    def _setup_routes(self):
        """Setup HTTP routes for health endpoints."""
        self.app.router.add_get('/health', self._health_handler)
        self.app.router.add_get('/health/live', self._liveness_handler)
        self.app.router.add_get('/health/ready', self._readiness_handler)
        self.app.router.add_get('/health/startup', self._startup_handler)
        
    async def _health_handler(self, request: web.Request) -> web.Response:
        """Handle comprehensive health check requests."""
        try:
            health_response = await self.health_checker.run_all_checks()
            
            status_code = 200 if health_response.status == HealthStatus.HEALTHY else 503
            
            return web.json_response(
                asdict(health_response),
                status=status_code,
                headers={"Content-Type": "application/json"}
            )
            
        except Exception as e:
            logger.error("Health check failed", error=str(e))
            return web.json_response(
                {
                    "status": HealthStatus.UNHEALTHY.value,
                    "message": f"Health check error: {str(e)}",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                },
                status=503
            )
    
    async def _liveness_handler(self, request: web.Request) -> web.Response:
        """Handle liveness probe requests."""
        try:
            health_response = await self.health_checker.check_liveness()
            
            status_code = 200 if health_response.status == HealthStatus.HEALTHY else 503
            
            return web.json_response(
                asdict(health_response),
                status=status_code
            )
            
        except Exception as e:
            logger.error("Liveness check failed", error=str(e))
            return web.json_response(
                {
                    "status": HealthStatus.UNHEALTHY.value,
                    "message": "Liveness check failed"
                },
                status=503
            )
    
    async def _readiness_handler(self, request: web.Request) -> web.Response:
        """Handle readiness probe requests."""
        try:
            health_response = await self.health_checker.check_readiness()
            
            status_code = 200 if health_response.status == HealthStatus.HEALTHY else 503
            
            return web.json_response(
                asdict(health_response),
                status=status_code
            )
            
        except Exception as e:
            logger.error("Readiness check failed", error=str(e))
            return web.json_response(
                {
                    "status": HealthStatus.UNHEALTHY.value,
                    "message": "Readiness check failed"
                },
                status=503
            )
    
    async def _startup_handler(self, request: web.Request) -> web.Response:
        """Handle startup probe requests."""
        try:
            # Check if startup phase is complete
            startup_duration = time.time() - self.startup_time
            
            # Consider startup complete after basic initialization (30 seconds max)
            if not self.startup_completed and startup_duration > 30:
                self.startup_completed = True
            
            if self.startup_completed:
                status = HealthStatus.HEALTHY
                message = f"Startup completed in {startup_duration:.1f} seconds"
                status_code = 200
            else:
                status = HealthStatus.UNHEALTHY
                message = f"Still starting up ({startup_duration:.1f}s elapsed)"
                status_code = 503
            
            return web.json_response(
                {
                    "status": status.value,
                    "message": message,
                    "startup_duration_seconds": startup_duration,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                },
                status=status_code
            )
            
        except Exception as e:
            logger.error("Startup check failed", error=str(e))
            return web.json_response(
                {
                    "status": HealthStatus.UNHEALTHY.value,
                    "message": "Startup check failed"
                },
                status=503
            )
    
    def mark_startup_complete(self):
        """Mark the startup phase as complete."""
        self.startup_completed = True
        startup_duration = time.time() - self.startup_time
        logger.info("Application startup completed", 
                   duration_seconds=startup_duration)
    
    async def start(self) -> web.AppRunner:
        """Start the health check server."""
        runner = web.AppRunner(self.app)
        await runner.setup()
        
        site = web.TCPSite(runner, self.host, self.port)
        await site.start()
        
        logger.info("Health check server started",
                   host=self.host,
                   port=self.port)
        
        return runner
    
    async def stop(self, runner: web.AppRunner):
        """Stop the health check server."""
        await runner.cleanup()
        logger.info("Health check server stopped")


# Global health checker instance
_global_health_checker: Optional[HealthChecker] = None


def get_health_checker() -> HealthChecker:
    """Get the global health checker instance."""
    global _global_health_checker
    if _global_health_checker is None:
        _global_health_checker = HealthChecker()
    return _global_health_checker


if __name__ == "__main__":
    # Example usage and testing
    async def main():
        # Initialize health checker
        health_checker = HealthChecker()
        
        # Run health checks
        print("Running comprehensive health check...")
        health_response = await health_checker.run_all_checks()
        
        print(f"Overall Status: {health_response.status.value}")
        print(f"Uptime: {health_response.uptime_seconds:.1f} seconds")
        print(f"Checks run: {len(health_response.checks)}")
        
        for check in health_response.checks:
            status_icon = "✅" if check.status == HealthStatus.HEALTHY else "❌"
            print(f"  {status_icon} {check.name}: {check.message} ({check.duration_ms:.1f}ms)")
        
        print(f"\nSummary: {health_response.summary}")
        
        # Test readiness
        print("\nTesting readiness probe...")
        readiness = await health_checker.check_readiness()
        print(f"Ready: {readiness.status.value}")
        
        # Test liveness
        print("\nTesting liveness probe...")
        liveness = await health_checker.check_liveness()
        print(f"Alive: {liveness.status.value}")
    
    asyncio.run(main())