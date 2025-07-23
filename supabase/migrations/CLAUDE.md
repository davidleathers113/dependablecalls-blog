# Database Migrations

# Migration Structure
- Sequential numbered migrations: `20241215000001_initial_schema.sql`
- Descriptive naming convention
- Up and down migration support
- Production-safe migration practices

# Migration Best Practices
```sql
-- Migration: 20241215000001_create_users_table.sql
-- Description: Create users table with role-based access

BEGIN;

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('supplier', 'buyer', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_status ON public.users(status);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

COMMIT;
```

# Core Schema Migrations

## User Management
```sql
-- Migration: 20241215000002_create_user_profiles.sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company TEXT,
  title TEXT,
  bio TEXT,
  website TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'UTC',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint on user_id
ALTER TABLE public.user_profiles ADD CONSTRAINT unique_user_profile UNIQUE (user_id);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage own profile" ON public.user_profiles
  FOR ALL USING (auth.uid() = user_id);

COMMIT;
```

## Campaign Management
```sql
-- Migration: 20241215000003_create_campaigns.sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
  bid_amount DECIMAL(10,2) NOT NULL CHECK (bid_amount > 0),
  daily_budget DECIMAL(10,2),
  monthly_budget DECIMAL(10,2),
  
  -- Targeting configuration
  geo_targeting JSONB DEFAULT '{}',
  time_targeting JSONB DEFAULT '{}',
  device_targeting JSONB DEFAULT '{}',
  filters JSONB DEFAULT '{}',
  
  -- Quality settings
  quality_threshold INTEGER DEFAULT 70 CHECK (quality_threshold BETWEEN 0 AND 100),
  fraud_detection_enabled BOOLEAN DEFAULT true,
  
  -- Timestamps
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_campaigns_buyer_id ON public.campaigns(buyer_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
CREATE INDEX idx_campaigns_created_at ON public.campaigns(created_at);

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Buyers can manage own campaigns" ON public.campaigns
  FOR ALL USING (auth.uid() = buyer_id);

CREATE POLICY "Suppliers can view active campaigns" ON public.campaigns
  FOR SELECT USING (status = 'active' AND start_date <= NOW() AND (end_date IS NULL OR end_date >= NOW()));

COMMIT;
```

## Call Tracking
```sql
-- Migration: 20241215000004_create_calls.sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Call details
  caller_number TEXT NOT NULL,
  duration INTEGER, -- in seconds
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'fraud', 'disputed')),
  
  -- Quality and fraud scoring
  quality_score INTEGER CHECK (quality_score BETWEEN 0 AND 100),
  fraud_score DECIMAL(3,2) CHECK (fraud_score BETWEEN 0 AND 1),
  quality_metrics JSONB DEFAULT '{}',
  fraud_analysis JSONB DEFAULT '{}',
  
  -- Financial
  bid_amount DECIMAL(10,2) NOT NULL,
  payout_amount DECIMAL(10,2) DEFAULT 0,
  payout_status TEXT DEFAULT 'pending' CHECK (payout_status IN ('pending', 'approved', 'paid', 'rejected')),
  
  -- Timestamps
  call_started_at TIMESTAMPTZ,
  call_ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_calls_campaign_id ON public.calls(campaign_id);
CREATE INDEX idx_calls_supplier_id ON public.calls(supplier_id);
CREATE INDEX idx_calls_status ON public.calls(status);
CREATE INDEX idx_calls_created_at ON public.calls(created_at);
CREATE INDEX idx_calls_caller_number ON public.calls(caller_number);

-- Enable RLS
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Suppliers can view own calls" ON public.calls
  FOR SELECT USING (auth.uid() = supplier_id);

CREATE POLICY "Buyers can view campaign calls" ON public.calls
  FOR SELECT USING (
    auth.uid() IN (
      SELECT buyer_id FROM public.campaigns WHERE id = campaign_id
    )
  );

COMMIT;
```

# Financial Migrations
```sql
-- Migration: 20241215000005_create_transactions.sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  call_id UUID REFERENCES public.calls(id) ON DELETE SET NULL,
  
  -- Transaction details
  type TEXT NOT NULL CHECK (type IN ('charge', 'payout', 'refund', 'fee')),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled')),
  
  -- External references
  stripe_payment_intent_id TEXT,
  stripe_transfer_id TEXT,
  
  -- Metadata
  description TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_type ON public.transactions(type);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at);
CREATE INDEX idx_transactions_stripe_payment_intent ON public.transactions(stripe_payment_intent_id);

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

COMMIT;
```

# Audit and Logging
```sql
-- Migration: 20241215000006_create_audit_log.sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Event details
  event_type TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  
  -- Change tracking
  old_values JSONB,
  new_values JSONB,
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_event_type ON public.audit_log(event_type);
CREATE INDEX idx_audit_log_table_name ON public.audit_log(table_name);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at);

-- Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" ON public.audit_log
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM public.users WHERE role = 'admin'
    )
  );

COMMIT;
```

# Trigger Functions
```sql
-- Migration: 20241215000007_create_trigger_functions.sql
BEGIN;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_calls_updated_at
  BEFORE UPDATE ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (event_type, table_name, record_id, old_values)
    VALUES (TG_OP, TG_TABLE_NAME, OLD.id, row_to_json(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (event_type, table_name, record_id, old_values, new_values)
    VALUES (TG_OP, TG_TABLE_NAME, NEW.id, row_to_json(OLD), row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (event_type, table_name, record_id, new_values)
    VALUES (TG_OP, TG_TABLE_NAME, NEW.id, row_to_json(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

COMMIT;
```

# Real-time Subscriptions
```sql
-- Migration: 20241215000008_enable_realtime.sql
BEGIN;

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;

-- Create real-time metrics view
CREATE OR REPLACE VIEW public.real_time_metrics AS
SELECT 
  COUNT(*) FILTER (WHERE status = 'completed' AND DATE(created_at) = CURRENT_DATE) as calls_today,
  COUNT(*) FILTER (WHERE status = 'pending') as active_calls,
  AVG(duration) FILTER (WHERE status = 'completed' AND DATE(created_at) = CURRENT_DATE) as avg_duration_today,
  SUM(payout_amount) FILTER (WHERE status = 'completed' AND DATE(created_at) = CURRENT_DATE) as revenue_today
FROM public.calls;

-- Enable RLS on view
ALTER VIEW public.real_time_metrics ENABLE ROW LEVEL SECURITY;

COMMIT;
```

# Data Seeding
```sql
-- Migration: 20241215000009_seed_initial_data.sql
BEGIN;

-- Insert system admin user (only in development)
INSERT INTO public.users (id, email, first_name, last_name, role)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'admin@dependablecalls.com',
  'System',
  'Administrator',
  'admin'
) ON CONFLICT (email) DO NOTHING;

-- Insert sample fraud detection rules
INSERT INTO public.fraud_rules (name, description, rule_type, configuration, enabled)
VALUES 
  ('Duplicate Caller Detection', 'Flags multiple calls from same number', 'duplicate_caller', '{"time_window": 3600, "max_calls": 3}', true),
  ('Short Call Duration', 'Flags unusually short calls', 'duration_check', '{"min_duration": 30}', true),
  ('Geographic Anomaly', 'Detects calls from unexpected locations', 'geo_validation', '{"strict_mode": false}', true)
ON CONFLICT (name) DO NOTHING;

COMMIT;
```

# Migration Testing
```sql
-- Test migration rollback capability
-- Migration: 20241215000010_test_rollback.sql
BEGIN;

-- Create temporary test table
CREATE TABLE IF NOT EXISTS public.migration_test (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_data TEXT
);

-- Insert test data
INSERT INTO public.migration_test (test_data) VALUES ('migration_test');

-- Verify data exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.migration_test WHERE test_data = 'migration_test') THEN
    RAISE EXCEPTION 'Migration test failed: test data not found';
  END IF;
END $$;

-- Clean up test table
DROP TABLE public.migration_test;

COMMIT;
```

# Performance Optimizations
```sql
-- Migration: 20241215000011_performance_optimizations.sql
BEGIN;

-- Create composite indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calls_campaign_status_created 
  ON public.calls(campaign_id, status, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calls_supplier_payout_status 
  ON public.calls(supplier_id, payout_status, created_at);

-- Partial indexes for active data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_campaigns 
  ON public.campaigns(buyer_id, created_at) 
  WHERE status = 'active';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pending_calls 
  ON public.calls(created_at) 
  WHERE status = 'pending';

-- Create materialized view for dashboard metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS public.dashboard_metrics AS
SELECT 
  u.id as user_id,
  u.role,
  COUNT(c.id) as total_calls,
  COUNT(c.id) FILTER (WHERE c.status = 'completed') as completed_calls,
  SUM(c.payout_amount) as total_earnings,
  AVG(c.quality_score) as avg_quality_score
FROM public.users u
LEFT JOIN public.calls c ON (u.role = 'supplier' AND c.supplier_id = u.id) 
                        OR (u.role = 'buyer' AND c.campaign_id IN (SELECT id FROM public.campaigns WHERE buyer_id = u.id))
GROUP BY u.id, u.role;

-- Create unique index for materialized view
CREATE UNIQUE INDEX ON public.dashboard_metrics(user_id);

-- Refresh materialized view function
CREATE OR REPLACE FUNCTION public.refresh_dashboard_metrics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.dashboard_metrics;
END;
$$ LANGUAGE plpgsql;

COMMIT;
```

# Migration Deployment
```bash
#!/bin/bash
# deploy-migrations.sh

set -e

echo "Deploying database migrations..."

# Run migrations
supabase db push

# Verify migration status
supabase migration list

# Run post-migration tests
psql $DATABASE_URL -f tests/migration_tests.sql

echo "Migrations deployed successfully!"
```

# CRITICAL RULES
- NO regex in SQL migrations
- NO direct user data in migrations (use seeds)
- ALWAYS use transactions (BEGIN/COMMIT)
- ALWAYS create indexes CONCURRENTLY in production
- ALWAYS test migrations in staging first
- IMPLEMENT proper RLS policies
- VALIDATE data integrity after migrations
- MAINTAIN backward compatibility
- DOCUMENT all schema changes
- BACKUP before major migrations