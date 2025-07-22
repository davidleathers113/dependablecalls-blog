-- DCE Platform Initial Schema Migration
-- Creates core tables for the pay-per-call network platform

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types for better data integrity
CREATE TYPE user_status AS ENUM ('pending', 'active', 'suspended', 'banned');
CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'paused', 'completed', 'cancelled');
CREATE TYPE call_status AS ENUM ('initiated', 'ringing', 'connected', 'completed', 'failed', 'rejected');
CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
CREATE TYPE invoice_status AS ENUM ('draft', 'open', 'paid', 'overdue', 'cancelled');
CREATE TYPE dispute_status AS ENUM ('open', 'investigating', 'resolved', 'closed');

-- Core users table (extends Supabase auth.users)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    metadata JSONB DEFAULT '{}',
    status user_status DEFAULT 'pending',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create admins table
CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'admin',
    permissions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    appointed_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Suppliers table - traffic providers
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    business_type VARCHAR(100),
    tax_id VARCHAR(50),
    website_url TEXT,
    credit_balance DECIMAL(12,2) DEFAULT 0.00,
    minimum_payout DECIMAL(10,2) DEFAULT 50.00,
    payout_frequency VARCHAR(20) DEFAULT 'weekly', -- weekly, biweekly, monthly
    verification_data JSONB DEFAULT '{}',
    status user_status DEFAULT 'pending',
    settings JSONB DEFAULT '{}',
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES admins(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Buyers table - advertisers
CREATE TABLE buyers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    business_type VARCHAR(100),
    tax_id VARCHAR(50),
    website_url TEXT,
    credit_limit DECIMAL(12,2) DEFAULT 0.00,
    current_balance DECIMAL(12,2) DEFAULT 0.00,
    auto_recharge_enabled BOOLEAN DEFAULT false,
    auto_recharge_threshold DECIMAL(10,2) DEFAULT 100.00,
    auto_recharge_amount DECIMAL(10,2) DEFAULT 500.00,
    verification_data JSONB DEFAULT '{}',
    status user_status DEFAULT 'pending',
    settings JSONB DEFAULT '{}',
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES admins(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Campaigns table - supplier traffic campaigns
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    vertical VARCHAR(100),
    targeting JSONB DEFAULT '{}', -- geographic, demographic, time-based targeting
    routing_rules JSONB DEFAULT '{}', -- call routing configuration
    bid_floor DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    max_concurrent_calls INTEGER DEFAULT 10,
    daily_cap INTEGER,
    monthly_cap INTEGER,
    tracking_numbers JSONB DEFAULT '[]',
    schedule JSONB DEFAULT '{}', -- operating hours and days
    status campaign_status DEFAULT 'draft',
    quality_threshold INTEGER DEFAULT 70, -- minimum quality score (1-100)
    fraud_detection_enabled BOOLEAN DEFAULT true,
    recording_enabled BOOLEAN DEFAULT true,
    call_timeout_seconds INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Buyer campaigns table - buyer's purchasing criteria
CREATE TABLE buyer_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID REFERENCES buyers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    targeting_criteria JSONB DEFAULT '{}', -- what they want to buy
    max_bid DECIMAL(8,2) NOT NULL,
    daily_budget DECIMAL(10,2),
    monthly_budget DECIMAL(10,2),
    daily_cap INTEGER,
    monthly_cap INTEGER,
    schedule JSONB DEFAULT '{}', -- when they want calls
    quality_requirements JSONB DEFAULT '{}', -- minimum quality standards
    exclude_suppliers UUID[] DEFAULT '{}', -- blacklisted suppliers
    preferred_suppliers UUID[] DEFAULT '{}', -- preferred suppliers
    status campaign_status DEFAULT 'draft',
    auto_approval_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tracking numbers table
CREATE TABLE tracking_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    number VARCHAR(20) NOT NULL UNIQUE,
    display_number VARCHAR(20), -- formatted display version
    country_code VARCHAR(5) DEFAULT 'US',
    area_code VARCHAR(5),
    is_active BOOLEAN DEFAULT true,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Calls table - core transaction records
CREATE TABLE calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    buyer_campaign_id UUID REFERENCES buyer_campaigns(id) ON DELETE SET NULL,
    tracking_number VARCHAR(20) NOT NULL,
    caller_number VARCHAR(20) NOT NULL,
    destination_number VARCHAR(20),
    caller_location JSONB, -- geo data from caller
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    answered_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0,
    billable_seconds INTEGER DEFAULT 0,
    payout_amount DECIMAL(8,2) DEFAULT 0.00,
    charge_amount DECIMAL(8,2) DEFAULT 0.00,
    margin_amount DECIMAL(8,2) DEFAULT 0.00,
    status call_status DEFAULT 'initiated',
    disposition VARCHAR(50), -- outcome classification
    quality_score INTEGER, -- 1-100 quality rating
    fraud_score INTEGER, -- 1-100 fraud risk rating
    metadata JSONB DEFAULT '{}', -- additional call data
    recording_url TEXT,
    recording_duration INTEGER,
    call_flow JSONB DEFAULT '[]', -- step-by-step call progression
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Call logs table - detailed call events
CREATE TABLE call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- dial, ring, answer, hangup, etc.
    event_data JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Financial tables
CREATE TABLE payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    fee_amount DECIMAL(10,2) DEFAULT 0.00,
    net_amount DECIMAL(12,2) NOT NULL,
    status payout_status DEFAULT 'pending',
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    payment_method VARCHAR(50), -- bank_transfer, paypal, check
    payment_details JSONB DEFAULT '{}',
    transaction_id VARCHAR(255),
    reference_number VARCHAR(100),
    notes TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID REFERENCES buyers(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(12,2) NOT NULL,
    status invoice_status DEFAULT 'draft',
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    due_date DATE NOT NULL,
    payment_terms INTEGER DEFAULT 30, -- days
    stripe_invoice_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    payment_method VARCHAR(50),
    paid_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoice line items
CREATE TABLE invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10,4) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    call_id UUID REFERENCES calls(id), -- reference to source call if applicable
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quality and compliance tables
CREATE TABLE call_quality_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
    duration_score INTEGER, -- 1-100 based on call duration
    intent_score INTEGER, -- 1-100 based on intent detection
    content_score INTEGER, -- 1-100 based on conversation analysis
    technical_score INTEGER, -- 1-100 based on audio quality
    overall_score INTEGER, -- weighted average
    scoring_model VARCHAR(50) DEFAULT 'v1.0',
    flags JSONB DEFAULT '[]', -- quality issues detected
    notes TEXT,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
    raised_by UUID REFERENCES users(id) ON DELETE SET NULL,
    dispute_type VARCHAR(50) NOT NULL, -- quality, fraud, billing, etc.
    reason VARCHAR(255) NOT NULL,
    description TEXT,
    evidence JSONB DEFAULT '[]', -- supporting documents/data
    amount_disputed DECIMAL(8,2),
    status dispute_status DEFAULT 'open',
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    assigned_to UUID REFERENCES users(id),
    resolution TEXT,
    resolution_notes TEXT,
    resolved_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Analytics and reporting tables
CREATE TABLE campaign_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    hour INTEGER, -- 0-23, null for daily stats
    calls_count INTEGER DEFAULT 0,
    connected_calls INTEGER DEFAULT 0,
    completed_calls INTEGER DEFAULT 0,
    total_duration INTEGER DEFAULT 0, -- seconds
    avg_duration DECIMAL(8,2) DEFAULT 0.00,
    total_payout DECIMAL(10,2) DEFAULT 0.00,
    avg_payout DECIMAL(8,2) DEFAULT 0.00,
    quality_score_avg DECIMAL(5,2),
    conversion_rate DECIMAL(5,4), -- percentage as decimal
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(campaign_id, date, hour)
);

CREATE TABLE buyer_campaign_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_campaign_id UUID REFERENCES buyer_campaigns(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    hour INTEGER, -- 0-23, null for daily stats
    calls_received INTEGER DEFAULT 0,
    calls_accepted INTEGER DEFAULT 0,
    calls_completed INTEGER DEFAULT 0,
    total_cost DECIMAL(10,2) DEFAULT 0.00,
    avg_cost DECIMAL(8,2) DEFAULT 0.00,
    total_duration INTEGER DEFAULT 0, -- seconds
    avg_duration DECIMAL(8,2) DEFAULT 0.00,
    conversions INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5,4), -- percentage as decimal
    quality_score_avg DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(buyer_campaign_id, date, hour)
);

-- System audit log
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at 
    BEFORE UPDATE ON suppliers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_buyers_updated_at 
    BEFORE UPDATE ON buyers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at 
    BEFORE UPDATE ON campaigns 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_buyer_campaigns_updated_at 
    BEFORE UPDATE ON buyer_campaigns 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calls_updated_at 
    BEFORE UPDATE ON calls 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at 
    BEFORE UPDATE ON invoices 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_disputes_updated_at 
    BEFORE UPDATE ON disputes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_stats_updated_at 
    BEFORE UPDATE ON campaign_stats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_buyer_campaign_stats_updated_at 
    BEFORE UPDATE ON buyer_campaign_stats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create invoice number generation function
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
    year_part TEXT;
    sequence_part TEXT;
BEGIN
    IF NEW.invoice_number IS NULL THEN
        year_part := EXTRACT(YEAR FROM NOW())::TEXT;
        
        SELECT LPAD(
            (COALESCE(MAX(
                CAST(
                    REGEXP_REPLACE(
                        invoice_number, 
                        '^INV-' || year_part || '-(\d+)$', 
                        '\1'
                    ) AS INTEGER
                )
            ), 0) + 1)::TEXT, 
            6, 
            '0'
        ) INTO sequence_part
        FROM invoices 
        WHERE invoice_number LIKE 'INV-' || year_part || '-%';
        
        NEW.invoice_number := 'INV-' || year_part || '-' || sequence_part;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply invoice number generation trigger
CREATE TRIGGER generate_invoice_number_trigger
    BEFORE INSERT ON invoices
    FOR EACH ROW EXECUTE FUNCTION generate_invoice_number();

-- Comments for documentation
COMMENT ON TABLE users IS 'Core user accounts that extend Supabase auth.users';
COMMENT ON TABLE suppliers IS 'Traffic providers who generate calls';
COMMENT ON TABLE buyers IS 'Advertisers who purchase call leads';
COMMENT ON TABLE campaigns IS 'Supplier traffic campaigns with targeting and routing';
COMMENT ON TABLE buyer_campaigns IS 'Buyer purchasing criteria and budgets';
COMMENT ON TABLE calls IS 'Core call transaction records with billing data';
COMMENT ON TABLE payouts IS 'Supplier payment records';
COMMENT ON TABLE invoices IS 'Buyer billing records';
COMMENT ON TABLE call_quality_scores IS 'Quality assessment for each call';
COMMENT ON TABLE disputes IS 'Quality and billing disputes';
COMMENT ON TABLE campaign_stats IS 'Hourly and daily campaign performance metrics';
COMMENT ON TABLE buyer_campaign_stats IS 'Hourly and daily buyer campaign performance';
COMMENT ON TABLE audit_logs IS 'System audit trail for compliance';