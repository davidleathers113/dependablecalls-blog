"""
Tests for AsyncDockerClient adapter.

Tests async Docker operations, circuit breaker, and fallback mechanisms.
Uses mock_docker_client fixture from conftest.py.
"""

import pytest
import pytest_asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
import asyncio
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor
from docker.errors import DockerException, NotFound, APIError

from container_monitor.adapters.docker_async import AsyncDockerClient, CircuitBreaker
from container_monitor.models.config import MonitorConfig


class TestCircuitBreaker:
    """Test circuit breaker functionality."""
    
    def test_initial_state_closed(self):
        """Test circuit breaker starts in CLOSED state."""
        breaker = CircuitBreaker()
        assert breaker.state == "CLOSED"
        assert breaker.can_execute() is True
        assert breaker.failure_count == 0
    
    def test_record_success_resets_failures(self):
        """Test recording success resets failure count."""
        breaker = CircuitBreaker()
        breaker.failure_count = 3
        breaker.state = "HALF_OPEN"
        
        breaker.record_success()
        
        assert breaker.failure_count == 0
        assert breaker.state == "CLOSED"
    
    def test_record_failure_increments_count(self):
        """Test recording failure increments count."""
        breaker = CircuitBreaker()
        initial_count = breaker.failure_count
        
        breaker.record_failure()
        
        assert breaker.failure_count == initial_count + 1
        assert breaker.last_failure_time is not None
    
    def test_circuit_opens_after_threshold(self):
        """Test circuit opens after failure threshold."""
        breaker = CircuitBreaker(failure_threshold=3)
        
        # Record failures up to threshold
        for _ in range(3):
            breaker.record_failure()
            
        assert breaker.state == "OPEN"
        assert breaker.can_execute() is False
    
    def test_circuit_recovery_after_timeout(self):
        """Test circuit recovery after timeout."""
        breaker = CircuitBreaker(failure_threshold=2, recovery_timeout=1)
        
        # Open the circuit
        breaker.record_failure()
        breaker.record_failure()
        assert breaker.state == "OPEN"
        
        # Mock time passage
        past_time = datetime.now() - timedelta(seconds=2)
        breaker.last_failure_time = past_time
        
        # Should allow execution in HALF_OPEN state
        assert breaker.can_execute() is True
        assert breaker.state == "HALF_OPEN"


class TestAsyncDockerClientInitialization:
    """Test AsyncDockerClient initialization."""
    
    def test_client_creation_with_config(self, test_config):
        """Test client creation with configuration."""
        client = AsyncDockerClient(test_config)
        
        assert client.config == test_config
        assert client.circuit_breaker is not None
        assert client._async_client is None
        assert client._sync_client is None
        assert client._executor is None
    
    @pytest.mark.asyncio
    async def test_initialize_sync_mode(self, test_config):
        """Test initialization in sync mode."""
        # Mock aiodocker as unavailable
        with patch('container_monitor.adapters.docker_async.AIODOCKER_AVAILABLE', False):
            with patch('docker.from_env') as mock_docker:
                mock_docker.return_value = Mock()
                
                client = AsyncDockerClient(test_config)
                await client.initialize()
                
                assert client.mode == "sync"
                assert client._sync_client is not None
                assert client._executor is not None
                mock_docker.assert_called_once()
                
                await client.close()
    
    @pytest.mark.asyncio 
    async def test_initialize_async_mode(self, test_config):
        """Test initialization in async mode."""
        # Mock aiodocker as available
        with patch('container_monitor.adapters.docker_async.AIODOCKER_AVAILABLE', True):
            with patch('container_monitor.adapters.docker_async.aiodocker') as mock_aiodocker:
                mock_client = AsyncMock()
                mock_aiodocker.Docker.return_value = mock_client
                
                client = AsyncDockerClient(test_config)
                await client.initialize()
                
                assert client.mode == "async"
                assert client._async_client == mock_client
                mock_aiodocker.Docker.assert_called_once()
                
                await client.close()
    
    @pytest.mark.asyncio
    async def test_context_manager(self, test_config):
        """Test async context manager behavior."""
        with patch('container_monitor.adapters.docker_async.AIODOCKER_AVAILABLE', False):
            with patch('docker.from_env') as mock_docker:
                mock_docker.return_value = Mock()
                
                async with AsyncDockerClient(test_config) as client:
                    assert client._sync_client is not None
                    
                # Should have called close
                assert client._executor is None or client._executor._shutdown
    
    @pytest.mark.asyncio
    async def test_initialization_failure(self, test_config):
        """Test handling of initialization failure."""
        with patch('docker.from_env', side_effect=DockerException("Connection failed")):
            client = AsyncDockerClient(test_config)
            
            with pytest.raises(DockerException):
                await client.initialize()


class TestAsyncDockerClientOperations:
    """Test AsyncDockerClient container operations."""
    
    @pytest_asyncio.fixture
    async def initialized_client(self, test_config):
        """Provide initialized client."""
        with patch('container_monitor.adapters.docker_async.AIODOCKER_AVAILABLE', False):
            with patch('docker.from_env') as mock_docker:
                mock_docker.return_value = Mock()
                
                client = AsyncDockerClient(test_config)
                await client.initialize()
                yield client
                await client.close()
    
    @pytest.mark.asyncio
    async def test_list_containers_sync_mode(self, initialized_client):
        """Test listing containers in sync mode."""
        # Mock sync containers
        mock_container = Mock()
        mock_container.attrs = {
            "Id": "abc123",
            "Name": "/test-container",
            "State": {"Status": "running"}
        }
        
        with patch.object(initialized_client, '_run_sync') as mock_run_sync:
            mock_run_sync.return_value = [mock_container]
            
            containers = await initialized_client.list_containers()
            
            assert len(containers) == 1
            assert containers[0]["Id"] == "abc123"
            mock_run_sync.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_list_containers_async_mode(self, test_config):
        """Test listing containers in async mode."""
        with patch('container_monitor.adapters.docker_async.AIODOCKER_AVAILABLE', True):
            with patch('container_monitor.adapters.docker_async.aiodocker') as mock_aiodocker:
                # Mock aiodocker setup
                mock_container = AsyncMock()
                mock_container.show.return_value = {
                    "Id": "abc123",
                    "Name": "/test-container"
                }
                
                mock_client = AsyncMock()
                mock_client.containers.list.return_value = [mock_container]
                mock_aiodocker.Docker.return_value = mock_client
                
                client = AsyncDockerClient(test_config)
                await client.initialize()
                
                try:
                    containers = await client.list_containers()
                    
                    assert len(containers) == 1
                    assert containers[0]["Id"] == "abc123"
                    mock_client.containers.list.assert_called_once()
                    mock_container.show.assert_called_once()
                finally:
                    await client.close()
    
    @pytest.mark.asyncio
    async def test_get_container_stats_sync_mode(self, initialized_client):
        """Test getting container stats in sync mode."""
        mock_container = Mock()
        mock_stats = {
            "cpu_stats": {"cpu_usage": {"total_usage": 1000000}},
            "memory_stats": {"usage": 104857600}
        }
        
        with patch.object(initialized_client, '_run_sync') as mock_run_sync:
            mock_run_sync.side_effect = [mock_container, mock_stats]
            
            stats = await initialized_client.get_container_stats("abc123")
            
            assert stats == mock_stats
            assert mock_run_sync.call_count == 2
    
    @pytest.mark.asyncio
    async def test_get_container_processes_sync_mode(self, initialized_client):
        """Test getting container processes in sync mode."""
        mock_container = Mock()
        mock_processes = {
            "Titles": ["PID", "CMD"],
            "Processes": [["1", "nginx"]]
        }
        
        with patch.object(initialized_client, '_run_sync') as mock_run_sync:
            mock_run_sync.side_effect = [mock_container, mock_processes]
            
            processes = await initialized_client.get_container_processes("abc123")
            
            assert processes == mock_processes
            assert mock_run_sync.call_count == 2
    
    @pytest.mark.asyncio
    async def test_execute_command_sync_mode(self, initialized_client):
        """Test executing command in container."""
        mock_container = Mock()
        mock_result = Mock()
        mock_result.output.decode.return_value = "command output"
        
        with patch.object(initialized_client, '_run_sync') as mock_run_sync:
            mock_run_sync.side_effect = [mock_container, "command output"]
            
            result = await initialized_client.execute_command("abc123", ["echo", "test"])
            
            assert result == "command output"
            assert mock_run_sync.call_count == 2
    
    @pytest.mark.asyncio
    async def test_run_sync_executor(self, initialized_client):
        """Test _run_sync uses ThreadPoolExecutor correctly."""
        def sync_function():
            return "sync result"
        
        # Mock the executor
        mock_executor = Mock(spec=ThreadPoolExecutor)
        initialized_client._executor = mock_executor
        
        with patch('asyncio.get_event_loop') as mock_loop:
            mock_event_loop = Mock()
            mock_event_loop.run_in_executor.return_value = asyncio.Future()
            mock_event_loop.run_in_executor.return_value.set_result("sync result")
            mock_loop.return_value = mock_event_loop
            
            result = await initialized_client._run_sync(sync_function)
            
            assert result == "sync result"
            mock_event_loop.run_in_executor.assert_called_once_with(mock_executor, sync_function)


class TestAsyncDockerClientCircuitBreaker:
    """Test circuit breaker integration with AsyncDockerClient."""
    
    @pytest_asyncio.fixture
    async def client_with_breaker(self, test_config):
        """Client with circuit breaker for testing."""
        with patch('container_monitor.adapters.docker_async.AIODOCKER_AVAILABLE', False):
            with patch('docker.from_env') as mock_docker:
                mock_docker.return_value = Mock()
                
                client = AsyncDockerClient(test_config)
                client.circuit_breaker = CircuitBreaker(failure_threshold=2)
                await client.initialize()
                yield client
                await client.close()
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_blocks_when_open(self, client_with_breaker):
        """Test circuit breaker blocks operations when open."""
        # Open the circuit breaker
        client_with_breaker.circuit_breaker.state = "OPEN"
        
        # Should return empty list instead of calling Docker
        containers = await client_with_breaker.list_containers()
        assert containers == []
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_blocks_stats_when_open(self, client_with_breaker):
        """Test circuit breaker blocks stats when open."""
        # Open the circuit breaker
        client_with_breaker.circuit_breaker.state = "OPEN"
        
        # Should raise exception
        with pytest.raises(DockerException, match="Circuit breaker open"):
            await client_with_breaker.get_container_stats("abc123")
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_records_success(self, client_with_breaker):
        """Test circuit breaker records successful operations."""
        with patch.object(client_with_breaker, '_run_sync') as mock_run_sync:
            mock_run_sync.return_value = []
            
            await client_with_breaker.list_containers()
            
            # Should record success
            assert client_with_breaker.circuit_breaker.failure_count == 0
            assert client_with_breaker.circuit_breaker.state == "CLOSED"
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_records_failure(self, client_with_breaker):
        """Test circuit breaker records failed operations."""
        with patch.object(client_with_breaker, '_run_sync') as mock_run_sync:
            mock_run_sync.side_effect = DockerException("Connection failed")
            
            with pytest.raises(DockerException):
                await client_with_breaker.list_containers()
            
            # Should record failure
            assert client_with_breaker.circuit_breaker.failure_count == 1
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_opens_after_failures(self, client_with_breaker):
        """Test circuit breaker opens after threshold failures."""
        with patch.object(client_with_breaker, '_run_sync') as mock_run_sync:
            mock_run_sync.side_effect = DockerException("Connection failed")
            
            # Trigger failures to reach threshold
            for _ in range(2):
                with pytest.raises(DockerException):
                    await client_with_breaker.list_containers()
            
            # Circuit should be open
            assert client_with_breaker.circuit_breaker.state == "OPEN"
            
            # Next call should return empty without calling Docker
            containers = await client_with_breaker.list_containers()
            assert containers == []


class TestAsyncDockerClientErrorHandling:
    """Test error handling in AsyncDockerClient."""
    
    @pytest_asyncio.fixture
    async def error_test_client(self, test_config):
        """Client for error testing."""
        with patch('container_monitor.adapters.docker_async.AIODOCKER_AVAILABLE', False):
            with patch('docker.from_env') as mock_docker:
                mock_docker.return_value = Mock()
                
                client = AsyncDockerClient(test_config)
                await client.initialize()
                yield client
                await client.close()
    
    @pytest.mark.asyncio
    async def test_docker_exception_handling(self, error_test_client):
        """Test handling of Docker exceptions."""
        with patch.object(error_test_client, '_run_sync') as mock_run_sync:
            mock_run_sync.side_effect = DockerException("Docker daemon not running")
            
            with pytest.raises(DockerException):
                await error_test_client.list_containers()
    
    @pytest.mark.asyncio
    async def test_container_not_found_error(self, error_test_client):
        """Test handling of container not found errors."""
        with patch.object(error_test_client, '_run_sync') as mock_run_sync:
            mock_run_sync.side_effect = NotFound("No such container")
            
            with pytest.raises(NotFound):
                await error_test_client.get_container_stats("nonexistent")
    
    @pytest.mark.asyncio
    async def test_api_error_handling(self, error_test_client):
        """Test handling of API errors."""
        with patch.object(error_test_client, '_run_sync') as mock_run_sync:
            mock_run_sync.side_effect = APIError("Server Error")
            
            with pytest.raises(APIError):
                await error_test_client.get_container_processes("abc123")
    
    @pytest.mark.asyncio
    async def test_generic_exception_handling(self, error_test_client):
        """Test handling of generic exceptions."""
        with patch.object(error_test_client, '_run_sync') as mock_run_sync:
            mock_run_sync.side_effect = Exception("Unexpected error")
            
            with pytest.raises(Exception):
                await error_test_client.execute_command("abc123", ["ls"])


class TestAsyncDockerClientInfo:
    """Test client information and status methods."""
    
    def test_get_client_info_sync_mode(self, test_config):
        """Test getting client info in sync mode."""
        with patch('container_monitor.adapters.docker_async.AIODOCKER_AVAILABLE', False):
            client = AsyncDockerClient(test_config)
            
            info = client.get_client_info()
            
            assert info["mode"] == "sync"
            assert info["circuit_breaker_state"] == "CLOSED"
            assert info["failure_count"] == 0
            assert info["aiodocker_available"] is False
    
    def test_get_client_info_async_mode(self, test_config):
        """Test getting client info in async mode."""
        with patch('container_monitor.adapters.docker_async.AIODOCKER_AVAILABLE', True):
            client = AsyncDockerClient(test_config)
            
            info = client.get_client_info()
            
            assert info["mode"] == "async"
            assert info["aiodocker_available"] is True
    
    def test_get_client_info_with_failures(self, test_config):
        """Test getting client info after failures."""
        client = AsyncDockerClient(test_config)
        client.circuit_breaker.failure_count = 3
        client.circuit_breaker.state = "OPEN"
        
        info = client.get_client_info()
        
        assert info["circuit_breaker_state"] == "OPEN"
        assert info["failure_count"] == 3


class TestAsyncDockerClientResourceManagement:
    """Test resource management and cleanup."""
    
    @pytest.mark.asyncio
    async def test_close_async_client(self, test_config):
        """Test closing async client."""
        with patch('container_monitor.adapters.docker_async.AIODOCKER_AVAILABLE', True):
            with patch('container_monitor.adapters.docker_async.aiodocker') as mock_aiodocker:
                mock_client = AsyncMock()
                mock_aiodocker.Docker.return_value = mock_client
                
                client = AsyncDockerClient(test_config)
                await client.initialize()
                await client.close()
                
                mock_client.close.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_close_sync_client_with_executor(self, test_config):
        """Test closing sync client with executor."""
        with patch('container_monitor.adapters.docker_async.AIODOCKER_AVAILABLE', False):
            with patch('docker.from_env') as mock_docker:
                mock_docker.return_value = Mock()
                
                client = AsyncDockerClient(test_config)
                await client.initialize()
                
                # Mock the executor
                mock_executor = Mock(spec=ThreadPoolExecutor)
                client._executor = mock_executor
                
                await client.close()
                
                mock_executor.shutdown.assert_called_once_with(wait=True)
    
    @pytest.mark.asyncio
    async def test_multiple_close_calls(self, test_config):
        """Test multiple close calls don't cause errors."""
        with patch('container_monitor.adapters.docker_async.AIODOCKER_AVAILABLE', False):
            with patch('docker.from_env') as mock_docker:
                mock_docker.return_value = Mock()
                
                client = AsyncDockerClient(test_config)
                await client.initialize()
                
                # Multiple close calls should not raise
                await client.close()
                await client.close()
                await client.close()


class TestAsyncDockerClientConcurrency:
    """Test concurrent operations with AsyncDockerClient."""
    
    @pytest_asyncio.fixture
    async def concurrent_client(self, test_config):
        """Client for concurrency testing."""
        with patch('container_monitor.adapters.docker_async.AIODOCKER_AVAILABLE', False):
            with patch('docker.from_env') as mock_docker:
                mock_docker.return_value = Mock()
                
                client = AsyncDockerClient(test_config)
                await client.initialize()
                yield client
                await client.close()
    
    @pytest.mark.asyncio
    async def test_concurrent_list_containers(self, concurrent_client):
        """Test concurrent container listing."""
        with patch.object(concurrent_client, '_run_sync') as mock_run_sync:
            mock_run_sync.return_value = [{"Id": "abc123"}]
            
            # Run multiple concurrent operations
            tasks = []
            for _ in range(10):
                task = concurrent_client.list_containers()
                tasks.append(task)
            
            results = await asyncio.gather(*tasks)
            
            # All should succeed
            assert all(len(result) == 1 for result in results)
            assert all(result[0]["Id"] == "abc123" for result in results)
    
    @pytest.mark.asyncio
    async def test_concurrent_mixed_operations(self, concurrent_client):
        """Test concurrent mixed operations."""
        with patch.object(concurrent_client, '_run_sync') as mock_run_sync:
            # Different return values for different operations
            def side_effect(func):
                if 'list' in str(func):
                    return [{"Id": "abc123"}]
                elif 'stats' in str(func):
                    return {"cpu_stats": {}}
                else:
                    return {"Processes": []}
            
            mock_run_sync.side_effect = side_effect
            
            # Mix of different operations
            tasks = [
                concurrent_client.list_containers(),
                concurrent_client.get_container_stats("abc123"),
                concurrent_client.get_container_processes("abc123"),
                concurrent_client.list_containers(),
            ]
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # All should complete without exceptions
            exceptions = [r for r in results if isinstance(r, Exception)]
            assert len(exceptions) == 0