-- =====================================================
-- Blog Monitoring Infrastructure Migration
-- =====================================================
-- This migration creates tables and functions for
-- monitoring the health and uptime of the blog system
-- =====================================================

-- =====================================================
-- Monitoring Events Table
-- =====================================================

-- Stores all monitoring events from uptime services
CREATE TABLE monitoring_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  monitor_name TEXT NOT NULL,
  monitor_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('up', 'down', 'degraded')),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  error_message TEXT,
  response_time INTEGER, -- milliseconds
  status_code INTEGER,
  url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_monitoring_events_created_at ON monitoring_events(created_at DESC);
CREATE INDEX idx_monitoring_events_monitor_name ON monitoring_events(monitor_name);
CREATE INDEX idx_monitoring_events_status ON monitoring_events(status);
CREATE INDEX idx_monitoring_events_severity ON monitoring_events(severity);

-- =====================================================
-- Monitoring Alerts Table
-- =====================================================

-- Tracks alerts sent for monitoring events
CREATE TABLE monitoring_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES monitoring_events(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('slack', 'email', 'pagerduty', 'webhook')),
  recipient TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Create indexes
CREATE INDEX idx_monitoring_alerts_event_id ON monitoring_alerts(event_id);
CREATE INDEX idx_monitoring_alerts_sent_at ON monitoring_alerts(sent_at DESC);
CREATE INDEX idx_monitoring_alerts_status ON monitoring_alerts(status);

-- =====================================================
-- Monitoring Configurations Table
-- =====================================================

-- Stores monitoring configuration for different services
CREATE TABLE monitoring_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  monitor_name TEXT NOT NULL UNIQUE,
  monitor_type TEXT NOT NULL CHECK (monitor_type IN ('uptime', 'performance', 'error_rate', 'custom')),
  check_interval INTEGER NOT NULL DEFAULT 300, -- seconds
  alert_threshold INTEGER NOT NULL DEFAULT 3, -- consecutive failures before alert
  enabled BOOLEAN DEFAULT TRUE,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Monitoring Summary View
-- =====================================================

-- Provides a summary of monitoring status
CREATE VIEW monitoring_summary AS
SELECT 
  monitor_name,
  COUNT(*) as total_events,
  COUNT(CASE WHEN status = 'up' THEN 1 END) as up_count,
  COUNT(CASE WHEN status = 'down' THEN 1 END) as down_count,
  COUNT(CASE WHEN status = 'degraded' THEN 1 END) as degraded_count,
  AVG(response_time) FILTER (WHERE response_time IS NOT NULL) as avg_response_time,
  MAX(created_at) as last_check,
  -- Calculate uptime percentage for last 24 hours
  ROUND(
    COUNT(CASE WHEN status = 'up' THEN 1 END) * 100.0 / 
    NULLIF(COUNT(*), 0), 
    2
  ) as uptime_percentage
FROM monitoring_events
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY monitor_name;

-- =====================================================
-- Functions for Monitoring Operations
-- =====================================================

-- Function to get monitor status history
CREATE OR REPLACE FUNCTION get_monitor_status_history(
  p_monitor_name TEXT,
  p_hours_back INTEGER DEFAULT 24
)
RETURNS TABLE (
  status TEXT,
  severity TEXT,
  error_message TEXT,
  response_time INTEGER,
  created_at TIMESTAMPTZ,
  duration_minutes INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH status_changes AS (
    SELECT 
      me.status,
      me.severity,
      me.error_message,
      me.response_time,
      me.created_at,
      LAG(me.created_at) OVER (ORDER BY me.created_at DESC) as prev_created_at
    FROM monitoring_events me
    WHERE me.monitor_name = p_monitor_name
      AND me.created_at >= NOW() - INTERVAL '1 hour' * p_hours_back
    ORDER BY me.created_at DESC
  )
  SELECT 
    sc.status,
    sc.severity,
    sc.error_message,
    sc.response_time,
    sc.created_at,
    CASE 
      WHEN sc.prev_created_at IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (sc.prev_created_at - sc.created_at))::INTEGER / 60
      ELSE NULL
    END as duration_minutes
  FROM status_changes sc;
END;
$$;

-- Function to calculate uptime SLA
CREATE OR REPLACE FUNCTION calculate_uptime_sla(
  p_monitor_name TEXT,
  p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_checks BIGINT,
  successful_checks BIGINT,
  failed_checks BIGINT,
  degraded_checks BIGINT,
  uptime_percentage NUMERIC,
  avg_response_time NUMERIC,
  p95_response_time NUMERIC,
  p99_response_time NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH monitor_stats AS (
    SELECT 
      COUNT(*) as total_checks,
      COUNT(CASE WHEN status = 'up' THEN 1 END) as successful_checks,
      COUNT(CASE WHEN status = 'down' THEN 1 END) as failed_checks,
      COUNT(CASE WHEN status = 'degraded' THEN 1 END) as degraded_checks,
      AVG(response_time) FILTER (WHERE response_time IS NOT NULL) as avg_response_time,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time) FILTER (WHERE response_time IS NOT NULL) as p95_response_time,
      PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time) FILTER (WHERE response_time IS NOT NULL) as p99_response_time
    FROM monitoring_events
    WHERE monitor_name = p_monitor_name
      AND created_at >= NOW() - INTERVAL '1 day' * p_days_back
  )
  SELECT 
    total_checks,
    successful_checks,
    failed_checks,
    degraded_checks,
    ROUND(
      CASE 
        WHEN total_checks > 0 
        THEN (successful_checks + degraded_checks * 0.5) * 100.0 / total_checks
        ELSE 0
      END, 
      4
    ) as uptime_percentage,
    ROUND(avg_response_time::NUMERIC, 2),
    ROUND(p95_response_time::NUMERIC, 2),
    ROUND(p99_response_time::NUMERIC, 2)
  FROM monitor_stats;
END;
$$;

-- Function to detect monitoring anomalies
CREATE OR REPLACE FUNCTION detect_monitoring_anomalies()
RETURNS TABLE (
  monitor_name TEXT,
  anomaly_type TEXT,
  description TEXT,
  severity TEXT,
  detected_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  -- Detect response time anomalies (3x slower than average)
  WITH response_time_baseline AS (
    SELECT 
      monitor_name,
      AVG(response_time) as baseline_response_time,
      STDDEV(response_time) as response_time_stddev
    FROM monitoring_events
    WHERE created_at >= NOW() - INTERVAL '7 days'
      AND created_at < NOW() - INTERVAL '1 hour'
      AND status = 'up'
      AND response_time IS NOT NULL
    GROUP BY monitor_name
  ),
  recent_response_times AS (
    SELECT 
      me.monitor_name,
      AVG(me.response_time) as recent_avg_response_time
    FROM monitoring_events me
    WHERE me.created_at >= NOW() - INTERVAL '1 hour'
      AND me.status = 'up'
      AND me.response_time IS NOT NULL
    GROUP BY me.monitor_name
  )
  SELECT 
    rrt.monitor_name,
    'response_time_anomaly' as anomaly_type,
    FORMAT('Response time %.0fms is %.1fx slower than baseline %.0fms', 
      rrt.recent_avg_response_time, 
      rrt.recent_avg_response_time / NULLIF(rtb.baseline_response_time, 0),
      rtb.baseline_response_time
    ) as description,
    CASE 
      WHEN rrt.recent_avg_response_time > rtb.baseline_response_time + (3 * rtb.response_time_stddev) THEN 'critical'
      WHEN rrt.recent_avg_response_time > rtb.baseline_response_time + (2 * rtb.response_time_stddev) THEN 'warning'
      ELSE 'info'
    END as severity,
    NOW() as detected_at
  FROM recent_response_times rrt
  JOIN response_time_baseline rtb ON rrt.monitor_name = rtb.monitor_name
  WHERE rrt.recent_avg_response_time > rtb.baseline_response_time * 1.5
  
  UNION ALL
  
  -- Detect frequent status changes (flapping)
  SELECT 
    monitor_name,
    'flapping' as anomaly_type,
    FORMAT('Monitor changed status %s times in the last hour', COUNT(DISTINCT status)) as description,
    'warning' as severity,
    NOW() as detected_at
  FROM monitoring_events
  WHERE created_at >= NOW() - INTERVAL '1 hour'
  GROUP BY monitor_name
  HAVING COUNT(DISTINCT status) >= 3;
END;
$$;

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on monitoring tables
ALTER TABLE monitoring_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_configs ENABLE ROW LEVEL SECURITY;

-- Admin full access policies
CREATE POLICY "Admin full access to monitoring events" ON monitoring_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND user_metadata->>'userType' = 'admin'
    )
  );

CREATE POLICY "Admin full access to monitoring alerts" ON monitoring_alerts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND user_metadata->>'userType' = 'admin'
    )
  );

CREATE POLICY "Admin full access to monitoring configs" ON monitoring_configs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND user_metadata->>'userType' = 'admin'
    )
  );

-- Service role can insert monitoring events (for webhooks)
CREATE POLICY "Service role can insert monitoring events" ON monitoring_events
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
  );

CREATE POLICY "Service role can insert monitoring alerts" ON monitoring_alerts
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
  );

-- =====================================================
-- Triggers and Automation
-- =====================================================

-- Trigger to update monitoring_configs.updated_at
CREATE OR REPLACE FUNCTION update_monitoring_configs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_monitoring_configs_updated_at
  BEFORE UPDATE ON monitoring_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_monitoring_configs_updated_at();

-- =====================================================
-- Scheduled Cleanup Function
-- =====================================================

-- Function to clean up old monitoring data
CREATE OR REPLACE FUNCTION cleanup_old_monitoring_data()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER := 0;
  retention_days INTEGER := 90; -- 3 months retention
BEGIN
  -- Delete old monitoring events
  DELETE FROM monitoring_events 
  WHERE created_at < NOW() - INTERVAL '1 day' * retention_days;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Monitoring alerts are cascade deleted with events
  
  RETURN deleted_count;
END;
$$;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE monitoring_events IS 'Stores all monitoring events from uptime services and health checks';
COMMENT ON TABLE monitoring_alerts IS 'Tracks alerts sent for monitoring events';
COMMENT ON TABLE monitoring_configs IS 'Stores configuration for different monitoring services';

COMMENT ON FUNCTION get_monitor_status_history(TEXT, INTEGER) IS 'Returns status history for a specific monitor';
COMMENT ON FUNCTION calculate_uptime_sla(TEXT, INTEGER) IS 'Calculates uptime SLA metrics for a monitor';
COMMENT ON FUNCTION detect_monitoring_anomalies() IS 'Detects anomalies in monitoring data';
COMMENT ON FUNCTION cleanup_old_monitoring_data() IS 'Removes old monitoring data based on retention policy';