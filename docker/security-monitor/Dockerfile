# =============================================================================
# CONTAINER RUNTIME SECURITY MONITOR
# =============================================================================
# This Docker image provides runtime security monitoring for containerized applications.
# It monitors container behavior, network traffic, file system changes, and security events.
# =============================================================================

FROM python:3.12-alpine@sha256:25a82f6f8b720a6a257d58e478a0a5517448006e010c85273f4d9c706819478c

# Security labels
LABEL maintainer="DCE Security Team" \
      version="2.0.0" \
      description="Container Runtime Security Monitor - Modular Architecture" \
      security.scan="enabled" \
      security.non-root="true" \
      security.runtime-monitor="true" \
      architecture="modular" \
      entry-point="container_monitor"

# Install system dependencies for monitoring
RUN apk add --no-cache --update \
    docker-cli=~25.0 \
    curl=~8.10 \
    jq=~1.7 \
    procps=~3.3 \
    net-tools=~2.10 \
    ca-certificates=~20240705 && \
    # Remove package cache
    rm -rf /var/cache/apk/* /tmp/* /var/tmp/*

# Create non-root security monitor user
RUN addgroup -g 1001 -S secmonitor && \
    adduser -S secmonitor -u 1001 -G secmonitor

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy security monitor application
COPY --chown=secmonitor:secmonitor container_monitor/ ./container_monitor/
COPY --chown=secmonitor:secmonitor config/ ./config/
COPY --chown=secmonitor:secmonitor scripts/ ./scripts/
COPY --chown=secmonitor:secmonitor run-monitor.sh ./run-monitor.sh
COPY --chown=secmonitor:secmonitor run-dev.sh ./run-dev.sh

# Create directories for reports and logs and make scripts executable
RUN mkdir -p /app/reports /app/logs /app/data && \
    chmod +x /app/run-monitor.sh /app/run-dev.sh && \
    chown -R secmonitor:secmonitor /app

# Switch to non-root user
USER secmonitor

# Health check
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
    CMD python -m container_monitor --health-check

# Set environment variables
ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    SECURITY_MONITOR_CONFIG=/app/config/monitor.yaml

# Start the security monitor using the new modular system
CMD ["python", "-m", "container_monitor"]