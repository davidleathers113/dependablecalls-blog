"""
Configuration models using Pydantic v2 with settings management.

Created by Models Agent for the container security monitor.
"""

from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, HttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class MonitorConfig(BaseSettings):
    """
    Main configuration for the container security monitor.
    
    Loads from (in priority order):
    1. Environment variables (MONITOR_ prefix)
    2. .env file
    3. YAML config file
    4. Default values
    """
    
    # Monitoring intervals
    monitor_interval: int = Field(
        default=30,
        ge=1,
        le=300,
        description="Container check interval in seconds"
    )
    report_interval: int = Field(
        default=300,
        ge=60,
        le=3600,
        description="Report generation interval in seconds"
    )
    retention_days: int = Field(
        default=30,
        ge=1,
        le=365,
        description="Event retention period in days"
    )
    
    # Container targeting
    container_patterns: List[str] = Field(
        default_factory=lambda: ["dce-*"],
        description="Container name patterns to monitor"
    )
    
    # Feature toggles
    network_monitoring: bool = Field(
        default=True,
        description="Enable network traffic monitoring"
    )
    file_monitoring: bool = Field(
        default=True,
        description="Enable file system monitoring"
    )
    process_monitoring: bool = Field(
        default=True,
        description="Enable process monitoring"
    )
    behavioral_analysis: bool = Field(
        default=True,
        description="Enable behavioral anomaly detection"
    )
    
    # Alerting configuration
    alert_webhook: Optional[HttpUrl] = Field(
        default=None,
        description="Webhook URL for security alerts"
    )
    alert_timeout: int = Field(
        default=10,
        ge=1,
        le=30,
        description="Alert delivery timeout in seconds"
    )
    alert_secret_key: Optional[str] = Field(
        default=None,
        description="HMAC secret for webhook signatures"
    )
    
    # Resource thresholds
    cpu_threshold: float = Field(
        default=80.0,
        ge=0.0,
        le=100.0,
        description="CPU usage threshold percentage"
    )
    memory_threshold: float = Field(
        default=80.0,
        ge=0.0,
        le=100.0,
        description="Memory usage threshold percentage"
    )
    network_threshold_mbps: float = Field(
        default=100.0,
        ge=0.0,
        description="Network traffic threshold in Mbps"
    )
    file_change_threshold: int = Field(
        default=100,
        ge=1,
        description="Maximum file changes per interval"
    )
    
    # Security policies
    allowed_ports: List[int] = Field(
        default_factory=lambda: [80, 443, 8080, 3000, 4173, 5173],
        description="Allowed exposed ports"
    )
    blocked_processes: List[str] = Field(
        default_factory=lambda: ["nc", "netcat", "telnet", "ftp"],
        description="Blocked process names"
    )
    monitored_directories: List[str] = Field(
        default_factory=lambda: ["/etc", "/usr/bin", "/usr/sbin"],
        description="Directories to monitor for changes"
    )
    
    # Concurrency settings
    max_concurrent_containers: Optional[int] = Field(
        default=None,
        ge=1,
        le=100,
        description="Maximum concurrent container operations"
    )
    
    # Pydantic v2 settings configuration
    model_config = SettingsConfigDict(
        env_prefix="MONITOR_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="forbid"
    )
    
    @field_validator('container_patterns')
    @classmethod
    def validate_patterns(cls, v: List[str]) -> List[str]:
        """Ensure at least one pattern is specified."""
        if not v:
            raise ValueError("At least one container pattern must be specified")
        return v
        
    @field_validator('alert_webhook')
    @classmethod
    def validate_webhook_security(cls, v: Optional[HttpUrl]) -> Optional[HttpUrl]:
        """Ensure webhook uses HTTPS in production."""
        if v and str(v).startswith('http://') and 'localhost' not in str(v):
            raise ValueError("Webhook must use HTTPS for security")
        return v
        
    @field_validator('monitored_directories')
    @classmethod  
    def validate_directories(cls, v: List[str]) -> List[str]:
        """Validate monitored directories."""
        sensitive_dirs = {'/etc', '/proc', '/sys', '/dev'}
        for directory in v:
            if directory in sensitive_dirs:
                # Log warning but allow for security monitoring
                pass
        return v
        
    def get_concurrency_limit(self) -> int:
        """Get the concurrency limit for container operations."""
        if self.max_concurrent_containers:
            return self.max_concurrent_containers
        # Default to CPU count * 4
        import os
        return (os.cpu_count() or 1) * 4