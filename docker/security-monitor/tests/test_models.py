"""
Tests for Pydantic models.

Validates:
- Model construction
- Field validation
- Default values
- Business logic
"""

import pytest
from datetime import datetime, timezone
from pydantic import ValidationError

from container_monitor.models.events import SecurityEvent
from container_monitor.models.config import MonitorConfig


class TestSecurityEvent:
    """Test SecurityEvent model."""
    
    def test_create_minimal_event(self):
        """Test creating event with minimal fields."""
        event = SecurityEvent(
            event_type="resource_anomaly",
            severity="HIGH",
            source="test",
            description="Test event"
        )
        
        assert event.event_type == "resource_anomaly"
        assert event.severity == "HIGH"
        assert event.timestamp is not None
        assert event.container_id is None
        
    def test_timestamp_default(self):
        """Test timestamp is set by default."""
        event = SecurityEvent(
            event_type="network_anomaly",
            severity="MEDIUM",
            source="test",
            description="Test"
        )
        
        # Should be recent
        time_diff = datetime.now(timezone.utc) - event.timestamp
        assert time_diff.total_seconds() < 1
        
    def test_container_id_validation(self):
        """Test container ID validation."""
        # Valid ID
        event = SecurityEvent(
            event_type="suspicious_process",
            severity="HIGH",
            source="test",
            description="Test",
            container_id="abc123def456"
        )
        assert event.container_id == "abc123def456"
        
        # Too short ID should fail
        with pytest.raises(ValidationError) as exc_info:
            SecurityEvent(
                event_type="suspicious_process",
                severity="HIGH",
                source="test",
                description="Test",
                container_id="abc"
            )
        assert "at least 12 characters" in str(exc_info.value)
        
    def test_severity_auto_escalation(self):
        """Test automatic severity escalation."""
        # Privileged container should escalate to CRITICAL
        event = SecurityEvent(
            event_type="security_misconfiguration",
            severity="MEDIUM",
            source="test",
            description="Privileged container",
            details={"privileged": True}
        )
        assert event.severity == "CRITICAL"
        
        # Docker socket mount should escalate
        event2 = SecurityEvent(
            event_type="security_misconfiguration",
            severity="HIGH",
            source="test",
            description="Docker socket mounted",
            details={"mount": "/var/run/docker.sock"}
        )
        assert event2.severity == "CRITICAL"
        
    def test_should_alert_method(self):
        """Test alert determination logic."""
        # Critical should alert
        critical_event = SecurityEvent(
            event_type="security_misconfiguration",
            severity="CRITICAL",
            source="test",
            description="Critical issue"
        )
        assert critical_event.should_alert() is True
        
        # High should alert
        high_event = SecurityEvent(
            event_type="network_anomaly",
            severity="HIGH",
            source="test",
            description="High severity"
        )
        assert high_event.should_alert() is True
        
        # Medium should not alert
        medium_event = SecurityEvent(
            event_type="file_system_change",
            severity="MEDIUM",
            source="test",
            description="Medium severity"
        )
        assert medium_event.should_alert() is False
        
    def test_to_alert_format(self):
        """Test conversion to alert format."""
        event = SecurityEvent(
            event_type="suspicious_process",
            severity="HIGH",
            container_name="web-app",
            source="process_monitor",
            description="Netcat detected",
            remediation="Investigate and terminate"
        )
        
        alert_format = event.to_alert_format()
        
        assert alert_format["severity"] == "HIGH"
        assert alert_format["event_type"] == "suspicious_process"
        assert alert_format["container"] == "web-app"
        assert alert_format["remediation"] == "Investigate and terminate"
        assert "timestamp" in alert_format
        
    def test_invalid_event_type(self):
        """Test invalid event type validation."""
        with pytest.raises(ValidationError):
            SecurityEvent(
                event_type="invalid_type",
                severity="HIGH",
                source="test",
                description="Test"
            )
            
    def test_invalid_severity(self):
        """Test invalid severity validation."""
        with pytest.raises(ValidationError):
            SecurityEvent(
                event_type="network_anomaly",
                severity="INVALID",
                source="test",
                description="Test"
            )


class TestMonitorConfig:
    """Test MonitorConfig model."""
    
    def test_default_values(self):
        """Test default configuration values."""
        config = MonitorConfig()
        
        assert config.monitor_interval == 30
        assert config.report_interval == 300
        assert config.retention_days == 30
        assert config.container_patterns == ["dce-*"]
        assert config.network_monitoring is True
        assert config.cpu_threshold == 80.0
        
    def test_env_var_loading(self, monkeypatch):
        """Test loading from environment variables."""
        monkeypatch.setenv("MONITOR_MONITOR_INTERVAL", "60")
        monkeypatch.setenv("MONITOR_CPU_THRESHOLD", "90.0")
        monkeypatch.setenv("MONITOR_ALERT_WEBHOOK", "https://example.com/hook")
        
        config = MonitorConfig()
        
        assert config.monitor_interval == 60
        assert config.cpu_threshold == 90.0
        assert str(config.alert_webhook) == "https://example.com/hook"
        
    def test_validation_ranges(self):
        """Test field validation ranges."""
        # Valid config
        config = MonitorConfig(
            monitor_interval=60,
            cpu_threshold=50.0,
            memory_threshold=75.0
        )
        assert config.monitor_interval == 60
        
        # Invalid monitor interval (too high)
        with pytest.raises(ValidationError):
            MonitorConfig(monitor_interval=400)
            
        # Invalid CPU threshold (> 100)
        with pytest.raises(ValidationError):
            MonitorConfig(cpu_threshold=150.0)
            
    def test_webhook_https_validation(self):
        """Test webhook HTTPS requirement."""
        # HTTPS should work
        config = MonitorConfig(
            alert_webhook="https://secure.example.com/webhook"
        )
        assert str(config.alert_webhook) == "https://secure.example.com/webhook"
        
        # HTTP with localhost should work
        config2 = MonitorConfig(
            alert_webhook="http://localhost:8080/webhook"
        )
        assert "localhost" in str(config2.alert_webhook)
        
        # HTTP without localhost should fail
        with pytest.raises(ValidationError) as exc_info:
            MonitorConfig(
                alert_webhook="http://example.com/webhook"
            )
        assert "must use HTTPS" in str(exc_info.value)
        
    def test_container_patterns_validation(self):
        """Test container pattern validation."""
        # Empty patterns should fail
        with pytest.raises(ValidationError) as exc_info:
            MonitorConfig(container_patterns=[])
        assert "at least one container pattern" in str(exc_info.value)
        
    def test_get_concurrency_limit(self):
        """Test concurrency limit calculation."""
        # Default (CPU count * 4)
        config = MonitorConfig()
        limit = config.get_concurrency_limit()
        assert limit > 0
        
        # Explicit limit
        config2 = MonitorConfig(max_concurrent_containers=10)
        assert config2.get_concurrency_limit() == 10
        
    def test_extra_fields_forbidden(self):
        """Test that extra fields are rejected."""
        with pytest.raises(ValidationError):
            MonitorConfig(
                monitor_interval=30,
                unknown_field="value"
            )
            
    def test_secret_key_validation(self):
        """Test alert secret key validation."""
        # Valid secret key
        config = MonitorConfig(
            alert_secret_key="test-secret-key-with-sufficient-length"
        )
        assert config.alert_secret_key == "test-secret-key-with-sufficient-length"
        
        # Too short secret key should fail
        with pytest.raises(ValidationError) as exc_info:
            MonitorConfig(alert_secret_key="short")
        assert "at least 16 characters" in str(exc_info.value)


class TestSecurityEventValidation:
    """Extended security validation tests for SecurityEvent."""
    
    def test_malicious_container_name_filtering(self):
        """Test filtering of potentially malicious container names."""
        # Should reject container names with path traversal
        with pytest.raises(ValidationError):
            SecurityEvent(
                event_type="network_anomaly",
                severity="HIGH",
                source="test",
                description="Test",
                container_name="../../../etc/passwd"
            )
            
        # Should reject names with null bytes
        with pytest.raises(ValidationError):
            SecurityEvent(
                event_type="network_anomaly",
                severity="HIGH",
                source="test",
                description="Test",
                container_name="container\x00name"
            )
    
    def test_description_sanitization(self):
        """Test description field sanitization."""
        # Should handle normal descriptions
        event = SecurityEvent(
            event_type="file_system_change",
            severity="MEDIUM",
            source="test",
            description="Normal file change detected"
        )
        assert event.description == "Normal file change detected"
        
        # Should truncate very long descriptions
        long_desc = "A" * 2000
        event = SecurityEvent(
            event_type="file_system_change",
            severity="MEDIUM",
            source="test",
            description=long_desc
        )
        assert len(event.description) <= 1000
        
    def test_details_security_validation(self):
        """Test security validation of details field."""
        # Should reject sensitive information patterns
        with pytest.raises(ValidationError):
            SecurityEvent(
                event_type="network_anomaly",
                severity="HIGH",
                source="test",
                description="Test",
                details={"password": "secret123"}
            )
            
        # Should reject API keys
        with pytest.raises(ValidationError):
            SecurityEvent(
                event_type="network_anomaly",
                severity="HIGH",
                source="test",
                description="Test",
                details={"api_key": "sk-1234567890"}
            )
    
    def test_event_type_enum_validation(self):
        """Test event type enumeration validation."""
        valid_types = [
            "security_misconfiguration",
            "network_anomaly",
            "resource_anomaly",
            "suspicious_process",
            "file_system_change"
        ]
        
        for event_type in valid_types:
            event = SecurityEvent(
                event_type=event_type,
                severity="MEDIUM",
                source="test",
                description="Test"
            )
            assert event.event_type == event_type
    
    def test_severity_escalation_edge_cases(self):
        """Test edge cases in severity escalation."""
        # Test with multiple escalation triggers
        event = SecurityEvent(
            event_type="security_misconfiguration",
            severity="LOW",
            source="test",
            description="Multiple issues",
            details={
                "privileged": True,
                "mount": "/var/run/docker.sock",
                "host_network": True
            }
        )
        assert event.severity == "CRITICAL"
        
        # Test escalation precedence
        event2 = SecurityEvent(
            event_type="security_misconfiguration",
            severity="CRITICAL",  # Already critical
            source="test",
            description="Already critical",
            details={"privileged": True}
        )
        assert event2.severity == "CRITICAL"  # Should remain critical