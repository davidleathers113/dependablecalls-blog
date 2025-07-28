-- DCE Platform Database Triggers
-- Automated processes, audit logging, and data validation triggers

-- ================================
-- AUDIT LOGGING TRIGGERS
-- ================================

-- Enhanced audit trigger function with more context
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
    user_uuid UUID;
    user_ip INET;
    user_agent TEXT;
BEGIN
    -- Get current user info
    user_uuid := auth.uid();
    
    -- Try to get additional context (may not always be available)
    BEGIN
        user_ip := inet(current_setting('request.headers')::json->>'x-forwarded-for');
    EXCEPTION WHEN OTHERS THEN
        user_ip := NULL;
    END;
    
    BEGIN
        user_agent := current_setting('request.headers')::json->>'user-agent';
    EXCEPTION WHEN OTHERS THEN
        user_agent := NULL;
    END;
    
    INSERT INTO audit_logs (
        table_name,
        operation,
        user_id,
        record_id,
        old_data,
        new_data,
        ip_address,
        user_agent
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        user_uuid,
        CASE 
            WHEN TG_OP = 'DELETE' THEN (OLD.id)::UUID
            ELSE (NEW.id)::UUID
        END,
        CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW) ELSE NULL END,
        user_ip,
        user_agent
    );
    
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to sensitive tables
CREATE TRIGGER audit_users_trigger
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_suppliers_trigger
    AFTER INSERT OR UPDATE OR DELETE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_buyers_trigger
    AFTER INSERT OR UPDATE OR DELETE ON buyers
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_campaigns_trigger
    AFTER INSERT OR UPDATE OR DELETE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_buyer_campaigns_trigger
    AFTER INSERT OR UPDATE OR DELETE ON buyer_campaigns
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_calls_trigger
    AFTER INSERT OR UPDATE OR DELETE ON calls
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_payouts_trigger
    AFTER INSERT OR UPDATE OR DELETE ON payouts
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_invoices_trigger
    AFTER INSERT OR UPDATE OR DELETE ON invoices
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_disputes_trigger
    AFTER INSERT OR UPDATE OR DELETE ON disputes
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ================================
-- BUSINESS LOGIC TRIGGERS
-- ================================

-- Trigger to automatically process call quality and billing
CREATE OR REPLACE FUNCTION process_call_completion()
RETURNS TRIGGER AS $$
DECLARE
    quality_result JSONB;
    fraud_result JSONB;
    billing_result JSONB;
    call_quality_score INTEGER;
BEGIN
    -- Only process when call status changes to completed
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        
        -- Calculate quality score
        call_quality_score := calculate_quality_score(NEW.duration_seconds, NEW.metadata);
        
        -- Detect fraud indicators
        fraud_result := detect_fraud_indicators(
            NEW.caller_number, 
            NEW.duration_seconds, 
            NEW.caller_location, 
            NEW.metadata
        );
        
        -- Calculate billing amounts if not already set
        IF NEW.payout_amount = 0 AND NEW.charge_amount = 0 AND NEW.campaign_id IS NOT NULL AND NEW.buyer_campaign_id IS NOT NULL THEN
            billing_result := calculate_call_billing(
                NEW.campaign_id, 
                NEW.buyer_campaign_id, 
                NEW.duration_seconds, 
                call_quality_score
            );
            
            NEW.payout_amount := (billing_result->>'payout_amount')::DECIMAL;
            NEW.charge_amount := (billing_result->>'charge_amount')::DECIMAL;
            NEW.margin_amount := (billing_result->>'margin_amount')::DECIMAL;
        END IF;
        
        -- Update quality and fraud scores
        NEW.quality_score := call_quality_score;
        NEW.fraud_score := (fraud_result->>'fraud_score')::INTEGER;
        
        -- Add fraud flags to metadata
        IF fraud_result->>'suspicious' = 'true' THEN
            NEW.metadata := NEW.metadata || jsonb_build_object('fraud_flags', fraud_result->'flags');
        END IF;
        
        -- Insert detailed quality score record
        INSERT INTO call_quality_scores (
            call_id,
            duration_score,
            overall_score,
            flags,
            scoring_model
        ) VALUES (
            NEW.id,
            CASE 
                WHEN NEW.duration_seconds >= 120 THEN 100
                WHEN NEW.duration_seconds >= 60 THEN 80
                WHEN NEW.duration_seconds >= 30 THEN 60
                WHEN NEW.duration_seconds >= 15 THEN 40
                ELSE 20
            END,
            call_quality_score,
            fraud_result->'flags',
            'v1.0'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply call completion trigger
CREATE TRIGGER process_call_completion_trigger
    BEFORE UPDATE ON calls
    FOR EACH ROW EXECUTE FUNCTION process_call_completion();

-- ================================
-- BALANCE MANAGEMENT TRIGGERS
-- ================================

-- Trigger to update supplier balance when calls are completed or payouts processed
CREATE OR REPLACE FUNCTION update_supplier_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Update supplier credit balance
    IF TG_TABLE_NAME = 'calls' AND NEW.status = 'completed' THEN
        UPDATE suppliers 
        SET credit_balance = calculate_supplier_balance(
            (SELECT supplier_id FROM campaigns WHERE id = NEW.campaign_id)
        )
        WHERE id = (SELECT supplier_id FROM campaigns WHERE id = NEW.campaign_id);
        
    ELSIF TG_TABLE_NAME = 'payouts' AND NEW.status = 'completed' THEN
        UPDATE suppliers 
        SET credit_balance = calculate_supplier_balance(NEW.supplier_id)
        WHERE id = NEW.supplier_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply balance update triggers
CREATE TRIGGER update_supplier_balance_calls_trigger
    AFTER UPDATE ON calls
    FOR EACH ROW EXECUTE FUNCTION update_supplier_balance();

CREATE TRIGGER update_supplier_balance_payouts_trigger
    AFTER UPDATE ON payouts
    FOR EACH ROW EXECUTE FUNCTION update_supplier_balance();

-- Trigger to update buyer balance when calls are charged or invoices are paid
CREATE OR REPLACE FUNCTION update_buyer_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Update buyer current balance
    IF TG_TABLE_NAME = 'calls' AND NEW.status = 'completed' THEN
        UPDATE buyers 
        SET current_balance = calculate_buyer_balance(
            (SELECT buyer_id FROM buyer_campaigns WHERE id = NEW.buyer_campaign_id)
        )
        WHERE id = (SELECT buyer_id FROM buyer_campaigns WHERE id = NEW.buyer_campaign_id);
        
    ELSIF TG_TABLE_NAME = 'invoices' AND NEW.status = 'paid' THEN
        UPDATE buyers 
        SET current_balance = calculate_buyer_balance(NEW.buyer_id)
        WHERE id = NEW.buyer_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply buyer balance update triggers
CREATE TRIGGER update_buyer_balance_calls_trigger
    AFTER UPDATE ON calls
    FOR EACH ROW EXECUTE FUNCTION update_buyer_balance();

CREATE TRIGGER update_buyer_balance_invoices_trigger
    AFTER UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_buyer_balance();

-- ================================
-- VALIDATION TRIGGERS
-- ================================

-- Trigger to validate campaign data before insert/update
CREATE OR REPLACE FUNCTION validate_campaign_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate bid floor is positive
    IF NEW.bid_floor < 0 THEN
        RAISE EXCEPTION 'Bid floor must be positive';
    END IF;
    
    -- Validate targeting configuration
    IF NOT validate_campaign_targeting(NEW.targeting) THEN
        RAISE EXCEPTION 'Invalid campaign targeting configuration';
    END IF;
    
    -- Validate tracking numbers if provided
    IF NEW.tracking_numbers IS NOT NULL THEN
        DECLARE
            number_item JSONB;
        BEGIN
            FOR number_item IN SELECT jsonb_array_elements(NEW.tracking_numbers)
            LOOP
                IF NOT validate_phone_number(number_item->>'number') THEN
                    RAISE EXCEPTION 'Invalid tracking number format: %', number_item->>'number';
                END IF;
            END LOOP;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply campaign validation trigger
CREATE TRIGGER validate_campaign_data_trigger
    BEFORE INSERT OR UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION validate_campaign_data();

-- Trigger to validate buyer campaign data
CREATE OR REPLACE FUNCTION validate_buyer_campaign_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate max bid is positive
    IF NEW.max_bid <= 0 THEN
        RAISE EXCEPTION 'Max bid must be positive';
    END IF;
    
    -- Validate budget constraints
    IF NEW.daily_budget IS NOT NULL AND NEW.daily_budget <= 0 THEN
        RAISE EXCEPTION 'Daily budget must be positive';
    END IF;
    
    IF NEW.monthly_budget IS NOT NULL AND NEW.monthly_budget <= 0 THEN
        RAISE EXCEPTION 'Monthly budget must be positive';
    END IF;
    
    -- Ensure daily budget doesn't exceed monthly budget
    IF NEW.daily_budget IS NOT NULL AND NEW.monthly_budget IS NOT NULL THEN
        IF NEW.daily_budget * 31 > NEW.monthly_budget THEN
            RAISE EXCEPTION 'Daily budget would exceed monthly budget';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply buyer campaign validation trigger
CREATE TRIGGER validate_buyer_campaign_data_trigger
    BEFORE INSERT OR UPDATE ON buyer_campaigns
    FOR EACH ROW EXECUTE FUNCTION validate_buyer_campaign_data();

-- ================================
-- NOTIFICATION TRIGGERS
-- ================================

-- Trigger to send real-time notifications for important events
CREATE OR REPLACE FUNCTION send_realtime_notifications()
RETURNS TRIGGER AS $$
BEGIN
    -- Send notifications for different events
    CASE TG_TABLE_NAME
        WHEN 'calls' THEN
            IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
                PERFORM pg_notify(
                    'call_completed',
                    json_build_object(
                        'call_id', NEW.id,
                        'campaign_id', NEW.campaign_id,
                        'buyer_campaign_id', NEW.buyer_campaign_id,
                        'payout_amount', NEW.payout_amount,
                        'charge_amount', NEW.charge_amount,
                        'quality_score', NEW.quality_score
                    )::text
                );
            END IF;
            
        WHEN 'disputes' THEN
            IF TG_OP = 'INSERT' THEN
                PERFORM pg_notify(
                    'dispute_created',
                    json_build_object(
                        'dispute_id', NEW.id,
                        'call_id', NEW.call_id,
                        'raised_by', NEW.raised_by,
                        'dispute_type', NEW.dispute_type,
                        'reason', NEW.reason
                    )::text
                );
            END IF;
            
        WHEN 'payouts' THEN
            IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
                PERFORM pg_notify(
                    'payout_completed',
                    json_build_object(
                        'payout_id', NEW.id,
                        'supplier_id', NEW.supplier_id,
                        'amount', NEW.amount,
                        'transaction_id', NEW.transaction_id
                    )::text
                );
            END IF;
    END CASE;
    
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply notification triggers
CREATE TRIGGER send_call_notifications_trigger
    AFTER INSERT OR UPDATE ON calls
    FOR EACH ROW EXECUTE FUNCTION send_realtime_notifications();

CREATE TRIGGER send_dispute_notifications_trigger
    AFTER INSERT OR UPDATE ON disputes
    FOR EACH ROW EXECUTE FUNCTION send_realtime_notifications();

CREATE TRIGGER send_payout_notifications_trigger
    AFTER INSERT OR UPDATE ON payouts
    FOR EACH ROW EXECUTE FUNCTION send_realtime_notifications();

-- ================================
-- DATA INTEGRITY TRIGGERS
-- ================================

-- Trigger to ensure tracking numbers are unique and properly formatted
CREATE OR REPLACE FUNCTION manage_tracking_numbers()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-generate tracking number if not provided
    IF NEW.number IS NULL OR NEW.number = '' THEN
        NEW.number := generate_tracking_number(NEW.campaign_id);
    END IF;
    
    -- Validate number format
    IF NOT validate_phone_number(NEW.number) THEN
        RAISE EXCEPTION 'Invalid tracking number format: %', NEW.number;
    END IF;
    
    -- Set display number (formatted version)
    NEW.display_number := CASE 
        WHEN LENGTH(NEW.number) = 11 AND LEFT(NEW.number, 1) = '1' THEN
            '(' || SUBSTRING(NEW.number, 2, 3) || ') ' || 
            SUBSTRING(NEW.number, 5, 3) || '-' || 
            SUBSTRING(NEW.number, 8, 4)
        WHEN LENGTH(NEW.number) = 10 THEN
            '(' || LEFT(NEW.number, 3) || ') ' || 
            SUBSTRING(NEW.number, 4, 3) || '-' || 
            RIGHT(NEW.number, 4)
        ELSE NEW.number
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply tracking number management trigger
CREATE TRIGGER manage_tracking_numbers_trigger
    BEFORE INSERT OR UPDATE ON tracking_numbers
    FOR EACH ROW EXECUTE FUNCTION manage_tracking_numbers();

-- ================================
-- AUTOMATIC STATS PROCESSING
-- ================================

-- Schedule hourly stats processing (requires pg_cron extension)
-- This would typically be set up separately in production
-- SELECT cron.schedule('process-hourly-stats', '0 * * * *', 'SELECT process_hourly_stats();');

-- Alternative: Trigger-based stats processing for real-time updates
CREATE OR REPLACE FUNCTION update_campaign_stats_realtime()
RETURNS TRIGGER AS $$
BEGIN
    -- Update daily stats when call is completed
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        
        -- Update campaign stats
        INSERT INTO campaign_stats (
            campaign_id, date, calls_count, connected_calls, 
            completed_calls, total_duration, total_payout
        )
        SELECT 
            NEW.campaign_id,
            NEW.started_at::date,
            1, 1, 1,
            NEW.duration_seconds,
            NEW.payout_amount
        WHERE NEW.campaign_id IS NOT NULL
        ON CONFLICT (campaign_id, date, hour)
        WHERE hour IS NULL
        DO UPDATE SET
            calls_count = campaign_stats.calls_count + 1,
            connected_calls = campaign_stats.connected_calls + 1,
            completed_calls = campaign_stats.completed_calls + 1,
            total_duration = campaign_stats.total_duration + NEW.duration_seconds,
            total_payout = campaign_stats.total_payout + NEW.payout_amount,
            updated_at = NOW();
        
        -- Update buyer campaign stats
        INSERT INTO buyer_campaign_stats (
            buyer_campaign_id, date, calls_received, calls_accepted,
            calls_completed, total_cost, total_duration
        )
        SELECT 
            NEW.buyer_campaign_id,
            NEW.started_at::date,
            1, 1, 1,
            NEW.charge_amount,
            NEW.duration_seconds
        WHERE NEW.buyer_campaign_id IS NOT NULL
        ON CONFLICT (buyer_campaign_id, date, hour)
        WHERE hour IS NULL
        DO UPDATE SET
            calls_received = buyer_campaign_stats.calls_received + 1,
            calls_accepted = buyer_campaign_stats.calls_accepted + 1,
            calls_completed = buyer_campaign_stats.calls_completed + 1,
            total_cost = buyer_campaign_stats.total_cost + NEW.charge_amount,
            total_duration = buyer_campaign_stats.total_duration + NEW.duration_seconds,
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply real-time stats trigger
CREATE TRIGGER update_campaign_stats_realtime_trigger
    AFTER UPDATE ON calls
    FOR EACH ROW EXECUTE FUNCTION update_campaign_stats_realtime();

-- Comments for documentation
COMMENT ON FUNCTION audit_trigger IS 'Comprehensive audit logging for sensitive table changes';
COMMENT ON FUNCTION process_call_completion IS 'Automated quality scoring and billing calculation for completed calls';
COMMENT ON FUNCTION update_supplier_balance IS 'Maintain accurate supplier balance based on calls and payouts';
COMMENT ON FUNCTION update_buyer_balance IS 'Maintain accurate buyer balance based on charges and payments';
COMMENT ON FUNCTION validate_campaign_data IS 'Validate campaign configuration before save';
COMMENT ON FUNCTION validate_buyer_campaign_data IS 'Validate buyer campaign configuration before save';
COMMENT ON FUNCTION send_realtime_notifications IS 'Send real-time notifications for important events';
COMMENT ON FUNCTION manage_tracking_numbers IS 'Auto-generate and format tracking numbers';
COMMENT ON FUNCTION update_campaign_stats_realtime IS 'Real-time campaign statistics updates';