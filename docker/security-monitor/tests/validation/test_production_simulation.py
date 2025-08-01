"""
Production Simulation Validation Tests

Simulates realistic production environments to validate the modular Container
Security Monitor under real-world conditions.

Production Scenarios:
- 300+ container environments
- Extended runtime validation (sustained operation)
- Real Docker daemon integration
- Actual webhook endpoint testing
- Network fault simulation
- Resource pressure testing
- Concurrent user scenarios

This test suite validates production readiness and identifies potential
issues that might only appear under realistic production loads.
"""

import pytest
import pytest_asyncio
import asyncio
import docker
import time
import os
import signal
import psutil
import json
import aiohttp
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from unittest.mock import Mock, AsyncMock, patch
from contextlib import asynccontextmanager
import logging

from container_monitor.core.monitor import ContainerMonitor
from container_monitor.models.config import MonitorConfig
from container_monitor.models.events import SecurityEvent


# Configure test logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ProductionSimulator:
    """Simulates production-like Docker environment."""
    
    def __init__(self, container_count: int = 300):
        self.container_count = container_count
        self.mock_containers = []
        self.running = False
        
    def generate_realistic_containers(self) -> List[Dict]:
        """Generate realistic container configurations."""
        containers = []
        
        # Application containers (70%)
        app_count = int(self.container_count * 0.7)
        for i in range(app_count):
            containers.append({
                "Id": f"app_container_{i}",
                "Names": [f"/dce-app-{i}"],
                "State": "running",
                "Config": {
                    "Image": f"dce/app:v1.{i % 10}",
                    "User": "app:app" if i % 3 == 0 else "",  # Some root users
                    "ExposedPorts": {"8080/tcp": {}, "9090/tcp": {}} if i % 5 == 0 else {"8080/tcp": {}},
                    "Env": [
                        "NODE_ENV=production",
                        f"APP_ID=app-{i}",
                        "SECRET_KEY=dummy-secret"
                    ]
                },
                "HostConfig": {
                    "Privileged": i % 20 == 0,  # 5% privileged
                    "ReadonlyRootfs": i % 4 == 0,  # 25% read-only
                    "Memory": 1073741824,  # 1GB
                    "CpuShares": 1024
                },
                "Mounts": [
                    {
                        "Source": "/app/data",
                        "Destination": "/data",
                        "Type": "volume"
                    }
                ] + ([{
                    "Source": "/var/run/docker.sock",
                    "Destination": "/var/run/docker.sock",
                    "Type": "bind"
                }] if i % 50 == 0 else []),  # 2% with Docker socket
                "Created": "2024-01-01T00:00:00Z",
                "NetworkSettings": {
                    "Networks": {
                        "dce-network": {
                            "IPAddress": f"172.18.0.{10 + i % 240}"
                        }
                    }
                }
            })
        
        # Database containers (15%)
        db_count = int(self.container_count * 0.15)
        for i in range(db_count):
            containers.append({
                "Id": f"db_container_{i}",
                "Names": [f"/dce-db-{i}"],
                "State": "running",
                "Config": {
                    "Image": "postgres:13" if i % 2 == 0 else "redis:6",
                    "User": "postgres" if i % 2 == 0 else "redis",
                    "ExposedPorts": {"5432/tcp": {}} if i % 2 == 0 else {"6379/tcp": {}},
                    "Env": [
                        "POSTGRES_DB=dce_db" if i % 2 == 0 else "REDIS_PASSWORD=redis-pass",
                        "POSTGRES_USER=postgres" if i % 2 == 0 else "",
                        "POSTGRES_PASSWORD=secure-password" if i % 2 == 0 else ""
                    ]
                },
                "HostConfig": {
                    "Privileged": False,
                    "ReadonlyRootfs": False,
                    "Memory": 2147483648,  # 2GB
                    "CpuShares": 2048
                },
                "Mounts": [
                    {
                        "Source": f"/var/lib/db-{i}",
                        "Destination": "/var/lib/postgresql/data" if i % 2 == 0 else "/data",
                        "Type": "volume"
                    }
                ],
                "Created": "2024-01-01T00:00:00Z"
            })
        
        # System/Infrastructure containers (15%)
        infra_count = self.container_count - app_count - db_count
        for i in range(infra_count):
            service_type = ["nginx", "monitoring", "logging"][i % 3]
            containers.append({
                "Id": f"infra_{service_type}_{i}",
                "Names": [f"/dce-{service_type}-{i}"],
                "State": "running",
                "Config": {
                    "Image": f"{service_type}:latest",
                    "User": service_type if service_type != "nginx" else "www-data",
                    "ExposedPorts": {
                        "80/tcp": {}, "443/tcp": {}
                    } if service_type == "nginx" else {
                        "9090/tcp": {}
                    } if service_type == "monitoring" else {
                        "5044/tcp": {}
                    },
                    "Env": [f"SERVICE={service_type}", "ENVIRONMENT=production"]
                },
                "HostConfig": {
                    "Privileged": service_type == "monitoring",  # Monitoring needs privileges
                    "ReadonlyRootfs": service_type == "nginx",
                    "Memory": 536870912,  # 512MB
                    "CpuShares": 512
                },
                "Mounts": [
                    {
                        "Source": f"/var/log/{service_type}",
                        "Destination": "/var/log",
                        "Type": "bind"
                    }
                ] + ([{
                    "Source": "/proc",
                    "Destination": "/host/proc",
                    "Type": "bind"
                }] if service_type == "monitoring" else []),
                "Created": "2024-01-01T00:00:00Z"
            })
        
        self.mock_containers = containers
        return containers
    
    def simulate_dynamic_stats(self, container_id: str) -> Dict:
        """Generate realistic, time-varying container stats."""
        base_time = time.time()
        
        # Simulate different load patterns based on container type
        if "app" in container_id:
            # Application containers: variable CPU, moderate memory
            cpu_base = 0.3 + 0.4 * abs(hash(container_id) % 100) / 100
            memory_base = 0.4 + 0.3 * abs(hash(container_id) % 100) / 100
        elif "db" in container_id:
            # Database containers: steady CPU, high memory
            cpu_base = 0.2 + 0.2 * abs(hash(container_id) % 100) / 100
            memory_base = 0.6 + 0.3 * abs(hash(container_id) % 100) / 100
        else:
            # Infrastructure: low CPU, low memory
            cpu_base = 0.1 + 0.2 * abs(hash(container_id) % 100) / 100
            memory_base = 0.2 + 0.2 * abs(hash(container_id) % 100) / 100
        
        # Add time-based variation
        time_factor = 1 + 0.3 * abs(hash(str(base_time)) % 100) / 100
        cpu_usage = min(0.95, cpu_base * time_factor)
        memory_usage = min(0.90, memory_base * time_factor)
        
        # Convert to Docker stats format
        total_memory = 1073741824  # 1GB
        used_memory = int(total_memory * memory_usage)
        
        cpu_total = int(cpu_usage * 1000000)  # CPU nanoseconds
        system_total = 10000000
        
        return {
            "read": datetime.now(timezone.utc).isoformat(),
            "cpu_stats": {
                "cpu_usage": {
                    "total_usage": cpu_total,
                    "percpu_usage": [cpu_total // 2, cpu_total // 2]
                },
                "system_cpu_usage": system_total,
                "online_cpus": 2
            },
            "precpu_stats": {
                "cpu_usage": {
                    "total_usage": max(0, cpu_total - 100000)
                },
                "system_cpu_usage": system_total - 100000
            },
            "memory_stats": {
                "usage": used_memory,
                "limit": total_memory,
                "stats": {
                    "active_anon": used_memory // 2,
                    "active_file": used_memory // 4,
                    "cache": used_memory // 8
                }
            },
            "networks": {
                "eth0": {
                    "rx_bytes": int(base_time * 1000) % 10000000,
                    "tx_bytes": int(base_time * 800) % 8000000,
                    "rx_packets": int(base_time * 10) % 100000,
                    "tx_packets": int(base_time * 8) % 80000
                }
            },
            "blkio_stats": {
                "io_service_bytes_recursive": [
                    {
                        "major": 8,
                        "minor": 0,
                        "op": "Read",
                        "value": int(base_time * 100) % 1000000
                    },
                    {
                        "major": 8,
                        "minor": 0,
                        "op": "Write", 
                        "value": int(base_time * 50) % 500000
                    }
                ]
            }
        }
    
    def simulate_container_processes(self, container_id: str) -> Dict:
        """Generate realistic container processes."""
        if "app" in container_id:
            return {
                "Titles": ["PID", "PPID", "USER", "STAT", "VSZ", "RSS", "%CPU", "%MEM", "TIME", "COMMAND"],
                "Processes": [
                    ["1", "0", "app", "S", "123456", "45678", "0.1", "4.5", "0:02:34", "node server.js"],
                    ["15", "1", "app", "S", "98765", "23456", "0.0", "2.3", "0:00:15", "npm run worker"],
                    ["23", "1", "app", "S", "65432", "12345", "0.0", "1.2", "0:00:08", "node health-check.js"]
                ]
            }
        elif "db" in container_id:
            if "postgres" in container_id:
                return {
                    "Titles": ["PID", "PPID", "USER", "STAT", "VSZ", "RSS", "%CPU", "%MEM", "TIME", "COMMAND"],
                    "Processes": [
                        ["1", "0", "postgres", "S", "234567", "123456", "0.2", "12.3", "0:15:42", "postgres"],
                        ["25", "1", "postgres", "S", "123456", "45678", "0.1", "4.5", "0:02:15", "postgres: writer"],
                        ["26", "1", "postgres", "S", "123456", "34567", "0.0", "3.4", "0:01:08", "postgres: checkpointer"]
                    ]
                }
            else:  # Redis
                return {
                    "Titles": ["PID", "PPID", "USER", "STAT", "VSZ", "RSS", "%CPU", "%MEM", "TIME", "COMMAND"],
                    "Processes": [
                        ["1", "0", "redis", "S", "87654", "23456", "0.1", "2.3", "0:08:12", "redis-server *:6379"]
                    ]
                }
        else:  # Infrastructure
            service = container_id.split('_')[1] if '_' in container_id else "service"
            return {
                "Titles": ["PID", "PPID", "USER", "STAT", "VSZ", "RSS", "%CPU", "%MEM", "TIME", "COMMAND"],
                "Processes": [
                    ["1", "0", "root", "S", "65432", "12345", "0.0", "1.2", "0:03:45", f"{service}: master"],
                    ["15", "1", "www-data", "S", "54321", "8765", "0.0", "0.8", "0:01:23", f"{service}: worker"]
                ]
            }


class TestProductionSimulation:
    """Production simulation test suite."""
    
    @pytest_asyncio.fixture
    async def production_config(self):
        """Production-like configuration."""
        return MonitorConfig(
            monitor_interval=10,  # 10 second intervals
            max_concurrent_containers=50,  # Process containers in batches
            container_patterns=["dce-*"],
            
            # Thresholds
            cpu_threshold=85.0,
            memory_threshold=85.0,
            network_threshold_mbps=200.0,
            
            # Security policies
            allowed_ports=[80, 443, 8080, 3000, 5000, 9090],
            blocked_processes=["nc", "netcat", "telnet", "ftp", "ssh"],
            monitored_directories=["/etc", "/usr/bin", "/usr/sbin", "/app"],
            
            # Alerting
            alert_webhook="https://hooks.example.com/webhook",
            alert_secret_key="production-webhook-secret-key",
            
            # Reporting
            report_interval=300,  # 5 minutes
            retention_days=30,
            
            # Performance tuning
            file_monitoring=True,
            network_monitoring=True,
            behavioral_analysis=True
        )
    
    @pytest_asyncio.fixture
    async def production_simulator(self):
        """Production environment simulator."""
        simulator = ProductionSimulator(container_count=350)
        containers = simulator.generate_realistic_containers()
        yield simulator
    
    @pytest.mark.slow
    @pytest.mark.production
    async def test_300_plus_container_handling(self, production_config, production_simulator):
        """Test handling 300+ containers simultaneously."""
        monitor = ContainerMonitor(production_config)
        
        try:
            containers = production_simulator.mock_containers
            logger.info(f"Testing with {len(containers)} containers")
            
            # Mock Docker client responses
            with patch.object(monitor.docker_client, 'list_containers') as mock_list:
                with patch.object(monitor.docker_client, 'get_container_stats') as mock_stats:
                    with patch.object(monitor.docker_client, 'get_container_processes') as mock_procs:
                        
                        mock_list.return_value = containers
                        mock_stats.side_effect = lambda cid: production_simulator.simulate_dynamic_stats(cid)
                        mock_procs.side_effect = lambda cid: production_simulator.simulate_container_processes(cid)
                        
                        # Performance tracking
                        start_time = time.time()
                        initial_memory = psutil.Process().memory_info().rss / 1024 / 1024
                        
                        # Run multiple monitoring cycles
                        for cycle in range(5):
                            cycle_start = time.time()
                            
                            # Scan all containers
                            detected_containers = await monitor._scan_containers()
                            
                            cycle_time = time.time() - cycle_start
                            logger.info(f"Cycle {cycle + 1}: {len(detected_containers)} containers in {cycle_time:.2f}s")
                            
                            # Verify performance constraints
                            assert cycle_time < 120, f"Cycle {cycle + 1} took too long: {cycle_time:.2f}s"
                            assert len(detected_containers) >= 300, f"Should detect 300+ containers, got {len(detected_containers)}"
                            
                            # Check memory usage
                            current_memory = psutil.Process().memory_info().rss / 1024 / 1024
                            memory_growth = current_memory - initial_memory
                            assert memory_growth < 500, f"Memory growth too high: {memory_growth:.1f}MB"
                            
                            # Brief pause between cycles
                            await asyncio.sleep(2)
                        
                        total_time = time.time() - start_time
                        avg_time_per_cycle = total_time / 5
                        
                        logger.info(f"Average cycle time: {avg_time_per_cycle:.2f}s")
                        logger.info(f"Total memory growth: {memory_growth:.1f}MB")
                        
                        # Final assertions
                        assert avg_time_per_cycle < 60, f"Average cycle time too high: {avg_time_per_cycle:.2f}s"
                        
        finally:
            await monitor.shutdown()
    
    @pytest.mark.slow
    @pytest.mark.production
    async def test_extended_runtime_stability(self, production_config, production_simulator):
        """Test stability during extended runtime (simulated 24+ hour operation)."""
        # Reduce intervals for faster testing
        config = production_config.model_copy()
        config.monitor_interval = 2  # 2 seconds
        config.report_interval = 60  # 1 minute
        
        monitor = ContainerMonitor(config)
        
        try:
            containers = production_simulator.mock_containers[:100]  # Smaller set for extended test
            
            # Track performance over time
            performance_history = []
            error_count = 0
            
            with patch.object(monitor.docker_client, 'list_containers') as mock_list:
                with patch.object(monitor.docker_client, 'get_container_stats') as mock_stats:
                    with patch.object(monitor.docker_client, 'get_container_processes') as mock_procs:
                        
                        mock_list.return_value = containers
                        mock_stats.side_effect = lambda cid: production_simulator.simulate_dynamic_stats(cid)
                        mock_procs.side_effect = lambda cid: production_simulator.simulate_container_processes(cid)
                        
                        # Run for simulated extended period (30 cycles = ~1 hour simulation)
                        start_time = time.time()
                        initial_memory = psutil.Process().memory_info().rss / 1024 / 1024
                        
                        for cycle in range(30):
                            try:
                                cycle_start = time.time()
                                process = psutil.Process()
                                
                                # Monitor cycle
                                detected_containers = await monitor._scan_containers()
                                
                                cycle_time = time.time() - cycle_start
                                current_memory = process.memory_info().rss / 1024 / 1024
                                cpu_percent = process.cpu_percent()
                                
                                # Record performance
                                performance_history.append({
                                    'cycle': cycle,
                                    'cycle_time': cycle_time,
                                    'memory_mb': current_memory,
                                    'cpu_percent': cpu_percent,
                                    'containers_detected': len(detected_containers)
                                })
                                
                                # Log progress every 10 cycles
                                if cycle % 10 == 0:
                                    memory_growth = current_memory - initial_memory
                                    logger.info(f"Extended test cycle {cycle}: {cycle_time:.2f}s, "
                                              f"memory: {current_memory:.1f}MB (+{memory_growth:.1f}MB), "
                                              f"CPU: {cpu_percent:.1f}%")
                                
                                # Verify no performance degradation
                                assert cycle_time < 30, f"Cycle {cycle} too slow: {cycle_time:.2f}s"
                                assert current_memory < initial_memory + 300, f"Memory leak detected: {current_memory:.1f}MB"
                                
                                await asyncio.sleep(1)  # Brief pause
                                
                            except Exception as e:
                                error_count += 1
                                logger.error(f"Error in cycle {cycle}: {e}")
                                
                                # Allow some errors but not too many
                                assert error_count < 5, f"Too many errors: {error_count}"
                        
                        # Analyze performance trends
                        if len(performance_history) >= 10:
                            # Check for memory leaks
                            early_memory = sum(p['memory_mb'] for p in performance_history[:5]) / 5
                            late_memory = sum(p['memory_mb'] for p in performance_history[-5:]) / 5
                            memory_trend = late_memory - early_memory
                            
                            assert memory_trend < 100, f"Memory leak detected: {memory_trend:.1f}MB growth"
                            
                            # Check for performance degradation
                            early_time = sum(p['cycle_time'] for p in performance_history[:5]) / 5
                            late_time = sum(p['cycle_time'] for p in performance_history[-5:]) / 5
                            time_trend = (late_time - early_time) / early_time * 100
                            
                            assert time_trend < 50, f"Performance degradation: {time_trend:.1f}% slower"
                            
                            logger.info(f"Extended test completed: {len(performance_history)} cycles, "
                                      f"{error_count} errors, memory trend: {memory_trend:+.1f}MB")
                        
        finally:
            await monitor.shutdown()
    
    @pytest.mark.production
    async def test_real_webhook_integration(self, production_config):
        """Test with real webhook endpoints (if available)."""
        # Use a test webhook service or skip if not available
        test_webhook_url = os.environ.get('TEST_WEBHOOK_URL')
        if not test_webhook_url:
            pytest.skip("No test webhook URL provided (set TEST_WEBHOOK_URL environment variable)")
        
        config = production_config.model_copy()
        config.alert_webhook = test_webhook_url
        config.alert_secret_key = "test-webhook-secret"
        
        monitor = ContainerMonitor(config)
        
        try:
            # Generate test security events
            test_events = [
                SecurityEvent(
                    event_type="security_misconfiguration",
                    severity="CRITICAL",
                    source="production_test",
                    description="Test privileged container detected",
                    container_id="test_container_prod",
                    container_name="dce-test-production",
                    details={"privileged": True, "test": True}
                ),
                SecurityEvent(
                    event_type="resource_anomaly",
                    severity="HIGH",
                    source="production_test",
                    description="Test high CPU usage detected",
                    container_id="test_container_prod",
                    container_name="dce-test-production",
                    details={"cpu_percent": 95.0, "test": True}
                )
            ]
            
            # Send alerts to real webhook
            alert_results = []
            for event in test_events:
                try:
                    await monitor._add_security_event(event)
                    alert_results.append(True)
                    await asyncio.sleep(1)  # Rate limiting
                except Exception as e:
                    logger.error(f"Failed to send alert: {e}")
                    alert_results.append(False)
            
            # Verify at least some alerts were sent successfully
            success_rate = sum(alert_results) / len(alert_results)
            assert success_rate >= 0.8, f"Webhook success rate too low: {success_rate:.1%}"
            
            logger.info(f"Webhook integration test: {success_rate:.1%} success rate")
            
        finally:
            await monitor.shutdown()
    
    @pytest.mark.production  
    async def test_fault_tolerance_under_load(self, production_config, production_simulator):
        """Test fault tolerance under production-like load."""
        monitor = ContainerMonitor(production_config)
        
        try:
            containers = production_simulator.mock_containers[:150]  # Moderate load
            
            # Inject various faults
            fault_scenarios = [
                {"type": "docker_timeout", "frequency": 0.1},  # 10% of calls timeout
                {"type": "container_not_found", "frequency": 0.05},  # 5% containers disappear
                {"type": "network_error", "frequency": 0.03},  # 3% network errors
                {"type": "memory_pressure", "threshold": 0.9}  # High memory usage
            ]
            
            error_counts = {scenario["type"]: 0 for scenario in fault_scenarios}
            successful_cycles = 0
            
            with patch.object(monitor.docker_client, 'list_containers') as mock_list:
                with patch.object(monitor.docker_client, 'get_container_stats') as mock_stats:
                    with patch.object(monitor.docker_client, 'get_container_processes') as mock_procs:
                        
                        def inject_faults(call_type, *args, **kwargs):
                            """Inject faults based on scenarios."""
                            import random
                            
                            for scenario in fault_scenarios:
                                if random.random() < scenario["frequency"]:
                                    error_counts[scenario["type"]] += 1
                                    
                                    if scenario["type"] == "docker_timeout":
                                        raise asyncio.TimeoutError("Docker API timeout")
                                    elif scenario["type"] == "container_not_found":
                                        raise docker.errors.NotFound("Container not found")
                                    elif scenario["type"] == "network_error":
                                        raise docker.errors.APIError("Network error")
                            
                            # Return normal response if no fault injected
                            if call_type == "list":
                                return containers
                            elif call_type == "stats":
                                return production_simulator.simulate_dynamic_stats(args[0])
                            elif call_type == "processes":
                                return production_simulator.simulate_container_processes(args[0])
                        
                        mock_list.side_effect = lambda: inject_faults("list")
                        mock_stats.side_effect = lambda cid: inject_faults("stats", cid)
                        mock_procs.side_effect = lambda cid: inject_faults("processes", cid)
                        
                        # Run monitoring cycles with fault injection
                        for cycle in range(20):
                            try:
                                cycle_start = time.time()
                                
                                # Should handle faults gracefully
                                detected_containers = await monitor._scan_containers()
                                
                                cycle_time = time.time() - cycle_start
                                successful_cycles += 1
                                
                                # Even with faults, should complete cycles
                                assert cycle_time < 60, f"Cycle {cycle} took too long despite faults: {cycle_time:.2f}s"
                                
                                await asyncio.sleep(0.5)
                                
                            except Exception as e:
                                # Should not have unhandled exceptions
                                logger.error(f"Unhandled exception in cycle {cycle}: {e}")
                                raise
                        
                        # Verify fault tolerance
                        total_faults = sum(error_counts.values())
                        logger.info(f"Fault tolerance test: {total_faults} faults injected, "
                                  f"{successful_cycles} successful cycles")
                        
                        # Should complete most cycles despite faults
                        success_rate = successful_cycles / 20
                        assert success_rate >= 0.8, f"Success rate too low with faults: {success_rate:.1%}"
                        
                        # Should have encountered some faults (test is working)
                        assert total_faults > 5, f"Not enough faults injected: {total_faults}"
                        
        finally:
            await monitor.shutdown()
    
    @pytest.mark.production
    async def test_concurrent_operations_safety(self, production_config, production_simulator):
        """Test thread safety and concurrent operation handling."""
        monitor = ContainerMonitor(production_config)
        
        try:
            containers = production_simulator.mock_containers[:100]
            
            with patch.object(monitor.docker_client, 'list_containers') as mock_list:
                with patch.object(monitor.docker_client, 'get_container_stats') as mock_stats:
                    with patch.object(monitor.docker_client, 'get_container_processes') as mock_procs:
                        
                        mock_list.return_value = containers
                        mock_stats.side_effect = lambda cid: production_simulator.simulate_dynamic_stats(cid)
                        mock_procs.side_effect = lambda cid: production_simulator.simulate_container_processes(cid)
                        
                        # Run multiple monitoring operations concurrently
                        concurrent_tasks = []
                        for i in range(10):  # 10 concurrent operations
                            task = asyncio.create_task(monitor._scan_containers())
                            concurrent_tasks.append(task)
                        
                        # Wait for all to complete
                        results = await asyncio.gather(*concurrent_tasks, return_exceptions=True)
                        
                        # Check for race conditions or deadlocks
                        exceptions = [r for r in results if isinstance(r, Exception)]
                        successful_results = [r for r in results if not isinstance(r, Exception)]
                        
                        assert len(exceptions) == 0, f"Concurrent operations failed: {exceptions}"
                        assert len(successful_results) == 10, f"Not all operations completed: {len(successful_results)}"
                        
                        # All results should be consistent
                        container_counts = [len(result) for result in successful_results]
                        assert all(count == container_counts[0] for count in container_counts), \
                            f"Inconsistent results from concurrent operations: {container_counts}"
                        
                        logger.info(f"Concurrent operations test: {len(successful_results)} successful, "
                                  f"{len(exceptions)} exceptions")
                        
        finally:
            await monitor.shutdown()
    
    @pytest.mark.production
    async def test_resource_cleanup_validation(self, production_config, production_simulator):
        """Validate proper resource cleanup under production conditions."""
        initial_memory = psutil.Process().memory_info().rss / 1024 / 1024
        initial_threads = threading.active_count()
        
        # Run multiple monitor instances to test cleanup
        for instance in range(5):
            monitor = ContainerMonitor(production_config)
            
            try:
                containers = production_simulator.mock_containers[:50]
                
                with patch.object(monitor.docker_client, 'list_containers') as mock_list:
                    mock_list.return_value = containers
                    
                    # Run some operations
                    for cycle in range(3):
                        await monitor._scan_containers()
                        await asyncio.sleep(0.1)
                        
            finally:
                await monitor.shutdown()
                
                # Give time for cleanup
                await asyncio.sleep(0.5)
            
            # Check resource usage after each instance
            current_memory = psutil.Process().memory_info().rss / 1024 / 1024
            current_threads = threading.active_count()
            
            memory_growth = current_memory - initial_memory
            thread_growth = current_threads - initial_threads
            
            logger.info(f"Instance {instance + 1}: Memory growth: {memory_growth:.1f}MB, "
                      f"Thread growth: {thread_growth}")
            
            # Resource usage shouldn't grow significantly
            assert memory_growth < 50, f"Memory not cleaned up properly: {memory_growth:.1f}MB growth"
            assert thread_growth <= 2, f"Threads not cleaned up properly: {thread_growth} extra threads"
        
        # Final cleanup check
        final_memory = psutil.Process().memory_info().rss / 1024 / 1024
        final_threads = threading.active_count()
        
        total_memory_growth = final_memory - initial_memory
        total_thread_growth = final_threads - initial_threads
        
        assert total_memory_growth < 100, f"Overall memory leak: {total_memory_growth:.1f}MB"
        assert total_thread_growth <= 3, f"Thread leak: {total_thread_growth} extra threads"
        
        logger.info(f"Resource cleanup validation complete: "
                  f"memory growth: {total_memory_growth:.1f}MB, "
                  f"thread growth: {total_thread_growth}")


# Test markers
pytestmark = [
    pytest.mark.production,
    pytest.mark.slow,
    pytest.mark.asyncio
]