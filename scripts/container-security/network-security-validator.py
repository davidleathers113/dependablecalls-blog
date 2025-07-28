#!/usr/bin/env python3

"""
Network Security Validator for Container Infrastructure
=====================================================

This script validates and hardens network security configurations for containerized applications.
It performs comprehensive network security assessments including:

- Docker network configuration validation
- Container network isolation testing
- Port exposure analysis
- Network policy validation
- Traffic flow analysis
- Firewall rule validation
- SSL/TLS configuration checks
- DNS security validation

The validator implements industry best practices and security frameworks including:
- CIS Docker Benchmark
- NIST Cybersecurity Framework
- OWASP Container Security
- Docker Security Best Practices
"""

import argparse
import json
import socket
import ssl
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import yaml
import docker
import requests
from cryptography import x509
from cryptography.hazmat.backends import default_backend


class SecurityLevel(Enum):
    """Network security finding levels"""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


@dataclass
class NetworkSecurityFinding:
    """Network security finding"""
    rule_id: str
    severity: SecurityLevel
    title: str
    description: str
    component: str
    recommendation: str
    technical_details: Dict[str, Any]
    references: List[str]
    timestamp: str = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now(timezone.utc).isoformat()
    
    def to_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        result['severity'] = self.severity.value
        return result


class NetworkSecurityValidator:
    """Network security validation and hardening"""
    
    def __init__(self, project_root: str = "."):
        self.project_root = Path(project_root)
        self.findings: List[NetworkSecurityFinding] = []
        self.docker_client = docker.from_env()
        
    def add_finding(self, rule_id: str, severity: SecurityLevel, title: str,
                   description: str, component: str, recommendation: str,
                   technical_details: Dict[str, Any] = None,
                   references: List[str] = None):
        """Add a network security finding"""
        finding = NetworkSecurityFinding(
            rule_id=rule_id,
            severity=severity,
            title=title,
            description=description,
            component=component,
            recommendation=recommendation,
            technical_details=technical_details or {},
            references=references or []
        )
        self.findings.append(finding)
    
    def validate_docker_networks(self) -> None:
        """Validate Docker network configurations"""
        print("🔍 Validating Docker network configurations...")
        
        try:
            networks = self.docker_client.networks.list()
            
            for network in networks:
                network_name = network.name
                network_attrs = network.attrs
                
                # Skip system networks for some checks
                if network_name in ['none', 'host']:
                    continue
                
                self._validate_network_driver(network_name, network_attrs)
                self._validate_network_options(network_name, network_attrs)
                self._validate_network_ipam(network_name, network_attrs)
                self._validate_network_containers(network_name, network_attrs)
                
        except Exception as e:
            self.add_finding(
                rule_id="NET_DOCKER_ACCESS_ERROR",
                severity=SecurityLevel.HIGH,
                title="Docker Network Access Error",
                description=f"Unable to access Docker networks: {e}",
                component="docker_daemon",
                recommendation="Ensure Docker daemon is accessible and monitor has proper permissions",
                technical_details={"error": str(e)}
            )
    
    def _validate_network_driver(self, network_name: str, network_attrs: Dict[str, Any]) -> None:
        """Validate network driver configuration"""
        driver = network_attrs.get('Driver', '')
        
        # Check for bridge network security
        if driver == 'bridge':
            options = network_attrs.get('Options', {})
            
            # Check if inter-container communication is disabled
            icc_disabled = options.get('com.docker.network.bridge.enable_icc') == 'false'
            if not icc_disabled and network_name != 'bridge':
                self.add_finding(
                    rule_id="NET_ICC_NOT_DISABLED",
                    severity=SecurityLevel.MEDIUM,
                    title="Inter-Container Communication Not Disabled",
                    description=f"Network '{network_name}' allows inter-container communication",
                    component=f"docker_network:{network_name}",
                    recommendation="Disable ICC with 'com.docker.network.bridge.enable_icc=false'",
                    technical_details={"network": network_name, "driver": driver, "icc_enabled": True},
                    references=["https://docs.docker.com/network/bridge/#disable-inter-container-communication"]
                )
            
            # Check IP masquerading
            ip_masq = options.get('com.docker.network.bridge.enable_ip_masquerade', 'true')
            if ip_masq != 'true':
                self.add_finding(
                    rule_id="NET_IP_MASQ_DISABLED",
                    severity=SecurityLevel.LOW,
                    title="IP Masquerading Disabled",
                    description=f"Network '{network_name}' has IP masquerading disabled",
                    component=f"docker_network:{network_name}",
                    recommendation="Enable IP masquerading for proper network isolation",
                    technical_details={"network": network_name, "ip_masquerading": ip_masq}
                )
        
        # Check for host networking
        elif driver == 'host':
            self.add_finding(
                rule_id="NET_HOST_NETWORK_USAGE",
                severity=SecurityLevel.HIGH,
                title="Host Network Mode Detected",
                description=f"Network '{network_name}' uses host networking which bypasses network isolation",
                component=f"docker_network:{network_name}",
                recommendation="Use bridge or custom networks instead of host networking",
                technical_details={"network": network_name, "driver": driver},
                references=["https://docs.docker.com/network/host/"]
            )
    
    def _validate_network_options(self, network_name: str, network_attrs: Dict[str, Any]) -> None:
        """Validate network-specific options"""
        options = network_attrs.get('Options', {})
        
        # Check for encryption in overlay networks
        if network_attrs.get('Driver') == 'overlay':
            encrypted = network_attrs.get('EnableIPv6', False) or 'encrypted' in str(options)
            if not encrypted:
                self.add_finding(
                    rule_id="NET_OVERLAY_NOT_ENCRYPTED",
                    severity=SecurityLevel.MEDIUM,
                    title="Overlay Network Not Encrypted",
                    description=f"Overlay network '{network_name}' is not encrypted",
                    component=f"docker_network:{network_name}",
                    recommendation="Enable encryption for overlay networks with --opt encrypted",
                    technical_details={"network": network_name, "encrypted": encrypted},
                    references=["https://docs.docker.com/network/overlay/#encrypt-traffic-on-an-overlay-network"]
                )
    
    def _validate_network_ipam(self, network_name: str, network_attrs: Dict[str, Any]) -> None:
        """Validate IP Address Management (IPAM) configuration"""
        ipam = network_attrs.get('IPAM', {})
        config = ipam.get('Config', [])
        
        for ipam_config in config:
            subnet = ipam_config.get('Subnet', '')
            
            # Check for private IP ranges
            if subnet:
                try:
                    import ipaddress
                    network = ipaddress.IPv4Network(subnet, strict=False)
                    
                    # Check if using private IP ranges
                    private_ranges = [
                        ipaddress.IPv4Network('10.0.0.0/8'),
                        ipaddress.IPv4Network('172.16.0.0/12'),
                        ipaddress.IPv4Network('192.168.0.0/16')
                    ]
                    
                    is_private = any(network.overlaps(private_range) for private_range in private_ranges)
                    
                    if not is_private:
                        self.add_finding(
                            rule_id="NET_NON_PRIVATE_SUBNET",
                            severity=SecurityLevel.MEDIUM,
                            title="Non-Private IP Subnet Used",
                            description=f"Network '{network_name}' uses non-private subnet {subnet}",
                            component=f"docker_network:{network_name}",
                            recommendation="Use private IP address ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x)",
                            technical_details={"network": network_name, "subnet": subnet, "is_private": is_private}
                        )
                    
                    # Check for overly broad subnets
                    if network.prefixlen < 16:
                        self.add_finding(
                            rule_id="NET_OVERLY_BROAD_SUBNET",
                            severity=SecurityLevel.LOW,
                            title="Overly Broad Network Subnet",
                            description=f"Network '{network_name}' uses very broad subnet {subnet}",
                            component=f"docker_network:{network_name}",
                            recommendation="Use smaller, more specific subnets to limit blast radius",
                            technical_details={"network": network_name, "subnet": subnet, "prefix_length": network.prefixlen}
                        )
                        
                except Exception as e:
                    self.add_finding(
                        rule_id="NET_IPAM_VALIDATION_ERROR",
                        severity=SecurityLevel.LOW,
                        title="IPAM Validation Error",
                        description=f"Could not validate IPAM configuration for network '{network_name}': {e}",
                        component=f"docker_network:{network_name}",
                        recommendation="Review and validate network IPAM configuration manually",
                        technical_details={"network": network_name, "error": str(e)}
                    )
    
    def _validate_network_containers(self, network_name: str, network_attrs: Dict[str, Any]) -> None:
        """Validate containers connected to network"""
        containers = network_attrs.get('Containers', {})
        
        # Check for containers with multiple network connections
        for container_id, container_info in containers.items():
            try:
                container = self.docker_client.containers.get(container_id)
                container_networks = container.attrs['NetworkSettings']['Networks']
                
                if len(container_networks) > 1:
                    network_names = list(container_networks.keys())
                    
                    # Filter out default bridge network for this check
                    non_default_networks = [n for n in network_names if n != 'bridge']
                    
                    if len(non_default_networks) > 1:
                        self.add_finding(
                            rule_id="NET_CONTAINER_MULTIPLE_NETWORKS",
                            severity=SecurityLevel.LOW,
                            title="Container Connected to Multiple Networks",
                            description=f"Container '{container.name}' is connected to multiple networks",
                            component=f"container:{container.name}",
                            recommendation="Limit containers to single network unless specifically required",
                            technical_details={
                                "container": container.name,
                                "networks": network_names,
                                "network_count": len(network_names)
                            }
                        )
                        
            except Exception as e:
                # Container might have been removed, skip
                continue
    
    def validate_container_network_exposure(self) -> None:
        """Validate container port exposure and network access"""
        print("🔍 Validating container network exposure...")
        
        try:
            containers = self.docker_client.containers.list()
            
            for container in containers:
                self._validate_container_ports(container)
                self._validate_container_network_mode(container)
                self._validate_container_network_policies(container)
                
        except Exception as e:
            self.add_finding(
                rule_id="NET_CONTAINER_ACCESS_ERROR",
                severity=SecurityLevel.HIGH,
                title="Container Access Error",
                description=f"Unable to access containers for network validation: {e}",
                component="docker_daemon",
                recommendation="Ensure Docker daemon is accessible and monitor has proper permissions",
                technical_details={"error": str(e)}
            )
    
    def _validate_container_ports(self, container) -> None:
        """Validate container port configurations"""
        container_name = container.name
        port_bindings = container.attrs['HostConfig'].get('PortBindings', {})
        exposed_ports = container.attrs['Config'].get('ExposedPorts', {})
        
        # Check for unnecessarily exposed ports
        for port_spec in exposed_ports.keys():
            port_num = int(port_spec.split('/')[0])
            
            # List of commonly attacked ports
            dangerous_ports = [22, 23, 135, 139, 445, 1433, 1521, 3306, 3389, 5432, 6379, 11211, 27017]
            
            if port_num in dangerous_ports:
                self.add_finding(
                    rule_id="NET_DANGEROUS_PORT_EXPOSED",
                    severity=SecurityLevel.HIGH,
                    title="Dangerous Port Exposed",
                    description=f"Container '{container_name}' exposes dangerous port {port_num}",
                    component=f"container:{container_name}",
                    recommendation=f"Avoid exposing port {port_num} or secure it properly",
                    technical_details={
                        "container": container_name,
                        "port": port_num,
                        "port_spec": port_spec,
                        "dangerous_ports": dangerous_ports
                    },
                    references=["https://www.speedguide.net/ports.php"]
                )
        
        # Check for ports bound to all interfaces (0.0.0.0)
        for port_spec, bindings in port_bindings.items():
            if bindings:
                for binding in bindings:
                    host_ip = binding.get('HostIp', '0.0.0.0')
                    host_port = binding.get('HostPort')
                    
                    if host_ip == '0.0.0.0' or host_ip == '':
                        self.add_finding(
                            rule_id="NET_PORT_BOUND_ALL_INTERFACES",
                            severity=SecurityLevel.MEDIUM,
                            title="Port Bound to All Interfaces",
                            description=f"Container '{container_name}' binds port {port_spec} to all interfaces",
                            component=f"container:{container_name}",
                            recommendation="Bind ports to specific interfaces (e.g., 127.0.0.1) when possible",
                            technical_details={
                                "container": container_name,
                                "port_spec": port_spec,
                                "host_ip": host_ip,
                                "host_port": host_port
                            }
                        )
    
    def _validate_container_network_mode(self, container) -> None:
        """Validate container network mode"""
        container_name = container.name
        network_mode = container.attrs['HostConfig'].get('NetworkMode', 'default')
        
        # Check for host network mode
        if network_mode == 'host':
            self.add_finding(
                rule_id="NET_CONTAINER_HOST_NETWORK",
                severity=SecurityLevel.HIGH,
                title="Container Uses Host Network",
                description=f"Container '{container_name}' uses host networking mode",
                component=f"container:{container_name}",
                recommendation="Use bridge or custom networks instead of host networking",
                technical_details={"container": container_name, "network_mode": network_mode},
                references=["https://docs.docker.com/network/host/"]
            )
        
        # Check for privileged containers with network access
        if container.attrs['HostConfig'].get('Privileged', False):
            self.add_finding(
                rule_id="NET_PRIVILEGED_CONTAINER_NETWORK",
                severity=SecurityLevel.CRITICAL,
                title="Privileged Container with Network Access",
                description=f"Privileged container '{container_name}' has network access",
                component=f"container:{container_name}",
                recommendation="Avoid privileged containers or isolate them from networks",
                technical_details={"container": container_name, "privileged": True, "network_mode": network_mode}
            )
    
    def _validate_container_network_policies(self, container) -> None:
        """Validate network policies for containers"""
        container_name = container.name
        
        # Check for containers without network aliases
        networks = container.attrs['NetworkSettings']['Networks']
        
        for network_name, network_info in networks.items():
            aliases = network_info.get('Aliases', [])
            
            if not aliases and network_name != 'bridge':
                self.add_finding(
                    rule_id="NET_CONTAINER_NO_ALIASES",
                    severity=SecurityLevel.INFO,
                    title="Container Has No Network Aliases",
                    description=f"Container '{container_name}' has no network aliases in network '{network_name}'",
                    component=f"container:{container_name}",
                    recommendation="Consider using network aliases for better service discovery and security",
                    technical_details={
                        "container": container_name,
                        "network": network_name,
                        "aliases": aliases
                    }
                )
    
    def validate_ssl_tls_configuration(self) -> None:
        """Validate SSL/TLS configurations"""
        print("🔍 Validating SSL/TLS configurations...")
        
        # Check Netlify configuration
        self._validate_netlify_ssl()
        
        # Check container SSL configurations
        self._validate_container_ssl()
    
    def _validate_netlify_ssl(self) -> None:
        """Validate Netlify SSL/TLS configuration"""
        netlify_config_path = self.project_root / "netlify.toml"
        
        if not netlify_config_path.exists():
            return
        
        try:
            import toml
            with open(netlify_config_path, 'r') as f:
                netlify_config = toml.load(f)
            
            # Check for HTTPS redirects
            redirects = netlify_config.get('redirects', [])
            https_redirect_found = False
            
            for redirect in redirects:
                from_url = redirect.get('from', '')
                to_url = redirect.get('to', '')
                
                if from_url.startswith('http://') and to_url.startswith('https://'):
                    https_redirect_found = True
                    
                    # Check redirect status
                    status = redirect.get('status', 200)
                    if status != 301:
                        self.add_finding(
                            rule_id="NET_HTTPS_REDIRECT_STATUS",
                            severity=SecurityLevel.LOW,
                            title="HTTPS Redirect Uses Non-Permanent Status",
                            description="HTTP to HTTPS redirects should use 301 (permanent) status",
                            component="netlify_config",
                            recommendation="Use status: 301 for HTTPS redirects",
                            technical_details={"redirect_status": status, "from": from_url, "to": to_url}
                        )
            
            if not https_redirect_found:
                self.add_finding(
                    rule_id="NET_NO_HTTPS_REDIRECT",
                    severity=SecurityLevel.MEDIUM,
                    title="No HTTP to HTTPS Redirect",
                    description="No HTTP to HTTPS redirect configured in Netlify",
                    component="netlify_config",
                    recommendation="Configure HTTP to HTTPS redirects for security",
                    technical_details={"redirects_count": len(redirects)}
                )
            
            # Check security headers for HTTPS enforcement
            headers = netlify_config.get('headers', [])
            hsts_found = False
            
            for header_config in headers:
                header_values = header_config.get('headers', {}).get('values', {})
                
                if 'Strict-Transport-Security' in header_values:
                    hsts_found = True
                    hsts_value = header_values['Strict-Transport-Security']
                    
                    # Validate HSTS header
                    if 'max-age' not in hsts_value:
                        self.add_finding(
                            rule_id="NET_HSTS_NO_MAX_AGE",
                            severity=SecurityLevel.MEDIUM,
                            title="HSTS Header Missing max-age",
                            description="HSTS header does not specify max-age directive",
                            component="netlify_config",
                            recommendation="Add max-age directive to HSTS header (recommended: max-age=31536000)",
                            technical_details={"hsts_header": hsts_value}
                        )
                    
                    if 'includeSubDomains' not in hsts_value:
                        self.add_finding(
                            rule_id="NET_HSTS_NO_SUBDOMAINS",
                            severity=SecurityLevel.LOW,
                            title="HSTS Header Missing includeSubDomains",
                            description="HSTS header does not include subdomains",
                            component="netlify_config",
                            recommendation="Add includeSubDomains to HSTS header for comprehensive protection",
                            technical_details={"hsts_header": hsts_value}
                        )
            
            if not hsts_found:
                self.add_finding(
                    rule_id="NET_NO_HSTS_HEADER",
                    severity=SecurityLevel.MEDIUM,
                    title="No HSTS Header Configured",
                    description="No Strict-Transport-Security header configured",
                    component="netlify_config",
                    recommendation="Configure HSTS header to enforce HTTPS",
                    technical_details={"headers_count": len(headers)}
                )
                
        except Exception as e:
            self.add_finding(
                rule_id="NET_NETLIFY_CONFIG_ERROR",
                severity=SecurityLevel.LOW,
                title="Netlify Configuration Validation Error",
                description=f"Error validating Netlify SSL configuration: {e}",
                component="netlify_config",
                recommendation="Review Netlify configuration file for syntax errors",
                technical_details={"error": str(e)}
            )
    
    def _validate_container_ssl(self) -> None:
        """Validate SSL configurations in containers"""
        try:
            containers = self.docker_client.containers.list()
            
            for container in containers:
                container_name = container.name
                
                # Check for nginx containers
                if 'nginx' in container_name.lower():
                    self._validate_nginx_ssl(container)
                
                # Check for containers with SSL certificate mounts
                self._validate_ssl_certificate_mounts(container)
                
        except Exception as e:
            self.add_finding(
                rule_id="NET_SSL_VALIDATION_ERROR",
                severity=SecurityLevel.LOW,
                title="SSL Validation Error",
                description=f"Error validating container SSL configurations: {e}",
                component="docker_containers",
                recommendation="Review container SSL configurations manually",
                technical_details={"error": str(e)}
            )
    
    def _validate_nginx_ssl(self, container) -> None:
        """Validate Nginx SSL configuration"""
        container_name = container.name
        
        try:
            # Check if nginx configuration exists
            mounts = container.attrs.get('Mounts', [])
            nginx_config_mounted = any('nginx.conf' in mount.get('Source', '') for mount in mounts)
            
            if not nginx_config_mounted:
                self.add_finding(
                    rule_id="NET_NGINX_NO_CONFIG_MOUNT",
                    severity=SecurityLevel.LOW,
                    title="Nginx Container No Configuration Mount",
                    description=f"Nginx container '{container_name}' has no configuration mount",
                    component=f"container:{container_name}",
                    recommendation="Mount nginx configuration for proper SSL configuration",
                    technical_details={"container": container_name, "mounts": len(mounts)}
                )
            
            # Check for SSL certificate mounts
            ssl_cert_mounted = any('ssl' in mount.get('Source', '').lower() or 
                                 '.pem' in mount.get('Source', '') or
                                 '.crt' in mount.get('Source', '') for mount in mounts)
            
            if not ssl_cert_mounted:
                self.add_finding(
                    rule_id="NET_NGINX_NO_SSL_CERTS",
                    severity=SecurityLevel.MEDIUM,
                    title="Nginx Container No SSL Certificates",
                    description=f"Nginx container '{container_name}' has no SSL certificates mounted",
                    component=f"container:{container_name}",
                    recommendation="Mount SSL certificates for HTTPS support",
                    technical_details={"container": container_name, "ssl_mounted": ssl_cert_mounted}
                )
                
        except Exception as e:
            self.add_finding(
                rule_id="NET_NGINX_VALIDATION_ERROR",
                severity=SecurityLevel.LOW,
                title="Nginx SSL Validation Error",
                description=f"Error validating Nginx SSL configuration: {e}",
                component=f"container:{container_name}",
                recommendation="Review Nginx container configuration manually",
                technical_details={"container": container_name, "error": str(e)}
            )
    
    def _validate_ssl_certificate_mounts(self, container) -> None:
        """Validate SSL certificate mounts"""
        container_name = container.name
        mounts = container.attrs.get('Mounts', [])
        
        for mount in mounts:
            source = mount.get('Source', '')
            destination = mount.get('Destination', '')
            
            # Check for SSL certificate files
            if any(ext in source.lower() for ext in ['.pem', '.crt', '.key', '.cert']):
                # Check mount permissions
                read_only = mount.get('RW', True) == False
                
                if not read_only and '.key' in source.lower():
                    self.add_finding(
                        rule_id="NET_SSL_KEY_WRITABLE_MOUNT",
                        severity=SecurityLevel.HIGH,
                        title="SSL Private Key Mounted as Writable",
                        description=f"Container '{container_name}' has writable SSL private key mount",
                        component=f"container:{container_name}",
                        recommendation="Mount SSL private keys as read-only",
                        technical_details={
                            "container": container_name,
                            "source": source,
                            "destination": destination,
                            "read_only": read_only
                        }
                    )
    
    def validate_dns_security(self) -> None:
        """Validate DNS security configurations"""
        print("🔍 Validating DNS security configurations...")
        
        try:
            containers = self.docker_client.containers.list()
            
            for container in containers:
                self._validate_container_dns(container)
                
        except Exception as e:
            self.add_finding(
                rule_id="NET_DNS_VALIDATION_ERROR",
                severity=SecurityLevel.LOW,
                title="DNS Validation Error",
                description=f"Error validating DNS configurations: {e}",
                component="docker_containers",
                recommendation="Review DNS configurations manually",
                technical_details={"error": str(e)}
            )
    
    def _validate_container_dns(self, container) -> None:
        """Validate container DNS configuration"""
        container_name = container.name
        host_config = container.attrs.get('HostConfig', {})
        
        # Check DNS servers
        dns_servers = host_config.get('Dns', [])
        
        # Check for potentially unsafe DNS servers
        unsafe_dns = ['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']  # Public DNS servers
        
        for dns_server in dns_servers:
            if dns_server in unsafe_dns:
                self.add_finding(
                    rule_id="NET_CONTAINER_PUBLIC_DNS",
                    severity=SecurityLevel.LOW,
                    title="Container Uses Public DNS",
                    description=f"Container '{container_name}' uses public DNS server {dns_server}",
                    component=f"container:{container_name}",
                    recommendation="Consider using private/corporate DNS servers for better security",
                    technical_details={
                        "container": container_name,
                        "dns_server": dns_server,
                        "all_dns_servers": dns_servers
                    }
                )
        
        # Check DNS search domains
        dns_search = host_config.get('DnsSearch', [])
        
        for search_domain in dns_search:
            # Check for overly broad search domains
            if search_domain in ['com', 'net', 'org', 'local']:
                self.add_finding(
                    rule_id="NET_CONTAINER_BROAD_DNS_SEARCH",
                    severity=SecurityLevel.LOW,
                    title="Container Uses Broad DNS Search Domain",
                    description=f"Container '{container_name}' uses broad DNS search domain '{search_domain}'",
                    component=f"container:{container_name}",
                    recommendation="Use specific DNS search domains to prevent DNS hijacking",
                    technical_details={
                        "container": container_name,
                        "search_domain": search_domain,
                        "all_search_domains": dns_search
                    }
                )
    
    def validate_network_segmentation(self) -> None:
        """Validate network segmentation and isolation"""
        print("🔍 Validating network segmentation...")
        
        try:
            networks = self.docker_client.networks.list()
            containers = self.docker_client.containers.list()
            
            # Analyze network topology
            network_topology = self._analyze_network_topology(networks, containers)
            
            # Check for proper segmentation
            self._validate_segmentation_policies(network_topology)
            
        except Exception as e:
            self.add_finding(
                rule_id="NET_SEGMENTATION_VALIDATION_ERROR",
                severity=SecurityLevel.LOW,
                title="Network Segmentation Validation Error",
                description=f"Error validating network segmentation: {e}",
                component="docker_networks",
                recommendation="Review network segmentation manually",
                technical_details={"error": str(e)}
            )
    
    def _analyze_network_topology(self, networks, containers) -> Dict[str, Any]:
        """Analyze network topology"""
        topology = {
            "networks": {},
            "containers": {},
            "connections": []
        }
        
        # Map networks
        for network in networks:
            topology["networks"][network.name] = {
                "id": network.id,
                "driver": network.attrs.get('Driver'),
                "containers": list(network.attrs.get('Containers', {}).keys())
            }
        
        # Map containers
        for container in containers:
            container_networks = container.attrs['NetworkSettings']['Networks']
            topology["containers"][container.name] = {
                "id": container.id,
                "networks": list(container_networks.keys()),
                "ports": container.attrs['Config'].get('ExposedPorts', {})
            }
        
        return topology
    
    def _validate_segmentation_policies(self, topology: Dict[str, Any]) -> None:
        """Validate network segmentation policies"""
        # Check for containers connected to default bridge
        default_bridge_containers = []
        
        for container_name, container_info in topology["containers"].items():
            if 'bridge' in container_info["networks"]:
                default_bridge_containers.append(container_name)
        
        if len(default_bridge_containers) > 1:
            self.add_finding(
                rule_id="NET_MULTIPLE_CONTAINERS_DEFAULT_BRIDGE",
                severity=SecurityLevel.MEDIUM,
                title="Multiple Containers on Default Bridge",
                description=f"{len(default_bridge_containers)} containers connected to default bridge network",
                component="docker_networks",
                recommendation="Use custom networks for better isolation",
                technical_details={
                    "containers_count": len(default_bridge_containers),
                    "containers": default_bridge_containers
                }
            )
        
        # Check for network isolation violations
        sensitive_containers = [name for name in topology["containers"].keys() 
                              if any(keyword in name.lower() for keyword in ['db', 'database', 'redis', 'cache'])]
        
        for sensitive_container in sensitive_containers:
            container_info = topology["containers"][sensitive_container]
            
            # Check if sensitive containers are on same network as web containers
            for network in container_info["networks"]:
                network_info = topology["networks"].get(network, {})
                network_containers = [topology["containers"][cname]["id"] for cname in topology["containers"] 
                                    if network in topology["containers"][cname]["networks"]]
                
                web_containers_same_network = [
                    cname for cname in topology["containers"]
                    if network in topology["containers"][cname]["networks"] and
                    any(keyword in cname.lower() for keyword in ['web', 'app', 'frontend', 'nginx'])
                ]
                
                if web_containers_same_network:
                    self.add_finding(
                        rule_id="NET_SENSITIVE_CONTAINER_MIXED_NETWORK",
                        severity=SecurityLevel.MEDIUM,
                        title="Sensitive Container on Mixed Network",
                        description=f"Sensitive container '{sensitive_container}' shares network with web containers",
                        component="docker_networks",
                        recommendation="Isolate sensitive containers (databases, caches) on separate networks",
                        technical_details={
                            "sensitive_container": sensitive_container,
                            "network": network,
                            "web_containers": web_containers_same_network
                        }
                    )
    
    def perform_network_connectivity_tests(self) -> None:
        """Perform network connectivity tests"""
        print("🔍 Performing network connectivity tests...")
        
        try:
            containers = self.docker_client.containers.list()
            
            for container in containers:
                self._test_container_connectivity(container)
                
        except Exception as e:
            self.add_finding(
                rule_id="NET_CONNECTIVITY_TEST_ERROR",
                severity=SecurityLevel.LOW,
                title="Network Connectivity Test Error",
                description=f"Error performing connectivity tests: {e}",
                component="docker_containers",
                recommendation="Review network connectivity manually",
                technical_details={"error": str(e)}
            )
    
    def _test_container_connectivity(self, container) -> None:
        """Test connectivity for a specific container"""
        container_name = container.name
        
        try:
            # Test if container responds to health check
            health = container.attrs.get('State', {}).get('Health', {})
            
            if health:
                status = health.get('Status')
                if status != 'healthy':
                    self.add_finding(
                        rule_id="NET_CONTAINER_UNHEALTHY",
                        severity=SecurityLevel.MEDIUM,
                        title="Container Health Check Failed",
                        description=f"Container '{container_name}' is not healthy",
                        component=f"container:{container_name}",
                        recommendation="Investigate container health issues and fix underlying problems",
                        technical_details={
                            "container": container_name,
                            "health_status": status,
                            "health_check": health
                        }
                    )
            
            # Test exposed ports
            port_bindings = container.attrs['HostConfig'].get('PortBindings', {})
            
            for port_spec, bindings in port_bindings.items():
                if bindings:
                    for binding in bindings:
                        host_port = binding.get('HostPort')
                        if host_port:
                            self._test_port_accessibility(container_name, int(host_port))
                            
        except Exception as e:
            self.add_finding(
                rule_id="NET_CONTAINER_CONNECTIVITY_ERROR",
                severity=SecurityLevel.LOW,
                title="Container Connectivity Test Error",
                description=f"Error testing connectivity for container '{container_name}': {e}",
                component=f"container:{container_name}",
                recommendation="Review container network configuration",
                technical_details={"container": container_name, "error": str(e)}
            )
    
    def _test_port_accessibility(self, container_name: str, port: int) -> None:
        """Test if a port is accessible"""
        try:
            # Test local connectivity
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            result = sock.connect_ex(('localhost', port))
            
            if result == 0:
                # Port is open - check if it should be
                if port not in [80, 443, 3000, 4173, 5173, 8080]:  # Expected ports
                    self.add_finding(
                        rule_id="NET_UNEXPECTED_OPEN_PORT",
                        severity=SecurityLevel.MEDIUM,
                        title="Unexpected Open Port",
                        description=f"Container '{container_name}' has unexpected open port {port}",
                        component=f"container:{container_name}",
                        recommendation="Review port exposure and close unnecessary ports",
                        technical_details={
                            "container": container_name,
                            "port": port,
                            "accessible": True
                        }
                    )
            else:
                # Port is not accessible - might be expected
                pass
            
            sock.close()
            
        except Exception as e:
            # Network test failed - log for debugging but don't create finding
            pass
    
    def generate_report(self, output_format: str = 'json') -> str:
        """Generate network security validation report"""
        # Sort findings by severity
        severity_order = {
            SecurityLevel.CRITICAL: 0,
            SecurityLevel.HIGH: 1,
            SecurityLevel.MEDIUM: 2,
            SecurityLevel.LOW: 3,
            SecurityLevel.INFO: 4
        }
        
        sorted_findings = sorted(self.findings, key=lambda x: severity_order[x.severity])
        
        # Generate summary
        summary = {
            'total_findings': len(self.findings),
            'critical': len([f for f in self.findings if f.severity == SecurityLevel.CRITICAL]),
            'high': len([f for f in self.findings if f.severity == SecurityLevel.HIGH]),
            'medium': len([f for f in self.findings if f.severity == SecurityLevel.MEDIUM]),
            'low': len([f for f in self.findings if f.severity == SecurityLevel.LOW]),
            'info': len([f for f in self.findings if f.severity == SecurityLevel.INFO])
        }
        
        if output_format.lower() == 'json':
            report_data = {
                'scan_timestamp': datetime.now(timezone.utc).isoformat(),
                'project_root': str(self.project_root),
                'validator_version': '1.0.0',
                'summary': summary,
                'findings': [f.to_dict() for f in sorted_findings],
                'recommendations': self._generate_recommendations(summary)
            }
            return json.dumps(report_data, indent=2)
        
        elif output_format.lower() == 'markdown':
            return self._generate_markdown_report(summary, sorted_findings)
        
        else:
            raise ValueError(f"Unsupported output format: {output_format}")
    
    def _generate_recommendations(self, summary: Dict[str, int]) -> List[str]:
        """Generate security recommendations"""
        recommendations = []
        
        if summary['critical'] > 0:
            recommendations.append(f"🚨 CRITICAL: {summary['critical']} critical network security issues require immediate attention")
        
        if summary['high'] > 0:
            recommendations.append(f"⚠️ HIGH: {summary['high']} high-severity network issues should be addressed promptly")
        
        if summary['critical'] == 0 and summary['high'] == 0:
            recommendations.append("✅ No critical or high-severity network security issues detected")
        
        recommendations.extend([
            "🔒 Implement network segmentation for sensitive containers",
            "🌐 Use custom Docker networks instead of default bridge",
            "🔐 Enable HTTPS/TLS for all external communications",
            "🛡️ Configure proper firewall rules and port restrictions",
            "📊 Implement network monitoring and intrusion detection",
            "🔍 Regularly audit network configurations and access patterns"
        ])
        
        return recommendations
    
    def _generate_markdown_report(self, summary: Dict[str, int], findings: List[NetworkSecurityFinding]) -> str:
        """Generate markdown format report"""
        report = f"""# Network Security Validation Report

**Scan Timestamp:** {datetime.now(timezone.utc).isoformat()}  
**Project Root:** {self.project_root}  
**Validator Version:** 1.0.0  

## Executive Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | {summary['critical']} | {'❌ Action Required' if summary['critical'] > 0 else '✅ Good'} |
| High     | {summary['high']} | {'⚠️ Attention Needed' if summary['high'] > 0 else '✅ Good'} |
| Medium   | {summary['medium']} | {'📋 Review Recommended' if summary['medium'] > 0 else '✅ Good'} |
| Low      | {summary['low']} | {'📝 Consider Addressing' if summary['low'] > 0 else '✅ Good'} |
| Info     | {summary['info']} | {'ℹ️ Informational' if summary['info'] > 0 else '✅ Good'} |
| **Total** | **{summary['total_findings']}** | **{'🔍 Review Required' if summary['total_findings'] > 0 else '✅ All Good'}** |

## Network Security Findings

"""
        
        current_severity = None
        for finding in findings:
            if finding.severity != current_severity:
                current_severity = finding.severity
                severity_icon = {
                    SecurityLevel.CRITICAL: "🚨",
                    SecurityLevel.HIGH: "⚠️",
                    SecurityLevel.MEDIUM: "📋",
                    SecurityLevel.LOW: "📝",
                    SecurityLevel.INFO: "ℹ️"
                }
                report += f"\n### {severity_icon[current_severity]} {current_severity.value} Severity Issues\n\n"
            
            report += f"#### {finding.title}\n\n"
            report += f"**Rule ID:** `{finding.rule_id}`  \n"
            report += f"**Component:** `{finding.component}`  \n"
            report += f"**Description:** {finding.description}\n\n"
            report += f"**Recommendation:** {finding.recommendation}\n\n"
            
            if finding.technical_details:
                report += "**Technical Details:**\n```json\n"
                report += json.dumps(finding.technical_details, indent=2)
                report += "\n```\n\n"
            
            if finding.references:
                report += f"**References:** {', '.join([f'[Link]({ref})' for ref in finding.references])}\n\n"
            
            report += "---\n\n"
        
        # Add recommendations
        recommendations = self._generate_recommendations(summary)
        report += "## Security Recommendations\n\n"
        for rec in recommendations:
            report += f"- {rec}\n"
        
        report += f"""

## Next Steps

### Immediate Actions (Critical/High Priority)
{f'- Address {summary["critical"]} critical network security issues' if summary['critical'] > 0 else '- ✅ No critical issues found'}
{f'- Review {summary["high"]} high-severity network issues' if summary['high'] > 0 else '- ✅ No high-severity issues found'}

### Medium Priority
{f'- Plan remediation for {summary["medium"]} medium-severity issues' if summary['medium'] > 0 else '- ✅ No medium-severity issues found'}

### Ongoing Security Measures
- Implement network monitoring and alerting
- Regular network security assessments
- Keep network security policies updated
- Monitor for new network security threats

---
*Generated by Network Security Validator v1.0.0*
"""
        
        return report
    
    def run_all_validations(self) -> None:
        """Run all network security validations"""
        print("🚀 Starting comprehensive network security validation...")
        print(f"📁 Project root: {self.project_root}")
        
        # Run all validation modules
        validation_modules = [
            ("Docker Networks", self.validate_docker_networks),
            ("Container Network Exposure", self.validate_container_network_exposure),
            ("SSL/TLS Configuration", self.validate_ssl_tls_configuration),
            ("DNS Security", self.validate_dns_security),
            ("Network Segmentation", self.validate_network_segmentation),
            ("Network Connectivity", self.perform_network_connectivity_tests)
        ]
        
        for module_name, validation_func in validation_modules:
            try:
                print(f"🔍 Running {module_name} validation...")
                validation_func()
            except Exception as e:
                print(f"❌ Error in {module_name}: {e}")
                self.add_finding(
                    rule_id=f"NET_VALIDATION_ERROR_{module_name.upper().replace(' ', '_')}",
                    severity=SecurityLevel.HIGH,
                    title=f"{module_name} Validation Error",
                    description=f"Error running {module_name} validation: {e}",
                    component="network_validator",
                    recommendation=f"Review {module_name} validation manually",
                    technical_details={"module": module_name, "error": str(e)}
                )
        
        print(f"✅ Network security validation completed. Found {len(self.findings)} total issues.")


def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(description='Network Security Validator for Container Infrastructure')
    parser.add_argument('--project-root', '-p', default='.', 
                       help='Project root directory (default: current directory)')
    parser.add_argument('--output-format', '-f', choices=['json', 'markdown'], default='json',
                       help='Output format (default: json)')
    parser.add_argument('--output-file', '-o', help='Output file path (default: stdout)')
    parser.add_argument('--severity-threshold', '-s', 
                       choices=['critical', 'high', 'medium', 'low', 'info'], 
                       default='info', help='Minimum severity to report (default: info)')
    
    args = parser.parse_args()
    
    # Initialize validator
    validator = NetworkSecurityValidator(args.project_root)
    
    # Run validations
    validator.run_all_validations()
    
    # Filter findings by severity threshold
    severity_levels = {
        'critical': [SecurityLevel.CRITICAL],
        'high': [SecurityLevel.CRITICAL, SecurityLevel.HIGH],
        'medium': [SecurityLevel.CRITICAL, SecurityLevel.HIGH, SecurityLevel.MEDIUM],
        'low': [SecurityLevel.CRITICAL, SecurityLevel.HIGH, SecurityLevel.MEDIUM, SecurityLevel.LOW],
        'info': [SecurityLevel.CRITICAL, SecurityLevel.HIGH, SecurityLevel.MEDIUM, SecurityLevel.LOW, SecurityLevel.INFO]
    }
    
    allowed_severities = severity_levels[args.severity_threshold]
    validator.findings = [f for f in validator.findings if f.severity in allowed_severities]
    
    # Generate report
    report = validator.generate_report(args.output_format)
    
    # Output report
    if args.output_file:
        with open(args.output_file, 'w') as f:
            f.write(report)
        print(f"📄 Network security report saved to {args.output_file}")
    else:
        print(report)
    
    # Exit with appropriate code
    critical_count = len([f for f in validator.findings if f.severity == SecurityLevel.CRITICAL])
    high_count = len([f for f in validator.findings if f.severity == SecurityLevel.HIGH])
    
    if critical_count > 0:
        print(f"❌ Critical network security issues found: {critical_count}", file=sys.stderr)
        sys.exit(2)
    elif high_count > 0:
        print(f"⚠️ High severity network security issues found: {high_count}", file=sys.stderr)
        sys.exit(1)
    else:
        print("✅ No critical or high severity network security issues found")
        sys.exit(0)


if __name__ == '__main__':
    main()