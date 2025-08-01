#!/bin/bash
set -euo pipefail

#
# Container Security Monitor - Development Run Script
# ==================================================
#
# This script provides a development-friendly way to run the Container Security Monitor
# with features like hot-reload, verbose logging, and relaxed validation.
#
# Usage:
#   ./run-dev.sh [options]
#
# Development Features:
#   - Human-readable console logging with colors
#   - Debug-level logging by default
#   - Relaxed configuration validation
#   - Auto-restart on file changes (if entr is available)
#   - Development-friendly error messages
#   - Local Docker socket access validation
#
# Options:
#   --config PATH     Custom configuration file path
#   --no-reload      Disable auto-reload on file changes
#   --log-level LEVEL Override log level (default: DEBUG)
#   --health-check    Run health check in dev mode
#   --version         Show version information
#   --help           Show this help message
#

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_CONFIG="${SCRIPT_DIR}/config/monitor.yaml"
DEFAULT_LOG_LEVEL="DEBUG"
MONITOR_MODULE="container_monitor"
ENABLE_RELOAD=true

# Colors for output (enhanced for development)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Development logging with colors and timestamps
log_dev() {
    local level="$1"
    shift
    local timestamp=$(date '+%H:%M:%S')
    case "$level" in
        INFO)  echo -e "${CYAN}[${timestamp}]${GREEN}[INFO]${NC} $*" >&2 ;;
        WARN)  echo -e "${CYAN}[${timestamp}]${YELLOW}[WARN]${NC} $*" >&2 ;;
        ERROR) echo -e "${CYAN}[${timestamp}]${RED}[ERROR]${NC} $*" >&2 ;;
        DEBUG) echo -e "${CYAN}[${timestamp}]${BLUE}[DEBUG]${NC} $*" >&2 ;;
        DEV)   echo -e "${CYAN}[${timestamp}]${PURPLE}[DEV]${NC} $*" >&2 ;;
    esac
}

# Show development help
show_help() {
    cat << EOF
${WHITE}Container Security Monitor - Development Run Script${NC}

${GREEN}USAGE:${NC}
    $0 [OPTIONS]

${GREEN}DEVELOPMENT FEATURES:${NC}
    • Human-readable console logging with colors
    • Debug-level logging by default
    • Relaxed configuration validation
    • Auto-restart on file changes (if 'entr' is available)
    • Development-friendly error messages
    • Comprehensive environment validation

${GREEN}OPTIONS:${NC}
    --config PATH         Path to configuration file
                         ${BLUE}(default: ${DEFAULT_CONFIG})${NC}
    
    --log-level LEVEL     Set log level ${BLUE}(default: ${DEFAULT_LOG_LEVEL})${NC}
                         Valid: DEBUG, INFO, WARNING, ERROR, CRITICAL
    
    --no-reload          Disable auto-reload on file changes
    --health-check       Run health check in development mode
    --version           Show version information and exit
    --help              Show this help message

${GREEN}DEVELOPMENT ENVIRONMENT VARIABLES:${NC}
    DOCKER_HOST              Docker daemon URL
    PYTHONPATH               Python module search path (auto-set)
    SECURITY_MONITOR_DEV=1   Enables development mode features

${GREEN}EXAMPLES:${NC}
    ${YELLOW}# Start with auto-reload and debug logging${NC}
    $0
    
    ${YELLOW}# Start with custom config, no auto-reload${NC}
    $0 --config /path/to/dev-config.yaml --no-reload
    
    ${YELLOW}# Run health check in dev mode${NC}
    $0 --health-check
    
    ${YELLOW}# Start with info-level logging${NC}
    $0 --log-level INFO

${GREEN}DEVELOPMENT TIPS:${NC}
    • Use ${BLUE}--health-check${NC} to validate your setup before starting
    • The auto-reload feature requires ${BLUE}'entr'${NC} (install with: brew install entr)
    • Configuration validation is relaxed in dev mode
    • All output uses human-readable formatting with colors
    • Press ${BLUE}Ctrl+C${NC} to stop gracefully

EOF
}

# Check development dependencies
check_dev_dependencies() {
    log_dev INFO "Checking development dependencies..."
    
    # Check for entr (file watcher) for auto-reload
    if command -v entr &> /dev/null; then
        log_dev DEBUG "Found 'entr' - auto-reload available"
        return 0
    else
        log_dev WARN "Missing 'entr' - auto-reload disabled"
        log_dev WARN "Install with: brew install entr (macOS) or apt-get install entr (Ubuntu)"
        ENABLE_RELOAD=false
        return 1
    fi
}

# Enhanced environment validation for development
validate_dev_environment() {
    log_dev INFO "Validating development environment..."
    
    # Check Python with version details
    if ! command -v python3 &> /dev/null; then
        log_dev ERROR "Python 3 is required but not installed"
        return 1
    fi
    
    local python_version
    python_version=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')")
    log_dev DEBUG "Python version: ${python_version}"
    
    # Check Python version compatibility
    local major minor
    major=$(echo "$python_version" | cut -d. -f1)
    minor=$(echo "$python_version" | cut -d. -f2)
    
    if [[ "$major" -lt 3 ]] || [[ "$major" -eq 3 && "$minor" -lt 8 ]]; then
        log_dev ERROR "Python 3.8+ required, found ${python_version}"
        return 1
    fi
    
    # Check if we can import the monitor module
    log_dev DEBUG "Testing module import..."
    if ! python3 -c "import ${MONITOR_MODULE}" 2>/dev/null; then
        log_dev ERROR "Cannot import ${MONITOR_MODULE} module"
        log_dev ERROR "Current directory: $(pwd)"
        log_dev ERROR "PYTHONPATH: ${PYTHONPATH:-not set}"
        
        # Helpful debugging info
        log_dev DEV "Expected module location: ${SCRIPT_DIR}/${MONITOR_MODULE}"
        if [[ -d "${SCRIPT_DIR}/${MONITOR_MODULE}" ]]; then
            log_dev DEV "Module directory exists"
            if [[ -f "${SCRIPT_DIR}/${MONITOR_MODULE}/__init__.py" ]]; then
                log_dev DEV "Module __init__.py exists"
            else
                log_dev ERROR "Missing ${MONITOR_MODULE}/__init__.py"
            fi
        else
            log_dev ERROR "Module directory does not exist: ${SCRIPT_DIR}/${MONITOR_MODULE}"
        fi
        
        return 1
    fi
    log_dev DEBUG "Module import successful"
    
    # Detailed Docker connectivity check
    log_dev DEBUG "Checking Docker connectivity..."
    if command -v docker &> /dev/null; then
        local docker_version
        docker_version=$(docker --version 2>/dev/null || echo "unknown")
        log_dev DEBUG "Docker CLI version: ${docker_version}"
        
        if docker info &> /dev/null; then
            local server_version
            server_version=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "unknown")
            log_dev DEBUG "Docker daemon version: ${server_version}"
            log_dev DEBUG "Docker daemon accessible"
        else
            log_dev WARN "Docker daemon not accessible"
            log_dev WARN "DOCKER_HOST: ${DOCKER_HOST:-not set}"
            log_dev DEV "Try: export DOCKER_HOST=unix:///var/run/docker.sock"
        fi
    else
        log_dev WARN "Docker CLI not found in PATH"
    fi
    
    # Check for required Python packages
    log_dev DEBUG "Checking Python dependencies..."
    local missing_packages=()
    
    local required_packages=("docker" "structlog" "pydantic" "aiohttp" "psutil")
    for package in "${required_packages[@]}"; do
        if ! python3 -c "import ${package}" 2>/dev/null; then
            missing_packages+=("$package")
        fi
    done
    
    if [[ ${#missing_packages[@]} -gt 0 ]]; then
        log_dev ERROR "Missing required Python packages: ${missing_packages[*]}"
        log_dev DEV "Install with: pip install ${missing_packages[*]}"
        return 1
    fi
    log_dev DEBUG "All Python dependencies available"
    
    log_dev INFO "Development environment validation passed"
    return 0
}

# Setup development environment
setup_dev_environment() {
    log_dev DEBUG "Setting up development environment..."
    
    # Set PYTHONPATH to current directory
    export PYTHONPATH="${SCRIPT_DIR}:${PYTHONPATH:-}"
    log_dev DEBUG "PYTHONPATH: ${PYTHONPATH}"
    
    # Enable development mode
    export SECURITY_MONITOR_DEV=1
    
    # Ensure unbuffered output for real-time logs
    export PYTHONUNBUFFERED=1
    
    # Set development-friendly defaults
    if [[ -z "${LOG_LEVEL:-}" ]]; then
        export LOG_LEVEL="${DEFAULT_LOG_LEVEL}"
    fi
    
    log_dev DEBUG "Environment setup complete"
}

# Run with auto-reload using entr
run_with_reload() {
    local args=("$@")
    
    log_dev INFO "Starting with auto-reload (press Ctrl+C to stop)"
    log_dev DEV "Watching Python files for changes..."
    
    # Find all Python files in the module
    local watch_files
    if [[ -d "${SCRIPT_DIR}/${MONITOR_MODULE}" ]]; then
        watch_files=$(find "${SCRIPT_DIR}/${MONITOR_MODULE}" -name "*.py" 2>/dev/null || echo "")
    fi
    
    if [[ -n "$watch_files" ]]; then
        echo "$watch_files" | entr -r python3 -m "${MONITOR_MODULE}" "${args[@]}"
    else
        log_dev WARN "No Python files found to watch, running without reload"
        python3 -m "${MONITOR_MODULE}" "${args[@]}"
    fi
}

# Run without auto-reload
run_without_reload() {
    local args=("$@")
    
    log_dev INFO "Starting without auto-reload"
    log_dev DEBUG "Arguments: ${args[*]}"
    
    # Handle interruption gracefully
    trap 'log_dev INFO "Received interrupt, shutting down gracefully..."; exit 130' INT TERM
    
    # Execute the monitor in development mode
    exec python3 -m "${MONITOR_MODULE}" --dev "${args[@]}"
}

# Main development runner
main() {
    local config_file=""
    local log_level="${DEFAULT_LOG_LEVEL}"
    local enable_reload="${ENABLE_RELOAD}"
    local show_version=false
    local run_health_check=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --config)
                config_file="${2:-}"
                if [[ -z "$config_file" ]]; then
                    log_dev ERROR "--config requires a path argument"
                    exit 1
                fi
                shift 2
                ;;
            --log-level)
                log_level="${2:-}"
                if [[ -z "$log_level" ]]; then
                    log_dev ERROR "--log-level requires a level argument"
                    exit 1
                fi
                case "$log_level" in
                    DEBUG|INFO|WARNING|ERROR|CRITICAL) ;;
                    *)
                        log_dev ERROR "Invalid log level: $log_level"
                        log_dev ERROR "Valid levels: DEBUG, INFO, WARNING, ERROR, CRITICAL"
                        exit 1
                        ;;
                esac
                shift 2
                ;;
            --no-reload)
                enable_reload=false
                shift
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
                log_dev ERROR "Unknown argument: $1"
                log_dev ERROR "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Show development banner
    echo -e "${WHITE}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${WHITE}║${PURPLE}     Container Security Monitor - Development Mode${WHITE}           ║${NC}"
    echo -e "${WHITE}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo
    
    # Set log level
    export LOG_LEVEL="$log_level"
    
    # Setup development environment
    setup_dev_environment
    
    # Check development dependencies
    check_dev_dependencies
    
    # Validate environment with detailed feedback
    if ! validate_dev_environment; then
        log_dev ERROR "Environment validation failed"
        exit 1
    fi
    
    # Build run arguments
    local run_args=()
    
    if [[ -n "$config_file" ]]; then
        if [[ -f "$config_file" ]]; then
            run_args+=("--config" "$config_file")
            log_dev INFO "Using config: $config_file"
        else
            log_dev ERROR "Configuration file not found: $config_file"
            exit 1
        fi
    else
        log_dev INFO "Using default configuration"
    fi
    
    run_args+=("--log-level" "$log_level")
    
    if [[ "$show_version" == true ]]; then
        run_args+=("--version")
    fi
    
    if [[ "$run_health_check" == true ]]; then
        run_args+=("--health-check")
    fi
    
    # Choose run mode
    if [[ "$enable_reload" == true ]] && command -v entr &> /dev/null && [[ "$run_health_check" == false ]] && [[ "$show_version" == false ]]; then
        run_with_reload "${run_args[@]}"
    else
        if [[ "$enable_reload" == true ]] && ! command -v entr &> /dev/null; then
            log_dev WARN "Auto-reload requested but 'entr' not available"
        fi
        run_without_reload "${run_args[@]}"
    fi
}

# Run main function with all arguments
main "$@"