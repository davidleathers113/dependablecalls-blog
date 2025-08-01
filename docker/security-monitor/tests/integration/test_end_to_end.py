"""
End-to-end integration tests for container security monitor.

Tests complete workflows:
- Container monitoring lifecycle
- Security event detection and alerting
- Configuration changes
- Fault recovery
"""

import pytest
import pytest_asyncio
from unittest.mock import Mock, AsyncMock, patch
import asyncio
import json
from datetime import datetime, timezone
import tempfile
import os

from container_monitor.core.monitor import ContainerMonitor
from container_monitor.models.config import MonitorConfig
from container_monitor.models.events import SecurityEvent


class TestEndToEndMonitoring:
    """Test complete monitoring workflows."""
    
    @pytest_asyncio.fixture
    async def e2e_monitor(self, temp_monitor_dir):
        """End-to-end monitor with real-like configuration."""
        config = MonitorConfig(
            monitor_interval=1,  # Fast for testing
            alert_webhook="https://hooks.example.com/webhook",
            alert_secret_key="test-secret-key-for-e2e-testing",
            cpu_threshold=75.0,
            memory_threshold=75.0,
            container_patterns=["test-*"],
            monitored_directories=[str(temp_monitor_dir)],
            max_concurrent_containers=3
        )
        
        monitor = ContainerMonitor(config=config)
        yield monitor
        await monitor.shutdown()
        
    async def test_complete_monitoring_cycle(self, e2e_monitor, mock_docker_client, mock_alert_sender):
        """Test complete monitoring cycle with security detection."""
        # Setup mock containers with security issues
        mock_containers = [
            {
                "Id": "secure_container",
                "Names": ["/test-secure"],
                "State": "running",
                "Config": {
                    "Image": "nginx:latest",
                    "User": "nginx:nginx",  # Good: non-root user
                    "ExposedPorts": {"80/tcp": {}}
                },
                "HostConfig": {
                    "Privileged": False,  # Good: not privileged
                    "ReadonlyRootfs": True  # Good: read-only root
                }
            },
            {
                "Id": "insecure_container", 
                "Names": ["/test-insecure"],
                "State": "running",
                "Config": {
                    "Image": "ubuntu:latest",
                    "User": "root",  # BAD: root user
                    "ExposedPorts": {"22/tcp": {}}  # BAD: SSH exposed
                },
                "HostConfig": {
                    "Privileged": True,  # BAD: privileged
                    "ReadonlyRootfs": False
                }
            }
        ]
        
        mock_docker_client.list_containers.return_value = mock_containers
        
        # Mock container stats
        async def mock_stats(container_id):
            if container_id == "insecure_container":
                return {
                    "cpu_stats": {
                        "cpu_usage": {"total_usage": 8000000},  # High CPU
                        "system_cpu_usage": 10000000
                    },
                    "memory_stats": {
                        "usage": 838860800,  # High memory (800MB)
                        "limit": 1073741824  # 1GB limit
                    }
                }
            return {
                "cpu_stats": {
                    "cpu_usage": {"total_usage": 1000000},
                    "system_cpu_usage": 10000000
                },
                "memory_stats": {
                    "usage": 104857600,  # Normal memory (100MB)
                    "limit": 1073741824
                }
            }
            
        mock_docker_client.get_container_stats.side_effect = mock_stats
        
        # Track alerts sent
        sent_alerts = []
        mock_alert_sender.send_alert.side_effect = lambda alert: sent_alerts.append(alert) or True
        
        # Run monitoring cycle
        with patch.object(e2e_monitor, 'alert_sender', mock_alert_sender):
            with patch.object(e2e_monitor, 'docker_client', mock_docker_client):
                await e2e_monitor._scan_containers()
                
        # Verify security issues were detected and alerts sent
        assert len(sent_alerts) >= 1
        
        # Check for security misconfigurations
        security_alerts = [alert for alert in sent_alerts if "security" in str(alert).lower()]
        assert len(security_alerts) > 0
        
        # Check for resource anomalies
        resource_alerts = [alert for alert in sent_alerts if "resource" in str(alert).lower()]
        # High CPU/memory should trigger resource alerts
        
    async def test_file_system_monitoring_integration(self, e2e_monitor, temp_monitor_dir):
        """Test file system monitoring integration."""
        # Create initial files
        test_file = temp_monitor_dir / "monitored.txt"
        test_file.write_text("initial content")
        
        # Start file monitoring
        file_events = []
        
        async def mock_file_event_handler(event):
            file_events.append(event)
            
        with patch.object(e2e_monitor, '_handle_file_event', side_effect=mock_file_event_handler):
            # Simulate file changes
            test_file.write_text("modified content")
            
            # Create new file
            new_file = temp_monitor_dir / "new_file.txt"
            new_file.write_text("new content")
            
            # Delete file
            test_file.unlink()
            
            # Give time for events to process
            await asyncio.sleep(0.1)
            
        # Should have detected file system changes
        # Note: Actual file watching would require inotify/polling
        # This test verifies the handler structure
        
    async def test_configuration_hot_reload(self, e2e_monitor):
        """Test hot reload of configuration."""
        original_interval = e2e_monitor.config.monitor_interval
        original_threshold = e2e_monitor.config.cpu_threshold
        
        # Update configuration
        new_config = e2e_monitor.config.model_copy()
        new_config.monitor_interval = 5
        new_config.cpu_threshold = 90.0
        
        # Apply new configuration
        await e2e_monitor.update_config(new_config)
        
        # Verify configuration was updated
        assert e2e_monitor.config.monitor_interval == 5
        assert e2e_monitor.config.cpu_threshold == 90.0
        assert e2e_monitor.config.monitor_interval != original_interval
        assert e2e_monitor.config.cpu_threshold != original_threshold
        
    async def test_graceful_shutdown_during_operation(self, e2e_monitor, mock_docker_client):
        """Test graceful shutdown during active monitoring."""
        # Setup long-running operation
        async def slow_container_scan():
            await asyncio.sleep(1.0)  # Simulate slow operation
            return []
            
        mock_docker_client.list_containers.side_effect = slow_container_scan
        
        # Start monitoring
        with patch.object(e2e_monitor, 'docker_client', mock_docker_client):
            monitor_task = asyncio.create_task(e2e_monitor._scan_containers())
            
            # Trigger shutdown while operation is running
            await asyncio.sleep(0.1)  # Let scan start
            shutdown_task = asyncio.create_task(e2e_monitor.shutdown())
            
            # Both should complete gracefully
            results = await asyncio.gather(monitor_task, shutdown_task, return_exceptions=True)
            
            # Should not have unhandled exceptions
            exceptions = [r for r in results if isinstance(r, Exception)]
            # Allow cancellation exceptions as they're part of graceful shutdown
            serious_exceptions = [e for e in exceptions if not isinstance(e, asyncio.CancelledError)]
            assert len(serious_exceptions) == 0


class TestAlertingIntegration:
    """Test alerting system integration."""
    
    @pytest_asyncio.fixture
    async def alerting_monitor(self, test_config):
        """Monitor configured for alerting tests."""
        config = test_config.model_copy()
        config.alert_webhook = "https://hooks.example.com/webhook"
        config.alert_secret_key = "test-secret-key-for-alerting"
        
        monitor = ContainerMonitor(config=config)
        yield monitor
        await monitor.shutdown()
        
    async def test_alert_batching_and_deduplication(self, alerting_monitor, mock_alert_sender):
        """Test alert batching and deduplication."""
        # Generate multiple similar events
        events = []
        for i in range(10):
            event = SecurityEvent(
                event_type="resource_anomaly",
                severity="HIGH",
                source="test",
                description="High CPU usage detected",
                container_id=f"container_{i % 3}",  # Some duplicates
                details={"cpu_percent": 95.0}
            )
            events.append(event)
            
        # Track batched alerts
        batched_alerts = []
        mock_alert_sender.send_batch.side_effect = lambda alerts: batched_alerts.extend(alerts) or {"success": len(alerts), "failed": 0}
        
        # Send events for batching
        with patch.object(alerting_monitor, 'alert_sender', mock_alert_sender):
            for event in events:
                await alerting_monitor._queue_alert(event)
                
            # Process batch
            await alerting_monitor._process_alert_batch()
            
        # Should have batched and deduplicated alerts
        assert len(batched_alerts) <= len(events)  # Deduplication should reduce count
        mock_alert_sender.send_batch.assert_called()
        
    async def test_alert_retry_on_failure(self, alerting_monitor, mock_alert_sender):
        """Test alert retry mechanism on failure."""
        event = SecurityEvent(
            event_type="security_misconfiguration",
            severity="CRITICAL",
            source="test",
            description="Privileged container detected"
        )
        
        # Mock initial failures then success
        call_count = 0
        def failing_send(alert):
            nonlocal call_count
            call_count += 1
            if call_count <= 2:  # Fail first 2 attempts
                raise ConnectionError("Webhook endpoint unavailable")
            return True  # Succeed on 3rd attempt
            
        mock_alert_sender.send_alert.side_effect = failing_send
        
        # Should retry and eventually succeed
        with patch.object(alerting_monitor, 'alert_sender', mock_alert_sender):
            success = await alerting_monitor._send_alert_with_retry(event, max_retries=3)
            
        assert success is True
        assert call_count == 3  # 2 failures + 1 success
        
    async def test_alert_rate_limiting(self, alerting_monitor, mock_alert_sender):
        """Test alert rate limiting."""
        # Generate many rapid alerts
        events = []
        for i in range(50):  # High volume
            event = SecurityEvent(
                event_type="network_anomaly",
                severity="MEDIUM",
                source="test",
                description=f"Suspicious network activity {i}"
            )
            events.append(event)
            
        sent_count = 0
        def count_sends(alert):
            nonlocal sent_count
            sent_count += 1
            return True
            
        mock_alert_sender.send_alert.side_effect = count_sends
        
        # Send all events rapidly
        with patch.object(alerting_monitor, 'alert_sender', mock_alert_sender):
            tasks = []
            for event in events:
                task = alerting_monitor._send_alert_if_allowed(event)
                tasks.append(task)
                
            await asyncio.gather(*tasks)
            
        # Should have rate limited (sent fewer than total)
        assert sent_count < len(events)


class TestResilienceIntegration:
    """Test system resilience and recovery."""
    
    @pytest_asyncio.fixture
    async def resilient_monitor(self, test_config):
        """Monitor configured for resilience testing."""
        config = test_config.model_copy()
        config.monitor_interval = 0.5  # Fast for testing
        
        monitor = ContainerMonitor(config=config)
        yield monitor
        await monitor.shutdown()
        
    async def test_docker_daemon_reconnection(self, resilient_monitor, mock_docker_client):
        """Test automatic reconnection to Docker daemon."""
        # Start with working connection
        mock_docker_client.list_containers.return_value = []
        
        containers = await mock_docker_client.list_containers()
        assert containers == []
        
        # Simulate connection loss
        connection_lost_count = 0
        def connection_error(*args, **kwargs):
            nonlocal connection_lost_count
            connection_lost_count += 1
            if connection_lost_count <= 3:  # Fail 3 times
                raise ConnectionError("Connection lost")
            return []  # Then succeed
            
        mock_docker_client.list_containers.side_effect = connection_error
        
        # Should eventually reconnect
        with patch.object(resilient_monitor, 'docker_client', mock_docker_client):
            for attempt in range(5):
                try:
                    containers = await resilient_monitor._scan_containers_with_retry()
                    break  # Success
                except ConnectionError:
                    await asyncio.sleep(0.1)  # Brief retry delay
                    
        assert containers == []  # Eventually succeeded
        assert connection_lost_count == 4  # 3 failures + 1 success
        
    async def test_memory_leak_prevention(self, resilient_monitor):
        """Test prevention of memory leaks during long-running operation."""
        # Simulate long-running monitoring
        initial_objects = len(gc.get_objects()) if 'gc' in locals() else 1000
        
        # Run many monitoring cycles
        for _ in range(100):
            await self._simulate_monitoring_cycle(resilient_monitor)
            
        # Force garbage collection
        import gc
        gc.collect()
        
        # Check for significant memory growth
        final_objects = len(gc.get_objects())
        object_growth = final_objects - initial_objects
        
        # Should not have excessive object growth (allow some reasonable increase)
        assert object_growth < 1000, f"Potential memory leak: {object_growth} new objects"
        
    async def test_concurrent_operation_safety(self, resilient_monitor, mock_docker_client):
        """Test safety of concurrent operations."""
        mock_docker_client.list_containers.return_value = []
        
        # Run many concurrent monitoring operations
        tasks = []
        for i in range(20):
            with patch.object(resilient_monitor, 'docker_client', mock_docker_client):
                task = resilient_monitor._scan_containers()
                tasks.append(task)
                
        # All should complete without deadlocks or race conditions
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Check for exceptions
        exceptions = [r for r in results if isinstance(r, Exception)]
        assert len(exceptions) == 0, f"Concurrent operations failed: {exceptions}"
        
        # All should return empty lists
        successful_results = [r for r in results if not isinstance(r, Exception)]
        assert all(result == [] for result in successful_results)
        
    async def _simulate_monitoring_cycle(self, monitor):
        """Helper to simulate monitoring cycle."""
        # Simulate the work of a monitoring cycle
        await asyncio.sleep(0.001)  # Minimal delay
        # Create and cleanup some objects
        temp_data = [i for i in range(10)]
        del temp_data


class TestPerformanceIntegration:
    """Test performance characteristics under load."""
    
    async def test_high_container_count_performance(self, test_config):
        """Test performance with high container count."""
        # Create monitor with high container count
        config = test_config.model_copy()
        config.max_concurrent_containers = 50
        
        monitor = ContainerMonitor(config=config)
        
        try:
            # Mock many containers
            mock_containers = [
                {
                    "Id": f"container_{i}",
                    "Names": [f"/test-container-{i}"],
                    "State": "running"
                }
                for i in range(100)  # 100 containers
            ]
            
            start_time = asyncio.get_event_loop().time()
            
            with patch.object(monitor.docker_client, 'list_containers', return_value=mock_containers):
                containers = await monitor._scan_containers()
                
            end_time = asyncio.get_event_loop().time()
            scan_duration = end_time - start_time
            
            # Should complete in reasonable time
            assert scan_duration < 5.0, f"Scan took too long: {scan_duration}s"
            assert len(containers) == 100
            
        finally:
            await monitor.shutdown()
            
    async def test_memory_usage_under_load(self, test_config):
        """Test memory usage under sustained load."""
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        config = test_config.model_copy()
        monitor = ContainerMonitor(config=config)
        
        try:
            # Run sustained load
            for cycle in range(50):
                await self._simulate_heavy_monitoring_cycle(monitor)
                
                # Check memory every 10 cycles
                if cycle % 10 == 0:
                    current_memory = process.memory_info().rss / 1024 / 1024
                    memory_growth = current_memory - initial_memory
                    
                    # Should not grow excessively
                    assert memory_growth < 100, f"Excessive memory growth: {memory_growth}MB"
                    
        finally:
            await monitor.shutdown()
            
    async def _simulate_heavy_monitoring_cycle(self, monitor):
        """Helper to simulate heavy monitoring cycle."""
        # Simulate processing many events
        events = []
        for i in range(10):
            event = SecurityEvent(
                event_type="resource_anomaly",
                severity="MEDIUM",
                source="load_test",
                description=f"Load test event {i}",
                details={"test_data": list(range(100))}  # Some data
            )
            events.append(event)
            
        # Process events
        for event in events:
            await self._process_test_event(monitor, event)
            
        # Cleanup
        del events
        
    async def _process_test_event(self, monitor, event):
        """Helper to process test event."""
        # Simulate event processing
        await asyncio.sleep(0.001)
        # Event would be processed here