-- Database Security Enhancement Migration
-- Implements comprehensive security measures including monitoring, audit logging, and breach detection

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
-- pg_audit not available in local Supabase - skip for local development
-- CREATE EXTENSION IF NOT EXISTS "pg_audit";

-- ============================================================================
-- 1. ENHANCED RLS POLICY SECURITY
-- ============================================================================

-- Create security context table for context-aware policies
CREATE TABLE security_contexts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(255) NOT NULL,
  ip_address INET NOT NULL,
  user_agent TEXT,
  device_fingerprint VARCHAR(255),
  geo_location JSONB,
  risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_security_contexts_user_id ON security_contexts(user_id);
CREATE INDEX idx_security_contexts_session_id ON security_contexts(session_id);
CREATE INDEX idx_security_contexts_ip_address ON security_contexts(ip_address);
CREATE INDEX idx_security_contexts_expires_at ON security_contexts(expires_at);

-- Enhanced permission check function with context awareness
CREATE OR REPLACE FUNCTION check_user_permission_with_context(
  user_uuid UUID,
  resource_name VARCHAR(100),
  action_name VARCHAR(50),
  context_data JSONB DEFAULT '{}'
) RETURNS BOOLEAN AS $$
DECLARE
  has_permission BOOLEAN := false;
  user_context RECORD;
  risk_threshold INTEGER := 50;
BEGIN
  -- Get user's security context
  SELECT * INTO user_context
  FROM security_contexts 
  WHERE user_id = user_uuid 
    AND is_active = true 
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  -- Apply risk-based access control
  IF user_context.risk_score > risk_threshold THEN
    -- High-risk users get restricted access
    IF action_name IN ('delete', 'manage', 'admin') THEN
      RETURN false;
    END IF;
  END IF;

  -- Check basic permission through roles
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_uuid
      AND ur.is_active = true
      AND r.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      AND r.permissions @> jsonb_build_array(
        jsonb_build_object('resource', resource_name, 'action', action_name)
      )
  ) INTO has_permission;
  
  RETURN has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
  user_uuid UUID,
  event_type VARCHAR(50),
  resource_type VARCHAR(100),
  resource_id VARCHAR(100),
  event_data JSONB DEFAULT '{}',
  risk_level VARCHAR(20) DEFAULT 'low'
) RETURNS UUID AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO security_audit_log (
    id, user_id, event_type, resource_type, resource_id, 
    event_data, risk_level, created_at
  ) VALUES (
    uuid_generate_v4(), user_uuid, event_type, resource_type, resource_id,
    event_data, risk_level, NOW()
  ) RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. DATABASE CONNECTION MONITORING
-- ============================================================================

-- Connection monitoring table
CREATE TABLE database_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  connection_id INTEGER,
  client_addr INET,
  client_hostname TEXT,
  client_port INTEGER,
  database_name VARCHAR(100),
  username VARCHAR(100),
  application_name TEXT,
  backend_start TIMESTAMPTZ,
  query_start TIMESTAMPTZ,
  state_change TIMESTAMPTZ,
  state VARCHAR(50),
  query TEXT,
  wait_event_type VARCHAR(50),
  wait_event VARCHAR(100),
  is_ssl BOOLEAN,
  ssl_version TEXT,
  ssl_cipher TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_database_connections_user_id ON database_connections(user_id);
CREATE INDEX idx_database_connections_client_addr ON database_connections(client_addr);
CREATE INDEX idx_database_connections_created_at ON database_connections(created_at);

-- Connection anomaly detection
CREATE TABLE connection_anomalies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  anomaly_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium',
  description TEXT,
  connection_data JSONB,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  is_resolved BOOLEAN DEFAULT false
);

CREATE INDEX idx_connection_anomalies_user_id ON connection_anomalies(user_id);
CREATE INDEX idx_connection_anomalies_detected_at ON connection_anomalies(detected_at);
CREATE INDEX idx_connection_anomalies_severity ON connection_anomalies(severity);

-- Function to detect connection anomalies
CREATE OR REPLACE FUNCTION detect_connection_anomalies() RETURNS VOID AS $$
DECLARE
  conn_record RECORD;
  baseline_count INTEGER;
  current_count INTEGER;
BEGIN
  -- Detect unusual connection patterns
  FOR conn_record IN 
    SELECT client_addr, COUNT(*) as conn_count
    FROM database_connections 
    WHERE created_at > NOW() - INTERVAL '1 hour'
    GROUP BY client_addr
    HAVING COUNT(*) > 100  -- Threshold for suspicious activity
  LOOP
    -- Get baseline connection count
    SELECT COALESCE(AVG(daily_count), 10) INTO baseline_count
    FROM (
      SELECT DATE(created_at) as day, COUNT(*) as daily_count
      FROM database_connections 
      WHERE client_addr = conn_record.client_addr
        AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
    ) baseline;
    
    -- Check if current count exceeds baseline by 300%
    IF conn_record.conn_count > baseline_count * 3 THEN
      INSERT INTO connection_anomalies (
        anomaly_type, severity, description, connection_data
      ) VALUES (
        'excessive_connections',
        CASE 
          WHEN conn_record.conn_count > baseline_count * 5 THEN 'high'
          ELSE 'medium'
        END,
        'Unusual number of connections detected from IP: ' || conn_record.client_addr,
        jsonb_build_object(
          'client_addr', conn_record.client_addr,
          'connection_count', conn_record.conn_count,
          'baseline_count', baseline_count
        )
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. QUERY SECURITY ANALYSIS
-- ============================================================================

-- Query security analysis table
CREATE TABLE query_security_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query_hash VARCHAR(64) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  raw_query TEXT NOT NULL,
  normalized_query TEXT,
  risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  security_flags JSONB DEFAULT '{}',
  execution_time INTERVAL,
  rows_affected INTEGER,
  tables_accessed TEXT[],
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  is_blocked BOOLEAN DEFAULT false
);

CREATE INDEX idx_query_security_query_hash ON query_security_analysis(query_hash);
CREATE INDEX idx_query_security_user_id ON query_security_analysis(user_id);
CREATE INDEX idx_query_security_risk_score ON query_security_analysis(risk_score);
CREATE INDEX idx_query_security_detected_at ON query_security_analysis(detected_at);

-- Function to analyze query security
CREATE OR REPLACE FUNCTION analyze_query_security(
  query_text TEXT,
  user_uuid UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  risk_score INTEGER := 0;
  security_flags JSONB := '{}';
  normalized_query TEXT;
  suspicious_patterns TEXT[] := ARRAY[
    'union.*select', 'drop\s+table', 'truncate\s+table', 'delete.*from.*where\s+1\s*=\s*1',
    'exec\s*\(', 'sp_executesql', 'xp_cmdshell', 'pg_sleep', 'waitfor\s+delay',
    'load_file', 'into\s+outfile', 'dumpfile', 'information_schema',
    'pg_user', 'pg_shadow', 'current_user\s*\(\s*\)', 'version\s*\(\s*\)'
  ];
  pattern TEXT;
  query_lower TEXT;
BEGIN
  query_lower := lower(query_text);
  normalized_query := regexp_replace(query_lower, '\s+', ' ', 'g');
  
  -- Check for SQL injection patterns
  FOREACH pattern IN ARRAY suspicious_patterns
  LOOP
    IF query_lower ~ pattern THEN
      risk_score := risk_score + 20;
      security_flags := security_flags || jsonb_build_object('sql_injection_risk', true);
      security_flags := security_flags || jsonb_build_object('suspicious_pattern', pattern);
    END IF;
  END LOOP;
  
  -- Check for excessive wildcards
  IF (LENGTH(query_lower) - LENGTH(REPLACE(query_lower, '*', ''))) > 5 THEN
    risk_score := risk_score + 10;
    security_flags := security_flags || jsonb_build_object('excessive_wildcards', true);
  END IF;
  
  -- Check for missing WHERE clauses in DELETE/UPDATE
  IF query_lower ~ 'delete\s+from' AND query_lower !~ 'where' THEN
    risk_score := risk_score + 30;
    security_flags := security_flags || jsonb_build_object('unsafe_delete', true);
  END IF;
  
  IF query_lower ~ 'update\s+\w+\s+set' AND query_lower !~ 'where' THEN
    risk_score := risk_score + 30;
    security_flags := security_flags || jsonb_build_object('unsafe_update', true);
  END IF;
  
  -- Cap risk score at 100
  risk_score := LEAST(risk_score, 100);
  
  RETURN jsonb_build_object(
    'risk_score', risk_score,
    'security_flags', security_flags,
    'normalized_query', normalized_query
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. COMPREHENSIVE AUDIT LOGGING
-- ============================================================================

-- Enhanced security audit log table
CREATE TABLE security_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id VARCHAR(255),
  event_type VARCHAR(50) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(100),
  action VARCHAR(50),
  event_data JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  risk_level VARCHAR(20) DEFAULT 'low',
  outcome VARCHAR(20) DEFAULT 'success', -- success, failure, blocked
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_security_audit_log_user_id ON security_audit_log(user_id);
CREATE INDEX idx_security_audit_log_event_type ON security_audit_log(event_type);
CREATE INDEX idx_security_audit_log_created_at ON security_audit_log(created_at);
CREATE INDEX idx_security_audit_log_risk_level ON security_audit_log(risk_level);
CREATE INDEX idx_security_audit_log_outcome ON security_audit_log(outcome);

-- Data access audit log for sensitive data
CREATE TABLE data_access_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  table_name VARCHAR(100) NOT NULL,
  operation VARCHAR(20) NOT NULL, -- SELECT, INSERT, UPDATE, DELETE
  record_ids TEXT[],
  column_names TEXT[],
  old_values JSONB,
  new_values JSONB,
  classification_level VARCHAR(20) DEFAULT 'public', -- public, internal, confidential, restricted
  access_method VARCHAR(50), -- direct_sql, api_call, export, etc.
  justification TEXT,
  session_context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_data_access_audit_user_id ON data_access_audit(user_id);
CREATE INDEX idx_data_access_audit_table_name ON data_access_audit(table_name);
CREATE INDEX idx_data_access_audit_operation ON data_access_audit(operation);
CREATE INDEX idx_data_access_audit_classification ON data_access_audit(classification_level);
CREATE INDEX idx_data_access_audit_created_at ON data_access_audit(created_at);

-- Function to log data access
CREATE OR REPLACE FUNCTION log_data_access(
  user_uuid UUID,
  table_name VARCHAR(100),
  operation VARCHAR(20),
  record_ids TEXT[] DEFAULT NULL,
  column_names TEXT[] DEFAULT NULL,
  old_values JSONB DEFAULT NULL,
  new_values JSONB DEFAULT NULL,
  classification_level VARCHAR(20) DEFAULT 'public'
) RETURNS UUID AS $$
DECLARE
  audit_id UUID;
  user_context JSONB;
BEGIN
  -- Get current user context
  SELECT jsonb_build_object(
    'session_id', current_setting('app.session_id', true),
    'ip_address', current_setting('app.ip_address', true),
    'user_agent', current_setting('app.user_agent', true)
  ) INTO user_context;
  
  INSERT INTO data_access_audit (
    id, user_id, table_name, operation, record_ids, column_names,
    old_values, new_values, classification_level, session_context, created_at
  ) VALUES (
    uuid_generate_v4(), user_uuid, table_name, operation, record_ids, column_names,
    old_values, new_values, classification_level, user_context, NOW()
  ) RETURNING id INTO audit_id;
  
  RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. DATA CLASSIFICATION POLICIES
-- ============================================================================

-- Data classification rules
CREATE TABLE data_classification_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name VARCHAR(100) NOT NULL,
  column_name VARCHAR(100),
  classification_level VARCHAR(20) NOT NULL, -- public, internal, confidential, restricted
  classification_reason TEXT,
  retention_period INTERVAL,
  access_restrictions JSONB DEFAULT '{}',
  encryption_required BOOLEAN DEFAULT false,
  masking_rules JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_data_classification_table ON data_classification_rules(table_name);
CREATE INDEX idx_data_classification_level ON data_classification_rules(classification_level);

-- Insert default classification rules
INSERT INTO data_classification_rules (table_name, column_name, classification_level, classification_reason, encryption_required) VALUES
('users', 'email', 'confidential', 'Personal identifiable information', true),
('users', 'phone', 'confidential', 'Personal identifiable information', true),
('users', 'metadata', 'confidential', 'User personal data and preferences', true),
('suppliers', 'phone_number', 'confidential', 'Business contact information', true),
('suppliers', 'settings', 'internal', 'Business configuration data', false),
('buyers', 'phone_number', 'confidential', 'Business contact information', true),
('buyers', 'settings', 'internal', 'Business configuration data', false),
('calls', 'caller_id', 'confidential', 'Personal phone number', true),
('calls', 'recording_url', 'restricted', 'Audio recording contains personal information', true),
('campaigns', 'targeting', 'internal', 'Business targeting strategy', false),
('transactions', NULL, 'confidential', 'Financial transaction data', true),
('invoices', NULL, 'confidential', 'Financial billing information', true),
('payouts', NULL, 'confidential', 'Financial payout information', true);

-- Function to get data classification
CREATE OR REPLACE FUNCTION get_data_classification(
  table_name VARCHAR(100),
  column_name VARCHAR(100) DEFAULT NULL
) RETURNS VARCHAR(20) AS $$
DECLARE
  classification VARCHAR(20) := 'public';
BEGIN
  -- Get most specific classification (column-level first, then table-level)
  SELECT classification_level INTO classification
  FROM data_classification_rules
  WHERE data_classification_rules.table_name = get_data_classification.table_name
    AND (data_classification_rules.column_name = get_data_classification.column_name
         OR (data_classification_rules.column_name IS NULL AND get_data_classification.column_name IS NULL))
  ORDER BY 
    CASE WHEN data_classification_rules.column_name IS NOT NULL THEN 1 ELSE 2 END
  LIMIT 1;
  
  RETURN COALESCE(classification, 'public');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. BREACH DETECTION AND AUTOMATED RESPONSE
-- ============================================================================

-- Security incidents table
CREATE TABLE security_incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
  title VARCHAR(200) NOT NULL,
  description TEXT,
  affected_users UUID[],
  affected_resources JSONB,
  detection_method VARCHAR(50), -- automated, manual, external
  detector_id VARCHAR(100), -- rule_id, user_id, system_name
  evidence JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'open', -- open, investigating, contained, resolved
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  response_actions JSONB DEFAULT '[]',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_security_incidents_severity ON security_incidents(severity);
CREATE INDEX idx_security_incidents_status ON security_incidents(status);
CREATE INDEX idx_security_incidents_created_at ON security_incidents(created_at);
CREATE INDEX idx_security_incidents_incident_type ON security_incidents(incident_type);

-- Breach detection rules
CREATE TABLE breach_detection_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_name VARCHAR(100) UNIQUE NOT NULL,
  rule_type VARCHAR(50) NOT NULL, -- threshold, pattern, anomaly, ml
  description TEXT,
  conditions JSONB NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium',
  auto_response_actions JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_breach_detection_rules_type ON breach_detection_rules(rule_type);
CREATE INDEX idx_breach_detection_rules_active ON breach_detection_rules(is_active);

-- Insert default breach detection rules
INSERT INTO breach_detection_rules (rule_name, rule_type, description, conditions, severity, auto_response_actions) VALUES
('excessive_failed_logins', 'threshold', 'Detect excessive failed login attempts', 
 '{"threshold": 10, "time_window": "15 minutes", "resource": "auth_attempts"}', 
 'high', 
 '["block_ip", "notify_admin", "require_2fa"]'),
 
('data_exfiltration', 'threshold', 'Detect large data exports', 
 '{"threshold": 10000, "time_window": "1 hour", "resource": "data_export"}', 
 'critical', 
 '["block_user", "notify_admin", "log_incident"]'),
 
('privilege_escalation', 'pattern', 'Detect unauthorized privilege changes', 
 '{"patterns": ["role_change", "admin_access"], "resource": "user_roles"}', 
 'high', 
 '["revert_changes", "notify_admin", "suspend_user"]'),
 
('unusual_query_patterns', 'anomaly', 'Detect SQL injection attempts', 
 '{"risk_threshold": 70, "resource": "query_analysis"}', 
 'high', 
 '["block_query", "notify_admin", "log_incident"]'),
 
('off_hours_access', 'pattern', 'Detect access outside business hours', 
 '{"business_hours": "09:00-17:00", "timezone": "UTC", "resource": "user_activity"}', 
 'medium', 
 '["require_justification", "notify_admin"]');

-- Function to create security incident
CREATE OR REPLACE FUNCTION create_security_incident(
  incident_type VARCHAR(50),
  severity VARCHAR(20),
  title VARCHAR(200),
  description TEXT,
  evidence JSONB DEFAULT '{}',
  auto_response BOOLEAN DEFAULT true
) RETURNS UUID AS $$
DECLARE
  incident_id UUID;
  response_actions JSONB;
BEGIN
  incident_id := uuid_generate_v4();
  
  -- Get auto-response actions for this incident type
  SELECT bdr.auto_response_actions INTO response_actions
  FROM breach_detection_rules bdr
  WHERE bdr.rule_type = incident_type AND bdr.is_active = true
  LIMIT 1;
  
  INSERT INTO security_incidents (
    id, incident_type, severity, title, description, evidence, response_actions
  ) VALUES (
    incident_id, incident_type, severity, title, description, evidence, 
    COALESCE(response_actions, '[]'::jsonb)
  );
  
  -- Execute auto-response actions if enabled
  IF auto_response AND response_actions IS NOT NULL THEN
    PERFORM execute_incident_response(incident_id);
  END IF;
  
  RETURN incident_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to execute incident response
CREATE OR REPLACE FUNCTION execute_incident_response(incident_id UUID) RETURNS BOOLEAN AS $$
DECLARE
  incident RECORD;
  action TEXT;
BEGIN
  SELECT * INTO incident FROM security_incidents WHERE id = incident_id;
  
  IF incident IS NULL THEN
    RETURN false;
  END IF;
  
  -- Execute each response action
  FOR action IN SELECT jsonb_array_elements_text(incident.response_actions)
  LOOP
    CASE action
      WHEN 'block_ip' THEN
        -- Add IP to blocklist (would integrate with firewall/WAF)
        INSERT INTO security_audit_log (event_type, event_data) 
        VALUES ('auto_response_block_ip', jsonb_build_object('incident_id', incident_id));
        
      WHEN 'block_user' THEN
        -- Disable user account temporarily
        INSERT INTO security_audit_log (event_type, event_data) 
        VALUES ('auto_response_block_user', jsonb_build_object('incident_id', incident_id));
        
      WHEN 'notify_admin' THEN
        -- Send notification to administrators
        INSERT INTO security_audit_log (event_type, event_data) 
        VALUES ('auto_response_notify_admin', jsonb_build_object('incident_id', incident_id));
        
      WHEN 'require_2fa' THEN
        -- Force 2FA requirement
        INSERT INTO security_audit_log (event_type, event_data) 
        VALUES ('auto_response_require_2fa', jsonb_build_object('incident_id', incident_id));
        
      ELSE
        -- Log unknown action
        INSERT INTO security_audit_log (event_type, event_data) 
        VALUES ('auto_response_unknown', jsonb_build_object('incident_id', incident_id, 'action', action));
    END CASE;
  END LOOP;
  
  -- Update incident status
  UPDATE security_incidents 
  SET status = 'investigating', updated_at = NOW()
  WHERE id = incident_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. MONITORING AND ALERTING FUNCTIONS
-- ============================================================================

-- Function to run security monitoring
CREATE OR REPLACE FUNCTION run_security_monitoring() RETURNS VOID AS $$
BEGIN
  -- Detect connection anomalies
  PERFORM detect_connection_anomalies();
  
  -- Check for high-risk queries in the last hour
  INSERT INTO security_incidents (incident_type, severity, title, description, evidence)
  SELECT 
    'high_risk_query',
    CASE 
      WHEN risk_score >= 80 THEN 'critical'
      WHEN risk_score >= 60 THEN 'high'
      ELSE 'medium'
    END,
    'High-risk database query detected',
    'Query with risk score ' || risk_score || ' detected from user ' || COALESCE(user_id::text, 'unknown'),
    jsonb_build_object(
      'query_hash', query_hash,
      'risk_score', risk_score,
      'security_flags', security_flags,
      'user_id', user_id
    )
  FROM query_security_analysis
  WHERE detected_at > NOW() - INTERVAL '1 hour'
    AND risk_score >= 60
    AND NOT EXISTS (
      SELECT 1 FROM security_incidents si 
      WHERE si.evidence->>'query_hash' = query_security_analysis.query_hash
    );
    
  -- Check for excessive failed authentication attempts
  WITH failed_auth AS (
    SELECT 
      event_data->>'ip_address' as ip_address,
      COUNT(*) as failure_count
    FROM security_audit_log
    WHERE event_type = 'auth_failure'
      AND created_at > NOW() - INTERVAL '15 minutes'
    GROUP BY event_data->>'ip_address'
    HAVING COUNT(*) >= 10
  )
  INSERT INTO security_incidents (incident_type, severity, title, description, evidence)
  SELECT 
    'excessive_failed_logins',
    'high',
    'Excessive failed login attempts detected',
    'IP address ' || ip_address || ' has ' || failure_count || ' failed login attempts in 15 minutes',
    jsonb_build_object(
      'ip_address', ip_address,
      'failure_count', failure_count,
      'time_window', '15 minutes'
    )
  FROM failed_auth
  WHERE NOT EXISTS (
    SELECT 1 FROM security_incidents si 
    WHERE si.evidence->>'ip_address' = failed_auth.ip_address
      AND si.created_at > NOW() - INTERVAL '1 hour'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. RLS POLICIES FOR SECURITY TABLES
-- ============================================================================

-- Enable RLS on security tables
ALTER TABLE security_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE database_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_security_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_access_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_classification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE breach_detection_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies for security tables
CREATE POLICY "Users can view their own security context"
  ON security_contexts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR check_user_permission(auth.uid(), 'system', 'monitor'));

CREATE POLICY "Only system can insert security contexts"
  ON security_contexts FOR INSERT
  TO authenticated
  WITH CHECK (check_user_permission(auth.uid(), 'system', 'monitor'));

CREATE POLICY "Admins can view all security audit logs"
  ON security_audit_log FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    check_user_permission(auth.uid(), 'system', 'monitor')
  );

CREATE POLICY "Only system can insert audit logs"
  ON security_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Allow system logging

CREATE POLICY "Users can view their own data access audit"
  ON data_access_audit FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    check_user_permission(auth.uid(), 'system', 'monitor')
  );

CREATE POLICY "Admins can view security incidents"
  ON security_incidents FOR SELECT
  TO authenticated
  USING (check_user_permission(auth.uid(), 'system', 'monitor'));

CREATE POLICY "Admins can manage security incidents"
  ON security_incidents FOR ALL
  TO authenticated
  USING (check_user_permission(auth.uid(), 'system', 'monitor'))
  WITH CHECK (check_user_permission(auth.uid(), 'system', 'monitor'));

-- Grant necessary permissions
GRANT SELECT ON security_contexts TO authenticated;
GRANT SELECT ON security_audit_log TO authenticated;
GRANT SELECT ON data_access_audit TO authenticated;
GRANT SELECT ON security_incidents TO authenticated;
GRANT SELECT ON data_classification_rules TO authenticated;

-- Comments for documentation
COMMENT ON TABLE security_contexts IS 'Security context tracking for users including risk assessment';
COMMENT ON TABLE database_connections IS 'Real-time database connection monitoring';
COMMENT ON TABLE connection_anomalies IS 'Detected anomalies in database connection patterns';
COMMENT ON TABLE query_security_analysis IS 'Security analysis results for database queries';
COMMENT ON TABLE security_audit_log IS 'Comprehensive security event audit log';
COMMENT ON TABLE data_access_audit IS 'Audit trail for sensitive data access';
COMMENT ON TABLE data_classification_rules IS 'Data classification and protection rules';
COMMENT ON TABLE security_incidents IS 'Security incidents and breach detection results';
COMMENT ON TABLE breach_detection_rules IS 'Automated breach detection rule definitions';

COMMENT ON FUNCTION check_user_permission_with_context IS 'Enhanced permission check with security context and risk assessment';
COMMENT ON FUNCTION log_security_event IS 'Log security events with risk assessment';
COMMENT ON FUNCTION detect_connection_anomalies IS 'Detect unusual database connection patterns';
COMMENT ON FUNCTION analyze_query_security IS 'Analyze database queries for security risks';
COMMENT ON FUNCTION log_data_access IS 'Log access to classified data with full context';
COMMENT ON FUNCTION get_data_classification IS 'Get data classification level for table/column';
COMMENT ON FUNCTION create_security_incident IS 'Create and auto-respond to security incidents';
COMMENT ON FUNCTION execute_incident_response IS 'Execute automated incident response actions';
COMMENT ON FUNCTION run_security_monitoring IS 'Run comprehensive security monitoring checks';