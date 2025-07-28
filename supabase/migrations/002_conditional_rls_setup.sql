-- Conditional RLS setup that checks table existence
-- This prevents errors when tables might not exist due to migration order

-- Helper function to check if a table exists
CREATE OR REPLACE FUNCTION table_exists(table_name text) 
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND information_schema.tables.table_name = $1
  );
END;
$$ LANGUAGE plpgsql;

-- Apply RLS policies conditionally
DO $$
BEGIN
  -- Core tables that should always exist
  IF table_exists('users') THEN
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF table_exists('admins') THEN
    ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF table_exists('suppliers') THEN
    ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF table_exists('buyers') THEN
    ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF table_exists('campaigns') THEN
    ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF table_exists('buyer_campaigns') THEN
    ALTER TABLE buyer_campaigns ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF table_exists('tracking_numbers') THEN
    ALTER TABLE tracking_numbers ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF table_exists('calls') THEN
    ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF table_exists('call_logs') THEN
    ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
  END IF;
  
  -- Tables that might not exist (billing-related)
  IF table_exists('payouts') THEN
    ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF table_exists('invoices') THEN
    ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF table_exists('invoice_line_items') THEN
    ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
  END IF;
  
  -- Analytics tables
  IF table_exists('call_quality_scores') THEN
    ALTER TABLE call_quality_scores ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF table_exists('disputes') THEN
    ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF table_exists('campaign_stats') THEN
    ALTER TABLE campaign_stats ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF table_exists('buyer_campaign_stats') THEN
    ALTER TABLE buyer_campaign_stats ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF table_exists('audit_logs') THEN
    ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Clean up helper function
DROP FUNCTION IF EXISTS table_exists(text);