-- Settings Audit Log Table
-- Tracks all changes to user and role-specific settings
CREATE TABLE IF NOT EXISTS settings_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  setting_type TEXT NOT NULL CHECK (setting_type IN ('user', 'supplier', 'buyer', 'network', 'admin')),
  setting_key TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_settings_audit_user_id ON settings_audit_log(user_id);
CREATE INDEX idx_settings_audit_created_at ON settings_audit_log(created_at DESC);
CREATE INDEX idx_settings_audit_setting_type ON settings_audit_log(setting_type);

-- Settings Templates Table
-- Pre-defined settings configurations that can be applied
CREATE TABLE IF NOT EXISTS settings_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  user_type TEXT NOT NULL CHECK (user_type IN ('supplier', 'buyer', 'network', 'admin', 'all')),
  category TEXT,
  settings JSONB NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, user_type)
);

-- Add indexes
CREATE INDEX idx_settings_templates_user_type ON settings_templates(user_type);
CREATE INDEX idx_settings_templates_is_default ON settings_templates(is_default) WHERE is_default = TRUE;
CREATE INDEX idx_settings_templates_is_active ON settings_templates(is_active) WHERE is_active = TRUE;

-- Add version tracking columns to existing tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS settings_version INTEGER DEFAULT 1;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS settings_updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS settings_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create network table if it doesn't exist
CREATE TABLE IF NOT EXISTS networks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  business_type TEXT,
  tax_id TEXT,
  website_url TEXT,
  verification_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'banned')),
  settings JSONB DEFAULT '{}',
  settings_updated_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add settings_updated_at to networks if the table already exists
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'networks') THEN
    ALTER TABLE networks ADD COLUMN IF NOT EXISTS settings_updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Avatar storage bucket creation (handled by Supabase dashboard, but documented here)
-- CREATE STORAGE BUCKET avatars;

-- Function to update settings_updated_at timestamp
CREATE OR REPLACE FUNCTION update_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.settings_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to update settings_updated_at
CREATE TRIGGER update_suppliers_settings_timestamp
  BEFORE UPDATE OF settings ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_settings_timestamp();

CREATE TRIGGER update_buyers_settings_timestamp
  BEFORE UPDATE OF settings ON buyers
  FOR EACH ROW
  EXECUTE FUNCTION update_settings_timestamp();

CREATE TRIGGER update_networks_settings_timestamp
  BEFORE UPDATE OF settings ON networks
  FOR EACH ROW
  EXECUTE FUNCTION update_settings_timestamp();

-- Function to log settings changes
CREATE OR REPLACE FUNCTION log_settings_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_setting_type TEXT;
  v_old_value JSONB;
  v_new_value JSONB;
BEGIN
  -- Determine user_id and setting_type based on table
  CASE TG_TABLE_NAME
    WHEN 'users' THEN
      v_user_id := NEW.id;
      v_setting_type := 'user';
      v_old_value := OLD.metadata;
      v_new_value := NEW.metadata;
    WHEN 'suppliers' THEN
      v_user_id := NEW.user_id;
      v_setting_type := 'supplier';
      v_old_value := OLD.settings;
      v_new_value := NEW.settings;
    WHEN 'buyers' THEN
      v_user_id := NEW.user_id;
      v_setting_type := 'buyer';
      v_old_value := OLD.settings;
      v_new_value := NEW.settings;
    WHEN 'networks' THEN
      v_user_id := NEW.user_id;
      v_setting_type := 'network';
      v_old_value := OLD.settings;
      v_new_value := NEW.settings;
    WHEN 'admins' THEN
      v_user_id := NEW.user_id;
      v_setting_type := 'admin';
      v_old_value := OLD.metadata;
      v_new_value := NEW.metadata;
  END CASE;

  -- Only log if there's an actual change
  IF v_old_value IS DISTINCT FROM v_new_value THEN
    INSERT INTO settings_audit_log (
      user_id,
      setting_type,
      setting_key,
      old_value,
      new_value,
      action,
      metadata
    ) VALUES (
      v_user_id,
      v_setting_type,
      TG_TABLE_NAME || '.settings',
      v_old_value,
      v_new_value,
      CASE WHEN TG_OP = 'INSERT' THEN 'create' ELSE 'update' END,
      jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for audit logging
CREATE TRIGGER log_users_settings_change
  AFTER INSERT OR UPDATE OF metadata ON users
  FOR EACH ROW
  EXECUTE FUNCTION log_settings_change();

CREATE TRIGGER log_suppliers_settings_change
  AFTER INSERT OR UPDATE OF settings ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION log_settings_change();

CREATE TRIGGER log_buyers_settings_change
  AFTER INSERT OR UPDATE OF settings ON buyers
  FOR EACH ROW
  EXECUTE FUNCTION log_settings_change();

CREATE TRIGGER log_networks_settings_change
  AFTER INSERT OR UPDATE OF settings ON networks
  FOR EACH ROW
  EXECUTE FUNCTION log_settings_change();

-- RLS Policies for settings_audit_log
ALTER TABLE settings_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can only view their own audit logs
CREATE POLICY "Users can view own settings audit logs" ON settings_audit_log
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all audit logs
CREATE POLICY "Admins can view all settings audit logs" ON settings_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.user_id = auth.uid() 
      AND admins.is_active = true
    )
  );

-- RLS Policies for settings_templates
ALTER TABLE settings_templates ENABLE ROW LEVEL SECURITY;

-- Anyone can view active templates for their user type
CREATE POLICY "Users can view applicable templates" ON settings_templates
  FOR SELECT USING (
    is_active = true AND (
      user_type = 'all' OR
      user_type = (
        CASE 
          WHEN EXISTS (SELECT 1 FROM suppliers WHERE user_id = auth.uid()) THEN 'supplier'
          WHEN EXISTS (SELECT 1 FROM buyers WHERE user_id = auth.uid()) THEN 'buyer'
          WHEN EXISTS (SELECT 1 FROM networks WHERE user_id = auth.uid()) THEN 'network'
          WHEN EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid() AND is_active = true) THEN 'admin'
        END
      )
    )
  );

-- Only admins can create/update/delete templates
CREATE POLICY "Admins can manage templates" ON settings_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.user_id = auth.uid() 
      AND admins.is_active = true
    )
  );

-- Insert default settings templates
INSERT INTO settings_templates (name, description, user_type, category, settings, is_default) VALUES
  -- Supplier templates
  ('Basic Supplier', 'Default settings for new suppliers', 'supplier', 'starter', '{
    "callTracking": {
      "recordCalls": true,
      "transcribeCalls": false,
      "dataRetentionDays": 90
    },
    "quality": {
      "minimumCallDuration": 30,
      "maximumCallDuration": 1800,
      "autoRejectThreshold": 50
    },
    "payouts": {
      "preferredMethod": "bank_transfer",
      "minimumPayout": 100,
      "payoutSchedule": "weekly"
    }
  }'::jsonb, true),
  
  ('Premium Supplier', 'Advanced settings for high-volume suppliers', 'supplier', 'advanced', '{
    "callTracking": {
      "recordCalls": true,
      "transcribeCalls": true,
      "dataRetentionDays": 365,
      "webhookUrl": ""
    },
    "quality": {
      "minimumCallDuration": 45,
      "maximumCallDuration": 3600,
      "autoRejectThreshold": 70,
      "scriptCompliance": true
    },
    "payouts": {
      "preferredMethod": "wire",
      "minimumPayout": 500,
      "payoutSchedule": "daily"
    },
    "automation": {
      "autoAcceptCampaigns": true,
      "autoOptimization": true,
      "pauseOnQualityDrop": true
    }
  }'::jsonb, false),
  
  -- Buyer templates
  ('Basic Buyer', 'Default settings for new buyers', 'buyer', 'starter', '{
    "campaigns": {
      "defaultBudget": {
        "dailyBudget": 500,
        "alertPercentage": 80
      },
      "defaultQuality": {
        "minDuration": 60,
        "maxDuration": 1800,
        "minQualityScore": 70
      }
    },
    "billing": {
      "paymentMethod": "credit_card",
      "autoRecharge": {
        "enabled": false,
        "threshold": 100,
        "amount": 500
      }
    }
  }'::jsonb, true),
  
  ('Enterprise Buyer', 'Settings for enterprise buyers with compliance needs', 'buyer', 'enterprise', '{
    "campaigns": {
      "defaultBudget": {
        "dailyBudget": 5000,
        "monthlyBudget": 100000,
        "alertPercentage": 90
      },
      "approvalWorkflow": {
        "required": true,
        "threshold": 10000,
        "autoApprove": false
      }
    },
    "billing": {
      "paymentMethod": "invoice",
      "creditLimit": 50000,
      "approvalRequired": {
        "threshold": 25000
      }
    },
    "compliance": {
      "tcpaCompliance": true,
      "dncScrubbing": true,
      "consentRequired": true,
      "recordingConsent": true,
      "dataRetention": {
        "callRecordings": 365,
        "callData": 730,
        "reports": 1095
      }
    }
  }'::jsonb, false);

-- Add comments for documentation
COMMENT ON TABLE settings_audit_log IS 'Audit log for all settings changes across the platform';
COMMENT ON TABLE settings_templates IS 'Pre-defined settings templates for different user types';
COMMENT ON COLUMN settings_audit_log.setting_type IS 'Type of settings: user, supplier, buyer, network, or admin';
COMMENT ON COLUMN settings_templates.user_type IS 'User type the template applies to, or "all" for universal templates';