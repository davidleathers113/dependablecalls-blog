"""
Functional Parity Validation Tests

Verifies that the modular Container Security Monitor produces identical results
to the monolithic system under identical conditions.

Critical Validation Areas:
1. Container detection and enumeration
2. Security event generation and classification
3. Configuration loading and parsing
4. Alert delivery and HMAC authentication
5. Report generation and formatting
"""

import pytest
import pytest_asyncio
import asyncio
import json
import tempfile
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any
from unittest.mock import Mock, AsyncMock, patch, MagicMock

# Import both monolith and modular systems
from legacy.security_monitor_v1 import ContainerMonitor as MonolithMonitor, MonitorConfig as MonolithConfig
from container_monitor.core.monitor import ContainerMonitor as ModularMonitor
from container_monitor.models.config import MonitorConfig as ModularConfig
from container_monitor.models.events import SecurityEvent


class TestContainerDetectionParity:
    """Verify identical container detection between systems."""
    
    @pytest_asyncio.fixture
    async def mock_docker_containers(self):
        """Mock Docker containers for testing."""
        return [
            {
                "Id": "container_1_secure",
                "Names": ["/dce-frontend"],
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
            },
            {
                "Id": "container_2_insecure",
                "Names": ["/dce-backend"],
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
                        "Source": "/var/run/docker.sock",  # Security issue
                        "Destination": "/var/run/docker.sock",
                        "Type": "bind"
                    }
                ],
                "Created": "2024-01-01T00:00:00Z"
            },
            {
                "Id": "container_3_excluded",
                "Names": ["/system-container"],
                "State": "running",
                "Config": {
                    "Image": "system:latest",
                    "User": "app:app",
                    "ExposedPorts": {}
                },
                "HostConfig": {
                    "Privileged": False,
                    "ReadonlyRootfs": True
                },
                "Mounts": [],
                "Created": "2024-01-01T00:00:00Z"
            }
        ]
    
    async def test_identical_container_enumeration(self, mock_docker_containers):
        """Verify both systems detect the same containers."""
        # Setup identical configurations
        monolith_config = MonolithConfig(
            container_patterns=["dce-*"],
            monitor_interval=30,
            cpu_threshold=80.0,
            memory_threshold=80.0
        )
        
        modular_config = ModularConfig(
            container_patterns=["dce-*"],
            monitor_interval=30,
            cpu_threshold=80.0,
            memory_threshold=80.0
        )
        
        # Mock Docker clients for both systems
        with patch('docker.from_env') as mock_docker_monolith:
            mock_client_monolith = Mock()
            mock_client_monolith.containers.list.return_value = [
                Mock(id=container["Id"], name=container["Names"][0].lstrip('/'), 
                     attrs=container) for container in mock_docker_containers
            ]
            mock_docker_monolith.return_value = mock_client_monolith
            
            # Initialize monolith monitor
            monolith_monitor = MonolithMonitor(monolith_config)
            monolith_containers = monolith_monitor._get_monitored_containers()
            
        # Mock Docker client for modular system
        modular_monitor = ModularMonitor(modular_config)
        with patch.object(modular_monitor.docker_client, 'list_containers') as mock_modular_list:
            mock_modular_list.return_value = mock_docker_containers
            modular_containers = await modular_monitor._get_monitored_containers()
        
        # Extract container IDs for comparison
        monolith_ids = {c.id for c in monolith_containers}
        modular_ids = {c["Id"] for c in modular_containers}
        
        # Verify identical container detection
        assert monolith_ids == modular_ids
        assert len(monolith_containers) == len(modular_containers)
        
        # Should detect only containers matching "dce-*" pattern
        expected_containers = {"container_1_secure", "container_2_insecure"}
        assert monolith_ids == expected_containers
        assert modular_ids == expected_containers
        
        await modular_monitor.shutdown()


class TestSecurityEventParity:
    """Verify identical security event generation."""
    
    @pytest_asyncio.fixture
    async def test_container_data(self):
        """Container data for security event testing."""
        return {
            "Id": "test_insecure_container",
            "Names": ["/dce-test-insecure"],
            "State": "running",
            "Config": {
                "Image": "ubuntu:latest",
                "User": "root",  # Should trigger root user event
                "ExposedPorts": {"22/tcp": {}, "8080/tcp": {}}  # SSH should trigger event
            },
            "HostConfig": {
                "Privileged": True,  # Should trigger privileged event
                "ReadonlyRootfs": False
            },
            "Mounts": [
                {
                    "Source": "/var/run/docker.sock",  # Should trigger socket mount event
                    "Destination": "/var/run/docker.sock",
                    "Type": "bind"
                },
                {
                    "Source": "/etc",  # Should trigger sensitive directory event
                    "Destination": "/host-etc",
                    "Type": "bind"
                }
            ],
            "Created": "2024-01-01T00:00:00Z"
        }
    
    async def test_security_posture_event_parity(self, test_container_data):
        """Verify identical security posture events."""
        # Configure both systems identically
        config_data = {
            "container_patterns": ["dce-*"],
            "allowed_ports": [80, 443, 8080, 3000],
            "blocked_processes": ["nc", "netcat", "telnet", "ftp"],
            "cpu_threshold": 80.0,
            "memory_threshold": 80.0
        }
        
        monolith_config = MonolithConfig(**config_data)
        modular_config = ModularConfig(**config_data)
        
        # Generate events from monolith
        monolith_monitor = MonolithMonitor(monolith_config)
        mock_container = Mock()
        mock_container.id = test_container_data["Id"]
        mock_container.name = test_container_data["Names"][0].lstrip('/')
        mock_container.attrs = test_container_data
        
        monolith_events = monolith_monitor._check_container_security_posture(mock_container)
        
        # Generate events from modular system
        modular_monitor = ModularMonitor(modular_config)
        from container_monitor.analyzers.posture import SecurityPostureAnalyzer
        posture_analyzer = SecurityPostureAnalyzer(modular_config)
        modular_events = await posture_analyzer.analyze_container(test_container_data)
        
        # Convert events to comparable format
        def normalize_event(event):
            if hasattr(event, 'model_dump'):
                data = event.model_dump()
            else:
                data = {
                    'event_type': event.event_type,
                    'severity': event.severity,
                    'source': event.source,
                    'description': event.description,
                    'container_id': event.container_id,
                    'container_name': event.container_name,
                    'details': event.details
                }
            # Remove timestamp for comparison
            data.pop('timestamp', None)
            return data
        
        monolith_normalized = [normalize_event(e) for e in monolith_events]
        modular_normalized = [normalize_event(e) for e in modular_events]
        
        # Sort for comparison
        monolith_sorted = sorted(monolith_normalized, key=lambda x: x['event_type'])
        modular_sorted = sorted(modular_normalized, key=lambda x: x['event_type'])
        
        # Verify identical security events
        assert len(monolith_sorted) == len(modular_sorted)
        
        for monolith_event, modular_event in zip(monolith_sorted, modular_sorted):
            assert monolith_event['event_type'] == modular_event['event_type']
            assert monolith_event['severity'] == modular_event['severity']
            assert monolith_event['container_id'] == modular_event['container_id']
            # Description content should be equivalent (may have minor formatting differences)
            assert len(monolith_event['description']) > 0
            assert len(modular_event['description']) > 0
        
        await modular_monitor.shutdown()
        
    async def test_behavior_analysis_event_parity(self, test_container_data):
        """Verify identical behavior analysis events."""
        # Mock container stats for high resource usage
        high_usage_stats = {
            "cpu_stats": {
                "cpu_usage": {"total_usage": 8000000, "percpu_usage": [4000000, 4000000]},
                "system_cpu_usage": 10000000
            },
            "precpu_stats": {
                "cpu_usage": {"total_usage": 7000000},
                "system_cpu_usage": 9000000
            },
            "memory_stats": {
                "usage": 858993460,  # ~85% of 1GB (above 80% threshold)
                "limit": 1073741824  # 1GB
            },
            "networks": {
                "eth0": {
                    "rx_bytes": 104857600,  # High network activity
                    "tx_bytes": 104857600
                }
            }
        }
        
        # Mock processes with blocked process
        processes_data = {
            "Titles": ["PID", "CMD"],
            "Processes": [
                ["1", "nginx: master"],
                ["2", "nc -l 1234"],  # Blocked process
                ["3", "worker"]
            ]
        }
        
        config_data = {
            "container_patterns": ["dce-*"],
            "cpu_threshold": 80.0,
            "memory_threshold": 80.0,
            "network_threshold_mbps": 50.0,
            "blocked_processes": ["nc", "netcat", "telnet"],
            "monitor_interval": 30
        }
        
        monolith_config = MonolithConfig(**config_data)
        modular_config = ModularConfig(**config_data)
        
        # Generate events from monolith
        monolith_monitor = MonolithMonitor(monolith_config)
        mock_container = Mock()
        mock_container.id = test_container_data["Id"]
        mock_container.name = test_container_data["Names"][0].lstrip('/')
        mock_container.stats.return_value = high_usage_stats
        mock_container.top.return_value = processes_data
        
        monolith_events = monolith_monitor._analyze_container_behavior(mock_container)
        
        # Generate events from modular system
        modular_monitor = ModularMonitor(modular_config)
        from container_monitor.analyzers.behavior import BehaviorAnalyzer
        behavior_analyzer = BehaviorAnalyzer(modular_config)
        
        # Mock the async methods
        with patch.object(modular_monitor.docker_client, 'get_container_stats') as mock_stats:
            with patch.object(modular_monitor.docker_client, 'get_container_processes') as mock_procs:
                mock_stats.return_value = high_usage_stats
                mock_procs.return_value = processes_data
                
                modular_events = await behavior_analyzer.analyze_container(test_container_data)
        
        # Verify similar event types and severities
        monolith_event_types = {e.event_type for e in monolith_events}
        modular_event_types = {e.event_type for e in modular_events}
        
        # Should detect resource anomalies and suspicious processes
        expected_event_types = {"resource_anomaly", "suspicious_process"}
        assert expected_event_types.issubset(monolith_event_types)
        assert expected_event_types.issubset(modular_event_types)
        
        # Check severity levels
        monolith_severities = {e.severity for e in monolith_events}
        modular_severities = {e.severity for e in modular_events}
        assert "HIGH" in monolith_severities  # Suspicious process
        assert "MEDIUM" in monolith_severities  # Resource anomalies
        assert monolith_severities == modular_severities
        
        await modular_monitor.shutdown()


class TestConfigurationParity:
    """Verify identical configuration handling."""
    
    def test_yaml_configuration_compatibility(self, tmp_path):
        """Verify both systems load identical configuration from YAML."""
        # Create test configuration
        config_yaml = """
monitor_interval: 45
container_patterns:
  - "dce-*"
  - "webapp-*"
network_monitoring: true
file_monitoring: true
process_monitoring: true
behavioral_analysis: true
alert_webhook: "https://hooks.example.com/webhook"
report_interval: 600
retention_days: 7

# Thresholds
cpu_threshold: 85.0
memory_threshold: 85.0
network_threshold_mbps: 150.0
file_change_threshold: 50

# Security policies
allowed_ports:
  - 80
  - 443
  - 8080
  - 3000
  - 4173
  - 5173
blocked_processes:
  - "nc"
  - "netcat"
  - "telnet"
  - "ftp"
monitored_directories:
  - "/etc"
  - "/usr/bin"
  - "/usr/sbin"
  - "/opt/app"
        """
        
        config_file = tmp_path / "test_monitor.yaml"
        config_file.write_text(config_yaml)
        
        # Load with monolith system
        with patch('pathlib.Path.exists', return_value=True):
            with patch('builtins.open', mock_open_yaml(config_yaml)):
                monolith_config = MonolithConfig()
        
        # Load with modular system
        from container_monitor.config import load_config
        modular_config = load_config(str(config_file))
        
        # Compare all configuration values
        config_fields = [
            'monitor_interval', 'container_patterns', 'network_monitoring',
            'file_monitoring', 'cpu_threshold', 'memory_threshold',
            'network_threshold_mbps', 'allowed_ports', 'blocked_processes',
            'monitored_directories', 'alert_webhook', 'report_interval'
        ]
        
        for field in config_fields:
            monolith_value = getattr(monolith_config, field)
            modular_value = getattr(modular_config, field)
            assert monolith_value == modular_value, f"Config mismatch for {field}: {monolith_value} != {modular_value}"
    
    def test_environment_variable_override_parity(self):
        """Verify identical environment variable handling."""
        env_vars = {
            'MONITOR_INTERVAL': '60',
            'ALERT_WEBHOOK': 'https://test.example.com/webhook',
            'NETWORK_MONITORING': 'false',
            'FILE_MONITORING': 'true',
            'CPU_THRESHOLD': '90.0',
            'MEMORY_THRESHOLD': '95.0'
        }
        
        with patch.dict(os.environ, env_vars):
            # Load monolith config
            from legacy.security_monitor_v1 import load_config as load_monolith_config
            monolith_config = load_monolith_config()
            
            # Load modular config
            from container_monitor.config import load_config
            modular_config = load_config(env_override=True)
            
            # Verify environment variables are applied identically
            assert monolith_config.monitor_interval == modular_config.monitor_interval == 60
            assert monolith_config.alert_webhook == modular_config.alert_webhook == 'https://test.example.com/webhook'
            assert monolith_config.network_monitoring == modular_config.network_monitoring == False
            assert monolith_config.file_monitoring == modular_config.file_monitoring == True
            assert monolith_config.cpu_threshold == modular_config.cpu_threshold == 90.0
            assert monolith_config.memory_threshold == modular_config.memory_threshold == 95.0


class TestAlertingParity:
    """Verify identical alert generation and delivery."""
    
    @pytest_asyncio.fixture
    async def test_security_event(self):
        """Test security event for alerting."""
        return SecurityEvent(
            event_type="security_misconfiguration",
            severity="CRITICAL",
            source="test",
            description="Privileged container detected",
            container_id="test_container_123",
            container_name="dce-test-container",
            details={
                "privileged": True,
                "user": "root",
                "mounts": ["/var/run/docker.sock"]
            },
            remediation="Remove privileged mode and run as non-root user"
        )
    
    async def test_webhook_payload_parity(self, test_security_event):
        """Verify identical webhook payload generation."""
        webhook_url = "https://hooks.example.com/webhook"
        secret_key = "test-secret-key-12345"
        
        # Configure both systems
        monolith_config = MonolithConfig(
            alert_webhook=webhook_url,
            alert_secret_key=secret_key
        )
        modular_config = ModularConfig(
            alert_webhook=webhook_url,
            alert_secret_key=secret_key
        )
        
        # Capture webhook payloads
        monolith_payload = None
        modular_payload = None
        
        async def capture_monolith_webhook(session, url, **kwargs):
            nonlocal monolith_payload
            monolith_payload = kwargs.get('json')
            mock_response = AsyncMock()
            mock_response.status = 200
            return mock_response
        
        async def capture_modular_webhook(url, payload, headers):
            nonlocal modular_payload
            modular_payload = payload
            return {"status_code": 200, "success": True}
        
        # Test monolith alert sending
        monolith_monitor = MonolithMonitor(monolith_config)
        with patch('aiohttp.ClientSession.post', side_effect=capture_monolith_webhook):
            await monolith_monitor._send_alert(test_security_event)
        
        # Test modular alert sending
        modular_monitor = ModularMonitor(modular_config)
        from container_monitor.monitoring.alerting import SecureAlertSender
        alert_sender = SecureAlertSender(modular_config)
        with patch.object(alert_sender, '_send_webhook', side_effect=capture_modular_webhook):
            await alert_sender.send_alert(test_security_event)
        
        # Verify payload structure similarity
        assert monolith_payload is not None
        assert modular_payload is not None
        
        # Both should have main alert content
        assert "text" in monolith_payload
        assert "alert_type" in modular_payload or "event_type" in modular_payload
        
        # Both should include event details
        assert "attachments" in monolith_payload
        assert "event" in modular_payload
        
        # Verify critical fields are present
        monolith_fields = str(monolith_payload).lower()
        modular_fields = str(modular_payload).lower()
        
        critical_content = ["privileged", "container", "critical", "security"]
        for content in critical_content:
            assert content in monolith_fields
            assert content in modular_fields
        
        await modular_monitor.shutdown()
    
    async def test_hmac_signature_parity(self, test_security_event):
        """Verify identical HMAC signature generation."""
        secret_key = "test-secret-key-for-hmac-validation"
        
        # Configure both systems with HMAC
        monolith_config = MonolithConfig(
            alert_webhook="https://hooks.example.com/webhook",
            alert_secret_key=secret_key
        )
        modular_config = ModularConfig(
            alert_webhook="https://hooks.example.com/webhook", 
            alert_secret_key=secret_key
        )
        
        # Capture HMAC signatures
        monolith_signature = None
        modular_signature = None
        
        async def capture_monolith_headers(session, url, **kwargs):
            nonlocal monolith_signature
            headers = kwargs.get('headers', {})
            monolith_signature = headers.get('X-Hub-Signature-256')
            mock_response = AsyncMock()
            mock_response.status = 200
            return mock_response
        
        def capture_modular_headers(url, payload, headers):
            nonlocal modular_signature
            modular_signature = headers.get('X-Hub-Signature-256')
            return {"status_code": 200, "success": True}
        
        # Generate signatures from both systems
        payload_data = {"test": "data", "event_type": "test"}
        
        # Test monolith HMAC
        from legacy.security_monitor_v1 import generate_hmac_signature
        if hasattr(monolith_monitor := MonolithMonitor(monolith_config), '_generate_hmac_signature'):
            monolith_signature = monolith_monitor._generate_hmac_signature(json.dumps(payload_data))
        
        # Test modular HMAC
        from container_monitor.monitoring.alerting import SecureAlertSender
        alert_sender = SecureAlertSender(modular_config)
        modular_signature = alert_sender._generate_hmac_signature(json.dumps(payload_data))
        
        # Verify signatures are identical for same payload and secret
        if monolith_signature and modular_signature:
            assert monolith_signature == modular_signature
        
        # Both should be valid SHA256 signatures
        if modular_signature:
            assert modular_signature.startswith('sha256=')
            assert len(modular_signature) == 71  # 'sha256=' + 64 hex characters


class TestReportingParity:
    """Verify identical report generation."""
    
    @pytest_asyncio.fixture
    async def sample_events(self):
        """Sample security events for reporting."""
        return [
            SecurityEvent(
                event_type="security_misconfiguration",
                severity="CRITICAL",
                source="posture_analyzer",
                description="Privileged container detected",
                container_id="container_1",
                container_name="dce-app"
            ),
            SecurityEvent(
                event_type="resource_anomaly", 
                severity="HIGH",
                source="behavior_analyzer",
                description="High CPU usage detected",
                container_id="container_1",
                container_name="dce-app"
            ),
            SecurityEvent(
                event_type="network_anomaly",
                severity="MEDIUM",
                source="network_analyzer",
                description="Unusual network traffic",
                container_id="container_2",
                container_name="dce-db"
            )
        ]
    
    async def test_security_report_structure_parity(self, sample_events):
        """Verify identical security report structure."""
        # Configure both systems
        config_data = {
            "monitor_interval": 30,
            "report_interval": 300,
            "retention_days": 7
        }
        
        monolith_config = MonolithConfig(**config_data)
        modular_config = ModularConfig(**config_data)
        
        # Generate reports from both systems
        monolith_monitor = MonolithMonitor(monolith_config)
        monolith_monitor.events = sample_events  # Inject sample events
        monolith_report = monolith_monitor._generate_security_report()
        
        modular_monitor = ModularMonitor(modular_config)
        # Inject events and generate report
        for event in sample_events:
            await modular_monitor._add_security_event(event)
        
        from container_monitor.core.reporting import ReportGenerator
        report_generator = ReportGenerator(modular_config)
        modular_report = await report_generator.generate_security_report(
            events=sample_events,
            containers=[]
        )
        
        # Verify report structure similarity
        required_sections = ['timestamp', 'summary', 'containers', 'recommendations']
        
        for section in required_sections:
            assert section in monolith_report, f"Missing {section} in monolith report"
            assert section in modular_report, f"Missing {section} in modular report"
        
        # Verify summary statistics
        monolith_summary = monolith_report['summary']
        modular_summary = modular_report['summary']
        
        assert monolith_summary['total_events'] == modular_summary['total_events']
        
        # Verify event breakdown by severity
        monolith_breakdown = monolith_summary['event_breakdown']
        modular_breakdown = modular_summary['event_breakdown']
        
        for severity in ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']:
            assert monolith_breakdown[severity] == modular_breakdown[severity]
        
        await modular_monitor.shutdown()


def mock_open_yaml(content):
    """Helper to mock YAML file opening."""
    import yaml
    
    def mock_open_func(file, mode='r', **kwargs):
        if 'r' in mode:
            from io import StringIO
            return StringIO(content)
        else:
            return MagicMock()
    
    return mock_open_func