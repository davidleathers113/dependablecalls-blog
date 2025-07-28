-- DCE Platform Performance Indexes
-- Optimized indexes for frequent queries and performance critical operations

-- ================================
-- PRIMARY LOOKUP INDEXES
-- ================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users (last_login DESC) WHERE last_login IS NOT NULL;

-- Suppliers table indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON suppliers (user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers (status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_suppliers_company_name ON suppliers (company_name);
CREATE INDEX IF NOT EXISTS idx_suppliers_credit_balance ON suppliers (credit_balance DESC) WHERE credit_balance > 0;
CREATE INDEX IF NOT EXISTS idx_suppliers_created_at ON suppliers (created_at DESC);

-- Buyers table indexes
CREATE INDEX IF NOT EXISTS idx_buyers_user_id ON buyers (user_id);
CREATE INDEX IF NOT EXISTS idx_buyers_status ON buyers (status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_buyers_company_name ON buyers (company_name);
CREATE INDEX IF NOT EXISTS idx_buyers_credit_limit ON buyers (credit_limit DESC);
CREATE INDEX IF NOT EXISTS idx_buyers_current_balance ON buyers (current_balance DESC);
CREATE INDEX IF NOT EXISTS idx_buyers_created_at ON buyers (created_at DESC);

-- ================================
-- CAMPAIGN INDEXES
-- ================================

-- Campaigns table indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_supplier_id ON campaigns (supplier_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns (status);
CREATE INDEX IF NOT EXISTS idx_campaigns_status_active ON campaigns (status, created_at DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_campaigns_bid_floor ON campaigns (bid_floor DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_category ON campaigns (category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaigns_vertical ON campaigns (vertical) WHERE vertical IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_updated_at ON campaigns (updated_at DESC);

-- JSONB indexes for campaign targeting and routing
CREATE INDEX IF NOT EXISTS idx_campaigns_targeting_geo ON campaigns USING GIN ((targeting->'geographic'));
CREATE INDEX IF NOT EXISTS idx_campaigns_targeting_schedule ON campaigns USING GIN ((targeting->'schedule'));
CREATE INDEX IF NOT EXISTS idx_campaigns_routing_rules ON campaigns USING GIN (routing_rules);

-- Buyer campaigns table indexes
CREATE INDEX IF NOT EXISTS idx_buyer_campaigns_buyer_id ON buyer_campaigns (buyer_id);
CREATE INDEX IF NOT EXISTS idx_buyer_campaigns_status ON buyer_campaigns (status);
CREATE INDEX IF NOT EXISTS idx_buyer_campaigns_status_active ON buyer_campaigns (status, created_at DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_buyer_campaigns_max_bid ON buyer_campaigns (max_bid DESC);
CREATE INDEX IF NOT EXISTS idx_buyer_campaigns_daily_budget ON buyer_campaigns (daily_budget DESC) WHERE daily_budget IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_buyer_campaigns_created_at ON buyer_campaigns (created_at DESC);

-- JSONB indexes for buyer campaign criteria
CREATE INDEX IF NOT EXISTS idx_buyer_campaigns_targeting ON buyer_campaigns USING GIN (targeting_criteria);
CREATE INDEX IF NOT EXISTS idx_buyer_campaigns_schedule ON buyer_campaigns USING GIN (schedule);
CREATE INDEX IF NOT EXISTS idx_buyer_campaigns_quality ON buyer_campaigns USING GIN (quality_requirements);

-- ================================
-- CALL TRACKING INDEXES
-- ================================

-- Tracking numbers table indexes
CREATE INDEX IF NOT EXISTS idx_tracking_numbers_campaign_id ON tracking_numbers (campaign_id);
CREATE INDEX IF NOT EXISTS idx_tracking_numbers_number ON tracking_numbers (number);
CREATE INDEX IF NOT EXISTS idx_tracking_numbers_active ON tracking_numbers (campaign_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_tracking_numbers_area_code ON tracking_numbers (area_code) WHERE area_code IS NOT NULL;

-- ================================
-- CALLS PERFORMANCE INDEXES
-- ================================

-- Core call lookup indexes
CREATE INDEX IF NOT EXISTS idx_calls_campaign_id ON calls (campaign_id);
CREATE INDEX IF NOT EXISTS idx_calls_buyer_campaign_id ON calls (buyer_campaign_id);
CREATE INDEX IF NOT EXISTS idx_calls_tracking_number ON calls (tracking_number);
CREATE INDEX IF NOT EXISTS idx_calls_caller_number ON calls (caller_number);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls (status);
CREATE INDEX IF NOT EXISTS idx_calls_started_at ON calls (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_ended_at ON calls (ended_at DESC) WHERE ended_at IS NOT NULL;

-- Performance indexes for call queries
CREATE INDEX IF NOT EXISTS idx_calls_campaign_started ON calls (campaign_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_buyer_campaign_started ON calls (buyer_campaign_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_status_started ON calls (status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_completed ON calls (status, started_at DESC) WHERE status = 'completed';

-- Billing and quality indexes
CREATE INDEX IF NOT EXISTS idx_calls_payout_amount ON calls (payout_amount DESC) WHERE payout_amount > 0;
CREATE INDEX IF NOT EXISTS idx_calls_charge_amount ON calls (charge_amount DESC) WHERE charge_amount > 0;
CREATE INDEX IF NOT EXISTS idx_calls_quality_score ON calls (quality_score DESC) WHERE quality_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_fraud_score ON calls (fraud_score DESC) WHERE fraud_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_duration ON calls (duration_seconds DESC) WHERE duration_seconds > 0;

-- Composite indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_calls_campaign_status_date ON calls (campaign_id, status, started_at);
CREATE INDEX IF NOT EXISTS idx_calls_buyer_campaign_status_date ON calls (buyer_campaign_id, status, started_at);
CREATE INDEX IF NOT EXISTS idx_calls_quality_billing ON calls (quality_score DESC, payout_amount DESC) WHERE quality_score IS NOT NULL AND payout_amount > 0;

-- JSONB indexes for call metadata and location
CREATE INDEX IF NOT EXISTS idx_calls_metadata ON calls USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_calls_caller_location ON calls USING GIN (caller_location);

-- ================================
-- CALL LOGS INDEXES
-- ================================

CREATE INDEX IF NOT EXISTS idx_call_logs_call_id ON call_logs (call_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_event_type ON call_logs (event_type);
CREATE INDEX IF NOT EXISTS idx_call_logs_timestamp ON call_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_call_event_time ON call_logs (call_id, event_type, timestamp);

-- JSONB index for event data
CREATE INDEX IF NOT EXISTS idx_call_logs_event_data ON call_logs USING GIN (event_data);

-- ================================
-- FINANCIAL INDEXES
-- ================================

-- Payouts table indexes
CREATE INDEX IF NOT EXISTS idx_payouts_supplier_id ON payouts (supplier_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts (status);
CREATE INDEX IF NOT EXISTS idx_payouts_period ON payouts (period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_payouts_created_at ON payouts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payouts_paid_at ON payouts (paid_at DESC) WHERE paid_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payouts_amount ON payouts (amount DESC);
CREATE INDEX IF NOT EXISTS idx_payouts_transaction_id ON payouts (transaction_id) WHERE transaction_id IS NOT NULL;

-- Composite indexes for payout queries
CREATE INDEX IF NOT EXISTS idx_payouts_supplier_status_period ON payouts (supplier_id, status, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_payouts_status_period ON payouts (status, period_start, period_end);

-- Invoices table indexes
CREATE INDEX IF NOT EXISTS idx_invoices_buyer_id ON invoices (buyer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices (invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON invoices (period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices (due_date) WHERE status != 'paid';
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_paid_at ON invoices (paid_at DESC) WHERE paid_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_amount ON invoices (total_amount DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe ON invoices (stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;

-- Composite indexes for invoice queries
CREATE INDEX IF NOT EXISTS idx_invoices_buyer_status_due ON invoices (buyer_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_status_due ON invoices (status, due_date) WHERE status IN ('open', 'overdue');

-- Invoice line items indexes
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON invoice_line_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_call_id ON invoice_line_items (call_id) WHERE call_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_amount ON invoice_line_items (total_amount DESC);

-- ================================
-- QUALITY AND COMPLIANCE INDEXES
-- ================================

-- Call quality scores indexes
CREATE INDEX IF NOT EXISTS idx_call_quality_scores_call_id ON call_quality_scores (call_id);
CREATE INDEX IF NOT EXISTS idx_call_quality_scores_overall ON call_quality_scores (overall_score DESC) WHERE overall_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_quality_scores_duration ON call_quality_scores (duration_score DESC) WHERE duration_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_quality_scores_intent ON call_quality_scores (intent_score DESC) WHERE intent_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_quality_scores_created_at ON call_quality_scores (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_quality_scores_reviewed ON call_quality_scores (reviewed_at DESC) WHERE reviewed_at IS NOT NULL;

-- JSONB index for quality flags
CREATE INDEX IF NOT EXISTS idx_call_quality_flags ON call_quality_scores USING GIN (flags);

-- Disputes table indexes
CREATE INDEX IF NOT EXISTS idx_disputes_call_id ON disputes (call_id);
CREATE INDEX IF NOT EXISTS idx_disputes_raised_by ON disputes (raised_by);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes (status);
CREATE INDEX IF NOT EXISTS idx_disputes_dispute_type ON disputes (dispute_type);
CREATE INDEX IF NOT EXISTS idx_disputes_priority ON disputes (priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disputes_assigned_to ON disputes (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_disputes_created_at ON disputes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disputes_resolved_at ON disputes (resolved_at DESC) WHERE resolved_at IS NOT NULL;

-- Composite indexes for dispute queries
CREATE INDEX IF NOT EXISTS idx_disputes_status_priority_created ON disputes (status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disputes_assigned_status ON disputes (assigned_to, status, created_at DESC) WHERE assigned_to IS NOT NULL;

-- JSONB index for dispute evidence
CREATE INDEX IF NOT EXISTS idx_disputes_evidence ON disputes USING GIN (evidence);

-- ================================
-- ANALYTICS AND REPORTING INDEXES
-- ================================

-- Campaign stats indexes
CREATE INDEX IF NOT EXISTS idx_campaign_stats_campaign_id ON campaign_stats (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_stats_date ON campaign_stats (date DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_stats_campaign_date ON campaign_stats (campaign_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_stats_campaign_date_hour ON campaign_stats (campaign_id, date DESC, hour) WHERE hour IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_stats_calls_count ON campaign_stats (calls_count DESC) WHERE calls_count > 0;
CREATE INDEX IF NOT EXISTS idx_campaign_stats_total_payout ON campaign_stats (total_payout DESC) WHERE total_payout > 0;
CREATE INDEX IF NOT EXISTS idx_campaign_stats_created_at ON campaign_stats (created_at DESC);

-- Composite indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_campaign_stats_performance ON campaign_stats (campaign_id, date DESC, calls_count DESC, total_payout DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_stats_daily ON campaign_stats (date DESC, hour) WHERE hour IS NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_stats_hourly ON campaign_stats (date DESC, hour) WHERE hour IS NOT NULL;

-- Buyer campaign stats indexes
CREATE INDEX IF NOT EXISTS idx_buyer_campaign_stats_buyer_campaign_id ON buyer_campaign_stats (buyer_campaign_id);
CREATE INDEX IF NOT EXISTS idx_buyer_campaign_stats_date ON buyer_campaign_stats (date DESC);
CREATE INDEX IF NOT EXISTS idx_buyer_campaign_stats_buyer_date ON buyer_campaign_stats (buyer_campaign_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_buyer_campaign_stats_buyer_date_hour ON buyer_campaign_stats (buyer_campaign_id, date DESC, hour) WHERE hour IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_buyer_campaign_stats_calls_received ON buyer_campaign_stats (calls_received DESC) WHERE calls_received > 0;
CREATE INDEX IF NOT EXISTS idx_buyer_campaign_stats_total_cost ON buyer_campaign_stats (total_cost DESC) WHERE total_cost > 0;
CREATE INDEX IF NOT EXISTS idx_buyer_campaign_stats_created_at ON buyer_campaign_stats (created_at DESC);

-- Composite indexes for buyer analytics
CREATE INDEX IF NOT EXISTS idx_buyer_campaign_stats_performance ON buyer_campaign_stats (buyer_campaign_id, date DESC, calls_received DESC, total_cost DESC);
CREATE INDEX IF NOT EXISTS idx_buyer_campaign_stats_daily ON buyer_campaign_stats (date DESC, hour) WHERE hour IS NULL;
CREATE INDEX IF NOT EXISTS idx_buyer_campaign_stats_hourly ON buyer_campaign_stats (date DESC, hour) WHERE hour IS NOT NULL;

-- ================================
-- AUDIT AND SECURITY INDEXES
-- ================================

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs (table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operation ON audit_logs (operation);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON audit_logs (record_id) WHERE record_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs (ip_address) WHERE ip_address IS NOT NULL;

-- Composite indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_user_time ON audit_logs (table_name, user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_time ON audit_logs (table_name, record_id, created_at DESC) WHERE record_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_time ON audit_logs (user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- JSONB indexes for audit data
CREATE INDEX IF NOT EXISTS idx_audit_logs_old_data ON audit_logs USING GIN (old_data) WHERE old_data IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_new_data ON audit_logs USING GIN (new_data) WHERE new_data IS NOT NULL;

-- ================================
-- SPECIALIZED INDEXES FOR BUSINESS LOGIC
-- ================================

-- Index for fraud detection queries
CREATE INDEX IF NOT EXISTS idx_calls_fraud_detection ON calls (caller_number, started_at DESC);

-- Index for real-time call matching
CREATE INDEX IF NOT EXISTS idx_buyer_campaigns_matching ON buyer_campaigns (status, max_bid DESC, daily_budget DESC) WHERE status = 'active';

-- Index for balance calculations
CREATE INDEX IF NOT EXISTS idx_calls_balance_calc_supplier ON calls (campaign_id, status, payout_amount) WHERE status = 'completed' AND payout_amount > 0;
CREATE INDEX IF NOT EXISTS idx_calls_balance_calc_buyer ON calls (buyer_campaign_id, status, charge_amount) WHERE status = 'completed' AND charge_amount > 0;

-- Index for recent activity queries
CREATE INDEX IF NOT EXISTS idx_calls_recent_activity ON calls (started_at DESC);

-- Index for campaign performance optimization
CREATE INDEX IF NOT EXISTS idx_campaigns_performance ON campaigns (status, bid_floor DESC, created_at DESC) WHERE status = 'active';

-- ================================
-- PARTIAL INDEXES FOR EFFICIENCY
-- ================================

-- Only index active records for most lookups
CREATE INDEX IF NOT EXISTS idx_suppliers_active_only ON suppliers (user_id, created_at DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_buyers_active_only ON buyers (user_id, created_at DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_campaigns_active_only ON campaigns (supplier_id, bid_floor DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_buyer_campaigns_active_only ON buyer_campaigns (buyer_id, max_bid DESC) WHERE status = 'active';

-- Only index completed calls for financial calculations
CREATE INDEX IF NOT EXISTS idx_calls_completed_billing ON calls (campaign_id, buyer_campaign_id, payout_amount, charge_amount) WHERE status = 'completed';

-- Only index pending payouts and open invoices
CREATE INDEX IF NOT EXISTS idx_payouts_pending ON payouts (supplier_id, amount DESC, created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_invoices_open ON invoices (buyer_id, due_date, total_amount DESC) WHERE status IN ('open', 'overdue');

-- ================================
-- TEXT SEARCH INDEXES
-- ================================

-- Full-text search indexes for campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_search ON campaigns USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Full-text search for companies
CREATE INDEX IF NOT EXISTS idx_suppliers_search ON suppliers USING GIN (to_tsvector('english', company_name));
CREATE INDEX IF NOT EXISTS idx_buyers_search ON buyers USING GIN (to_tsvector('english', company_name));

-- Search index for disputes
CREATE INDEX IF NOT EXISTS idx_disputes_search ON disputes USING GIN (to_tsvector('english', reason || ' ' || COALESCE(description, '')));

-- Comments for documentation
COMMENT ON INDEX idx_calls_campaign_started IS 'Primary index for campaign call history queries';
COMMENT ON INDEX idx_calls_buyer_campaign_started IS 'Primary index for buyer call history queries';
COMMENT ON INDEX idx_calls_fraud_detection IS 'Optimized for fraud detection queries on recent calls';
COMMENT ON INDEX idx_buyer_campaigns_matching IS 'Optimized for real-time call matching algorithms';
COMMENT ON INDEX idx_campaigns_performance IS 'Performance index for active campaign discovery';
COMMENT ON INDEX idx_calls_completed_billing IS 'Optimized for billing calculations on completed calls';
COMMENT ON INDEX idx_campaign_stats_performance IS 'Comprehensive campaign analytics index';
COMMENT ON INDEX idx_audit_logs_table_user_time IS 'User activity tracking across all tables';