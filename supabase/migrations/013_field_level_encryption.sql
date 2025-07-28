-- Field-Level Encryption System Database Schema
-- Creates tables and infrastructure for PII data encryption

-- Create extension for UUID generation if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Encryption Keys table
CREATE TABLE IF NOT EXISTS encryption_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_id VARCHAR(255) UNIQUE NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    algorithm VARCHAR(50) NOT NULL DEFAULT 'AES-256-GCM',
    derivation_function VARCHAR(50) NOT NULL DEFAULT 'PBKDF2',
    key_type VARCHAR(20) NOT NULL DEFAULT 'data', -- 'master', 'data', 'search'
    is_active BOOLEAN NOT NULL DEFAULT true,
    rotated_from_key_id VARCHAR(255),
    deactivation_reason TEXT,
    deactivated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on key_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_encryption_keys_key_id ON encryption_keys(key_id);
CREATE INDEX IF NOT EXISTS idx_encryption_keys_active ON encryption_keys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_encryption_keys_type ON encryption_keys(key_type);

-- Key Rotations table for tracking rotation status
CREATE TABLE IF NOT EXISTS key_rotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rotation_id VARCHAR(255) UNIQUE NOT NULL,
    old_key_id VARCHAR(255) NOT NULL,
    new_key_id VARCHAR(255) NOT NULL,
    rotation_started TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rotation_completed TIMESTAMPTZ,
    records_migrated INTEGER NOT NULL DEFAULT 0,
    total_records INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (old_key_id) REFERENCES encryption_keys(key_id),
    FOREIGN KEY (new_key_id) REFERENCES encryption_keys(key_id)
);

CREATE INDEX IF NOT EXISTS idx_key_rotations_status ON key_rotations(status);
CREATE INDEX IF NOT EXISTS idx_key_rotations_started ON key_rotations(rotation_started);

-- Encryption Audit Logs table
CREATE TABLE IF NOT EXISTS encryption_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    log_id VARCHAR(255) UNIQUE NOT NULL,
    key_id VARCHAR(255),
    operation VARCHAR(20) NOT NULL, -- 'encrypt', 'decrypt', 'key_rotation', 'key_creation'
    user_id UUID,
    table_name VARCHAR(100) NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    record_id VARCHAR(255) NOT NULL,
    context JSONB NOT NULL,
    success BOOLEAN NOT NULL,
    error TEXT,
    performance_ms NUMERIC(10,3),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (key_id) REFERENCES encryption_keys(key_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_encryption_audit_logs_timestamp ON encryption_audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_encryption_audit_logs_user_id ON encryption_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_encryption_audit_logs_operation ON encryption_audit_logs(operation);
CREATE INDEX IF NOT EXISTS idx_encryption_audit_logs_table_field ON encryption_audit_logs(table_name, field_name);

-- Data Access Logs table for GDPR compliance
CREATE TABLE IF NOT EXISTS data_access_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    operation VARCHAR(20) NOT NULL, -- 'decrypt', 'search', 'export'
    context JSONB NOT NULL,
    client_ip INET,
    user_agent TEXT,
    business_purpose TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for data access logs
CREATE INDEX IF NOT EXISTS idx_data_access_logs_user_id ON data_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_data_access_logs_timestamp ON data_access_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_data_access_logs_table_field ON data_access_logs(table_name, field_name);

-- Compliance Audit Logs table
CREATE TABLE IF NOT EXISTS compliance_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID NOT NULL,
    operation VARCHAR(30) NOT NULL, -- 'access', 'rectification', 'erasure', 'portability', 'restriction'
    executed_by UUID NOT NULL,
    data_affected TEXT[] NOT NULL,
    legal_basis TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL,
    error TEXT,
    
    FOREIGN KEY (subject_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (executed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for compliance logs
CREATE INDEX IF NOT EXISTS idx_compliance_audit_logs_subject_id ON compliance_audit_logs(subject_id);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_logs_operation ON compliance_audit_logs(operation);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_logs_timestamp ON compliance_audit_logs(timestamp);

-- Add encryption-specific columns to existing security_incidents table
DO $$
BEGIN
    -- Add columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_incidents' AND column_name = 'key_id') THEN
        ALTER TABLE security_incidents ADD COLUMN key_id VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_incidents' AND column_name = 'table_name') THEN
        ALTER TABLE security_incidents ADD COLUMN table_name VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_incidents' AND column_name = 'field_name') THEN
        ALTER TABLE security_incidents ADD COLUMN field_name VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_incidents' AND column_name = 'record_id') THEN
        ALTER TABLE security_incidents ADD COLUMN record_id VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_incidents' AND column_name = 'client_ip') THEN
        ALTER TABLE security_incidents ADD COLUMN client_ip INET;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_incidents' AND column_name = 'user_agent') THEN
        ALTER TABLE security_incidents ADD COLUMN user_agent TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_incidents' AND column_name = 'resolution_notes') THEN
        ALTER TABLE security_incidents ADD COLUMN resolution_notes TEXT;
    END IF;
    
    -- Add foreign key constraint if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'security_incidents_key_id_fkey') THEN
        ALTER TABLE security_incidents ADD CONSTRAINT security_incidents_key_id_fkey FOREIGN KEY (key_id) REFERENCES encryption_keys(key_id);
    END IF;
END $$;

-- Create indexes for security incidents
CREATE INDEX IF NOT EXISTS idx_security_incidents_severity ON security_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_security_incidents_timestamp ON security_incidents(created_at);
CREATE INDEX IF NOT EXISTS idx_security_incidents_type ON security_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_security_incidents_resolved ON security_incidents(resolved_at) WHERE resolved_at IS NULL;

-- Data Subject Requests table for GDPR
CREATE TABLE IF NOT EXISTS data_subject_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id VARCHAR(255) UNIQUE NOT NULL,
    subject_id UUID NOT NULL,
    request_type VARCHAR(30) NOT NULL, -- 'access', 'rectification', 'erasure', 'portability', 'restriction'
    requested_by UUID NOT NULL,
    requested_fields TEXT[],
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'rejected'
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    completed_by UUID,
    response_data JSONB,
    
    FOREIGN KEY (subject_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for data subject requests
CREATE INDEX IF NOT EXISTS idx_data_subject_requests_subject_id ON data_subject_requests(subject_id);
CREATE INDEX IF NOT EXISTS idx_data_subject_requests_status ON data_subject_requests(status);
CREATE INDEX IF NOT EXISTS idx_data_subject_requests_type ON data_subject_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_data_subject_requests_requested_at ON data_subject_requests(requested_at);

-- Migration logs table
CREATE TABLE IF NOT EXISTS migration_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    migration_id VARCHAR(255) UNIQUE NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    total_records INTEGER NOT NULL DEFAULT 0,
    processed_records INTEGER NOT NULL DEFAULT 0,
    encrypted_fields INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    errors TEXT[],
    
    CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'paused'))
);

-- Create indexes for migration logs
CREATE INDEX IF NOT EXISTS idx_migration_logs_table_name ON migration_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_migration_logs_status ON migration_logs(status);
CREATE INDEX IF NOT EXISTS idx_migration_logs_started_at ON migration_logs(started_at);

-- Add search hash columns to encrypted tables
-- Users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_search_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_search_hash VARCHAR(255);

-- Suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tax_id_search_hash VARCHAR(255);

-- Buyers table  
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS tax_id_search_hash VARCHAR(255);

-- Calls table
ALTER TABLE calls ADD COLUMN IF NOT EXISTS caller_number_search_hash VARCHAR(255);
ALTER TABLE calls ADD COLUMN IF NOT EXISTS destination_number_search_hash VARCHAR(255);

-- Create indexes on search hash columns
CREATE INDEX IF NOT EXISTS idx_users_email_search_hash ON users(email_search_hash) WHERE email_search_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_phone_search_hash ON users(phone_search_hash) WHERE phone_search_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_tax_id_search_hash ON suppliers(tax_id_search_hash) WHERE tax_id_search_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_buyers_tax_id_search_hash ON buyers(tax_id_search_hash) WHERE tax_id_search_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_caller_number_search_hash ON calls(caller_number_search_hash) WHERE caller_number_search_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_destination_number_search_hash ON calls(destination_number_search_hash) WHERE destination_number_search_hash IS NOT NULL;

-- Create triggers for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_encryption_keys_updated_at BEFORE UPDATE ON encryption_keys FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_key_rotations_updated_at BEFORE UPDATE ON key_rotations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) policies for encryption tables
-- Enable RLS on all encryption-related tables
ALTER TABLE encryption_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_rotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE encryption_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_subject_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_logs ENABLE ROW LEVEL SECURITY;

-- Admin policies (full access for admins)
CREATE POLICY "Admins can manage encryption keys" ON encryption_keys
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM admins 
            WHERE user_id = auth.uid() 
            AND is_active = true
        )
    );

CREATE POLICY "Admins can manage key rotations" ON key_rotations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM admins 
            WHERE user_id = auth.uid() 
            AND is_active = true
        )
    );

-- System policies for audit logs (insert only for most users, full access for admins)
CREATE POLICY "Allow system to insert audit logs" ON encryption_audit_logs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can read audit logs" ON encryption_audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admins 
            WHERE user_id = auth.uid() 
            AND is_active = true
        )
    );

-- Data access logs - users can read their own, admins can read all
CREATE POLICY "Users can read their own data access logs" ON data_access_logs
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can read all data access logs" ON data_access_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admins 
            WHERE user_id = auth.uid() 
            AND is_active = true
        )
    );

CREATE POLICY "Allow system to insert data access logs" ON data_access_logs
    FOR INSERT WITH CHECK (true);

-- Compliance audit logs - admins only
CREATE POLICY "Admins can manage compliance logs" ON compliance_audit_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM admins 
            WHERE user_id = auth.uid() 
            AND is_active = true
        )
    );

-- Security incidents - admins only
DROP POLICY IF EXISTS "Admins can manage security incidents" ON security_incidents;
CREATE POLICY "Admins can manage security incidents" ON security_incidents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM admins 
            WHERE user_id = auth.uid() 
            AND is_active = true
        )
    );

-- Data subject requests - users can see their own, admins can see all
CREATE POLICY "Users can read their own data subject requests" ON data_subject_requests
    FOR SELECT USING (subject_id = auth.uid());

CREATE POLICY "Users can create data subject requests" ON data_subject_requests
    FOR INSERT WITH CHECK (subject_id = auth.uid());

CREATE POLICY "Admins can manage all data subject requests" ON data_subject_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM admins 
            WHERE user_id = auth.uid() 
            AND is_active = true
        )
    );

-- Migration logs - admins only
CREATE POLICY "Admins can manage migration logs" ON migration_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM admins 
            WHERE user_id = auth.uid() 
            AND is_active = true
        )
    );

-- Create views for monitoring and reporting
CREATE OR REPLACE VIEW encryption_key_status AS
SELECT 
    key_id,
    key_type,
    algorithm,
    is_active,
    created_at,
    expires_at,
    CASE 
        WHEN expires_at < NOW() THEN 'expired'
        WHEN expires_at < NOW() + INTERVAL '30 days' THEN 'expiring_soon'
        ELSE 'active'
    END AS status,
    AGE(NOW(), created_at) AS age
FROM encryption_keys
WHERE is_active = true
ORDER BY created_at DESC;

CREATE OR REPLACE VIEW encryption_performance_summary AS
SELECT 
    operation,
    table_name,
    field_name,
    COUNT(*) as operation_count,
    AVG(performance_ms) as avg_performance_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY performance_ms) as p95_performance_ms,
    COUNT(*) FILTER (WHERE success = false) as error_count,
    DATE_TRUNC('hour', timestamp) as hour_bucket
FROM encryption_audit_logs
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY operation, table_name, field_name, DATE_TRUNC('hour', timestamp)
ORDER BY hour_bucket DESC, operation_count DESC;

CREATE OR REPLACE VIEW gdpr_compliance_summary AS
SELECT 
    request_type,
    status,
    COUNT(*) as request_count,
    AVG(EXTRACT(EPOCH FROM (completed_at - requested_at))/3600) as avg_completion_hours,
    DATE_TRUNC('day', requested_at) as request_date
FROM data_subject_requests
WHERE requested_at >= NOW() - INTERVAL '30 days'
GROUP BY request_type, status, DATE_TRUNC('day', requested_at)
ORDER BY request_date DESC, request_count DESC;

-- Create functions for common operations
CREATE OR REPLACE FUNCTION get_active_encryption_key(key_type_param VARCHAR DEFAULT 'data')
RETURNS TABLE(key_id VARCHAR, algorithm VARCHAR, created_at TIMESTAMPTZ, expires_at TIMESTAMPTZ) AS $$
BEGIN
    RETURN QUERY
    SELECT ek.key_id, ek.algorithm, ek.created_at, ek.expires_at
    FROM encryption_keys ek
    WHERE ek.key_type = key_type_param 
    AND ek.is_active = true
    ORDER BY ek.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_security_incident(
    incident_type_param VARCHAR,
    severity_param VARCHAR,
    description_param TEXT,
    user_id_param UUID DEFAULT NULL,
    key_id_param VARCHAR DEFAULT NULL,
    table_name_param VARCHAR DEFAULT NULL,
    field_name_param VARCHAR DEFAULT NULL,
    client_ip_param INET DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    incident_id UUID;
BEGIN
    INSERT INTO security_incidents (
        incident_type, severity, description, user_id, key_id, 
        table_name, field_name, client_ip
    ) VALUES (
        incident_type_param, severity_param, description_param, 
        user_id_param, key_id_param, table_name_param, field_name_param, client_ip_param
    ) RETURNING id INTO incident_id;
    
    RETURN incident_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON encryption_key_status TO authenticated;
GRANT SELECT ON encryption_performance_summary TO authenticated;
GRANT SELECT ON gdpr_compliance_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_encryption_key TO authenticated;
GRANT EXECUTE ON FUNCTION log_security_incident TO authenticated;

-- Insert comment for migration tracking
COMMENT ON TABLE encryption_keys IS 'Stores encryption key metadata for field-level encryption system';
COMMENT ON TABLE encryption_audit_logs IS 'Audit trail for all encryption/decryption operations';
COMMENT ON TABLE data_access_logs IS 'GDPR compliance log for sensitive data access';
COMMENT ON TABLE security_incidents IS 'Security incident tracking for encryption system';
COMMENT ON TABLE data_subject_requests IS 'GDPR data subject rights request tracking';

-- Create notification triggers for critical events
CREATE OR REPLACE FUNCTION notify_security_incident() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.severity IN ('high', 'critical') THEN
        PERFORM pg_notify('security_incident', json_build_object(
            'incident_id', NEW.id,
            'type', NEW.incident_type,
            'severity', NEW.severity,
            'description', NEW.description,
            'timestamp', NEW.timestamp
        )::text);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER security_incident_notification 
    AFTER INSERT ON security_incidents 
    FOR EACH ROW 
    EXECUTE FUNCTION notify_security_incident();

-- Cleanup function for old audit logs (to be run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(retention_days INTEGER DEFAULT 2555) -- 7 years default
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete old encryption audit logs
    DELETE FROM encryption_audit_logs 
    WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete old data access logs
    DELETE FROM data_access_logs 
    WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;