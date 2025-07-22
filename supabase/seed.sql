-- DCE Platform Development Seed Data
-- Test data for local development and testing

-- Insert test users (these will need to be created via Supabase Auth first)
-- The UUIDs below are examples - replace with actual auth.users IDs after signup

-- Insert admin user profile
INSERT INTO users (id, email, first_name, last_name, status, is_active) VALUES
('00000000-0000-0000-0000-000000000001', 'admin@dce-platform.com', 'Admin', 'User', 'active', true)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  status = EXCLUDED.status,
  is_active = EXCLUDED.is_active;

-- Insert test admin record
INSERT INTO admins (user_id, role, permissions, is_active) VALUES
('00000000-0000-0000-0000-000000000001', 'super_admin', '{"super_admin": true, "user_management": true, "financial_management": true}', true)
ON CONFLICT (user_id) DO UPDATE SET
  role = EXCLUDED.role,
  permissions = EXCLUDED.permissions,
  is_active = EXCLUDED.is_active;

-- Insert test supplier user
INSERT INTO users (id, email, first_name, last_name, status, is_active) VALUES
('11111111-1111-1111-1111-111111111111', 'supplier@test.com', 'Test', 'Supplier', 'active', true)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  status = EXCLUDED.status,
  is_active = EXCLUDED.is_active;

-- Insert test supplier record
INSERT INTO suppliers (user_id, company_name, business_type, credit_balance, status, approved_at, approved_by) VALUES
('11111111-1111-1111-1111-111111111111', 'Test Traffic Co', 'Lead Generation', 1500.00, 'active', NOW(), (SELECT id FROM admins WHERE role = 'super_admin' LIMIT 1))
ON CONFLICT (user_id) DO UPDATE SET
  company_name = EXCLUDED.company_name,
  business_type = EXCLUDED.business_type,
  credit_balance = EXCLUDED.credit_balance,
  status = EXCLUDED.status;

-- Insert test buyer users
INSERT INTO users (id, email, first_name, last_name, status, is_active) VALUES
('22222222-2222-2222-2222-222222222222', 'buyer@test.com', 'Test', 'Buyer', 'active', true),
('33333333-3333-3333-3333-333333333333', 'buyer2@test.com', 'Premium', 'Buyer', 'active', true)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  status = EXCLUDED.status,
  is_active = EXCLUDED.is_active;

-- Insert test buyer records
INSERT INTO buyers (user_id, company_name, business_type, credit_limit, current_balance, status, approved_at, approved_by) VALUES
('22222222-2222-2222-2222-222222222222', 'Insurance Plus LLC', 'Insurance', 10000.00, 8500.00, 'active', NOW(), (SELECT id FROM admins WHERE role = 'super_admin' LIMIT 1)),
('33333333-3333-3333-3333-333333333333', 'Premium Legal Services', 'Legal Services', 25000.00, 22000.00, 'active', NOW(), (SELECT id FROM admins WHERE role = 'super_admin' LIMIT 1))
ON CONFLICT (user_id) DO UPDATE SET
  company_name = EXCLUDED.company_name,
  business_type = EXCLUDED.business_type,
  credit_limit = EXCLUDED.credit_limit,
  current_balance = EXCLUDED.current_balance,
  status = EXCLUDED.status;

-- Insert test campaigns
INSERT INTO campaigns (
  id, supplier_id, name, description, category, vertical, 
  targeting, bid_floor, max_concurrent_calls, status,
  quality_threshold, recording_enabled
) VALUES
(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  (SELECT id FROM suppliers WHERE user_id = '11111111-1111-1111-1111-111111111111'),
  'Auto Insurance Leads - Florida',
  'High-quality auto insurance leads from Florida residents',
  'Insurance',
  'Auto Insurance',
  '{"geographic": {"states": ["FL"], "cities": ["Miami", "Orlando", "Tampa"]}, "demographic": {"age_range": "25-65", "income_level": "middle"}, "schedule": {"enabled": true, "timezone": "EST", "hours": {"monday": {"start": 9, "end": 18}, "tuesday": {"start": 9, "end": 18}, "wednesday": {"start": 9, "end": 18}, "thursday": {"start": 9, "end": 18}, "friday": {"start": 9, "end": 18}}}}',
  15.00,
  5,
  'active',
  75,
  true
),
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  (SELECT id FROM suppliers WHERE user_id = '11111111-1111-1111-1111-111111111111'),
  'Personal Injury Legal Leads',
  'Qualified personal injury leads for law firms',
  'Legal',
  'Personal Injury',
  '{"geographic": {"states": ["CA", "NY", "TX"], "metro_areas": ["Los Angeles", "New York", "Houston"]}, "demographic": {"age_range": "18-75"}, "schedule": {"enabled": true, "timezone": "PST", "hours": {"monday": {"start": 8, "end": 20}, "tuesday": {"start": 8, "end": 20}, "wednesday": {"start": 8, "end": 20}, "thursday": {"start": 8, "end": 20}, "friday": {"start": 8, "end": 20}}}}',
  85.00,
  10,
  'active',
  80,
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  vertical = EXCLUDED.vertical,
  targeting = EXCLUDED.targeting,
  bid_floor = EXCLUDED.bid_floor,
  status = EXCLUDED.status;

-- Insert tracking numbers for campaigns
INSERT INTO tracking_numbers (campaign_id, number, display_number, area_code, is_active) VALUES
((SELECT id FROM campaigns WHERE name = 'Auto Insurance Leads - Florida'), '8005551234', '(800) 555-1234', '800', true),
((SELECT id FROM campaigns WHERE name = 'Auto Insurance Leads - Florida'), '8005551235', '(800) 555-1235', '800', true),
((SELECT id FROM campaigns WHERE name = 'Personal Injury Legal Leads'), '8005556789', '(800) 555-6789', '800', true),
((SELECT id FROM campaigns WHERE name = 'Personal Injury Legal Leads'), '8005556790', '(800) 555-6790', '800', true)
ON CONFLICT (number) DO UPDATE SET
  display_number = EXCLUDED.display_number,
  area_code = EXCLUDED.area_code,
  is_active = EXCLUDED.is_active;

-- Insert test buyer campaigns
INSERT INTO buyer_campaigns (
  id, buyer_id, name, description, targeting_criteria, 
  max_bid, daily_budget, monthly_budget, status,
  quality_requirements, auto_approval_enabled
) VALUES
(
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  (SELECT id FROM buyers WHERE user_id = '22222222-2222-2222-2222-222222222222'),
  'Florida Auto Insurance Campaign',
  'Buying auto insurance leads in Florida market',
  '{"geographic": {"states": ["FL"]}, "vertical": ["Auto Insurance"], "call_duration_min": 60, "quality_score_min": 70}',
  20.00,
  500.00,
  15000.00,
  'active',
  '{"minimum_duration": 45, "minimum_quality_score": 70, "required_fields": ["name", "phone", "email"]}',
  true
),
(
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  (SELECT id FROM buyers WHERE user_id = '33333333-3333-3333-3333-333333333333'),
  'Personal Injury Leads - Multi-State',
  'High-value personal injury leads across multiple states',
  '{"geographic": {"states": ["CA", "NY", "TX"]}, "vertical": ["Personal Injury"], "call_duration_min": 120, "quality_score_min": 80}',
  150.00,
  2000.00,
  60000.00,
  'active',
  '{"minimum_duration": 90, "minimum_quality_score": 80, "required_fields": ["name", "phone", "email", "injury_type"]}',
  false
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  targeting_criteria = EXCLUDED.targeting_criteria,
  max_bid = EXCLUDED.max_bid,
  daily_budget = EXCLUDED.daily_budget,
  monthly_budget = EXCLUDED.monthly_budget,
  status = EXCLUDED.status;

-- Insert sample calls data
INSERT INTO calls (
  id, campaign_id, buyer_campaign_id, tracking_number, 
  caller_number, destination_number, started_at, ended_at,
  duration_seconds, payout_amount, charge_amount, margin_amount,
  status, quality_score, caller_location, metadata
) VALUES
(
  'call1111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '8005551234',
  '+13055551111',
  '+13055552222',
  NOW() - INTERVAL '2 hours',
  NOW() - INTERVAL '2 hours' + INTERVAL '185 seconds',
  185,
  18.50,
  20.00,
  1.50,
  'completed',
  85,
  '{"city": "Miami", "state": "FL", "country": "US", "zip": "33101"}',
  '{"intent_confirmed": true, "lead_quality": "high", "notes": "Interested in auto insurance quote"}'
),
(
  'call2222-2222-2222-2222-222222222222',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  '8005556789',
  '+12125553333',
  '+12125554444',
  NOW() - INTERVAL '1 hour',
  NOW() - INTERVAL '1 hour' + INTERVAL '320 seconds',
  320,
  127.50,
  150.00,
  22.50,
  'completed',
  92,
  '{"city": "New York", "state": "NY", "country": "US", "zip": "10001"}',
  '{"intent_confirmed": true, "injury_type": "car_accident", "lead_quality": "premium", "attorney_needed": true}'
),
(
  'call3333-3333-3333-3333-333333333333',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '8005551235',
  '+14075556666',
  '+14075557777',
  NOW() - INTERVAL '30 minutes',
  NOW() - INTERVAL '30 minutes' + INTERVAL '45 seconds',
  45,
  9.25,
  10.00,
  0.75,
  'completed',
  65,
  '{"city": "Orlando", "state": "FL", "country": "US", "zip": "32801"}',
  '{"intent_confirmed": false, "lead_quality": "low", "notes": "Short call, limited interest"}'
)
ON CONFLICT (id) DO UPDATE SET
  duration_seconds = EXCLUDED.duration_seconds,
  payout_amount = EXCLUDED.payout_amount,
  charge_amount = EXCLUDED.charge_amount,
  margin_amount = EXCLUDED.margin_amount,
  status = EXCLUDED.status,
  quality_score = EXCLUDED.quality_score;

-- Insert call quality scores for the sample calls
INSERT INTO call_quality_scores (
  call_id, duration_score, intent_score, content_score, 
  technical_score, overall_score, scoring_model, flags
) VALUES
(
  'call1111-1111-1111-1111-111111111111',
  90, 85, 80, 85, 85, 'v1.0', '[]'
),
(
  'call2222-2222-2222-2222-222222222222',
  95, 95, 90, 88, 92, 'v1.0', '[]'
),
(
  'call3333-3333-3333-3333-333333333333',
  45, 50, 65, 75, 65, 'v1.0', '["short_duration", "low_intent"]'
)
ON CONFLICT (call_id) DO UPDATE SET
  duration_score = EXCLUDED.duration_score,
  intent_score = EXCLUDED.intent_score,
  overall_score = EXCLUDED.overall_score;

-- Insert sample campaign stats
INSERT INTO campaign_stats (
  campaign_id, date, calls_count, connected_calls, completed_calls,
  total_duration, avg_duration, total_payout, avg_payout, quality_score_avg
) VALUES
(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  CURRENT_DATE,
  2, 2, 2, 230, 115.0, 27.75, 13.88, 75.0
),
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  CURRENT_DATE,
  1, 1, 1, 320, 320.0, 127.50, 127.50, 92.0
)
ON CONFLICT (campaign_id, date, hour) DO UPDATE SET
  calls_count = EXCLUDED.calls_count,
  connected_calls = EXCLUDED.connected_calls,
  completed_calls = EXCLUDED.completed_calls,
  total_duration = EXCLUDED.total_duration,
  avg_duration = EXCLUDED.avg_duration,
  total_payout = EXCLUDED.total_payout,
  avg_payout = EXCLUDED.avg_payout,
  quality_score_avg = EXCLUDED.quality_score_avg;

-- Insert sample buyer campaign stats
INSERT INTO buyer_campaign_stats (
  buyer_campaign_id, date, calls_received, calls_accepted, calls_completed,
  total_cost, avg_cost, total_duration, avg_duration, quality_score_avg
) VALUES
(
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  CURRENT_DATE,
  2, 2, 2, 30.00, 15.00, 230, 115.0, 75.0
),
(
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  CURRENT_DATE,
  1, 1, 1, 150.00, 150.00, 320, 320.0, 92.0
)
ON CONFLICT (buyer_campaign_id, date, hour) DO UPDATE SET
  calls_received = EXCLUDED.calls_received,
  calls_accepted = EXCLUDED.calls_accepted,
  calls_completed = EXCLUDED.calls_completed,
  total_cost = EXCLUDED.total_cost,
  avg_cost = EXCLUDED.avg_cost,
  total_duration = EXCLUDED.total_duration,
  avg_duration = EXCLUDED.avg_duration,
  quality_score_avg = EXCLUDED.quality_score_avg;

-- Insert sample invoice
INSERT INTO invoices (
  buyer_id, invoice_number, amount, tax_amount, total_amount,
  status, period_start, period_end, due_date, payment_terms
) VALUES
(
  (SELECT id FROM buyers WHERE user_id = '22222222-2222-2222-2222-222222222222'),
  'INV-2024-000001',
  30.00,
  2.40,
  32.40,
  'open',
  CURRENT_DATE - INTERVAL '7 days',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '30 days',
  30
)
ON CONFLICT (invoice_number) DO UPDATE SET
  amount = EXCLUDED.amount,
  tax_amount = EXCLUDED.tax_amount,
  total_amount = EXCLUDED.total_amount;

-- Insert invoice line items
INSERT INTO invoice_line_items (
  invoice_id, description, quantity, unit_price, total_amount, call_id
) VALUES
(
  (SELECT id FROM invoices WHERE invoice_number = 'INV-2024-000001'),
  'Auto Insurance Call - Miami, FL (185s)',
  1,
  20.0000,
  20.00,
  'call1111-1111-1111-1111-111111111111'
),
(
  (SELECT id FROM invoices WHERE invoice_number = 'INV-2024-000001'),
  'Auto Insurance Call - Orlando, FL (45s)',
  1,
  10.0000,
  10.00,
  'call3333-3333-3333-3333-333333333333'
)
ON CONFLICT DO NOTHING;

-- Insert sample payout
INSERT INTO payouts (
  supplier_id, amount, fee_amount, net_amount, status,
  period_start, period_end, payment_method, reference_number
) VALUES
(
  (SELECT id FROM suppliers WHERE user_id = '11111111-1111-1111-1111-111111111111'),
  155.25,
  7.76,
  147.49,
  'pending',
  CURRENT_DATE - INTERVAL '7 days',
  CURRENT_DATE,
  'bank_transfer',
  'PAY-2024-000001'
)
ON CONFLICT DO NOTHING;

-- Update supplier balance based on completed calls
UPDATE suppliers 
SET credit_balance = calculate_supplier_balance(id)
WHERE user_id = '11111111-1111-1111-1111-111111111111';

-- Update buyer balance based on charges
UPDATE buyers 
SET current_balance = calculate_buyer_balance(id)
WHERE user_id IN ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');

-- Comments
COMMENT ON TABLE users IS 'Seed data includes admin, supplier, and buyer test accounts';
COMMENT ON TABLE campaigns IS 'Sample campaigns for auto insurance and legal verticals';
COMMENT ON TABLE calls IS 'Sample call data with varying quality scores and durations';
COMMENT ON TABLE invoices IS 'Sample billing data for testing payment flows';