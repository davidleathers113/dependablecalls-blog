#!/usr/bin/env python3

"""
Infrastructure-as-Code Security Scanner
=====================================

This script performs comprehensive security scanning of infrastructure configuration files including:
- Docker Compose files (docker-compose.yml)
- Netlify configuration (netlify.toml)
- Dockerfile security analysis
- Container orchestration security policies
- Network configuration validation
- Secrets management compliance

The scanner implements CIS benchmarks and security best practices for containerized applications.
"""

import json
import yaml
import toml
import argparse
import sys
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum


class Severity(Enum):
    """Security finding severity levels"""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


@dataclass
class SecurityFinding:
    """Represents a security finding from the scan"""
    rule_id: str
    severity: Severity
    title: str
    description: str
    file_path: str
    line_number: Optional[int] = None
    remediation: Optional[str] = None
    references: Optional[List[str]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert finding to dictionary"""
        result = asdict(self)
        result['severity'] = self.severity.value
        return result


class IaCSecurityScanner:
    """Main infrastructure security scanner class"""
    
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.findings: List[SecurityFinding] = []
        self.scan_timestamp = datetime.utcnow().isoformat() + 'Z'
        
    def add_finding(self, rule_id: str, severity: Severity, title: str, 
                   description: str, file_path: str, line_number: Optional[int] = None,
                   remediation: Optional[str] = None, references: Optional[List[str]] = None):
        """Add a security finding to the results"""
        finding = SecurityFinding(
            rule_id=rule_id,
            severity=severity,
            title=title,
            description=description,
            file_path=file_path,
            line_number=line_number,
            remediation=remediation,
            references=references
        )
        self.findings.append(finding)
    
    def scan_docker_compose(self, compose_file: str) -> None:
        """Scan Docker Compose file for security issues"""
        compose_path = self.project_root / compose_file
        if not compose_path.exists():
            return
            
        try:
            with open(compose_path, 'r') as f:
                compose_data = yaml.safe_load(f)
        except Exception as e:
            self.add_finding(
                rule_id="COMPOSE_PARSE_ERROR",
                severity=Severity.HIGH,
                title="Docker Compose Parse Error",
                description=f"Failed to parse {compose_file}: {e}",
                file_path=compose_file,
                remediation="Fix YAML syntax errors in docker-compose.yml"
            )
            return
            
        self._check_compose_security_context(compose_data, compose_file)
        self._check_compose_network_security(compose_data, compose_file)
        self._check_compose_volume_security(compose_data, compose_file)
        self._check_compose_secrets_management(compose_data, compose_file)
        self._check_compose_resource_limits(compose_data, compose_file)
        self._check_compose_health_checks(compose_data, compose_file)
        self._check_compose_container_settings(compose_data, compose_file)
    
    def _check_compose_security_context(self, compose_data: Dict, file_path: str) -> None:
        """Check Docker Compose security context configurations"""
        services = compose_data.get('services', {})
        
        for service_name, service_config in services.items():
            # Check for privileged containers
            if service_config.get('privileged', False):
                self.add_finding(
                    rule_id="COMPOSE_PRIVILEGED_CONTAINER",
                    severity=Severity.CRITICAL,
                    title="Privileged Container Detected",
                    description=f"Service '{service_name}' is configured to run in privileged mode",
                    file_path=file_path,
                    remediation="Remove 'privileged: true' and use specific capabilities instead",
                    references=["https://docs.docker.com/engine/reference/run/#runtime-privilege-and-linux-capabilities"]
                )
            
            # Check for root user
            user = service_config.get('user')
            if not user or user == '0' or user == 'root' or user.startswith('0:'):
                self.add_finding(
                    rule_id="COMPOSE_ROOT_USER",
                    severity=Severity.HIGH,
                    title="Container Running as Root",
                    description=f"Service '{service_name}' is running as root user",
                    file_path=file_path,
                    remediation="Configure 'user' field to run as non-root user (e.g., '1000:1000')",
                    references=["https://docs.docker.com/develop/dev-best-practices/#avoid-running-containers-as-root"]
                )
            
            # Check security options
            security_opt = service_config.get('security_opt', [])
            if 'no-new-privileges:true' not in security_opt:
                self.add_finding(
                    rule_id="COMPOSE_NO_NEW_PRIVILEGES",
                    severity=Severity.MEDIUM,
                    title="Missing 'no-new-privileges' Security Option",
                    description=f"Service '{service_name}' should include 'no-new-privileges:true'",
                    file_path=file_path,
                    remediation="Add 'no-new-privileges:true' to security_opt",
                    references=["https://docs.docker.com/engine/reference/run/#security-configuration"]
                )
            
            # Check capabilities
            cap_drop = service_config.get('cap_drop', [])
            if 'ALL' not in cap_drop:
                self.add_finding(
                    rule_id="COMPOSE_CAPABILITIES_NOT_DROPPED",
                    severity=Severity.MEDIUM,
                    title="Container Capabilities Not Dropped",
                    description=f"Service '{service_name}' should drop all capabilities by default",
                    file_path=file_path,
                    remediation="Add 'cap_drop: [ALL]' and selectively add required capabilities with 'cap_add'",
                    references=["https://docs.docker.com/engine/reference/run/#runtime-privilege-and-linux-capabilities"]
                )
            
            # Check read-only filesystem
            read_only = service_config.get('read_only', False)
            if not read_only and service_name != 'app-dev':  # Development containers may need write access
                self.add_finding(
                    rule_id="COMPOSE_WRITABLE_FILESYSTEM",
                    severity=Severity.MEDIUM,
                    title="Writable Root Filesystem",
                    description=f"Service '{service_name}' should use read-only root filesystem",
                    file_path=file_path,
                    remediation="Set 'read_only: true' and use tmpfs for writable areas",
                    references=["https://docs.docker.com/engine/reference/run/#read-only-containers"]
                )
    
    def _check_compose_network_security(self, compose_data: Dict, file_path: str) -> None:
        """Check Docker Compose network security configurations"""
        networks = compose_data.get('networks', {})
        services = compose_data.get('services', {})
        
        # Check for default network usage
        using_default_network = False
        for service_name, service_config in services.items():
            service_networks = service_config.get('networks', [])
            if not service_networks:
                using_default_network = True
                break
        
        if using_default_network:
            self.add_finding(
                rule_id="COMPOSE_DEFAULT_NETWORK",
                severity=Severity.LOW,
                title="Using Default Docker Network",
                description="Services using default Docker network may have unnecessary network access",
                file_path=file_path,
                remediation="Define custom networks and assign services explicitly",
                references=["https://docs.docker.com/compose/networking/"]
            )
        
        # Check network driver options
        for network_name, network_config in networks.items():
            if isinstance(network_config, dict):
                driver_opts = network_config.get('driver_opts', {})
                
                # Check for bridge network ICC setting
                if network_config.get('driver') == 'bridge':
                    icc_setting = driver_opts.get('com.docker.network.bridge.enable_icc')
                    if icc_setting != 'false':
                        self.add_finding(
                            rule_id="COMPOSE_ICC_NOT_DISABLED",
                            severity=Severity.MEDIUM,
                            title="Inter-Container Communication Not Disabled",
                            description=f"Network '{network_name}' should disable ICC for better isolation",
                            file_path=file_path,
                            remediation="Set 'com.docker.network.bridge.enable_icc: false' in driver_opts",
                            references=["https://docs.docker.com/network/bridge/#disable-inter-container-communication"]
                        )
    
    def _check_compose_volume_security(self, compose_data: Dict, file_path: str) -> None:
        """Check Docker Compose volume security configurations"""
        services = compose_data.get('services', {})
        
        for service_name, service_config in services.items():
            volumes = service_config.get('volumes', [])
            
            for volume in volumes:
                if isinstance(volume, str):
                    # Check for Docker socket mounting
                    if '/var/run/docker.sock' in volume:
                        if ':ro' not in volume:
                            self.add_finding(
                                rule_id="COMPOSE_DOCKER_SOCKET_WRITABLE",
                                severity=Severity.CRITICAL,
                                title="Docker Socket Mounted with Write Access",
                                description=f"Service '{service_name}' has writable access to Docker socket",
                                file_path=file_path,
                                remediation="Mount Docker socket as read-only (:ro) or avoid mounting it",
                                references=["https://docs.docker.com/engine/security/#docker-daemon-attack-surface"]
                            )
                    
                    # Check for host filesystem mounts
                    if volume.startswith('/') and ':' in volume:
                        host_path, container_path = volume.split(':', 1)
                        if host_path.startswith('/'):
                            # Check for sensitive directory mounts
                            sensitive_dirs = ['/etc', '/proc', '/sys', '/boot', '/dev']
                            if any(host_path.startswith(sens_dir) for sens_dir in sensitive_dirs):
                                self.add_finding(
                                    rule_id="COMPOSE_SENSITIVE_HOST_MOUNT",
                                    severity=Severity.HIGH,
                                    title="Sensitive Host Directory Mounted",
                                    description=f"Service '{service_name}' mounts sensitive host directory {host_path}",
                                    file_path=file_path,
                                    remediation="Avoid mounting sensitive host directories or mount as read-only",
                                    references=["https://docs.docker.com/storage/volumes/#use-a-read-only-volume"]
                                )
    
    def _check_compose_secrets_management(self, compose_data: Dict, file_path: str) -> None:
        """Check Docker Compose secrets management"""
        services = compose_data.get('services', {})
        secrets_defined = 'secrets' in compose_data
        
        for service_name, service_config in services.items():
            environment = service_config.get('environment', {})
            
            # Check for hardcoded secrets in environment variables
            if isinstance(environment, dict):
                for env_key, env_value in environment.items():
                    if isinstance(env_value, str):
                        # Check for potential secrets in environment variables
                        secret_patterns = [
                            r'password', r'pass', r'secret', r'key', r'token', r'auth'
                        ]
                        
                        for pattern in secret_patterns:
                            if re.search(pattern, env_key.lower()) and not env_value.startswith('${'):
                                self.add_finding(
                                    rule_id="COMPOSE_HARDCODED_SECRET",
                                    severity=Severity.HIGH,
                                    title="Potential Hardcoded Secret",
                                    description=f"Service '{service_name}' may have hardcoded secret in environment variable '{env_key}'",
                                    file_path=file_path,
                                    remediation="Use Docker secrets, environment variable substitution, or external secret management",
                                    references=["https://docs.docker.com/compose/compose-file/#secrets"]
                                )
                                break
        
        # Check if secrets are properly used
        if not secrets_defined:
            # Check if any service references secrets
            for service_name, service_config in services.items():
                if 'secrets' in service_config:
                    self.add_finding(
                        rule_id="COMPOSE_SECRETS_NOT_DEFINED",
                        severity=Severity.MEDIUM,
                        title="Secrets Referenced but Not Defined",
                        description=f"Service '{service_name}' references secrets but no secrets are defined at top level",
                        file_path=file_path,
                        remediation="Define secrets at the top level of docker-compose.yml",
                        references=["https://docs.docker.com/compose/compose-file/#secrets-top-level-element"]
                    )
    
    def _check_compose_resource_limits(self, compose_data: Dict, file_path: str) -> None:
        """Check Docker Compose resource limit configurations"""
        services = compose_data.get('services', {})
        
        for service_name, service_config in services.items():
            deploy_config = service_config.get('deploy', {})
            resources = deploy_config.get('resources', {})
            limits = resources.get('limits', {})
            
            if not limits:
                self.add_finding(
                    rule_id="COMPOSE_NO_RESOURCE_LIMITS",
                    severity=Severity.MEDIUM,
                    title="No Resource Limits Configured",
                    description=f"Service '{service_name}' has no resource limits configured",
                    file_path=file_path,
                    remediation="Configure CPU and memory limits in deploy.resources.limits",
                    references=["https://docs.docker.com/compose/compose-file/#resources"]
                )
            else:
                # Check for memory limits
                if 'memory' not in limits:
                    self.add_finding(
                        rule_id="COMPOSE_NO_MEMORY_LIMIT",
                        severity=Severity.MEDIUM,
                        title="No Memory Limit Configured",
                        description=f"Service '{service_name}' has no memory limit",
                        file_path=file_path,
                        remediation="Set memory limit in deploy.resources.limits.memory",
                        references=["https://docs.docker.com/config/containers/resource_constraints/"]
                    )
                
                # Check for CPU limits
                if 'cpus' not in limits:
                    self.add_finding(
                        rule_id="COMPOSE_NO_CPU_LIMIT",
                        severity=Severity.LOW,
                        title="No CPU Limit Configured",
                        description=f"Service '{service_name}' has no CPU limit",
                        file_path=file_path,
                        remediation="Set CPU limit in deploy.resources.limits.cpus",
                        references=["https://docs.docker.com/config/containers/resource_constraints/"]
                    )
    
    def _check_compose_health_checks(self, compose_data: Dict, file_path: str) -> None:
        """Check Docker Compose health check configurations"""
        services = compose_data.get('services', {})
        
        for service_name, service_config in services.items():
            if 'healthcheck' not in service_config:
                self.add_finding(
                    rule_id="COMPOSE_NO_HEALTHCHECK",
                    severity=Severity.LOW,
                    title="No Health Check Configured",
                    description=f"Service '{service_name}' has no health check configured",
                    file_path=file_path,
                    remediation="Configure healthcheck to monitor service availability",
                    references=["https://docs.docker.com/compose/compose-file/#healthcheck"]
                )
    
    def _check_compose_container_settings(self, compose_data: Dict, file_path: str) -> None:
        """Check various container-level security settings"""
        services = compose_data.get('services', {})
        
        for service_name, service_config in services.items():
            # Check restart policy
            restart_policy = service_config.get('restart', '')
            if restart_policy == 'always':
                self.add_finding(
                    rule_id="COMPOSE_ALWAYS_RESTART",
                    severity=Severity.LOW,
                    title="Always Restart Policy",
                    description=f"Service '{service_name}' uses 'always' restart policy",
                    file_path=file_path,
                    remediation="Consider using 'unless-stopped' instead of 'always'",
                    references=["https://docs.docker.com/config/containers/start-containers-automatically/"]
                )
            
            # Check logging configuration
            if 'logging' not in service_config:
                self.add_finding(
                    rule_id="COMPOSE_NO_LOGGING_CONFIG",
                    severity=Severity.INFO,
                    title="No Logging Configuration",
                    description=f"Service '{service_name}' has no logging configuration",
                    file_path=file_path,
                    remediation="Configure logging driver and options to prevent disk space issues",
                    references=["https://docs.docker.com/compose/compose-file/#logging"]
                )
    
    def scan_netlify_config(self, netlify_file: str) -> None:
        """Scan Netlify configuration for security issues"""
        netlify_path = self.project_root / netlify_file
        if not netlify_path.exists():
            return
            
        try:
            with open(netlify_path, 'r') as f:
                netlify_data = toml.load(f)
        except Exception as e:
            self.add_finding(
                rule_id="NETLIFY_PARSE_ERROR",
                severity=Severity.HIGH,
                title="Netlify Configuration Parse Error",
                description=f"Failed to parse {netlify_file}: {e}",
                file_path=netlify_file,
                remediation="Fix TOML syntax errors in netlify.toml"
            )
            return
            
        self._check_netlify_security_headers(netlify_data, netlify_file)
        self._check_netlify_redirects(netlify_data, netlify_file)
        self._check_netlify_edge_functions(netlify_data, netlify_file)
        self._check_netlify_build_security(netlify_data, netlify_file)
    
    def _check_netlify_security_headers(self, netlify_data: Dict, file_path: str) -> None:
        """Check Netlify security headers configuration"""
        headers = netlify_data.get('headers', [])
        
        if not headers:
            self.add_finding(
                rule_id="NETLIFY_NO_SECURITY_HEADERS",
                severity=Severity.HIGH,
                title="No Security Headers Configured",
                description="No security headers are configured in Netlify",
                file_path=file_path,
                remediation="Configure security headers in [[headers]] section",
                references=["https://docs.netlify.com/routing/headers/"]
            )
            return
        
        # Required security headers
        required_headers = {
            'X-Frame-Options': 'DENY',
            'X-Content-Type-Options': 'nosniff', 
            'X-XSS-Protection': '1; mode=block',
            'Strict-Transport-Security': 'max-age=31536000',
            'Content-Security-Policy': None,  # Should exist but value varies
            'Referrer-Policy': 'strict-origin-when-cross-origin'
        }
        
        for header_config in headers:
            if 'for' in header_config and header_config['for'] == '/*':
                header_values = header_config.get('headers', {}).get('values', {})
                
                for required_header, expected_value in required_headers.items():
                    if required_header not in header_values:
                        self.add_finding(
                            rule_id="NETLIFY_MISSING_SECURITY_HEADER",
                            severity=Severity.MEDIUM,
                            title=f"Missing Security Header: {required_header}",
                            description=f"Required security header '{required_header}' is not configured",
                            file_path=file_path,
                            remediation=f"Add '{required_header}' header to [[headers]] section",
                            references=["https://docs.netlify.com/routing/headers/"]
                        )
                    elif expected_value and not header_values[required_header].startswith(expected_value.split(';')[0]):
                        self.add_finding(
                            rule_id="NETLIFY_WEAK_SECURITY_HEADER",
                            severity=Severity.LOW,
                            title=f"Weak Security Header: {required_header}",
                            description=f"Security header '{required_header}' may not be configured optimally",
                            file_path=file_path,
                            remediation=f"Review and strengthen '{required_header}' header configuration",
                            references=["https://docs.netlify.com/routing/headers/"]
                        )
                
                # Check CSP configuration
                csp_header = header_values.get('Content-Security-Policy', '')
                if csp_header:
                    self._check_csp_configuration(csp_header, file_path)
                
                break
    
    def _check_csp_configuration(self, csp_value: str, file_path: str) -> None:
        """Check Content Security Policy configuration"""
        # Check for unsafe CSP directives
        unsafe_patterns = [
            ("'unsafe-inline'", "NETLIFY_CSP_UNSAFE_INLINE", "CSP allows unsafe-inline scripts/styles"),
            ("'unsafe-eval'", "NETLIFY_CSP_UNSAFE_EVAL", "CSP allows unsafe-eval for scripts"),
            ("*", "NETLIFY_CSP_WILDCARD", "CSP uses wildcard source which is too permissive")
        ]
        
        for pattern, rule_id, description in unsafe_patterns:
            if pattern in csp_value:
                severity = Severity.HIGH if 'unsafe' in pattern else Severity.MEDIUM
                self.add_finding(
                    rule_id=rule_id,
                    severity=severity,
                    title="Insecure Content Security Policy",
                    description=description,
                    file_path=file_path,
                    remediation="Use nonces, hashes, or 'strict-dynamic' instead of unsafe directives",
                    references=["https://web.dev/strict-csp/"]
                )
        
        # Check for modern CSP features
        if "'strict-dynamic'" not in csp_value:
            self.add_finding(
                rule_id="NETLIFY_CSP_NO_STRICT_DYNAMIC",
                severity=Severity.INFO,
                title="CSP Could Use strict-dynamic",
                description="Content Security Policy could benefit from using 'strict-dynamic'",
                file_path=file_path,
                remediation="Consider implementing 'strict-dynamic' for improved security",
                references=["https://web.dev/strict-csp/"]
            )
    
    def _check_netlify_redirects(self, netlify_data: Dict, file_path: str) -> None:
        """Check Netlify redirects configuration"""
        redirects = netlify_data.get('redirects', [])
        
        https_redirect_found = False
        for redirect in redirects:
            # Check for HTTP to HTTPS redirects
            from_url = redirect.get('from', '')
            to_url = redirect.get('to', '')
            
            if from_url.startswith('http://') and to_url.startswith('https://'):
                https_redirect_found = True
                
                # Check redirect status code
                status = redirect.get('status', 200)
                if status != 301:
                    self.add_finding(
                        rule_id="NETLIFY_HTTPS_REDIRECT_STATUS",
                        severity=Severity.LOW,
                        title="HTTPS Redirect Should Use 301 Status",
                        description="HTTP to HTTPS redirects should use 301 (permanent) status code",
                        file_path=file_path,
                        remediation="Set status: 301 for HTTPS redirects",
                        references=["https://docs.netlify.com/routing/redirects/"]
                    )
        
        if not https_redirect_found:
            self.add_finding(
                rule_id="NETLIFY_NO_HTTPS_REDIRECT",
                severity=Severity.MEDIUM,
                title="No HTTP to HTTPS Redirect",
                description="No HTTP to HTTPS redirect configured",
                file_path=file_path,
                remediation="Configure HTTP to HTTPS redirects for security",
                references=["https://docs.netlify.com/routing/redirects/"]
            )
    
    def _check_netlify_edge_functions(self, netlify_data: Dict, file_path: str) -> None:
        """Check Netlify Edge Functions configuration"""
        edge_functions = netlify_data.get('edge_functions', [])
        
        for edge_function in edge_functions:
            # Check for path patterns that might be too broad
            path = edge_function.get('path', '')
            if path == '/*':
                self.add_finding(
                    rule_id="NETLIFY_EDGE_FUNCTION_BROAD_PATH",
                    severity=Severity.LOW,
                    title="Edge Function with Broad Path Pattern",
                    description="Edge function applies to all paths which may impact performance",
                    file_path=file_path,
                    remediation="Use more specific path patterns for edge functions",
                    references=["https://docs.netlify.com/edge-functions/overview/"]
                )
    
    def _check_netlify_build_security(self, netlify_data: Dict, file_path: str) -> None:
        """Check Netlify build security configuration"""
        build_config = netlify_data.get('build', {})
        
        # Check for command injection risks
        command = build_config.get('command', '')
        if command and ('${' in command or '`' in command or '$(' in command):
            self.add_finding(
                rule_id="NETLIFY_BUILD_COMMAND_INJECTION",
                severity=Severity.MEDIUM,
                title="Potential Command Injection in Build Command",
                description="Build command contains variable substitution that could be exploited",
                file_path=file_path,
                remediation="Sanitize and validate any variables used in build commands",
                references=["https://docs.netlify.com/configure-builds/overview/"]
            )
        
        # Check build environment variables
        environment = build_config.get('environment', {})
        for env_key, env_value in environment.items():
            if isinstance(env_value, str) and any(secret_word in env_key.lower() 
                                                 for secret_word in ['password', 'secret', 'key', 'token']):
                self.add_finding(
                    rule_id="NETLIFY_BUILD_ENV_SECRET",
                    severity=Severity.HIGH,
                    title="Potential Secret in Build Environment",
                    description=f"Build environment variable '{env_key}' may contain sensitive information",
                    file_path=file_path,
                    remediation="Use Netlify environment variables UI for sensitive values",
                    references=["https://docs.netlify.com/configure-builds/environment-variables/"]
                )
    
    def scan_dockerfile(self, dockerfile: str) -> None:
        """Scan Dockerfile for security best practices"""
        dockerfile_path = self.project_root / dockerfile
        if not dockerfile_path.exists():
            return
            
        try:
            with open(dockerfile_path, 'r') as f:
                content = f.read()
        except Exception as e:
            self.add_finding(
                rule_id="DOCKERFILE_READ_ERROR",
                severity=Severity.HIGH,
                title="Dockerfile Read Error",
                description=f"Failed to read {dockerfile}: {e}",
                file_path=dockerfile,
                remediation="Check file permissions and existence"
            )
            return
            
        lines = content.split('\n')
        self._check_dockerfile_base_image(lines, dockerfile)
        self._check_dockerfile_user(lines, dockerfile)
        self._check_dockerfile_secrets(lines, dockerfile)
        self._check_dockerfile_security_features(lines, dockerfile)
    
    def _check_dockerfile_base_image(self, lines: List[str], file_path: str) -> None:
        """Check Dockerfile base image security"""
        from_lines = [line.strip() for line in lines if line.strip().upper().startswith('FROM')]
        
        for line_num, line in enumerate(lines, 1):
            if line.strip().upper().startswith('FROM'):
                # Check for latest tag
                if ':latest' in line or (line.count(':') == 0 and 'AS' not in line.upper()):
                    self.add_finding(
                        rule_id="DOCKERFILE_LATEST_TAG",
                        severity=Severity.MEDIUM,
                        title="Using :latest Tag",
                        description="Dockerfile uses :latest tag which is not deterministic",
                        file_path=file_path,
                        line_number=line_num,
                        remediation="Pin to specific version tags or digests",
                        references=["https://docs.docker.com/develop/dev-best-practices/"]
                    )
                
                # Check for image digest pinning
                if '@sha256:' not in line:
                    self.add_finding(
                        rule_id="DOCKERFILE_NO_DIGEST_PINNING",
                        severity=Severity.LOW,
                        title="Image Not Pinned to Digest",
                        description="Base image is not pinned to a specific digest",
                        file_path=file_path,
                        line_number=line_num,
                        remediation="Pin base image to specific digest (@sha256:...)",
                        references=["https://docs.docker.com/engine/reference/commandline/pull/#pull-an-image-by-digest-immutable-identifier"]
                    )
    
    def _check_dockerfile_user(self, lines: List[str], file_path: str) -> None:
        """Check Dockerfile user configuration"""
        user_found = False
        
        for line_num, line in enumerate(lines, 1):
            if line.strip().upper().startswith('USER'):
                user_found = True
                user_value = line.strip().split(None, 1)[1] if len(line.strip().split()) > 1 else ''
                
                # Check for root user
                if user_value in ['0', 'root']:
                    self.add_finding(
                        rule_id="DOCKERFILE_ROOT_USER",
                        severity=Severity.HIGH,
                        title="Container Running as Root",
                        description="Dockerfile configures container to run as root user",
                        file_path=file_path,
                        line_number=line_num,
                        remediation="Create and use a non-root user",
                        references=["https://docs.docker.com/develop/dev-best-practices/#avoid-running-containers-as-root"]
                    )
        
        if not user_found:
            self.add_finding(
                rule_id="DOCKERFILE_NO_USER",
                severity=Severity.MEDIUM,
                title="No USER Instruction",
                description="Dockerfile does not specify a user, will run as root",
                file_path=file_path,
                remediation="Add USER instruction to run as non-root user",
                references=["https://docs.docker.com/develop/dev-best-practices/#avoid-running-containers-as-root"]
            )
    
    def _check_dockerfile_secrets(self, lines: List[str], file_path: str) -> None:
        """Check for secrets in Dockerfile"""
        secret_patterns = [
            (r'password\s*[=:]\s*\S+', 'DOCKERFILE_HARDCODED_PASSWORD', 'Hardcoded password detected'),
            (r'secret\s*[=:]\s*\S+', 'DOCKERFILE_HARDCODED_SECRET', 'Hardcoded secret detected'),
            (r'key\s*[=:]\s*\S+', 'DOCKERFILE_HARDCODED_KEY', 'Hardcoded key detected'),
            (r'token\s*[=:]\s*\S+', 'DOCKERFILE_HARDCODED_TOKEN', 'Hardcoded token detected'),
        ]
        
        for line_num, line in enumerate(lines, 1):
            line_lower = line.lower()
            for pattern, rule_id, description in secret_patterns:
                if re.search(pattern, line_lower):
                    self.add_finding(
                        rule_id=rule_id,
                        severity=Severity.HIGH,
                        title="Hardcoded Secret in Dockerfile",
                        description=description,
                        file_path=file_path,
                        line_number=line_num,
                        remediation="Use build args, secrets, or environment variables",
                        references=["https://docs.docker.com/engine/reference/builder/#run---mount-type-secret"]
                    )
    
    def _check_dockerfile_security_features(self, lines: List[str], file_path: str) -> None:
        """Check for security features in Dockerfile"""
        healthcheck_found = False
        
        for line_num, line in enumerate(lines, 1):
            line_upper = line.strip().upper()
            
            # Check for HEALTHCHECK
            if line_upper.startswith('HEALTHCHECK'):
                healthcheck_found = True
            
            # Check for ADD vs COPY
            if line_upper.startswith('ADD') and not line_upper.startswith('ADD --'):
                # ADD can be security risk for URLs
                if 'http' in line.lower():
                    self.add_finding(
                        rule_id="DOCKERFILE_ADD_URL",
                        severity=Severity.MEDIUM,
                        title="ADD Instruction with URL",
                        description="ADD instruction downloading from URL can be a security risk",
                        file_path=file_path,
                        line_number=line_num,
                        remediation="Consider using RUN with curl/wget and verify checksums",
                        references=["https://docs.docker.com/develop/dev-best-practices/#add-or-copy"]
                    )
        
        if not healthcheck_found:
            self.add_finding(
                rule_id="DOCKERFILE_NO_HEALTHCHECK",
                severity=Severity.LOW,
                title="No Health Check Configured",
                description="Dockerfile does not include a HEALTHCHECK instruction",
                file_path=file_path,
                remediation="Add HEALTHCHECK instruction to monitor container health",
                references=["https://docs.docker.com/engine/reference/builder/#healthcheck"]
            )
    
    def generate_report(self, output_format: str = 'json') -> str:
        """Generate security scan report"""
        # Sort findings by severity
        severity_order = {
            Severity.CRITICAL: 0,
            Severity.HIGH: 1,
            Severity.MEDIUM: 2,
            Severity.LOW: 3,
            Severity.INFO: 4
        }
        
        sorted_findings = sorted(self.findings, key=lambda x: severity_order[x.severity])
        
        # Generate summary statistics
        summary = {
            'total_findings': len(self.findings),
            'critical': len([f for f in self.findings if f.severity == Severity.CRITICAL]),
            'high': len([f for f in self.findings if f.severity == Severity.HIGH]),
            'medium': len([f for f in self.findings if f.severity == Severity.MEDIUM]),
            'low': len([f for f in self.findings if f.severity == Severity.LOW]),
            'info': len([f for f in self.findings if f.severity == Severity.INFO])
        }
        
        if output_format.lower() == 'json':
            report_data = {
                'scan_timestamp': self.scan_timestamp,
                'project_root': str(self.project_root),
                'summary': summary,
                'findings': [f.to_dict() for f in sorted_findings]
            }
            return json.dumps(report_data, indent=2)
        
        elif output_format.lower() == 'markdown':
            return self._generate_markdown_report(summary, sorted_findings)
        
        else:
            raise ValueError(f"Unsupported output format: {output_format}")
    
    def _generate_markdown_report(self, summary: Dict, findings: List[SecurityFinding]) -> str:
        """Generate markdown format report"""
        report = f"""# Infrastructure-as-Code Security Report

**Scan Timestamp:** {self.scan_timestamp}  
**Project Root:** {self.project_root}  

## Executive Summary

| Severity | Count |
|----------|-------|
| Critical | {summary['critical']} |
| High     | {summary['high']} |
| Medium   | {summary['medium']} |
| Low      | {summary['low']} |
| Info     | {summary['info']} |
| **Total** | **{summary['total_findings']}** |

## Security Findings

"""
        
        current_severity = None
        for finding in findings:
            if finding.severity != current_severity:
                current_severity = finding.severity
                report += f"\n### {current_severity.value} Severity Issues\n\n"
            
            report += f"#### {finding.title}\n\n"
            report += f"**Rule ID:** `{finding.rule_id}`  \n"
            report += f"**File:** `{finding.file_path}`"
            if finding.line_number:
                report += f" (Line {finding.line_number})"
            report += "\n\n"
            report += f"**Description:** {finding.description}\n\n"
            
            if finding.remediation:
                report += f"**Remediation:** {finding.remediation}\n\n"
            
            if finding.references:
                report += f"**References:** {', '.join(finding.references)}\n\n"
            
            report += "---\n\n"
        
        report += f"""
## Summary

This security scan found {summary['total_findings']} total issues across the infrastructure configuration files.

### Priority Actions Required

"""
        
        if summary['critical'] > 0:
            report += f"🔴 **CRITICAL**: {summary['critical']} critical issues require immediate attention\n"
        
        if summary['high'] > 0:
            report += f"🟠 **HIGH**: {summary['high']} high-severity issues should be addressed promptly\n"
        
        if summary['medium'] > 0:
            report += f"🟡 **MEDIUM**: {summary['medium']} medium-severity issues should be planned for remediation\n"
        
        if summary['critical'] == 0 and summary['high'] == 0:
            report += "✅ **GOOD**: No critical or high-severity issues found\n"
        
        report += """
### Next Steps

1. **Review and prioritize** findings based on severity
2. **Implement remediations** starting with critical and high-severity issues
3. **Update security policies** to prevent similar issues
4. **Schedule regular scans** to maintain security posture

---
*Generated by Infrastructure-as-Code Security Scanner*
"""
        
        return report
    
    def scan_all(self) -> None:
        """Run all security scans"""
        print("🔍 Starting Infrastructure-as-Code Security Scan...")
        
        # Scan Docker Compose files
        compose_files = ['docker-compose.yml', 'docker-compose.yaml']
        for compose_file in compose_files:
            if (self.project_root / compose_file).exists():
                print(f"📄 Scanning {compose_file}...")
                self.scan_docker_compose(compose_file)
        
        # Scan Netlify configuration
        netlify_files = ['netlify.toml']
        for netlify_file in netlify_files:
            if (self.project_root / netlify_file).exists():
                print(f"📄 Scanning {netlify_file}...")
                self.scan_netlify_config(netlify_file)
        
        # Scan Dockerfiles
        dockerfile_patterns = ['Dockerfile', 'Dockerfile.*']
        for dockerfile_pattern in dockerfile_patterns:
            if dockerfile_pattern == 'Dockerfile':
                dockerfile_files = [dockerfile_pattern]
            else:
                dockerfile_files = list(self.project_root.glob(dockerfile_pattern))
                dockerfile_files = [f.name for f in dockerfile_files]
            
            for dockerfile in dockerfile_files:
                if (self.project_root / dockerfile).exists():
                    print(f"📄 Scanning {dockerfile}...")
                    self.scan_dockerfile(dockerfile)
        
        print(f"✅ Scan completed. Found {len(self.findings)} total issues.")


def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(description='Infrastructure-as-Code Security Scanner')
    parser.add_argument('--project-root', '-p', default='.', 
                       help='Project root directory (default: current directory)')
    parser.add_argument('--output-format', '-f', choices=['json', 'markdown'], default='json',
                       help='Output format (default: json)')
    parser.add_argument('--output-file', '-o', help='Output file path (default: stdout)')
    parser.add_argument('--severity-threshold', '-s', 
                       choices=['critical', 'high', 'medium', 'low', 'info'], 
                       default='info', help='Minimum severity to report (default: info)')
    
    args = parser.parse_args()
    
    # Initialize scanner
    scanner = IaCSecurityScanner(args.project_root)
    
    # Run scans
    scanner.scan_all()
    
    # Filter findings by severity threshold
    severity_levels = {
        'critical': [Severity.CRITICAL],
        'high': [Severity.CRITICAL, Severity.HIGH],
        'medium': [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM],
        'low': [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW],
        'info': [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW, Severity.INFO]
    }
    
    allowed_severities = severity_levels[args.severity_threshold]
    scanner.findings = [f for f in scanner.findings if f.severity in allowed_severities]
    
    # Generate report
    report = scanner.generate_report(args.output_format)
    
    # Output report
    if args.output_file:
        with open(args.output_file, 'w') as f:
            f.write(report)
        print(f"📄 Report saved to {args.output_file}")
    else:
        print(report)
    
    # Exit with error code if critical or high severity issues found
    critical_count = len([f for f in scanner.findings if f.severity == Severity.CRITICAL])
    high_count = len([f for f in scanner.findings if f.severity == Severity.HIGH])
    
    if critical_count > 0:
        print(f"❌ Critical security issues found: {critical_count}", file=sys.stderr)
        sys.exit(2)
    elif high_count > 0:
        print(f"⚠️ High severity security issues found: {high_count}", file=sys.stderr)
        sys.exit(1)
    else:
        print("✅ No critical or high severity issues found")
        sys.exit(0)


if __name__ == '__main__':
    main()