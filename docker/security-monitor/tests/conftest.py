"""
Pytest configuration and shared fixtures.

Provides:
- Async test support
- Mock Docker clients
- Security event factories
- Test configuration
"""

import asyncio
from typing import Generator, AsyncGenerator
from unittest.mock import Mock, AsyncMock, MagicMock
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from faker import Faker

from container_monitor.models.events import SecurityEvent
from container_monitor.models.config import MonitorConfig
from container_monitor.adapters.docker_async import AsyncDockerClient
from container_monitor.monitoring.alerting import SecureAlertSender

# Initialize Faker for test data
fake = Faker()


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def test_config() -> MonitorConfig:
    """Create test configuration."""
    return MonitorConfig(
        monitor_interval=5,
        alert_webhook="https://example.com/webhook",
        alert_secret_key="test-secret-key",
        cpu_threshold=75.0,
        memory_threshold=75.0,
        container_patterns=["test-*"],
        monitored_directories=["/tmp/test-monitor"],
        max_concurrent_containers=5
    )


@pytest.fixture
def security_event_factory():
    """Factory for creating test security events."""
    def create_event(**kwargs):
        defaults = {
            "event_type": "security_misconfiguration",
            "severity": "HIGH",
            "source": "test",
            "description": fake.sentence(),
            "container_id": fake.uuid4()[:12],
            "container_name": f"test-{fake.word()}",
            "details": {"test": True}
        }
        defaults.update(kwargs)
        return SecurityEvent(**defaults)
    
    return create_event


@pytest.fixture
def mock_docker_client():
    """Create mock Docker client."""
    client = Mock(spec=AsyncDockerClient)
    
    # Mock container data
    mock_containers = [
        {
            "Id": fake.uuid4()[:12],
            "Name": f"test-{fake.word()}",
            "State": {"Status": "running"},
            "Config": {
                "Image": "test:latest",
                "User": "",
                "ExposedPorts": {"80/tcp": {}}
            },
            "HostConfig": {
                "Privileged": False
            },
            "Mounts": []
        }
        for _ in range(3)
    ]
    
    # Mock methods
    async def mock_list_containers(*args, **kwargs):
        return mock_containers
    
    async def mock_get_stats(container_id):
        return {
            "cpu_stats": {
                "cpu_usage": {
                    "total_usage": 1000000,
                    "percpu_usage": [500000, 500000]
                },
                "system_cpu_usage": 10000000
            },
            "precpu_stats": {
                "cpu_usage": {"total_usage": 900000},
                "system_cpu_usage": 9000000
            },
            "memory_stats": {
                "usage": 104857600,  # 100MB
                "limit": 1073741824  # 1GB
            },
            "networks": {
                "eth0": {
                    "rx_bytes": 1024000,
                    "tx_bytes": 512000
                }
            }
        }
    
    async def mock_get_processes(container_id):
        return {
            "Titles": ["PID", "CMD"],
            "Processes": [
                ["1", "nginx"],
                ["2", "worker"]
            ]
        }
    
    client.list_containers = AsyncMock(side_effect=mock_list_containers)
    client.get_container_stats = AsyncMock(side_effect=mock_get_stats)
    client.get_container_processes = AsyncMock(side_effect=mock_get_processes)
    client.initialize = AsyncMock()
    client.close = AsyncMock()
    
    return client


@pytest_asyncio.fixture
async def mock_alert_sender(test_config):
    """Create mock alert sender."""
    sender = Mock(spec=SecureAlertSender)
    
    # Mock methods
    sender.send_alert = AsyncMock(return_value=True)
    sender.send_batch = AsyncMock(
        return_value={"success": 10, "failed": 0}
    )
    sender.get_stats = Mock(
        return_value={
            "alerts_sent": 100,
            "alerts_failed": 5,
            "success_rate": 0.95
        }
    )
    
    # Set config
    sender.config = test_config
    
    return sender


@pytest.fixture
def mock_container():
    """Create mock container object."""
    container = MagicMock()
    container.id = fake.uuid4()[:12]
    container.name = f"test-{fake.word()}"
    container.status = "running"
    container.attrs = {
        "Config": {
            "Image": "test:latest",
            "User": "",
            "ExposedPorts": {"80/tcp": {}}
        },
        "HostConfig": {
            "Privileged": False
        },
        "Created": datetime.now(timezone.utc).isoformat(),
        "Mounts": []
    }
    
    # Mock methods
    container.stats.return_value = {
        "cpu_stats": {
            "cpu_usage": {
                "total_usage": 1000000,
                "percpu_usage": [500000, 500000]
            },
            "system_cpu_usage": 10000000
        },
        "precpu_stats": {
            "cpu_usage": {"total_usage": 900000},
            "system_cpu_usage": 9000000
        },
        "memory_stats": {
            "usage": 104857600,
            "limit": 1073741824
        }
    }
    
    container.top.return_value = {
        "Titles": ["PID", "CMD"],
        "Processes": [["1", "nginx"]]
    }
    
    return container


@pytest.fixture
def temp_monitor_dir(tmp_path):
    """Create temporary directory for monitoring tests."""
    monitor_dir = tmp_path / "monitor-test"
    monitor_dir.mkdir()
    
    # Create some test files
    (monitor_dir / "test.txt").write_text("test content")
    
    # Create a subdirectory
    sub_dir = monitor_dir / "subdir"
    sub_dir.mkdir()
    (sub_dir / "nested.txt").write_text("nested content")
    
    return monitor_dir


@pytest.fixture
def mock_circuit_breaker():
    """Create mock circuit breaker."""
    breaker = Mock()
    breaker.can_execute.return_value = True
    breaker.record_success = Mock()
    breaker.record_failure = Mock()
    breaker.state = "CLOSED"
    return breaker


@pytest.fixture
def sample_webhook_payload():
    """Sample webhook payload for testing."""
    return {
        'event': 'container.start',
        'container_id': fake.uuid4()[:12],
        'container_name': f'test_{fake.word()}',
        'image': 'nginx:latest',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'metadata': {
            'ports': ['80:8080', '443:8443'],
            'environment': ['ENV=production']
        }
    }


@pytest.fixture
def mock_hmac_validator():
    """Mock HMAC validator for webhook security testing."""
    from unittest.mock import Mock
    validator = Mock()
    validator.validate_signature.return_value = True
    validator.generate_signature.return_value = 'sha256=abcdef123456'
    return validator


@pytest.fixture
def fault_injection_scenarios():
    """Predefined fault injection scenarios for testing."""
    return {
        'docker_connection_timeout': {
            'error': 'ConnectionTimeoutError',
            'message': 'Docker daemon connection timeout'
        },
        'docker_api_error': {
            'error': 'APIError',
            'message': 'Docker API returned error 500'
        },
        'container_not_found': {
            'error': 'NotFound',
            'message': 'Container not found'
        },
        'network_partition': {
            'error': 'NetworkError',
            'message': 'Network unreachable'
        },
        'memory_pressure': {
            'condition': 'high_memory_usage',
            'threshold': 0.95
        },
        'cpu_spike': {
            'condition': 'high_cpu_usage',
            'threshold': 0.90
        }
    }


@pytest.fixture
def mock_vulnerability_scanner():
    """Mock vulnerability scanner with predefined vulnerabilities."""
    scanner = Mock()
    
    # Mock vulnerability scan results
    scanner.scan_container.return_value = {
        'vulnerabilities': [
            {
                'id': 'CVE-2023-1234',
                'severity': 'HIGH',
                'package': 'openssl',
                'version': '1.1.1f',
                'fixed_version': '1.1.1g',
                'description': 'Buffer overflow in OpenSSL'
            },
            {
                'id': 'CVE-2023-5678',
                'severity': 'MEDIUM',
                'package': 'curl',
                'version': '7.68.0',
                'fixed_version': '7.69.0',
                'description': 'Information disclosure in libcurl'
            }
        ],
        'scan_time': datetime.now(timezone.utc).isoformat(),
        'total_vulnerabilities': 2,
        'critical': 0,
        'high': 1,
        'medium': 1,
        'low': 0
    }
    
    return scanner


@pytest.fixture
def secure_test_data():
    """Generate secure test data for various scenarios."""
    return {
        'valid_container_configs': [
            {
                'user': 'app:app',
                'privileged': False,
                'security_opt': ['no-new-privileges:true'],
                'read_only_root_fs': True
            }
        ],
        'insecure_container_configs': [
            {
                'user': 'root',
                'privileged': True,
                'security_opt': [],
                'read_only_root_fs': False
            }
        ],
        'test_secrets': {
            'webhook_secret': 'test-webhook-secret-key',
            'api_key': 'test-api-key-12345'
        }
    }


def generate_container_events(count: int = 5):
    """Generate test container events."""
    events = []
    for i in range(count):
        events.append({
            'event': f'container.{["start", "stop", "restart"][i % 3]}',
            'container_id': fake.uuid4()[:12],
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'metadata': {'index': i}
        })
    return events


def generate_vulnerability_data(severity_counts):
    """Generate vulnerability scan data."""
    vulnerabilities = []
    vuln_id = 1000
    
    for severity, count in severity_counts.items():
        for i in range(count):
            vulnerabilities.append({
                'id': f'CVE-2023-{vuln_id + i}',
                'severity': severity.upper(),
                'package': f'package_{i}',
                'version': f'1.{i}.0',
                'fixed_version': f'1.{i}.1'
            })
        vuln_id += count
    
    return {
        'vulnerabilities': vulnerabilities,
        'total_vulnerabilities': sum(severity_counts.values()),
        **{k.lower(): v for k, v in severity_counts.items()}
    }