-- Multi-Factor Authentication System Migration
-- Creates tables for TOTP secrets, trusted devices, backup codes, SMS verification, and audit logs

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- MFA secrets table (encrypted TOTP secrets)
CREATE TABLE IF NOT EXISTS mfa_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    secret_encrypted TEXT NOT NULL, -- Base32 TOTP secret, encrypted with application key
    backup_codes_encrypted TEXT[] NOT NULL DEFAULT '{}', -- Encrypted backup codes
    is_active BOOLEAN NOT NULL DEFAULT false,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure one active MFA secret per user
CREATE UNIQUE INDEX unique_active_mfa_per_user ON mfa_secrets(user_id) WHERE is_active = true;

-- MFA trusted devices table
CREATE TABLE IF NOT EXISTS mfa_trusted_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_fingerprint TEXT NOT NULL, -- Hash of browser/device characteristics
    device_name TEXT NOT NULL, -- User-friendly name
    trusted_until TIMESTAMPTZ NOT NULL, -- Expiration timestamp
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET NOT NULL,
    user_agent TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Prevent duplicate device fingerprints per user
    CONSTRAINT unique_device_per_user UNIQUE (user_id, device_fingerprint)
);

-- MFA backup codes table
CREATE TABLE IF NOT EXISTS mfa_backup_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL, -- Hashed backup code for verification
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookup of unused backup codes
CREATE INDEX idx_mfa_backup_codes_user_unused ON mfa_backup_codes(user_id) WHERE used_at IS NULL;

-- SMS verification table for backup authentication
CREATE TABLE IF NOT EXISTS mfa_sms_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number_encrypted TEXT NOT NULL, -- Encrypted phone number
    verification_code_hash TEXT NOT NULL, -- Hashed 6-digit code
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for cleanup of expired codes
CREATE INDEX idx_mfa_sms_expires_at ON mfa_sms_verifications(expires_at);

-- MFA user settings and preferences
CREATE TABLE IF NOT EXISTS mfa_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    totp_enabled BOOLEAN NOT NULL DEFAULT false,
    sms_backup_enabled BOOLEAN NOT NULL DEFAULT false,
    backup_codes_generated BOOLEAN NOT NULL DEFAULT false,
    require_mfa BOOLEAN NOT NULL DEFAULT false, -- Role-based requirement
    trusted_devices_enabled BOOLEAN NOT NULL DEFAULT true,
    sms_rate_limit_count INTEGER NOT NULL DEFAULT 0,
    sms_rate_limit_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_backup_codes_viewed TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- MFA attempt logs for security monitoring
CREATE TABLE IF NOT EXISTS mfa_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    method TEXT NOT NULL CHECK (method IN ('totp', 'sms', 'backup_code')),
    success BOOLEAN NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT NOT NULL,
    error_code TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for security analysis
CREATE INDEX idx_mfa_attempts_user_time ON mfa_attempts(user_id, created_at DESC);
CREATE INDEX idx_mfa_attempts_ip_time ON mfa_attempts(ip_address, created_at DESC);
CREATE INDEX idx_mfa_attempts_failed ON mfa_attempts(created_at DESC) WHERE success = false;

-- MFA audit logs for comprehensive security tracking
CREATE TABLE IF NOT EXISTS mfa_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('setup', 'verify', 'disable', 'backup_code_used', 'device_trusted', 'rate_limited')),
    method TEXT CHECK (method IN ('totp', 'sms', 'backup_code', 'device_trust')),
    success BOOLEAN NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for audit analysis
CREATE INDEX idx_mfa_audit_user_time ON mfa_audit_logs(user_id, created_at DESC);
CREATE INDEX idx_mfa_audit_action_time ON mfa_audit_logs(action, created_at DESC);
CREATE INDEX idx_mfa_audit_risk_score ON mfa_audit_logs(risk_score DESC, created_at DESC);

-- Add updated_at trigger for tables that need it
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_mfa_secrets_updated_at
    BEFORE UPDATE ON mfa_secrets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mfa_settings_updated_at
    BEFORE UPDATE ON mfa_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies

-- Enable RLS on all MFA tables
ALTER TABLE mfa_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_trusted_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_backup_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_sms_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can only access their own MFA data
CREATE POLICY "Users can manage their own MFA secrets" ON mfa_secrets
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own trusted devices" ON mfa_trusted_devices
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can access their own backup codes" ON mfa_backup_codes
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can access their own SMS verifications" ON mfa_sms_verifications
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own MFA settings" ON mfa_settings
    FOR ALL USING (auth.uid() = user_id);

-- Attempts and audit logs: users can read their own, but inserts are service-only
CREATE POLICY "Users can view their own MFA attempts" ON mfa_attempts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can insert MFA attempts" ON mfa_attempts
    FOR INSERT WITH CHECK (true); -- Service role will handle this

CREATE POLICY "Users can view their own audit logs" ON mfa_audit_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can insert audit logs" ON mfa_audit_logs
    FOR INSERT WITH CHECK (true); -- Service role will handle this

-- Admin policies for monitoring and support
CREATE POLICY "Admins can view all MFA audit logs" ON mfa_audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admins 
            WHERE user_id = auth.uid() 
            AND is_active = true
        )
    );

CREATE POLICY "Admins can view MFA attempts for monitoring" ON mfa_attempts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admins 
            WHERE user_id = auth.uid() 
            AND is_active = true
        )
    );

-- Helper functions

-- Function to check if MFA is required for a user based on their role
CREATE OR REPLACE FUNCTION is_mfa_required_for_user(target_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    is_required BOOLEAN := false;
BEGIN
    -- Check if user is an admin (MFA required)
    IF EXISTS (SELECT 1 FROM admins WHERE user_id = target_user_id AND is_active = true) THEN
        RETURN true;
    END IF;
    
    -- Check if user is a buyer (MFA required)
    IF EXISTS (SELECT 1 FROM buyers WHERE user_id = target_user_id AND status = 'active') THEN
        RETURN true;
    END IF;
    
    -- Suppliers have optional MFA by default
    IF EXISTS (SELECT 1 FROM suppliers WHERE user_id = target_user_id AND status = 'active') THEN
        RETURN false;
    END IF;
    
    -- Default to not required for unknown roles
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired data
CREATE OR REPLACE FUNCTION cleanup_expired_mfa_data()
RETURNS void AS $$
BEGIN
    -- Clean up expired SMS verifications (older than 24 hours)
    DELETE FROM mfa_sms_verifications 
    WHERE expires_at < NOW() - INTERVAL '24 hours';
    
    -- Clean up expired trusted devices
    DELETE FROM mfa_trusted_devices 
    WHERE trusted_until < NOW();
    
    -- Clean up old MFA attempts (older than 90 days)
    DELETE FROM mfa_attempts 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    -- Clean up old audit logs (older than 1 year, except high risk)
    DELETE FROM mfa_audit_logs 
    WHERE created_at < NOW() - INTERVAL '1 year' 
    AND risk_score < 70;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to run cleanup (if pg_cron is available)
-- This would be configured separately in the Supabase dashboard

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON mfa_secrets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON mfa_trusted_devices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON mfa_backup_codes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON mfa_sms_verifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON mfa_settings TO authenticated;
GRANT SELECT, INSERT ON mfa_attempts TO authenticated;
GRANT SELECT, INSERT ON mfa_audit_logs TO authenticated;

-- Grant permissions to service role for administrative operations
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Comments for documentation
COMMENT ON TABLE mfa_secrets IS 'Stores encrypted TOTP secrets and backup codes for users';
COMMENT ON TABLE mfa_trusted_devices IS 'Tracks trusted devices that can bypass MFA for a limited time';
COMMENT ON TABLE mfa_backup_codes IS 'Single-use backup codes for account recovery';
COMMENT ON TABLE mfa_sms_verifications IS 'SMS verification codes for backup authentication';
COMMENT ON TABLE mfa_settings IS 'User MFA preferences and configuration';
COMMENT ON TABLE mfa_attempts IS 'Log of all MFA verification attempts for security monitoring';
COMMENT ON TABLE mfa_audit_logs IS 'Comprehensive audit trail of all MFA-related actions';

COMMENT ON FUNCTION is_mfa_required_for_user(UUID) IS 'Determines if MFA is required based on user role';
COMMENT ON FUNCTION cleanup_expired_mfa_data() IS 'Cleans up expired MFA data to maintain database performance';