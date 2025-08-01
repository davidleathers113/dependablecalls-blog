"""
Security posture analysis for container configurations.

Checks:
- Privileged containers and dangerous capabilities
- Root user execution
- Sensitive directory mounts
- Docker socket exposure
- Port security configurations
- Security policy compliance
"""

import asyncio
from typing import Dict, List, Any, Optional, Set
from datetime import datetime, timezone
import structlog

from container_monitor.models.events import SecurityEvent
from container_monitor.models.config import MonitorConfig
from container_monitor.adapters.docker_async import AsyncDockerClient

logger = structlog.get_logger(__name__)


class SecurityPostureChecker:
    """
    Analyzes container security posture and configuration.
    
    Features:
    - Privileged container detection
    - User and capability analysis
    - Mount point security assessment
    - Network exposure validation
    - Security policy compliance
    """
    
    def __init__(self, config: MonitorConfig):
        """
        Initialize security posture checker.
        
        Args:
            config: Monitor configuration
        """
        self.config = config
        self.checked_containers: Set[str] = set()
        self.policy_violations: Dict[str, List[Dict]] = {}
        
        # Dangerous capabilities to watch for
        self.dangerous_capabilities = {
            'SYS_ADMIN', 'SYS_MODULE', 'SYS_TIME', 'SYS_BOOT',
            'SYS_PTRACE', 'DAC_OVERRIDE', 'NET_ADMIN', 'NET_RAW'
        }
        
        # Sensitive directories that should not be mounted
        self.sensitive_directories = {
            '/etc', '/proc', '/sys', '/boot', '/dev', '/lib/modules',
            '/usr/lib/modules', '/var/run/docker.sock', '/var/lib/docker'
        }
        
        # Performance tracking
        self.total_checks = 0
        self.violations_found = 0
        
    async def check_container_posture(
        self,
        docker_client: AsyncDockerClient,
        container_info: Dict[str, Any]
    ) -> List[SecurityEvent]:
        """
        Check security posture of a single container.
        
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
            # Get detailed container configuration
            # Note: container_info should contain the full inspect data
            container_config = container_info.get('Config', {})
            host_config = container_info.get('HostConfig', {})
            mounts = container_info.get('Mounts', [])
            
            # Perform security checks
            events.extend(await self._check_user_configuration(
                container_id, container_name, container_config
            ))
            
            events.extend(await self._check_privileged_mode(
                container_id, container_name, host_config
            ))
            
            events.extend(await self._check_capabilities(
                container_id, container_name, host_config
            ))
            
            events.extend(await self._check_network_configuration(
                container_id, container_name, container_config, host_config
            ))
            
            events.extend(await self._check_mount_security(
                container_id, container_name, mounts
            ))
            
            events.extend(await self._check_security_options(
                container_id, container_name, host_config
            ))
            
            events.extend(await self._check_resource_limits(
                container_id, container_name, host_config
            ))
            
            # Track violations
            if events:
                self.policy_violations[container_id] = [
                    {
                        'event_type': event.event_type,
                        'severity': event.severity,
                        'description': event.description,
                        'timestamp': event.timestamp.isoformat()
                    }
                    for event in events
                ]
                self.violations_found += len(events)
                
            self.checked_containers.add(container_id)
            self.total_checks += 1
            
            logger.debug(
                "Security posture check completed",
                container_id=container_id,
                container_name=container_name,
                violations_found=len(events)
            )
            
        except Exception as e:
            logger.error(
                "Error checking container security posture",
                container_id=container_id,
                container_name=container_name,
                error=str(e)
            )
            
            events.append(SecurityEvent(
                event_type="posture_check_error",
                severity="LOW",
                container_id=container_id,
                container_name=container_name,
                source="security_posture_checker",
                description=f"Failed to check security posture: {e}",
                details={"error": str(e)}
            ))
            
        return events
        
    async def _check_user_configuration(
        self,
        container_id: str,
        container_name: str,
        container_config: Dict[str, Any]
    ) -> List[SecurityEvent]:
        """Check user configuration for security issues."""
        events = []
        
        user = container_config.get('User', '')
        
        # Check if running as root
        if not user or user == '0' or user.lower() == 'root':
            events.append(SecurityEvent(
                event_type="security_misconfiguration",
                severity="HIGH",
                container_id=container_id,
                container_name=container_name,
                source="security_posture_checker",
                description="Container running as root user",
                details={
                    "user": user or "root",
                    "risk": "Full system access within container"
                },
                remediation="Configure container to run as non-root user"
            ))
            
        # Check for UID 0 even with username
        elif user.startswith('0:') or ':0' in user:
            events.append(SecurityEvent(
                event_type="security_misconfiguration",
                severity="HIGH",
                container_id=container_id,
                container_name=container_name,
                source="security_posture_checker",
                description=f"Container running with root UID: {user}",
                details={
                    "user": user,
                    "risk": "Effective root access"
                },
                remediation="Use non-zero UID for container user"
            ))
            
        return events
        
    async def _check_privileged_mode(
        self,
        container_id: str,
        container_name: str,
        host_config: Dict[str, Any]
    ) -> List[SecurityEvent]:
        """Check for privileged mode configuration."""
        events = []
        
        if host_config.get('Privileged', False):
            events.append(SecurityEvent(
                event_type="security_misconfiguration",
                severity="CRITICAL",
                container_id=container_id,
                container_name=container_name,
                source="security_posture_checker",
                description="Container running in privileged mode",
                details={
                    "privileged": True,
                    "risk": "Full host system access, kernel bypass"
                },
                remediation="Remove privileged mode and use specific capabilities instead"
            ))
            
        return events
        
    async def _check_capabilities(
        self,
        container_id: str,
        container_name: str,
        host_config: Dict[str, Any]
    ) -> List[SecurityEvent]:
        """Check capability configuration."""
        events = []
        
        cap_add = host_config.get('CapAdd', []) or []
        cap_drop = host_config.get('CapDrop', []) or []
        
        # Check for dangerous capabilities
        for cap in cap_add:
            if cap in self.dangerous_capabilities:
                severity = "CRITICAL" if cap in ['SYS_ADMIN', 'SYS_MODULE'] else "HIGH"
                events.append(SecurityEvent(
                    event_type="security_misconfiguration",
                    severity=severity,
                    container_id=container_id,
                    container_name=container_name,
                    source="security_posture_checker",
                    description=f"Dangerous capability added: {cap}",
                    details={
                        "capability": cap,
                        "risk": f"Enhanced privileges: {cap}",
                        "added_capabilities": cap_add
                    },
                    remediation=f"Remove {cap} capability or use more specific permissions"
                ))
                
        # Check if ALL capabilities are added
        if 'ALL' in cap_add:
            events.append(SecurityEvent(
                event_type="security_misconfiguration",
                severity="CRITICAL",
                container_id=container_id,
                container_name=container_name,
                source="security_posture_checker",
                description="All capabilities granted to container",
                details={
                    "capabilities": "ALL",
                    "risk": "Equivalent to privileged mode"
                },
                remediation="Grant only specific required capabilities"
            ))
            
        # Recommend dropping capabilities if none are dropped
        if not cap_drop and not cap_add:
            events.append(SecurityEvent(
                event_type="security_recommendation",
                severity="MEDIUM",
                container_id=container_id,
                container_name=container_name,
                source="security_posture_checker",
                description="No capabilities explicitly dropped",
                details={
                    "current_policy": "default_capabilities",
                    "recommendation": "drop_unnecessary_capabilities"
                },
                remediation="Drop unnecessary capabilities like NET_RAW, SYS_CHROOT"
            ))
            
        return events
        
    async def _check_network_configuration(
        self,
        container_id: str,
        container_name: str,
        container_config: Dict[str, Any],
        host_config: Dict[str, Any]
    ) -> List[SecurityEvent]:
        """Check network security configuration."""
        events = []
        
        # Check exposed ports
        exposed_ports = container_config.get('ExposedPorts', {})
        for port_spec in exposed_ports.keys():
            port_num = int(port_spec.split('/')[0])
            
            if port_num not in self.config.allowed_ports:
                events.append(SecurityEvent(
                    event_type="network_security",
                    severity="MEDIUM",
                    container_id=container_id,
                    container_name=container_name,
                    source="security_posture_checker",
                    description=f"Non-standard port exposed: {port_spec}",
                    details={
                        "exposed_port": port_spec,
                        "port_number": port_num,
                        "allowed_ports": self.config.allowed_ports
                    },
                    remediation="Review port exposure and close unnecessary ports"
                ))
                
        # Check network mode
        network_mode = host_config.get('NetworkMode', '')
        if network_mode == 'host':
            events.append(SecurityEvent(
                event_type="security_misconfiguration",
                severity="HIGH",
                container_id=container_id,
                container_name=container_name,
                source="security_posture_checker",
                description="Container using host network mode",
                details={
                    "network_mode": network_mode,
                    "risk": "Direct access to host network stack"
                },
                remediation="Use bridge or custom networks instead of host networking"
            ))
            
        # Check for port bindings to all interfaces
        port_bindings = host_config.get('PortBindings', {})
        for container_port, host_bindings in port_bindings.items():
            if host_bindings:
                for binding in host_bindings:
                    host_ip = binding.get('HostIp', '')
                    if not host_ip or host_ip == '0.0.0.0':
                        events.append(SecurityEvent(
                            event_type="network_security",
                            severity="MEDIUM",
                            container_id=container_id,
                            container_name=container_name,
                            source="security_posture_checker",
                            description=f"Port {container_port} bound to all interfaces",
                            details={
                                "container_port": container_port,
                                "host_ip": host_ip or "0.0.0.0",
                                "host_port": binding.get('HostPort')
                            },
                            remediation="Bind ports to specific interfaces (127.0.0.1) when possible"
                        ))
                        
        return events
        
    async def _check_mount_security(
        self,
        container_id: str,
        container_name: str,
        mounts: List[Dict[str, Any]]
    ) -> List[SecurityEvent]:
        """Check mount point security."""
        events = []
        
        for mount in mounts:
            source = mount.get('Source', '')
            destination = mount.get('Destination', '')
            mode = mount.get('Mode', '')
            mount_type = mount.get('Type', '')
            
            # Check for Docker socket mount
            if '/var/run/docker.sock' in source:
                events.append(SecurityEvent(
                    event_type="security_misconfiguration",
                    severity="CRITICAL",
                    container_id=container_id,
                    container_name=container_name,
                    source="security_posture_checker",
                    description="Container has access to Docker socket",
                    details={
                        "mount_source": source,
                        "mount_destination": destination,
                        "mount_mode": mode,
                        "risk": "Full Docker daemon access"
                    },
                    remediation="Remove Docker socket mount or make it read-only if absolutely necessary"
                ))
                
            # Check for sensitive directory mounts
            for sensitive_dir in self.sensitive_directories:
                if source.startswith(sensitive_dir) and sensitive_dir != source:
                    severity = "CRITICAL" if sensitive_dir in ['/proc', '/sys'] else "HIGH"
                    events.append(SecurityEvent(
                        event_type="security_misconfiguration",
                        severity=severity,
                        container_id=container_id,
                        container_name=container_name,
                        source="security_posture_checker",
                        description=f"Sensitive directory mounted: {source}",
                        details={
                            "mount_source": source,
                            "mount_destination": destination,
                            "sensitive_directory": sensitive_dir,
                            "mount_mode": mode,
                            "mount_type": mount_type
                        },
                        remediation="Avoid mounting sensitive host directories"
                    ))
                    
            # Check for writable system mounts
            if (destination.startswith('/etc') or destination.startswith('/usr')) and 'rw' in mode:
                events.append(SecurityEvent(
                    event_type="security_misconfiguration",
                    severity="HIGH",
                    container_id=container_id,
                    container_name=container_name,
                    source="security_posture_checker",
                    description=f"Writable system directory mount: {destination}",
                    details={
                        "mount_destination": destination,
                        "mount_mode": mode,
                        "risk": "Potential system file modification"
                    },
                    remediation="Make system directory mounts read-only"
                ))
                
        return events
        
    async def _check_security_options(
        self,
        container_id: str,
        container_name: str,
        host_config: Dict[str, Any]
    ) -> List[SecurityEvent]:
        """Check security-related options."""
        events = []
        
        security_opt = host_config.get('SecurityOpt', []) or []
        
        # Check for disabled security features
        for opt in security_opt:
            if 'apparmor=unconfined' in opt or 'seccomp=unconfined' in opt:
                events.append(SecurityEvent(
                    event_type="security_misconfiguration",
                    severity="HIGH",
                    container_id=container_id,
                    container_name=container_name,
                    source="security_posture_checker",
                    description=f"Security feature disabled: {opt}",
                    details={
                        "security_option": opt,
                        "risk": "Reduced container isolation"
                    },
                    remediation="Enable AppArmor/SELinux and seccomp profiles"
                ))
                
        # Check for no-new-privileges
        if not any('no-new-privileges' in opt for opt in security_opt):
            events.append(SecurityEvent(
                event_type="security_recommendation",
                severity="MEDIUM",
                container_id=container_id,
                container_name=container_name,
                source="security_posture_checker",
                description="no-new-privileges not set",
                details={
                    "security_options": security_opt,
                    "recommendation": "Enable no-new-privileges"
                },
                remediation="Add --security-opt no-new-privileges:true"
            ))
            
        return events
        
    async def _check_resource_limits(
        self,
        container_id: str,
        container_name: str,
        host_config: Dict[str, Any]
    ) -> List[SecurityEvent]:
        """Check resource limit configuration."""
        events = []
        
        memory_limit = host_config.get('Memory', 0)
        cpu_quota = host_config.get('CpuQuota', 0)
        pid_limit = host_config.get('PidsLimit', 0)
        
        # Check for unlimited memory
        if memory_limit == 0:
            events.append(SecurityEvent(
                event_type="security_recommendation",
                severity="MEDIUM",
                container_id=container_id,
                container_name=container_name,
                source="security_posture_checker",
                description="No memory limit set",
                details={
                    "memory_limit": memory_limit,
                    "risk": "Potential memory exhaustion attacks"
                },
                remediation="Set appropriate memory limits"
            ))
            
        # Check for unlimited PIDs
        if not pid_limit:
            events.append(SecurityEvent(
                event_type="security_recommendation",
                severity="LOW",
                container_id=container_id,
                container_name=container_name,
                source="security_posture_checker",
                description="No PID limit set",
                details={
                    "pid_limit": pid_limit,
                    "risk": "Potential fork bomb attacks"
                },
                remediation="Set PID limits to prevent fork bombs"
            ))
            
        return events
        
    def get_posture_summary(self) -> Dict[str, Any]:
        """Get security posture summary."""
        violation_counts = {}
        severity_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        
        for container_violations in self.policy_violations.values():
            for violation in container_violations:
                event_type = violation['event_type']
                severity = violation['severity']
                
                violation_counts[event_type] = violation_counts.get(event_type, 0) + 1
                severity_counts[severity] = severity_counts.get(severity, 0) + 1
                
        return {
            "total_checks": self.total_checks,
            "containers_checked": len(self.checked_containers),
            "total_violations": self.violations_found,
            "violation_rate": (
                self.violations_found / self.total_checks 
                if self.total_checks > 0 else 0
            ),
            "violation_by_type": violation_counts,
            "violation_by_severity": severity_counts,
            "containers_with_violations": len(self.policy_violations)
        }
        
    def get_container_violations(self, container_id: str) -> Optional[List[Dict]]:
        """Get violations for a specific container."""
        return self.policy_violations.get(container_id)
        
    def reset_statistics(self):
        """Reset tracking statistics."""
        self.checked_containers.clear()
        self.policy_violations.clear()
        self.total_checks = 0
        self.violations_found = 0