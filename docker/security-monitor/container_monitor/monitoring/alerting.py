"""
Secure webhook alerting with HMAC authentication.

Implements production-grade security for alert delivery:
- HMAC-SHA256 payload signing
- Timestamp to prevent replay attacks
- Certificate pinning for TLS
- Automatic retry with backoff
"""

import asyncio
import hashlib
import hmac
import json
import ssl
import time
import os
from typing import Optional, Dict, Any, Set
from datetime import datetime, timezone, timedelta
from pathlib import Path

import aiohttp
from aiohttp import ClientSession, ClientTimeout, TCPConnector
from tenacity import retry, stop_after_attempt, wait_exponential
import structlog

from container_monitor.models.events import SecurityEvent
from container_monitor.models.config import MonitorConfig

logger = structlog.get_logger(__name__)


class SecureAlertSender:
    """
    Handles secure delivery of security alerts via webhooks.
    
    Features:
    - HMAC-SHA256 signatures for authenticity
    - Replay attack prevention with timestamps
    - Certificate pinning for enhanced TLS security
    - Key rotation support with graceful fallback
    - Connection pooling for efficiency
    - Automatic retry with exponential backoff
    """
    
    def __init__(self, config: MonitorConfig):
        """
        Initialize the alert sender.
        
        Args:
            config: Monitor configuration with webhook settings
        """
        self.config = config
        self.webhook_url = config.alert_webhook
        self.secret_key = config.alert_secret_key
        self.timeout = config.alert_timeout
        
        # Security enhancements
        self.cert_pin_file = getattr(config, 'cert_pin_file', None)
        self.backup_secret_key = getattr(config, 'backup_secret_key', None)
        self.max_timestamp_skew = getattr(config, 'max_timestamp_skew', 300)  # 5 minutes
        
        # Session management
        self._session: Optional[ClientSession] = None
        self._ssl_context = self._create_ssl_context()
        
        # Replay attack prevention
        self._used_timestamps: Set[str] = set()
        self._timestamp_cleanup_interval = 600  # 10 minutes
        self._last_cleanup = time.time()
        
        # Metrics
        self.alerts_sent = 0
        self.alerts_failed = 0
        self.signature_failures = 0
        self.cert_pin_failures = 0
        
    def _create_ssl_context(self) -> ssl.SSLContext:
        """Create SSL context with certificate pinning and enhanced security."""
        context = ssl.create_default_context()
        context.check_hostname = True
        context.verify_mode = ssl.CERT_REQUIRED
        
        # Disable weak protocols and ciphers
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.set_ciphers('ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS')
        
        # Certificate pinning if configured
        if self.cert_pin_file and Path(self.cert_pin_file).exists():
            try:
                context.load_verify_locations(self.cert_pin_file)
                logger.info("Certificate pinning enabled", cert_file=self.cert_pin_file)
            except Exception as e:
                logger.error("Failed to load pinned certificate", error=str(e))
                self.cert_pin_failures += 1
        
        return context
        
    async def __aenter__(self) -> 'SecureAlertSender':
        """Async context manager entry."""
        connector = TCPConnector(
            ssl=self._ssl_context,
            limit=10,  # Connection pool size
            ttl_dns_cache=300
        )
        
        self._session = ClientSession(
            connector=connector,
            timeout=ClientTimeout(total=self.timeout)
        )
        
        logger.info("Alert sender initialized", webhook_url=str(self.webhook_url))
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self._session:
            await self._session.close()
            
    def _generate_signature(self, payload: bytes, timestamp: str) -> str:
        """
        Generate HMAC-SHA256 signature for payload with key rotation support.
        
        Args:
            payload: The JSON payload as bytes
            timestamp: ISO format timestamp
            
        Returns:
            Hex-encoded signature
        """
        if not self.secret_key:
            return ""
            
        # Create message: timestamp.payload
        message = f"{timestamp}.{payload.decode('utf-8')}".encode('utf-8')
        
        # Generate HMAC with primary key
        signature = hmac.new(
            self.secret_key.encode('utf-8'),
            message,
            hashlib.sha256
        ).hexdigest()
        
        return signature
    
    def _generate_backup_signature(self, payload: bytes, timestamp: str) -> Optional[str]:
        """
        Generate backup signature for key rotation scenarios.
        
        Args:
            payload: The JSON payload as bytes
            timestamp: ISO format timestamp
            
        Returns:
            Hex-encoded backup signature or None
        """
        if not self.backup_secret_key:
            return None
            
        # Create message: timestamp.payload
        message = f"{timestamp}.{payload.decode('utf-8')}".encode('utf-8')
        
        # Generate HMAC with backup key
        backup_signature = hmac.new(
            self.backup_secret_key.encode('utf-8'),
            message,
            hashlib.sha256
        ).hexdigest()
        
        return backup_signature
        
    def _verify_timestamp(self, timestamp: str, max_age: int = None) -> bool:
        """
        Verify timestamp is recent and not reused to prevent replay attacks.
        
        Args:
            timestamp: ISO format timestamp
            max_age: Maximum age in seconds (uses config default if None)
            
        Returns:
            True if timestamp is valid and not reused
        """
        if max_age is None:
            max_age = self.max_timestamp_skew
            
        try:
            # Check if timestamp was already used (replay attack prevention)
            if timestamp in self._used_timestamps:
                logger.warning("Replay attack detected", timestamp=timestamp)
                return False
                
            # Validate timestamp freshness
            event_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            current_time = datetime.now(timezone.utc)
            age = (current_time - event_time).total_seconds()
            
            # Allow small clock skew in both directions
            if not (-30 <= age <= max_age):  # 30 seconds future tolerance
                logger.warning("Timestamp outside valid range", 
                             timestamp=timestamp, age=age, max_age=max_age)
                return False
            
            # Mark timestamp as used
            self._used_timestamps.add(timestamp)
            
            # Cleanup old timestamps periodically
            self._cleanup_old_timestamps()
            
            return True
        except Exception as e:
            logger.error("Timestamp verification failed", timestamp=timestamp, error=str(e))
            return False
            
    def _cleanup_old_timestamps(self):
        """Clean up old timestamps to prevent memory growth."""
        current_time = time.time()
        if current_time - self._last_cleanup > self._timestamp_cleanup_interval:
            # Remove timestamps older than max age + buffer
            cutoff_time = datetime.now(timezone.utc) - timedelta(seconds=self.max_timestamp_skew + 300)
            cutoff_str = cutoff_time.isoformat()
            
            # Filter out old timestamps (simple string comparison works for ISO format)
            self._used_timestamps = {
                ts for ts in self._used_timestamps 
                if ts > cutoff_str
            }
            
            self._last_cleanup = current_time
            logger.debug("Cleaned up old timestamps", 
                        remaining_count=len(self._used_timestamps))
            
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    async def send_alert(self, event: SecurityEvent) -> bool:
        """
        Send security alert with HMAC signature.
        
        Args:
            event: Security event to send
            
        Returns:
            True if successfully sent
        """
        if not self.webhook_url or not self._session:
            logger.warning("Alert sending disabled - no webhook configured")
            return False
            
        try:
            # Prepare payload
            timestamp = datetime.now(timezone.utc).isoformat()
            alert_data = {
                "timestamp": timestamp,
                "event": event.to_alert_format(),
                "monitor": {
                    "version": "2.0.0",
                    "instance": "container-monitor"
                }
            }
            
            payload = json.dumps(alert_data, sort_keys=True).encode('utf-8')
            signature = self._generate_signature(payload, timestamp)
            backup_signature = self._generate_backup_signature(payload, timestamp)
            
            # Prepare headers
            headers = {
                "Content-Type": "application/json",
                "X-Webhook-Timestamp": timestamp,
                "X-Webhook-Signature": f"sha256={signature}",
                "User-Agent": "ContainerMonitor/2.0"
            }
            
            # Add backup signature if available (for key rotation)
            if backup_signature:
                headers["X-Webhook-Signature-Backup"] = f"sha256={backup_signature}"
            
            # Send alert
            async with self._session.post(
                str(self.webhook_url),
                data=payload,
                headers=headers
            ) as response:
                response.raise_for_status()
                
                self.alerts_sent += 1
                logger.info(
                    "Alert sent successfully",
                    event_type=event.event_type,
                    severity=event.severity,
                    status=response.status
                )
                
                return True
                
        except aiohttp.ClientError as e:
            self.alerts_failed += 1
            logger.error(
                "Failed to send alert",
                event_type=event.event_type,
                error=str(e)
            )
            raise
            
        except Exception as e:
            self.alerts_failed += 1
            logger.error(
                "Unexpected error sending alert",
                event_type=event.event_type,
                error=str(e)
            )
            return False
            
    async def send_batch(self, events: list[SecurityEvent]) -> Dict[str, int]:
        """
        Send multiple alerts efficiently.
        
        Args:
            events: List of security events
            
        Returns:
            Dictionary with success/failure counts
        """
        results = {"success": 0, "failed": 0}
        
        # Create tasks for parallel sending
        tasks = [self.send_alert(event) for event in events]
        
        # Execute with concurrency limit
        semaphore = asyncio.Semaphore(5)
        
        async def bounded_send(event: SecurityEvent):
            async with semaphore:
                return await self.send_alert(event)
                
        bounded_tasks = [bounded_send(event) for event in events]
        results_list = await asyncio.gather(*bounded_tasks, return_exceptions=True)
        
        # Count results
        for result in results_list:
            if isinstance(result, Exception):
                results["failed"] += 1
            elif result:
                results["success"] += 1
            else:
                results["failed"] += 1
                
        return results
        
    def get_stats(self) -> Dict[str, Any]:
        """Get comprehensive alerting and security statistics."""
        total_attempts = self.alerts_sent + self.alerts_failed
        return {
            "alerts_sent": self.alerts_sent,
            "alerts_failed": self.alerts_failed,
            "signature_failures": self.signature_failures,
            "cert_pin_failures": self.cert_pin_failures,
            "success_rate": (
                self.alerts_sent / total_attempts if total_attempts > 0 else 0
            ),
            "security_metrics": {
                "cert_pinning_enabled": self.cert_pin_file is not None,
                "key_rotation_enabled": self.backup_secret_key is not None,
                "timestamp_cache_size": len(self._used_timestamps),
                "max_timestamp_skew": self.max_timestamp_skew
            }
        }
    
    async def verify_webhook_signature(self, payload: bytes, timestamp: str, 
                                     signature: str, backup_signature: Optional[str] = None) -> bool:
        """
        Verify webhook signature for incoming requests (webhook receiver side).
        
        Args:
            payload: Raw payload bytes
            timestamp: ISO timestamp from header
            signature: Primary signature from header
            backup_signature: Optional backup signature for key rotation
            
        Returns:
            True if signature is valid
        """
        # Verify timestamp first
        if not self._verify_timestamp(timestamp):
            return False
        
        # Try primary signature
        expected_sig = self._generate_signature(payload, timestamp)
        if signature == f"sha256={expected_sig}":
            return True
        
        # Try backup signature during key rotation
        if backup_signature and self.backup_secret_key:
            expected_backup = self._generate_backup_signature(payload, timestamp)
            if backup_signature == f"sha256={expected_backup}":
                logger.info("Webhook verified with backup key", timestamp=timestamp)
                return True
        
        self.signature_failures += 1
        logger.warning("Webhook signature verification failed", 
                      timestamp=timestamp, signature=signature[:16] + "...")
        return False