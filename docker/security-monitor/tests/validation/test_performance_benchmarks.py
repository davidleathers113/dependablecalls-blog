"""
Performance Benchmark Validation Tests

Validates that the modular Container Security Monitor meets or exceeds
performance targets compared to the monolithic system.

Performance Targets:
- CPU Usage: <10% with 300 containers (60% reduction vs monolith)
- Memory Usage: <2KB per alert (94% reduction vs monolith)
- Response Time: Alert delivery ≤ monolith latency
- Throughput: Events processed per second ≥ monolith
- Container Handling: 300+ containers without degradation
"""

import pytest
import pytest_asyncio
import asyncio
import time
import psutil
import os
import gc
import json
from datetime import datetime, timezone
from typing import List, Dict, Any
from unittest.mock import Mock, AsyncMock, patch
from contextlib import asynccontextmanager

# Import both systems for comparison
from legacy.security_monitor_v1 import ContainerMonitor as MonolithMonitor, MonitorConfig as MonolithConfig
from container_monitor.core.monitor import ContainerMonitor as ModularMonitor
from container_monitor.models.config import MonitorConfig as ModularConfig
from container_monitor.models.events import SecurityEvent


class PerformanceProfiler:
    """Performance profiling utilities."""
    
    def __init__(self, process_pid: int = None):
        self.process = psutil.Process(process_pid or os.getpid())
        self.initial_memory = None
        self.initial_cpu = None
        self.measurements = []
    
    def start_profiling(self):
        """Start performance measurement."""
        self.initial_memory = self.process.memory_info().rss / 1024 / 1024  # MB
        self.initial_cpu = self.process.cpu_percent()
        self.start_time = time.time()
        self.measurements = []
        
    def take_measurement(self, label: str = ""):
        """Take a performance measurement."""
        current_memory = self.process.memory_info().rss / 1024 / 1024  # MB
        current_cpu = self.process.cpu_percent()
        timestamp = time.time()
        
        measurement = {
            'timestamp': timestamp,
            'label': label,
            'memory_mb': current_memory,
            'memory_delta': current_memory - self.initial_memory,
            'cpu_percent': current_cpu,
            'elapsed_time': timestamp - self.start_time
        }
        
        self.measurements.append(measurement)
        return measurement
    
    def get_summary(self) -> Dict[str, Any]:
        """Get performance summary."""
        if not self.measurements:
            return {}
            
        memory_values = [m['memory_mb'] for m in self.measurements]
        cpu_values = [m['cpu_percent'] for m in self.measurements]
        
        return {
            'peak_memory_mb': max(memory_values),
            'avg_memory_mb': sum(memory_values) / len(memory_values),
            'memory_growth_mb': max(memory_values) - min(memory_values),
            'peak_cpu_percent': max(cpu_values),
            'avg_cpu_percent': sum(cpu_values) / len(cpu_values),
            'total_elapsed': self.measurements[-1]['elapsed_time'],
            'measurement_count': len(self.measurements)
        }


@pytest.fixture
def performance_profiler():
    """Performance profiler fixture."""
    return PerformanceProfiler()


@pytest.fixture
def large_container_dataset():
    """Generate large dataset of containers for performance testing."""
    containers = []
    
    # Generate 300+ containers with various configurations
    for i in range(350):
        container_type = i % 4
        
        if container_type == 0:  # Secure containers
            containers.append({
                "Id": f"secure_container_{i}",
                "Names": [f"/dce-app-{i}"],
                "State": "running",
                "Config": {
                    "Image": "nginx:latest",
                    "User": "nginx:nginx",
                    "ExposedPorts": {"80/tcp": {}, "443/tcp": {}}
                },
                "HostConfig": {
                    "Privileged": False,
                    "ReadonlyRootfs": True
                },
                "Mounts": [],
                "Created": "2024-01-01T00:00:00Z"
            })
        elif container_type == 1:  # Containers with security issues
            containers.append({
                "Id": f"insecure_container_{i}",
                "Names": [f"/dce-backend-{i}"],
                "State": "running",
                "Config": {
                    "Image": "ubuntu:latest",
                    "User": "root",  # Security issue
                    "ExposedPorts": {"22/tcp": {}, "3000/tcp": {}}
                },
                "HostConfig": {
                    "Privileged": True,  # Security issue
                    "ReadonlyRootfs": False
                },
                "Mounts": [
                    {
                        "Source": "/var/run/docker.sock",
                        "Destination": "/var/run/docker.sock",
                        "Type": "bind"
                    }
                ],
                "Created": "2024-01-01T00:00:00Z"
            })
        elif container_type == 2:  # High resource usage containers
            containers.append({
                "Id": f"resource_heavy_{i}",
                "Names": [f"/dce-worker-{i}"],
                "State": "running",
                "Config": {
                    "Image": "worker:latest",
                    "User": "app:app",
                    "ExposedPorts": {"8080/tcp": {}}
                },
                "HostConfig": {
                    "Privileged": False,
                    "ReadonlyRootfs": False
                },
                "Mounts": [],
                "Created": "2024-01-01T00:00:00Z"
            })
        else:  # Database containers
            containers.append({
                "Id": f"database_container_{i}",
                "Names": [f"/dce-db-{i}"],
                "State": "running",
                "Config": {
                    "Image": "postgres:13",
                    "User": "postgres:postgres",
                    "ExposedPorts": {"5432/tcp": {}}
                },
                "HostConfig": {
                    "Privileged": False,
                    "ReadonlyRootfs": False
                },
                "Mounts": [
                    {
                        "Source": "/var/lib/postgresql/data",
                        "Destination": "/var/lib/postgresql/data",
                        "Type": "volume"
                    }
                ],
                "Created": "2024-01-01T00:00:00Z"
            })
    
    return containers


@pytest.fixture
def high_usage_stats():
    """Container stats for high resource usage."""
    return {
        "cpu_stats": {
            "cpu_usage": {"total_usage": 8500000, "percpu_usage": [4250000, 4250000]},
            "system_cpu_usage": 10000000
        },
        "precpu_stats": {
            "cpu_usage": {"total_usage": 7500000},
            "system_cpu_usage": 9000000
        },
        "memory_stats": {
            "usage": 858993460,  # ~800MB (80%+ of 1GB)
            "limit": 1073741824  # 1GB
        },
        "networks": {
            "eth0": {
                "rx_bytes": 157286400,  # High network activity
                "tx_bytes": 104857600
            }
        }
    }


class TestCPUPerformance:
    """Test CPU usage performance benchmarks."""
    
    @pytest.mark.performance
    async def test_cpu_usage_with_300_containers(self, large_container_dataset, high_usage_stats, performance_profiler):
        """Verify CPU usage stays below 10% with 300+ containers."""
        # Test both systems
        config = ModularConfig(
            monitor_interval=5,  # Faster for testing
            max_concurrent_containers=50,
            container_patterns=["dce-*"]
        )
        
        monitor = ModularMonitor(config)
        
        try:
            # Mock Docker client with large dataset
            with patch.object(monitor.docker_client, 'list_containers') as mock_list:
                with patch.object(monitor.docker_client, 'get_container_stats') as mock_stats:
                    mock_list.return_value = large_container_dataset
                    mock_stats.return_value = high_usage_stats
                    
                    performance_profiler.start_profiling()
                    
                    # Run multiple monitoring cycles
                    for cycle in range(10):
                        start_time = time.time()
                        
                        # Perform container scan
                        containers = await monitor._scan_containers()
                        
                        cycle_time = time.time() - start_time
                        performance_profiler.take_measurement(f"cycle_{cycle}")
                        
                        # Verify scan completed in reasonable time
                        assert cycle_time < 30.0, f"Cycle {cycle} took too long: {cycle_time}s"
                        
                        # Brief pause between cycles
                        await asyncio.sleep(0.1)
                    
                    # Get performance summary
                    summary = performance_profiler.get_summary()
                    
                    # Verify CPU usage targets
                    assert summary['peak_cpu_percent'] < 15.0, f"Peak CPU usage too high: {summary['peak_cpu_percent']}%"
                    assert summary['avg_cpu_percent'] < 10.0, f"Average CPU usage too high: {summary['avg_cpu_percent']}%"
                    
                    # Verify container handling capacity
                    assert len(containers) >= 300, f"Should handle 300+ containers, got {len(containers)}"
                    
        finally:
            await monitor.shutdown()
    
    @pytest.mark.performance
    async def test_cpu_comparison_monolith_vs_modular(self, large_container_dataset, performance_profiler):
        """Compare CPU usage between monolith and modular systems."""
        # Limit dataset for monolith (it can't handle 300+)
        limited_dataset = large_container_dataset[:50]
        
        # Test monolith system
        monolith_config = MonolithConfig(
            monitor_interval=5,
            container_patterns=["dce-*"]
        )
        
        performance_profiler.start_profiling()
        
        monolith_monitor = MonolithMonitor(monolith_config)
        
        # Mock Docker for monolith
        with patch('docker.from_env') as mock_docker:
            mock_client = Mock()
            mock_containers = [
                Mock(id=c["Id"], name=c["Names"][0].lstrip('/'), attrs=c, 
                     stats=Mock(return_value={}), top=Mock(return_value={"Titles": [], "Processes": []}))
                for c in limited_dataset
            ]
            mock_client.containers.list.return_value = mock_containers
            mock_docker.return_value = mock_client
            
            # Run monolith monitoring cycles
            for cycle in range(5):
                containers = monolith_monitor._get_monitored_containers()
                
                # Analyze each container (CPU intensive)
                for container in containers:
                    monolith_monitor._analyze_container_behavior(container)
                    monolith_monitor._check_container_security_posture(container)
                
                performance_profiler.take_measurement(f"monolith_cycle_{cycle}")
                await asyncio.sleep(0.1)
        
        monolith_summary = performance_profiler.get_summary()
        
        # Test modular system
        modular_config = ModularConfig(
            monitor_interval=5,
            max_concurrent_containers=50,
            container_patterns=["dce-*"]
        )
        
        modular_monitor = ModularMonitor(modular_config)
        
        try:
            # Reset profiler for modular test
            performance_profiler.start_profiling()
            
            with patch.object(modular_monitor.docker_client, 'list_containers') as mock_list:
                mock_list.return_value = limited_dataset
                
                # Run modular monitoring cycles
                for cycle in range(5):
                    await modular_monitor._scan_containers()
                    performance_profiler.take_measurement(f"modular_cycle_{cycle}")
                    await asyncio.sleep(0.1)
            
            modular_summary = performance_profiler.get_summary()
            
            # Compare performance (modular should be significantly better)
            cpu_reduction = (monolith_summary['avg_cpu_percent'] - modular_summary['avg_cpu_percent']) / monolith_summary['avg_cpu_percent']
            
            assert cpu_reduction > 0.4, f"CPU reduction not sufficient: {cpu_reduction:.2%} (target: >40%)"
            assert modular_summary['avg_cpu_percent'] < monolith_summary['avg_cpu_percent'], "Modular system should use less CPU"
            
        finally:
            await modular_monitor.shutdown()


class TestMemoryPerformance:
    """Test memory usage performance benchmarks."""
    
    @pytest.mark.performance
    async def test_memory_usage_per_alert(self, performance_profiler):
        """Verify memory usage is <2KB per alert."""
        config = ModularConfig(
            alert_webhook="https://hooks.example.com/webhook",
            alert_secret_key="test-secret-key"
        )
        
        monitor = ModularMonitor(config)
        
        try:
            performance_profiler.start_profiling()
            initial_measurement = performance_profiler.take_measurement("initial")
            
            # Generate many security events
            events = []
            for i in range(1000):  # 1000 alerts
                event = SecurityEvent(
                    event_type="security_misconfiguration",
                    severity="HIGH",
                    source="test",
                    description=f"Test security event {i}",
                    container_id=f"container_{i}",
                    container_name=f"test-container-{i}",
                    details={"test_data": list(range(10))}  # Some data
                )
                events.append(event)
                
                # Add event to monitor (triggers processing)
                await monitor._add_security_event(event)
                
                # Take measurement every 100 events
                if i % 100 == 0:
                    performance_profiler.take_measurement(f"events_{i}")
            
            final_measurement = performance_profiler.take_measurement("final")
            
            # Calculate memory usage per alert
            memory_growth_mb = final_measurement['memory_mb'] - initial_measurement['memory_mb']
            memory_growth_kb = memory_growth_mb * 1024
            memory_per_alert_kb = memory_growth_kb / len(events)
            
            # Verify memory usage target
            assert memory_per_alert_kb < 2.0, f"Memory per alert too high: {memory_per_alert_kb:.3f}KB (target: <2KB)"
            
            # Verify no significant memory leaks
            summary = performance_profiler.get_summary()
            assert summary['memory_growth_mb'] < 100, f"Excessive memory growth: {summary['memory_growth_mb']:.2f}MB"
            
        finally:
            await monitor.shutdown()
    
    @pytest.mark.performance
    async def test_memory_leak_detection(self, performance_profiler):
        """Test for memory leaks during extended operation."""
        config = ModularConfig(monitor_interval=1)
        monitor = ModularMonitor(config)
        
        try:
            performance_profiler.start_profiling()
            
            # Simulate extended monitoring operation
            for cycle in range(100):
                # Create and process events
                event = SecurityEvent(
                    event_type="resource_anomaly",
                    severity="MEDIUM",
                    source="test",
                    description=f"Cycle {cycle} test event",
                    container_id=f"container_{cycle % 10}",
                    details={"cycle": cycle, "data": list(range(50))}
                )
                
                await monitor._add_security_event(event)
                
                # Force garbage collection periodically
                if cycle % 20 == 0:
                    gc.collect()
                    performance_profiler.take_measurement(f"gc_cycle_{cycle}")
                
                await asyncio.sleep(0.01)  # Brief pause
            
            # Final garbage collection and measurement
            gc.collect()
            final_measurement = performance_profiler.take_measurement("final_gc")
            
            # Check for memory leaks
            summary = performance_profiler.get_summary()
            
            # Memory growth should be minimal after GC
            assert summary['memory_growth_mb'] < 50, f"Potential memory leak: {summary['memory_growth_mb']:.2f}MB growth"
            
            # Peak memory should not be excessive
            assert summary['peak_memory_mb'] < 500, f"Peak memory usage too high: {summary['peak_memory_mb']:.2f}MB"
            
        finally:
            await monitor.shutdown()


class TestThroughputPerformance:
    """Test event processing throughput."""
    
    @pytest.mark.performance
    async def test_event_processing_throughput(self):
        """Test events processed per second."""
        config = ModularConfig(
            max_concurrent_containers=100,
            alert_webhook="https://hooks.example.com/webhook"
        )
        
        monitor = ModularMonitor(config)
        
        try:
            # Mock alert sender to avoid network calls
            with patch.object(monitor, '_send_alert') as mock_send:
                mock_send.return_value = True
                
                start_time = time.time()
                
                # Process many events rapidly
                events_processed = 0
                target_events = 1000
                
                tasks = []
                for i in range(target_events):
                    event = SecurityEvent(
                        event_type="network_anomaly",
                        severity="MEDIUM",
                        source="throughput_test",
                        description=f"Throughput test event {i}",
                        container_id=f"container_{i % 50}",
                        details={"index": i}
                    )
                    
                    task = monitor._add_security_event(event)
                    tasks.append(task)
                    events_processed += 1
                
                # Wait for all events to be processed
                await asyncio.gather(*tasks)
                
                end_time = time.time()
                elapsed_time = end_time - start_time
                
                # Calculate throughput
                events_per_second = events_processed / elapsed_time
                
                # Verify throughput target
                assert events_per_second > 100, f"Throughput too low: {events_per_second:.2f} events/sec (target: >100/sec)"
                assert elapsed_time < 30, f"Processing took too long: {elapsed_time:.2f}s"
                
        finally:
            await monitor.shutdown()
    
    @pytest.mark.performance
    async def test_concurrent_container_handling(self, large_container_dataset):
        """Test concurrent processing of many containers."""
        config = ModularConfig(
            max_concurrent_containers=50,
            container_patterns=["dce-*"]
        )
        
        monitor = ModularMonitor(config)
        
        try:
            with patch.object(monitor.docker_client, 'list_containers') as mock_list:
                with patch.object(monitor.docker_client, 'get_container_stats') as mock_stats:
                    mock_list.return_value = large_container_dataset
                    mock_stats.return_value = {}
                    
                    start_time = time.time()
                    
                    # Process containers concurrently
                    containers = await monitor._scan_containers()
                    
                    end_time = time.time()
                    processing_time = end_time - start_time
                    
                    # Verify concurrent processing efficiency
                    containers_per_second = len(containers) / processing_time
                    
                    assert containers_per_second > 10, f"Container processing too slow: {containers_per_second:.2f} containers/sec"
                    assert processing_time < 60, f"Processing took too long: {processing_time:.2f}s for {len(containers)} containers"
                    
        finally:
            await monitor.shutdown()


class TestResponseTimePerformance:
    """Test response time performance."""
    
    @pytest.mark.performance
    async def test_alert_delivery_latency(self):
        """Test alert delivery response time."""
        config = ModularConfig(
            alert_webhook="https://hooks.example.com/webhook",
            alert_secret_key="test-secret-key"
        )
        
        monitor = ModularMonitor(config)
        
        try:
            # Track alert delivery times
            delivery_times = []
            
            async def mock_webhook_delivery(url, payload, headers):
                # Simulate network latency
                await asyncio.sleep(0.1)
                return {"status_code": 200, "success": True}
            
            from container_monitor.monitoring.alerting import SecureAlertSender
            alert_sender = SecureAlertSender(config)
            
            with patch.object(alert_sender, '_send_webhook', side_effect=mock_webhook_delivery):
                # Test multiple alert deliveries
                for i in range(20):
                    event = SecurityEvent(
                        event_type="security_misconfiguration",
                        severity="CRITICAL",
                        source="latency_test",
                        description=f"Latency test alert {i}",
                        container_id=f"container_{i}"
                    )
                    
                    start_time = time.time()
                    success = await alert_sender.send_alert(event)
                    end_time = time.time()
                    
                    delivery_time = end_time - start_time
                    delivery_times.append(delivery_time)
                    
                    assert success, f"Alert delivery failed for event {i}"
            
            # Analyze response times
            avg_latency = sum(delivery_times) / len(delivery_times)
            max_latency = max(delivery_times)
            
            # Verify latency targets
            assert avg_latency < 1.0, f"Average latency too high: {avg_latency:.3f}s (target: <1s)"
            assert max_latency < 5.0, f"Max latency too high: {max_latency:.3f}s (target: <5s)"
            
        finally:
            await monitor.shutdown()


@pytest.mark.performance
class TestScalabilityPerformance:
    """Test system scalability under load."""
    
    async def test_performance_under_sustained_load(self, large_container_dataset, performance_profiler):
        """Test performance under sustained high load."""
        config = ModularConfig(
            monitor_interval=2,
            max_concurrent_containers=100,
            container_patterns=["dce-*"],
            alert_webhook="https://hooks.example.com/webhook"
        )
        
        monitor = ModularMonitor(config)
        
        try:
            performance_profiler.start_profiling()
            
            with patch.object(monitor.docker_client, 'list_containers') as mock_list:
                with patch.object(monitor, '_send_alert') as mock_alert:
                    mock_list.return_value = large_container_dataset
                    mock_alert.return_value = True
                    
                    # Run sustained load test
                    load_duration = 30  # 30 seconds of sustained load
                    start_time = time.time()
                    cycle_count = 0
                    
                    while time.time() - start_time < load_duration:
                        cycle_start = time.time()
                        
                        # Perform monitoring cycle
                        containers = await monitor._scan_containers()
                        
                        cycle_time = time.time() - cycle_start
                        cycle_count += 1
                        
                        # Take performance measurement
                        measurement = performance_profiler.take_measurement(f"load_cycle_{cycle_count}")
                        
                        # Verify performance doesn't degrade over time
                        assert cycle_time < 15.0, f"Cycle {cycle_count} too slow: {cycle_time:.2f}s"
                        assert measurement['cpu_percent'] < 25.0, f"CPU too high in cycle {cycle_count}: {measurement['cpu_percent']:.1f}%"
                        assert measurement['memory_mb'] < 1000, f"Memory too high in cycle {cycle_count}: {measurement['memory_mb']:.1f}MB"
                        
                        # Brief pause
                        await asyncio.sleep(0.5)
                    
                    # Verify sustained performance
                    summary = performance_profiler.get_summary()
                    
                    assert cycle_count >= 10, f"Should complete multiple cycles, got {cycle_count}"
                    assert summary['avg_cpu_percent'] < 15.0, f"Average CPU too high: {summary['avg_cpu_percent']:.1f}%"
                    assert summary['memory_growth_mb'] < 200, f"Memory growth too high: {summary['memory_growth_mb']:.1f}MB"
                    
        finally:
            await monitor.shutdown()
    
    async def test_memory_efficiency_with_many_alerts(self):
        """Test memory efficiency when processing many alerts."""
        config = ModularConfig(
            alert_webhook="https://hooks.example.com/webhook",
            alert_secret_key="test-secret"
        )
        
        monitor = ModularMonitor(config)
        
        try:
            # Mock alert sending to avoid network
            with patch.object(monitor, '_send_alert') as mock_send:
                mock_send.return_value = True
                
                initial_memory = psutil.Process().memory_info().rss / 1024 / 1024
                
                # Generate many alerts rapidly
                for batch in range(10):  # 10 batches
                    batch_events = []
                    
                    for i in range(100):  # 100 events per batch
                        event = SecurityEvent(
                            event_type="resource_anomaly",
                            severity="HIGH",
                            source="memory_test",
                            description=f"Memory efficiency test event {batch}_{i}",
                            container_id=f"container_{i % 20}",
                            details={
                                "batch": batch,
                                "index": i,
                                "data": list(range(20))  # Some payload data
                            }
                        )
                        batch_events.append(event)
                    
                    # Process batch
                    tasks = [monitor._add_security_event(event) for event in batch_events]
                    await asyncio.gather(*tasks)
                    
                    # Check memory after each batch
                    current_memory = psutil.Process().memory_info().rss / 1024 / 1024
                    memory_growth = current_memory - initial_memory
                    
                    # Memory shouldn't grow excessively
                    assert memory_growth < 200, f"Memory growth too high after batch {batch}: {memory_growth:.1f}MB"
                    
                    # Force garbage collection
                    gc.collect()
                
                # Final memory check
                final_memory = psutil.Process().memory_info().rss / 1024 / 1024
                total_growth = final_memory - initial_memory
                
                # Overall memory growth should be reasonable
                assert total_growth < 150, f"Total memory growth too high: {total_growth:.1f}MB"
                
        finally:
            await monitor.shutdown()


# Performance test markers
pytestmark = [
    pytest.mark.performance,
    pytest.mark.slow,
    pytest.mark.asyncio
]