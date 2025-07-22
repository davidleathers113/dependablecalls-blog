# Supabase Database Patterns

# Migration Structure
```
supabase/
├── migrations/           # SQL migration files
├── config.toml          # Local dev configuration
├── functions/           # Edge functions
└── seed.sql            # Development seed data
```

# Migration File Naming
- `001_initial_schema.sql` - Core database schema
- `002_security_policies.sql` - Row Level Security (RLS)
- `003_functions.sql` - Database functions and triggers
- `004_feature_specific.sql` - Feature additions

# Migration Best Practices
```sql
-- Always check if objects exist before creating
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Use proper foreign key constraints
ALTER TABLE campaigns
ADD CONSTRAINT fk_campaigns_buyer_id 
FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_calls_campaign_id ON calls(campaign_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
```

# Row Level Security (RLS) Patterns
```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- User can only access their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- Role-based access for campaigns
CREATE POLICY "Buyers can manage their campaigns" ON campaigns
  FOR ALL USING (
    auth.uid() = buyer_id AND 
    (SELECT role FROM users WHERE id = auth.uid()) = 'buyer'
  );

-- Suppliers can view active campaigns
CREATE POLICY "Suppliers can view active campaigns" ON campaigns
  FOR SELECT USING (
    status = 'active' AND
    (SELECT role FROM users WHERE id = auth.uid()) = 'supplier'
  );
```

# Database Functions
```sql
-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating timestamps
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

# Real-time Subscriptions Setup
```sql
-- Enable real-time for specific tables
ALTER PUBLICATION supabase_realtime 
ADD TABLE calls, campaigns, users;

-- Create real-time policies
CREATE POLICY "Real-time calls for campaign owners" ON calls
  FOR SELECT USING (
    campaign_id IN (
      SELECT id FROM campaigns 
      WHERE buyer_id = auth.uid()
    )
  );
```

# DCE-Specific Schema Patterns

## Users Table
```sql
CREATE TABLE users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'supplier',
  profile JSONB DEFAULT '{}',
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE user_role AS ENUM ('supplier', 'buyer', 'admin');
```

## Campaigns Table
```sql
CREATE TABLE campaigns (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  vertical campaign_vertical NOT NULL,
  status campaign_status DEFAULT 'draft',
  target_cpa DECIMAL(10,2),
  daily_budget DECIMAL(10,2),
  filters JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'paused', 'completed');
CREATE TYPE campaign_vertical AS ENUM ('insurance', 'home_services', 'legal', 'medical');
```

## Calls Table
```sql
CREATE TABLE calls (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tracking_number TEXT UNIQUE NOT NULL,
  caller_number TEXT,
  duration INTEGER DEFAULT 0,
  status call_status DEFAULT 'pending',
  quality_score INTEGER CHECK (quality_score >= 1 AND quality_score <= 10),
  payout_amount DECIMAL(10,2),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE call_status AS ENUM ('pending', 'active', 'completed', 'failed', 'fraud');
```

# Edge Functions Structure
```typescript
// supabase/functions/webhook-stripe/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get('stripe-signature')!;
    const body = await req.text();
    
    // Verify webhook signature
    // Process webhook data
    
    return new Response(
      JSON.stringify({ received: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});
```

# Local Development Setup
```toml
# config.toml
[api]
port = 54321
schemas = ["public", "auth", "storage", "realtime"]
extra_search_path = ["public", "extensions"]

[db]
port = 54322
major_version = 15

[studio]
port = 54323

[auth]
enable_signup = true
```

# Data Seeding
```sql
-- seed.sql
INSERT INTO users (id, email, role, is_verified) VALUES
  ('11111111-1111-1111-1111-111111111111', 'supplier@test.com', 'supplier', true),
  ('22222222-2222-2222-2222-222222222222', 'buyer@test.com', 'buyer', true);

INSERT INTO campaigns (buyer_id, name, vertical, status, target_cpa, daily_budget) VALUES
  ('22222222-2222-2222-2222-222222222222', 'Test Insurance Campaign', 'insurance', 'active', 50.00, 1000.00);
```

# Performance Optimization
```sql
-- Indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calls_created_at ON calls(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_buyer_id_status ON campaigns(buyer_id, status);

-- Partial indexes for active records
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_calls 
ON calls(campaign_id, created_at) WHERE status = 'active';
```

# Backup and Migrations
```bash
# Create migration
supabase migration new feature_name

# Apply migrations
supabase db push

# Reset local database
supabase db reset

# Generate TypeScript types
supabase gen types typescript --local > src/types/database.ts
```

# Testing Database
```sql
-- Create test-specific data
BEGIN;
  -- Insert test data
  INSERT INTO users ...;
  -- Run tests
ROLLBACK; -- Cleanup
```

# CRITICAL RULES
- NO regex in SQL queries or functions
- ALWAYS use RLS policies for data security
- ALWAYS create proper indexes for performance
- NEVER store sensitive data in JSONB fields
- ALWAYS use transactions for multi-table operations
- ENABLE real-time only for necessary tables
- TEST all migrations before deploying
- USE proper foreign key constraints
- IMPLEMENT audit trails for sensitive operations
- VALIDATE all user inputs at database level