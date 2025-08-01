#!/bin/bash
# Agent Coordination Monitor

echo "=== Container Security Monitor Refactoring - Agent Status ==="
echo

# Check if agents are active
for window in models-agent security-agent async-agent; do
    echo "[$window]"
    # Check if window exists and get last few lines of output
    if tmux capture-pane -t "dce-impl:$window" -p 2>/dev/null | tail -5 | grep -q "working\|creating\|implementing"; then
        echo "✅ Active - Working on tasks"
    else
        echo "⏳ Waiting or needs attention"
    fi
    echo
done

# Check file creation progress
echo "=== File Creation Progress ==="
echo
echo "Models:"
ls -la container_monitor/models/*.py 2>/dev/null || echo "  ❌ No model files yet"
echo
echo "Security:"
ls -la container_monitor/monitoring/alerting.py 2>/dev/null || echo "  ❌ No alerting module yet"
ls -la container_monitor/config/security.py 2>/dev/null || echo "  ❌ No security config yet"
echo
echo "Async:"
ls -la container_monitor/adapters/docker_async.py 2>/dev/null || echo "  ❌ No async adapter yet"
ls -la container_monitor/core/concurrency.py 2>/dev/null || echo "  ❌ No concurrency module yet"
echo

# Coordination suggestions
echo "=== Coordination Notes ==="
if [ ! -f "container_monitor/models/events.py" ]; then
    echo "⚠️  Models agent should complete first - other agents depend on model definitions"
fi
if [ -f "container_monitor/models/events.py" ] && [ ! -f "container_monitor/monitoring/alerting.py" ]; then
    echo "→ Security agent can now use SecurityEvent model for alerting"
fi
if [ -f "container_monitor/adapters/docker_async.py" ] && [ ! -f "container_monitor/core/monitor.py" ]; then
    echo "→ Ready to integrate async adapter into main monitor"
fi