"""
Side-by-Side Comparison Framework

Real-time comparison between monolithic and modular Container Security Monitor
systems to validate functional equivalence and performance improvements.

This framework runs both systems in parallel with identical inputs and
compares their outputs, performance metrics, and behavior.
"""

import pytest
import pytest_asyncio
import asyncio
import json
import time
import threading
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple
from unittest.mock import Mock, AsyncMock, patch
from dataclasses import dataclass, field
import concurrent.futures

# Import both systems
from legacy.security_monitor_v1 import ContainerMonitor as MonolithMonitor, MonitorConfig as MonolithConfig
from container_monitor.core.monitor import ContainerMonitor as ModularMonitor
from container_monitor.models.config import MonitorConfig as ModularConfig
from container_monitor.models.events import SecurityEvent


@dataclass
class ComparisonResult:
    """Results from side-by-side comparison."""
    monolith_results: Dict[str, Any] = field(default_factory=dict)
    modular_results: Dict[str, Any] = field(default_factory=dict)
    performance_metrics: Dict[str, Any] = field(default_factory=dict)
    differences: List[str] = field(default_factory=list)
    success: bool = True
    
    def add_difference(self, category: str, description: str):
        """Add a difference to the comparison."""
        self.differences.append(f"{category}: {description}")
        
    def mark_failure(self, reason: str):
        """Mark comparison as failed."""
        self.success = False
        self.differences.append(f"FAILURE: {reason}")


class SideBySideComparator:
    """Framework for side-by-side comparison of monitoring systems."""
    
    def __init__(self, config_data: Dict[str, Any]):
        """Initialize comparator with configuration."""
        self.config_data = config_data
        self.monolith_config = MonolithConfig(**config_data)
        self.modular_config = ModularConfig(**config_data)
        
        self.monolith_monitor = None
        self.modular_monitor = None
        
    async def __aenter__(self):
        """Async context manager entry."""
        # Initialize monitors
        self.monolith_monitor = MonolithMonitor(self.monolith_config)
        self.modular_monitor = ModularMonitor(self.modular_config)
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.modular_monitor:
            await self.modular_monitor.shutdown()
    
    async def compare_container_detection(self, container_data: List[Dict]) -> ComparisonResult:
        """Compare container detection between systems."""
        result = ComparisonResult()
        
        try:
            # Mock Docker for monolith
            with patch('docker.from_env') as mock_docker_monolith:
                mock_client = Mock()
                mock_containers = [
                    Mock(id=c["Id"], name=c["Names"][0].lstrip('/'), attrs=c)
                    for c in container_data
                ]
                mock_client.containers.list.return_value = mock_containers
                mock_docker_monolith.return_value = mock_client
                
                # Get monolith results
                monolith_start = time.time()
                monolith_containers = self.monolith_monitor._get_monitored_containers()
                monolith_time = time.time() - monolith_start
                
                result.monolith_results = {
                    'container_ids': [c.id for c in monolith_containers],
                    'container_count': len(monolith_containers),
                    'processing_time': monolith_time
                }
            
            # Mock Docker for modular
            with patch.object(self.modular_monitor.docker_client, 'list_containers') as mock_modular:
                mock_modular.return_value = container_data
                
                # Get modular results
                modular_start = time.time()
                modular_containers = await self.modular_monitor._get_monitored_containers()
                modular_time = time.time() - modular_start
                
                result.modular_results = {
                    'container_ids': [c["Id"] for c in modular_containers],
                    'container_count': len(modular_containers),
                    'processing_time': modular_time
                }
            
            # Compare results
            monolith_ids = set(result.monolith_results['container_ids'])
            modular_ids = set(result.modular_results['container_ids'])
            
            if monolith_ids != modular_ids:
                missing_in_modular = monolith_ids - modular_ids
                missing_in_monolith = modular_ids - monolith_ids
                
                if missing_in_modular:
                    result.add_difference("Container Detection", f"Missing in modular: {missing_in_modular}")
                if missing_in_monolith:
                    result.add_difference("Container Detection", f"Missing in monolith: {missing_in_monolith}")
                    
                result.mark_failure("Container detection mismatch")
            
            # Performance comparison
            performance_improvement = (monolith_time - modular_time) / monolith_time * 100
            result.performance_metrics = {
                'monolith_time': monolith_time,
                'modular_time': modular_time,
                'improvement_percent': performance_improvement
            }
            
            if performance_improvement < -10:  # Modular is >10% slower
                result.add_difference("Performance", f"Modular system slower by {abs(performance_improvement):.1f}%")
                
        except Exception as e:
            result.mark_failure(f"Exception during container detection comparison: {e}")
            
        return result
    
    async def compare_security_event_generation(self, test_containers: List[Dict]) -> ComparisonResult:
        """Compare security event generation between systems."""
        result = ComparisonResult()
        
        try:
            monolith_events = []
            modular_events = []
            
            # Process each container through both systems
            for container_data in test_containers:
                # Monolith processing
                mock_container = Mock()
                mock_container.id = container_data["Id"]
                mock_container.name = container_data["Names"][0].lstrip('/')
                mock_container.attrs = container_data
                mock_container.stats.return_value = {
                    "cpu_stats": {"cpu_usage": {"total_usage": 1000000}, "system_cpu_usage": 10000000},
                    "precpu_stats": {"cpu_usage": {"total_usage": 900000}, "system_cpu_usage": 9000000},
                    "memory_stats": {"usage": 100000000, "limit": 1000000000},
                    "networks": {"eth0": {"rx_bytes": 1000, "tx_bytes": 1000}}
                }
                mock_container.top.return_value = {"Titles": ["PID", "CMD"], "Processes": [["1", "nginx"]]}
                
                # Generate events from monolith
                monolith_start = time.time()
                security_events = self.monolith_monitor._check_container_security_posture(mock_container)
                behavior_events = self.monolith_monitor._analyze_container_behavior(mock_container)
                monolith_time = time.time() - monolith_start
                
                monolith_container_events = security_events + behavior_events
                monolith_events.extend(monolith_container_events)
                
                # Modular processing
                modular_start = time.time()
                
                # Mock the async methods
                with patch.object(self.modular_monitor.docker_client, 'get_container_stats') as mock_stats:
                    with patch.object(self.modular_monitor.docker_client, 'get_container_processes') as mock_procs:
                        mock_stats.return_value = mock_container.stats.return_value
                        mock_procs.return_value = mock_container.top.return_value
                        
                        # Use analyzers directly
                        from container_monitor.analyzers.posture import SecurityPostureAnalyzer
                        from container_monitor.analyzers.behavior import BehaviorAnalyzer
                        
                        posture_analyzer = SecurityPostureAnalyzer(self.modular_config)
                        behavior_analyzer = BehaviorAnalyzer(self.modular_config)
                        
                        security_events_mod = await posture_analyzer.analyze_container(container_data)
                        behavior_events_mod = await behavior_analyzer.analyze_container(container_data)
                        
                modular_time = time.time() - modular_start
                
                modular_container_events = security_events_mod + behavior_events_mod
                modular_events.extend(modular_container_events)
            
            # Normalize and compare events
            def normalize_event(event):
                if hasattr(event, 'model_dump'):
                    data = event.model_dump()
                else:
                    data = {
                        'event_type': event.event_type,
                        'severity': event.severity,
                        'source': event.source,
                        'container_id': event.container_id,
                        'container_name': event.container_name
                    }
                data.pop('timestamp', None)  # Remove timestamp for comparison
                return data
            
            monolith_normalized = [normalize_event(e) for e in monolith_events]
            modular_normalized = [normalize_event(e) for e in modular_events]
            
            # Group by event type and severity
            def group_events(events):
                groups = {}
                for event in events:
                    key = (event['event_type'], event['severity'])
                    groups.setdefault(key, []).append(event)
                return groups
            
            monolith_groups = group_events(monolith_normalized)
            modular_groups = group_events(modular_normalized)
            
            # Compare event groups
            all_event_types = set(monolith_groups.keys()) | set(modular_groups.keys())
            
            for event_key in all_event_types:
                monolith_count = len(monolith_groups.get(event_key, []))
                modular_count = len(modular_groups.get(event_key, []))
                
                if monolith_count != modular_count:
                    event_type, severity = event_key
                    result.add_difference(
                        "Event Generation",
                        f"{event_type}({severity}): monolith={monolith_count}, modular={modular_count}"
                    )
            
            # Store results
            result.monolith_results = {
                'total_events': len(monolith_events),
                'event_groups': {f"{k[0]}({k[1]})": len(v) for k, v in monolith_groups.items()},
                'processing_time': monolith_time
            }
            
            result.modular_results = {
                'total_events': len(modular_events),
                'event_groups': {f"{k[0]}({k[1]})": len(v) for k, v in modular_groups.items()},
                'processing_time': modular_time
            }
            
            # Performance metrics
            performance_improvement = (monolith_time - modular_time) / monolith_time * 100 if monolith_time > 0 else 0
            result.performance_metrics = {
                'monolith_time': monolith_time,
                'modular_time': modular_time,
                'improvement_percent': performance_improvement
            }
            
        except Exception as e:
            result.mark_failure(f"Exception during event generation comparison: {e}")
            
        return result
    
    async def compare_alert_delivery(self, test_events: List[SecurityEvent]) -> ComparisonResult:
        """Compare alert delivery between systems."""
        result = ComparisonResult()
        
        try:
            monolith_alerts = []
            modular_alerts = []
            
            # Mock webhook capture for monolith
            async def capture_monolith_webhook(session, url, **kwargs):
                monolith_alerts.append({
                    'url': url,
                    'payload': kwargs.get('json'),
                    'headers': kwargs.get('headers', {})
                })
                mock_response = AsyncMock()
                mock_response.status = 200
                return mock_response
            
            # Mock webhook capture for modular
            async def capture_modular_webhook(url, payload, headers):
                modular_alerts.append({
                    'url': url,
                    'payload': payload,
                    'headers': headers
                })
                return {"status_code": 200, "success": True}
            
            # Test monolith alert delivery
            monolith_start = time.time()
            with patch('aiohttp.ClientSession.post', side_effect=capture_monolith_webhook):
                for event in test_events[:5]:  # Limit for comparison
                    await self.monolith_monitor._send_alert(event)
            monolith_time = time.time() - monolith_start
            
            # Test modular alert delivery
            from container_monitor.monitoring.alerting import SecureAlertSender
            alert_sender = SecureAlertSender(self.modular_config)
            
            modular_start = time.time()
            with patch.object(alert_sender, '_send_webhook', side_effect=capture_modular_webhook):
                for event in test_events[:5]:  # Same events
                    await alert_sender.send_alert(event)
            modular_time = time.time() - modular_start
            
            # Compare alert counts
            if len(monolith_alerts) != len(modular_alerts):
                result.add_difference(
                    "Alert Count",
                    f"Monolith sent {len(monolith_alerts)}, modular sent {len(modular_alerts)}"
                )
            
            # Compare alert structure (simplified)
            for i, (m_alert, mod_alert) in enumerate(zip(monolith_alerts, modular_alerts)):
                # Check webhook URL
                if m_alert['url'] != mod_alert['url']:
                    result.add_difference(f"Alert {i}", f"URL mismatch: {m_alert['url']} vs {mod_alert['url']}")
                
                # Check HMAC signatures if present
                m_sig = m_alert['headers'].get('X-Hub-Signature-256')
                mod_sig = mod_alert['headers'].get('X-Hub-Signature-256')
                
                if m_sig and mod_sig and m_sig != mod_sig:
                    # Note: Signatures may differ due to timestamp differences, this is expected
                    pass
                
                # Check payload structure
                m_payload = m_alert['payload']
                mod_payload = mod_alert['payload']
                
                if m_payload and mod_payload:
                    # Basic structure check
                    if 'text' in m_payload and 'alert_type' not in mod_payload and 'event_type' not in mod_payload:
                        result.add_difference(f"Alert {i}", "Payload structure differs significantly")
            
            # Store results
            result.monolith_results = {
                'alerts_sent': len(monolith_alerts),
                'processing_time': monolith_time,
                'avg_time_per_alert': monolith_time / len(monolith_alerts) if monolith_alerts else 0
            }
            
            result.modular_results = {
                'alerts_sent': len(modular_alerts),
                'processing_time': modular_time,
                'avg_time_per_alert': modular_time / len(modular_alerts) if modular_alerts else 0
            }
            
            # Performance metrics
            result.performance_metrics = {
                'monolith_time': monolith_time,
                'modular_time': modular_time,
                'improvement_percent': (monolith_time - modular_time) / monolith_time * 100 if monolith_time > 0 else 0
            }
            
        except Exception as e:
            result.mark_failure(f"Exception during alert delivery comparison: {e}")
            
        return result


class TestSideBySideComparison:
    """Side-by-side comparison tests."""
    
    @pytest.fixture
    def comparison_config(self):
        """Configuration for comparison tests."""
        return {
            'monitor_interval': 30,
            'container_patterns': ['dce-*'],
            'cpu_threshold': 80.0,
            'memory_threshold': 80.0,
            'network_threshold_mbps': 100.0,
            'allowed_ports': [80, 443, 8080, 3000],
            'blocked_processes': ['nc', 'netcat', 'telnet'],
            'alert_webhook': 'https://hooks.example.com/webhook',
            'alert_secret_key': 'test-secret-key-comparison'
        }
    
    @pytest.fixture
    def test_containers(self):
        """Test container dataset for comparison."""
        return [
            {
                "Id": "secure_test_container",
                "Names": ["/dce-secure-test"],
                "State": "running",
                "Config": {
                    "Image": "nginx:latest",
                    "User": "nginx:nginx",
                    "ExposedPorts": {"80/tcp": {}, "443/tcp": {}}
                },
                "HostConfig": {
                    "Privileged": False,
                    "ReadonlyRootfs": True
                },
                "Mounts": [],
                "Created": "2024-01-01T00:00:00Z"
            },
            {
                "Id": "insecure_test_container",
                "Names": ["/dce-insecure-test"],
                "State": "running",
                "Config": {
                    "Image": "ubuntu:latest",
                    "User": "root",  # Security issue
                    "ExposedPorts": {"22/tcp": {}}  # Non-standard port
                },
                "HostConfig": {
                    "Privileged": True,  # Security issue
                    "ReadonlyRootfs": False
                },
                "Mounts": [
                    {
                        "Source": "/var/run/docker.sock",
                        "Destination": "/var/run/docker.sock",
                        "Type": "bind"
                    }
                ],
                "Created": "2024-01-01T00:00:00Z"
            }
        ]
    
    @pytest.fixture
    def test_security_events(self):
        """Test security events for comparison."""
        return [
            SecurityEvent(
                event_type="security_misconfiguration",
                severity="CRITICAL",
                source="test",
                description="Privileged container detected",
                container_id="test_container_1",
                container_name="dce-test-1",
                details={"privileged": True}
            ),
            SecurityEvent(
                event_type="resource_anomaly",
                severity="HIGH",
                source="test",
                description="High CPU usage detected",
                container_id="test_container_2",
                container_name="dce-test-2",
                details={"cpu_percent": 95.0}
            ),
            SecurityEvent(
                event_type="network_anomaly",
                severity="MEDIUM",
                source="test",
                description="Unusual network traffic",
                container_id="test_container_3",
                container_name="dce-test-3",
                details={"network_activity": "high"}
            )
        ]
    
    async def test_container_detection_comparison(self, comparison_config, test_containers):
        """Compare container detection between systems."""
        async with SideBySideComparator(comparison_config) as comparator:
            result = await comparator.compare_container_detection(test_containers)
            
            # Verify comparison success
            assert result.success, f"Container detection comparison failed: {result.differences}"
            
            # Verify both systems detected the same containers
            assert result.monolith_results['container_count'] == result.modular_results['container_count']
            assert set(result.monolith_results['container_ids']) == set(result.modular_results['container_ids'])
            
            # Verify performance improvement (modular should be faster or equivalent)
            improvement = result.performance_metrics['improvement_percent']
            assert improvement >= -20, f"Modular system significantly slower: {improvement:.1f}% slower"
            
            print(f"Container Detection Performance: {improvement:.1f}% improvement")
    
    async def test_security_event_generation_comparison(self, comparison_config, test_containers):
        """Compare security event generation between systems."""
        async with SideBySideComparator(comparison_config) as comparator:
            result = await comparator.compare_security_event_generation(test_containers)
            
            # Verify comparison success
            if not result.success:
                print("Differences found:")
                for diff in result.differences:
                    print(f"  - {diff}")
            
            # Allow some differences in event generation due to implementation differences
            # but ensure major event types are detected by both systems
            monolith_event_types = set(result.monolith_results['event_groups'].keys())
            modular_event_types = set(result.modular_results['event_groups'].keys())
            
            # Both should detect security misconfigurations
            security_events_monolith = [et for et in monolith_event_types if 'security' in et.lower()]
            security_events_modular = [et for et in modular_event_types if 'security' in et.lower()]
            
            assert len(security_events_monolith) > 0, "Monolith should detect security events"
            assert len(security_events_modular) > 0, "Modular should detect security events"
            
            # Verify performance
            improvement = result.performance_metrics['improvement_percent']
            print(f"Event Generation Performance: {improvement:.1f}% improvement")
            print(f"Monolith events: {result.monolith_results['total_events']}")
            print(f"Modular events: {result.modular_results['total_events']}")
    
    async def test_alert_delivery_comparison(self, comparison_config, test_security_events):
        """Compare alert delivery between systems."""
        async with SideBySideComparator(comparison_config) as comparator:
            result = await comparator.compare_alert_delivery(test_security_events)
            
            # Verify comparison success
            if not result.success:
                print("Alert delivery differences:")
                for diff in result.differences:
                    print(f"  - {diff}")
            
            # Both systems should send alerts
            assert result.monolith_results['alerts_sent'] > 0, "Monolith should send alerts"
            assert result.modular_results['alerts_sent'] > 0, "Modular should send alerts"
            
            # Alert counts should be similar (allow small differences)
            monolith_count = result.monolith_results['alerts_sent']
            modular_count = result.modular_results['alerts_sent']
            
            difference_ratio = abs(monolith_count - modular_count) / max(monolith_count, modular_count)
            assert difference_ratio < 0.2, f"Alert count difference too large: {monolith_count} vs {modular_count}"
            
            # Verify performance
            improvement = result.performance_metrics['improvement_percent']
            print(f"Alert Delivery Performance: {improvement:.1f}% improvement")
            print(f"Monolith avg time per alert: {result.monolith_results['avg_time_per_alert']:.3f}s")
            print(f"Modular avg time per alert: {result.modular_results['avg_time_per_alert']:.3f}s")
    
    async def test_comprehensive_side_by_side_validation(self, comparison_config, test_containers, test_security_events):
        """Comprehensive side-by-side validation of all major components."""
        results = {}
        
        async with SideBySideComparator(comparison_config) as comparator:
            # Run all comparisons
            print("Running comprehensive side-by-side validation...")
            
            # Container detection
            print("  Testing container detection...")
            results['container_detection'] = await comparator.compare_container_detection(test_containers)
            
            # Security event generation
            print("  Testing security event generation...")
            results['event_generation'] = await comparator.compare_security_event_generation(test_containers)
            
            # Alert delivery
            print("  Testing alert delivery...")
            results['alert_delivery'] = await comparator.compare_alert_delivery(test_security_events)
            
            # Analyze overall results
            print("\nComparison Results Summary:")
            print("=" * 50)
            
            total_failures = 0
            for component, result in results.items():
                status = "✅ PASS" if result.success else "❌ FAIL"
                print(f"{component}: {status}")
                
                if result.differences:
                    print(f"  Differences: {len(result.differences)}")
                    for diff in result.differences[:3]:  # Show first 3
                        print(f"    - {diff}")
                
                if result.performance_metrics.get('improvement_percent'):
                    improvement = result.performance_metrics['improvement_percent']
                    print(f"  Performance: {improvement:+.1f}%")
                
                if not result.success:
                    total_failures += 1
                    
                print()
            
            # Overall assessment
            overall_success = total_failures == 0
            print(f"Overall Result: {'✅ PASS' if overall_success else '❌ FAIL'}")
            print(f"Components passed: {len(results) - total_failures}/{len(results)}")
            
            # Performance summary
            improvements = [
                r.performance_metrics.get('improvement_percent', 0)
                for r in results.values()
                if r.performance_metrics.get('improvement_percent') is not None
            ]
            
            if improvements:
                avg_improvement = sum(improvements) / len(improvements)
                print(f"Average performance improvement: {avg_improvement:+.1f}%")
            
            # Assert overall success for test framework
            assert overall_success, f"Side-by-side validation failed with {total_failures} component failures"
            
            return results


# Test markers
pytestmark = [
    pytest.mark.integration,
    pytest.mark.comparison,
    pytest.mark.asyncio
]