#!/usr/bin/env python3
"""
Container Security Monitor - Main CLI Entry Point
================================================

This module provides the command-line interface for the Container Security Monitor.
It supports various modes of operation including development mode, health checks,
and configuration file overrides.

Usage:
    python -m container_monitor [options]
    python -m container_monitor --help
    python -m container_monitor --config /path/to/config.yaml --log-level INFO
    python -m container_monitor --dev
    python -m container_monitor --health-check
    python -m container_monitor --version

Examples:
    # Start with default configuration
    python -m container_monitor

    # Start with custom config and debug logging
    python -m container_monitor --config /app/config/monitor.yaml --log-level DEBUG

    # Start in development mode (uses defaults, more verbose logging)
    python -m container_monitor --dev

    # Run health check only
    python -m container_monitor --health-check

    # Show version information
    python -m container_monitor --version
"""

import argparse
import asyncio
import logging
import os
import sys
from pathlib import Path
from typing import Optional

import structlog

from container_monitor.__version__ import __version__
from container_monitor.config import load_config, ConfigLoadError
from container_monitor.core.monitor import ContainerMonitor
from container_monitor.monitoring.health import HealthChecker


def setup_logging(log_level: str = "INFO", development_mode: bool = False) -> None:
    """
    Configure structured logging for the application.
    
    Args:
        log_level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        development_mode: Enable development-friendly logging format
    """
    # Map string levels to logging constants
    level_map = {
        "DEBUG": logging.DEBUG,
        "INFO": logging.INFO,
        "WARNING": logging.WARNING,
        "ERROR": logging.ERROR,
        "CRITICAL": logging.CRITICAL
    }
    
    log_level_int = level_map.get(log_level.upper(), logging.INFO)
    
    # Configure processors based on mode
    if development_mode:
        # Human-readable format for development
        processors = [
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name, 
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="%Y-%m-%d %H:%M:%S"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.dev.ConsoleRenderer(colors=True)
        ]
    else:
        # JSON format for production
        processors = [
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer()
        ]
    
    # Configure structlog
    structlog.configure(
        processors=processors,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
    
    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level_int,
    )


def create_argument_parser() -> argparse.ArgumentParser:
    """Create and configure the command-line argument parser."""
    parser = argparse.ArgumentParser(
        prog="container_monitor",
        description="Container Runtime Security Monitor - Production-grade security monitoring for containerized applications",
        epilog="""
Examples:
  %(prog)s                                    # Start with default configuration
  %(prog)s --config /app/config/monitor.yaml # Use custom configuration file
  %(prog)s --dev                             # Development mode with console logging
  %(prog)s --health-check                    # Run health check and exit
  %(prog)s --version                         # Show version information

For more information, see the documentation at https://docs.example.com/container-monitor
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    # Configuration options
    parser.add_argument(
        "--config", "-c",
        type=str,
        help="Path to configuration file (default: /app/config/monitor.yaml)"
    )
    
    # Logging options
    parser.add_argument(
        "--log-level", "-l",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        default="INFO",
        help="Set the logging level (default: INFO)"
    )
    
    # Mode options
    parser.add_argument(
        "--dev", "--development",
        action="store_true",
        help="Enable development mode (human-readable logs, relaxed validation)"
    )
    
    # Utility commands
    parser.add_argument(
        "--health-check",
        action="store_true",
        help="Run health check and exit"
    )
    
    parser.add_argument(
        "--version", "-v",
        action="store_true",
        help="Show version information and exit"
    )
    
    # Docker integration options
    parser.add_argument(
        "--docker-host",
        type=str,
        help="Docker daemon host (overrides DOCKER_HOST environment variable)"
    )
    
    return parser


async def run_health_check() -> int:
    """
    Run comprehensive health checks and return exit code.
    
    Returns:
        0 if all checks pass, 1 if any check fails
    """
    logger = structlog.get_logger(__name__)
    
    try:
        health_checker = HealthChecker()
        health_result = await health_checker.run_comprehensive_health_check()
        
        # Print results to stdout
        print(f"\nContainer Security Monitor Health Check")
        print("=" * 50)
        
        overall_status = health_result.get("overall_status", "unknown")
        print(f"Overall Status: {overall_status.upper()}")
        
        checks = health_result.get("checks", {})
        for check_name, status in checks.items():
            status_symbol = "✅" if status == "pass" else "❌"
            print(f"{status_symbol} {check_name}: {status.upper()}")
        
        # Print summary
        passed_checks = sum(1 for status in checks.values() if status == "pass")
        total_checks = len(checks)
        print(f"\nSummary: {passed_checks}/{total_checks} checks passed")
        
        if overall_status == "healthy":
            logger.info("All health checks passed successfully")
            return 0
        else:
            logger.warning("Some health checks failed")
            return 1
            
    except Exception as error:
        logger.error("Health check failed with exception", error=str(error))
        print(f"❌ Health check failed: {error}")
        return 1


def show_version_info() -> None:
    """Display version and system information."""
    print(f"Container Security Monitor v{__version__}")
    print(f"Python {sys.version}")
    print(f"Platform: {sys.platform}")
    
    # Show Docker connectivity
    try:
        import docker
        client = docker.from_env()
        docker_version = client.version()
        print(f"Docker API Version: {docker_version.get('ApiVersion', 'unknown')}")
        print(f"Docker Version: {docker_version.get('Version', 'unknown')}")
    except Exception as error:
        print(f"Docker: Not available ({error})")
    
    # Show configuration file locations
    config_paths = [
        "/app/config/monitor.yaml",
        "./config/monitor.yaml",
        os.path.expanduser("~/.config/container-monitor/monitor.yaml")
    ]
    
    print("\nConfiguration file locations (in search order):")
    for config_path in config_paths:
        path = Path(config_path)
        status = "✅ exists" if path.exists() else "❌ not found"
        print(f"  {config_path} - {status}")


async def main_async(args: argparse.Namespace) -> int:
    """
    Main async function that runs the container monitor.
    
    Args:
        args: Parsed command-line arguments
        
    Returns:
        Exit code (0 for success, non-zero for failure)
    """
    logger = structlog.get_logger(__name__)
    
    try:
        # Load configuration
        config_path = args.config or "/app/config/monitor.yaml"
        enable_env_override = True
        enable_security_validation = not args.dev  # Relaxed validation in dev mode
        
        logger.info(
            "Loading configuration",
            config_path=config_path,
            development_mode=args.dev,
            env_override=enable_env_override
        )
        
        config = load_config(
            config_path=config_path,
            env_override=enable_env_override,
            enable_security_validation=enable_security_validation
        )
        
        # Override Docker host if specified
        if args.docker_host:
            os.environ["DOCKER_HOST"] = args.docker_host
            logger.info("Docker host overridden", docker_host=args.docker_host)
        
        # Create and initialize monitor
        logger.info("Initializing Container Security Monitor", version=__version__)
        monitor = ContainerMonitor(config)
        
        # Start monitoring
        logger.info("Starting security monitoring")
        await monitor.start()
        
        return 0
        
    except ConfigLoadError as error:
        logger.error("Configuration error", error=str(error))
        print(f"Configuration Error: {error}", file=sys.stderr)
        
        if args.dev:
            print("\nDevelopment mode tip: Use --config to specify a valid configuration file", file=sys.stderr)
        
        return 2
        
    except KeyboardInterrupt:
        logger.info("Received shutdown signal, stopping monitor")
        return 0
        
    except Exception as error:
        logger.error("Unexpected error", error=str(error), exc_info=True)
        print(f"Fatal Error: {error}", file=sys.stderr)
        return 1


def main() -> None:
    """
    Main entry point for the Container Security Monitor CLI.
    
    This function handles command-line argument parsing, logging setup,
    and delegates to appropriate handlers based on the requested operation.
    """
    # Parse command-line arguments
    parser = create_argument_parser()
    args = parser.parse_args()
    
    # Handle version request
    if args.version:
        show_version_info()
        sys.exit(0)
    
    # Setup logging
    setup_logging(args.log_level, args.dev)
    logger = structlog.get_logger(__name__)
    
    # Log startup information
    logger.info(
        "Container Security Monitor starting",
        version=__version__,
        development_mode=args.dev,
        log_level=args.log_level,
        config_path=args.config
    )
    
    # Handle health check request
    if args.health_check:
        try:
            exit_code = asyncio.run(run_health_check())
            sys.exit(exit_code)
        except KeyboardInterrupt:
            logger.info("Health check interrupted")
            sys.exit(130)  # 128 + SIGINT
        except Exception as error:
            logger.error("Health check failed", error=str(error))
            sys.exit(1)
    
    # Run main monitor
    try:
        exit_code = asyncio.run(main_async(args))
        sys.exit(exit_code)
    except KeyboardInterrupt:
        logger.info("Monitor interrupted by user")
        sys.exit(130)  # 128 + SIGINT
    except Exception as error:
        logger.error("Monitor failed", error=str(error), exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()