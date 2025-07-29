-- Migration: 026_blog_audit_retention.sql
-- Purpose: Implement audit logging with GDPR-compliant retention for blog CMS
-- Dependencies: Blog CMS tables (blog_posts, blog_authors, blog_categories)

-- Create audit log table for tracking all CRUD operations
CREATE TABLE IF NOT EXISTS blog_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    record_id UUID NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    before_data JSONB,
    after_data JSONB,
    changed_fields TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_blog_audit_log_table_operation ON blog_audit_log(table_name, operation);
CREATE INDEX idx_blog_audit_log_record_id ON blog_audit_log(record_id);
CREATE INDEX idx_blog_audit_log_user_id ON blog_audit_log(user_id);
CREATE INDEX idx_blog_audit_log_timestamp ON blog_audit_log(timestamp);
CREATE INDEX idx_blog_audit_log_created_at ON blog_audit_log(created_at);

-- Create archive table for old audit records
CREATE TABLE IF NOT EXISTS blog_audit_archive (
    id UUID PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    record_id UUID NOT NULL,
    user_id UUID,
    timestamp TIMESTAMPTZ NOT NULL,
    ip_address INET,
    user_agent TEXT,
    before_data JSONB,
    after_data JSONB,
    changed_fields TEXT[],
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for archive table
CREATE INDEX idx_blog_audit_archive_table_operation ON blog_audit_archive(table_name, operation);
CREATE INDEX idx_blog_audit_archive_record_id ON blog_audit_archive(record_id);
CREATE INDEX idx_blog_audit_archive_archived_at ON blog_audit_archive(archived_at);

-- Universal audit trigger function
CREATE OR REPLACE FUNCTION blog_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
    audit_user_id UUID;
    audit_ip_address INET;
    audit_user_agent TEXT;
    changed_fields TEXT[];
    old_record JSONB;
    new_record JSONB;
BEGIN
    -- Get user context from JWT or session
    audit_user_id := COALESCE(
        auth.uid(),
        current_setting('request.jwt.claim.sub', true)::UUID,
        current_setting('app.current_user_id', true)::UUID
    );
    
    -- Get request metadata
    audit_ip_address := COALESCE(
        current_setting('request.headers', true)::JSONB->>'x-real-ip',
        current_setting('request.headers', true)::JSONB->>'x-forwarded-for',
        inet_client_addr()
    )::INET;
    
    audit_user_agent := current_setting('request.headers', true)::JSONB->>'user-agent';
    
    -- Convert records to JSONB
    old_record := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
    new_record := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
    
    -- Calculate changed fields for updates
    IF TG_OP = 'UPDATE' THEN
        SELECT array_agg(key) INTO changed_fields
        FROM (
            SELECT key
            FROM jsonb_each(old_record) AS o(key, value)
            FULL OUTER JOIN jsonb_each(new_record) AS n(key, value) USING (key)
            WHERE o.value IS DISTINCT FROM n.value
        ) AS changes;
    END IF;
    
    -- Insert audit log entry
    INSERT INTO blog_audit_log (
        table_name,
        operation,
        record_id,
        user_id,
        timestamp,
        ip_address,
        user_agent,
        before_data,
        after_data,
        changed_fields,
        metadata
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        COALESCE(NEW.id, OLD.id),
        audit_user_id,
        NOW(),
        audit_ip_address,
        audit_user_agent,
        old_record,
        new_record,
        changed_fields,
        jsonb_build_object(
            'schema_name', TG_TABLE_SCHEMA,
            'session_id', current_setting('request.session', true),
            'transaction_id', txid_current()
        )
    );
    
    -- Return appropriate value
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to blog tables
CREATE TRIGGER audit_blog_posts
    AFTER INSERT OR UPDATE OR DELETE ON blog_posts
    FOR EACH ROW EXECUTE FUNCTION blog_audit_trigger();

CREATE TRIGGER audit_blog_authors
    AFTER INSERT OR UPDATE OR DELETE ON blog_authors
    FOR EACH ROW EXECUTE FUNCTION blog_audit_trigger();

CREATE TRIGGER audit_blog_categories
    AFTER INSERT OR UPDATE OR DELETE ON blog_categories
    FOR EACH ROW EXECUTE FUNCTION blog_audit_trigger();

-- GDPR-compliant retention function for analytics (90 days)
CREATE OR REPLACE FUNCTION blog_cleanup_old_analytics()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete analytics older than 90 days
    WITH deleted AS (
        DELETE FROM blog_analytics_events
        WHERE created_at < NOW() - INTERVAL '90 days'
        RETURNING 1
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;
    
    -- Log cleanup operation
    INSERT INTO blog_audit_log (
        table_name,
        operation,
        record_id,
        user_id,
        timestamp,
        metadata
    ) VALUES (
        'blog_analytics_events',
        'DELETE',
        gen_random_uuid(),
        NULL,
        NOW(),
        jsonb_build_object(
            'action', 'gdpr_cleanup',
            'deleted_count', deleted_count,
            'retention_days', 90
        )
    );
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- GDPR-compliant retention function for audit logs (1 year)
CREATE OR REPLACE FUNCTION blog_archive_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    -- Archive audit logs older than 1 year
    WITH archived AS (
        INSERT INTO blog_audit_archive
        SELECT 
            id,
            table_name,
            operation,
            record_id,
            user_id,
            timestamp,
            ip_address,
            user_agent,
            before_data,
            after_data,
            changed_fields,
            metadata,
            created_at,
            NOW() as archived_at
        FROM blog_audit_log
        WHERE created_at < NOW() - INTERVAL '1 year'
        ON CONFLICT (id) DO NOTHING
        RETURNING 1
    )
    SELECT COUNT(*) INTO archived_count FROM archived;
    
    -- Delete archived records from main table
    DELETE FROM blog_audit_log
    WHERE created_at < NOW() - INTERVAL '1 year'
    AND id IN (SELECT id FROM blog_audit_archive);
    
    -- Log archival operation
    INSERT INTO blog_audit_log (
        table_name,
        operation,
        record_id,
        user_id,
        timestamp,
        metadata
    ) VALUES (
        'blog_audit_log',
        'DELETE',
        gen_random_uuid(),
        NULL,
        NOW(),
        jsonb_build_object(
            'action', 'gdpr_archive',
            'archived_count', archived_count,
            'retention_years', 1
        )
    );
    
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to anonymize personal data in audit logs
CREATE OR REPLACE FUNCTION blog_anonymize_audit_data(days_old INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
    anonymized_count INTEGER;
BEGIN
    -- Anonymize IP addresses and user agents in old audit logs
    WITH anonymized AS (
        UPDATE blog_audit_log
        SET 
            ip_address = '0.0.0.0'::INET,
            user_agent = 'ANONYMIZED',
            metadata = metadata - 'session_id'
        WHERE created_at < NOW() - (days_old || ' days')::INTERVAL
        AND (ip_address IS NOT NULL OR user_agent IS NOT NULL)
        RETURNING 1
    )
    SELECT COUNT(*) INTO anonymized_count FROM anonymized;
    
    -- Also anonymize in archive
    UPDATE blog_audit_archive
    SET 
        ip_address = '0.0.0.0'::INET,
        user_agent = 'ANONYMIZED',
        metadata = metadata - 'session_id'
    WHERE created_at < NOW() - (days_old || ' days')::INTERVAL
    AND (ip_address IS NOT NULL OR user_agent IS NOT NULL);
    
    RETURN anonymized_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create scheduled jobs for retention policies
-- Note: These need to be scheduled via pg_cron or external scheduler

-- Function to get audit history for a specific record
CREATE OR REPLACE FUNCTION blog_get_audit_history(
    p_table_name TEXT,
    p_record_id UUID,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    audit_id UUID,
    operation TEXT,
    user_id UUID,
    timestamp TIMESTAMPTZ,
    changed_fields TEXT[],
    before_data JSONB,
    after_data JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        id as audit_id,
        blog_audit_log.operation,
        blog_audit_log.user_id,
        blog_audit_log.timestamp,
        blog_audit_log.changed_fields,
        blog_audit_log.before_data,
        blog_audit_log.after_data
    FROM blog_audit_log
    WHERE table_name = p_table_name
    AND record_id = p_record_id
    ORDER BY timestamp DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to restore data from audit log
CREATE OR REPLACE FUNCTION blog_restore_from_audit(
    p_audit_id UUID
)
RETURNS JSONB AS $$
DECLARE
    audit_record RECORD;
    result JSONB;
BEGIN
    -- Get audit record
    SELECT * INTO audit_record
    FROM blog_audit_log
    WHERE id = p_audit_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Audit record not found';
    END IF;
    
    -- Return the before_data for restoration
    -- Actual restoration should be done by application logic
    result := jsonb_build_object(
        'table_name', audit_record.table_name,
        'operation', audit_record.operation,
        'record_id', audit_record.record_id,
        'restore_data', COALESCE(audit_record.before_data, audit_record.after_data),
        'timestamp', audit_record.timestamp
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS policies for audit tables
ALTER TABLE blog_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_audit_archive ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
    ON blog_audit_log FOR SELECT
    USING (auth.uid() IN (
        SELECT user_id FROM user_profiles WHERE role = 'admin'
    ));

CREATE POLICY "Admins can view audit archive"
    ON blog_audit_archive FOR SELECT
    USING (auth.uid() IN (
        SELECT user_id FROM user_profiles WHERE role = 'admin'
    ));

-- Users can view their own audit history
CREATE POLICY "Users can view own audit history"
    ON blog_audit_log FOR SELECT
    USING (user_id = auth.uid());

-- Grant necessary permissions
GRANT SELECT ON blog_audit_log TO authenticated;
GRANT SELECT ON blog_audit_archive TO authenticated;
GRANT EXECUTE ON FUNCTION blog_get_audit_history TO authenticated;
GRANT EXECUTE ON FUNCTION blog_cleanup_old_analytics TO service_role;
GRANT EXECUTE ON FUNCTION blog_archive_old_audit_logs TO service_role;
GRANT EXECUTE ON FUNCTION blog_anonymize_audit_data TO service_role;
GRANT EXECUTE ON FUNCTION blog_restore_from_audit TO authenticated;

-- Add helpful comments
COMMENT ON TABLE blog_audit_log IS 'Audit trail for all blog CMS operations with GDPR compliance';
COMMENT ON TABLE blog_audit_archive IS 'Archive storage for audit logs older than 1 year';
COMMENT ON FUNCTION blog_cleanup_old_analytics IS 'GDPR-compliant cleanup of analytics data older than 90 days';
COMMENT ON FUNCTION blog_archive_old_audit_logs IS 'Archive audit logs older than 1 year for compliance';
COMMENT ON FUNCTION blog_anonymize_audit_data IS 'Anonymize personal data in audit logs after specified days';
COMMENT ON FUNCTION blog_get_audit_history IS 'Retrieve audit history for a specific record';
COMMENT ON FUNCTION blog_restore_from_audit IS 'Get restoration data from audit log entry';