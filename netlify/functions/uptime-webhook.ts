import { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

// Types for the webhook payload
interface UptimeWebhookPayload {
  monitor: string
  monitor_id?: string
  status: 'up' | 'down' | 'degraded'
  error_message?: string
  response_time?: number
  status_code?: number
  url?: string
  timestamp?: string
  alert_type?: 'incident_start' | 'incident_end' | 'test'
}

// Types for monitoring event
interface MonitoringEvent {
  id?: string
  monitor_name: string
  monitor_id?: string
  status: 'up' | 'down' | 'degraded'
  severity: 'critical' | 'warning' | 'info'
  error_message?: string
  response_time?: number
  status_code?: number
  url?: string
  metadata?: Record<string, unknown>
  created_at: string
}

// Slack webhook payload
interface SlackMessage {
  text: string
  username?: string
  icon_emoji?: string
  attachments?: Array<{
    color: string
    title: string
    text: string
    fields?: Array<{
      title: string
      value: string
      short?: boolean
    }>
    footer?: string
    ts?: number
  }>
}

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Helper to determine severity based on status
const getSeverity = (status: string): 'critical' | 'warning' | 'info' => {
  switch (status) {
    case 'down':
      return 'critical'
    case 'degraded':
      return 'warning'
    case 'up':
    default:
      return 'info'
  }
}

// Helper to format Slack message
const formatSlackMessage = (event: MonitoringEvent): SlackMessage => {
  const colors = {
    critical: '#ff0000',
    warning: '#ff9900',
    info: '#36a64f'
  }

  const emojis = {
    critical: '🚨',
    warning: '⚠️',
    info: '✅'
  }

  const statusText = {
    up: 'RECOVERED',
    down: 'DOWN',
    degraded: 'DEGRADED'
  }

  return {
    text: `${emojis[event.severity]} Blog Monitoring Alert: ${event.monitor_name} is ${statusText[event.status]}`,
    username: 'Blog Monitor',
    icon_emoji: ':robot_face:',
    attachments: [
      {
        color: colors[event.severity],
        title: `${event.monitor_name} Status Change`,
        text: event.error_message || `Monitor status changed to ${event.status}`,
        fields: [
          {
            title: 'Monitor',
            value: event.monitor_name,
            short: true
          },
          {
            title: 'Status',
            value: event.status.toUpperCase(),
            short: true
          },
          ...(event.response_time ? [{
            title: 'Response Time',
            value: `${event.response_time}ms`,
            short: true
          }] : []),
          ...(event.status_code ? [{
            title: 'Status Code',
            value: event.status_code.toString(),
            short: true
          }] : []),
          ...(event.url ? [{
            title: 'URL',
            value: event.url,
            short: false
          }] : [])
        ],
        footer: 'Blog Monitoring System',
        ts: Math.floor(Date.now() / 1000)
      }
    ]
  }
}

// Send alert to Slack
const sendSlackAlert = async (message: SlackMessage): Promise<void> => {
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL

  if (!slackWebhookUrl) {
    console.warn('SLACK_WEBHOOK_URL not configured, skipping Slack notification')
    return
  }

  try {
    const response = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    })

    if (!response.ok) {
      console.error('Failed to send Slack alert:', response.statusText)
    }
  } catch (error) {
    console.error('Error sending Slack alert:', error)
  }
}

// Validate webhook payload
const validatePayload = (body: unknown): UptimeWebhookPayload | null => {
  if (!body || typeof body !== 'object') {
    return null
  }

  const payload = body as Record<string, unknown>

  // Required fields
  if (!payload.monitor || typeof payload.monitor !== 'string') {
    return null
  }

  if (!payload.status || !['up', 'down', 'degraded'].includes(payload.status as string)) {
    return null
  }

  return payload as unknown as UptimeWebhookPayload
}

// Main handler
export const handler: Handler = async (
  event: HandlerEvent
): Promise<HandlerResponse> => {
  // Handle webhook validation (some services send GET request to validate)
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        status: 'ok',
        service: 'blog-uptime-monitor',
        timestamp: new Date().toISOString()
      })
    }
  }

  // Only accept POST requests for actual webhooks
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    }
  }

  try {
    // Parse and validate payload
    const body = JSON.parse(event.body || '{}')
    const payload = validatePayload(body)

    if (!payload) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid payload' })
      }
    }

    // Create monitoring event
    const monitoringEvent: MonitoringEvent = {
      monitor_name: payload.monitor,
      monitor_id: payload.monitor_id,
      status: payload.status,
      severity: getSeverity(payload.status),
      error_message: payload.error_message,
      response_time: payload.response_time,
      status_code: payload.status_code,
      url: payload.url,
      metadata: {
        timestamp: payload.timestamp || new Date().toISOString(),
        alert_type: payload.alert_type,
        raw_payload: body
      },
      created_at: new Date().toISOString()
    }

    // Log to Supabase
    const { error: dbError } = await supabase
      .from('monitoring_events')
      .insert(monitoringEvent)

    if (dbError) {
      console.error('Failed to log monitoring event:', dbError)
      // Don't fail the webhook, continue with alerting
    }

    // Send alerts based on severity
    if (monitoringEvent.severity === 'critical' || 
        (monitoringEvent.severity === 'warning' && process.env.ALERT_ON_WARNING === 'true')) {
      await sendSlackAlert(formatSlackMessage(monitoringEvent))
    }

    // Special handling for recovery (up status after down/degraded)
    if (payload.status === 'up' && payload.alert_type === 'incident_end') {
      const recoveryMessage = formatSlackMessage({
        ...monitoringEvent,
        severity: 'info'
      })
      recoveryMessage.text = `✅ Blog Monitoring Recovery: ${payload.monitor} is back online!`
      await sendSlackAlert(recoveryMessage)
    }

    // Return success response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        received: true,
        status: 'success',
        event_id: monitoringEvent.id,
        timestamp: monitoringEvent.created_at
      })
    }
  } catch (error) {
    console.error('Webhook processing error:', error)
    
    // Still return 200 to prevent webhook retry loops
    return {
      statusCode: 200,
      body: JSON.stringify({
        received: true,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}