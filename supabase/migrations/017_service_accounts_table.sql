-- Service Accounts Table Migration
-- Creates table for managing service account access for Netlify functions

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SERVICE ACCOUNTS TABLE
-- ============================================================================

-- Create service accounts table
CREATE TABLE service_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]',
  function_names TEXT[] NOT NULL DEFAULT '{}',
  api_key_hash VARCHAR(64) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  rotation_due_at TIMESTAMPTZ NOT NULL,
  
  -- Constraints
  CONSTRAINT valid_permissions CHECK (jsonb_typeof(permissions) = 'array'),
  CONSTRAINT valid_function_names CHECK (array_length(function_names, 1) > 0),
  CONSTRAINT valid_expiration CHECK (expires_at IS NULL OR expires_at > created_at),
  CONSTRAINT valid_rotation_due CHECK (rotation_due_at > created_at)
);

-- Create indexes for performance
CREATE INDEX idx_service_accounts_name ON service_accounts(name);
CREATE INDEX idx_service_accounts_api_key_hash ON service_accounts(api_key_hash);
CREATE INDEX idx_service_accounts_is_active ON service_accounts(is_active);
CREATE INDEX idx_service_accounts_rotation_due ON service_accounts(rotation_due_at);
CREATE INDEX idx_service_accounts_expires_at ON service_accounts(expires_at);
CREATE INDEX idx_service_accounts_function_names ON service_accounts USING GIN(function_names);

-- Add updated_at trigger
CREATE TRIGGER update_service_accounts_updated_at
  BEFORE UPDATE ON service_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SERVICE ACCOUNT ACCESS LOG
-- ============================================================================

-- Create service account access log for detailed tracking
CREATE TABLE service_account_access_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_account_id UUID REFERENCES service_accounts(id) ON DELETE CASCADE,
  function_name VARCHAR(100) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  access_granted BOOLEAN NOT NULL,
  denial_reason VARCHAR(200),
  request_context JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for access log
CREATE INDEX idx_service_account_access_log_service_account_id ON service_account_access_log(service_account_id);
CREATE INDEX idx_service_account_access_log_function_name ON service_account_access_log(function_name);
CREATE INDEX idx_service_account_access_log_created_at ON service_account_access_log(created_at);
CREATE INDEX idx_service_account_access_log_access_granted ON service_account_access_log(access_granted);

-- ============================================================================
-- FUNCTIONS FOR SERVICE ACCOUNT MANAGEMENT
-- ============================================================================

-- Function to validate service account permissions
CREATE OR REPLACE FUNCTION validate_service_account_permission(
  service_account_uuid UUID,
  function_name VARCHAR(100),
  resource VARCHAR(100),
  action VARCHAR(50),
  context_data JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
  account RECORD;
  permission JSONB;
  has_permission BOOLEAN := false;
  denial_reason VARCHAR(200) := '';
BEGIN
  -- Get service account details
  SELECT * INTO account
  FROM service_accounts
  WHERE id = service_account_uuid AND is_active = true;
  
  IF account IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Service account not found or inactive'
    );
  END IF;
  
  -- Check if service account has expired
  IF account.expires_at IS NOT NULL AND account.expires_at < NOW() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Service account has expired'
    );
  END IF;
  
  -- Check if function is allowed
  IF NOT (function_name = ANY(account.function_names)) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Function not authorized for this service account'
    );
  END IF;
  
  -- Check permissions
  FOR permission IN SELECT * FROM jsonb_array_elements(account.permissions)
  LOOP
    IF (permission->>'resource') = resource AND (permission->>'action') = action THEN
      -- Check permission expiration
      IF permission->>'expires_at' IS NOT NULL AND 
         (permission->>'expires_at')::timestamptz < NOW() THEN
        CONTINUE;
      END IF;
      
      -- Check conditions if they exist
      IF permission->'conditions' IS NOT NULL THEN
        -- Simple condition evaluation (can be extended)
        IF NOT validate_permission_conditions(permission->'conditions', context_data) THEN
          CONTINUE;
        END IF;
      END IF;
      
      has_permission := true;
      EXIT;
    END IF;
  END LOOP;
  
  IF NOT has_permission THEN
    denial_reason := 'Insufficient permissions for resource: ' || resource || ', action: ' || action;
  END IF;
  
  -- Update last used timestamp
  IF has_permission THEN
    UPDATE service_accounts 
    SET last_used_at = NOW() 
    WHERE id = service_account_uuid;
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', has_permission,
    'reason', CASE WHEN has_permission THEN NULL ELSE denial_reason END,
    'service_account_name', account.name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate permission conditions
CREATE OR REPLACE FUNCTION validate_permission_conditions(
  conditions JSONB,
  context_data JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  condition_key TEXT;
  condition_value JSONB;
  context_value JSONB;
BEGIN
  -- Iterate through all conditions
  FOR condition_key, condition_value IN SELECT * FROM jsonb_each(conditions)
  LOOP
    context_value := context_data->condition_key;
    
    -- Handle different condition types
    CASE condition_key
      WHEN 'time_range' THEN
        -- Check if current time is within specified range
        IF NOT validate_time_range_condition(condition_value, NOW()) THEN
          RETURN false;
        END IF;
        
      WHEN 'ip_whitelist' THEN
        -- Check if IP is in whitelist
        IF context_data->>'ip_address' IS NOT NULL THEN
          IF NOT validate_ip_whitelist_condition(condition_value, context_data->>'ip_address') THEN
            RETURN false;
          END IF;
        END IF;
        
      WHEN 'allowed_values' THEN
        -- Check if context value is in allowed values array
        IF NOT (context_value <@ condition_value) THEN
          RETURN false;
        END IF;
        
      ELSE
        -- Direct equality check for other conditions
        IF context_value != condition_value THEN
          RETURN false;
        END IF;
    END CASE;
  END LOOP;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function for time range validation
CREATE OR REPLACE FUNCTION validate_time_range_condition(
  time_range JSONB,
  check_time TIMESTAMPTZ
) RETURNS BOOLEAN AS $$
DECLARE
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
BEGIN
  start_time := (time_range->>'start')::timestamptz;
  end_time := (time_range->>'end')::timestamptz;
  
  RETURN check_time BETWEEN start_time AND end_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function for IP whitelist validation
CREATE OR REPLACE FUNCTION validate_ip_whitelist_condition(
  ip_whitelist JSONB,
  client_ip TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  allowed_ip TEXT;
BEGIN
  -- Check if client IP is in the whitelist
  FOR allowed_ip IN SELECT jsonb_array_elements_text(ip_whitelist)
  LOOP
    -- Support CIDR notation
    IF client_ip::inet <<= allowed_ip::inet THEN
      RETURN true;
    END IF;
  END LOOP;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log service account access attempts
CREATE OR REPLACE FUNCTION log_service_account_access(
  service_account_uuid UUID,
  function_name VARCHAR(100),
  resource VARCHAR(100),
  action VARCHAR(50),
  access_granted BOOLEAN,
  denial_reason VARCHAR(200) DEFAULT NULL,
  context_data JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO service_account_access_log (
    id,
    service_account_id,
    function_name,
    resource,
    action,
    access_granted,
    denial_reason,
    request_context,
    ip_address,
    user_agent
  ) VALUES (
    uuid_generate_v4(),
    service_account_uuid,
    function_name,
    resource,
    action,
    access_granted,
    denial_reason,
    context_data,
    (context_data->>'ip_address')::inet,
    context_data->>'user_agent'
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get service accounts due for rotation
CREATE OR REPLACE FUNCTION get_service_accounts_due_for_rotation()
RETURNS TABLE (
  id UUID,
  name VARCHAR(100),
  rotation_due_at TIMESTAMPTZ,
  days_overdue INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sa.id,
    sa.name,
    sa.rotation_due_at,
    EXTRACT(days FROM NOW() - sa.rotation_due_at)::integer as days_overdue
  FROM service_accounts sa
  WHERE sa.is_active = true
    AND sa.rotation_due_at < NOW()
  ORDER BY sa.rotation_due_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get service account usage statistics
CREATE OR REPLACE FUNCTION get_service_account_usage_stats(
  time_window_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  service_account_id UUID,
  service_account_name VARCHAR(100),
  total_requests BIGINT,
  successful_requests BIGINT,
  failed_requests BIGINT,
  success_rate NUMERIC,
  unique_functions INTEGER,
  last_used TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sa.id as service_account_id,
    sa.name as service_account_name,
    COUNT(sal.*) as total_requests,
    COUNT(sal.*) FILTER (WHERE sal.access_granted = true) as successful_requests,
    COUNT(sal.*) FILTER (WHERE sal.access_granted = false) as failed_requests,
    ROUND(
      (COUNT(sal.*) FILTER (WHERE sal.access_granted = true)::numeric / 
       NULLIF(COUNT(sal.*), 0)) * 100, 2
    ) as success_rate,
    COUNT(DISTINCT sal.function_name) as unique_functions,
    MAX(sal.created_at) as last_used
  FROM service_accounts sa
  LEFT JOIN service_account_access_log sal ON sa.id = sal.service_account_id
    AND sal.created_at > NOW() - (time_window_hours || ' hours')::interval
  WHERE sa.is_active = true
  GROUP BY sa.id, sa.name
  ORDER BY total_requests DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on service accounts tables
ALTER TABLE service_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_account_access_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for service accounts table
CREATE POLICY "Only system admins can view service accounts"
  ON service_accounts FOR SELECT
  TO authenticated
  USING (check_user_permission(auth.uid(), 'system', 'monitor'));

CREATE POLICY "Only system admins can manage service accounts"
  ON service_accounts FOR ALL
  TO authenticated
  USING (check_user_permission(auth.uid(), 'system', 'configure'))
  WITH CHECK (check_user_permission(auth.uid(), 'system', 'configure'));

-- RLS policies for service account access log
CREATE POLICY "Only system admins can view access logs"
  ON service_account_access_log FOR SELECT
  TO authenticated
  USING (check_user_permission(auth.uid(), 'system', 'monitor'));

CREATE POLICY "System can insert access logs"
  ON service_account_access_log FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Allow system to log access attempts

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert default service accounts for existing function groups
-- Note: In production, these would be created through the service account manager

-- Settings functions service account
INSERT INTO service_accounts (
  name,
  description,
  permissions,
  function_names,
  api_key_hash,
  rotation_due_at
) VALUES (
  'settings-functions',
  'Service account for settings management functions',
  '[
    {"resource": "users", "action": "read"},
    {"resource": "users", "action": "update"},
    {"resource": "settings", "action": "read"},
    {"resource": "settings", "action": "update"},
    {"resource": "settings_templates", "action": "read"},
    {"resource": "settings_audit_log", "action": "create"}
  ]'::jsonb,
  ARRAY['get-settings', 'update-settings', 'export-settings', 'import-settings'],
  'placeholder_hash_1', -- This would be replaced with actual hash
  NOW() + INTERVAL '90 days'
);

-- Auth functions service account
INSERT INTO service_accounts (
  name,
  description,
  permissions,
  function_names,
  api_key_hash,
  rotation_due_at
) VALUES (
  'auth-functions',
  'Service account for authentication functions',
  '[
    {"resource": "users", "action": "create"},
    {"resource": "users", "action": "read"},
    {"resource": "users", "action": "update"},
    {"resource": "auth", "action": "manage"}
  ]'::jsonb,
  ARRAY['auth-login', 'auth-logout', 'auth-signup', 'auth-refresh', 'auth-magic-link'],
  'placeholder_hash_2', -- This would be replaced with actual hash
  NOW() + INTERVAL '90 days'
);

-- Campaign functions service account
INSERT INTO service_accounts (
  name,
  description,
  permissions,
  function_names,
  api_key_hash,
  rotation_due_at
) VALUES (
  'campaign-functions',
  'Service account for campaign management functions',
  '[
    {"resource": "campaigns", "action": "create"},
    {"resource": "campaigns", "action": "read"},
    {"resource": "campaigns", "action": "update"},
    {"resource": "campaigns", "action": "list"},
    {"resource": "suppliers", "action": "read"},
    {"resource": "buyers", "action": "read"}
  ]'::jsonb,
  ARRAY['campaigns-create', 'campaigns-update', 'campaigns-get', 'campaigns-list'],
  'placeholder_hash_3', -- This would be replaced with actual hash
  NOW() + INTERVAL '90 days'
);

-- Realtime functions service account
INSERT INTO service_accounts (
  name,
  description,
  permissions,
  function_names,
  api_key_hash,
  rotation_due_at
) VALUES (
  'realtime-functions',
  'Service account for real-time monitoring functions',
  '[
    {"resource": "calls", "action": "read"},
    {"resource": "campaigns", "action": "read"},
    {"resource": "realtime", "action": "subscribe"}
  ]'::jsonb,
  ARRAY['realtime-calls', 'realtime-campaigns', 'realtime-stats'],
  'placeholder_hash_4', -- This would be replaced with actual hash
  NOW() + INTERVAL '90 days'
);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions for service account functions
GRANT EXECUTE ON FUNCTION validate_service_account_permission(UUID, VARCHAR, VARCHAR, VARCHAR, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_permission_conditions(JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_time_range_condition(JSONB, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_ip_whitelist_condition(JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION log_service_account_access(UUID, VARCHAR, VARCHAR, VARCHAR, BOOLEAN, VARCHAR, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_service_accounts_due_for_rotation() TO authenticated;
GRANT EXECUTE ON FUNCTION get_service_account_usage_stats(INTEGER) TO authenticated;

-- Grant table permissions
GRANT SELECT ON service_accounts TO authenticated;
GRANT SELECT ON service_account_access_log TO authenticated;
GRANT INSERT ON service_account_access_log TO authenticated;

-- Comments for documentation
COMMENT ON TABLE service_accounts IS 'Service accounts for Netlify function authentication and authorization';
COMMENT ON TABLE service_account_access_log IS 'Detailed access log for service account usage tracking';

COMMENT ON FUNCTION validate_service_account_permission IS 'Validate service account permissions with context-aware conditions';
COMMENT ON FUNCTION validate_permission_conditions IS 'Evaluate conditional permission requirements';
COMMENT ON FUNCTION log_service_account_access IS 'Log service account access attempts for audit trail';
COMMENT ON FUNCTION get_service_accounts_due_for_rotation IS 'Get service accounts that need key rotation';
COMMENT ON FUNCTION get_service_account_usage_stats IS 'Get usage statistics for service accounts over time window';