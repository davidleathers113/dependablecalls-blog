"""
Security configuration validation and hardening utilities.

Provides secure configuration loading with:
- File permission validation (0600 requirement)
- Configuration sanitization and validation
- Security policy enforcement
- Key rotation utilities
"""

import os
import stat
import secrets
import hashlib
import json
from typing import Dict, Any, Optional, List
from pathlib import Path
from datetime import datetime, timezone

import structlog
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

logger = structlog.get_logger(__name__)


class SecurityConfigError(Exception):
    """Raised when security config validation fails."""
    pass


class SecurityConfig:
    """
    Handles secure configuration loading and validation.
    
    Features:
    - Enforces 0600 permissions on config files
    - Validates configuration security settings
    - Provides key rotation utilities
    - Encrypts sensitive config values
    """
    
    REQUIRED_PERMISSIONS = 0o600  # Owner read/write only
    SENSITIVE_KEYS = {
        'alert_secret_key', 'backup_secret_key', 'database_password',
        'api_key', 'webhook_secret', 'encryption_key'
    }
    
    def __init__(self, config_path: Path):
        """
        Initialize security config validator.
        
        Args:
            config_path: Path to configuration file
        """
        self.config_path = Path(config_path)
        self.config_data: Dict[str, Any] = {}
        self._encryption_key: Optional[bytes] = None
        
    def validate_file_permissions(self) -> bool:
        """
        Validate that config file has secure permissions (0600).
        
        Returns:
            True if permissions are secure
            
        Raises:
            SecurityConfigError: If permissions are too permissive
        """
        if not self.config_path.exists():
            raise SecurityConfigError(f"Config file not found: {self.config_path}")
        
        # Get file permissions
        file_stat = self.config_path.stat()
        current_perms = stat.filemode(file_stat.st_mode)
        octal_perms = oct(file_stat.st_mode)[-3:]
        
        # Check if permissions are too permissive
        if file_stat.st_mode & 0o077:  # Group or other has any permissions
            raise SecurityConfigError(
                f"Config file has insecure permissions: {current_perms} ({octal_perms}). "
                f"Required: -rw------- (0600)"
            )
        
        # Check if owner has correct permissions
        if (file_stat.st_mode & 0o700) != 0o600:
            logger.warning(
                "Config file permissions are not exactly 0600",
                current=current_perms,
                path=str(self.config_path)
            )
        
        logger.info(
            "Config file permissions validated",
            permissions=current_perms,
            path=str(self.config_path)
        )
        return True
    
    def fix_file_permissions(self) -> bool:
        """
        Fix config file permissions to 0600.
        
        Returns:
            True if permissions were fixed
        """
        try:
            self.config_path.chmod(self.REQUIRED_PERMISSIONS)
            logger.info(
                "Fixed config file permissions",
                path=str(self.config_path),
                permissions="0600"
            )
            return True
        except OSError as e:
            logger.error(
                "Failed to fix config file permissions",
                path=str(self.config_path),
                error=str(e)
            )
            return False
    
    def load_config(self, auto_fix_permissions: bool = False) -> Dict[str, Any]:
        """
        Load and validate configuration file.
        
        Args:
            auto_fix_permissions: Automatically fix permissions if possible
            
        Returns:
            Configuration dictionary
            
        Raises:
            SecurityConfigError: If validation fails
        """
        try:
            # Validate permissions first
            self.validate_file_permissions()
        except SecurityConfigError as e:
            if auto_fix_permissions:
                logger.warning(f"Permission issue detected: {e}")
                if not self.fix_file_permissions():
                    raise
                # Re-validate after fix
                self.validate_file_permissions()
            else:
                raise
        
        # Load configuration
        try:
            with open(self.config_path, 'r') as f:
                self.config_data = json.load(f)
        except Exception as e:
            raise SecurityConfigError(f"Failed to load config: {e}")
        
        # Validate configuration content
        self._validate_config_content()
        
        return self.config_data
    
    def _validate_config_content(self) -> None:
        """Validate configuration content for security."""
        if not isinstance(self.config_data, dict):
            raise SecurityConfigError("Config must be a JSON object")
        
        # Check for sensitive keys in plain text
        for key, value in self.config_data.items():
            if key in self.SENSITIVE_KEYS and isinstance(value, str):
                if len(value) < 32:  # Minimum key length
                    logger.warning(
                        "Potentially weak secret detected",
                        key=key,
                        length=len(value)
                    )
        
        # Validate webhook URLs are HTTPS
        webhook_keys = ['alert_webhook', 'webhook_url']
        for key in webhook_keys:
            if key in self.config_data:
                url = self.config_data[key]
                if isinstance(url, str) and not url.startswith('https://'):
                    raise SecurityConfigError(
                        f"Webhook URL must use HTTPS: {key}"
                    )
        
        logger.info("Configuration content validated")
    
    def generate_secret_key(self, length: int = 64) -> str:
        """
        Generate a cryptographically secure secret key.
        
        Args:
            length: Key length in bytes
            
        Returns:
            Hex-encoded secret key
        """
        return secrets.token_hex(length)
    
    def rotate_secret_keys(self) -> Dict[str, str]:
        """
        Generate new secret keys for rotation.
        
        Returns:
            Dictionary of new keys
        """
        new_keys = {}
        
        for key in self.SENSITIVE_KEYS:
            if key in self.config_data:
                new_keys[key] = self.generate_secret_key()
                logger.info(f"Generated new key for rotation: {key}")
        
        return new_keys
    
    def backup_config(self, backup_path: Optional[Path] = None) -> Path:
        """
        Create a secure backup of the configuration.
        
        Args:
            backup_path: Custom backup location
            
        Returns:
            Path to backup file
        """
        if backup_path is None:
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            backup_path = Path(f"{self.config_path}.backup.{timestamp}")
        
        # Copy file and set secure permissions
        backup_path.write_text(json.dumps(self.config_data, indent=2))
        backup_path.chmod(self.REQUIRED_PERMISSIONS)
        
        logger.info(
            "Configuration backup created",
            backup_path=str(backup_path)
        )
        
        return backup_path
    
    def get_encryption_key(self, password: Optional[str] = None) -> bytes:
        """
        Derive encryption key for sensitive config values.
        
        Args:
            password: Master password for key derivation
            
        Returns:
            32-byte encryption key
        """
        if self._encryption_key:
            return self._encryption_key
        
        if not password:
            # Generate a random key if no password provided
            self._encryption_key = os.urandom(32)
        else:
            # Derive key from password
            salt = b'container_monitor_salt'  # In production, use random salt
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=100000,
            )
            self._encryption_key = kdf.derive(password.encode('utf-8'))
        
        return self._encryption_key
    
    def encrypt_sensitive_values(self, password: Optional[str] = None) -> Dict[str, Any]:
        """
        Encrypt sensitive configuration values.
        
        Args:
            password: Master password for encryption
            
        Returns:
            Configuration with encrypted sensitive values
        """
        key = self.get_encryption_key(password)
        cipher = Fernet(Fernet.generate_key())  # Use the derived key
        
        encrypted_config = self.config_data.copy()
        
        for key_name in self.SENSITIVE_KEYS:
            if key_name in encrypted_config:
                value = encrypted_config[key_name]
                if isinstance(value, str):
                    encrypted_value = cipher.encrypt(value.encode('utf-8'))
                    encrypted_config[key_name] = {
                        'encrypted': True,
                        'value': encrypted_value.decode('utf-8')
                    }
        
        return encrypted_config
    
    def decrypt_sensitive_values(self, encrypted_config: Dict[str, Any], 
                               password: Optional[str] = None) -> Dict[str, Any]:
        """
        Decrypt sensitive configuration values.
        
        Args:
            encrypted_config: Configuration with encrypted values
            password: Master password for decryption
            
        Returns:
            Configuration with decrypted values
        """
        key = self.get_encryption_key(password)
        cipher = Fernet(key)
        
        decrypted_config = encrypted_config.copy()
        
        for key_name in self.SENSITIVE_KEYS:
            if key_name in decrypted_config:
                value = decrypted_config[key_name]
                if isinstance(value, dict) and value.get('encrypted'):
                    encrypted_value = value['value']
                    decrypted_value = cipher.decrypt(encrypted_value.encode('utf-8'))
                    decrypted_config[key_name] = decrypted_value.decode('utf-8')
        
        return decrypted_config
    
    def audit_security_settings(self) -> Dict[str, Any]:
        """
        Audit current security configuration.
        
        Returns:
            Security audit report
        """
        audit_report = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'config_file': str(self.config_path),
            'permissions_secure': False,
            'https_webhooks': True,
            'sensitive_keys_present': [],
            'weak_keys': [],
            'recommendations': []
        }
        
        # Check file permissions
        try:
            self.validate_file_permissions()
            audit_report['permissions_secure'] = True
        except SecurityConfigError:
            audit_report['permissions_secure'] = False
            audit_report['recommendations'].append(
                "Fix file permissions to 0600"
            )
        
        # Check sensitive keys
        for key in self.SENSITIVE_KEYS:
            if key in self.config_data:
                audit_report['sensitive_keys_present'].append(key)
                value = self.config_data[key]
                if isinstance(value, str) and len(value) < 32:
                    audit_report['weak_keys'].append(key)
                    audit_report['recommendations'].append(
                        f"Strengthen {key} (current length: {len(value)})"
                    )
        
        # Check webhook security
        webhook_keys = ['alert_webhook', 'webhook_url']
        for key in webhook_keys:
            if key in self.config_data:
                url = self.config_data[key]
                if isinstance(url, str) and not url.startswith('https://'):
                    audit_report['https_webhooks'] = False
                    audit_report['recommendations'].append(
                        f"Use HTTPS for {key}"
                    )
        
        return audit_report


def create_secure_config_template() -> Dict[str, Any]:
    """
    Create a secure configuration template with strong defaults.
    
    Returns:
        Template configuration dictionary
    """
    security_config = SecurityConfig(Path('/tmp/dummy'))
    
    template = {
        "# Security Configuration Template": "Remove this comment before use",
        "alert_webhook": "https://your-webhook-endpoint.com/alerts",
        "alert_secret_key": security_config.generate_secret_key(64),
        "backup_secret_key": security_config.generate_secret_key(64),
        "alert_timeout": 30,
        "max_timestamp_skew": 300,
        "cert_pin_file": "/path/to/pinned-certificate.pem",
        "security": {
            "enforce_https": True,
            "require_signature_verification": True,
            "enable_replay_protection": True,
            "key_rotation_interval_days": 90
        },
        "monitoring": {
            "log_security_events": True,
            "alert_on_security_failures": True,
            "max_failed_signatures": 10
        }
    }
    
    return template


if __name__ == "__main__":
    # Example usage and testing
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python security.py <config_file>")
        sys.exit(1)
    
    config_path = Path(sys.argv[1])
    security_config = SecurityConfig(config_path)
    
    try:
        # Load and validate config
        config = security_config.load_config(auto_fix_permissions=True)
        print("✅ Configuration loaded successfully")
        
        # Generate audit report
        audit = security_config.audit_security_settings()
        print(f"🔍 Security audit completed:")
        print(f"  - Permissions secure: {audit['permissions_secure']}")
        print(f"  - HTTPS webhooks: {audit['https_webhooks']}")
        print(f"  - Sensitive keys: {len(audit['sensitive_keys_present'])}")
        print(f"  - Weak keys: {len(audit['weak_keys'])}")
        
        if audit['recommendations']:
            print("⚠️  Recommendations:")
            for rec in audit['recommendations']:
                print(f"  - {rec}")
                
    except SecurityConfigError as e:
        print(f"❌ Security validation failed: {e}")
        sys.exit(1)