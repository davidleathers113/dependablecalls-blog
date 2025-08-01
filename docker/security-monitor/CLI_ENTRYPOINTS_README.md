# Container Security Monitor - CLI Entry Points & Deployment Guide

## Overview

The Container Security Monitor now features a production-ready modular architecture with comprehensive CLI interfaces and deployment scripts. This guide covers all entry points and deployment options.

## Entry Points Summary

### 1. Python Module Entry Point
```bash
# Primary entry point - production ready
python -m container_monitor [options]

# Examples
python -m container_monitor                                    # Start with defaults
python -m container_monitor --config /app/config/monitor.yaml # Custom config  
python -m container_monitor --dev                             # Development mode
python -m container_monitor --health-check                    # Health check only
python -m container_monitor --version                         # Version info
```

### 2. Production Script
```bash
# Production-ready script with comprehensive error handling
./run-monitor.sh [options]

# Examples
./run-monitor.sh                                              # Start with defaults
./run-monitor.sh --config /app/config/monitor.yaml           # Custom config
./run-monitor.sh --log-level DEBUG                           # Debug logging
./run-monitor.sh --health-check                              # Health check
```

### 3. Development Script  
```bash
# Development-friendly script with auto-reload and enhanced logging
./run-dev.sh [options]

# Examples
./run-dev.sh                                                  # Start with auto-reload
./run-dev.sh --no-reload                                     # Disable auto-reload
./run-dev.sh --config dev-config.yaml                        # Custom dev config
./run-dev.sh --health-check                                  # Dev health check
```

### 4. Docker Container
```bash
# Docker deployment
docker build -t container-security-monitor .
docker run -d --name security-monitor \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v $(pwd)/config:/app/config:ro \
  container-security-monitor

# Docker health check  
docker exec security-monitor python -m container_monitor --health-check
```

## CLI Arguments Reference

### Common Arguments

| Argument | Description | Default | Example |
|----------|-------------|---------|---------|
| `--config`, `-c` | Configuration file path | `/app/config/monitor.yaml` | `--config /path/to/config.yaml` |
| `--log-level`, `-l` | Logging level | `INFO` | `--log-level DEBUG` |
| `--version`, `-v` | Show version information | - | `--version` |
| `--help` | Show help message | - | `--help` |

### Operational Arguments

| Argument | Description | Usage |
|----------|-------------|--------|
| `--dev`, `--development` | Enable development mode | Development only |
| `--health-check` | Run health check and exit | Monitoring/debugging |
| `--docker-host` | Override Docker daemon URL | Custom Docker setups |

### Development-Only Arguments (run-dev.sh)

| Argument | Description | Usage |
|----------|-------------|--------|
| `--no-reload` | Disable auto-reload on file changes | Development |

## Configuration

### Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `SECURITY_MONITOR_CONFIG` | Configuration file path | `/app/config/monitor.yaml` | `/custom/path/config.yaml` |
| `DOCKER_HOST` | Docker daemon URL | System default | `unix:///var/run/docker.sock` |
| `LOG_LEVEL` | Default log level | `INFO` | `DEBUG` |
| `PYTHONUNBUFFERED` | Unbuffered output | `1` | `1` |

### Configuration File Locations (Search Order)

1. Command-line specified path (`--config`)
2. Environment variable (`SECURITY_MONITOR_CONFIG`)  
3. `/app/config/monitor.yaml` (container default)
4. `./config/monitor.yaml` (local development)
5. `~/.config/container-monitor/monitor.yaml` (user config)

## Deployment Scenarios

### Production Deployment

```bash
# Option 1: Direct Python module
python -m container_monitor --config /app/config/monitor.yaml --log-level INFO

# Option 2: Production script (recommended)
./run-monitor.sh --config /app/config/monitor.yaml --log-level INFO

# Option 3: Docker container (most common)
docker run -d \
  --name container-security-monitor \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v /path/to/config:/app/config:ro \
  -v /path/to/reports:/app/reports \
  container-security-monitor:2.0.0
```

### Development Environment  

```bash
# Auto-reload development mode
./run-dev.sh

# Development mode without auto-reload
./run-dev.sh --no-reload

# Development mode with custom config
./run-dev.sh --config dev-config.yaml --log-level DEBUG
```

### Health Monitoring

```bash
# Standalone health check
python -m container_monitor --health-check

# Via production script
./run-monitor.sh --health-check

# Via development script  
./run-dev.sh --health-check

# Docker health check
docker exec security-monitor python -m container_monitor --health-check
```

## Features by Entry Point

### Python Module (`python -m container_monitor`)
- ✅ Full CLI argument support
- ✅ Structured logging (JSON for production, console for dev)
- ✅ Configuration file loading with validation
- ✅ Health check integration
- ✅ Signal handling for graceful shutdown
- ✅ Environment variable support

### Production Script (`./run-monitor.sh`)
- ✅ Environment validation
- ✅ Docker connectivity checks
- ✅ Configuration validation
- ✅ Error handling and logging
- ✅ Signal handling
- ✅ YAML syntax validation
- ✅ Comprehensive help system

### Development Script (`./run-dev.sh`)
- ✅ Auto-reload on file changes (requires `entr`)
- ✅ Human-readable colored logging
- ✅ Enhanced error messages
- ✅ Development environment validation
- ✅ Dependency checking
- ✅ Relaxed configuration validation

### Docker Container
- ✅ Non-root execution
- ✅ Health check endpoint
- ✅ Volume mounts for config and reports
- ✅ Signal handling
- ✅ Multi-stage builds support
- ✅ Security hardening

## Health Check System

The health check system provides comprehensive monitoring:

### Health Check Types
- **System Resources**: CPU, memory, disk usage
- **Docker Connection**: Docker daemon connectivity
- **Metrics Collection**: Metrics system health
- **Error Rates**: Application error monitoring
- **Processing Queues**: Queue health monitoring

### Health Check Endpoints (Docker)
- `/health` - Comprehensive health check
- `/health/live` - Liveness probe (Kubernetes)
- `/health/ready` - Readiness probe (Kubernetes)  
- `/health/startup` - Startup probe (Kubernetes)

### Health Check Output
```json
{
  "overall_status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "uptime_seconds": 3600,
  "version": "2.0.0",
  "checks": {
    "system_resources": "pass",
    "docker_connection": "pass", 
    "metrics_collection": "pass",
    "error_rates": "pass",
    "processing_queues": "pass"
  },
  "summary": {
    "healthy": 5,
    "unhealthy": 0,
    "degraded": 0,
    "unknown": 0
  }
}
```

## Troubleshooting

### Common Issues

#### Module Import Errors
```bash
# Error: No module named 'container_monitor'
# Solution: Ensure PYTHONPATH is set correctly
export PYTHONPATH=/app:$PYTHONPATH
python -m container_monitor
```

#### Docker Connection Issues
```bash
# Error: Docker daemon not accessible
# Solution: Check Docker socket permissions
ls -la /var/run/docker.sock
# Or set DOCKER_HOST environment variable
export DOCKER_HOST=unix:///var/run/docker.sock
```

#### Configuration Errors
```bash
# Error: Configuration file not found
# Solution: Use absolute path or check file permissions
python -m container_monitor --config /absolute/path/to/config.yaml

# Error: Invalid YAML syntax
# Solution: Validate YAML syntax
python -c "import yaml; yaml.safe_load(open('config.yaml'))"
```

#### Permission Errors
```bash
# Error: Permission denied writing reports
# Solution: Check directory permissions
chmod 755 /app/reports
chown -R secmonitor:secmonitor /app/reports
```

### Debug Mode

Enable debug logging for troubleshooting:
```bash
# Debug logging
python -m container_monitor --log-level DEBUG

# Development mode with colors
./run-dev.sh --log-level DEBUG
```

## Migration from Legacy System

### From Old `src/security_monitor.py` (RETIRED)

⚠️ **IMPORTANT**: The legacy monolithic system has been **RETIRED** and moved to `legacy/security_monitor_v1.py` for archival purposes only.

#### Old System (No longer available)
```bash
python src/security_monitor.py  # ❌ REMOVED
```

#### New System (Current)
```bash
python -m container_monitor     # ✅ ACTIVE
```

### Docker Migration (Complete)

#### Old Dockerfile Entry Point (Removed)
```dockerfile
CMD ["python", "src/security_monitor.py"]  # ❌ REMOVED
```

#### New Dockerfile Entry Point (Active)
```dockerfile  
CMD ["python", "-m", "container_monitor"]  # ✅ ACTIVE
```

### Legacy System Access

If you need to reference the legacy system for historical purposes:
- **Archive Location**: `legacy/security_monitor_v1.py`
- **Documentation**: `legacy/README.md`
- **Migration Guide**: `MIGRATION_GUIDE.md`
- **Rollback Procedures**: Available in legacy documentation

### Configuration Compatibility

The new system maintains backward compatibility with existing configuration files while providing enhanced validation and features.

## Performance & Security

### Performance Features
- Asynchronous operation for non-blocking monitoring
- Bounded execution pools to prevent resource exhaustion
- Efficient event queuing and processing
- Configurable monitoring intervals

### Security Features
- Non-root container execution
- Input validation and sanitization
- Secure configuration loading
- HMAC-signed alert webhooks
- Resource usage monitoring

## Support & Documentation

- **Repository**: Container Security Monitor v2.0.0
- **Architecture**: Modular microservices-based design
- **CLI Framework**: argparse with comprehensive help
- **Logging**: Structured logging with JSON and console formats
- **Health Checks**: Kubernetes-compatible health endpoints
- **Docker**: Multi-stage builds with security hardening

For additional support, refer to the component-specific documentation in the `container_monitor/` module directories.