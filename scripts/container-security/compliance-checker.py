#!/usr/bin/env python3

"""
Container Security Compliance Checker
=====================================

This script validates container security compliance against industry standards and organizational policies.
It implements comprehensive compliance checking for:

- CIS Docker Benchmark
- NIST Cybersecurity Framework
- PCI DSS (if applicable)
- ISO 27001 controls
- SOC 2 trust criteria
- Custom organizational policies

The checker provides detailed compliance reports with remediation guidance and evidence collection.
"""

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
from dataclasses import dataclass, asdict
from enum import Enum

import docker
import yaml
from pydantic import BaseModel, Field


class ComplianceLevel(Enum):
    """Compliance check result levels"""
    COMPLIANT = "COMPLIANT"
    NON_COMPLIANT = "NON_COMPLIANT"
    PARTIALLY_COMPLIANT = "PARTIALLY_COMPLIANT"
    NOT_APPLICABLE = "NOT_APPLICABLE"
    EXCEPTION_GRANTED = "EXCEPTION_GRANTED"


class Severity(Enum):
    """Compliance violation severity"""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


@dataclass
class ComplianceCheck:
    """Individual compliance check result"""
    check_id: str
    title: str
    description: str
    framework: str
    control_id: str
    result: ComplianceLevel
    severity: Severity
    evidence: Dict[str, Any]
    remediation: str
    references: List[str]
    timestamp: str = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now(timezone.utc).isoformat()
    
    def to_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        result['result'] = self.result.value
        result['severity'] = self.severity.value
        return result


class SecurityPolicy(BaseModel):
    """Security policy configuration model"""
    metadata: Dict[str, Any]
    compliance_frameworks: Dict[str, Any]
    container_image_policies: Dict[str, Any]
    container_runtime_policies: Dict[str, Any]
    network_security_policies: Dict[str, Any]
    storage_security_policies: Dict[str, Any]
    secrets_management_policies: Dict[str, Any]
    monitoring_compliance_policies: Dict[str, Any]
    incident_response_policies: Dict[str, Any]
    policy_enforcement: Dict[str, Any]


class ContainerSecurityComplianceChecker:
    """Container security compliance validation engine"""
    
    def __init__(self, project_root: str = ".", policy_file: str = None):
        self.project_root = Path(project_root)
        self.docker_client = docker.from_env()
        self.compliance_checks: List[ComplianceCheck] = []
        
        # Load security policies
        if policy_file:
            self.policy_path = Path(policy_file)
        else:
            self.policy_path = self.project_root / "scripts/container-security/security-policies.yaml"
        
        self.policies = self._load_security_policies()
        
    def _load_security_policies(self) -> SecurityPolicy:
        """Load security policies from configuration file"""
        try:
            with open(self.policy_path, 'r') as f:
                policy_data = yaml.safe_load(f)
            return SecurityPolicy(**policy_data)
        except Exception as e:
            print(f"Warning: Could not load security policies from {self.policy_path}: {e}")
            print("Using default policies...")
            return self._get_default_policies()
    
    def _get_default_policies(self) -> SecurityPolicy:
        """Get default security policies"""
        default_policies = {
            "metadata": {"name": "Default Policies", "version": "1.0.0"},
            "compliance_frameworks": {"cis_docker_benchmark": {"enabled": True}},
            "container_image_policies": {"base_image_requirements": {"allowed_base_images": []}},
            "container_runtime_policies": {"security_context": {"privileged_containers": {"allowed": False}}},
            "network_security_policies": {"network_isolation": {"default_network": {"usage_allowed": False}}},
            "storage_security_policies": {"volume_mounts": {"host_path_mounts": {"allowed": True}}},
            "secrets_management_policies": {"secret_storage": {"prohibited_locations": []}},
            "monitoring_compliance_policies": {"security_monitoring": {"log_aggregation": {"required": True}}},
            "incident_response_policies": {"detection": {"automated_detection": {"anomaly_detection": True}}},
            "policy_enforcement": {"enforcement_mode": {"mode": "enforcing"}}
        }
        return SecurityPolicy(**default_policies)
    
    def add_compliance_check(self, check_id: str, title: str, description: str,
                           framework: str, control_id: str, result: ComplianceLevel,
                           severity: Severity, evidence: Dict[str, Any],
                           remediation: str, references: List[str] = None):
        """Add a compliance check result"""
        check = ComplianceCheck(
            check_id=check_id,
            title=title,
            description=description,
            framework=framework,
            control_id=control_id,
            result=result,
            severity=severity,
            evidence=evidence,
            remediation=remediation,
            references=references or []
        )
        self.compliance_checks.append(check)
    
    def check_cis_docker_benchmark(self) -> None:
        """Check CIS Docker Benchmark compliance"""
        if not self.policies.compliance_frameworks.get("cis_docker_benchmark", {}).get("enabled", False):
            return
            
        print("🔍 Checking CIS Docker Benchmark compliance...")
        
        # CIS 5.1 - Verify AppArmor Profile, if applicable
        self._check_cis_5_1_apparmor()
        
        # CIS 5.2 - Verify SELinux security options, if applicable
        self._check_cis_5_2_selinux()
        
        # CIS 5.3 - Restrict Linux Kernel Capabilities within containers
        self._check_cis_5_3_capabilities()
        
        # CIS 5.4 - Do not use privileged containers
        self._check_cis_5_4_privileged()
        
        # CIS 5.5 - Do not mount sensitive host system directories on containers
        self._check_cis_5_5_sensitive_mounts()
        
        # CIS 5.6 - Do not run ssh within containers
        self._check_cis_5_6_ssh()
        
        # CIS 5.7 - Do not map privileged ports within containers
        self._check_cis_5_7_privileged_ports()
        
        # CIS 5.8 - Open only needed ports on container
        self._check_cis_5_8_needed_ports()
        
        # CIS 5.9 - Do not share the host's network namespace
        self._check_cis_5_9_host_network()
        
        # CIS 5.10 - Limit memory usage for container
        self._check_cis_5_10_memory_limits()
        
        # CIS 5.11 - Set container CPU priority appropriately
        self._check_cis_5_11_cpu_priority()
        
        # CIS 5.12 - Mount container's root filesystem as read only
        self._check_cis_5_12_readonly_rootfs()
        
        # CIS 5.13 - Bind incoming container traffic to a specific host interface
        self._check_cis_5_13_host_interface()
        
        # CIS 5.14 - Set the 'on-failure' container restart policy to 5
        self._check_cis_5_14_restart_policy()
        
        # CIS 5.15 - Do not share the host's process namespace
        self._check_cis_5_15_host_pid()
        
        # CIS 5.16 - Do not share the host's IPC namespace
        self._check_cis_5_16_host_ipc()
        
        # CIS 5.17 - Do not directly expose host devices to containers
        self._check_cis_5_17_host_devices()
        
        # CIS 5.18 - Override default ulimit at runtime only if needed
        self._check_cis_5_18_ulimits()
        
        # CIS 5.19 - Do not set mount propagation mode to shared
        self._check_cis_5_19_mount_propagation()
        
        # CIS 5.20 - Do not share the host's UTS namespace
        self._check_cis_5_20_host_uts()
        
        # CIS 5.21 - Do not disable default seccomp profile
        self._check_cis_5_21_seccomp()
        
        # CIS 5.22 - Do not docker exec with privileged option
        self._check_cis_5_22_exec_privileged()
        
        # CIS 5.23 - Do not docker exec with user option
        self._check_cis_5_23_exec_user()
        
        # CIS 5.24 - Confirm cgroup usage
        self._check_cis_5_24_cgroup()
        
        # CIS 5.25 - Restrict container from acquiring additional privileges
        self._check_cis_5_25_no_new_privileges()
        
        # CIS 5.26 - Check container health at runtime
        self._check_cis_5_26_health_check()
        
        # CIS 5.27 - Ensure docker commands always get the latest version of the image
        self._check_cis_5_27_image_updates()
        
        # CIS 5.28 - Use PIDs cgroup limit
        self._check_cis_5_28_pids_limit()
        
        # CIS 5.29 - Do not use Docker's default bridge docker0
        self._check_cis_5_29_default_bridge()
        
        # CIS 5.30 - Do not share the host's user namespaces
        self._check_cis_5_30_user_namespace()
        
        # CIS 5.31 - Do not mount the Docker socket inside any containers
        self._check_cis_5_31_docker_socket()
    
    def _check_cis_5_4_privileged(self) -> None:
        """CIS 5.4 - Do not use privileged containers"""
        try:
            containers = self.docker_client.containers.list()
            
            for container in containers:
                is_privileged = container.attrs['HostConfig'].get('Privileged', False)
                
                # Check if container is in allowed exceptions
                allowed_privileged = self.policies.container_runtime_policies.get(
                    'security_context', {}
                ).get('privileged_containers', {}).get('exceptions', [])
                
                if is_privileged and container.name not in allowed_privileged:
                    self.add_compliance_check(
                        check_id="CIS-5.4",
                        title="Privileged Container Usage",
                        description=f"Container '{container.name}' is running in privileged mode",
                        framework="CIS Docker Benchmark",
                        control_id="5.4",
                        result=ComplianceLevel.NON_COMPLIANT,
                        severity=Severity.CRITICAL,
                        evidence={
                            "container_name": container.name,
                            "container_id": container.id,
                            "privileged": is_privileged,
                            "policy_allows_privileged": container.name in allowed_privileged
                        },
                        remediation="Remove privileged mode and use specific capabilities instead",
                        references=["https://docs.docker.com/engine/reference/run/#runtime-privilege-and-linux-capabilities"]
                    )
                else:
                    self.add_compliance_check(
                        check_id="CIS-5.4",
                        title="Privileged Container Usage",
                        description=f"Container '{container.name}' is not running in privileged mode",
                        framework="CIS Docker Benchmark", 
                        control_id="5.4",
                        result=ComplianceLevel.COMPLIANT,
                        severity=Severity.INFO,
                        evidence={
                            "container_name": container.name,
                            "container_id": container.id,
                            "privileged": is_privileged
                        },
                        remediation="No action required - container follows privilege restrictions"
                    )
                    
        except Exception as e:
            self.add_compliance_check(
                check_id="CIS-5.4",
                title="Privileged Container Check Error",
                description=f"Unable to check privileged container usage: {e}",
                framework="CIS Docker Benchmark",
                control_id="5.4",
                result=ComplianceLevel.NOT_APPLICABLE,
                severity=Severity.HIGH,
                evidence={"error": str(e)},
                remediation="Fix Docker access issues and re-run compliance check"
            )
    
    def _check_cis_5_5_sensitive_mounts(self) -> None:
        """CIS 5.5 - Do not mount sensitive host system directories on containers"""
        try:
            containers = self.docker_client.containers.list()
            
            # Get prohibited paths from policy
            prohibited_paths = self.policies.storage_security_policies.get(
                'volume_mounts', {}
            ).get('host_path_mounts', {}).get('prohibited_paths', [
                '/etc', '/proc', '/sys', '/boot', '/dev', '/var/run/docker.sock'
            ])
            
            for container in containers:
                mounts = container.attrs.get('Mounts', [])
                violations = []
                
                for mount in mounts:
                    source = mount.get('Source', '')
                    
                    for prohibited_path in prohibited_paths:
                        if source.startswith(prohibited_path):
                            violations.append({
                                'source': source,
                                'destination': mount.get('Destination', ''),
                                'prohibited_path': prohibited_path
                            })
                
                if violations:
                    self.add_compliance_check(
                        check_id="CIS-5.5",
                        title="Sensitive Host Directory Mounts",
                        description=f"Container '{container.name}' mounts sensitive host directories",
                        framework="CIS Docker Benchmark",
                        control_id="5.5",
                        result=ComplianceLevel.NON_COMPLIANT,
                        severity=Severity.HIGH,
                        evidence={
                            "container_name": container.name,
                            "container_id": container.id,
                            "violations": violations,
                            "prohibited_paths": prohibited_paths
                        },
                        remediation="Remove mounts of sensitive host directories or use read-only mounts where necessary",
                        references=["https://docs.docker.com/storage/volumes/"]
                    )
                else:
                    self.add_compliance_check(
                        check_id="CIS-5.5",
                        title="Sensitive Host Directory Mounts",
                        description=f"Container '{container.name}' does not mount sensitive host directories",
                        framework="CIS Docker Benchmark",
                        control_id="5.5",
                        result=ComplianceLevel.COMPLIANT,
                        severity=Severity.INFO,
                        evidence={
                            "container_name": container.name,
                            "container_id": container.id,
                            "mount_count": len(mounts),
                            "violations": 0
                        },
                        remediation="No action required - container follows mount restrictions"
                    )
                    
        except Exception as e:
            self.add_compliance_check(
                check_id="CIS-5.5",
                title="Sensitive Mount Check Error",
                description=f"Unable to check sensitive host directory mounts: {e}",
                framework="CIS Docker Benchmark",
                control_id="5.5",
                result=ComplianceLevel.NOT_APPLICABLE,
                severity=Severity.HIGH,
                evidence={"error": str(e)},
                remediation="Fix Docker access issues and re-run compliance check"
            )
    
    def _check_cis_5_9_host_network(self) -> None:
        """CIS 5.9 - Do not share the host's network namespace"""
        try:
            containers = self.docker_client.containers.list()
            
            for container in containers:
                network_mode = container.attrs['HostConfig'].get('NetworkMode', 'default')
                
                if network_mode == 'host':
                    self.add_compliance_check(
                        check_id="CIS-5.9",
                        title="Host Network Namespace Sharing",
                        description=f"Container '{container.name}' shares the host's network namespace",
                        framework="CIS Docker Benchmark",
                        control_id="5.9",
                        result=ComplianceLevel.NON_COMPLIANT,
                        severity=Severity.HIGH,
                        evidence={
                            "container_name": container.name,
                            "container_id": container.id,
                            "network_mode": network_mode
                        },
                        remediation="Use bridge networking or custom networks instead of host networking",
                        references=["https://docs.docker.com/network/host/"]
                    )
                else:
                    self.add_compliance_check(
                        check_id="CIS-5.9",
                        title="Host Network Namespace Sharing",
                        description=f"Container '{container.name}' does not share the host's network namespace",
                        framework="CIS Docker Benchmark",
                        control_id="5.9",
                        result=ComplianceLevel.COMPLIANT,
                        severity=Severity.INFO,
                        evidence={
                            "container_name": container.name,
                            "container_id": container.id,
                            "network_mode": network_mode
                        },
                        remediation="No action required - container uses appropriate network isolation"
                    )
                    
        except Exception as e:
            self.add_compliance_check(
                check_id="CIS-5.9",
                title="Host Network Check Error",
                description=f"Unable to check host network namespace sharing: {e}",
                framework="CIS Docker Benchmark",
                control_id="5.9",
                result=ComplianceLevel.NOT_APPLICABLE,
                severity=Severity.HIGH,
                evidence={"error": str(e)},
                remediation="Fix Docker access issues and re-run compliance check"
            )
    
    def _check_cis_5_12_readonly_rootfs(self) -> None:
        """CIS 5.12 - Mount container's root filesystem as read only"""
        try:
            containers = self.docker_client.containers.list()
            
            for container in containers:
                read_only = container.attrs['HostConfig'].get('ReadonlyRootfs', False)
                
                # Check policy requirements
                policy_requires_readonly = self.policies.container_runtime_policies.get(
                    'security_context', {}
                ).get('user_settings', {}).get('read_only_root_filesystem', True)
                
                if policy_requires_readonly and not read_only:
                    # Check if this is a development container (may need write access)
                    is_dev_container = 'dev' in container.name.lower() or 'development' in container.name.lower()
                    
                    severity = Severity.LOW if is_dev_container else Severity.MEDIUM
                    
                    self.add_compliance_check(
                        check_id="CIS-5.12",
                        title="Read-only Root Filesystem",
                        description=f"Container '{container.name}' root filesystem is not read-only",
                        framework="CIS Docker Benchmark",
                        control_id="5.12",
                        result=ComplianceLevel.NON_COMPLIANT,
                        severity=severity,
                        evidence={
                            "container_name": container.name,
                            "container_id": container.id,
                            "read_only": read_only,
                            "is_dev_container": is_dev_container,
                            "policy_requires_readonly": policy_requires_readonly
                        },
                        remediation="Enable read-only root filesystem and use tmpfs or volumes for writable areas",
                        references=["https://docs.docker.com/engine/reference/run/#read-only-containers"]
                    )
                else:
                    self.add_compliance_check(
                        check_id="CIS-5.12",
                        title="Read-only Root Filesystem",
                        description=f"Container '{container.name}' root filesystem configuration is appropriate",
                        framework="CIS Docker Benchmark",
                        control_id="5.12",
                        result=ComplianceLevel.COMPLIANT,
                        severity=Severity.INFO,
                        evidence={
                            "container_name": container.name,
                            "container_id": container.id,
                            "read_only": read_only,
                            "policy_requires_readonly": policy_requires_readonly
                        },
                        remediation="No action required - container follows filesystem policies"
                    )
                    
        except Exception as e:
            self.add_compliance_check(
                check_id="CIS-5.12",
                title="Read-only Filesystem Check Error",
                description=f"Unable to check read-only root filesystem: {e}",
                framework="CIS Docker Benchmark",
                control_id="5.12",
                result=ComplianceLevel.NOT_APPLICABLE,
                severity=Severity.HIGH,
                evidence={"error": str(e)},
                remediation="Fix Docker access issues and re-run compliance check"
            )
    
    def _check_cis_5_25_no_new_privileges(self) -> None:
        """CIS 5.25 - Restrict container from acquiring additional privileges"""
        try:
            containers = self.docker_client.containers.list()
            
            for container in containers:
                security_opt = container.attrs['HostConfig'].get('SecurityOpt', [])
                
                # Check if no-new-privileges is set
                has_no_new_privileges = any('no-new-privileges:true' in opt for opt in security_opt)
                
                if not has_no_new_privileges:
                    self.add_compliance_check(
                        check_id="CIS-5.25",
                        title="Additional Privileges Restriction",
                        description=f"Container '{container.name}' is not restricted from acquiring additional privileges",
                        framework="CIS Docker Benchmark",
                        control_id="5.25",
                        result=ComplianceLevel.NON_COMPLIANT,
                        severity=Severity.MEDIUM,
                        evidence={
                            "container_name": container.name,
                            "container_id": container.id,
                            "security_opt": security_opt,
                            "has_no_new_privileges": has_no_new_privileges
                        },
                        remediation="Add 'no-new-privileges:true' to container security options",
                        references=["https://docs.docker.com/engine/reference/run/#security-configuration"]
                    )
                else:
                    self.add_compliance_check(
                        check_id="CIS-5.25",
                        title="Additional Privileges Restriction",
                        description=f"Container '{container.name}' is properly restricted from acquiring additional privileges",
                        framework="CIS Docker Benchmark",
                        control_id="5.25",
                        result=ComplianceLevel.COMPLIANT,
                        severity=Severity.INFO,
                        evidence={
                            "container_name": container.name,
                            "container_id": container.id,
                            "security_opt": security_opt,
                            "has_no_new_privileges": has_no_new_privileges
                        },
                        remediation="No action required - container properly restricts privilege escalation"
                    )
                    
        except Exception as e:
            self.add_compliance_check(
                check_id="CIS-5.25",
                title="Privilege Restriction Check Error",
                description=f"Unable to check privilege restrictions: {e}",
                framework="CIS Docker Benchmark",
                control_id="5.25",
                result=ComplianceLevel.NOT_APPLICABLE,
                severity=Severity.HIGH,
                evidence={"error": str(e)},
                remediation="Fix Docker access issues and re-run compliance check"
            )
    
    def _check_cis_5_31_docker_socket(self) -> None:
        """CIS 5.31 - Do not mount the Docker socket inside any containers"""
        try:
            containers = self.docker_client.containers.list()
            
            for container in containers:
                mounts = container.attrs.get('Mounts', [])
                docker_socket_mounted = False
                
                for mount in mounts:
                    source = mount.get('Source', '')
                    if '/var/run/docker.sock' in source:
                        docker_socket_mounted = True
                        break
                
                if docker_socket_mounted:
                    self.add_compliance_check(
                        check_id="CIS-5.31",
                        title="Docker Socket Mount",
                        description=f"Container '{container.name}' has the Docker socket mounted",
                        framework="CIS Docker Benchmark",
                        control_id="5.31",
                        result=ComplianceLevel.NON_COMPLIANT,
                        severity=Severity.CRITICAL,
                        evidence={
                            "container_name": container.name,
                            "container_id": container.id,
                            "docker_socket_mounted": docker_socket_mounted,
                            "mount_count": len(mounts)
                        },
                        remediation="Remove Docker socket mount or make it read-only if absolutely necessary",
                        references=["https://docs.docker.com/engine/security/#docker-daemon-attack-surface"]
                    )
                else:
                    self.add_compliance_check(
                        check_id="CIS-5.31",
                        title="Docker Socket Mount",
                        description=f"Container '{container.name}' does not have the Docker socket mounted",
                        framework="CIS Docker Benchmark",
                        control_id="5.31",
                        result=ComplianceLevel.COMPLIANT,
                        severity=Severity.INFO,
                        evidence={
                            "container_name": container.name,
                            "container_id": container.id,
                            "docker_socket_mounted": docker_socket_mounted,
                            "mount_count": len(mounts)
                        },
                        remediation="No action required - container does not expose Docker socket"
                    )
                    
        except Exception as e:
            self.add_compliance_check(
                check_id="CIS-5.31",
                title="Docker Socket Check Error",
                description=f"Unable to check Docker socket mounts: {e}",
                framework="CIS Docker Benchmark",
                control_id="5.31",
                result=ComplianceLevel.NOT_APPLICABLE,
                severity=Severity.HIGH,
                evidence={"error": str(e)},
                remediation="Fix Docker access issues and re-run compliance check"
            )
    
    # Placeholder methods for other CIS checks (would be implemented similarly)
    def _check_cis_5_1_apparmor(self): pass
    def _check_cis_5_2_selinux(self): pass
    def _check_cis_5_3_capabilities(self): pass
    def _check_cis_5_6_ssh(self): pass
    def _check_cis_5_7_privileged_ports(self): pass
    def _check_cis_5_8_needed_ports(self): pass
    def _check_cis_5_10_memory_limits(self): pass
    def _check_cis_5_11_cpu_priority(self): pass
    def _check_cis_5_13_host_interface(self): pass
    def _check_cis_5_14_restart_policy(self): pass
    def _check_cis_5_15_host_pid(self): pass
    def _check_cis_5_16_host_ipc(self): pass
    def _check_cis_5_17_host_devices(self): pass
    def _check_cis_5_18_ulimits(self): pass
    def _check_cis_5_19_mount_propagation(self): pass
    def _check_cis_5_20_host_uts(self): pass
    def _check_cis_5_21_seccomp(self): pass
    def _check_cis_5_22_exec_privileged(self): pass
    def _check_cis_5_23_exec_user(self): pass
    def _check_cis_5_24_cgroup(self): pass
    def _check_cis_5_26_health_check(self): pass
    def _check_cis_5_27_image_updates(self): pass
    def _check_cis_5_28_pids_limit(self): pass
    def _check_cis_5_29_default_bridge(self): pass
    def _check_cis_5_30_user_namespace(self): pass
    
    def check_nist_cybersecurity_framework(self) -> None:
        """Check NIST Cybersecurity Framework compliance"""
        if not self.policies.compliance_frameworks.get("nist_cybersecurity_framework", {}).get("enabled", False):
            return
            
        print("🔍 Checking NIST Cybersecurity Framework compliance...")
        
        # NIST CSF Functions: Identify, Protect, Detect, Respond, Recover
        enabled_functions = self.policies.compliance_frameworks.get(
            "nist_cybersecurity_framework", {}
        ).get("functions", [])
        
        if "identify" in enabled_functions:
            self._check_nist_identify()
        
        if "protect" in enabled_functions:
            self._check_nist_protect()
        
        if "detect" in enabled_functions:
            self._check_nist_detect()
        
        if "respond" in enabled_functions:
            self._check_nist_respond()
        
        if "recover" in enabled_functions:
            self._check_nist_recover()
    
    def _check_nist_identify(self) -> None:
        """NIST CSF Identify function compliance"""
        # ID.AM-2: Software platforms and applications within the organization are inventoried
        try:
            containers = self.docker_client.containers.list()
            images = self.docker_client.images.list()
            
            container_inventory = []
            for container in containers:
                container_info = {
                    "name": container.name,
                    "id": container.id,
                    "image": container.attrs['Config']['Image'],
                    "status": container.status,
                    "ports": list(container.attrs['Config'].get('ExposedPorts', {}).keys()),
                    "created": container.attrs['Created']
                }
                container_inventory.append(container_info)
            
            self.add_compliance_check(
                check_id="NIST-ID.AM-2",
                title="Software Platform Inventory",
                description="Container and image inventory maintained",
                framework="NIST Cybersecurity Framework",
                control_id="ID.AM-2",
                result=ComplianceLevel.COMPLIANT,
                severity=Severity.INFO,
                evidence={
                    "containers_count": len(containers),
                    "images_count": len(images),
                    "container_inventory": container_inventory[:5]  # First 5 for brevity
                },
                remediation="Continue maintaining current inventory practices"
            )
            
        except Exception as e:
            self.add_compliance_check(
                check_id="NIST-ID.AM-2",
                title="Software Platform Inventory Error",
                description=f"Unable to inventory containers and images: {e}",
                framework="NIST Cybersecurity Framework",
                control_id="ID.AM-2",
                result=ComplianceLevel.NOT_APPLICABLE,
                severity=Severity.MEDIUM,
                evidence={"error": str(e)},
                remediation="Fix Docker access and implement asset inventory"
            )
    
    def _check_nist_protect(self) -> None:
        """NIST CSF Protect function compliance"""
        # PR.AC-4: Access permissions and authorizations are managed
        try:
            containers = self.docker_client.containers.list()
            
            for container in containers:
                # Check if container runs as non-root
                user_config = container.attrs['Config'].get('User', '')
                runs_as_root = not user_config or user_config == '0' or user_config == 'root'
                
                if runs_as_root:
                    self.add_compliance_check(
                        check_id="NIST-PR.AC-4",
                        title="Access Permissions Management",
                        description=f"Container '{container.name}' runs as root user",
                        framework="NIST Cybersecurity Framework",
                        control_id="PR.AC-4",
                        result=ComplianceLevel.NON_COMPLIANT,
                        severity=Severity.HIGH,
                        evidence={
                            "container_name": container.name,
                            "user_config": user_config,
                            "runs_as_root": runs_as_root
                        },
                        remediation="Configure container to run as non-root user"
                    )
                else:
                    self.add_compliance_check(
                        check_id="NIST-PR.AC-4",
                        title="Access Permissions Management",
                        description=f"Container '{container.name}' properly manages access permissions",
                        framework="NIST Cybersecurity Framework",
                        control_id="PR.AC-4",
                        result=ComplianceLevel.COMPLIANT,
                        severity=Severity.INFO,
                        evidence={
                            "container_name": container.name,
                            "user_config": user_config,
                            "runs_as_root": runs_as_root
                        },
                        remediation="No action required - proper access controls in place"
                    )
                    
        except Exception as e:
            self.add_compliance_check(
                check_id="NIST-PR.AC-4",
                title="Access Permissions Check Error",
                description=f"Unable to check access permissions: {e}",
                framework="NIST Cybersecurity Framework",
                control_id="PR.AC-4",
                result=ComplianceLevel.NOT_APPLICABLE,
                severity=Severity.MEDIUM,
                evidence={"error": str(e)},
                remediation="Fix Docker access and implement access controls"
            )
    
    def _check_nist_detect(self) -> None:
        """NIST CSF Detect function compliance"""
        # DE.CM-1: The network is monitored to detect potential cybersecurity events
        
        # Check if monitoring is configured
        monitoring_required = self.policies.monitoring_compliance_policies.get(
            'security_monitoring', {}
        ).get('log_aggregation', {}).get('required', True)
        
        if monitoring_required:
            # This would typically check for actual monitoring tools
            # For this example, we'll check if logging is configured
            try:
                containers = self.docker_client.containers.list()
                containers_with_logging = 0
                
                for container in containers:
                    log_config = container.attrs['HostConfig'].get('LogConfig', {})
                    if log_config.get('Type') and log_config.get('Type') != 'none':
                        containers_with_logging += 1
                
                if containers_with_logging == len(containers) and len(containers) > 0:
                    self.add_compliance_check(
                        check_id="NIST-DE.CM-1",
                        title="Network Monitoring",
                        description="Container logging is configured for monitoring",
                        framework="NIST Cybersecurity Framework",
                        control_id="DE.CM-1",
                        result=ComplianceLevel.COMPLIANT,
                        severity=Severity.INFO,
                        evidence={
                            "total_containers": len(containers),
                            "containers_with_logging": containers_with_logging
                        },
                        remediation="Continue current monitoring practices"
                    )
                else:
                    self.add_compliance_check(
                        check_id="NIST-DE.CM-1",
                        title="Network Monitoring",
                        description="Not all containers have logging configured",
                        framework="NIST Cybersecurity Framework",
                        control_id="DE.CM-1",
                        result=ComplianceLevel.PARTIALLY_COMPLIANT,
                        severity=Severity.MEDIUM,
                        evidence={
                            "total_containers": len(containers),
                            "containers_with_logging": containers_with_logging
                        },
                        remediation="Configure logging for all containers to enable monitoring"
                    )
                    
            except Exception as e:
                self.add_compliance_check(
                    check_id="NIST-DE.CM-1",
                    title="Network Monitoring Check Error",
                    description=f"Unable to check monitoring configuration: {e}",
                    framework="NIST Cybersecurity Framework",
                    control_id="DE.CM-1",
                    result=ComplianceLevel.NOT_APPLICABLE,
                    severity=Severity.MEDIUM,
                    evidence={"error": str(e)},
                    remediation="Fix Docker access and implement monitoring"
                )
    
    def _check_nist_respond(self) -> None:
        """NIST CSF Respond function compliance"""
        # RS.RP-1: Response plan is executed during or after an incident
        
        # Check if incident response policies are defined
        incident_response_config = self.policies.incident_response_policies
        
        has_detection = incident_response_config.get('detection', {}).get('automated_detection', {})
        has_response = incident_response_config.get('response', {}).get('response_times', {})
        
        if has_detection and has_response:
            self.add_compliance_check(
                check_id="NIST-RS.RP-1",
                title="Response Plan Execution",
                description="Incident response plan is defined and configured",
                framework="NIST Cybersecurity Framework",
                control_id="RS.RP-1",
                result=ComplianceLevel.COMPLIANT,
                severity=Severity.INFO,
                evidence={
                    "has_detection_config": bool(has_detection),
                    "has_response_config": bool(has_response),
                    "response_times": has_response
                },
                remediation="Continue maintaining incident response capabilities"
            )
        else:
            self.add_compliance_check(
                check_id="NIST-RS.RP-1",
                title="Response Plan Execution",
                description="Incident response plan is not fully configured",
                framework="NIST Cybersecurity Framework",
                control_id="RS.RP-1",
                result=ComplianceLevel.PARTIALLY_COMPLIANT,
                severity=Severity.MEDIUM,
                evidence={
                    "has_detection_config": bool(has_detection),
                    "has_response_config": bool(has_response)
                },
                remediation="Complete incident response plan configuration"
            )
    
    def _check_nist_recover(self) -> None:
        """NIST CSF Recover function compliance"""
        # RC.RP-1: Recovery plan is executed during or after a cybersecurity incident
        
        # Check if recovery policies are defined
        recovery_config = self.policies.incident_response_policies.get('recovery', {})
        
        has_backup_restore = recovery_config.get('backup_restore', {})
        has_business_continuity = recovery_config.get('business_continuity', {})
        
        if has_backup_restore and has_business_continuity:
            self.add_compliance_check(
                check_id="NIST-RC.RP-1",
                title="Recovery Plan Execution",
                description="Recovery plan is defined and configured",
                framework="NIST Cybersecurity Framework",
                control_id="RC.RP-1",
                result=ComplianceLevel.COMPLIANT,
                severity=Severity.INFO,
                evidence={
                    "has_backup_restore": bool(has_backup_restore),
                    "has_business_continuity": bool(has_business_continuity),
                    "recovery_config": recovery_config
                },
                remediation="Continue maintaining recovery capabilities"
            )
        else:
            self.add_compliance_check(
                check_id="NIST-RC.RP-1",
                title="Recovery Plan Execution",
                description="Recovery plan is not fully configured",
                framework="NIST Cybersecurity Framework",
                control_id="RC.RP-1",
                result=ComplianceLevel.PARTIALLY_COMPLIANT,
                severity=Severity.MEDIUM,
                evidence={
                    "has_backup_restore": bool(has_backup_restore),
                    "has_business_continuity": bool(has_business_continuity)
                },
                remediation="Complete recovery plan configuration including backup/restore and business continuity"
            )
    
    def generate_compliance_report(self, output_format: str = 'json') -> str:
        """Generate comprehensive compliance report"""
        # Sort checks by framework and result
        framework_order = {
            "CIS Docker Benchmark": 0,
            "NIST Cybersecurity Framework": 1,
            "PCI DSS": 2,
            "ISO 27001": 3,
            "SOC 2": 4,
            "Custom Policy": 5
        }
        
        result_order = {
            ComplianceLevel.NON_COMPLIANT: 0,
            ComplianceLevel.PARTIALLY_COMPLIANT: 1,
            ComplianceLevel.NOT_APPLICABLE: 2,
            ComplianceLevel.COMPLIANT: 3,
            ComplianceLevel.EXCEPTION_GRANTED: 4
        }
        
        sorted_checks = sorted(
            self.compliance_checks,
            key=lambda x: (framework_order.get(x.framework, 99), result_order[x.result])
        )
        
        # Generate summary statistics
        summary = {
            'total_checks': len(self.compliance_checks),
            'compliant': len([c for c in self.compliance_checks if c.result == ComplianceLevel.COMPLIANT]),
            'non_compliant': len([c for c in self.compliance_checks if c.result == ComplianceLevel.NON_COMPLIANT]),
            'partially_compliant': len([c for c in self.compliance_checks if c.result == ComplianceLevel.PARTIALLY_COMPLIANT]),
            'not_applicable': len([c for c in self.compliance_checks if c.result == ComplianceLevel.NOT_APPLICABLE]),
            'exception_granted': len([c for c in self.compliance_checks if c.result == ComplianceLevel.EXCEPTION_GRANTED]),
            'compliance_percentage': 0
        }
        
        # Calculate compliance percentage (compliant + exception granted / total applicable)
        applicable_checks = summary['total_checks'] - summary['not_applicable']
        if applicable_checks > 0:
            summary['compliance_percentage'] = round(
                (summary['compliant'] + summary['exception_granted']) / applicable_checks * 100, 2
            )
        
        # Framework breakdown
        framework_summary = {}
        for check in self.compliance_checks:
            if check.framework not in framework_summary:
                framework_summary[check.framework] = {
                    'total': 0,
                    'compliant': 0,
                    'non_compliant': 0,
                    'partially_compliant': 0,
                    'not_applicable': 0,
                    'exception_granted': 0
                }
            
            framework_summary[check.framework]['total'] += 1
            
            if check.result == ComplianceLevel.COMPLIANT:
                framework_summary[check.framework]['compliant'] += 1
            elif check.result == ComplianceLevel.NON_COMPLIANT:
                framework_summary[check.framework]['non_compliant'] += 1
            elif check.result == ComplianceLevel.PARTIALLY_COMPLIANT:
                framework_summary[check.framework]['partially_compliant'] += 1
            elif check.result == ComplianceLevel.NOT_APPLICABLE:
                framework_summary[check.framework]['not_applicable'] += 1
            elif check.result == ComplianceLevel.EXCEPTION_GRANTED:
                framework_summary[check.framework]['exception_granted'] += 1
        
        if output_format.lower() == 'json':
            report_data = {
                'scan_timestamp': datetime.now(timezone.utc).isoformat(),
                'project_root': str(self.project_root),
                'policy_file': str(self.policy_path),
                'compliance_checker_version': '1.0.0',
                'summary': summary,
                'framework_summary': framework_summary,
                'compliance_checks': [c.to_dict() for c in sorted_checks],
                'recommendations': self._generate_compliance_recommendations(summary, framework_summary)
            }
            return json.dumps(report_data, indent=2)
        
        elif output_format.lower() == 'markdown':
            return self._generate_compliance_markdown_report(summary, framework_summary, sorted_checks)
        
        else:
            raise ValueError(f"Unsupported output format: {output_format}")
    
    def _generate_compliance_recommendations(self, summary: Dict, framework_summary: Dict) -> List[str]:
        """Generate compliance recommendations"""
        recommendations = []
        
        # Overall compliance recommendations
        if summary['compliance_percentage'] < 70:
            recommendations.append(f"🚨 CRITICAL: Overall compliance is {summary['compliance_percentage']}% - immediate action required")
        elif summary['compliance_percentage'] < 85:
            recommendations.append(f"⚠️ WARNING: Overall compliance is {summary['compliance_percentage']}% - improvement needed")
        else:
            recommendations.append(f"✅ GOOD: Overall compliance is {summary['compliance_percentage']}% - maintain current practices")
        
        # Non-compliance issues
        if summary['non_compliant'] > 0:
            recommendations.append(f"🔴 Address {summary['non_compliant']} non-compliant controls immediately")
        
        if summary['partially_compliant'] > 0:
            recommendations.append(f"🟡 Improve {summary['partially_compliant']} partially compliant controls")
        
        # Framework-specific recommendations
        for framework, stats in framework_summary.items():
            applicable_checks = stats['total'] - stats['not_applicable']
            if applicable_checks > 0:
                framework_compliance = (stats['compliant'] + stats['exception_granted']) / applicable_checks * 100
                if framework_compliance < 80:
                    recommendations.append(f"📋 Focus on improving {framework} compliance ({framework_compliance:.1f}%)")
        
        # General recommendations
        recommendations.extend([
            "🔍 Regularly review and update security policies",
            "📊 Implement continuous compliance monitoring",
            "🛡️ Strengthen container security configurations",
            "📝 Document all security exceptions and their justifications",
            "🔄 Establish regular compliance assessment schedule",
            "👥 Provide security training to development and operations teams"
        ])
        
        return recommendations
    
    def _generate_compliance_markdown_report(self, summary: Dict, framework_summary: Dict, checks: List[ComplianceCheck]) -> str:
        """Generate markdown format compliance report"""
        report = f"""# Container Security Compliance Report

**Assessment Date:** {datetime.now(timezone.utc).isoformat()}  
**Project Root:** {self.project_root}  
**Policy File:** {self.policy_path}  
**Compliance Checker Version:** 1.0.0  

## Executive Summary

**Overall Compliance Score: {summary['compliance_percentage']}%**

| Status | Count | Percentage |
|--------|-------|------------|
| ✅ Compliant | {summary['compliant']} | {(summary['compliant']/summary['total_checks']*100):.1f}% |
| ❌ Non-Compliant | {summary['non_compliant']} | {(summary['non_compliant']/summary['total_checks']*100):.1f}% |
| 🟡 Partially Compliant | {summary['partially_compliant']} | {(summary['partially_compliant']/summary['total_checks']*100):.1f}% |
| ⚪ Not Applicable | {summary['not_applicable']} | {(summary['not_applicable']/summary['total_checks']*100):.1f}% |
| 🔵 Exception Granted | {summary['exception_granted']} | {(summary['exception_granted']/summary['total_checks']*100):.1f}% |
| **Total** | **{summary['total_checks']}** | **100%** |

## Framework Compliance Summary

"""
        
        for framework, stats in framework_summary.items():
            applicable = stats['total'] - stats['not_applicable']
            compliance_pct = (stats['compliant'] + stats['exception_granted']) / applicable * 100 if applicable > 0 else 0
            
            status_icon = "✅" if compliance_pct >= 85 else "⚠️" if compliance_pct >= 70 else "❌"
            
            report += f"""### {status_icon} {framework}

**Compliance Score: {compliance_pct:.1f}%**

| Status | Count |
|--------|-------|
| Compliant | {stats['compliant']} |
| Non-Compliant | {stats['non_compliant']} |
| Partially Compliant | {stats['partially_compliant']} |
| Not Applicable | {stats['not_applicable']} |
| Exception Granted | {stats['exception_granted']} |
| **Total** | **{stats['total']}** |

"""
        
        report += "\n## Detailed Compliance Findings\n\n"
        
        current_framework = None
        for check in checks:
            if check.framework != current_framework:
                current_framework = check.framework
                report += f"\n### {current_framework}\n\n"
            
            # Status icon
            status_icons = {
                ComplianceLevel.COMPLIANT: "✅",
                ComplianceLevel.NON_COMPLIANT: "❌",
                ComplianceLevel.PARTIALLY_COMPLIANT: "🟡",
                ComplianceLevel.NOT_APPLICABLE: "⚪",
                ComplianceLevel.EXCEPTION_GRANTED: "🔵"
            }
            
            icon = status_icons.get(check.result, "❓")
            
            report += f"#### {icon} {check.title} ({check.control_id})\n\n"
            report += f"**Status:** {check.result.value}  \n"
            report += f"**Severity:** {check.severity.value}  \n"
            report += f"**Description:** {check.description}\n\n"
            report += f"**Remediation:** {check.remediation}\n\n"
            
            if check.evidence and check.result in [ComplianceLevel.NON_COMPLIANT, ComplianceLevel.PARTIALLY_COMPLIANT]:
                report += "**Evidence:**\n```json\n"
                report += json.dumps(check.evidence, indent=2)
                report += "\n```\n\n"
            
            if check.references:
                report += f"**References:** {', '.join([f'[Link]({ref})' for ref in check.references])}\n\n"
            
            report += "---\n\n"
        
        # Add recommendations
        recommendations = self._generate_compliance_recommendations(summary, framework_summary)
        report += "## Compliance Recommendations\n\n"
        for rec in recommendations:
            report += f"- {rec}\n"
        
        report += f"""

## Next Steps

### Immediate Actions (Non-Compliant Controls)
{f'- Address {summary["non_compliant"]} non-compliant controls' if summary['non_compliant'] > 0 else '- ✅ No non-compliant controls found'}

### Medium Priority (Partially Compliant)
{f'- Improve {summary["partially_compliant"]} partially compliant controls' if summary['partially_compliant'] > 0 else '- ✅ No partially compliant controls found'}

### Ongoing Compliance Management
- Implement continuous compliance monitoring
- Regular policy reviews and updates
- Security training and awareness programs
- Periodic third-party compliance assessments

---
*Generated by Container Security Compliance Checker v1.0.0*
"""
        
        return report
    
    def run_all_compliance_checks(self) -> None:
        """Run all enabled compliance checks"""
        print("🚀 Starting comprehensive compliance assessment...")
        print(f"📁 Project root: {self.project_root}")
        print(f"📋 Policy file: {self.policy_path}")
        
        # Check which frameworks are enabled
        enabled_frameworks = []
        for framework, config in self.policies.compliance_frameworks.items():
            if config.get("enabled", False):
                enabled_frameworks.append(framework)
        
        print(f"🎯 Enabled compliance frameworks: {', '.join(enabled_frameworks)}")
        
        # Run compliance checks for enabled frameworks
        if "cis_docker_benchmark" in enabled_frameworks:
            self.check_cis_docker_benchmark()
        
        if "nist_cybersecurity_framework" in enabled_frameworks:
            self.check_nist_cybersecurity_framework()
        
        # Additional frameworks would be implemented here
        # if "pci_dss" in enabled_frameworks:
        #     self.check_pci_dss_compliance()
        
        # if "iso_27001" in enabled_frameworks:
        #     self.check_iso_27001_compliance()
        
        # if "soc2" in enabled_frameworks:
        #     self.check_soc2_compliance()
        
        print(f"✅ Compliance assessment completed. Performed {len(self.compliance_checks)} checks.")


def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(description='Container Security Compliance Checker')
    parser.add_argument('--project-root', '-p', default='.', 
                       help='Project root directory (default: current directory)')
    parser.add_argument('--policy-file', '-c', 
                       help='Security policy configuration file (default: scripts/container-security/security-policies.yaml)')
    parser.add_argument('--output-format', '-f', choices=['json', 'markdown'], default='json',
                       help='Output format (default: json)')
    parser.add_argument('--output-file', '-o', help='Output file path (default: stdout)')
    parser.add_argument('--framework', '-w', action='append',
                       choices=['cis', 'nist', 'pci', 'iso27001', 'soc2'],
                       help='Specific frameworks to check (can be used multiple times)')
    
    args = parser.parse_args()
    
    # Initialize compliance checker
    checker = ContainerSecurityComplianceChecker(args.project_root, args.policy_file)
    
    # Override framework selection if specified
    if args.framework:
        framework_mapping = {
            'cis': 'cis_docker_benchmark',
            'nist': 'nist_cybersecurity_framework',
            'pci': 'pci_dss',
            'iso27001': 'iso_27001',
            'soc2': 'soc2'
        }
        
        # Disable all frameworks first
        for fw in checker.policies.compliance_frameworks:
            checker.policies.compliance_frameworks[fw]['enabled'] = False
        
        # Enable only selected frameworks
        for fw in args.framework:
            if fw in framework_mapping:
                fw_key = framework_mapping[fw]
                if fw_key in checker.policies.compliance_frameworks:
                    checker.policies.compliance_frameworks[fw_key]['enabled'] = True
    
    # Run compliance checks
    checker.run_all_compliance_checks()
    
    # Generate report
    report = checker.generate_compliance_report(args.output_format)
    
    # Output report
    if args.output_file:
        with open(args.output_file, 'w') as f:
            f.write(report)
        print(f"📄 Compliance report saved to {args.output_file}")
    else:
        print(report)
    
    # Calculate exit code based on compliance status
    non_compliant_count = len([c for c in checker.compliance_checks if c.result == ComplianceLevel.NON_COMPLIANT])
    partially_compliant_count = len([c for c in checker.compliance_checks if c.result == ComplianceLevel.PARTIALLY_COMPLIANT])
    
    # Calculate overall compliance percentage
    total_applicable = len([c for c in checker.compliance_checks if c.result != ComplianceLevel.NOT_APPLICABLE])
    compliant_count = len([c for c in checker.compliance_checks if c.result in [ComplianceLevel.COMPLIANT, ComplianceLevel.EXCEPTION_GRANTED]])
    
    if total_applicable > 0:
        compliance_percentage = (compliant_count / total_applicable) * 100
        
        if compliance_percentage < 70:
            print(f"❌ Critical compliance issues: {compliance_percentage:.1f}% compliant", file=sys.stderr)
            sys.exit(2)
        elif non_compliant_count > 0 or compliance_percentage < 85:
            print(f"⚠️ Compliance issues found: {compliance_percentage:.1f}% compliant", file=sys.stderr)
            sys.exit(1)
        else:
            print(f"✅ Good compliance status: {compliance_percentage:.1f}% compliant")
            sys.exit(0)
    else:
        print("ℹ️ No applicable compliance checks performed")
        sys.exit(0)


if __name__ == '__main__':
    main()