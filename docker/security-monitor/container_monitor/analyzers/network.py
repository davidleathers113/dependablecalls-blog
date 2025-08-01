"""
Network traffic analysis and anomaly detection.

Monitors:
- Network traffic patterns and anomalies
- Port scanning detection
- Unusual connection patterns
- Data exfiltration indicators
- Network-based attacks
"""

import asyncio
from typing import Dict, List, Any, Optional, Set, Tuple
from datetime import datetime, timezone, timedelta
from collections import defaultdict, deque
import ipaddress
import structlog

from container_monitor.models.events import SecurityEvent
from container_monitor.models.config import MonitorConfig
from container_monitor.adapters.docker_async import AsyncDockerClient

logger = structlog.get_logger(__name__)


class NetworkBaseline:
    """Tracks network baseline metrics for a container."""
    
    def __init__(self, container_id: str, container_name: str):
        self.container_id = container_id
        self.container_name = container_name
        self.established_at = datetime.now(timezone.utc)
        
        # Baseline metrics
        self.avg_rx_bytes_per_sec = 0.0
        self.avg_tx_bytes_per_sec = 0.0
        self.avg_rx_packets_per_sec = 0.0
        self.avg_tx_packets_per_sec = 0.0
        
        # Historical data
        self.rx_history: deque = deque(maxlen=50)
        self.tx_history: deque = deque(maxlen=50)
        self.packet_history: deque = deque(maxlen=50)
        
        # Connection tracking
        self.established_connections: Set[Tuple[str, int]] = set()
        self.connection_history: deque = deque(maxlen=100)
        
        # Traffic patterns
        self.traffic_spikes = 0
        self.last_spike_time = None
        
    def update_baseline(self, network_stats: Dict[str, Any], interval: int):
        """Update baseline with new network statistics."""
        try:
            total_rx = sum(net.get('rx_bytes', 0) for net in network_stats.values())
            total_tx = sum(net.get('tx_bytes', 0) for net in network_stats.values())
            total_rx_packets = sum(net.get('rx_packets', 0) for net in network_stats.values())
            total_tx_packets = sum(net.get('tx_packets', 0) for net in network_stats.values())
            
            # Calculate rates (bytes/packets per second)
            rx_rate = total_rx / interval if interval > 0 else 0
            tx_rate = total_tx / interval if interval > 0 else 0
            rx_packet_rate = total_rx_packets / interval if interval > 0 else 0
            tx_packet_rate = total_tx_packets / interval if interval > 0 else 0
            
            # Update histories
            self.rx_history.append(rx_rate)
            self.tx_history.append(tx_rate)
            self.packet_history.append((rx_packet_rate, tx_packet_rate))
            
            # Update averages
            if self.rx_history:
                self.avg_rx_bytes_per_sec = sum(self.rx_history) / len(self.rx_history)
            if self.tx_history:
                self.avg_tx_bytes_per_sec = sum(self.tx_history) / len(self.tx_history)
            if self.packet_history:
                rx_packets = [p[0] for p in self.packet_history]
                tx_packets = [p[1] for p in self.packet_history]
                self.avg_rx_packets_per_sec = sum(rx_packets) / len(rx_packets)
                self.avg_tx_packets_per_sec = sum(tx_packets) / len(tx_packets)
                
        except (KeyError, TypeError, ZeroDivisionError) as e:
            logger.warning(f"Error updating network baseline: {e}")
            
    def is_traffic_spike(self, current_rx: float, current_tx: float, multiplier: float = 3.0) -> bool:
        """Check if current traffic represents a spike."""
        if len(self.rx_history) < 5 or len(self.tx_history) < 5:
            return False
            
        return (current_rx > self.avg_rx_bytes_per_sec * multiplier or 
                current_tx > self.avg_tx_bytes_per_sec * multiplier)
                
    def get_traffic_trend(self) -> str:
        """Get traffic trend analysis."""
        if len(self.rx_history) < 10:
            return "insufficient_data"
            
        recent_rx = list(self.rx_history)[-5:]
        older_rx = list(self.rx_history)[-10:-5]
        
        recent_avg = sum(recent_rx) / len(recent_rx)
        older_avg = sum(older_rx) / len(older_rx)
        
        if recent_avg > older_avg * 1.5:
            return "increasing"
        elif recent_avg < older_avg * 0.5:
            return "decreasing"
        return "stable"


class NetworkAnalyzer:
    """
    Analyzes network traffic for security anomalies.
    
    Features:
    - Traffic volume anomaly detection
    - Port scanning detection
    - Unusual connection patterns
    - Data exfiltration indicators
    - Network-based attack detection
    """
    
    def __init__(self, config: MonitorConfig):
        """
        Initialize network analyzer.
        
        Args:
            config: Monitor configuration
        """
        self.config = config
        self.baselines: Dict[str, NetworkBaseline] = {}
        self.connection_tracking: Dict[str, Dict] = defaultdict(dict)
        
        # Attack detection
        self.port_scan_tracking: Dict[str, Set[int]] = defaultdict(set)
        self.connection_attempts: Dict[str, List[datetime]] = defaultdict(list)
        
        # Private network ranges for internal traffic detection
        self.private_networks = [
            ipaddress.IPv4Network('10.0.0.0/8'),
            ipaddress.IPv4Network('172.16.0.0/12'),
            ipaddress.IPv4Network('192.168.0.0/16'),
            ipaddress.IPv4Network('127.0.0.0/8')
        ]
        
        # Performance tracking
        self.total_analyses = 0
        self.anomalies_detected = 0
        
    async def analyze_network_traffic(
        self,
        docker_client: AsyncDockerClient,
        container_info: Dict[str, Any]
    ) -> List[SecurityEvent]:
        """
        Analyze network traffic for a single container.
        
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
            # Get container stats for network information
            stats = await docker_client.get_container_stats(container_id)
            network_stats = stats.get('networks', {})
            
            if not network_stats:
                return events
                
            # Initialize or get baseline
            baseline = self._get_or_create_baseline(container_id, container_name)
            
            # Analyze traffic patterns
            events.extend(await self._analyze_traffic_volume(
                container_id, container_name, network_stats, baseline
            ))
            
            events.extend(await self._analyze_traffic_patterns(
                container_id, container_name, network_stats, baseline
            ))
            
            events.extend(await self._analyze_connection_behavior(
                container_id, container_name, network_stats
            ))
            
            events.extend(await self._check_data_exfiltration(
                container_id, container_name, network_stats, baseline
            ))
            
            # Update baseline
            baseline.update_baseline(network_stats, self.config.monitor_interval)
            
            # Track analysis
            self.total_analyses += 1
            self.anomalies_detected += len(events)
            
        except Exception as e:
            logger.error(
                "Error analyzing network traffic",
                container_id=container_id,
                container_name=container_name,
                error=str(e)
            )
            
            events.append(SecurityEvent(
                event_type="network_analysis_error",
                severity="LOW",
                container_id=container_id,
                container_name=container_name,
                source="network_analyzer",
                description=f"Failed to analyze network traffic: {e}",
                details={"error": str(e)}
            ))
            
        return events
        
    def _get_or_create_baseline(
        self, 
        container_id: str, 
        container_name: str
    ) -> NetworkBaseline:
        """Get existing baseline or create new one."""
        if container_id not in self.baselines:
            self.baselines[container_id] = NetworkBaseline(
                container_id, container_name
            )
            logger.info(
                "Created network baseline for container",
                container_id=container_id,
                container_name=container_name
            )
            
        return self.baselines[container_id]
        
    async def _analyze_traffic_volume(
        self,
        container_id: str,
        container_name: str,
        network_stats: Dict[str, Any],
        baseline: NetworkBaseline
    ) -> List[SecurityEvent]:
        """Analyze traffic volume for anomalies."""
        events = []
        
        try:
            # Calculate current traffic rates
            total_rx = sum(net.get('rx_bytes', 0) for net in network_stats.values())
            total_tx = sum(net.get('tx_bytes', 0) for net in network_stats.values())
            
            # Convert to Mbps for threshold comparison
            interval = self.config.monitor_interval
            rx_mbps = (total_rx * 8) / (1024 * 1024 * interval) if interval > 0 else 0
            tx_mbps = (total_tx * 8) / (1024 * 1024 * interval) if interval > 0 else 0
            
            # Check absolute thresholds
            if rx_mbps > self.config.network_threshold_mbps:
                events.append(SecurityEvent(
                    event_type="network_anomaly",
                    severity="MEDIUM" if rx_mbps < self.config.network_threshold_mbps * 2 else "HIGH",
                    container_id=container_id,
                    container_name=container_name,
                    source="network_analyzer",
                    description=f"High inbound traffic: {rx_mbps:.1f} Mbps",
                    details={
                        "direction": "inbound",
                        "rate_mbps": rx_mbps,
                        "threshold_mbps": self.config.network_threshold_mbps,
                        "bytes_per_second": total_rx / interval if interval > 0 else 0
                    },
                    remediation="Investigate high inbound network traffic"
                ))
                
            if tx_mbps > self.config.network_threshold_mbps:
                events.append(SecurityEvent(
                    event_type="network_anomaly",
                    severity="MEDIUM" if tx_mbps < self.config.network_threshold_mbps * 2 else "HIGH",
                    container_id=container_id,
                    container_name=container_name,
                    source="network_analyzer",
                    description=f"High outbound traffic: {tx_mbps:.1f} Mbps",
                    details={
                        "direction": "outbound",
                        "rate_mbps": tx_mbps,
                        "threshold_mbps": self.config.network_threshold_mbps,
                        "bytes_per_second": total_tx / interval if interval > 0 else 0
                    },
                    remediation="Investigate high outbound network traffic"
                ))
                
            # Check for traffic spikes compared to baseline
            rx_rate = total_rx / interval if interval > 0 else 0
            tx_rate = total_tx / interval if interval > 0 else 0
            
            if baseline.is_traffic_spike(rx_rate, tx_rate):
                baseline.traffic_spikes += 1
                baseline.last_spike_time = datetime.now(timezone.utc)
                
                trend = baseline.get_traffic_trend()
                events.append(SecurityEvent(
                    event_type="network_anomaly",
                    severity="MEDIUM",
                    container_id=container_id,
                    container_name=container_name,
                    source="network_analyzer",
                    description=f"Network traffic spike detected (trend: {trend})",
                    details={
                        "current_rx_rate": rx_rate,
                        "current_tx_rate": tx_rate,
                        "baseline_rx_avg": baseline.avg_rx_bytes_per_sec,
                        "baseline_tx_avg": baseline.avg_tx_bytes_per_sec,
                        "traffic_trend": trend,
                        "spike_count": baseline.traffic_spikes
                    },
                    remediation="Investigate unusual network traffic patterns"
                ))
                
        except (KeyError, TypeError, ZeroDivisionError) as e:
            logger.warning(f"Error analyzing traffic volume: {e}")
            
        return events
        
    async def _analyze_traffic_patterns(
        self,
        container_id: str,
        container_name: str,
        network_stats: Dict[str, Any],
        baseline: NetworkBaseline
    ) -> List[SecurityEvent]:
        """Analyze traffic patterns for anomalies."""
        events = []
        
        try:
            # Analyze packet-to-byte ratios for each interface
            for interface, stats in network_stats.items():
                rx_bytes = stats.get('rx_bytes', 0)
                tx_bytes = stats.get('tx_bytes', 0)
                rx_packets = stats.get('rx_packets', 0)
                tx_packets = stats.get('tx_packets', 0)
                
                # Check for unusual packet sizes (potential tunneling/covert channels)
                if rx_packets > 0:
                    avg_rx_packet_size = rx_bytes / rx_packets
                    if avg_rx_packet_size < 50:  # Very small packets
                        events.append(SecurityEvent(
                            event_type="network_anomaly",
                            severity="MEDIUM",
                            container_id=container_id,
                            container_name=container_name,
                            source="network_analyzer",
                            description=f"Unusually small average packet size on {interface}: {avg_rx_packet_size:.1f} bytes",
                            details={
                                "interface": interface,
                                "avg_packet_size": avg_rx_packet_size,
                                "packet_count": rx_packets,
                                "byte_count": rx_bytes,
                                "direction": "inbound"
                            },
                            remediation="Investigate potential covert channel or scanning activity"
                        ))
                        
                if tx_packets > 0:
                    avg_tx_packet_size = tx_bytes / tx_packets
                    if avg_tx_packet_size > 1400:  # Very large packets (potential data exfiltration)
                        events.append(SecurityEvent(
                            event_type="network_anomaly",
                            severity="MEDIUM",
                            container_id=container_id,
                            container_name=container_name,
                            source="network_analyzer",
                            description=f"Unusually large average packet size on {interface}: {avg_tx_packet_size:.1f} bytes",
                            details={
                                "interface": interface,
                                "avg_packet_size": avg_tx_packet_size,
                                "packet_count": tx_packets,
                                "byte_count": tx_bytes,
                                "direction": "outbound"
                            },
                            remediation="Investigate potential data exfiltration"
                        ))
                        
                # Check for packet loss indicators
                rx_dropped = stats.get('rx_dropped', 0)
                tx_dropped = stats.get('tx_dropped', 0)
                rx_errors = stats.get('rx_errors', 0)
                tx_errors = stats.get('tx_errors', 0)
                
                total_packets = rx_packets + tx_packets
                total_errors = rx_errors + tx_errors + rx_dropped + tx_dropped
                
                if total_packets > 100 and total_errors > 0:
                    error_rate = (total_errors / total_packets) * 100
                    if error_rate > 5:  # More than 5% error rate
                        events.append(SecurityEvent(
                            event_type="network_anomaly",
                            severity="MEDIUM",
                            container_id=container_id,
                            container_name=container_name,
                            source="network_analyzer",
                            description=f"High network error rate on {interface}: {error_rate:.1f}%",
                            details={
                                "interface": interface,
                                "error_rate_percent": error_rate,
                                "total_errors": total_errors,
                                "total_packets": total_packets,
                                "rx_errors": rx_errors,
                                "tx_errors": tx_errors,
                                "rx_dropped": rx_dropped,
                                "tx_dropped": tx_dropped
                            },
                            remediation="Investigate network connectivity issues or potential attacks"
                        ))
                        
        except (KeyError, TypeError, ZeroDivisionError) as e:
            logger.warning(f"Error analyzing traffic patterns: {e}")
            
        return events
        
    async def _analyze_connection_behavior(
        self,
        container_id: str,
        container_name: str,
        network_stats: Dict[str, Any]
    ) -> List[SecurityEvent]:
        """Analyze connection behavior patterns."""
        events = []
        
        # Note: Docker stats don't provide connection details directly
        # This is a placeholder for when we integrate with netstat or ss commands
        # or use network monitoring tools
        
        try:
            # Track connection attempts frequency
            now = datetime.now(timezone.utc)
            connection_attempts = self.connection_attempts[container_id]
            
            # Clean old attempts (older than 5 minutes)
            cutoff_time = now - timedelta(minutes=5)
            connection_attempts[:] = [attempt for attempt in connection_attempts if attempt > cutoff_time]
            
            # Add current attempt
            connection_attempts.append(now)
            
            # Check for rapid connection attempts (potential port scanning)
            recent_attempts = [attempt for attempt in connection_attempts if attempt > now - timedelta(minutes=1)]
            
            if len(recent_attempts) > 50:  # More than 50 attempts in 1 minute
                events.append(SecurityEvent(
                    event_type="network_scanning",
                    severity="HIGH",
                    container_id=container_id,
                    container_name=container_name,
                    source="network_analyzer",
                    description=f"Rapid connection attempts detected: {len(recent_attempts)} in 1 minute",
                    details={
                        "attempts_per_minute": len(recent_attempts),
                        "total_attempts_5min": len(connection_attempts),
                        "detection_window": "1_minute"
                    },
                    remediation="Investigate potential port scanning or brute force activity"
                ))
                
        except Exception as e:
            logger.warning(f"Error analyzing connection behavior: {e}")
            
        return events
        
    async def _check_data_exfiltration(
        self,
        container_id: str,
        container_name: str,
        network_stats: Dict[str, Any],
        baseline: NetworkBaseline
    ) -> List[SecurityEvent]:
        """Check for potential data exfiltration indicators."""
        events = []
        
        try:
            # Calculate total outbound traffic
            total_tx = sum(net.get('tx_bytes', 0) for net in network_stats.values())
            interval = self.config.monitor_interval
            
            if interval > 0:
                tx_rate = total_tx / interval
                
                # Check for sustained high outbound traffic
                if (len(baseline.tx_history) >= 5 and 
                    tx_rate > baseline.avg_tx_bytes_per_sec * 5):
                    
                    # Check if this is sustained over multiple intervals
                    recent_high_tx = sum(
                        1 for rate in list(baseline.tx_history)[-5:] 
                        if rate > baseline.avg_tx_bytes_per_sec * 2
                    )
                    
                    if recent_high_tx >= 3:  # 3 out of last 5 intervals
                        events.append(SecurityEvent(
                            event_type="data_exfiltration",
                            severity="HIGH",
                            container_id=container_id,
                            container_name=container_name,
                            source="network_analyzer",
                            description="Potential data exfiltration: sustained high outbound traffic",
                            details={
                                "current_tx_rate": tx_rate,
                                "baseline_tx_avg": baseline.avg_tx_bytes_per_sec,
                                "rate_multiplier": tx_rate / baseline.avg_tx_bytes_per_sec if baseline.avg_tx_bytes_per_sec > 0 else 0,
                                "sustained_intervals": recent_high_tx,
                                "window_size": 5
                            },
                            remediation="Investigate potential data exfiltration activity"
                        ))
                        
                # Check for unusual upload patterns (much higher TX than RX)
                total_rx = sum(net.get('rx_bytes', 0) for net in network_stats.values())
                
                if total_rx > 0 and total_tx > total_rx * 10:  # 10:1 upload ratio
                    events.append(SecurityEvent(
                        event_type="data_exfiltration",
                        severity="MEDIUM",
                        container_id=container_id,
                        container_name=container_name,
                        source="network_analyzer",
                        description=f"Unusual upload pattern: TX/RX ratio = {total_tx/total_rx:.1f}:1",
                        details={
                            "tx_bytes": total_tx,
                            "rx_bytes": total_rx,
                            "tx_rx_ratio": total_tx / total_rx,
                            "typical_ratio_threshold": 10
                        },
                        remediation="Investigate high upload activity relative to downloads"
                    ))
                    
        except (KeyError, TypeError, ZeroDivisionError) as e:
            logger.warning(f"Error checking data exfiltration: {e}")
            
        return events
        
    def _is_private_ip(self, ip_str: str) -> bool:
        """Check if IP address is in private range."""
        try:
            ip = ipaddress.IPv4Address(ip_str)
            return any(ip in network for network in self.private_networks)
        except (ipaddress.AddressValueError, ValueError):
            return False
            
    def get_network_summary(self) -> Dict[str, Any]:
        """Get network analysis summary."""
        return {
            "total_analyses": self.total_analyses,
            "anomalies_detected": self.anomalies_detected,
            "anomaly_rate": (
                self.anomalies_detected / self.total_analyses
                if self.total_analyses > 0 else 0
            ),
            "active_baselines": len(self.baselines),
            "containers_with_traffic_spikes": sum(
                1 for baseline in self.baselines.values() 
                if baseline.traffic_spikes > 0
            )
        }
        
    def get_container_network_info(self, container_id: str) -> Optional[Dict[str, Any]]:
        """Get network information for a specific container."""
        if container_id not in self.baselines:
            return None
            
        baseline = self.baselines[container_id]
        return {
            "container_id": baseline.container_id,
            "container_name": baseline.container_name,
            "established_at": baseline.established_at.isoformat(),
            "avg_rx_rate": baseline.avg_rx_bytes_per_sec,
            "avg_tx_rate": baseline.avg_tx_bytes_per_sec,
            "traffic_spikes": baseline.traffic_spikes,
            "last_spike": baseline.last_spike_time.isoformat() if baseline.last_spike_time else None,
            "traffic_trend": baseline.get_traffic_trend(),
            "history_size": {
                "rx": len(baseline.rx_history),
                "tx": len(baseline.tx_history),
                "packets": len(baseline.packet_history)
            }
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
            # Also clean up connection tracking
            if container_id in self.connection_attempts:
                del self.connection_attempts[container_id]
            if container_id in self.port_scan_tracking:
                del self.port_scan_tracking[container_id]
                
        logger.info(f"Cleaned up {len(to_remove)} old network baselines")
        return len(to_remove)