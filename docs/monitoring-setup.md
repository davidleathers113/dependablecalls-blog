# Blog Monitoring Setup Guide

This guide explains how to set up uptime monitoring for the blog system.

## Overview

The blog includes a webhook endpoint that accepts monitoring events from external uptime monitoring services. When issues are detected, alerts are sent via Slack.

## Webhook Endpoint

The monitoring webhook is available at:
```
https://yourdomain.com/webhooks/uptime
```

## Supported Monitoring Services

The webhook accepts POST requests with the following JSON payload:

```json
{
  "monitor": "Blog Health Check",
  "monitor_id": "optional-monitor-id",
  "status": "up" | "down" | "degraded",
  "error_message": "Optional error description",
  "response_time": 150,
  "status_code": 200,
  "url": "https://yourdomain.com/health",
  "timestamp": "2024-01-20T10:30:00Z",
  "alert_type": "incident_start" | "incident_end" | "test"
}
```

### Required Fields
- `monitor`: Name of the monitor
- `status`: Current status (up/down/degraded)

### Optional Fields
- `monitor_id`: Unique identifier for the monitor
- `error_message`: Description of the error
- `response_time`: Response time in milliseconds
- `status_code`: HTTP status code
- `url`: URL being monitored
- `timestamp`: Event timestamp (ISO 8601)
- `alert_type`: Type of alert

## Setting Up Monitoring

### 1. Configure Slack Webhook

1. Go to your Slack workspace settings
2. Navigate to "Apps" → "Manage" → "Custom Integrations" → "Incoming Webhooks"
3. Create a new webhook for your monitoring channel
4. Copy the webhook URL

### 2. Set Environment Variables

Add the following to your Netlify environment variables:

```bash
# Required for database logging
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Required for Slack alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Optional: Alert on degraded status
ALERT_ON_WARNING=true
```

### 3. Configure Your Monitoring Service

#### UptimeRobot

1. Create a new monitor for your blog
2. Set monitor type to "HTTP(s)"
3. Add the health check URL: `https://yourdomain.com/health`
4. In Alert Contacts, add a webhook:
   - URL: `https://yourdomain.com/webhooks/uptime`
   - Method: POST
   - Content Type: application/json
   - POST Value:
   ```json
   {
     "monitor": "*monitorFriendlyName*",
     "monitor_id": "*monitorID*",
     "status": "*alertTypeFriendlyName*",
     "error_message": "*alertDetails*",
     "url": "*monitorURL*"
   }
   ```

#### Pingdom

1. Create a new uptime check
2. Set check URL to: `https://yourdomain.com/health`
3. Add webhook integration:
   - URL: `https://yourdomain.com/webhooks/uptime`
   - Custom JSON:
   ```json
   {
     "monitor": "{{CHECK_NAME}}",
     "status": "{{CURRENT_STATE}}",
     "error_message": "{{DESCRIPTION}}",
     "response_time": {{RESPONSE_TIME}},
     "url": "{{CHECK_URL}}"
   }
   ```

#### StatusCake

1. Create a new uptime test
2. Set test URL to: `https://yourdomain.com/health`
3. Add webhook contact:
   - URL: `https://yourdomain.com/webhooks/uptime`
   - Method: POST
   - Template:
   ```json
   {
     "monitor": "%TestName%",
     "monitor_id": "%TestID%",
     "status": "%Status%",
     "error_message": "%StatusCode% - %Tags%",
     "status_code": %StatusCode%,
     "url": "%TestURL%"
   }
   ```

## Monitoring Database

All monitoring events are stored in the `monitoring_events` table with the following schema:

```sql
CREATE TABLE monitoring_events (
  id UUID PRIMARY KEY,
  monitor_name TEXT NOT NULL,
  monitor_id TEXT,
  status TEXT NOT NULL,
  severity TEXT NOT NULL,
  error_message TEXT,
  response_time INTEGER,
  status_code INTEGER,
  url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
);
```

## Alert Severity Levels

The system automatically assigns severity levels based on status:

- **Critical** (🚨): `status = 'down'` - Always sends alerts
- **Warning** (⚠️): `status = 'degraded'` - Sends alerts if `ALERT_ON_WARNING=true`
- **Info** (✅): `status = 'up'` - No alerts, unless it's a recovery

## Slack Alert Format

Alerts are formatted with:
- Clear status indicators (🚨, ⚠️, ✅)
- Monitor name and current status
- Response time and status code (if available)
- URL being monitored
- Timestamp of the event

Example alert:
```
🚨 Blog Monitoring Alert: Blog Health Check is DOWN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Blog Health Check Status Change
502 Bad Gateway

Monitor: Blog Health Check        Status: DOWN
Response Time: 5000ms            Status Code: 502
URL: https://dependablecalls.com/health

Blog Monitoring System • 10:30 AM
```

## Testing the Webhook

You can test the webhook with curl:

```bash
# Test down status
curl -X POST https://yourdomain.com/webhooks/uptime \
  -H "Content-Type: application/json" \
  -d '{
    "monitor": "Test Monitor",
    "status": "down",
    "error_message": "Test error",
    "url": "https://example.com"
  }'

# Test recovery
curl -X POST https://yourdomain.com/webhooks/uptime \
  -H "Content-Type: application/json" \
  -d '{
    "monitor": "Test Monitor",
    "status": "up",
    "alert_type": "incident_end"
  }'
```

## Monitoring Queries

### View Recent Events
```sql
SELECT * FROM monitoring_events 
ORDER BY created_at DESC 
LIMIT 20;
```

### Calculate Uptime (Last 24 Hours)
```sql
SELECT 
  monitor_name,
  COUNT(*) as total_checks,
  COUNT(CASE WHEN status = 'up' THEN 1 END) as up_count,
  ROUND(
    COUNT(CASE WHEN status = 'up' THEN 1 END) * 100.0 / COUNT(*), 
    2
  ) as uptime_percentage
FROM monitoring_events
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY monitor_name;
```

### Get Average Response Times
```sql
SELECT 
  monitor_name,
  AVG(response_time) as avg_response_time,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time) as p95_response_time,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time) as p99_response_time
FROM monitoring_events
WHERE status = 'up' 
  AND response_time IS NOT NULL
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY monitor_name;
```

## Troubleshooting

### Webhook Not Receiving Events

1. Check the webhook URL is correct
2. Verify the monitoring service is configured correctly
3. Check Netlify function logs: `netlify functions:log uptime-webhook`

### Alerts Not Being Sent

1. Verify `SLACK_WEBHOOK_URL` is set correctly
2. Check if the Slack webhook is active
3. For degraded status, ensure `ALERT_ON_WARNING=true`
4. Check function logs for errors

### Database Not Recording Events

1. Verify `SUPABASE_SERVICE_ROLE_KEY` is set
2. Check the `monitoring_events` table exists
3. Verify RLS policies allow service role inserts