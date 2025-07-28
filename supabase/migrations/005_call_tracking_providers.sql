-- Migration: Add call tracking provider integration support
-- This migration adds support for external call tracking providers (Retreaver, TrackDrive, Ringba)

-- Add provider tracking columns to existing calls table
ALTER TABLE calls 
ADD COLUMN provider VARCHAR(50),
ADD COLUMN external_id VARCHAR(255),
ADD COLUMN provider_data JSONB DEFAULT '{}',
ADD COLUMN last_synced_at TIMESTAMPTZ;

-- Create provider configuration table
CREATE TABLE provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_type VARCHAR(50) NOT NULL CHECK (provider_type IN ('retreaver', 'trackdrive', 'ringba')),
  name VARCHAR(255) NOT NULL,
  credentials JSONB NOT NULL,
  settings JSONB DEFAULT '{}',
  features JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  webhook_url VARCHAR(500),
  api_base_url VARCHAR(500),
  rate_limits JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider_type, name)
);

-- Create webhook log table for auditing and debugging
CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,
  event_type VARCHAR(100),
  payload JSONB,
  signature VARCHAR(500),
  processed BOOLEAN DEFAULT false,
  processing_attempts INTEGER DEFAULT 0,
  error TEXT,
  response_status INTEGER,
  processing_duration INTEGER, -- milliseconds
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
  -- Foreign key constraint removed since provider_type is not unique
);

-- Create sync status table for monitoring data synchronization
CREATE TABLE sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,
  sync_type VARCHAR(50) NOT NULL CHECK (sync_type IN ('initial', 'incremental', 'webhook', 'manual')),
  last_sync_at TIMESTAMPTZ,
  last_successful_sync_at TIMESTAMPTZ,
  records_synced INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  error_details TEXT,
  sync_duration INTEGER, -- milliseconds
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
  -- Foreign key constraint removed since provider_type is not unique
);

-- Create tracking numbers table for provider number management
CREATE TABLE provider_tracking_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,
  number VARCHAR(20) NOT NULL,
  external_id VARCHAR(255), -- Provider's ID for this number
  campaign_id UUID REFERENCES campaigns(id),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'released')),
  capabilities JSONB DEFAULT '{}', -- SMS, voice, etc.
  provisioned_at TIMESTAMPTZ DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Foreign key constraint removed since provider_type is not unique
  UNIQUE(provider, number)
);

-- Add indexes for performance
-- Calls table indexes
CREATE INDEX idx_calls_provider ON calls(provider);
CREATE INDEX idx_calls_external_id ON calls(external_id);
CREATE INDEX idx_calls_provider_external_id ON calls(provider, external_id);
CREATE INDEX idx_calls_provider_updated_at ON calls(provider, updated_at);
CREATE INDEX idx_calls_last_synced_at ON calls(last_synced_at);

-- Webhook logs indexes
CREATE INDEX idx_webhook_logs_provider ON webhook_logs(provider);
CREATE INDEX idx_webhook_logs_created_at ON webhook_logs(created_at);
CREATE INDEX idx_webhook_logs_processed ON webhook_logs(processed);
CREATE INDEX idx_webhook_logs_provider_created_at ON webhook_logs(provider, created_at);

-- Sync status indexes
CREATE INDEX idx_sync_status_provider ON sync_status(provider);
CREATE INDEX idx_sync_status_provider_type ON sync_status(provider, sync_type);
CREATE INDEX idx_sync_status_updated_at ON sync_status(updated_at);

-- Tracking numbers indexes
CREATE INDEX idx_tracking_numbers_provider ON provider_tracking_numbers(provider);
CREATE INDEX idx_tracking_numbers_campaign ON provider_tracking_numbers(campaign_id);
CREATE INDEX idx_tracking_numbers_status ON provider_tracking_numbers(status);

-- Create function to update sync status
CREATE OR REPLACE FUNCTION update_sync_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for sync status updates
CREATE TRIGGER sync_status_updated_at_trigger
  BEFORE UPDATE ON sync_status
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_status();

-- Create function to log provider data changes
CREATE OR REPLACE FUNCTION log_provider_data_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Log significant changes to provider data
  IF TG_OP = 'UPDATE' AND (
    OLD.provider_data IS DISTINCT FROM NEW.provider_data OR
    OLD.external_id IS DISTINCT FROM NEW.external_id OR
    OLD.provider IS DISTINCT FROM NEW.provider
  ) THEN
    INSERT INTO webhook_logs (
      provider,
      event_type,
      payload,
      processed,
      created_at
    ) VALUES (
      COALESCE(NEW.provider, OLD.provider),
      'data_change',
      jsonb_build_object(
        'call_id', NEW.id,
        'old_data', OLD.provider_data,
        'new_data', NEW.provider_data,
        'change_type', 'update'
      ),
      true,
      NOW()
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for provider data change logging
CREATE TRIGGER calls_provider_data_change_trigger
  AFTER UPDATE ON calls
  FOR EACH ROW
  EXECUTE FUNCTION log_provider_data_change();

-- Insert default provider configurations (disabled by default)
INSERT INTO provider_configs (provider_type, name, credentials, settings, features, is_active) VALUES
('retreaver', 'Retreaver Default', 
  '{"type": "api_key", "encrypted": true}',
  '{"sync_interval": 300000, "batch_size": 100}',
  '{"webhooks": true, "realtime": true, "number_provisioning": true, "recording": true}',
  false
),
('trackdrive', 'TrackDrive Default',
  '{"type": "basic", "encrypted": true}',
  '{"sync_interval": 600000, "batch_size": 50}',
  '{"webhooks": true, "realtime": false, "number_provisioning": true, "recording": true}',
  false
),
('ringba', 'Ringba Default',
  '{"type": "oauth", "encrypted": true}',
  '{"sync_interval": 300000, "batch_size": 100}',
  '{"webhooks": true, "realtime": true, "number_provisioning": true, "recording": true}',
  false
);

-- Add RLS (Row Level Security) policies
ALTER TABLE provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_tracking_numbers ENABLE ROW LEVEL SECURITY;

-- Admin access policies
CREATE POLICY "Admins can manage provider configs" ON provider_configs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.metadata->>'role' = 'admin'
    )
  );

CREATE POLICY "Admins can view webhook logs" ON webhook_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.metadata->>'role' = 'admin'
    )
  );

CREATE POLICY "Admins can view sync status" ON sync_status
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.metadata->>'role' = 'admin'
    )
  );

-- Provider tracking numbers policies
CREATE POLICY "Users can view their tracking numbers" ON provider_tracking_numbers
  FOR SELECT USING (
    campaign_id IN (
      SELECT campaigns.id FROM campaigns
      INNER JOIN suppliers ON campaigns.supplier_id = suppliers.id
      WHERE suppliers.user_id = auth.uid()
      UNION
      SELECT buyer_campaigns.id FROM buyer_campaigns
      INNER JOIN buyers ON buyer_campaigns.buyer_id = buyers.id
      WHERE buyers.user_id = auth.uid()
    )
  );

-- Add comments for documentation
COMMENT ON TABLE provider_configs IS 'Configuration for external call tracking providers';
COMMENT ON TABLE webhook_logs IS 'Audit log for all webhook events from call tracking providers';
COMMENT ON TABLE sync_status IS 'Status tracking for data synchronization with providers';
COMMENT ON TABLE provider_tracking_numbers IS 'Tracking numbers provisioned from external providers';

COMMENT ON COLUMN calls.provider IS 'External call tracking provider (retreaver, trackdrive, ringba)';
COMMENT ON COLUMN calls.external_id IS 'Provider-specific call identifier';
COMMENT ON COLUMN calls.provider_data IS 'Raw data from the provider for debugging and feature access';
COMMENT ON COLUMN calls.last_synced_at IS 'Timestamp of last successful data sync with provider';