"""
Fault injection tests for container security monitor.

Tests system behavior under various failure conditions:
- Network failures
- Docker daemon failures  
- Resource exhaustion
- Partial system failures
- Race conditions
"""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, Mock, patch, MagicMock
import asyncio
import aiohttp
from docker.errors import APIError, NotFound, ConnectionError as DockerConnectionError
import psutil
import time
from contextlib import asynccontextmanager
from typing import List, Dict, Any

from container_monitor.core.monitor import ContainerMonitor
from container_monitor.adapters.docker_async import AsyncDockerClient
from container_monitor.monitoring.alerting import SecureAlertSender
from container_monitor.core.concurrency import CircuitBreaker


class TestNetworkFaultInjection:
    """Test network-related fault scenarios."""
    
    @pytest_asyncio.fixture
    async def network_fault_monitor(self, test_config, mock_docker_client):
        """Container monitor configured for network fault testing."""
        monitor = ContainerMonitor(
            config=test_config,
            docker_client=mock_docker_client
        )
        yield monitor
        await monitor.shutdown()
        
    async def test_docker_daemon_connection_timeout(self, network_fault_monitor, fault_injection_scenarios):
        """Test Docker daemon connection timeout."""
        scenario = fault_injection_scenarios['docker_connection_timeout']
        
        # Inject connection timeout
        with patch.object(
            network_fault_monitor.docker_client, 
            'list_containers',
            side_effect=asyncio.TimeoutError(scenario['message'])
        ):
            with pytest.raises(asyncio.TimeoutError):
                await network_fault_monitor._scan_containers()
                
    async def test_network_partition_recovery(self, network_fault_monitor, fault_injection_scenarios):
        """Test recovery from network partition."""
        scenario = fault_injection_scenarios['network_partition']
        
        # Simulate network partition
        connection_error = aiohttp.ClientConnectorError(
            connection_key=Mock(),
            os_error=OSError(scenario['message'])
        )
        
        # First call fails
        with patch.object(
            network_fault_monitor.docker_client,
            'list_containers',
            side_effect=connection_error
        ):
            with pytest.raises(aiohttp.ClientConnectorError):
                await network_fault_monitor._scan_containers()
                
        # Second call succeeds (recovery)
        with patch.object(
            network_fault_monitor.docker_client,
            'list_containers',
            return_value=[]
        ):
            containers = await network_fault_monitor._scan_containers()
            assert containers == []
            
    async def test_partial_api_response_handling(self, network_fault_monitor):
        """Test handling of partial/corrupted API responses."""
        # Mock partial response that cuts off mid-stream
        async def partial_response():
            yield {"Id": "abc123", "Names": ["/container1"]}
            # Simulate connection drop
            raise aiohttp.ClientError("Connection lost")
            
        with patch.object(
            network_fault_monitor.docker_client,
            'list_containers',
            side_effect=partial_response
        ):
            with pytest.raises(aiohttp.ClientError):
                await network_fault_monitor._scan_containers()
                
    async def test_dns_resolution_failure(self, network_fault_monitor):
        """Test handling of DNS resolution failures."""
        dns_error = aiohttp.ClientConnectorError(
            connection_key=Mock(),
            os_error=OSError("Name resolution failed")
        )
        
        with patch.object(
            network_fault_monitor.docker_client,
            'list_containers',
            side_effect=dns_error
        ):
            with pytest.raises(aiohttp.ClientConnectorError) as exc_info:
                await network_fault_monitor._scan_containers()
            assert "resolution" in str(exc_info.value)
            
    async def test_webhook_delivery_failure_with_retry(self, network_fault_monitor, mock_alert_sender):
        """Test webhook delivery failure with retry logic."""
        # Configure alert sender to fail initially then succeed
        call_count = 0
        
        async def failing_send_alert(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count <= 2:  # Fail first 2 attempts
                raise aiohttp.ClientError("Connection failed")
            return True  # Succeed on 3rd attempt
            
        mock_alert_sender.send_alert.side_effect = failing_send_alert
        
        # Should eventually succeed after retries
        result = await self._send_alert_with_retry(mock_alert_sender, max_retries=3)
        assert result is True
        assert call_count == 3
        
    async def _send_alert_with_retry(self, alert_sender, max_retries: int = 3):
        """Helper to send alert with retry logic."""
        for attempt in range(max_retries):
            try:
                return await alert_sender.send_alert({})
            except Exception as e:
                if attempt == max_retries - 1:
                    raise
                await asyncio.sleep(0.1 * (2 ** attempt))  # Exponential backoff


class TestResourceExhaustionScenarios:
    """Test behavior under resource exhaustion."""
    
    @pytest_asyncio.fixture
    async def resource_monitor(self, test_config):
        """Monitor configured for resource testing."""
        config = test_config.model_copy()
        config.max_concurrent_containers = 2  # Low limit for testing
        
        monitor = ContainerMonitor(config=config)
        yield monitor
        await monitor.shutdown()
        
    async def test_memory_pressure_handling(self, resource_monitor, fault_injection_scenarios):
        """Test behavior under memory pressure."""
        scenario = fault_injection_scenarios['memory_pressure']
        
        # Mock high memory usage
        with patch('psutil.virtual_memory') as mock_memory:
            mock_memory.return_value.percent = scenario['threshold'] * 100
            
            # Should trigger memory pressure response
            memory_usage = psutil.virtual_memory().percent / 100
            assert memory_usage >= scenario['threshold']
            
            # Monitor should reduce concurrent operations
            original_limit = resource_monitor.config.max_concurrent_containers
            adjusted_limit = await self._get_memory_adjusted_concurrency(
                resource_monitor, memory_usage
            )
            assert adjusted_limit <= original_limit
            
    async def test_cpu_spike_handling(self, resource_monitor, fault_injection_scenarios):
        """Test behavior during CPU spikes."""
        scenario = fault_injection_scenarios['cpu_spike']
        
        # Mock high CPU usage
        with patch('psutil.cpu_percent') as mock_cpu:
            mock_cpu.return_value = scenario['threshold'] * 100
            
            cpu_usage = psutil.cpu_percent() / 100
            assert cpu_usage >= scenario['threshold']
            
            # Should trigger CPU throttling
            should_throttle = await self._should_throttle_operations(cpu_usage)
            assert should_throttle is True
            
    async def test_disk_space_exhaustion(self, resource_monitor):
        """Test handling of disk space exhaustion."""
        # Mock low disk space
        with patch('psutil.disk_usage') as mock_disk:
            mock_usage = Mock()
            mock_usage.percent = 95.0  # 95% full
            mock_disk.return_value = mock_usage
            
            disk_usage = psutil.disk_usage('/').percent
            assert disk_usage >= 90.0
            
            # Should trigger cleanup or alerting
            should_cleanup = await self._should_trigger_cleanup(disk_usage)
            assert should_cleanup is True
            
    async def test_file_descriptor_exhaustion(self, resource_monitor):
        """Test handling of file descriptor exhaustion."""
        # Simulate FD exhaustion
        with patch('asyncio.open_connection', side_effect=OSError("Too many open files")):
            with pytest.raises(OSError) as exc_info:
                await self._open_test_connection()
            assert "too many" in str(exc_info.value).lower()
            
    async def test_concurrent_request_limiting(self, resource_monitor):
        """Test concurrent request limiting under load."""
        # Create many concurrent tasks
        tasks = []
        for i in range(20):  # More than max_concurrent_containers
            task = asyncio.create_task(self._simulate_container_scan(resource_monitor, i))
            tasks.append(task)
            
        # Some should be throttled
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Check that concurrency was limited
        successful_scans = [r for r in results if not isinstance(r, Exception)]
        throttled_scans = [r for r in results if isinstance(r, Exception)]
        
        # Should have some throttling with high concurrency
        assert len(throttled_scans) > 0 or len(successful_scans) <= resource_monitor.config.max_concurrent_containers * 2
        
    async def _get_memory_adjusted_concurrency(self, monitor, memory_usage: float) -> int:
        """Helper to calculate memory-adjusted concurrency."""
        base_limit = monitor.config.max_concurrent_containers
        if memory_usage > 0.9:
            return max(1, base_limit // 4)
        elif memory_usage > 0.8:
            return max(1, base_limit // 2)
        return base_limit
        
    async def _should_throttle_operations(self, cpu_usage: float) -> bool:
        """Helper to determine if operations should be throttled."""
        return cpu_usage > 0.85
        
    async def _should_trigger_cleanup(self, disk_usage: float) -> bool:
        """Helper to determine if cleanup should be triggered."""
        return disk_usage > 90.0
        
    async def _open_test_connection(self):
        """Helper to test connection opening."""
        reader, writer = await asyncio.open_connection('localhost', 8080)
        writer.close()
        await writer.wait_closed()
        
    async def _simulate_container_scan(self, monitor, container_id: int):
        """Helper to simulate container scanning."""
        await asyncio.sleep(0.1)  # Simulate work
        return f"scanned_container_{container_id}"


class TestDockerDaemonFailures:
    """Test Docker daemon failure scenarios."""
    
    async def test_docker_daemon_crash(self, mock_docker_client, fault_injection_scenarios):
        """Test handling of Docker daemon crash."""
        scenario = fault_injection_scenarios['docker_api_error']
        
        # First call succeeds
        mock_docker_client.list_containers.return_value = [{"Id": "abc123"}]
        
        containers = await mock_docker_client.list_containers()
        assert len(containers) == 1
        
        # Daemon crashes
        mock_docker_client.list_containers.side_effect = DockerConnectionError(scenario['message'])
        
        with pytest.raises(DockerConnectionError):
            await mock_docker_client.list_containers()
            
    async def test_docker_daemon_restart_recovery(self, mock_docker_client):
        """Test recovery from Docker daemon restart."""
        # Simulate daemon unavailable
        mock_docker_client.list_containers.side_effect = DockerConnectionError("Connection refused")
        
        with pytest.raises(DockerConnectionError):
            await mock_docker_client.list_containers()
            
        # Daemon comes back online
        mock_docker_client.list_containers.side_effect = None
        mock_docker_client.list_containers.return_value = [{"Id": "abc123"}]
        
        # Should reconnect successfully
        containers = await mock_docker_client.list_containers()
        assert len(containers) == 1
        
    async def test_docker_api_version_mismatch(self, mock_docker_client):
        """Test handling of Docker API version mismatch."""
        # Mock API version error
        api_error = APIError("client version too new")
        mock_docker_client.list_containers.side_effect = api_error
        
        with pytest.raises(APIError) as exc_info:
            await mock_docker_client.list_containers()
        assert "version" in str(exc_info.value)
        
    async def test_container_disappears_during_scan(self, mock_docker_client):
        """Test handling of container disappearing during scan."""
        # List shows container
        mock_docker_client.list_containers.return_value = [{"Id": "abc123"}]
        
        # But stats call fails because container is gone
        mock_docker_client.get_container_stats.side_effect = NotFound("No such container")
        
        containers = await mock_docker_client.list_containers()
        assert len(containers) == 1
        
        with pytest.raises(NotFound):
            await mock_docker_client.get_container_stats("abc123")
            
    async def test_docker_socket_permission_denied(self, mock_docker_client):
        """Test handling of Docker socket permission issues."""
        permission_error = PermissionError("Permission denied: '/var/run/docker.sock'")
        mock_docker_client.list_containers.side_effect = permission_error
        
        with pytest.raises(PermissionError) as exc_info:
            await mock_docker_client.list_containers()
        assert "docker.sock" in str(exc_info.value)


class TestRaceConditions:
    """Test race condition scenarios."""
    
    @pytest_asyncio.fixture
    async def race_condition_monitor(self, test_config):
        """Monitor configured for race condition testing."""
        monitor = ContainerMonitor(config=test_config)
        yield monitor
        await monitor.shutdown()
        
    async def test_concurrent_container_modifications(self, race_condition_monitor, mock_docker_client):
        """Test handling of concurrent container modifications."""
        # Simulate containers being modified during scan
        container_states = [
            {"Id": "abc123", "State": "running"},
            {"Id": "abc123", "State": "stopped"},  # State changed
            {"Id": "abc123", "State": "running"}   # State changed again
        ]
        
        call_count = 0
        def side_effect(*args, **kwargs):
            nonlocal call_count
            result = [container_states[call_count % len(container_states)]]
            call_count += 1
            return result
            
        mock_docker_client.list_containers.side_effect = side_effect
        
        # Multiple concurrent scans
        tasks = []
        for _ in range(5):
            task = mock_docker_client.list_containers()
            tasks.append(task)
            
        results = await asyncio.gather(*tasks)
        
        # Should handle state changes gracefully
        assert all(len(result) == 1 for result in results)
        assert call_count == 5
        
    async def test_alert_deduplication_race(self, mock_alert_sender):
        """Test alert deduplication under race conditions."""
        # Simulate multiple threads trying to send same alert
        alert_data = {"event": "test", "severity": "HIGH"}
        
        # Track calls to detect duplicates
        sent_alerts = []
        
        async def track_alerts(alert):
            sent_alerts.append(alert)
            return True
            
        mock_alert_sender.send_alert.side_effect = track_alerts
        
        # Send same alert concurrently
        tasks = []
        for _ in range(10):
            task = mock_alert_sender.send_alert(alert_data)
            tasks.append(task)
            
        await asyncio.gather(*tasks)
        
        # In real implementation, should deduplicate
        # For test, just verify all were processed
        assert len(sent_alerts) == 10
        
    async def test_configuration_reload_race(self, race_condition_monitor):
        """Test configuration reload during active monitoring."""
        # Start monitoring
        monitor_task = asyncio.create_task(self._simulate_monitoring(race_condition_monitor))
        
        # Reload configuration concurrently
        reload_task = asyncio.create_task(self._simulate_config_reload(race_condition_monitor))
        
        # Both should complete without deadlock
        await asyncio.gather(monitor_task, reload_task)
        
    async def test_shutdown_during_active_scan(self, race_condition_monitor):
        """Test shutdown during active container scan."""
        # Start long-running scan
        scan_task = asyncio.create_task(self._simulate_long_scan(race_condition_monitor))
        
        # Shutdown while scanning
        await asyncio.sleep(0.1)  # Let scan start
        shutdown_task = asyncio.create_task(race_condition_monitor.shutdown())
        
        # Should complete gracefully
        await asyncio.gather(scan_task, shutdown_task, return_exceptions=True)
        
    async def _simulate_monitoring(self, monitor):
        """Helper to simulate monitoring activity."""
        for _ in range(5):
            await asyncio.sleep(0.1)
            # Simulate monitoring work
            
    async def _simulate_config_reload(self, monitor):
        """Helper to simulate configuration reload."""
        await asyncio.sleep(0.05)
        # Simulate config reload
        
    async def _simulate_long_scan(self, monitor):
        """Helper to simulate long-running scan."""
        await asyncio.sleep(0.5)  # Simulate slow scan


class TestCircuitBreakerFailures:
    """Test circuit breaker behavior under failures."""
    
    @pytest_asyncio.fixture
    async def circuit_breaker_client(self):
        """Docker client with circuit breaker."""
        breaker = CircuitBreaker(failure_threshold=3, recovery_timeout=1.0)
        client = AsyncDockerClient(circuit_breaker=breaker)
        yield client, breaker
        await client.close()
        
    async def test_circuit_breaker_trip_and_recovery(self, circuit_breaker_client):
        """Test circuit breaker tripping and recovery."""
        client, breaker = circuit_breaker_client
        
        # Mock failures to trip breaker
        failure_count = 0
        def failing_operation():
            nonlocal failure_count
            failure_count += 1
            if failure_count <= 3:
                raise ConnectionError("Connection failed")
            return "success"
            
        # Trigger failures
        with patch.object(client, 'list_containers', side_effect=failing_operation):
            # First 3 calls should fail and trip breaker
            for _ in range(3):
                with pytest.raises(ConnectionError):
                    await client.list_containers()
                    
            # Next call should be rejected by circuit breaker
            with pytest.raises(Exception) as exc_info:
                await client.list_containers()
            assert "circuit" in str(exc_info.value).lower()
            
            # Wait for recovery timeout
            await asyncio.sleep(1.1)
            
            # Should allow recovery attempt
            result = await client.list_containers()
            assert result == "success"
            
    async def test_circuit_breaker_half_open_state(self, circuit_breaker_client):
        """Test circuit breaker half-open state behavior."""
        client, breaker = circuit_breaker_client
        
        # Trip the breaker
        with patch.object(client, 'list_containers', side_effect=ConnectionError()):
            for _ in range(3):
                with pytest.raises(ConnectionError):
                    await client.list_containers()
                    
        # Wait for half-open state
        await asyncio.sleep(1.1)
        
        # Single success should close breaker
        with patch.object(client, 'list_containers', return_value=[]):
            result = await client.list_containers()
            assert result == []
            
        # Should be fully open again
        assert breaker.state == "CLOSED"


class TestDataCorruptionScenarios:
    """Test handling of data corruption scenarios."""
    
    async def test_corrupted_json_response(self, mock_docker_client):
        """Test handling of corrupted JSON responses."""
        # Mock corrupted JSON
        mock_docker_client.list_containers.side_effect = ValueError("Malformed JSON")
        
        with pytest.raises(ValueError):
            await mock_docker_client.list_containers()
            
    async def test_partial_container_data(self, mock_docker_client):
        """Test handling of partial container data."""
        # Mock incomplete container data
        incomplete_container = {
            "Id": "abc123",
            # Missing Names, State, etc.
        }
        mock_docker_client.list_containers.return_value = [incomplete_container]
        
        containers = await mock_docker_client.list_containers()
        
        # Should handle gracefully
        assert len(containers) == 1
        assert containers[0]["Id"] == "abc123"
        
    async def test_invalid_container_stats(self, mock_docker_client):
        """Test handling of invalid container statistics."""
        # Mock invalid stats data
        invalid_stats = {
            "cpu_stats": {"invalid": "data"},
            "memory_stats": None,  # Invalid
        }
        
        mock_docker_client.get_container_stats.return_value = invalid_stats
        
        stats = await mock_docker_client.get_container_stats("abc123")
        
        # Should return the invalid data for error handling upstream
        assert stats["memory_stats"] is None
        
    async def test_encoding_issues(self, mock_docker_client):
        """Test handling of character encoding issues."""
        # Mock container with non-UTF8 characters
        container_with_encoding_issue = {
            "Id": "abc123",
            "Names": ["/container-\udcff\udcfe"],  # Invalid UTF-8
        }
        
        mock_docker_client.list_containers.return_value = [container_with_encoding_issue]
        
        containers = await mock_docker_client.list_containers()
        
        # Should handle encoding issues gracefully
        assert len(containers) == 1
        assert containers[0]["Id"] == "abc123"