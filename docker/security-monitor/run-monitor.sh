#!/bin/bash
set -euo pipefail

#
# Container Security Monitor - Production Run Script
# =================================================
#
# This script provides a production-ready way to start the Container Security Monitor
# with proper error handling, logging, and environment validation.
#
# Usage:
#   ./run-monitor.sh [options]
#
# Options:
#   --config PATH     Custom configuration file path
#   --log-level LEVEL Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
#   --docker-host URL Override Docker daemon URL
#   --health-check    Run health check and exit
#   --version         Show version information
#   --help           Show this help message
#
# Environment Variables:
#   SECURITY_MONITOR_CONFIG  - Path to configuration file
#   DOCKER_HOST             - Docker daemon URL
#   LOG_LEVEL               - Default log level
#   PYTHONPATH              - Python path (automatically set)
#

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_CONFIG="${SCRIPT_DIR}/config/monitor.yaml"
DEFAULT_LOG_LEVEL="INFO"
MONITOR_MODULE="container_monitor"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $*" >&2
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

log_debug() {
    if [[ "${LOG_LEVEL:-}" == "DEBUG" ]]; then
        echo -e "${BLUE}[DEBUG]${NC} $*" >&2
    fi
}

# Show help message
show_help() {
    cat << EOF
Container Security Monitor - Production Run Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --config PATH         Path to configuration file
                         (default: ${DEFAULT_CONFIG})
    
    --log-level LEVEL     Set log level
                         (default: ${DEFAULT_LOG_LEVEL})
                         Valid: DEBUG, INFO, WARNING, ERROR, CRITICAL
    
    --docker-host URL     Override Docker daemon URL
                         (default: uses DOCKER_HOST env var or Docker defaults)
    
    --health-check        Run health check and exit
    --version            Show version information and exit
    --help               Show this help message
    
ENVIRONMENT VARIABLES:
    SECURITY_MONITOR_CONFIG   Configuration file path
    DOCKER_HOST              Docker daemon URL  
    LOG_LEVEL                Default log level
    PYTHONUNBUFFERED=1      Recommended for container environments

EXAMPLES:
    # Start with default configuration
    $0
    
    # Start with custom config and debug logging
    $0 --config /app/config/monitor.yaml --log-level DEBUG
    
    # Run health check
    $0 --health-check
    
    # Check version
    $0 --version

For more information, see the documentation.
EOF
}

# Validate prerequisites
validate_environment() {
    log_info "Validating environment..."
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 is required but not installed"
        return 1
    fi
    
    local python_version
    python_version=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    log_debug "Python version: ${python_version}"
    
    # Check if we can import the monitor module
    if ! python3 -c "import ${MONITOR_MODULE}" 2>/dev/null; then
        log_error "Cannot import ${MONITOR_MODULE} module"
        log_error "Make sure you're running this script from the correct directory"
        log_error "Current directory: $(pwd)"
        return 1
    fi
    
    # Check Docker connectivity (non-fatal)
    if command -v docker &> /dev/null; then
        if docker info &> /dev/null; then
            log_debug "Docker daemon accessible"
        else
            log_warn "Docker daemon not accessible - this may cause issues"
        fi
    else
        log_warn "Docker CLI not found - this may cause issues"
    fi
    
    log_info "Environment validation passed"
    return 0
}

# Set up environment variables
setup_environment() {
    # Set PYTHONPATH to current directory
    export PYTHONPATH="${SCRIPT_DIR}:${PYTHONPATH:-}"
    log_debug "PYTHONPATH set to: ${PYTHONPATH}"
    
    # Ensure unbuffered output for containers
    export PYTHONUNBUFFERED=1
    
    # Set default log level if not specified
    if [[ -z "${LOG_LEVEL:-}" ]]; then
        export LOG_LEVEL="${DEFAULT_LOG_LEVEL}"
    fi
    
    log_debug "Environment setup complete"
}

# Check configuration file
validate_config() {
    local config_file="$1"
    
    if [[ -n "$config_file" ]]; then
        if [[ ! -f "$config_file" ]]; then
            log_error "Configuration file not found: $config_file"
            return 1
        fi
        
        log_info "Using configuration file: $config_file"
        
        # Basic YAML syntax validation
        if command -v python3 &> /dev/null; then
            if ! python3 -c "import yaml; yaml.safe_load(open('$config_file'))" 2>/dev/null; then
                log_error "Configuration file has invalid YAML syntax: $config_file"
                return 1
            fi
            log_debug "Configuration file syntax is valid"
        fi
    else
        log_info "No configuration file specified, using defaults"
    fi
    
    return 0
}

# Run the monitor with proper error handling
run_monitor() {
    local args=()
    
    # Build arguments array
    while [[ $# -gt 0 ]]; do
        case $1 in
            --config)
                if [[ -n "${2:-}" ]]; then
                    args+=("--config" "$2")
                    shift 2
                else
                    log_error "--config requires a path argument"
                    return 1
                fi
                ;;
            --log-level)
                if [[ -n "${2:-}" ]]; then
                    args+=("--log-level" "$2")
                    shift 2
                else
                    log_error "--log-level requires a level argument"
                    return 1
                fi
                ;;
            --docker-host)
                if [[ -n "${2:-}" ]]; then
                    args+=("--docker-host" "$2")
                    shift 2
                else
                    log_error "--docker-host requires a URL argument"
                    return 1
                fi
                ;;
            --health-check)
                args+=("--health-check")
                shift
                ;;
            --version)
                args+=("--version")
                shift
                ;;
            *)
                log_error "Unknown argument: $1"
                return 1
                ;;
        esac
    done
    
    log_info "Starting Container Security Monitor..."
    log_debug "Arguments: ${args[*]}"
    
    # Handle interruption gracefully
    trap 'log_info "Received interrupt signal, shutting down gracefully..."; exit 130' INT TERM
    
    # Execute the monitor
    exec python3 -m "${MONITOR_MODULE}" "${args[@]}"
}

# Main function
main() {
    local config_file=""
    local log_level="${DEFAULT_LOG_LEVEL}"
    local docker_host=""
    local show_version=false
    local run_health_check=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --config)
                config_file="${2:-}"
                if [[ -z "$config_file" ]]; then
                    log_error "--config requires a path argument"
                    exit 1
                fi
                shift 2
                ;;
            --log-level)
                log_level="${2:-}"
                if [[ -z "$log_level" ]]; then
                    log_error "--log-level requires a level argument"  
                    exit 1
                fi
                case "$log_level" in
                    DEBUG|INFO|WARNING|ERROR|CRITICAL) ;;
                    *)
                        log_error "Invalid log level: $log_level"
                        log_error "Valid levels: DEBUG, INFO, WARNING, ERROR, CRITICAL"
                        exit 1
                        ;;
                esac
                shift 2
                ;;
            --docker-host)
                docker_host="${2:-}"
                if [[ -z "$docker_host" ]]; then
                    log_error "--docker-host requires a URL argument"
                    exit 1
                fi
                export DOCKER_HOST="$docker_host"
                shift 2
                ;;
            --health-check)
                run_health_check=true
                shift
                ;;
            --version)
                show_version=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown argument: $1"
                log_error "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Set log level environment variable
    export LOG_LEVEL="$log_level"
    
    # Setup environment
    setup_environment
    
    # Validate environment
    if ! validate_environment; then
        exit 1
    fi
    
    # Validate configuration if provided
    if ! validate_config "$config_file"; then
        exit 1
    fi
    
    # Build run arguments
    local run_args=()
    
    if [[ -n "$config_file" ]]; then
        run_args+=("--config" "$config_file")
    fi
    
    run_args+=("--log-level" "$log_level")
    
    if [[ -n "$docker_host" ]]; then
        run_args+=("--docker-host" "$docker_host")
    fi
    
    if [[ "$show_version" == true ]]; then
        run_args+=("--version")
    fi
    
    if [[ "$run_health_check" == true ]]; then
        run_args+=("--health-check")
    fi
    
    # Run the monitor
    run_monitor "${run_args[@]}"
}

# Run main function with all arguments
main "$@"