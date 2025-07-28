-- Fix Enhanced RLS Policies to match actual schema
-- This migration corrects the schema mismatches in 009_enhanced_rls_policies.sql

-- Drop incorrect policies from 009
DROP POLICY IF EXISTS "Users can view campaigns based on role" ON campaigns;
DROP POLICY IF EXISTS "Users can create campaigns based on role" ON campaigns;
DROP POLICY IF EXISTS "Users can update campaigns based on role" ON campaigns;
DROP POLICY IF EXISTS "Users can delete campaigns based on role" ON campaigns;

DROP POLICY IF EXISTS "Users can view calls based on role" ON calls;
DROP POLICY IF EXISTS "Users can create calls based on role" ON calls;
DROP POLICY IF EXISTS "Users can update calls based on role" ON calls;

DROP POLICY IF EXISTS "Users can view buyer campaigns based on role" ON buyer_campaigns;
DROP POLICY IF EXISTS "Users can manage buyer campaigns based on role" ON buyer_campaigns;

DROP POLICY IF EXISTS "Users can view invoices based on role" ON invoices;
DROP POLICY IF EXISTS "Users can create invoices based on role" ON invoices;
DROP POLICY IF EXISTS "Users can update invoices based on role" ON invoices;

DROP POLICY IF EXISTS "Users can view payouts based on role" ON payouts;
DROP POLICY IF EXISTS "Users can create payouts based on role" ON payouts;
DROP POLICY IF EXISTS "Users can update payouts based on role" ON payouts;

DROP POLICY IF EXISTS "Users can view quality scores based on role" ON call_quality_scores;
DROP POLICY IF EXISTS "Users can manage quality scores based on role" ON call_quality_scores;

-- Create corrected policies for campaigns table (supplier campaigns)
CREATE POLICY "Users can view campaigns based on role"
  ON campaigns FOR SELECT
  TO authenticated
  USING (
    -- Suppliers can see their own campaigns
    (supplier_id IN (SELECT id FROM suppliers WHERE user_id = auth.uid()) AND check_user_permission(auth.uid(), 'campaigns', 'read')) OR
    -- Buyers can see active campaigns they can participate in
    (status = 'active' AND check_user_permission(auth.uid(), 'marketplace', 'browse')) OR
    -- Network and Admin can see all campaigns
    check_user_permission(auth.uid(), 'campaigns', 'list')
  );

CREATE POLICY "Users can create campaigns based on role"
  ON campaigns FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Suppliers can create campaigns
    (supplier_id IN (SELECT id FROM suppliers WHERE user_id = auth.uid()) AND check_user_permission(auth.uid(), 'campaigns', 'create')) OR
    -- Admins can create campaigns for any supplier
    check_user_permission(auth.uid(), 'campaigns', 'create')
  );

CREATE POLICY "Users can update campaigns based on role"
  ON campaigns FOR UPDATE
  TO authenticated
  USING (
    -- Suppliers can update their own campaigns
    (supplier_id IN (SELECT id FROM suppliers WHERE user_id = auth.uid()) AND check_user_permission(auth.uid(), 'campaigns', 'update')) OR
    -- Network and Admin can update any campaign
    check_user_permission(auth.uid(), 'campaigns', 'manage')
  )
  WITH CHECK (
    (supplier_id IN (SELECT id FROM suppliers WHERE user_id = auth.uid()) AND check_user_permission(auth.uid(), 'campaigns', 'update')) OR
    check_user_permission(auth.uid(), 'campaigns', 'manage')
  );

CREATE POLICY "Users can delete campaigns based on role"
  ON campaigns FOR DELETE
  TO authenticated
  USING (
    -- Suppliers can delete their own campaigns
    (supplier_id IN (SELECT id FROM suppliers WHERE user_id = auth.uid()) AND check_user_permission(auth.uid(), 'campaigns', 'delete')) OR
    -- Admins can delete any campaign
    check_user_permission(auth.uid(), 'campaigns', 'delete')
  );

-- Create corrected policies for buyer_campaigns table
CREATE POLICY "Users can view buyer campaigns based on role"
  ON buyer_campaigns FOR SELECT
  TO authenticated
  USING (
    -- Buyers can see their own campaigns
    (buyer_id IN (SELECT id FROM buyers WHERE user_id = auth.uid()) AND check_user_permission(auth.uid(), 'campaigns', 'read')) OR
    -- Suppliers can see active buyer campaigns to understand market demand
    (status = 'active' AND check_user_permission(auth.uid(), 'marketplace', 'browse')) OR
    -- Network and Admin can see all buyer campaigns
    check_user_permission(auth.uid(), 'campaigns', 'list')
  );

CREATE POLICY "Users can manage buyer campaigns based on role"
  ON buyer_campaigns FOR ALL
  TO authenticated
  USING (
    (buyer_id IN (SELECT id FROM buyers WHERE user_id = auth.uid()) AND check_user_permission(auth.uid(), 'campaigns', 'create')) OR
    check_user_permission(auth.uid(), 'campaigns', 'manage')
  )
  WITH CHECK (
    (buyer_id IN (SELECT id FROM buyers WHERE user_id = auth.uid()) AND check_user_permission(auth.uid(), 'campaigns', 'create')) OR
    check_user_permission(auth.uid(), 'campaigns', 'manage')
  );

-- Create corrected policies for calls table
CREATE POLICY "Users can view calls based on role"
  ON calls FOR SELECT
  TO authenticated
  USING (
    -- Suppliers can see calls from their campaigns
    (campaign_id IN (
      SELECT id FROM campaigns WHERE supplier_id IN (SELECT id FROM suppliers WHERE user_id = auth.uid())
    ) AND check_user_permission(auth.uid(), 'calls', 'read')) OR
    -- Buyers can see calls for their buyer campaigns
    (buyer_campaign_id IN (
      SELECT id FROM buyer_campaigns WHERE buyer_id IN (SELECT id FROM buyers WHERE user_id = auth.uid())
    ) AND check_user_permission(auth.uid(), 'calls', 'read')) OR
    -- Network and Admin can see all calls
    check_user_permission(auth.uid(), 'calls', 'list')
  );

CREATE POLICY "Users can create calls based on role"
  ON calls FOR INSERT
  TO authenticated
  WITH CHECK (
    -- System can create calls (for webhooks and API)
    check_user_permission(auth.uid(), 'calls', 'create')
  );

CREATE POLICY "Users can update calls based on role"
  ON calls FOR UPDATE
  TO authenticated
  USING (
    -- Suppliers can update calls from their campaigns
    (campaign_id IN (
      SELECT id FROM campaigns WHERE supplier_id IN (SELECT id FROM suppliers WHERE user_id = auth.uid())
    ) AND check_user_permission(auth.uid(), 'calls', 'update')) OR
    -- Network and Admin can update any call
    check_user_permission(auth.uid(), 'calls', 'update')
  )
  WITH CHECK (
    (campaign_id IN (
      SELECT id FROM campaigns WHERE supplier_id IN (SELECT id FROM suppliers WHERE user_id = auth.uid())
    ) AND check_user_permission(auth.uid(), 'calls', 'update')) OR
    check_user_permission(auth.uid(), 'calls', 'update')
  );

-- Create corrected policies for invoices table
CREATE POLICY "Users can view invoices based on role"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    -- Buyers can see their own invoices
    (buyer_id IN (SELECT id FROM buyers WHERE user_id = auth.uid()) AND check_user_permission(auth.uid(), 'transactions', 'read')) OR
    -- Network and Admin can see all invoices
    check_user_permission(auth.uid(), 'transactions', 'list')
  );

CREATE POLICY "Users can create invoices based on role"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    check_user_permission(auth.uid(), 'transactions', 'create')
  );

CREATE POLICY "Users can update invoices based on role"
  ON invoices FOR UPDATE
  TO authenticated
  USING (
    check_user_permission(auth.uid(), 'transactions', 'approve')
  )
  WITH CHECK (
    check_user_permission(auth.uid(), 'transactions', 'approve')
  );

-- Create corrected policies for payouts table
CREATE POLICY "Users can view payouts based on role"
  ON payouts FOR SELECT
  TO authenticated
  USING (
    -- Suppliers can see their own payouts
    (supplier_id IN (SELECT id FROM suppliers WHERE user_id = auth.uid()) AND check_user_permission(auth.uid(), 'transactions', 'read')) OR
    -- Network and Admin can see all payouts
    check_user_permission(auth.uid(), 'transactions', 'list')
  );

CREATE POLICY "Users can create payouts based on role"
  ON payouts FOR INSERT
  TO authenticated
  WITH CHECK (
    check_user_permission(auth.uid(), 'transactions', 'create')
  );

CREATE POLICY "Users can update payouts based on role"
  ON payouts FOR UPDATE
  TO authenticated
  USING (
    check_user_permission(auth.uid(), 'transactions', 'approve')
  )
  WITH CHECK (
    check_user_permission(auth.uid(), 'transactions', 'approve')
  );

-- Create corrected policies for call_quality_scores table
CREATE POLICY "Users can view quality scores based on role"
  ON call_quality_scores FOR SELECT
  TO authenticated
  USING (
    -- Users involved in the call can see quality scores
    (call_id IN (
      SELECT c.id FROM calls c
      JOIN campaigns camp ON c.campaign_id = camp.id
      WHERE camp.supplier_id IN (SELECT id FROM suppliers WHERE user_id = auth.uid())
    )) OR
    (call_id IN (
      SELECT c.id FROM calls c
      JOIN buyer_campaigns bc ON c.buyer_campaign_id = bc.id
      WHERE bc.buyer_id IN (SELECT id FROM buyers WHERE user_id = auth.uid())
    )) OR
    -- Network and Admin can see all quality scores
    check_user_permission(auth.uid(), 'quality', 'view')
  );

CREATE POLICY "Users can manage quality scores based on role"
  ON call_quality_scores FOR ALL
  TO authenticated
  USING (
    check_user_permission(auth.uid(), 'quality', 'manage')
  )
  WITH CHECK (
    check_user_permission(auth.uid(), 'quality', 'manage')
  );

-- Comments for documentation
COMMENT ON POLICY "Users can view campaigns based on role" ON campaigns IS 'Fixed policy to correctly reference supplier_id instead of buyer_id';
COMMENT ON POLICY "Users can view buyer campaigns based on role" ON buyer_campaigns IS 'Fixed policy to correctly reference buyer_id through buyers table';

-- Keep the rest of the original migration content that wasn't broken
-- Enhanced RLS policies for suppliers table
CREATE POLICY "Users can view suppliers based on role"
  ON suppliers FOR SELECT
  TO authenticated
  USING (
    -- Suppliers can see their own profile
    (user_id = auth.uid()) OR
    -- Buyers and Network can see approved suppliers
    (status = 'active' AND (
      check_user_permission(auth.uid(), 'marketplace', 'browse') OR
      check_user_permission(auth.uid(), 'users', 'list')
    )) OR
    -- Admins can see all suppliers
    check_user_permission(auth.uid(), 'users', 'list')
  );

CREATE POLICY "Users can update suppliers based on role"
  ON suppliers FOR UPDATE
  TO authenticated
  USING (
    -- Suppliers can update their own profile
    (user_id = auth.uid()) OR
    -- Network and Admin can update supplier profiles
    check_user_permission(auth.uid(), 'users', 'update')
  )
  WITH CHECK (
    (user_id = auth.uid()) OR
    check_user_permission(auth.uid(), 'users', 'update')
  );

-- Enhanced RLS policies for buyers table
CREATE POLICY "Users can view buyers based on role"
  ON buyers FOR SELECT
  TO authenticated
  USING (
    -- Buyers can see their own profile
    (user_id = auth.uid()) OR
    -- Suppliers and Network can see active buyers
    (status = 'active' AND (
      check_user_permission(auth.uid(), 'marketplace', 'browse') OR
      check_user_permission(auth.uid(), 'users', 'list')
    )) OR
    -- Admins can see all buyers
    check_user_permission(auth.uid(), 'users', 'list')
  );

CREATE POLICY "Users can update buyers based on role"
  ON buyers FOR UPDATE
  TO authenticated
  USING (
    -- Buyers can update their own profile
    (user_id = auth.uid()) OR
    -- Network and Admin can update buyer profiles
    check_user_permission(auth.uid(), 'users', 'update')
  )
  WITH CHECK (
    (user_id = auth.uid()) OR
    check_user_permission(auth.uid(), 'users', 'update')
  );

-- Enhanced RLS policies for transactions table (if exists)
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='transactions') THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
    
    -- Create new RBAC policies
    EXECUTE 'CREATE POLICY "Users can view transactions based on role"
      ON transactions FOR SELECT
      TO authenticated
      USING (
        -- Users can see their own transactions
        (user_id = auth.uid() AND check_user_permission(auth.uid(), ''transactions'', ''read'')) OR
        -- Network and Admin can see all transactions
        check_user_permission(auth.uid(), ''transactions'', ''list'')
      )';
      
    EXECUTE 'CREATE POLICY "Users can create transactions based on role"
      ON transactions FOR INSERT
      TO authenticated
      WITH CHECK (
        check_user_permission(auth.uid(), ''transactions'', ''create'')
      )';
  END IF;
END $$;

-- Enhanced RLS policies for disputes table
CREATE POLICY "Users can view disputes based on role"
  ON disputes FOR SELECT
  TO authenticated
  USING (
    -- Users involved in the disputed call can see the dispute
    (call_id IN (
      SELECT c.id FROM calls c
      JOIN campaigns camp ON c.campaign_id = camp.id
      WHERE camp.supplier_id IN (SELECT id FROM suppliers WHERE user_id = auth.uid())
    )) OR
    (call_id IN (
      SELECT c.id FROM calls c
      JOIN buyer_campaigns bc ON c.buyer_campaign_id = bc.id
      WHERE bc.buyer_id IN (SELECT id FROM buyers WHERE user_id = auth.uid())
    )) OR
    -- Users who raised the dispute can see it
    (raised_by = auth.uid()) OR
    -- Network and Admin can see all disputes
    check_user_permission(auth.uid(), 'quality', 'dispute')
  );

CREATE POLICY "Users can create disputes based on role"
  ON disputes FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Users involved in calls can create disputes
    (call_id IN (
      SELECT c.id FROM calls c
      JOIN campaigns camp ON c.campaign_id = camp.id
      WHERE camp.supplier_id IN (SELECT id FROM suppliers WHERE user_id = auth.uid())
    )) OR
    (call_id IN (
      SELECT c.id FROM calls c
      JOIN buyer_campaigns bc ON c.buyer_campaign_id = bc.id
      WHERE bc.buyer_id IN (SELECT id FROM buyers WHERE user_id = auth.uid())
    )) OR
    -- Network can create disputes
    check_user_permission(auth.uid(), 'quality', 'dispute')
  );

CREATE POLICY "Users can update disputes based on role"
  ON disputes FOR UPDATE
  TO authenticated
  USING (
    check_user_permission(auth.uid(), 'quality', 'dispute')
  )
  WITH CHECK (
    check_user_permission(auth.uid(), 'quality', 'dispute')
  );

-- Create view for user permissions (for easier querying)
CREATE OR REPLACE VIEW user_permissions AS
SELECT DISTINCT
  ur.user_id,
  (perm->>'resource')::VARCHAR(100) as resource,
  (perm->>'action')::VARCHAR(50) as action,
  r.name as role_name
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
CROSS JOIN LATERAL jsonb_array_elements(r.permissions) as perm
WHERE ur.is_active = true 
  AND r.is_active = true
  AND (ur.expires_at IS NULL OR ur.expires_at > NOW());

-- Create view for user roles (for easier querying)
CREATE OR REPLACE VIEW user_roles_view AS
SELECT 
  ur.user_id,
  ur.role_id,
  r.name as role_name,
  r.description as role_description,
  ur.assigned_at,
  ur.expires_at,
  ur.is_active,
  r.permissions
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
WHERE ur.is_active = true 
  AND r.is_active = true
  AND (ur.expires_at IS NULL OR ur.expires_at > NOW());

-- Grant necessary permissions to authenticated users
GRANT SELECT ON user_permissions TO authenticated;
GRANT SELECT ON user_roles_view TO authenticated;

-- Comments for documentation
COMMENT ON VIEW user_permissions IS 'Flattened view of user permissions through their roles';
COMMENT ON VIEW user_roles_view IS 'View of active user role assignments with role details';