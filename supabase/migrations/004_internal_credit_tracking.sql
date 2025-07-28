-- Internal Credit Tracking System
-- This migration ensures we have basic credit tracking for suppliers and buyers
-- Note: This is NOT for Stripe/payment processing - just internal bookkeeping

-- Check if columns already exist and add them if missing
DO $$
BEGIN
  -- Add credit_balance to suppliers if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'suppliers' AND column_name = 'credit_balance'
  ) THEN
    ALTER TABLE suppliers ADD COLUMN credit_balance DECIMAL(12,2) DEFAULT 0.00;
    COMMENT ON COLUMN suppliers.credit_balance IS 'Internal credit balance for tracking earnings (not real money)';
  END IF;

  -- Add credit tracking to buyers if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'buyers' AND column_name = 'credit_limit'
  ) THEN
    ALTER TABLE buyers ADD COLUMN credit_limit DECIMAL(12,2) DEFAULT 0.00;
    COMMENT ON COLUMN buyers.credit_limit IS 'Maximum spending limit for internal tracking';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'buyers' AND column_name = 'current_balance'
  ) THEN
    ALTER TABLE buyers ADD COLUMN current_balance DECIMAL(12,2) DEFAULT 0.00;
    COMMENT ON COLUMN buyers.current_balance IS 'Current spending balance for internal tracking';
  END IF;

  -- Add bid_floor to campaigns if missing (for pricing display)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'bid_floor'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN bid_floor DECIMAL(8,2) DEFAULT 0.00;
    COMMENT ON COLUMN campaigns.bid_floor IS 'Minimum bid amount for this campaign';
  END IF;
END $$;

-- Add comments to clarify these are for internal use only
COMMENT ON TABLE suppliers IS 'Supplier accounts - credit_balance is for internal tracking only';
COMMENT ON TABLE buyers IS 'Buyer accounts - credit fields are for internal tracking only';

-- Create a simple credit transaction log for transparency
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('supplier', 'buyer')),
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('credit', 'debit', 'adjustment')),
    amount DECIMAL(12,2) NOT NULL,
    balance_before DECIMAL(12,2) NOT NULL,
    balance_after DECIMAL(12,2) NOT NULL,
    description TEXT,
    reference_id UUID, -- Can reference calls, campaigns, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Enable RLS on credit transactions
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own credit transactions
CREATE POLICY "Users can view own credit transactions" ON credit_transactions
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Only admins can create credit transactions
CREATE POLICY "Only admins can manage credit transactions" ON credit_transactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM admins 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);