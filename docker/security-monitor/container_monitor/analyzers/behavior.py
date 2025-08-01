"""
Container behavior analysis for anomaly detection.

Monitors:
- CPU usage patterns and anomalies
- Memory consumption and leaks
- Process monitoring and blacklist detection
- Resource usage baselines and deviations
- Behavioral pattern analysis
"""

import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone, timedelta
from collections import deque
import structlog

from container_monitor.models.events import SecurityEvent
from container_monitor.models.config import MonitorConfig
from container_monitor.adapters.docker_async import AsyncDockerClient

logger = structlog.get_logger(__name__)


class ContainerBaseline:
    """Tracks baseline metrics for a container."""
    
    def __init__(self, container_id: str, container_name: str):
        self.container_id = container_id
        self.container_name = container_name
        self.established_at = datetime.now(timezone.utc)
        
        # Baseline metrics
        self.cpu_percent_baseline = 0.0
        self.memory_percent_baseline = 0.0
        self.process_count_baseline = 0
        self.network_rx_baseline = 0
        self.network_tx_baseline = 0
        
        # Historical data for trend analysis
        self.cpu_history: deque = deque(maxlen=50)
        self.memory_history: deque = deque(maxlen=50)
        self.process_history: deque = deque(maxlen=20)
        
        # Anomaly tracking
        self.anomaly_count = 0
        self.last_anomaly = None
        
    def update_baseline(self, metrics: Dict[str, Any]):
        """Update baseline with new metrics."""
        self.cpu_percent_baseline = metrics.get('cpu_percent', 0.0)
        self.memory_percent_baseline = metrics.get('memory_percent', 0.0)
        self.process_count_baseline = metrics.get('process_count', 0)
        self.network_rx_baseline = metrics.get('network_rx_bytes', 0)
        self.network_tx_baseline = metrics.get('network_tx_bytes', 0)
        
        # Add to history
        self.cpu_history.append(metrics.get('cpu_percent', 0.0))
        self.memory_history.append(metrics.get('memory_percent', 0.0))
        self.process_history.append(metrics.get('process_count', 0))
        
    def is_cpu_anomaly(self, current_cpu: float, threshold_multiplier: float = 2.0) -> bool:
        """Check if current CPU usage is anomalous."""
        if len(self.cpu_history) < 5:
            return False
            
        avg_cpu = sum(self.cpu_history) / len(self.cpu_history)
        return current_cpu > (avg_cpu * threshold_multiplier)
        
    def is_memory_anomaly(self, current_memory: float, threshold_multiplier: float = 1.5) -> bool:
        """Check if current memory usage is anomalous."""
        if len(self.memory_history) < 5:
            return False
            
        avg_memory = sum(self.memory_history) / len(self.memory_history)
        return current_memory > (avg_memory * threshold_multiplier)
        
    def get_cpu_trend(self) -> str:
        """Get CPU usage trend."""
        if len(self.cpu_history) < 10:
            return "insufficient_data"
            
        recent = list(self.cpu_history)[-5:]
        older = list(self.cpu_history)[-10:-5]
        
        recent_avg = sum(recent) / len(recent)
        older_avg = sum(older) / len(older)
        
        if recent_avg > older_avg * 1.2:
            return "increasing"
        elif recent_avg < older_avg * 0.8:
            return "decreasing"
        return "stable"


class BehaviorAnalyzer:
    """
    Analyzes container behavior for anomalies.
    
    Features:
    - CPU/memory threshold monitoring
    - Baseline deviation detection
    - Process blacklist checking
    - Behavioral pattern analysis
    - Trend detection
    """
    
    def __init__(self, config: MonitorConfig):
        """
        Initialize behavior analyzer.
        
        Args:
            config: Monitor configuration
        """
        self.config = config
        self.baselines: Dict[str, ContainerBaseline] = {}
        self.analysis_history: deque = deque(maxlen=1000)
        
        # Performance tracking
        self.total_analyses = 0
        self.anomalies_detected = 0
        
    async def analyze_container(
        self,
        docker_client: AsyncDockerClient,
        container_info: Dict[str, Any]
    ) -> List[SecurityEvent]:
        """
        Analyze a single container for behavioral anomalies.
        
        Args:
            docker_client: Async Docker client
            container_info: Container information dict
            
        Returns:
            List of security events
        """
        events = []
        container_id = container_info.get('Id', '')
        container_name = container_info.get('Name', '').lstrip('/')
        
        if not container_id:
            return events
            
        try:
            # Get container stats
            stats = await docker_client.get_container_stats(container_id)
            current_metrics = self._extract_metrics(stats)
            
            # Get processes
            processes = await docker_client.get_container_processes(container_id)
            current_metrics['process_count'] = len(processes)
            
            # Initialize or update baseline
            baseline = self._get_or_create_baseline(container_id, container_name)
            
            # Perform analyses
            events.extend(await self._analyze_resource_usage(
                container_id, container_name, current_metrics, baseline
            ))
            
            events.extend(await self._analyze_processes(
                container_id, container_name, processes
            ))
            
            events.extend(await self._analyze_behavioral_patterns(
                container_id, container_name, current_metrics, baseline
            ))
            
            # Update baseline
            baseline.update_baseline(current_metrics)
            
            # Track analysis
            self.total_analyses += 1
            self.anomalies_detected += len(events)
            
            self.analysis_history.append({
                'timestamp': datetime.now(timezone.utc),
                'container_id': container_id,
                'container_name': container_name,
                'events_count': len(events),
                'metrics': current_metrics
            })
            
        except Exception as e:
            logger.error(
                "Error analyzing container behavior",
                container_id=container_id,
                container_name=container_name,
                error=str(e)
            )
            
            events.append(SecurityEvent(
                event_type="analysis_error",
                severity="LOW",
                container_id=container_id,
                container_name=container_name,
                source="behavior_analyzer",
                description=f"Failed to analyze container behavior: {e}",
                details={"error": str(e)}
            ))
            
        return events
        
    def _extract_metrics(self, stats: Dict[str, Any]) -> Dict[str, Any]:
        """Extract key metrics from Docker stats."""
        metrics = {}
        
        try:
            # CPU metrics
            metrics['cpu_percent'] = self._calculate_cpu_percent(stats)
            
            # Memory metrics
            memory_stats = stats.get('memory_stats', {})
            memory_usage = memory_stats.get('usage', 0)
            memory_limit = memory_stats.get('limit', 0)
            metrics['memory_usage'] = memory_usage
            metrics['memory_limit'] = memory_limit
            metrics['memory_percent'] = (
                (memory_usage / memory_limit * 100)
                if memory_limit > 0 else 0
            )
            
            # Network metrics
            network_stats = stats.get('networks', {})
            total_rx = sum(net.get('rx_bytes', 0) for net in network_stats.values())
            total_tx = sum(net.get('tx_bytes', 0) for net in network_stats.values())
            metrics['network_rx_bytes'] = total_rx
            metrics['network_tx_bytes'] = total_tx
            
            # Additional stats
            metrics['timestamp'] = datetime.now(timezone.utc)
            
        except (KeyError, TypeError, ZeroDivisionError) as e:
            logger.warning(f"Error extracting metrics: {e}")
            
        return metrics
        
    def _calculate_cpu_percent(self, stats: Dict[str, Any]) -> float:
        """Calculate CPU usage percentage from Docker stats."""
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
            
        except (KeyError, ZeroDivisionError, TypeError):
            return 0.0
            
    def _get_or_create_baseline(
        self, 
        container_id: str, 
        container_name: str
    ) -> ContainerBaseline:
        """Get existing baseline or create new one."""
        if container_id not in self.baselines:
            self.baselines[container_id] = ContainerBaseline(
                container_id, container_name
            )
            logger.info(
                "Created baseline for container",
                container_id=container_id,
                container_name=container_name
            )
            
        return self.baselines[container_id]
        
    async def _analyze_resource_usage(
        self,
        container_id: str,
        container_name: str,
        metrics: Dict[str, Any],
        baseline: ContainerBaseline
    ) -> List[SecurityEvent]:
        """Analyze resource usage for anomalies."""
        events = []
        
        cpu_percent = metrics.get('cpu_percent', 0.0)
        memory_percent = metrics.get('memory_percent', 0.0)
        
        # Check absolute thresholds
        if cpu_percent > self.config.cpu_threshold:
            events.append(SecurityEvent(
                event_type="resource_anomaly",
                severity="MEDIUM" if cpu_percent < 95.0 else "HIGH",
                container_id=container_id,
                container_name=container_name,
                source="behavior_analyzer",
                description=f"High CPU usage: {cpu_percent:.1f}%",
                details={
                    "metric": "cpu",
                    "value": cpu_percent,
                    "threshold": self.config.cpu_threshold,
                    "baseline_avg": sum(baseline.cpu_history) / len(baseline.cpu_history) if baseline.cpu_history else 0
                },
                remediation="Investigate high CPU usage and potential runaway processes"
            ))
            
        if memory_percent > self.config.memory_threshold:
            events.append(SecurityEvent(
                event_type="resource_anomaly",
                severity="MEDIUM" if memory_percent < 95.0 else "HIGH",
                container_id=container_id,
                container_name=container_name,
                source="behavior_analyzer",
                description=f"High memory usage: {memory_percent:.1f}%",
                details={
                    "metric": "memory",
                    "value": memory_percent,
                    "threshold": self.config.memory_threshold,
                    "baseline_avg": sum(baseline.memory_history) / len(baseline.memory_history) if baseline.memory_history else 0
                },
                remediation="Investigate memory leak or excessive memory usage"
            ))
            
        # Check baseline deviations
        if baseline.is_cpu_anomaly(cpu_percent):
            cpu_trend = baseline.get_cpu_trend()
            events.append(SecurityEvent(
                event_type="behavioral_anomaly",
                severity="MEDIUM",
                container_id=container_id,
                container_name=container_name,
                source="behavior_analyzer",
                description=f"CPU usage anomaly detected: {cpu_percent:.1f}% (trend: {cpu_trend})",
                details={
                    "metric": "cpu_deviation",
                    "current_value": cpu_percent,
                    "baseline_avg": sum(baseline.cpu_history) / len(baseline.cpu_history),
                    "trend": cpu_trend
                },
                remediation="Investigate unusual CPU usage patterns"
            ))
            
        if baseline.is_memory_anomaly(memory_percent):
            events.append(SecurityEvent(
                event_type="behavioral_anomaly",
                severity="MEDIUM",
                container_id=container_id,
                container_name=container_name,
                source="behavior_analyzer",
                description=f"Memory usage anomaly detected: {memory_percent:.1f}%",
                details={
                    "metric": "memory_deviation",
                    "current_value": memory_percent,
                    "baseline_avg": sum(baseline.memory_history) / len(baseline.memory_history)
                },
                remediation="Investigate unusual memory usage patterns"
            ))
            
        return events
        
    async def _analyze_processes(
        self,
        container_id: str,
        container_name: str,
        processes: Dict[str, Any]
    ) -> List[SecurityEvent]:
        """Analyze processes for security issues."""
        events = []
        
        if not processes or 'Processes' not in processes:
            return events
            
        try:
            titles = processes.get('Titles', [])
            process_list = processes.get('Processes', [])
            
            for process in process_list:
                process_info = dict(zip(titles, process))
                command = process_info.get('CMD', '') or process_info.get('COMMAND', '')
                
                # Check for blocked processes
                for blocked_proc in self.config.blocked_processes:
                    if blocked_proc.lower() in command.lower():
                        events.append(SecurityEvent(
                            event_type="suspicious_process",
                            severity="HIGH",
                            container_id=container_id,
                            container_name=container_name,
                            source="behavior_analyzer",
                            description=f"Blocked process detected: {command}",
                            details={
                                "process_command": command,
                                "blocked_process": blocked_proc,
                                "process_info": process_info
                            },
                            remediation="Investigate and terminate unauthorized processes"
                        ))
                        
                # Check for suspicious process patterns
                suspicious_patterns = [
                    'wget', 'curl', 'ssh', 'scp', 'rsync', 'nmap', 'masscan'
                ]
                
                for pattern in suspicious_patterns:
                    if pattern in command.lower():
                        # Only alert if process wasn't expected
                        if not self._is_expected_process(command, container_name):
                            events.append(SecurityEvent(
                                event_type="suspicious_process",
                                severity="MEDIUM",
                                container_id=container_id,
                                container_name=container_name,
                                source="behavior_analyzer",
                                description=f"Potentially suspicious process: {command}",
                                details={
                                    "process_command": command,
                                    "suspicious_pattern": pattern,
                                    "process_info": process_info
                                },
                                remediation="Verify if this process is expected and authorized"
                            ))
                            
        except (KeyError, TypeError) as e:
            logger.warning(f"Error analyzing processes: {e}")
            
        return events
        
    async def _analyze_behavioral_patterns(
        self,
        container_id: str,
        container_name: str,
        metrics: Dict[str, Any],
        baseline: ContainerBaseline
    ) -> List[SecurityEvent]:
        """Analyze behavioral patterns for anomalies."""
        events = []
        
        # Check for rapid process count changes
        current_process_count = metrics.get('process_count', 0)
        if len(baseline.process_history) > 5:
            avg_processes = sum(baseline.process_history) / len(baseline.process_history)
            
            if current_process_count > avg_processes * 2:
                events.append(SecurityEvent(
                    event_type="behavioral_anomaly",
                    severity="MEDIUM",
                    container_id=container_id,
                    container_name=container_name,
                    source="behavior_analyzer",
                    description=f"Unusual process count increase: {current_process_count} (avg: {avg_processes:.1f})",
                    details={
                        "metric": "process_count_spike",
                        "current_count": current_process_count,
                        "average_count": avg_processes
                    },
                    remediation="Investigate process spawning behavior"
                ))
                
        # Check for consistent high resource usage
        if len(baseline.cpu_history) >= 10:
            recent_high_cpu = sum(1 for cpu in list(baseline.cpu_history)[-10:] if cpu > 70) 
            if recent_high_cpu >= 8:  # 8 out of last 10 measurements
                events.append(SecurityEvent(
                    event_type="behavioral_anomaly",
                    severity="MEDIUM",
                    container_id=container_id,
                    container_name=container_name,
                    source="behavior_analyzer",
                    description="Sustained high CPU usage pattern detected",
                    details={
                        "metric": "sustained_high_cpu",
                        "high_cpu_count": recent_high_cpu,
                        "window_size": 10
                    },
                    remediation="Investigate sustained resource consumption"
                ))
                
        return events
        
    def _is_expected_process(self, command: str, container_name: str) -> bool:
        """Check if a process is expected based on container name and common patterns."""
        # Common expected patterns
        expected_patterns = {
            'web': ['nginx', 'apache', 'node', 'python', 'gunicorn'],
            'db': ['mysql', 'postgres', 'redis', 'mongo'],
            'cache': ['redis', 'memcached'],
            'proxy': ['nginx', 'haproxy', 'envoy']
        }
        
        container_type = None
        for type_name in expected_patterns:
            if type_name in container_name.lower():
                container_type = type_name
                break
                
        if container_type:
            return any(pattern in command.lower() for pattern in expected_patterns[container_type])
            
        return False
        
    def get_baseline_info(self, container_id: str) -> Optional[Dict[str, Any]]:
        """Get baseline information for a container."""
        if container_id not in self.baselines:
            return None
            
        baseline = self.baselines[container_id]
        return {
            "container_id": baseline.container_id,
            "container_name": baseline.container_name,
            "established_at": baseline.established_at.isoformat(),
            "cpu_baseline": baseline.cpu_percent_baseline,
            "memory_baseline": baseline.memory_percent_baseline,
            "process_count_baseline": baseline.process_count_baseline,
            "anomaly_count": baseline.anomaly_count,
            "cpu_trend": baseline.get_cpu_trend(),
            "history_size": {
                "cpu": len(baseline.cpu_history),
                "memory": len(baseline.memory_history),
                "processes": len(baseline.process_history)
            }
        }
        
    def get_analysis_stats(self) -> Dict[str, Any]:
        """Get analyzer performance statistics."""
        return {
            "total_analyses": self.total_analyses,
            "anomalies_detected": self.anomalies_detected,
            "anomaly_rate": (
                self.anomalies_detected / self.total_analyses
                if self.total_analyses > 0 else 0
            ),
            "active_baselines": len(self.baselines),
            "analysis_history_size": len(self.analysis_history)
        }
        
    def cleanup_old_baselines(self, max_age_hours: int = 24):
        """Clean up baselines for containers that no longer exist."""
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
        
        to_remove = []
        for container_id, baseline in self.baselines.items():
            if baseline.established_at < cutoff_time:
                to_remove.append(container_id)
                
        for container_id in to_remove:
            del self.baselines[container_id]
            logger.info(f"Cleaned up old baseline for container {container_id}")
            
        return len(to_remove)