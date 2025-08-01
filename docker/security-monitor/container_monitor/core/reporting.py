"""
Security reporting and compliance report generation.

Features:
- Security posture summaries
- Event correlation and trending
- Compliance report generation (JSON, HTML) 
- Executive dashboard data
- Vulnerability summaries
- Performance metrics reports
"""

import asyncio
import json
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone, timedelta
from collections import defaultdict, Counter
from pathlib import Path
import structlog

from container_monitor.models.events import SecurityEvent
from container_monitor.models.config import MonitorConfig

logger = structlog.get_logger(__name__)


class ReportGenerator:
    """
    Generates comprehensive security and compliance reports.
    
    Features:
    - Security posture summaries
    - Event correlation and trending  
    - Compliance report generation
    - Executive dashboard data
    - Vulnerability summaries
    - Performance metrics
    """
    
    def __init__(self, config: MonitorConfig):
        """
        Initialize report generator.
        
        Args:
            config: Monitor configuration
        """
        self.config = config
        self.events_storage: List[SecurityEvent] = []
        self.report_cache: Dict[str, Dict[str, Any]] = {}
        self.last_report_generation = None
        
        # Report templates and configurations
        self.severity_weights = {
            "CRITICAL": 10,
            "HIGH": 7,
            "MEDIUM": 4,
            "LOW": 2,
            "INFO": 1
        }
        
        # Performance tracking
        self.reports_generated = 0
        self.last_report_time = None
        
    async def generate_security_report(
        self,
        timeframe: str = "24h",
        report_format: str = "json",
        include_details: bool = True
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive security report.
        
        Args:
            timeframe: Time period for the report (1h, 24h, 7d, 30d)
            report_format: Output format (json, html, summary)
            include_details: Whether to include detailed event information
            
        Returns:
            Complete security report dictionary
        """
        try:
            logger.info(
                "Generating security report",
                timeframe=timeframe,
                format=report_format,
                include_details=include_details
            )
            
            # Parse timeframe
            start_time = self._parse_timeframe(timeframe)
            end_time = datetime.now(timezone.utc)
            
            # Filter events by timeframe
            filtered_events = self._filter_events_by_time(start_time, end_time)
            
            # Generate core report sections
            report = {
                "metadata": {
                    "generated_at": end_time.isoformat(),
                    "timeframe": timeframe,
                    "start_time": start_time.isoformat(),
                    "end_time": end_time.isoformat(),
                    "report_format": report_format,
                    "total_events": len(filtered_events)
                },
                "executive_summary": await self._generate_executive_summary(filtered_events),
                "security_posture": await self._generate_security_posture_summary(filtered_events),
                "threat_analysis": await self._generate_threat_analysis(filtered_events),
                "compliance_status": await self._generate_compliance_status(filtered_events),
                "performance_metrics": await self._generate_performance_metrics(),
                "recommendations": await self._generate_recommendations(filtered_events)
            }
            
            # Add detailed events if requested  
            if include_details:
                report["detailed_events"] = await self._format_detailed_events(filtered_events)
                
            # Format according to requested type
            if report_format == "html":
                report["html_content"] = await self._generate_html_report(report)
            elif report_format == "summary":
                report = await self._generate_summary_report(report)
                
            # Cache the report
            cache_key = f"{timeframe}_{report_format}_{include_details}"
            self.report_cache[cache_key] = {
                "report": report,
                "generated_at": end_time,
                "expires_at": end_time + timedelta(minutes=15)
            }
            
            self.reports_generated += 1
            self.last_report_time = end_time
            
            logger.info(
                "Security report generated successfully",
                timeframe=timeframe,
                events_analyzed=len(filtered_events),
                report_size_kb=len(json.dumps(report)) / 1024
            )
            
            return report
            
        except Exception as e:
            logger.error(
                "Error generating security report",
                error=str(e),
                timeframe=timeframe,
                format=report_format
            )
            raise
            
    async def add_events(self, events: List[SecurityEvent]) -> None:
        """
        Add events to the report generator storage.
        
        Args:
            events: List of security events to add
        """
        self.events_storage.extend(events)
        
        # Maintain retention limit
        if len(self.events_storage) > 10000:  # Keep last 10k events
            self.events_storage = self.events_storage[-10000:]
            
        logger.debug(f"Added {len(events)} events to report storage")
        
    def _parse_timeframe(self, timeframe: str) -> datetime:
        """Parse timeframe string to datetime."""
        now = datetime.now(timezone.utc)
        
        if timeframe == "1h":
            return now - timedelta(hours=1)
        elif timeframe == "24h":
            return now - timedelta(hours=24)  
        elif timeframe == "7d":
            return now - timedelta(days=7)
        elif timeframe == "30d":
            return now - timedelta(days=30)
        else:
            # Default to 24 hours
            return now - timedelta(hours=24)
            
    def _filter_events_by_time(
        self,
        start_time: datetime,
        end_time: datetime
    ) -> List[SecurityEvent]:
        """Filter events by time range."""
        return [
            event for event in self.events_storage
            if start_time <= event.timestamp <= end_time
        ]
        
    async def _generate_executive_summary(
        self,
        events: List[SecurityEvent]
    ) -> Dict[str, Any]:
        """Generate executive summary section."""
        if not events:
            return {
                "status": "HEALTHY",
                "total_events": 0,
                "risk_score": 0,
                "key_findings": [],
                "action_required": False
            }
            
        # Calculate risk score
        risk_score = sum(
            self.severity_weights.get(event.severity, 1)
            for event in events
        )
        
        # Determine overall status
        critical_count = sum(1 for event in events if event.severity == "CRITICAL")
        high_count = sum(1 for event in events if event.severity == "HIGH")
        
        if critical_count > 0:
            status = "CRITICAL"
        elif high_count > 5:
            status = "HIGH_RISK"
        elif high_count > 0:
            status = "MEDIUM_RISK"
        else:
            status = "HEALTHY"
            
        # Generate key findings
        event_types = Counter(event.event_type for event in events)
        key_findings = []
        
        for event_type, count in event_types.most_common(5):
            severity_breakdown = Counter(
                event.severity for event in events 
                if event.event_type == event_type
            )
            key_findings.append({
                "type": event_type,
                "count": count,
                "severity_breakdown": dict(severity_breakdown),
                "percentage": (count / len(events)) * 100
            })
            
        return {
            "status": status,
            "total_events": len(events),
            "risk_score": risk_score,
            "severity_breakdown": dict(Counter(event.severity for event in events)),
            "key_findings": key_findings,
            "action_required": critical_count > 0 or high_count > 0,
            "containers_affected": len(set(
                event.container_name for event in events 
                if event.container_name
            ))
        }
        
    async def _generate_security_posture_summary(
        self,
        events: List[SecurityEvent]
    ) -> Dict[str, Any]:
        """Generate security posture summary."""
        security_events = [
            event for event in events
            if event.event_type in ["security_misconfiguration", "network_security"]
        ]
        
        if not security_events:
            return {
                "overall_score": 100,
                "total_issues": 0,
                "categories": {},
                "top_misconfigurations": []
            }
            
        # Calculate posture score (100 - penalty points)
        penalty_points = sum(
            self.severity_weights.get(event.severity, 1)
            for event in security_events
        )
        overall_score = max(0, 100 - min(penalty_points, 100))
        
        # Categorize security issues
        categories = {
            "privileged_containers": 0,
            "root_users": 0,
            "dangerous_mounts": 0,
            "network_exposure": 0,
            "capability_issues": 0,
            "resource_limits": 0
        }
        
        for event in security_events:
            details = event.details or {}
            
            if details.get("privileged"):
                categories["privileged_containers"] += 1
            elif "root" in event.description.lower():
                categories["root_users"] += 1
            elif "mount" in event.description.lower() or "docker.sock" in str(details):
                categories["dangerous_mounts"] += 1
            elif event.event_type == "network_security":
                categories["network_exposure"] += 1
            elif "capability" in event.description.lower():
                categories["capability_issues"] += 1
            elif "limit" in event.description.lower():
                categories["resource_limits"] += 1
                
        # Top misconfigurations
        misconfiguration_counts = Counter()
        for event in security_events:
            # Extract specific misconfiguration type from description
            desc = event.description.lower()
            if "privileged" in desc:
                misconfiguration_counts["Privileged containers"] += 1
            elif "root user" in desc:
                misconfiguration_counts["Root user execution"] += 1
            elif "docker.sock" in desc:
                misconfiguration_counts["Docker socket exposure"] += 1
            elif "capability" in desc:
                misconfiguration_counts["Dangerous capabilities"] += 1
            else:
                misconfiguration_counts[event.description[:50]] += 1
                
        return {
            "overall_score": overall_score,
            "total_issues": len(security_events),
            "categories": categories,
            "top_misconfigurations": [
                {"issue": issue, "count": count}
                for issue, count in misconfiguration_counts.most_common(10)
            ]
        }
        
    async def _generate_threat_analysis(
        self,
        events: List[SecurityEvent]
    ) -> Dict[str, Any]:
        """Generate threat analysis section."""
        threat_events = [
            event for event in events
            if event.event_type in [
                "suspicious_process", 
                "network_anomaly", 
                "data_exfiltration",
                "network_scanning"
            ]
        ]
        
        if not threat_events:
            return {
                "threat_level": "LOW",
                "active_threats": 0,
                "threat_categories": {},
                "attack_patterns": []
            }
            
        # Determine threat level
        critical_threats = sum(1 for event in threat_events if event.severity == "CRITICAL")
        high_threats = sum(1 for event in threat_events if event.severity == "HIGH")
        
        if critical_threats > 0:
            threat_level = "CRITICAL"
        elif high_threats > 3:
            threat_level = "HIGH"
        elif high_threats > 0:
            threat_level = "MEDIUM"
        else:
            threat_level = "LOW"
            
        # Categorize threats
        threat_categories = Counter()
        for event in threat_events:
            if event.event_type == "suspicious_process":
                threat_categories["Malicious Processes"] += 1
            elif event.event_type == "network_anomaly":
                threat_categories["Network Anomalies"] += 1
            elif event.event_type == "data_exfiltration":
                threat_categories["Data Exfiltration"] += 1
            elif event.event_type == "network_scanning":
                threat_categories["Network Scanning"] += 1
                
        # Identify attack patterns
        attack_patterns = []
        
        # Check for coordinated attacks (multiple threat types from same container)
        container_threats = defaultdict(list)
        for event in threat_events:
            if event.container_name:
                container_threats[event.container_name].append(event.event_type)
                
        for container, types in container_threats.items():
            if len(set(types)) > 2:  # Multiple different threat types
                attack_patterns.append({
                    "pattern": "Multi-vector Attack",
                    "container": container,
                    "threat_types": list(set(types)),
                    "event_count": len(types)
                })
                
        return {
            "threat_level": threat_level,
            "active_threats": len(threat_events),
            "threat_categories": dict(threat_categories),
            "attack_patterns": attack_patterns,
            "containers_under_attack": len(container_threats)
        }
        
    async def _generate_compliance_status(
        self,
        events: List[SecurityEvent]
    ) -> Dict[str, Any]:
        """Generate compliance status section."""
        compliance_violations = [
            event for event in events
            if event.event_type == "security_misconfiguration"
        ]
        
        # Basic compliance framework checks
        frameworks = {
            "CIS_Docker": {
                "total_checks": 20,
                "violations": 0,
                "critical_violations": 0
            },
            "NIST": {
                "total_checks": 15,
                "violations": 0,
                "critical_violations": 0
            },
            "PCI_DSS": {
                "total_checks": 10,
                "violations": 0,
                "critical_violations": 0
            }
        }
        
        # Map violations to compliance frameworks
        for event in compliance_violations:
            desc = event.description.lower()
            details = event.details or {}
            
            # CIS Docker violations
            if any(keyword in desc for keyword in ["privileged", "root", "docker.sock"]):
                frameworks["CIS_Docker"]["violations"] += 1
                if event.severity in ["CRITICAL", "HIGH"]:
                    frameworks["CIS_Docker"]["critical_violations"] += 1
                    
            # NIST violations  
            if any(keyword in desc for keyword in ["capability", "security", "limit"]):
                frameworks["NIST"]["violations"] += 1
                if event.severity in ["CRITICAL", "HIGH"]:
                    frameworks["NIST"]["critical_violations"] += 1
                    
            # PCI DSS violations (network and access related)
            if any(keyword in desc for keyword in ["network", "port", "access"]):
                frameworks["PCI_DSS"]["violations"] += 1
                if event.severity in ["CRITICAL", "HIGH"]:
                    frameworks["PCI_DSS"]["critical_violations"] += 1
                    
        # Calculate compliance scores
        for framework in frameworks.values():
            framework["compliance_score"] = max(
                0, 
                100 - (framework["violations"] / framework["total_checks"] * 100)
            )
            framework["critical_issues"] = framework["critical_violations"] > 0
            
        return {
            "overall_compliance_score": sum(
                f["compliance_score"] for f in frameworks.values()
            ) / len(frameworks),
            "frameworks": frameworks,
            "total_violations": len(compliance_violations),
            "requires_immediate_attention": any(
                f["critical_violations"] > 0 for f in frameworks.values()
            )
        }
        
    async def _generate_performance_metrics(self) -> Dict[str, Any]:
        """Generate performance metrics section."""
        return {
            "reports_generated": self.reports_generated,
            "last_report_time": self.last_report_time.isoformat() if self.last_report_time else None,
            "events_in_storage": len(self.events_storage),
            "cache_entries": len(self.report_cache),
            "report_generation_frequency": self.config.report_interval
        }
        
    async def _generate_recommendations(
        self,
        events: List[SecurityEvent]
    ) -> List[Dict[str, Any]]:
        """Generate actionable recommendations."""
        recommendations = []
        
        # Analyze event patterns for recommendations
        event_types = Counter(event.event_type for event in events)
        severity_counts = Counter(event.severity for event in events)
        
        # Critical recommendations
        if severity_counts.get("CRITICAL", 0) > 0:
            recommendations.append({
                "priority": "CRITICAL",
                "category": "Immediate Action Required",
                "title": "Address Critical Security Issues",
                "description": f"You have {severity_counts['CRITICAL']} critical security issues that require immediate attention.",
                "action_items": [
                    "Review all CRITICAL severity events",
                    "Implement remediation steps provided",
                    "Verify fixes are properly applied"
                ]
            })
            
        # Security posture recommendations
        if event_types.get("security_misconfiguration", 0) > 5:
            recommendations.append({
                "priority": "HIGH",
                "category": "Security Hardening", 
                "title": "Improve Container Security Configuration",
                "description": "Multiple security misconfigurations detected across containers.",
                "action_items": [
                    "Implement non-root user execution",
                    "Remove privileged mode where unnecessary",
                    "Apply principle of least privilege",
                    "Enable security profiles (AppArmor/SELinux)"
                ]
            })
            
        # Network security recommendations
        if event_types.get("network_anomaly", 0) > 3:
            recommendations.append({
                "priority": "MEDIUM",
                "category": "Network Security",
                "title": "Review Network Traffic Patterns",
                "description": "Unusual network activity patterns detected.",
                "action_items": [
                    "Implement network segmentation",
                    "Review firewall rules",
                    "Monitor outbound connections",
                    "Consider network policies"
                ]
            })
            
        # Monitoring improvements
        recommendations.append({
            "priority": "LOW",
            "category": "Monitoring Enhancement",
            "title": "Enhance Security Monitoring",
            "description": "Improve monitoring coverage and alert mechanisms.",
            "action_items": [
                "Review alert thresholds",
                "Implement automated response",
                "Enhance logging coverage",
                "Regular security audits"
            ]
        })
        
        return recommendations
        
    async def _format_detailed_events(
        self,
        events: List[SecurityEvent]
    ) -> List[Dict[str, Any]]:
        """Format events for detailed reporting."""
        return [
            {
                "timestamp": event.timestamp.isoformat(),
                "event_type": event.event_type,
                "severity": event.severity,
                "container_id": event.container_id,
                "container_name": event.container_name,
                "source": event.source,
                "description": event.description,
                "details": event.details,
                "remediation": event.remediation
            }
            for event in sorted(events, key=lambda e: e.timestamp, reverse=True)
        ]
        
    async def _generate_html_report(self, report: Dict[str, Any]) -> str:
        """Generate HTML formatted report."""
        # Basic HTML template - in production, use proper templating
        html_template = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Container Security Report</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                .header {{ background: #f4f4f4; padding: 20px; border-radius: 5px; }}
                .section {{ margin: 20px 0; padding: 15px; border-left: 4px solid #007cba; }}
                .critical {{ border-left-color: #dc3545; }}
                .high {{ border-left-color: #fd7e14; }}
                .medium {{ border-left-color: #ffc107; }}
                .low {{ border-left-color: #28a745; }}
                table {{ width: 100%; border-collapse: collapse; }}
                th, td {{ padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }}
                th {{ background-color: #f2f2f2; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Container Security Report</h1>
                <p>Generated: {report['metadata']['generated_at']}</p>
                <p>Timeframe: {report['metadata']['timeframe']}</p>
                <p>Total Events: {report['metadata']['total_events']}</p>
            </div>
            
            <div class="section {report['executive_summary']['status'].lower()}">
                <h2>Executive Summary</h2>
                <p>Status: <strong>{report['executive_summary']['status']}</strong></p>
                <p>Risk Score: {report['executive_summary']['risk_score']}</p>
                <p>Action Required: {'Yes' if report['executive_summary']['action_required'] else 'No'}</p>
            </div>
            
            <div class="section">
                <h2>Security Posture</h2>
                <p>Overall Score: {report['security_posture']['overall_score']}/100</p>
                <p>Total Issues: {report['security_posture']['total_issues']}</p>
            </div>
            
            <div class="section">
                <h2>Threat Analysis</h2>
                <p>Threat Level: <strong>{report['threat_analysis']['threat_level']}</strong></p>
                <p>Active Threats: {report['threat_analysis']['active_threats']}</p>
            </div>
            
            <div class="section">
                <h2>Recommendations</h2>
                <ul>
        """
        
        for rec in report['recommendations']:
            html_template += f"<li><strong>{rec['title']}</strong>: {rec['description']}</li>"
            
        html_template += """
                </ul>
            </div>
        </body>
        </html>
        """
        
        return html_template
        
    async def _generate_summary_report(self, full_report: Dict[str, Any]) -> Dict[str, Any]:
        """Generate condensed summary report."""
        return {
            "summary": {
                "status": full_report['executive_summary']['status'],
                "total_events": full_report['metadata']['total_events'],
                "risk_score": full_report['executive_summary']['risk_score'],
                "threat_level": full_report['threat_analysis']['threat_level'],
                "compliance_score": full_report['compliance_status']['overall_compliance_score'],
                "action_required": full_report['executive_summary']['action_required']
            },
            "top_issues": full_report['security_posture']['top_misconfigurations'][:5],
            "critical_recommendations": [
                rec for rec in full_report['recommendations'] 
                if rec['priority'] in ['CRITICAL', 'HIGH']
            ][:3]
        }
        
    def get_cached_report(
        self,
        timeframe: str,
        report_format: str = "json",
        include_details: bool = True
    ) -> Optional[Dict[str, Any]]:
        """Get cached report if available and not expired."""
        cache_key = f"{timeframe}_{report_format}_{include_details}"
        
        if cache_key in self.report_cache:
            cached = self.report_cache[cache_key]
            if datetime.now(timezone.utc) < cached["expires_at"]:
                logger.debug(f"Returning cached report for {cache_key}")
                return cached["report"]
            else:
                # Remove expired cache
                del self.report_cache[cache_key]
                
        return None
        
    def clear_cache(self):
        """Clear all cached reports."""
        self.report_cache.clear()
        logger.info("Report cache cleared")
        
    def get_report_statistics(self) -> Dict[str, Any]:
        """Get reporting statistics."""
        return {
            "reports_generated": self.reports_generated,
            "events_in_storage": len(self.events_storage),
            "cached_reports": len(self.report_cache),
            "last_report_time": self.last_report_time.isoformat() if self.last_report_time else None
        }