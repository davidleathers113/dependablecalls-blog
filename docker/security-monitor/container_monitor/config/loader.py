"""
Configuration loading bridge between YAML files and Pydantic models.

This module provides the missing bridge to load YAML configuration files
into the MonitorConfig Pydantic model with proper validation, error handling,
and environment variable override support.

Created by Configuration Bridge Specialist.
"""

import os
import sys
from pathlib import Path
from typing import Dict, Any, Optional, Union

import yaml
import structlog
from pydantic import ValidationError

from container_monitor.models.config import MonitorConfig
from container_monitor.config.security import SecurityConfig, SecurityConfigError

logger = structlog.get_logger(__name__)


class ConfigLoadError(Exception):
    """Raised when configuration loading fails."""
    pass


class ConfigLoader:
    """
    Configuration loader that bridges YAML files to Pydantic models.
    
    Features:
    - Loads YAML and JSON configuration files
    - Environment variable override support
    - Security validation via SecurityConfig
    - Clear error messages with actionable feedback
    - Configuration merging and validation
    """
    
    def __init__(self, 
                 config_path: Optional[Union[str, Path]] = None,
                 enable_security_validation: bool = True,
                 auto_fix_permissions: bool = True):
        """
        Initialize configuration loader.
        
        Args:
            config_path: Path to configuration file (defaults to /app/config/monitor.yaml)
            enable_security_validation: Enable security policy validation
            auto_fix_permissions: Automatically fix file permissions if possible
        """
        self.config_path = Path(config_path) if config_path else Path("/app/config/monitor.yaml")
        self.enable_security_validation = enable_security_validation
        self.auto_fix_permissions = auto_fix_permissions
        self.raw_config: Dict[str, Any] = {}
        
    def load_config(self, env_override: bool = True) -> MonitorConfig:
        """
        Load configuration from file with environment variable overrides.
        
        Args:
            env_override: Enable environment variable overrides
            
        Returns:
            Validated MonitorConfig instance
            
        Raises:
            ConfigLoadError: If configuration loading or validation fails
        """
        try:
            # Step 1: Load configuration from file
            self.raw_config = self._load_config_file()
            
            # Step 2: Apply environment variable overrides
            if env_override:
                self.raw_config = self._apply_env_overrides(self.raw_config)
            
            # Step 3: Filter config to only include MonitorConfig fields
            filtered_config = self._filter_config_fields(self.raw_config)
            
            # Step 4: Create and validate MonitorConfig
            config = self._create_monitor_config(filtered_config)
            
            # Step 5: Validate configuration
            self.validate_config(config)
            
            logger.info(
                "Configuration loaded successfully",
                config_path=str(self.config_path),
                env_override=env_override,
                fields_loaded=len(filtered_config)
            )
            
            return config
            
        except Exception as e:
            error_msg = f"Failed to load configuration: {e}"
            logger.error(error_msg, config_path=str(self.config_path), error=str(e))
            raise ConfigLoadError(error_msg) from e
    
    def _load_config_file(self) -> Dict[str, Any]:
        """Load configuration from YAML or JSON file."""
        if not self.config_path.exists():
            logger.warning(
                "Configuration file not found, using defaults",
                config_path=str(self.config_path)
            )
            return {}
        
        # Security validation for sensitive config files
        if self.enable_security_validation and str(self.config_path).endswith(('.yaml', '.yml', '.json')):
            try:
                security_config = SecurityConfig(self.config_path)
                if self.config_path.suffix == '.json':
                    # Use security loader for JSON files (may contain secrets)
                    return security_config.load_config(auto_fix_permissions=self.auto_fix_permissions)
            except SecurityConfigError as e:
                logger.warning(f"Security validation failed: {e}, continuing with standard load")
        
        # Load YAML/JSON file
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                if self.config_path.suffix.lower() in ['.yaml', '.yml']:
                    config_data = yaml.safe_load(f) or {}
                elif self.config_path.suffix.lower() == '.json':
                    import json
                    config_data = json.load(f) or {}
                else:
                    raise ConfigLoadError(f"Unsupported config file format: {self.config_path.suffix}")
            
            if not isinstance(config_data, dict):
                raise ConfigLoadError("Configuration file must contain a dictionary/object")
            
            logger.debug(
                "Configuration file loaded",
                config_path=str(self.config_path),
                keys=list(config_data.keys())
            )
            
            return config_data
            
        except yaml.YAMLError as e:
            raise ConfigLoadError(f"YAML parsing error: {e}")
        except Exception as e:
            raise ConfigLoadError(f"Error reading config file: {e}")
    
    def _apply_env_overrides(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Apply environment variable overrides to configuration."""
        env_overrides = {}
        
        # Define environment variable mappings
        env_mappings = {
            'MONITOR_DOCKER_HOST': 'docker_host',
            'MONITOR_WEBHOOK_URL': 'alert_webhook',
            'MONITOR_LOG_LEVEL': 'log_level',
            'MONITOR_CPU_THRESHOLD': 'cpu_threshold',
            'MONITOR_MEMORY_THRESHOLD': 'memory_threshold',
            'MONITOR_NETWORK_THRESHOLD': 'network_threshold_mbps',
            'MONITOR_FILE_THRESHOLD': 'file_change_threshold',
            'MONITOR_INTERVAL': 'monitor_interval',
            'MONITOR_REPORT_INTERVAL': 'report_interval',
            'MONITOR_RETENTION_DAYS': 'retention_days',
            'MONITOR_NETWORK_MONITORING': 'network_monitoring',
            'MONITOR_FILE_MONITORING': 'file_monitoring',
            'MONITOR_PROCESS_MONITORING': 'process_monitoring',
            'MONITOR_BEHAVIORAL_ANALYSIS': 'behavioral_analysis',
            'MONITOR_ALERT_TIMEOUT': 'alert_timeout',
            'MONITOR_ALERT_SECRET_KEY': 'alert_secret_key',
            'MONITOR_MAX_CONCURRENT': 'max_concurrent_containers',
        }
        
        # Apply overrides
        for env_var, config_key in env_mappings.items():
            env_value = os.environ.get(env_var)
            if env_value is not None:
                # Type conversion based on config key
                try:
                    if config_key in ['cpu_threshold', 'memory_threshold', 'network_threshold_mbps']:
                        env_overrides[config_key] = float(env_value)
                    elif config_key in ['monitor_interval', 'report_interval', 'retention_days', 
                                       'file_change_threshold', 'alert_timeout', 'max_concurrent_containers']:
                        env_overrides[config_key] = int(env_value)
                    elif config_key in ['network_monitoring', 'file_monitoring', 
                                       'process_monitoring', 'behavioral_analysis']:
                        env_overrides[config_key] = env_value.lower() in ('true', '1', 'yes', 'on')
                    else:
                        env_overrides[config_key] = env_value
                        
                    logger.debug(
                        "Applied environment override",
                        env_var=env_var,
                        config_key=config_key,
                        value=env_overrides[config_key]
                    )
                except (ValueError, TypeError) as e:
                    logger.warning(
                        "Invalid environment variable value",
                        env_var=env_var,
                        value=env_value,
                        error=str(e)
                    )
        
        # Handle special case for container patterns
        container_patterns_env = os.environ.get('MONITOR_CONTAINER_PATTERNS')
        if container_patterns_env:
            # Split comma-separated patterns
            patterns = [p.strip() for p in container_patterns_env.split(',') if p.strip()]
            if patterns:
                env_overrides['container_patterns'] = patterns
        
        # Handle special case for allowed ports
        allowed_ports_env = os.environ.get('MONITOR_ALLOWED_PORTS')
        if allowed_ports_env:
            try:
                ports = [int(p.strip()) for p in allowed_ports_env.split(',') if p.strip()]
                if ports:
                    env_overrides['allowed_ports'] = ports
            except ValueError as e:
                logger.warning(f"Invalid MONITOR_ALLOWED_PORTS format: {e}")
        
        # Merge overrides into config
        merged_config = config.copy()
        merged_config.update(env_overrides)
        
        if env_overrides:
            logger.info(
                "Environment overrides applied",
                overrides=list(env_overrides.keys()),
                count=len(env_overrides)
            )
        
        return merged_config
    
    def _filter_config_fields(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Filter configuration to only include fields supported by MonitorConfig."""
        # Get MonitorConfig field names
        monitor_config_fields = set(MonitorConfig.model_fields.keys())
        
        # Filter config to only include supported fields
        filtered_config = {
            key: value for key, value in config.items() 
            if key in monitor_config_fields
        }
        
        # Log any ignored fields
        ignored_fields = set(config.keys()) - monitor_config_fields
        if ignored_fields:
            logger.debug(
                "Configuration fields ignored (not in MonitorConfig)",
                ignored_fields=list(ignored_fields)
            )
        
        return filtered_config
    
    def _create_monitor_config(self, config_data: Dict[str, Any]) -> MonitorConfig:
        """Create MonitorConfig from configuration data."""
        try:
            return MonitorConfig(**config_data)
        except ValidationError as e:
            # Create user-friendly error message
            error_details = []
            for error in e.errors():
                field = '.'.join(str(x) for x in error['loc'])
                message = error['msg']
                error_details.append(f"  - {field}: {message}")
            
            error_msg = f"Configuration validation failed:\n" + '\n'.join(error_details)
            raise ConfigLoadError(error_msg) from e
        except Exception as e:
            raise ConfigLoadError(f"Error creating MonitorConfig: {e}") from e
    
    def validate_config(self, config: MonitorConfig) -> None:
        """
        Validate configuration with additional business logic checks.
        
        Args:
            config: MonitorConfig instance to validate
            
        Raises:
            ConfigLoadError: If validation fails
        """
        validation_errors = []
        
        # Validate intervals
        if config.monitor_interval >= config.report_interval:
            validation_errors.append(
                f"monitor_interval ({config.monitor_interval}s) should be less than "
                f"report_interval ({config.report_interval}s)"
            )
        
        # Validate thresholds
        if config.cpu_threshold > 100.0:
            validation_errors.append(f"cpu_threshold cannot exceed 100%")
        
        if config.memory_threshold > 100.0:
            validation_errors.append(f"memory_threshold cannot exceed 100%")
        
        # Validate webhook security
        if config.alert_webhook:
            webhook_str = str(config.alert_webhook)
            if webhook_str.startswith('http://') and 'localhost' not in webhook_str:
                validation_errors.append(
                    "alert_webhook must use HTTPS for security (except localhost)"
                )
        
        # Validate container patterns
        if not config.container_patterns:
            validation_errors.append("At least one container pattern must be specified")
        
        # Check for required environment in production
        if os.environ.get('ENVIRONMENT') == 'production':
            if not config.alert_webhook:
                validation_errors.append("alert_webhook is required in production")
            
            if not config.alert_secret_key:
                validation_errors.append("alert_secret_key is required in production")
        
        if validation_errors:
            error_msg = "Configuration validation failed:\n" + '\n'.join(f"  - {error}" for error in validation_errors)
            raise ConfigLoadError(error_msg)
        
        logger.info("Configuration validation passed")
    
    def get_config_summary(self, config: MonitorConfig) -> Dict[str, Any]:
        """Get a summary of the loaded configuration."""
        return {
            'config_file': str(self.config_path),
            'monitor_interval': config.monitor_interval,
            'report_interval': config.report_interval,
            'container_patterns': config.container_patterns,
            'features': {
                'network_monitoring': config.network_monitoring,
                'file_monitoring': config.file_monitoring,
                'process_monitoring': config.process_monitoring,
                'behavioral_analysis': config.behavioral_analysis,
            },
            'thresholds': {
                'cpu': config.cpu_threshold,
                'memory': config.memory_threshold,
                'network_mbps': config.network_threshold_mbps,
                'file_changes': config.file_change_threshold,
            },
            'alerting': {
                'webhook_configured': config.alert_webhook is not None,
                'secret_key_configured': config.alert_secret_key is not None,
                'timeout': config.alert_timeout,
            },
            'concurrency_limit': config.get_concurrency_limit(),
        }


def load_config(config_path: Optional[Union[str, Path]] = None, 
                env_override: bool = True,
                enable_security_validation: bool = True) -> MonitorConfig:
    """
    Convenience function to load configuration.
    
    Args:
        config_path: Path to configuration file
        env_override: Enable environment variable overrides
        enable_security_validation: Enable security validation
        
    Returns:
        Validated MonitorConfig instance
        
    Raises:
        ConfigLoadError: If configuration loading fails
    """
    loader = ConfigLoader(
        config_path=config_path,
        enable_security_validation=enable_security_validation
    )
    return loader.load_config(env_override=env_override)


def validate_config(config: MonitorConfig) -> None:
    """
    Validate a MonitorConfig instance.
    
    Args:
        config: Configuration to validate
        
    Raises:
        ConfigLoadError: If validation fails
    """
    loader = ConfigLoader()
    loader.validate_config(config)


def get_default_config() -> MonitorConfig:
    """
    Get default configuration without loading from file.
    
    Returns:
        MonitorConfig with default values
    """
    return MonitorConfig()


def create_config_from_env() -> MonitorConfig:
    """
    Create configuration from environment variables only.
    
    Returns:
        MonitorConfig created from environment variables
    """
    loader = ConfigLoader()
    # Start with empty config and apply environment overrides
    env_config = loader._apply_env_overrides({})
    filtered_config = loader._filter_config_fields(env_config)
    return loader._create_monitor_config(filtered_config)


if __name__ == "__main__":
    """CLI for testing configuration loading."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Container Monitor Configuration Loader')
    parser.add_argument('--config', '-c', type=str, 
                       help='Path to configuration file')
    parser.add_argument('--no-env', action='store_true',
                       help='Disable environment variable overrides')
    parser.add_argument('--no-security', action='store_true',
                       help='Disable security validation')
    parser.add_argument('--validate-only', action='store_true',
                       help='Only validate configuration, do not load')
    parser.add_argument('--summary', action='store_true',
                       help='Show configuration summary')
    
    args = parser.parse_args()
    
    try:
        if args.validate_only:
            # Load and validate only
            config = load_config(
                config_path=args.config,
                env_override=not args.no_env,
                enable_security_validation=not args.no_security
            )
            print("✅ Configuration validation passed")
        else:
            # Load configuration
            config = load_config(
                config_path=args.config,
                env_override=not args.no_env,
                enable_security_validation=not args.no_security
            )
            print("✅ Configuration loaded successfully")
            
            if args.summary:
                loader = ConfigLoader(config_path=args.config)
                summary = loader.get_config_summary(config)
                print("\n📋 Configuration Summary:")
                print(f"  Config file: {summary['config_file']}")
                print(f"  Monitor interval: {summary['monitor_interval']}s")
                print(f"  Report interval: {summary['report_interval']}s")
                print(f"  Container patterns: {summary['container_patterns']}")
                print(f"  Features enabled: {sum(summary['features'].values())}/4")
                print(f"  Webhook configured: {summary['alerting']['webhook_configured']}")
                print(f"  Concurrency limit: {summary['concurrency_limit']}")
                
    except ConfigLoadError as e:
        print(f"❌ Configuration error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        sys.exit(1)