#!/usr/bin/env python3

"""
Container Runtime Security Monitor
=================================

This module provides comprehensive runtime security monitoring for
containerized applications. It monitors container behavior, network traffic,
file system changes, and security events.

Features:
- Container behavior analysis
- Network traffic monitoring
- File system integrity monitoring
- Process monitoring and anomaly detection
- Security event correlation
- Real-time alerting
- Compliance reporting
"""

import asyncio
import json
import os
import signal
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import docker
import docker.models.containers
import structlog
import yaml
from pydantic import BaseModel, Field
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger(__name__)


class SecurityEvent(BaseModel):
    """Security event model"""
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    event_type: str
    severity: str
    container_id: Optional[str] = None
    container_name: Optional[str] = None
    source: str
    description: str
    details: Dict[str, Any] = Field(default_factory=dict)
    remediation: Optional[str] = None


class MonitorConfig(BaseModel):
    """Security monitor configuration"""
    monitor_interval: int = 30
    container_patterns: List[str] = Field(default_factory=lambda: ["dce-*"])
    network_monitoring: bool = True
    file_monitoring: bool = True
    process_monitoring: bool = True
    behavioral_analysis: bool = True
    alert_webhook: Optional[str] = None
    report_interval: int = 300  # 5 minutes
    retention_days: int = 30

    # Thresholds
    cpu_threshold: float = 80.0
    memory_threshold: float = 80.0
    network_threshold_mbps: float = 100.0
    file_change_threshold: int = 100

    # Security policies
    allowed_ports: List[int] = Field(
        default_factory=lambda: [80, 443, 8080, 3000, 4173, 5173]
    )
    blocked_processes: List[str] = Field(
        default_factory=lambda: ["nc", "netcat", "telnet", "ftp"]
    )
    monitored_directories: List[str] = Field(
        default_factory=lambda: ["/etc", "/usr/bin", "/usr/sbin"]
    )


class ContainerMonitor:
    """Container runtime security monitor"""

    def __init__(self, config: MonitorConfig):
        self.config = config
        self.docker_client: docker.DockerClient = docker.from_env()
        self.events: List[SecurityEvent] = []
        self.container_baselines: Dict[str, Dict[str, Any]] = {}
        self.file_observer: Optional[Observer] = None
        self.running = False

        # Initialize monitoring components
        self._setup_file_monitoring()

    def _setup_file_monitoring(self) -> None:
        """Setup file system monitoring"""
        if not self.config.file_monitoring:
            return

        class SecurityEventHandler(FileSystemEventHandler):
            def __init__(self, monitor: 'ContainerMonitor'):
                self.monitor = monitor

            def on_modified(self, event):
                if not event.is_directory:
                    self.monitor._handle_file_change(
                        "modified", event.src_path
                    )

            def on_created(self, event):
                if not event.is_directory:
                    self.monitor._handle_file_change("created", event.src_path)

            def on_deleted(self, event):
                if not event.is_directory:
                    self.monitor._handle_file_change("deleted", event.src_path)

        self.file_observer = Observer()
        event_handler = SecurityEventHandler(self)

        # Monitor configured directories
        for directory in self.config.monitored_directories:
            if Path(directory).exists():
                self.file_observer.schedule(
                    event_handler, directory, recursive=True
                )
                logger.info(f"Monitoring directory: {directory}")

    def _handle_file_change(self, change_type: str, file_path: str) -> None:
        """Handle file system changes"""
        # Filter out noisy changes
        # Filter out noisy changes
        noisy_patterns = ['.tmp', '.log', '.cache', 'proc/']
        if any(pattern in file_path for pattern in noisy_patterns):
            return

        # Check if this is a security-relevant file
        security_files = [
            '/etc/passwd', '/etc/shadow', '/etc/sudoers', '/etc/hosts'
        ]
        is_security_file = any(
            sec_file in file_path for sec_file in security_files
        )

        severity = "HIGH" if is_security_file else "MEDIUM"

        event = SecurityEvent(
            event_type="file_system_change",
            severity=severity,
            source="file_monitor",
            description=f"File {change_type}: {file_path}",
            details={
                "change_type": change_type,
                "file_path": file_path,
                "is_security_file": is_security_file
            },
            remediation=(
                "Investigate unauthorized file changes"
                if is_security_file else None
            )
        )

        self._add_event(event)

    def _add_event(self, event: SecurityEvent) -> None:
        """Add security event and handle alerting"""
        self.events.append(event)

        logger.info(
            "Security event detected",
            event_type=event.event_type,
            severity=event.severity,
            container=event.container_name,
            description=event.description
        )

        # Send alerts for high severity events
        if event.severity in ["CRITICAL", "HIGH"]:
            asyncio.create_task(self._send_alert(event))

    async def _send_alert(self, event: SecurityEvent) -> None:
        """Send security alert"""
        if not self.config.alert_webhook:
            return

        try:
            import aiohttp

            alert_payload = {
                "text": f"🚨 Container Security Alert: {event.event_type}",
                "attachments": [
                    {
                        "color": (
                            "danger" if event.severity == "CRITICAL"
                            else "warning"
                        ),
                        "fields": [
                            {
                                "title": "Severity",
                                "value": event.severity,
                                "short": True
                            },
                            {
                                "title": "Container",
                                "value": event.container_name or "Host",
                                "short": True
                            },
                            {
                                "title": "Event Type",
                                "value": event.event_type,
                                "short": True
                            },
                            {
                                "title": "Source",
                                "value": event.source,
                                "short": True
                            },
                            {
                                "title": "Description",
                                "value": event.description,
                                "short": False
                            },
                            {
                                "title": "Timestamp",
                                "value": event.timestamp.isoformat(),
                                "short": True
                            }
                        ]
                    }
                ]
            }

            if event.remediation:
                # Type-safe access to nested structure
                attachments = alert_payload.get("attachments", [])
                if attachments and isinstance(attachments[0], dict):
                    fields = attachments[0].get("fields", [])
                    if isinstance(fields, list):
                        fields.append({
                            "title": "Remediation",
                            "value": event.remediation,
                            "short": False
                        })

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.config.alert_webhook,
                    json=alert_payload,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        logger.info("Alert sent successfully")
                    else:
                        logger.error(f"Failed to send alert: {response.status}")

        except (aiohttp.ClientError, asyncio.TimeoutError) as e:
            logger.error(f"Error sending alert: {e}")

    def _establish_container_baseline(
        self, container: docker.models.containers.Container
    ) -> Dict[str, Any]:
        """Establish baseline metrics for a container"""
        try:
            stats = container.stats(stream=False)

            # Calculate CPU and memory usage
            cpu_percent = self._calculate_cpu_percent(stats)
            memory_usage = stats['memory_stats'].get('usage', 0)
            memory_limit = stats['memory_stats'].get('limit', 0)
            memory_percent = (
                (memory_usage / memory_limit * 100)
                if memory_limit > 0 else 0
            )

            # Network statistics
            network_stats = stats.get('networks', {})
            total_rx_bytes = sum(
                net.get('rx_bytes', 0) for net in network_stats.values()
            )
            total_tx_bytes = sum(
                net.get('tx_bytes', 0) for net in network_stats.values()
            )

            baseline = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "cpu_percent": cpu_percent,
                "memory_percent": memory_percent,
                "memory_usage": memory_usage,
                "network_rx_bytes": total_rx_bytes,
                "network_tx_bytes": total_tx_bytes,
                "process_count": len(self._get_container_processes(container))
            }

            self.container_baselines[container.id] = baseline
            logger.info(f"Established baseline for container {container.name}")

            return baseline

        except (docker.errors.APIError, KeyError, ValueError) as e:
            logger.error(f"Error establishing baseline for {container.name}: {e}")
            return {}

    def _calculate_cpu_percent(self, stats: Dict[str, Any]) -> float:
        """Calculate CPU usage percentage from Docker stats"""
        try:
            cpu_stats = stats['cpu_stats']
            precpu_stats = stats['precpu_stats']

            cpu_delta = (
                cpu_stats['cpu_usage']['total_usage'] -
                precpu_stats['cpu_usage']['total_usage']
            )
            system_delta = (
                cpu_stats['system_cpu_usage'] -
                precpu_stats['system_cpu_usage']
            )
            number_cpus = len(cpu_stats['cpu_usage']['percpu_usage'])

            if system_delta > 0 and cpu_delta > 0:
                return (cpu_delta / system_delta) * number_cpus * 100.0
            return 0.0

        except (KeyError, ZeroDivisionError):
            return 0.0

    def _get_container_processes(
        self, container: docker.models.containers.Container
    ) -> List[Dict[str, Any]]:
        """Get list of processes running in container"""
        try:
            top_result = container.top()
            processes = []

            if top_result and 'Processes' in top_result:
                titles = top_result.get('Titles', [])
                for process in top_result['Processes']:
                    process_info = dict(zip(titles, process))
                    processes.append(process_info)

            return processes

        except (docker.errors.APIError, KeyError) as e:
            logger.error(f"Error getting processes for {container.name}: {e}")
            return []

    def _analyze_container_behavior(
        self, container: docker.models.containers.Container
    ) -> List[SecurityEvent]:
        """Analyze container behavior for anomalies"""
        events = []

        try:
            # Get current stats
            stats = container.stats(stream=False)
            current_metrics = {
                "cpu_percent": self._calculate_cpu_percent(stats),
                "memory_usage": stats['memory_stats'].get('usage', 0),
                "memory_limit": stats['memory_stats'].get('limit', 0)
            }

            current_metrics["memory_percent"] = (
                current_metrics["memory_usage"] / current_metrics["memory_limit"] * 100
                if current_metrics["memory_limit"] > 0 else 0
            )

            # Check thresholds
            if current_metrics["cpu_percent"] > self.config.cpu_threshold:
                events.append(SecurityEvent(
                    event_type="resource_anomaly",
                    severity="MEDIUM",
                    container_id=container.id,
                    container_name=container.name,
                    source="behavior_analyzer",
                    description=(
                        f"High CPU usage: {current_metrics['cpu_percent']:.1f}%"
                    ),
                    details={
                        "metric": "cpu",
                        "value": current_metrics["cpu_percent"],
                        "threshold": self.config.cpu_threshold
                    },
                    remediation="Investigate high CPU usage and potential runaway processes"
                ))

            if current_metrics["memory_percent"] > self.config.memory_threshold:
                events.append(SecurityEvent(
                    event_type="resource_anomaly",
                    severity="MEDIUM",
                    container_id=container.id,
                    container_name=container.name,
                    source="behavior_analyzer",
                    description=(
                        f"High memory usage: {current_metrics['memory_percent']:.1f}%"
                    ),
                    details={
                        "metric": "memory",
                        "value": current_metrics["memory_percent"],
                        "threshold": self.config.memory_threshold
                    },
                    remediation=(
                        "Investigate memory leak or excessive memory usage"
                    )
                ))

            # Analyze processes
            processes = self._get_container_processes(container)
            for process in processes:
                command = process.get('CMD', '') or process.get('COMMAND', '')

                # Check for blocked processes
                for blocked_proc in self.config.blocked_processes:
                    if blocked_proc in command.lower():
                        events.append(SecurityEvent(
                            event_type="suspicious_process",
                            severity="HIGH",
                            container_id=container.id,
                            container_name=container.name,
                            source="process_monitor",
                            description=f"Blocked process detected: {command}",
                            details={
                            "process": command,
                            "blocked_processes": self.config.blocked_processes
                        },
                            remediation="Investigate and terminate unauthorized processes"
                        ))

            # Check for network anomalies
            network_stats = stats.get('networks', {})
            for interface, net_stats in network_stats.items():
                rx_bytes = net_stats.get('rx_bytes', 0)
                tx_bytes = net_stats.get('tx_bytes', 0)

                # Convert to Mbps (rough approximation)
                rx_mbps = (rx_bytes * 8) / (1024 * 1024 * self.config.monitor_interval)
                tx_mbps = (tx_bytes * 8) / (1024 * 1024 * self.config.monitor_interval)

                if rx_mbps > self.config.network_threshold_mbps or tx_mbps > self.config.network_threshold_mbps:
                    events.append(SecurityEvent(
                        event_type="network_anomaly",
                        severity="MEDIUM",
                        container_id=container.id,
                        container_name=container.name,
                        source="network_monitor",
                        description=(
                            f"High network traffic on {interface}: "
                            f"RX {rx_mbps:.1f} Mbps, TX {tx_mbps:.1f} Mbps"
                        ),
                        details={
                            "interface": interface,
                            "rx_mbps": rx_mbps,
                            "tx_mbps": tx_mbps,
                            "threshold": self.config.network_threshold_mbps
                        },
                        remediation="Investigate unusual network activity"
                    ))

        except (docker.errors.APIError, KeyError, ValueError) as e:
            logger.error(f"Error analyzing behavior for {container.name}: {e}")

        return events

    def _check_container_security_posture(self, container: docker.models.containers.Container) -> List[SecurityEvent]:
        """Check container security configuration"""
        events = []

        try:
            # Get container configuration
            container_config = container.attrs.get('Config', {})
            host_config = container.attrs.get('HostConfig', {})

            # Check if running as root
            user = container_config.get('User', '')
            if not user or user == '0' or user == 'root':
                events.append(SecurityEvent(
                    event_type="security_misconfiguration",
                    severity="HIGH",
                    container_id=container.id,
                    container_name=container.name,
                    source="security_posture_check",
                    description="Container running as root user",
                    details={"user": user or "root"},
                    remediation="Configure container to run as non-root user"
                ))

            # Check for privileged mode
            if host_config.get('Privileged', False):
                events.append(SecurityEvent(
                    event_type="security_misconfiguration",
                    severity="CRITICAL",
                    container_id=container.id,
                    container_name=container.name,
                    source="security_posture_check",
                    description="Container running in privileged mode",
                    details={"privileged": True},
                    remediation="Remove privileged mode and use specific capabilities instead"
                ))

            # Check exposed ports
            ports = container_config.get('ExposedPorts', {})
            for port in ports.keys():
                port_num = int(port.split('/')[0])
                if port_num not in self.config.allowed_ports:
                    events.append(SecurityEvent(
                        event_type="network_security",
                        severity="MEDIUM",
                        container_id=container.id,
                        container_name=container.name,
                        source="security_posture_check",
                        description=(
                            f"Container exposes non-standard port: {port}"
                        ),
                        details={
                            "exposed_port": port,
                            "allowed_ports": self.config.allowed_ports
                        },
                        remediation="Review port exposure and close unnecessary ports"
                    ))

            # Check volume mounts
            mounts = container.attrs.get('Mounts', [])
            for mount in mounts:
                source = mount.get('Source', '')

                # Check for Docker socket mount
                if '/var/run/docker.sock' in source:
                    events.append(SecurityEvent(
                        event_type="security_misconfiguration",
                        severity="CRITICAL",
                        container_id=container.id,
                        container_name=container.name,
                        source="security_posture_check",
                        description="Container has access to Docker socket",
                        details={"mount_source": source},
                        remediation="Remove Docker socket mount or make it read-only"
                    ))

                # Check for sensitive directory mounts
                sensitive_dirs = ['/etc', '/proc', '/sys', '/boot']
                for sens_dir in sensitive_dirs:
                    if source.startswith(sens_dir):
                        events.append(SecurityEvent(
                            event_type="security_misconfiguration",
                            severity="HIGH",
                            container_id=container.id,
                            container_name=container.name,
                            source="security_posture_check",
                            description=(
                        f"Container mounts sensitive directory: {source}"
                    ),
                            details={"mount_source": source},
                            remediation="Avoid mounting sensitive host directories"
                        ))

        except (docker.errors.APIError, KeyError, AttributeError) as e:
            logger.error(f"Error checking security posture for {container.name}: {e}")

        return events

    def _get_monitored_containers(self) -> List[docker.models.containers.Container]:
        """Get list of containers to monitor"""
        containers = []

        try:
            all_containers = self.docker_client.containers.list()

            for container in all_containers:
                # Check if container matches monitoring patterns
                container_name = container.name

                if self.config.container_patterns:
                    for pattern in self.config.container_patterns:
                        if pattern.replace('*', '') in container_name:
                            containers.append(container)
                            break
                else:
                    # Monitor all containers if no patterns specified
                    containers.append(container)

        except Exception as e:
            logger.error(f"Error getting containers: {e}")

        return containers

    def _generate_security_report(self) -> Dict[str, Any]:
        """Generate security monitoring report"""
        now = datetime.now(timezone.utc)

        # Categorize events by severity
        event_summary = {
            "CRITICAL": len([e for e in self.events if e.severity == "CRITICAL"]),
            "HIGH": len([e for e in self.events if e.severity == "HIGH"]),
            "MEDIUM": len([e for e in self.events if e.severity == "MEDIUM"]),
            "LOW": len([e for e in self.events if e.severity == "LOW"]),
            "INFO": len([e for e in self.events if e.severity == "INFO"])
        }

        # Get monitored containers info
        containers = self._get_monitored_containers()
        container_info = []

        for container in containers:
            try:
                stats = container.stats(stream=False)
                cpu_percent = self._calculate_cpu_percent(stats)
                memory_usage = stats['memory_stats'].get('usage', 0)
                memory_limit = stats['memory_stats'].get('limit', 0)
                memory_percent = (
                (memory_usage / memory_limit * 100)
                if memory_limit > 0 else 0
            )

                container_info.append({
                    "id": container.id[:12],
                    "name": container.name,
                    "status": container.status,
                    "image": container.attrs['Config']['Image'],
                    "cpu_percent": round(cpu_percent, 2),
                    "memory_percent": round(memory_percent, 2),
                    "created": container.attrs['Created'],
                    "ports": list(
                        container.attrs['Config'].get('ExposedPorts', {}).keys()
                    )
                })
            except Exception as e:
                logger.error(f"Error getting stats for {container.name}: {e}")
                container_info.append({
                    "id": container.id[:12],
                    "name": container.name,
                    "status": container.status,
                    "error": str(e)
                })

        report = {
            "timestamp": now.isoformat(),
            "monitoring_period": f"{self.config.monitor_interval} seconds",
            "summary": {
                "total_events": len(self.events),
                "containers_monitored": len(containers),
                "event_breakdown": event_summary
            },
            "containers": container_info,
            "recent_events": [
                {
                    "timestamp": event.timestamp.isoformat(),
                    "event_type": event.event_type,
                    "severity": event.severity,
                    "container": event.container_name,
                    "description": event.description
                }
                for event in sorted(
                    self.events, key=lambda x: x.timestamp, reverse=True
                )[:20]
            ],
            "recommendations": self._generate_recommendations(event_summary)
        }

        return report

    def _generate_recommendations(self, event_summary: Dict[str, int]) -> List[str]:
        """Generate security recommendations based on events"""
        recommendations = []

        total_critical_high = event_summary["CRITICAL"] + event_summary["HIGH"]

        if event_summary["CRITICAL"] > 0:
            recommendations.append(
                f"🚨 URGENT: {event_summary['CRITICAL']} critical security events "
                f"require immediate attention"
            )

        if event_summary["HIGH"] > 5:
            recommendations.append(
                f"⚠️ HIGH PRIORITY: {event_summary['HIGH']} high-severity events "
                f"should be addressed promptly"
            )

        if total_critical_high == 0:
            recommendations.append(
                "✅ No critical or high-severity security events detected"
            )

        recommendations.extend([
            "🔍 Review container security configurations regularly",
            "📊 Monitor resource usage patterns for anomalies",
            "🔒 Ensure containers run with minimal privileges",
            "🌐 Validate network traffic patterns",
            "📁 Monitor file system changes in sensitive directories"
        ])

        return recommendations

    async def monitor_loop(self) -> None:
        """Main monitoring loop"""
        logger.info("Starting container security monitoring")

        while self.running:
            try:
                containers = self._get_monitored_containers()
                logger.info(f"Monitoring {len(containers)} containers")

                for container in containers:
                    # Establish baseline if not exists
                    if container.id not in self.container_baselines:
                        self._establish_container_baseline(container)

                    # Analyze container behavior
                    if self.config.behavioral_analysis:
                        behavior_events = self._analyze_container_behavior(container)
                        for event in behavior_events:
                            self._add_event(event)

                    # Check security posture
                    security_events = self._check_container_security_posture(container)
                    for event in security_events:
                        self._add_event(event)

                # Clean up old events
                cutoff_time = (
                    datetime.now(timezone.utc).timestamp() -
                    (self.config.retention_days * 24 * 3600)
                )
                self.events = [
                    e for e in self.events
                    if e.timestamp.timestamp() > cutoff_time
                ]

                await asyncio.sleep(self.config.monitor_interval)

            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                await asyncio.sleep(5)  # Short delay before retrying

    async def report_loop(self) -> None:
        """Generate periodic security reports"""
        while self.running:
            try:
                await asyncio.sleep(self.config.report_interval)

                report = self._generate_security_report()

                # Save report to file
                reports_dir = Path("/app/reports")
                reports_dir.mkdir(exist_ok=True)

                timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
                report_file = reports_dir / f"security_report_{timestamp}.json"

                with open(report_file, 'w', encoding='utf-8') as f:
                    json.dump(report, f, indent=2)

                logger.info(f"Security report generated: {report_file}")

                # Log summary
                summary = report["summary"]
                logger.info(
                    "Security monitoring summary",
                    total_events=summary["total_events"],
                    containers_monitored=summary["containers_monitored"],
                    critical=summary["event_breakdown"]["CRITICAL"],
                    high=summary["event_breakdown"]["HIGH"]
                )

            except Exception as e:
                logger.error(f"Error generating report: {e}")

    async def start(self) -> None:
        """Start the security monitor"""
        self.running = True

        # Start file monitoring
        if self.file_observer and self.config.file_monitoring:
            self.file_observer.start()
            logger.info("File system monitoring started")

        # Start monitoring tasks
        tasks = [
            asyncio.create_task(self.monitor_loop()),
            asyncio.create_task(self.report_loop())
        ]

        try:
            await asyncio.gather(*tasks)
        except KeyboardInterrupt:
            logger.info("Received shutdown signal")
        finally:
            await self.stop()

    async def stop(self) -> None:
        """Stop the security monitor"""
        logger.info("Stopping container security monitor")
        self.running = False

        # Stop file monitoring
        if self.file_observer:
            self.file_observer.stop()
            self.file_observer.join()

        # Generate final report
        try:
            final_report = self._generate_security_report()

            reports_dir = Path("/app/reports")
            reports_dir.mkdir(exist_ok=True)

            final_report_file = reports_dir / "final_security_report.json"
            with open(final_report_file, 'w', encoding='utf-8') as f:
                json.dump(final_report, f, indent=2)

            logger.info(f"Final security report saved: {final_report_file}")

        except Exception as e:
            logger.error(f"Error generating final report: {e}")


def load_config() -> MonitorConfig:
    """Load monitoring configuration"""
    config_file = Path("/app/config/monitor.yaml")

    if config_file.exists():
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                config_data = yaml.safe_load(f)
            return MonitorConfig(**config_data)
        except Exception as e:
            logger.warning(f"Error loading config file: {e}, using defaults")

    # Use environment variables or defaults
    return MonitorConfig(
        monitor_interval=int(os.environ.get('MONITOR_INTERVAL', 30)),
        alert_webhook=os.environ.get('ALERT_WEBHOOK'),
        network_monitoring=(
            os.environ.get('NETWORK_MONITORING', 'true').lower() == 'true'
        ),
        file_monitoring=os.environ.get('FILE_MONITORING', 'true').lower() == 'true'
    )


async def main():
    """Main entry point"""
    # Setup signal handlers
    def signal_handler(signum, frame):
        logger.info(f"Received signal {signum}")
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Load configuration
    config = load_config()
    logger.info("Container security monitor starting", config=config.model_dump())

    # Create and start monitor
    monitor = ContainerMonitor(config)

    try:
        await monitor.start()
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
