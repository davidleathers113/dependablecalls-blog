-- DCE Platform Row Level Security Policies
-- Implements comprehensive RLS policies for data security and privacy

-- Note: RLS enablement is handled by 002_conditional_rls_setup.sql
-- This migration focuses on creating the actual policies

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admins 
        WHERE user_id = user_uuid AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is supplier
CREATE OR REPLACE FUNCTION is_supplier(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM suppliers 
        WHERE user_id = user_uuid AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is buyer
CREATE OR REPLACE FUNCTION is_buyer(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM buyers 
        WHERE user_id = user_uuid AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get supplier ID for current user
CREATE OR REPLACE FUNCTION get_supplier_id(user_uuid UUID DEFAULT auth.uid())
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT id FROM suppliers 
        WHERE user_id = user_uuid AND status = 'active'
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get buyer ID for current user
CREATE OR REPLACE FUNCTION get_buyer_id(user_uuid UUID DEFAULT auth.uid())
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT id FROM buyers 
        WHERE user_id = user_uuid AND status = 'active'
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================
-- USERS TABLE POLICIES
-- ================================

-- Users can view their own profile and basic info of others (for collaboration)
CREATE POLICY "users_select_policy" ON users
    FOR SELECT USING (
        auth.uid() = id OR -- Own profile
        is_admin() OR -- Admins can see all
        EXISTS ( -- Users involved in same calls can see basic info
            SELECT 1 FROM calls c
            JOIN campaigns camp ON c.campaign_id = camp.id
            JOIN suppliers s ON camp.supplier_id = s.id
            WHERE s.user_id = users.id OR c.buyer_campaign_id IN (
                SELECT bc.id FROM buyer_campaigns bc
                JOIN buyers b ON bc.buyer_id = b.id
                WHERE b.user_id = auth.uid()
            )
        )
    );

-- Users can only update their own profile
CREATE POLICY "users_update_policy" ON users
    FOR UPDATE USING (auth.uid() = id);

-- ================================
-- ADMIN TABLE POLICIES
-- ================================

-- Only admins can see admin records
CREATE POLICY "admins_select_policy" ON admins
    FOR SELECT USING (is_admin());

-- Only super admins can modify admin records
CREATE POLICY "admins_modify_policy" ON admins
    FOR ALL USING (
        is_admin() AND EXISTS (
            SELECT 1 FROM admins 
            WHERE user_id = auth.uid() 
            AND (permissions->>'super_admin')::boolean = true
        )
    );

-- ================================
-- SUPPLIERS TABLE POLICIES
-- ================================

-- Suppliers can see their own profile, buyers can see suppliers they work with
CREATE POLICY "suppliers_select_policy" ON suppliers
    FOR SELECT USING (
        user_id = auth.uid() OR -- Own profile
        is_admin() OR -- Admin access
        (is_buyer() AND EXISTS ( -- Buyers can see suppliers they've received calls from
            SELECT 1 FROM calls c
            JOIN campaigns camp ON c.campaign_id = camp.id
            WHERE camp.supplier_id = suppliers.id
            AND c.buyer_campaign_id IN (
                SELECT bc.id FROM buyer_campaigns bc
                WHERE bc.buyer_id = get_buyer_id()
            )
        ))
    );

-- Suppliers can update their own profile
CREATE POLICY "suppliers_update_policy" ON suppliers
    FOR UPDATE USING (user_id = auth.uid());

-- Admins can insert/delete suppliers
CREATE POLICY "suppliers_admin_policy" ON suppliers
    FOR ALL USING (is_admin());

-- ================================
-- BUYERS TABLE POLICIES
-- ================================

-- Buyers can see their own profile, suppliers can see buyers they work with
CREATE POLICY "buyers_select_policy" ON buyers
    FOR SELECT USING (
        user_id = auth.uid() OR -- Own profile
        is_admin() OR -- Admin access
        (is_supplier() AND EXISTS ( -- Suppliers can see buyers who've received their calls
            SELECT 1 FROM calls c
            JOIN buyer_campaigns bc ON c.buyer_campaign_id = bc.id
            WHERE bc.buyer_id = buyers.id
            AND c.campaign_id IN (
                SELECT camp.id FROM campaigns camp
                WHERE camp.supplier_id = get_supplier_id()
            )
        ))
    );

-- Buyers can update their own profile
CREATE POLICY "buyers_update_policy" ON buyers
    FOR UPDATE USING (user_id = auth.uid());

-- Admins can insert/delete buyers
CREATE POLICY "buyers_admin_policy" ON buyers
    FOR ALL USING (is_admin());

-- ================================
-- CAMPAIGNS TABLE POLICIES
-- ================================

-- Suppliers see their own campaigns, buyers see campaigns they can bid on or have worked with
CREATE POLICY "campaigns_select_policy" ON campaigns
    FOR SELECT USING (
        (is_supplier() AND supplier_id = get_supplier_id()) OR -- Own campaigns
        is_admin() OR -- Admin access
        (is_buyer() AND ( -- Buyers can see active campaigns or those they've worked with
            (status = 'active' AND EXISTS (
                SELECT 1 FROM buyer_campaigns bc
                WHERE bc.buyer_id = get_buyer_id()
                AND bc.status = 'active'
            )) OR
            EXISTS (
                SELECT 1 FROM calls c
                JOIN buyer_campaigns bc ON c.buyer_campaign_id = bc.id
                WHERE c.campaign_id = campaigns.id
                AND bc.buyer_id = get_buyer_id()
            )
        ))
    );

-- Suppliers can modify their own campaigns
CREATE POLICY "campaigns_modify_policy" ON campaigns
    FOR ALL USING (
        (is_supplier() AND supplier_id = get_supplier_id()) OR
        is_admin()
    );

-- ================================
-- BUYER CAMPAIGNS TABLE POLICIES
-- ================================

-- Buyers see their own campaigns, suppliers see campaigns that match their traffic
CREATE POLICY "buyer_campaigns_select_policy" ON buyer_campaigns
    FOR SELECT USING (
        (is_buyer() AND buyer_id = get_buyer_id()) OR -- Own campaigns
        is_admin() OR -- Admin access
        (is_supplier() AND ( -- Suppliers can see active buyer campaigns they could match
            status = 'active' OR
            EXISTS (
                SELECT 1 FROM calls c
                JOIN campaigns camp ON c.campaign_id = camp.id
                WHERE c.buyer_campaign_id = buyer_campaigns.id
                AND camp.supplier_id = get_supplier_id()
            )
        ))
    );

-- Buyers can modify their own campaigns
CREATE POLICY "buyer_campaigns_modify_policy" ON buyer_campaigns
    FOR ALL USING (
        (is_buyer() AND buyer_id = get_buyer_id()) OR
        is_admin()
    );

-- ================================
-- TRACKING NUMBERS TABLE POLICIES
-- ================================

-- Access tied to campaign ownership
CREATE POLICY "tracking_numbers_policy" ON tracking_numbers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM campaigns c
            WHERE c.id = tracking_numbers.campaign_id
            AND ((is_supplier() AND c.supplier_id = get_supplier_id()) OR is_admin())
        )
    );

-- ================================
-- CALLS TABLE POLICIES
-- ================================

-- Most complex policy - suppliers see their calls, buyers see calls they received
CREATE POLICY "calls_select_policy" ON calls
    FOR SELECT USING (
        is_admin() OR -- Admin access
        EXISTS (
            SELECT 1 FROM campaigns camp
            WHERE camp.id = calls.campaign_id
            AND camp.supplier_id = get_supplier_id()
        ) OR -- Supplier's calls
        EXISTS (
            SELECT 1 FROM buyer_campaigns bc
            WHERE bc.id = calls.buyer_campaign_id
            AND bc.buyer_id = get_buyer_id()
        ) -- Buyer's calls
    );

-- System can insert calls, admins can modify
CREATE POLICY "calls_insert_policy" ON calls
    FOR INSERT WITH CHECK (true); -- Allow system inserts

CREATE POLICY "calls_update_policy" ON calls
    FOR UPDATE USING (
        is_admin() OR
        EXISTS (
            SELECT 1 FROM campaigns camp
            WHERE camp.id = calls.campaign_id
            AND camp.supplier_id = get_supplier_id()
        ) OR
        EXISTS (
            SELECT 1 FROM buyer_campaigns bc
            WHERE bc.id = calls.buyer_campaign_id
            AND bc.buyer_id = get_buyer_id()
        )
    );

-- ================================
-- CALL LOGS TABLE POLICIES
-- ================================

-- Access based on call ownership
CREATE POLICY "call_logs_policy" ON call_logs
    FOR ALL USING (
        is_admin() OR
        EXISTS (
            SELECT 1 FROM calls c
            JOIN campaigns camp ON c.campaign_id = camp.id
            WHERE c.id = call_logs.call_id
            AND camp.supplier_id = get_supplier_id()
        ) OR
        EXISTS (
            SELECT 1 FROM calls c
            JOIN buyer_campaigns bc ON c.buyer_campaign_id = bc.id
            WHERE c.id = call_logs.call_id
            AND bc.buyer_id = get_buyer_id()
        )
    );

-- ================================
-- FINANCIAL TABLE POLICIES
-- ================================

-- Payouts - suppliers see their own, admins see all
CREATE POLICY "payouts_select_policy" ON payouts
    FOR SELECT USING (
        (is_supplier() AND supplier_id = get_supplier_id()) OR
        is_admin()
    );

CREATE POLICY "payouts_admin_policy" ON payouts
    FOR ALL USING (is_admin());

-- Invoices - buyers see their own, admins see all
CREATE POLICY "invoices_select_policy" ON invoices
    FOR SELECT USING (
        (is_buyer() AND buyer_id = get_buyer_id()) OR
        is_admin()
    );

CREATE POLICY "invoices_admin_policy" ON invoices
    FOR ALL USING (is_admin());

-- Invoice line items - tied to invoice access
CREATE POLICY "invoice_line_items_policy" ON invoice_line_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM invoices i
            WHERE i.id = invoice_line_items.invoice_id
            AND ((is_buyer() AND i.buyer_id = get_buyer_id()) OR is_admin())
        )
    );

-- ================================
-- QUALITY & COMPLIANCE POLICIES
-- ================================

-- Quality scores - tied to call access
CREATE POLICY "call_quality_scores_select_policy" ON call_quality_scores
    FOR SELECT USING (
        is_admin() OR
        EXISTS (
            SELECT 1 FROM calls c
            JOIN campaigns camp ON c.campaign_id = camp.id
            WHERE c.id = call_quality_scores.call_id
            AND camp.supplier_id = get_supplier_id()
        ) OR
        EXISTS (
            SELECT 1 FROM calls c
            JOIN buyer_campaigns bc ON c.buyer_campaign_id = bc.id
            WHERE c.id = call_quality_scores.call_id
            AND bc.buyer_id = get_buyer_id()
        )
    );

-- Admin and system can modify quality scores
CREATE POLICY "call_quality_scores_modify_policy" ON call_quality_scores
    FOR ALL USING (is_admin());

-- Disputes - parties involved can see/create, admins manage
CREATE POLICY "disputes_select_policy" ON disputes
    FOR SELECT USING (
        raised_by = auth.uid() OR -- Dispute creator
        assigned_to = auth.uid() OR -- Assigned handler
        is_admin() OR -- Admin access
        EXISTS (
            SELECT 1 FROM calls c
            JOIN campaigns camp ON c.campaign_id = camp.id
            WHERE c.id = disputes.call_id
            AND camp.supplier_id = get_supplier_id()
        ) OR
        EXISTS (
            SELECT 1 FROM calls c
            JOIN buyer_campaigns bc ON c.buyer_campaign_id = bc.id
            WHERE c.id = disputes.call_id
            AND bc.buyer_id = get_buyer_id()
        )
    );

-- Users can create disputes for their calls
CREATE POLICY "disputes_insert_policy" ON disputes
    FOR INSERT WITH CHECK (
        raised_by = auth.uid() AND
        EXISTS (
            SELECT 1 FROM calls c
            WHERE c.id = call_id
            AND (
                EXISTS (
                    SELECT 1 FROM campaigns camp
                    WHERE camp.id = c.campaign_id
                    AND camp.supplier_id = get_supplier_id()
                ) OR
                EXISTS (
                    SELECT 1 FROM buyer_campaigns bc
                    WHERE bc.id = c.buyer_campaign_id
                    AND bc.buyer_id = get_buyer_id()
                )
            )
        )
    );

-- Admins can update disputes
CREATE POLICY "disputes_update_policy" ON disputes
    FOR UPDATE USING (is_admin());

-- ================================
-- ANALYTICS TABLE POLICIES
-- ================================

-- Campaign stats - tied to campaign ownership
CREATE POLICY "campaign_stats_policy" ON campaign_stats
    FOR ALL USING (
        is_admin() OR
        EXISTS (
            SELECT 1 FROM campaigns c
            WHERE c.id = campaign_stats.campaign_id
            AND c.supplier_id = get_supplier_id()
        )
    );

-- Buyer campaign stats - tied to buyer campaign ownership
CREATE POLICY "buyer_campaign_stats_policy" ON buyer_campaign_stats
    FOR ALL USING (
        is_admin() OR
        EXISTS (
            SELECT 1 FROM buyer_campaigns bc
            WHERE bc.id = buyer_campaign_stats.buyer_campaign_id
            AND bc.buyer_id = get_buyer_id()
        )
    );

-- ================================
-- AUDIT LOG POLICIES
-- ================================

-- Audit logs - users can see their own actions, admins see all
CREATE POLICY "audit_logs_select_policy" ON audit_logs
    FOR SELECT USING (
        user_id = auth.uid() OR
        is_admin()
    );

-- System can insert audit logs
CREATE POLICY "audit_logs_insert_policy" ON audit_logs
    FOR INSERT WITH CHECK (true);

-- Only admins can modify audit logs
CREATE POLICY "audit_logs_admin_policy" ON audit_logs
    FOR UPDATE USING (is_admin());

-- No deletion of audit logs
CREATE POLICY "audit_logs_no_delete" ON audit_logs
    FOR DELETE USING (false);

-- ================================
-- FUNCTION SECURITY
-- ================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_supplier(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_buyer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_supplier_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_buyer_id(UUID) TO authenticated;

-- Comments for documentation
COMMENT ON FUNCTION is_admin IS 'Check if user has admin privileges';
COMMENT ON FUNCTION is_supplier IS 'Check if user is an active supplier';
COMMENT ON FUNCTION is_buyer IS 'Check if user is an active buyer';
COMMENT ON FUNCTION get_supplier_id IS 'Get supplier ID for user';
COMMENT ON FUNCTION get_buyer_id IS 'Get buyer ID for user';