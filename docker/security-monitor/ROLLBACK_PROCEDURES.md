# Container Security Monitor Rollback Procedures

## Overview

This document provides comprehensive procedures for rolling back from the modular Container Security Monitor (v2.0) to the legacy monolithic system if critical issues are encountered.

## When to Consider Rollback

### Critical Situations
- **Production System Failure**: Modular system fails to start or crashes repeatedly
- **Data Corruption**: Reports or configurations become corrupted
- **Performance Degradation**: Significant performance regression (>50% slower)
- **Integration Failures**: Critical integrations stop working
- **Security Vulnerabilities**: Discovery of security issues in modular system

### Warning Signs
- Health checks consistently failing
- Reports not generating correctly
- Alert webhooks not delivering
- Memory usage exceeding 200MB consistently
- Error rates above 5% for more than 1 hour

## Rollback Procedures

### Emergency Rollback (< 5 minutes)

For immediate production issues requiring instant rollback:

```bash
#!/bin/bash
# Emergency rollback script

# 1. Stop modular system immediately
docker stop dce-security-monitor 2>/dev/null || true
pkill -f "container_monitor" 2>/dev/null || true

# 2. Restore legacy system
cp legacy/security_monitor_v1.py src/security_monitor.py

# 3. Quick Docker restart with legacy system
docker run -d \
  --name security-monitor-emergency \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v $(pwd)/config:/app/config:ro \
  -v $(pwd)/reports:/app/reports \
  -e PYTHONPATH=/app \
  python:3.12-alpine \
  sh -c "pip install docker structlog pydantic watchdog && python src/security_monitor.py"

echo "✅ Emergency rollback completed"
```

### Planned Rollback (15-30 minutes)

For planned rollback with proper testing:

#### Step 1: Prepare Rollback Environment

```bash
# Create rollback workspace
mkdir -p rollback-$(date +%Y%m%d_%H%M%S)
cd rollback-$(date +%Y%m%d_%H%M%S)

# Copy current configuration
cp -r ../config ./
cp -r ../legacy ./
```

#### Step 2: Restore Legacy System

```bash
# Restore monolithic system
cp legacy/security_monitor_v1.py src/security_monitor.py

# Verify legacy system file
echo "Legacy system file size: $(wc -l src/security_monitor.py | awk '{print $1}') lines"
```

#### Step 3: Update Docker Configuration

```bash
# Update Dockerfile entry point
sed -i 's/CMD \["python", "-m", "container_monitor"\]/CMD ["python", "src\/security_monitor.py"]/' Dockerfile

# Or create emergency Dockerfile
cat > Dockerfile.rollback << 'EOF'
FROM python:3.12-alpine

# Install dependencies
RUN pip install docker structlog pydantic watchdog yaml

# Copy legacy system
COPY src/security_monitor.py ./src/
COPY config/ ./config/

# Set working directory
WORKDIR /app

# Set environment
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Run legacy system
CMD ["python", "src/security_monitor.py"]
EOF
```

#### Step 4: Test Legacy System

```bash
# Build rollback image
docker build -f Dockerfile.rollback -t security-monitor:rollback .

# Test legacy system
docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v $(pwd)/config:/app/config:ro \
  security-monitor:rollback \
  python src/security_monitor.py --help

echo "✅ Legacy system test completed"
```

#### Step 5: Deploy Rollback

```bash
# Stop modular system
docker stop dce-security-monitor
docker rm dce-security-monitor

# Deploy legacy system
docker run -d \
  --name security-monitor-legacy \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v $(pwd)/config:/app/config:ro \
  -v $(pwd)/reports:/app/reports \
  --restart unless-stopped \
  security-monitor:rollback

# Verify deployment
docker ps | grep security-monitor-legacy
docker logs security-monitor-legacy --tail 20
```

#### Step 6: Validate Rollback

```bash
# Check legacy system health
docker exec security-monitor-legacy python src/health_check.py

# Verify reports generation
ls -la reports/
tail -n 50 reports/security_report_$(date +%Y%m%d)*.json

# Test alert webhook
curl -X POST YOUR_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{"test": "rollback_validation"}'
```

## Rollback Validation Checklist

### System Health Checks
- [ ] **Container Status**: Legacy system container running and healthy
- [ ] **Process Check**: `security_monitor.py` process active
- [ ] **Docker Connectivity**: Can connect to Docker daemon
- [ ] **Configuration Loading**: Config file loads without errors
- [ ] **Memory Usage**: Within expected range (<150MB)
- [ ] **CPU Usage**: Within expected range (<25%)

### Functional Validation
- [ ] **Container Detection**: Detects all running containers
- [ ] **Report Generation**: Generates reports in expected format
- [ ] **Alert Delivery**: Webhook alerts delivered successfully
- [ ] **File System Monitoring**: File changes detected
- [ ] **Network Analysis**: Network connections monitored
- [ ] **Health Endpoints**: Health check responds correctly

### Performance Validation
- [ ] **Scan Time**: Container scans complete within 10 seconds
- [ ] **Memory Stability**: No memory leaks over 1 hour
- [ ] **Error Rate**: <1% error rate
- [ ] **Response Time**: Health checks respond <2 seconds
- [ ] **Throughput**: Processes expected container volume

## Configuration Rollback

### Docker Compose Rollback

```yaml
# Update docker-compose.yml
services:
  security-monitor:
    build:
      context: ./docker/security-monitor
      dockerfile: Dockerfile.rollback
    # Change command back to legacy
    command: ["python", "src/security_monitor.py"]
    # Rest of configuration remains the same
```

### Kubernetes Rollback

```yaml
# Update deployment manifest
apiVersion: apps/v1
kind: Deployment
metadata:
  name: security-monitor
spec:
  template:
    spec:
      containers:
      - name: security-monitor
        image: security-monitor:rollback
        command: ["python", "src/security_monitor.py"]
        # Configuration remains the same
```

### Systemd Service Rollback

```ini
# Update /etc/systemd/system/security-monitor.service
[Unit]
Description=Container Security Monitor (Legacy)

[Service]
Type=simple
User=secmonitor
WorkingDirectory=/app
Environment=PYTHONPATH=/app
ExecStart=/usr/bin/python src/security_monitor.py
Restart=always

[Install]
WantedBy=multi-user.target
```

## Data Migration During Rollback

### Report Compatibility

The legacy system uses the same report format, so no data migration is needed:

```bash
# Verify report compatibility
python -c "
import json
with open('reports/security_report_latest.json') as f:
    report = json.load(f)
    print('✅ Report format compatible')
    print(f'Containers: {len(report.get(\"containers\", []))}')
    print(f'Timestamp: {report.get(\"timestamp\")}')
"
```

### Configuration Compatibility

Legacy system uses the same configuration format:

```bash
# Test configuration compatibility
python -c "
import yaml
with open('config/monitor.yaml') as f:
    config = yaml.safe_load(f)
    print('✅ Configuration compatible')
    print(f'Monitor interval: {config.get(\"monitoring\", {}).get(\"interval\")}')
"
```

## Monitoring During Rollback

### Health Monitoring

```bash
# Monitor legacy system health
while true; do
  echo "=== $(date) ==="
  docker exec security-monitor-legacy python src/health_check.py
  echo "Memory usage: $(docker stats --no-stream --format 'table {{.MemUsage}}' security-monitor-legacy)"
  echo "---"
  sleep 60
done
```

### Alert Monitoring

```bash
# Monitor alert delivery
tail -f reports/alerts.log | grep -E "(webhook|alert|error)"
```

### Performance Monitoring

```bash
# Monitor system performance
watch -n 30 'docker stats --no-stream security-monitor-legacy'
```

## Troubleshooting Common Rollback Issues

### Issue 1: Legacy System Won't Start

**Symptoms**: Container fails to start, import errors
**Solution**:
```bash
# Check Python dependencies
docker run --rm security-monitor:rollback pip list

# Install missing dependencies
docker exec security-monitor-legacy pip install missing-package

# Or rebuild image with dependencies
docker build --no-cache -f Dockerfile.rollback -t security-monitor:rollback .
```

### Issue 2: Configuration Errors

**Symptoms**: Config file not found, YAML parsing errors
**Solution**:
```bash
# Verify config file path
docker exec security-monitor-legacy ls -la /app/config/

# Test YAML syntax
python -c "import yaml; yaml.safe_load(open('config/monitor.yaml'))"

# Use absolute path
docker run -v $(pwd)/config/monitor.yaml:/app/config/monitor.yaml:ro ...
```

### Issue 3: Docker Permission Issues

**Symptoms**: Cannot connect to Docker daemon
**Solution**:
```bash
# Check Docker socket permissions
ls -la /var/run/docker.sock

# Add user to docker group
sudo usermod -aG docker $(whoami)

# Or run with privileged mode
docker run --privileged ...
```

### Issue 4: Report Generation Failures

**Symptoms**: No reports generated, permission errors
**Solution**:
```bash
# Check reports directory permissions
docker exec security-monitor-legacy ls -la /app/reports/

# Fix permissions
docker exec security-monitor-legacy chown -R $(id -u):$(id -g) /app/reports/

# Or recreate reports volume
docker volume rm reports_volume
docker volume create reports_volume
```

## Post-Rollback Actions

### Documentation Updates

```bash
# Update deployment documentation
echo "System rolled back to legacy v1.x on $(date)" >> ROLLBACK_LOG.md

# Notify team
echo "Container Security Monitor rolled back to legacy system due to [REASON]" | \
  curl -X POST -H 'Content-Type: application/json' -d @- YOUR_SLACK_WEBHOOK
```

### Monitoring Adjustments

```bash
# Update monitoring dashboards to legacy metrics
# Update alerting rules for legacy system patterns
# Adjust performance baselines to legacy expectations
```

### Issue Investigation

```bash
# Preserve modular system logs for analysis
mkdir -p rollback-analysis/$(date +%Y%m%d_%H%M%S)
docker logs dce-security-monitor > rollback-analysis/$(date +%Y%m%d_%H%M%S)/modular-logs.txt
cp -r reports/ rollback-analysis/$(date +%Y%m%d_%H%M%S)/
```

## Re-migration Planning

Once issues are resolved, plan re-migration to modular system:

### Issue Resolution Validation

```bash
# Test modular system in isolation
docker run --rm modular-system:fixed --health-check

# Run side-by-side comparison
python tests/validation/test_side_by_side.py

# Performance benchmarking
python tests/validation/test_performance_benchmarks.py
```

### Gradual Re-migration

```bash
# Phase 1: Deploy modular system alongside legacy
# Phase 2: Split traffic 50/50
# Phase 3: Monitor for 24 hours
# Phase 4: Full cutover to modular system
# Phase 5: Remove legacy system
```

## Rollback Success Criteria

✅ **Legacy system running stably**
✅ **All health checks passing**
✅ **Reports generating correctly**
✅ **Alert webhooks delivering**
✅ **Performance within expected range**
✅ **No error increase**
✅ **All monitoring functional**
✅ **Team notified and documentation updated**

## Emergency Contacts

During rollback situations, escalate to:
- **Primary**: DevOps Team Lead
- **Secondary**: Security Team Lead  
- **Escalation**: Platform Engineering Manager

---

## Rollback Documentation Template

```markdown
# Rollback Report - [DATE]

## Rollback Trigger
- **Issue**: [Description of issue that triggered rollback]
- **Severity**: [High/Medium/Low]
- **Impact**: [Description of impact]
- **Decision Time**: [Time from issue detection to rollback decision]

## Rollback Execution
- **Start Time**: [Rollback start time]
- **Completion Time**: [Rollback completion time]
- **Downtime**: [Total downtime if any]
- **Method Used**: [Emergency/Planned rollback]

## Validation Results
- [ ] System Health: [PASS/FAIL]
- [ ] Functionality: [PASS/FAIL]
- [ ] Performance: [PASS/FAIL]
- [ ] Monitoring: [PASS/FAIL]

## Post-Rollback Actions
- [ ] Team notification completed
- [ ] Documentation updated
- [ ] Issue investigation initiated
- [ ] Re-migration plan developed

## Lessons Learned
- [What went well]
- [What could be improved]
- [Action items for future]
```

---

**Rollback Procedures Status**: ✅ **Ready**

These procedures provide comprehensive guidance for safely rolling back to the legacy system if needed, ensuring minimal downtime and data preservation.