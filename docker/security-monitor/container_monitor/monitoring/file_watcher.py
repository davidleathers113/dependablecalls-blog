"""
Async file system monitoring using watchfiles.

Provides:
- Non-blocking file system event monitoring
- Lower CPU usage than watchdog
- Rust-based performance
- Security-focused filtering
"""

import asyncio
from pathlib import Path
from typing import List, Optional, Callable, Set
from datetime import datetime, timezone

import structlog
from watchfiles import awatch, Change

from container_monitor.models.events import SecurityEvent
from container_monitor.models.config import MonitorConfig

logger = structlog.get_logger(__name__)


class AsyncFileWatcher:
    """
    Async file system watcher for security monitoring.
    
    Features:
    - Uses watchfiles (Rust-based) for efficiency
    - Filters security-relevant changes
    - Batches events for processing
    - Ignores noisy file patterns
    """
    
    def __init__(self, config: MonitorConfig):
        """
        Initialize the file watcher.
        
        Args:
            config: Monitor configuration
        """
        self.config = config
        self.monitored_paths = [
            Path(p) for p in config.monitored_directories
            if Path(p).exists()
        ]
        
        # Security-relevant files to track
        self.security_files = {
            '/etc/passwd',
            '/etc/shadow', 
            '/etc/sudoers',
            '/etc/hosts',
            '/etc/ssh/sshd_config',
            '/root/.ssh/authorized_keys'
        }
        
        # Patterns to ignore
        self.ignore_patterns = {
            '.tmp', '.log', '.cache', '.swp',
            '.pid', 'proc/', 'sys/', '.git/'
        }
        
        # Event callback
        self.event_handler: Optional[Callable] = None
        
        # Tracking
        self.events_detected = 0
        self.watching = False
        
    def set_event_handler(self, handler: Callable[[SecurityEvent], None]):
        """Set the callback for security events."""
        self.event_handler = handler
        
    async def start(self):
        """Start watching file system."""
        if not self.config.file_monitoring:
            logger.info("File monitoring disabled")
            return
            
        if not self.monitored_paths:
            logger.warning("No valid paths to monitor")
            return
            
        self.watching = True
        logger.info(
            "Starting file monitoring",
            paths=[str(p) for p in self.monitored_paths]
        )
        
        # Create watch tasks for each path
        tasks = [
            self._watch_path(path) 
            for path in self.monitored_paths
        ]
        
        # Run all watchers concurrently
        await asyncio.gather(*tasks, return_exceptions=True)
        
    async def stop(self):
        """Stop watching file system."""
        self.watching = False
        logger.info("Stopped file monitoring")
        
    async def _watch_path(self, path: Path):
        """
        Watch a specific path for changes.
        
        Args:
            path: Path to monitor
        """
        try:
            async for changes in awatch(path, recursive=True):
                if not self.watching:
                    break
                    
                await self._process_changes(changes)
                
        except Exception as e:
            logger.error(f"Error watching {path}: {e}")
            
    async def _process_changes(self, changes: Set[tuple[Change, str]]):
        """
        Process file system changes.
        
        Args:
            changes: Set of (Change, path) tuples
        """
        # Batch similar events
        events_by_type = {
            Change.added: [],
            Change.modified: [],
            Change.deleted: []
        }
        
        for change_type, file_path in changes:
            # Filter out noisy files
            if self._should_ignore(file_path):
                continue
                
            events_by_type[change_type].append(file_path)
            
        # Process each type
        for change_type, paths in events_by_type.items():
            if paths:
                await self._create_events(change_type, paths)
                
    def _should_ignore(self, file_path: str) -> bool:
        """
        Check if file should be ignored.
        
        Args:
            file_path: Path to check
            
        Returns:
            True if should be ignored
        """
        return any(
            pattern in file_path 
            for pattern in self.ignore_patterns
        )
        
    async def _create_events(
        self, 
        change_type: Change, 
        file_paths: List[str]
    ):
        """
        Create security events for file changes.
        
        Args:
            change_type: Type of change
            file_paths: Changed file paths
        """
        # Map change types
        change_map = {
            Change.added: "created",
            Change.modified: "modified",
            Change.deleted: "deleted"
        }
        
        change_str = change_map.get(change_type, "unknown")
        
        for file_path in file_paths:
            # Determine severity
            is_security_file = any(
                sec_file in file_path 
                for sec_file in self.security_files
            )
            
            severity = "HIGH" if is_security_file else "MEDIUM"
            
            # Check for suspicious patterns
            if self._is_suspicious_change(file_path, change_type):
                severity = "CRITICAL"
                
            # Create event
            event = SecurityEvent(
                event_type="file_system_change",
                severity=severity,
                source="file_watcher",
                description=f"File {change_str}: {file_path}",
                details={
                    "change_type": change_str,
                    "file_path": file_path,
                    "is_security_file": is_security_file,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                },
                remediation=(
                    "Investigate unauthorized file changes immediately"
                    if is_security_file
                    else "Review file change for security implications"
                )
            )
            
            self.events_detected += 1
            
            # Notify handler
            if self.event_handler:
                try:
                    await asyncio.create_task(
                        self.event_handler(event)
                    )
                except Exception as e:
                    logger.error(
                        "Error in event handler",
                        error=str(e),
                        event_type=event.event_type
                    )
                    
    def _is_suspicious_change(
        self, 
        file_path: str, 
        change_type: Change
    ) -> bool:
        """
        Check if change is suspicious.
        
        Args:
            file_path: Changed file
            change_type: Type of change
            
        Returns:
            True if suspicious
        """
        suspicious_patterns = [
            # New executables in system directories
            (Change.added, '/usr/bin/', '.sh'),
            (Change.added, '/usr/sbin/', ''),
            (Change.added, '/tmp/', '.sh'),
            
            # Modified security files
            (Change.modified, '/etc/passwd', ''),
            (Change.modified, '/etc/shadow', ''),
            (Change.modified, '/etc/sudoers', ''),
            
            # Deleted logs
            (Change.deleted, '/var/log/', '.log'),
            
            # Hidden files in sensitive locations
            (Change.added, '/etc/', '.'),
            (Change.added, '/root/', '.')
        ]
        
        for pattern_type, pattern_path, pattern_suffix in suspicious_patterns:
            if (
                change_type == pattern_type and
                pattern_path in file_path and
                (not pattern_suffix or file_path.endswith(pattern_suffix))
            ):
                return True
                
        return False
        
    def get_stats(self) -> dict:
        """Get watcher statistics."""
        return {
            "watching": self.watching,
            "monitored_paths": len(self.monitored_paths),
            "events_detected": self.events_detected,
            "security_files_tracked": len(self.security_files)
        }