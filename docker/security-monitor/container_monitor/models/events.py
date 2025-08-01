"""
Security event models using Pydantic v2 (v3 compatible).

Created by Models Agent for the container security monitor.
"""

from datetime import datetime, timezone
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator

from container_monitor.types import SeverityLevel, EventType


class SecurityEvent(BaseModel):
    """
    Security event model representing an observed security-relevant incident.
    
    This model is used throughout the system for:
    - Recording security incidents
    - Alert notifications  
    - Report generation
    - Event correlation
    """
    
    # Core fields
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="When the event occurred"
    )
    event_type: EventType = Field(
        description="Type of security event"
    )
    severity: SeverityLevel = Field(
        description="Event severity level"
    )
    
    # Container context (optional for host events)
    container_id: Optional[str] = Field(
        default=None,
        description="Docker container ID"
    )
    container_name: Optional[str] = Field(
        default=None,
        description="Docker container name"  
    )
    
    # Event details
    source: str = Field(
        description="Component that detected the event"
    )
    description: str = Field(
        description="Human-readable event description"
    )
    details: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional structured event data"
    )
    remediation: Optional[str] = Field(
        default=None,
        description="Suggested remediation action"
    )
    
    # Pydantic v2/v3 configuration
    model_config = {
        "json_schema_extra": {
            "example": {
                "timestamp": "2024-01-01T12:00:00Z",
                "event_type": "security_misconfiguration",
                "severity": "HIGH",
                "container_id": "abc123def456",
                "container_name": "web-app",
                "source": "security_posture_check",
                "description": "Container running as root user",
                "details": {"user": "root"},
                "remediation": "Configure container to run as non-root user"
            }
        }
    }
    
    @field_validator('container_id')
    @classmethod
    def validate_container_id(cls, v: Optional[str]) -> Optional[str]:
        """Validate Docker container ID format."""
        if v is not None and len(v) < 12:
            raise ValueError("Container ID must be at least 12 characters")
        return v
        
    @field_validator('severity')
    @classmethod
    def validate_severity_escalation(cls, v: str, info) -> str:
        """Auto-escalate severity based on event type."""
        event_type = info.data.get('event_type')
        
        # Critical security misconfigurations
        if event_type == 'security_misconfiguration':
            details = info.data.get('details', {})
            if details.get('privileged') or 'docker.sock' in str(details):
                return 'CRITICAL'
                
        return v
        
    def should_alert(self) -> bool:
        """Determine if this event requires immediate alerting."""
        return self.severity in ['CRITICAL', 'HIGH']
        
    def to_alert_format(self) -> Dict[str, Any]:
        """Convert to webhook alert format."""
        return {
            "severity": self.severity,
            "event_type": self.event_type,
            "container": self.container_name or "host",
            "source": self.source,
            "description": self.description,
            "timestamp": self.timestamp.isoformat(),
            "remediation": self.remediation
        }