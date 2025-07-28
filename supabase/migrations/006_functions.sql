-- DCE Platform Database Functions
-- Business logic functions for calculations, validations, and data processing

-- ================================
-- BALANCE CALCULATION FUNCTIONS
-- ================================

-- Function to calculate supplier balance
CREATE OR REPLACE FUNCTION calculate_supplier_balance(supplier_uuid UUID)
RETURNS DECIMAL AS $$
DECLARE
    total_earnings DECIMAL;
    total_payouts DECIMAL;
BEGIN
    -- Sum all completed call payouts
    SELECT COALESCE(SUM(payout_amount), 0) INTO total_earnings
    FROM calls c
    JOIN campaigns camp ON c.campaign_id = camp.id
    WHERE camp.supplier_id = supplier_uuid 
    AND c.status = 'completed';
    
    -- Sum all completed payouts
    SELECT COALESCE(SUM(amount), 0) INTO total_payouts
    FROM payouts
    WHERE supplier_id = supplier_uuid 
    AND status = 'completed';
    
    RETURN total_earnings - total_payouts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate buyer balance (credit remaining)
CREATE OR REPLACE FUNCTION calculate_buyer_balance(buyer_uuid UUID)
RETURNS DECIMAL AS $$
DECLARE
    credit_limit DECIMAL;
    total_charges DECIMAL;
    total_payments DECIMAL;
BEGIN
    -- Get credit limit
    SELECT buyers.credit_limit INTO credit_limit
    FROM buyers
    WHERE id = buyer_uuid;
    
    -- Sum all completed call charges
    SELECT COALESCE(SUM(charge_amount), 0) INTO total_charges
    FROM calls c
    JOIN buyer_campaigns bc ON c.buyer_campaign_id = bc.id
    WHERE bc.buyer_id = buyer_uuid 
    AND c.status = 'completed';
    
    -- Sum all paid invoices
    SELECT COALESCE(SUM(total_amount), 0) INTO total_payments
    FROM invoices
    WHERE buyer_id = buyer_uuid 
    AND status = 'paid';
    
    RETURN credit_limit + total_payments - total_charges;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================
-- QUALITY SCORING FUNCTIONS
-- ================================

-- Function to calculate call quality score
CREATE OR REPLACE FUNCTION calculate_quality_score(
    call_duration INTEGER,
    call_metadata JSONB DEFAULT '{}'
)
RETURNS INTEGER AS $$
DECLARE
    duration_score INTEGER := 0;
    intent_score INTEGER := 70; -- default
    technical_score INTEGER := 85; -- default
    overall_score INTEGER;
BEGIN
    -- Duration scoring (0-100)
    CASE 
        WHEN call_duration >= 120 THEN duration_score := 100; -- 2+ minutes
        WHEN call_duration >= 60 THEN duration_score := 80;   -- 1-2 minutes
        WHEN call_duration >= 30 THEN duration_score := 60;   -- 30-60 seconds
        WHEN call_duration >= 15 THEN duration_score := 40;   -- 15-30 seconds
        ELSE duration_score := 20; -- under 15 seconds
    END CASE;
    
    -- Extract scores from metadata if available
    IF call_metadata ? 'intent_score' THEN
        intent_score := (call_metadata->>'intent_score')::INTEGER;
    END IF;
    
    IF call_metadata ? 'technical_score' THEN
        technical_score := (call_metadata->>'technical_score')::INTEGER;
    END IF;
    
    -- Weighted average: duration 40%, intent 40%, technical 20%
    overall_score := ROUND(
        (duration_score * 0.4 + intent_score * 0.4 + technical_score * 0.2)
    );
    
    -- Ensure score is within bounds
    overall_score := GREATEST(0, LEAST(100, overall_score));
    
    RETURN overall_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to detect fraud indicators
CREATE OR REPLACE FUNCTION detect_fraud_indicators(
    caller_number VARCHAR(20),
    call_duration INTEGER,
    caller_location JSONB DEFAULT '{}',
    call_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB AS $$
DECLARE
    fraud_flags JSONB := '[]';
    fraud_score INTEGER := 0;
    recent_calls INTEGER;
BEGIN
    -- Check for rapid repeat calls from same number
    SELECT COUNT(*) INTO recent_calls
    FROM calls
    WHERE caller_number = detect_fraud_indicators.caller_number
    AND started_at > NOW() - INTERVAL '1 hour';
    
    IF recent_calls > 5 THEN
        fraud_flags := fraud_flags || '["rapid_repeat_calls"]'::jsonb;
        fraud_score := fraud_score + 30;
    END IF;
    
    -- Check for very short call duration
    IF call_duration < 10 THEN
        fraud_flags := fraud_flags || '["extremely_short_duration"]'::jsonb;
        fraud_score := fraud_score + 25;
    END IF;
    
    -- Check for suspicious geographic patterns
    IF caller_location ? 'country' AND (caller_location->>'country') != 'US' THEN
        fraud_flags := fraud_flags || '["international_caller"]'::jsonb;
        fraud_score := fraud_score + 20;
    END IF;
    
    -- Check for invalid phone number patterns
    IF caller_number ~ '^1?(000|111|222|333|444|555|666|777|888|999)' THEN
        fraud_flags := fraud_flags || '["suspicious_number_pattern"]'::jsonb;
        fraud_score := fraud_score + 40;
    END IF;
    
    -- Return fraud analysis
    RETURN jsonb_build_object(
        'fraud_score', LEAST(100, fraud_score),
        'flags', fraud_flags,
        'suspicious', fraud_score > 50
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================
-- CAMPAIGN MATCHING FUNCTIONS
-- ================================

-- Function to find matching buyer campaigns for a call
CREATE OR REPLACE FUNCTION find_matching_buyer_campaigns(
    supplier_campaign_id UUID,
    caller_location JSONB DEFAULT '{}',
    call_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE(
    buyer_campaign_id UUID,
    buyer_id UUID,
    max_bid DECIMAL,
    match_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bc.id as buyer_campaign_id,
        bc.buyer_id,
        bc.max_bid,
        100 as match_score -- Simplified scoring, can be enhanced
    FROM buyer_campaigns bc
    JOIN buyers b ON bc.buyer_id = b.id
    JOIN campaigns c ON c.id = supplier_campaign_id
    WHERE bc.status = 'active'
    AND b.status = 'active'
    AND bc.max_bid >= c.bid_floor
    -- Add time-based matching
    AND (
        bc.schedule IS NULL OR
        (bc.schedule->>'enabled')::boolean = false OR
        (
            EXTRACT(hour FROM call_time) >= (bc.schedule->>'start_hour')::integer AND
            EXTRACT(hour FROM call_time) <= (bc.schedule->>'end_hour')::integer
        )
    )
    -- Add budget checks
    AND (
        bc.daily_budget IS NULL OR
        COALESCE((
            SELECT SUM(charge_amount)
            FROM calls calls_today
            WHERE calls_today.buyer_campaign_id = bc.id
            AND calls_today.started_at::date = call_time::date
        ), 0) + bc.max_bid <= bc.daily_budget
    )
    ORDER BY bc.max_bid DESC, match_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================
-- BILLING CALCULATION FUNCTIONS
-- ================================

-- Function to calculate call billing amounts
CREATE OR REPLACE FUNCTION calculate_call_billing(
    campaign_id UUID,
    buyer_campaign_id UUID,
    call_duration INTEGER,
    quality_score INTEGER
)
RETURNS JSONB AS $$
DECLARE
    bid_floor DECIMAL;
    max_bid DECIMAL;
    payout_amount DECIMAL;
    charge_amount DECIMAL;
    margin_amount DECIMAL;
    quality_multiplier DECIMAL := 1.0;
BEGIN
    -- Get campaign bid floor and buyer max bid
    SELECT c.bid_floor INTO bid_floor
    FROM campaigns c WHERE c.id = campaign_id;
    
    SELECT bc.max_bid INTO max_bid
    FROM buyer_campaigns bc WHERE bc.id = buyer_campaign_id;
    
    -- Apply quality score multiplier
    CASE 
        WHEN quality_score >= 90 THEN quality_multiplier := 1.1;  -- 10% bonus
        WHEN quality_score >= 80 THEN quality_multiplier := 1.0;  -- full amount
        WHEN quality_score >= 70 THEN quality_multiplier := 0.9;  -- 10% reduction
        WHEN quality_score >= 60 THEN quality_multiplier := 0.8;  -- 20% reduction
        ELSE quality_multiplier := 0.5; -- 50% reduction for poor quality
    END CASE;
    
    -- Calculate amounts
    payout_amount := bid_floor * quality_multiplier;
    charge_amount := max_bid * quality_multiplier;
    margin_amount := charge_amount - payout_amount;
    
    -- Ensure positive amounts
    payout_amount := GREATEST(0, payout_amount);
    charge_amount := GREATEST(payout_amount, charge_amount);
    margin_amount := charge_amount - payout_amount;
    
    RETURN jsonb_build_object(
        'payout_amount', payout_amount,
        'charge_amount', charge_amount,
        'margin_amount', margin_amount,
        'quality_multiplier', quality_multiplier
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================
-- STATS AGGREGATION FUNCTIONS
-- ================================

-- Function to process hourly campaign stats
CREATE OR REPLACE FUNCTION process_hourly_stats(target_hour TIMESTAMP WITH TIME ZONE DEFAULT DATE_TRUNC('hour', NOW() - INTERVAL '1 hour'))
RETURNS void AS $$
BEGIN
    -- Update campaign stats
    INSERT INTO campaign_stats (
        campaign_id, date, hour, calls_count, connected_calls, 
        completed_calls, total_duration, avg_duration, total_payout, avg_payout, quality_score_avg
    )
    SELECT 
        campaign_id,
        target_hour::date as date,
        EXTRACT(HOUR FROM target_hour)::integer as hour,
        COUNT(*) as calls_count,
        COUNT(CASE WHEN status IN ('connected', 'completed') THEN 1 END) as connected_calls,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_calls,
        COALESCE(SUM(duration_seconds), 0) as total_duration,
        COALESCE(AVG(duration_seconds), 0) as avg_duration,
        COALESCE(SUM(payout_amount), 0) as total_payout,
        COALESCE(AVG(payout_amount), 0) as avg_payout,
        AVG(quality_score) as quality_score_avg
    FROM calls
    WHERE started_at >= target_hour 
    AND started_at < target_hour + INTERVAL '1 hour'
    AND campaign_id IS NOT NULL
    GROUP BY campaign_id
    ON CONFLICT (campaign_id, date, hour) 
    DO UPDATE SET
        calls_count = EXCLUDED.calls_count,
        connected_calls = EXCLUDED.connected_calls,
        completed_calls = EXCLUDED.completed_calls,
        total_duration = EXCLUDED.total_duration,
        avg_duration = EXCLUDED.avg_duration,
        total_payout = EXCLUDED.total_payout,
        avg_payout = EXCLUDED.avg_payout,
        quality_score_avg = EXCLUDED.quality_score_avg,
        updated_at = NOW();
    
    -- Update buyer campaign stats
    INSERT INTO buyer_campaign_stats (
        buyer_campaign_id, date, hour, calls_received, calls_accepted, 
        calls_completed, total_cost, avg_cost, total_duration, avg_duration, quality_score_avg
    )
    SELECT 
        buyer_campaign_id,
        target_hour::date as date,
        EXTRACT(HOUR FROM target_hour)::integer as hour,
        COUNT(*) as calls_received,
        COUNT(CASE WHEN status IN ('connected', 'completed') THEN 1 END) as calls_accepted,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as calls_completed,
        COALESCE(SUM(charge_amount), 0) as total_cost,
        COALESCE(AVG(charge_amount), 0) as avg_cost,
        COALESCE(SUM(duration_seconds), 0) as total_duration,
        COALESCE(AVG(duration_seconds), 0) as avg_duration,
        AVG(quality_score) as quality_score_avg
    FROM calls
    WHERE started_at >= target_hour 
    AND started_at < target_hour + INTERVAL '1 hour'
    AND buyer_campaign_id IS NOT NULL
    GROUP BY buyer_campaign_id
    ON CONFLICT (buyer_campaign_id, date, hour) 
    DO UPDATE SET
        calls_received = EXCLUDED.calls_received,
        calls_accepted = EXCLUDED.calls_accepted,
        calls_completed = EXCLUDED.calls_completed,
        total_cost = EXCLUDED.total_cost,
        avg_cost = EXCLUDED.avg_cost,
        total_duration = EXCLUDED.total_duration,
        avg_duration = EXCLUDED.avg_duration,
        quality_score_avg = EXCLUDED.quality_score_avg,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get campaign performance summary
CREATE OR REPLACE FUNCTION get_campaign_performance(
    campaign_uuid UUID,
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_calls', COALESCE(SUM(calls_count), 0),
        'connected_calls', COALESCE(SUM(connected_calls), 0),
        'completed_calls', COALESCE(SUM(completed_calls), 0),
        'total_duration', COALESCE(SUM(total_duration), 0),
        'total_payout', COALESCE(SUM(total_payout), 0),
        'avg_quality_score', COALESCE(AVG(quality_score_avg), 0),
        'connection_rate', CASE 
            WHEN SUM(calls_count) > 0 THEN 
                ROUND((SUM(connected_calls)::decimal / SUM(calls_count)) * 100, 2)
            ELSE 0 
        END,
        'completion_rate', CASE 
            WHEN SUM(calls_count) > 0 THEN 
                ROUND((SUM(completed_calls)::decimal / SUM(calls_count)) * 100, 2)
            ELSE 0 
        END
    ) INTO result
    FROM campaign_stats
    WHERE campaign_id = campaign_uuid
    AND date BETWEEN start_date AND end_date;
    
    RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================
-- VALIDATION FUNCTIONS
-- ================================

-- Function to validate phone number format
CREATE OR REPLACE FUNCTION validate_phone_number(phone_number VARCHAR(20))
RETURNS BOOLEAN AS $$
BEGIN
    -- Basic US phone number validation (can be enhanced for international)
    RETURN phone_number ~ '^\+?1?[2-9][0-8][0-9][2-9][0-9]{2}[0-9]{4}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

-- Function to validate campaign targeting
CREATE OR REPLACE FUNCTION validate_campaign_targeting(targeting JSONB)
RETURNS BOOLEAN AS $$
BEGIN
    -- Basic validation - ensure required fields exist
    IF NOT (targeting ? 'geographic' AND targeting ? 'schedule') THEN
        RETURN false;
    END IF;
    
    -- Validate geographic targeting
    IF NOT (targeting->'geographic' ? 'states' OR targeting->'geographic' ? 'regions') THEN
        RETURN false;
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

-- ================================
-- UTILITY FUNCTIONS
-- ================================

-- Function to generate unique tracking number
CREATE OR REPLACE FUNCTION generate_tracking_number(campaign_uuid UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
    base_number VARCHAR(10);
    area_code VARCHAR(3) := '800'; -- Default toll-free area code
    sequence_num INTEGER;
    tracking_number VARCHAR(20);
BEGIN
    -- Get next sequence number for this campaign
    SELECT COALESCE(MAX(
        CAST(
            SUBSTRING(number FROM '[0-9]{4}$') AS INTEGER
        )
    ), 0) + 1 INTO sequence_num
    FROM tracking_numbers
    WHERE campaign_id = campaign_uuid;
    
    -- Generate the tracking number
    tracking_number := area_code || LPAD(
        (EXTRACT(epoch FROM NOW())::bigint % 1000)::text, 3, '0'
    ) || LPAD(sequence_num::text, 4, '0');
    
    RETURN tracking_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old audit logs (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_audit_logs(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_logs
    WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================
-- GRANT PERMISSIONS
-- ================================

-- Grant execute permissions to authenticated users for business functions
GRANT EXECUTE ON FUNCTION calculate_supplier_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_buyer_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_quality_score(INTEGER, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION detect_fraud_indicators(VARCHAR, INTEGER, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION find_matching_buyer_campaigns(UUID, JSONB, TIMESTAMP WITH TIME ZONE) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_call_billing(UUID, UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_campaign_performance(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_phone_number(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_campaign_targeting(JSONB) TO authenticated;

-- Grant to service role for system functions
GRANT EXECUTE ON FUNCTION process_hourly_stats(TIMESTAMP WITH TIME ZONE) TO service_role;
GRANT EXECUTE ON FUNCTION generate_tracking_number(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_audit_logs(INTEGER) TO service_role;

-- Comments for documentation
COMMENT ON FUNCTION calculate_supplier_balance IS 'Calculate supplier available balance from completed calls minus payouts';
COMMENT ON FUNCTION calculate_buyer_balance IS 'Calculate buyer remaining credit balance';
COMMENT ON FUNCTION calculate_quality_score IS 'Calculate call quality score based on duration and metadata';
COMMENT ON FUNCTION detect_fraud_indicators IS 'Analyze call data for fraud indicators and return risk assessment';
COMMENT ON FUNCTION find_matching_buyer_campaigns IS 'Find active buyer campaigns that match supplier traffic';
COMMENT ON FUNCTION calculate_call_billing IS 'Calculate payout, charge, and margin amounts for a call';
COMMENT ON FUNCTION process_hourly_stats IS 'Process and aggregate hourly campaign statistics';
COMMENT ON FUNCTION get_campaign_performance IS 'Get performance summary for a campaign over date range';
COMMENT ON FUNCTION validate_phone_number IS 'Validate phone number format';
COMMENT ON FUNCTION validate_campaign_targeting IS 'Validate campaign targeting configuration';
COMMENT ON FUNCTION generate_tracking_number IS 'Generate unique tracking number for campaign';
COMMENT ON FUNCTION cleanup_audit_logs IS 'Clean up old audit log entries for maintenance';