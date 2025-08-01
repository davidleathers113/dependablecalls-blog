"""
Tests for async Docker client integration.

Validates:
- Async Docker operations
- Connection handling
- Error recovery
- Resource management
"""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, Mock, patch
from contextlib import asynccontextmanager
import asyncio
import aiohttp
from docker.errors import APIError, NotFound

from container_monitor.adapters.docker_async import AsyncDockerClient
from container_monitor.core.concurrency import CircuitBreaker


class TestAsyncDockerClient:
    """Test async Docker client operations."""
    
    @pytest_asyncio.fixture
    async def mock_docker_session(self):
        """Mock aiohttp session for Docker API calls."""
        session = AsyncMock(spec=aiohttp.ClientSession)
        
        # Mock successful container list response  
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = [
            {
                "Id": "abc123",
                "Names": ["/test-container"],
                "State": "running",
                "Config": {"Image": "nginx:latest"}
            }
        ]
        session.get.return_value.__aenter__.return_value = mock_response
        
        return session
    
    @pytest_asyncio.fixture
    async def docker_client(self, mock_docker_session):
        """Create async Docker client with mocked session."""
        with patch('aiohttp.ClientSession', return_value=mock_docker_session):
            client = AsyncDockerClient()
            await client.initialize()
            yield client
            await client.close()
    
    async def test_client_initialization(self, docker_client):
        """Test client initialization and connection."""
        assert docker_client._session is not None
        assert docker_client._base_url is not None
        
    async def test_list_containers_success(self, docker_client, mock_docker_session):
        """Test successful container listing."""
        containers = await docker_client.list_containers()
        
        assert len(containers) == 1
        assert containers[0]["Names"] == ["/test-container"]
        mock_docker_session.get.assert_called_once()
        
    async def test_container_stats_streaming(self, docker_client, mock_docker_session):
        """Test container stats streaming."""
        # Mock streaming response
        mock_response = AsyncMock()
        mock_response.status = 200
        
        async def mock_iter_chunked(size):
            yield b'{"cpu_stats": {"cpu_usage": {"total_usage": 1000}}}\n'
            yield b'{"cpu_stats": {"cpu_usage": {"total_usage": 2000}}}\n'
            
        mock_response.content.iter_chunked = mock_iter_chunked
        mock_docker_session.get.return_value.__aenter__.return_value = mock_response
        
        stats_count = 0
        async for stats in docker_client.get_container_stats("abc123"):
            stats_count += 1
            assert "cpu_stats" in stats
            if stats_count >= 2:
                break
                
        assert stats_count == 2
        
    async def test_connection_error_handling(self, mock_docker_session):
        """Test handling of connection errors."""
        # Mock connection error
        mock_docker_session.get.side_effect = aiohttp.ClientConnectorError(
            connection_key=Mock(), os_error=Mock()
        )
        
        client = AsyncDockerClient()
        with patch('aiohttp.ClientSession', return_value=mock_docker_session):
            await client.initialize()
            
            with pytest.raises(ConnectionError):
                await client.list_containers()
                
    async def test_api_error_handling(self, docker_client, mock_docker_session):
        """Test handling of Docker API errors."""
        # Mock API error response
        mock_response = AsyncMock()
        mock_response.status = 500
        mock_response.text = AsyncMock(return_value="Internal Server Error")
        mock_docker_session.get.return_value.__aenter__.return_value = mock_response
        
        with pytest.raises(APIError):
            await docker_client.list_containers()
            
    async def test_timeout_handling(self, docker_client, mock_docker_session):
        """Test request timeout handling."""
        mock_docker_session.get.side_effect = asyncio.TimeoutError()
        
        with pytest.raises(asyncio.TimeoutError):
            await docker_client.list_containers()
            
    async def test_concurrent_requests(self, docker_client, mock_docker_session):
        """Test handling of concurrent requests."""
        # Create multiple concurrent requests
        tasks = []
        for i in range(10):
            task = docker_client.list_containers()
            tasks.append(task)
            
        results = await asyncio.gather(*tasks)
        
        assert len(results) == 10
        assert all(len(result) == 1 for result in results)
        
    async def test_resource_cleanup(self, mock_docker_session):
        """Test proper resource cleanup."""
        client = AsyncDockerClient()
        
        with patch('aiohttp.ClientSession', return_value=mock_docker_session):
            await client.initialize()
            assert client._session is not None
            
            await client.close()
            mock_docker_session.close.assert_called_once()


class TestDockerCircuitBreaker:
    """Test circuit breaker integration with Docker client."""
    
    @pytest_asyncio.fixture
    async def docker_client_with_breaker(self, mock_docker_session):
        """Docker client with circuit breaker."""
        with patch('aiohttp.ClientSession', return_value=mock_docker_session):
            client = AsyncDockerClient(circuit_breaker_threshold=3)
            await client.initialize()
            yield client
            await client.close()
            
    async def test_circuit_breaker_opens_on_failures(self, docker_client_with_breaker, mock_docker_session):
        """Test circuit breaker opens after consecutive failures."""
        # Mock consecutive failures
        mock_docker_session.get.side_effect = aiohttp.ClientError()
        
        # Trigger enough failures to open circuit breaker
        for _ in range(5):
            with pytest.raises((aiohttp.ClientError, Exception)):
                await docker_client_with_breaker.list_containers()
                
        # Next call should be rejected by circuit breaker
        with pytest.raises(Exception) as exc_info:
            await docker_client_with_breaker.list_containers()
        assert "circuit breaker" in str(exc_info.value).lower()
        
    async def test_circuit_breaker_recovery(self, docker_client_with_breaker, mock_docker_session):
        """Test circuit breaker recovery after successful calls."""
        # Start with failures
        mock_docker_session.get.side_effect = aiohttp.ClientError()
        
        # Trigger failures
        for _ in range(3):
            with pytest.raises(aiohttp.ClientError):
                await docker_client_with_breaker.list_containers()
                
        # Now mock success
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = []
        mock_docker_session.get.side_effect = None
        mock_docker_session.get.return_value.__aenter__.return_value = mock_response
        
        # Should recover
        result = await docker_client_with_breaker.list_containers()
        assert result == []


class TestDockerMonitoringIntegration:
    """Test Docker client integration with monitoring."""
    
    @pytest_asyncio.fixture
    async def monitoring_client(self, mock_docker_session, test_config):
        """Docker client configured for monitoring."""
        with patch('aiohttp.ClientSession', return_value=mock_docker_session):
            client = AsyncDockerClient(
                monitor_config=test_config,
                enable_monitoring=True
            )
            await client.initialize()
            yield client
            await client.close()
            
    async def test_container_monitoring_lifecycle(self, monitoring_client, mock_docker_session):
        """Test complete container monitoring lifecycle."""
        # Mock container data
        container_data = {
            "Id": "abc123",
            "Names": ["/test-container"],
            "State": "running",
            "Config": {
                "Image": "nginx:latest",
                "User": "root",  # Security issue
                "ExposedPorts": {"22/tcp": {}}  # SSH exposed
            },
            "HostConfig": {
                "Privileged": True  # Major security issue
            }
        }
        
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = [container_data]
        mock_docker_session.get.return_value.__aenter__.return_value = mock_response
        
        containers = await monitoring_client.list_containers()
        
        # Should detect security issues
        container = containers[0]
        assert container["Config"]["User"] == "root"
        assert container["HostConfig"]["Privileged"] is True
        assert "22/tcp" in container["Config"]["ExposedPorts"]
        
    async def test_performance_metrics_collection(self, monitoring_client, mock_docker_session):
        """Test collection of performance metrics."""
        # Mock stats response
        stats_data = {
            "cpu_stats": {
                "cpu_usage": {"total_usage": 1000000},
                "system_cpu_usage": 10000000
            },
            "memory_stats": {
                "usage": 104857600,
                "limit": 1073741824
            },
            "networks": {
                "eth0": {"rx_bytes": 1024, "tx_bytes": 2048}
            }
        }
        
        mock_response = AsyncMock()
        mock_response.status = 200
        
        async def mock_iter_chunked(size):
            import json
            yield json.dumps(stats_data).encode() + b'\n'
            
        mock_response.content.iter_chunked = mock_iter_chunked
        mock_docker_session.get.return_value.__aenter__.return_value = mock_response
        
        stats_collected = []
        async for stats in monitoring_client.get_container_stats("abc123"):
            stats_collected.append(stats)
            break  # Just collect one
            
        assert len(stats_collected) == 1
        assert stats_collected[0]["cpu_stats"]["cpu_usage"]["total_usage"] == 1000000
        
    async def test_batch_container_operations(self, monitoring_client, mock_docker_session):
        """Test batch operations on multiple containers."""
        # Mock multiple containers
        containers_data = [
            {"Id": f"container_{i}", "Names": [f"/test-{i}"], "State": "running"}
            for i in range(5)
        ]
        
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = containers_data
        mock_docker_session.get.return_value.__aenter__.return_value = mock_response
        
        containers = await monitoring_client.list_containers()
        
        # Test concurrent stats collection
        stats_tasks = []
        for container in containers:
            task = monitoring_client.get_container_stats(container["Id"])
            stats_tasks.append(task)
            
        # Should handle concurrent operations
        assert len(stats_tasks) == 5


@pytest.mark.asyncio
async def test_docker_client_context_manager():
    """Test Docker client as async context manager."""
    with patch('aiohttp.ClientSession') as mock_session_class:
        mock_session = AsyncMock()
        mock_session_class.return_value = mock_session
        
        async with AsyncDockerClient() as client:
            assert client._session is not None
            
        mock_session.close.assert_called_once()


@pytest.mark.asyncio  
async def test_docker_client_connection_pooling():
    """Test connection pooling and reuse."""
    with patch('aiohttp.ClientSession') as mock_session_class:
        mock_session = AsyncMock()
        mock_session_class.return_value = mock_session
        
        client = AsyncDockerClient(connection_pool_size=10)
        await client.initialize()
        
        # Verify session was created with proper connector
        mock_session_class.assert_called_once()
        call_kwargs = mock_session_class.call_args[1]
        assert 'connector' in call_kwargs
        
        await client.close()


class TestFaultInjection:
    """Test fault injection scenarios for Docker client."""
    
    @pytest_asyncio.fixture
    async def fault_injection_client(self, mock_docker_session):
        """Docker client for fault injection testing."""
        with patch('aiohttp.ClientSession', return_value=mock_docker_session):
            client = AsyncDockerClient()
            await client.initialize()
            yield client
            await client.close()
    
    async def test_network_partition_simulation(self, fault_injection_client, mock_docker_session, fault_injection_scenarios):
        """Simulate network partition."""
        scenario = fault_injection_scenarios['network_partition']
        
        # Simulate network error
        mock_docker_session.get.side_effect = aiohttp.ClientConnectorError(
            connection_key=Mock(), 
            os_error=OSError(scenario['message'])
        )
        
        with pytest.raises(ConnectionError) as exc_info:
            await fault_injection_client.list_containers()
        assert scenario['message'] in str(exc_info.value)
        
    async def test_docker_daemon_timeout(self, fault_injection_client, mock_docker_session, fault_injection_scenarios):
        """Simulate Docker daemon timeout."""
        scenario = fault_injection_scenarios['docker_connection_timeout']
        
        mock_docker_session.get.side_effect = asyncio.TimeoutError()
        
        with pytest.raises(asyncio.TimeoutError):
            await fault_injection_client.list_containers()
            
    async def test_partial_api_response(self, fault_injection_client, mock_docker_session):
        """Test handling of partial/corrupted API responses."""
        # Mock corrupted JSON response
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.side_effect = ValueError("Invalid JSON")
        mock_docker_session.get.return_value.__aenter__.return_value = mock_response
        
        with pytest.raises(ValueError):
            await fault_injection_client.list_containers()
            
    async def test_memory_pressure_handling(self, fault_injection_client, mock_docker_session):
        """Test behavior under memory pressure."""
        # Simulate memory error
        mock_docker_session.get.side_effect = MemoryError("Out of memory")
        
        with pytest.raises(MemoryError):
            await fault_injection_client.list_containers()