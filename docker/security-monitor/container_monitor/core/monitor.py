"""
Main container security monitor orchestrator.

This module integrates all components from the specialized agents:
- Models from models agent
- Security from security agent  
- Async operations from async agent
- Testing from test agent
"""

import asyncio
import os
import signal
import fnmatch
from datetime import datetime, timezone
from typing import List, Optional
from pathlib import Path

import structlog

# Import all the available components
from container_monitor.models.events import SecurityEvent
from container_monitor.models.config import MonitorConfig
from container_monitor.adapters.docker_async import AsyncDockerClient
from container_monitor.monitoring.alerting import SecureAlertSender
from container_monitor.monitoring.file_watcher import AsyncFileWatcher
from container_monitor.monitoring.metrics import SecurityMetrics
from container_monitor.analyzers.behavior import BehaviorAnalyzer
from container_monitor.analyzers.posture import SecurityPostureChecker
from container_monitor.analyzers.network import NetworkAnalyzer
from container_monitor.core.reporting import ReportGenerator
from container_monitor.core.concurrency import BoundedExecutor
from container_monitor.config import load_config as load_config_sync, ConfigLoadError

logger = structlog.get_logger(__name__)


class ContainerMonitor:
    """
    Main security monitor that orchestrates all components.
    
    This class coordinates work from all specialized agents:
    - Uses models defined by models agent
    - Sends alerts via security agent's HMAC implementation
    - Monitors containers with async agent's adapter
    - Tested by test agent's comprehensive suite
    """
    
    def __init__(self, config: MonitorConfig):
        """
        Initialize the container monitor.
        
        Args:
            config: Configuration from models agent's MonitorConfig
        """
        self.config = config
        self.running = False
        
        # Core components 
        self.docker_client: Optional[AsyncDockerClient] = None
        self.alert_sender: Optional[SecureAlertSender] = None
        self.file_watcher: Optional[AsyncFileWatcher] = None
        self.behavior_analyzer: Optional[BehaviorAnalyzer] = None
        self.posture_checker: Optional[SecurityPostureChecker] = None
        self.network_analyzer: Optional[NetworkAnalyzer] = None
        self.report_generator: Optional[ReportGenerator] = None
        self.executor: Optional[BoundedExecutor] = None
        self.metrics: Optional[SecurityMetrics] = None
        
        # Event storage
        self.events: List[SecurityEvent] = []
        self.event_queue = asyncio.Queue(maxsize=1000)
        
        # State tracking
        self.monitored_containers = {}
        self.last_report_time = None
        
    async def initialize(self) -> None:
        """
        Initialize all components asynchronously.
        """
        logger.info("Initializing container security monitor")
        
        # Initialize metrics first
        self.metrics = SecurityMetrics()
        build_time = datetime.now(timezone.utc).isoformat()
        self.metrics.update_monitor_info("2.0.0", build_time)
        
        # Initialize concurrency control
        self.executor = BoundedExecutor(self.config)
        
        # Initialize Docker client
        self.docker_client = AsyncDockerClient(self.config)
        await self.docker_client.initialize()
        
        # Initialize analyzers
        self.behavior_analyzer = BehaviorAnalyzer(self.config)
        self.posture_checker = SecurityPostureChecker(self.config)
        self.network_analyzer = NetworkAnalyzer(self.config)
        self.report_generator = ReportGenerator(self.config)
        
        # Initialize alert sender if configured
        if self.config.alert_webhook:
            self.alert_sender = SecureAlertSender(self.config)
        
        # Initialize file watcher
        self.file_watcher = AsyncFileWatcher(self.config)
        self.file_watcher.set_event_handler(self._handle_file_event)
        
        logger.info("Container security monitor initialized successfully")
        
    async def start(self) -> None:
        """
        Start the security monitor.
        
        Coordinates all monitoring tasks from different agents.
        """
        self.running = True
        await self.initialize()
        
        logger.info("Starting container security monitor")
        
        # Start file monitoring if enabled
        if self.config.file_monitoring:
            asyncio.create_task(self.file_watcher.start())
        
        # Create task group for all monitoring activities
        try:
            async with asyncio.TaskGroup() as tg:
                tg.create_task(self._monitor_containers())
                tg.create_task(self._process_events())
                tg.create_task(self._generate_reports())
                tg.create_task(self._update_metrics())
        except* Exception as eg:
            # Handle any task group exceptions
            for exc in eg.exceptions:
                logger.error(f"Task failed: {exc}")
            raise
            
    async def stop(self) -> None:
        """Stop the monitor gracefully."""
        logger.info("Stopping container security monitor")
        self.running = False
        
        # Stop file watcher
        if self.file_watcher:
            await self.file_watcher.stop()
        
        # Close Docker client
        if self.docker_client:
            await self.docker_client.close()
        
        # Close alert sender
        if self.alert_sender:
            await self.alert_sender.__aexit__(None, None, None)
        
        logger.info("Container security monitor stopped")
        
    async def _monitor_containers(self) -> None:
        """Main container monitoring loop."""
        logger.info("Starting container monitoring loop")
        
        while self.running:
            try:
                # Get list of running containers
                containers = await self.docker_client.list_containers()
                
                # Filter containers matching patterns
                matching_containers = []
                for container in containers:
                    container_name = container.get('Names', [''])[0].lstrip('/')
                    if self._matches_patterns(container_name, self.config.container_patterns):
                        matching_containers.append(container)
                
                # Update metrics
                if self.metrics:
                    self.metrics.update_container_count(len(matching_containers))
                
                # Analyze each matching container
                analysis_tasks = []
                for container in matching_containers:
                    task = self.executor.execute(
                        self._analyze_container, 
                        container
                    )
                    analysis_tasks.append(task)
                
                # Wait for all analyses to complete
                if analysis_tasks:
                    await asyncio.gather(*analysis_tasks, return_exceptions=True)
                
                # Clean up old baselines
                if self.behavior_analyzer:
                    self.behavior_analyzer.cleanup_old_baselines()
                
                logger.debug(
                    "Container monitoring cycle completed",
                    containers_analyzed=len(matching_containers)
                )
                
            except Exception as e:
                logger.error(f"Error in container monitoring loop: {e}")
                if self.metrics:
                    self.metrics.record_error("monitor", "container_monitoring")
            
            # Wait for next monitoring interval
            await asyncio.sleep(self.config.monitor_interval)
            
    async def _analyze_container(self, container_info):
        """Analyze a single container using all available analyzers."""
        container_id = container_info.get('Id', '')
        container_name = container_info.get('Names', [''])[0].lstrip('/')
        
        try:
            all_events = []
            
            # Get detailed container information for posture analysis
            container_details = await self.docker_client.inspect_container(container_id)
            
            # Run all analyzers in parallel for better performance
            analysis_tasks = []
            
            # Behavior analysis
            if self.config.behavioral_analysis:
                task = self.behavior_analyzer.analyze_container(
                    self.docker_client, 
                    container_info
                )
                analysis_tasks.append(("behavior", task))
            
            # Security posture analysis  
            task = self.posture_checker.check_container_posture(
                self.docker_client,
                container_details
            )
            analysis_tasks.append(("posture", task))
            
            # Network analysis
            if self.config.network_monitoring:
                task = self.network_analyzer.analyze_network_traffic(
                    self.docker_client,
                    container_info
                )
                analysis_tasks.append(("network", task))
            
            # Execute all analyses
            for analyzer_name, task in analysis_tasks:
                try:
                    events = await task
                    all_events.extend(events)
                    logger.debug(
                        f"{analyzer_name} analysis completed",
                        container_id=container_id,
                        events_found=len(events)
                    )
                except Exception as e:
                    logger.error(
                        f"Error in {analyzer_name} analysis",
                        container_id=container_id,
                        container_name=container_name,
                        error=str(e)
                    )
                    
            # Queue events for processing
            for event in all_events:
                try:
                    self.event_queue.put_nowait(event)
                except asyncio.QueueFull:
                    logger.warning("Event queue full, dropping event")
                    if self.metrics:
                        self.metrics.record_error("monitor", "queue_full")
            
            # Update container state
            self.monitored_containers[container_id] = {
                'name': container_name,
                'last_analyzed': asyncio.get_event_loop().time(),
                'event_count': len(all_events),
                'analyzers_run': len(analysis_tasks)
            }
            
            logger.debug(
                "Container analysis completed",
                container_id=container_id,
                container_name=container_name,
                total_events=len(all_events),
                analyzers_used=len(analysis_tasks)
            )
            
        except Exception as e:
            logger.error(
                f"Error analyzing container {container_name}: {e}",
                container_id=container_id
            )
            
    def _matches_patterns(self, container_name: str, patterns: List[str]) -> bool:
        """Check if container name matches any of the patterns."""
        return any(
            fnmatch.fnmatch(container_name, pattern) 
            for pattern in patterns
        )
        
    async def _process_events(self) -> None:
        """Process security events from the queue."""
        logger.info("Starting event processing loop")
        
        while self.running:
            try:
                # Get event from queue with timeout
                try:
                    event = await asyncio.wait_for(
                        self.event_queue.get(), 
                        timeout=1.0
                    )
                except asyncio.TimeoutError:
                    continue
                
                # Store event
                self.events.append(event)
                
                # Add event to report generator
                if self.report_generator:
                    await self.report_generator.add_events([event])
                
                # Update metrics
                if self.metrics:
                    self.metrics.record_container_event(
                        event.event_type,
                        event.container_name or "unknown",
                        event.severity
                    )
                
                # Send alert if necessary
                if event.should_alert() and self.alert_sender:
                    try:
                        async with self.alert_sender:
                            await self.alert_sender.send_alert(event)
                    except Exception as e:
                        logger.error(f"Failed to send alert: {e}")
                        if self.metrics:
                            self.metrics.record_error("alert_sender", "send_failed")
                
                # Mark task as done
                self.event_queue.task_done()
                
            except Exception as e:
                logger.error(f"Error processing events: {e}")
                if self.metrics:
                    self.metrics.record_error("monitor", "event_processing")
            
            await asyncio.sleep(0.1)  # Small delay to prevent tight loop
        
    async def _generate_reports(self) -> None:
        """Report generation loop."""
        logger.info("Starting report generation loop")
        
        while self.running:
            try:
                await asyncio.sleep(self.config.report_interval)
                
                if not self.running:
                    break
                    
                # Generate comprehensive security report
                if self.report_generator:
                    try:
                        security_report = await self.report_generator.generate_security_report(
                            timeframe="24h",
                            report_format="json",
                            include_details=False  # Summary for periodic reporting
                        )
                        
                        logger.info(
                            "Security report generated",
                            status=security_report.get('executive_summary', {}).get('status', 'UNKNOWN'),
                            total_events=security_report.get('metadata', {}).get('total_events', 0),
                            risk_score=security_report.get('executive_summary', {}).get('risk_score', 0),
                            threat_level=security_report.get('threat_analysis', {}).get('threat_level', 'UNKNOWN')
                        )
                        
                    except Exception as e:
                        logger.error(f"Error generating comprehensive security report: {e}")
                        
                # Generate basic status report for backwards compatibility
                basic_report = self._create_status_report()
                
                logger.info(
                    "Security monitor status report",
                    **basic_report
                )
                
                # Update last report time
                self.last_report_time = asyncio.get_event_loop().time()
                
            except Exception as e:
                logger.error(f"Error generating reports: {e}")
                if self.metrics:
                    self.metrics.record_error("monitor", "report_generation")
                    
    async def _update_metrics(self) -> None:
        """Update system metrics periodically."""
        while self.running:
            try:
                if self.metrics:
                    # Update uptime
                    self.metrics.update_uptime()
                    
                    # Update queue sizes
                    self.metrics.update_queue_size("events", self.event_queue.qsize())
                    
                    # Update container counts
                    privileged_count = sum(
                        1 for container_info in self.monitored_containers.values()
                        if container_info.get('privileged', False)
                    )
                    self.metrics.update_privileged_count(privileged_count)
                
                await asyncio.sleep(30)  # Update every 30 seconds
                
            except Exception as e:
                logger.error(f"Error updating metrics: {e}")
                
    def _create_status_report(self) -> dict:
        """Create a status report."""
        current_time = asyncio.get_event_loop().time()
        
        # Count events by severity
        event_counts = {}
        for event in self.events[-100:]:  # Last 100 events
            severity = event.severity
            event_counts[severity] = event_counts.get(severity, 0) + 1
        
        return {
            "total_containers_monitored": len(self.monitored_containers),
            "total_events": len(self.events),
            "events_by_severity": event_counts,
            "event_queue_size": self.event_queue.qsize(),
            "uptime_seconds": current_time - (self.last_report_time or current_time),
            "docker_client_info": self.docker_client.get_client_info() if self.docker_client else {},
            "behavior_analyzer_stats": self.behavior_analyzer.get_analysis_stats() if self.behavior_analyzer else {},
            "posture_checker_stats": self.posture_checker.get_posture_summary() if self.posture_checker else {},
            "network_analyzer_stats": self.network_analyzer.get_network_summary() if self.network_analyzer else {},
            "report_generator_stats": self.report_generator.get_report_statistics() if self.report_generator else {},
            "executor_stats": self.executor.get_stats() if self.executor else {}
        }
        
    async def _handle_file_event(self, event: SecurityEvent) -> None:
        """Handle file system events from the file watcher."""
        try:
            self.event_queue.put_nowait(event)
        except asyncio.QueueFull:
            logger.warning("Event queue full, dropping file event")
            if self.metrics:
                self.metrics.record_error("monitor", "file_queue_full")


async def load_config() -> MonitorConfig:
    """
    Load configuration using the new configuration bridge loader.
    
    This function now uses the ConfigLoader to properly load YAML configuration
    files into the MonitorConfig Pydantic model with validation and error handling.
    
    Returns:
        Loaded and validated MonitorConfig instance
    """
    try:
        # Use the synchronous config loader in a thread to maintain async compatibility
        config = await asyncio.get_event_loop().run_in_executor(
            None, 
            load_config_sync,
            "/app/config/monitor.yaml",  # config_path
            True,  # env_override
            True   # enable_security_validation
        )
        
        logger.info(
            "Configuration loaded successfully via ConfigLoader",
            config_file="/app/config/monitor.yaml",
            monitor_interval=config.monitor_interval,
            features_enabled=sum([
                config.network_monitoring,
                config.file_monitoring, 
                config.process_monitoring,
                config.behavioral_analysis
            ]),
            container_patterns=len(config.container_patterns)
        )
        
        return config
        
    except ConfigLoadError as e:
        logger.error(
            "Configuration loading failed with validation errors",
            error=str(e)
        )
        
        # In production, fail fast on config errors
        if os.environ.get('ENVIRONMENT') == 'production':
            logger.critical("Refusing to start with invalid configuration in production")
            raise
        
        # In development, fall back to defaults with warning
        logger.warning("Falling back to default configuration (development mode)")
        return MonitorConfig()
        
    except Exception as e:
        logger.error(
            "Unexpected error loading configuration",
            error=str(e),
            error_type=type(e).__name__
        )
        
        # Always fall back to defaults for unexpected errors
        logger.warning("Using default configuration due to unexpected error")
        return MonitorConfig()


async def main():
    """Main entry point."""
    logger.info("Starting Container Security Monitor v2.0.0")
    
    # Load configuration
    config = await load_config()
    
    # Create monitor instance
    monitor = ContainerMonitor(config)
    
    # Signal handling for graceful shutdown
    shutdown_event = asyncio.Event()
    
    def signal_handler():
        logger.info("Received shutdown signal")
        shutdown_event.set()
    
    # Register signal handlers
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, signal_handler)
    
    try:
        # Start monitor in background
        monitor_task = asyncio.create_task(monitor.start())
        
        # Wait for shutdown signal
        await shutdown_event.wait()
        
        logger.info("Shutting down monitor...")
        await monitor.stop()
        
        # Cancel monitor task if still running
        if not monitor_task.done():
            monitor_task.cancel()
            try:
                await monitor_task
            except asyncio.CancelledError:
                pass
        
    except Exception as e:
        logger.error(f"Monitor failed: {e}")
        raise
    finally:
        logger.info("Container monitor shutdown complete")


if __name__ == "__main__":
    asyncio.run(main())