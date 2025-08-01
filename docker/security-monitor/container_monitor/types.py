"""
Shared type definitions for the container monitor package.
"""

from typing import TypeAlias, Literal, Dict, Any

# Severity levels for security events
SeverityLevel: TypeAlias = Literal["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]

# Event types
EventType: TypeAlias = Literal[
    "file_system_change",
    "resource_anomaly", 
    "suspicious_process",
    "network_anomaly",
    "security_misconfiguration",
    "network_security",
    "behavioral_anomaly",
    "posture_check_error",
    "network_analysis_error",
    "analysis_error",
    "security_recommendation",
    "network_scanning",
    "data_exfiltration"
]

# Container stats dictionary
ContainerStats: TypeAlias = Dict[str, Any]

# Metric types
MetricType: TypeAlias = Literal["cpu", "memory", "network", "disk"]