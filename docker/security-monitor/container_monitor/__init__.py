"""
Container Runtime Security Monitor
=================================

A production-grade security monitoring solution for containerized applications.

Features:
- Real-time container behavior analysis
- Network traffic monitoring
- File system integrity monitoring
- Security event correlation and alerting
- Compliance reporting
"""

from container_monitor.__version__ import __version__

# Lazy imports to avoid heavy dependencies during config loading
def _lazy_import():
    """Lazy import for heavy dependencies."""
    try:
        from container_monitor.core.monitor import ContainerMonitor
        from container_monitor.models.events import SecurityEvent
        return ContainerMonitor, SecurityEvent
    except ImportError:
        # Return None if dependencies are not available
        return None, None

# Check if settings module exists
try:
    from container_monitor.config.settings import MonitorSettings
except ImportError:
    MonitorSettings = None

ContainerMonitor, SecurityEvent = _lazy_import()

__all__ = [
    "__version__",
    "ContainerMonitor",
    "SecurityEvent", 
    "MonitorSettings",
]