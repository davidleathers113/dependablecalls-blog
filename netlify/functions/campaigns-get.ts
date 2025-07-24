import type { Handler } from '@netlify/functions'
import { withAuth, ApiError } from '../../src/lib/auth-middleware'

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: '',
    }
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  return withAuth(event, async (context) => {
    const campaignId = event.path.split('/').pop()

    if (!campaignId) {
      throw new ApiError('Campaign ID is required', 400, 'MISSING_CAMPAIGN_ID')
    }

    // Get campaign with related data
    const { data: campaign, error: campaignError } = await context.supabase
      .from('campaigns')
      .select(
        `
        id,
        name,
        description,
        category,
        vertical,
        status,
        bid_floor,
        max_concurrent_calls,
        quality_threshold,
        recording_enabled,
        targeting,
        created_at,
        updated_at,
        suppliers!campaigns_supplier_id_fkey (
          id,
          company_name,
          business_type,
          users!suppliers_user_id_fkey (
            first_name,
            last_name,
            email
          )
        )
      `
      )
      .eq('id', campaignId)
      .single()

    if (campaignError) {
      console.error('Error fetching campaign:', campaignError)
      throw new ApiError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND')
    }

    // Check access permissions
    if (context.user?.role === 'supplier') {
      const { data: supplierData } = await context.supabase
        .from('suppliers')
        .select('id')
        .eq('user_id', context.user.id)
        .single()

      if (!supplierData || campaign.suppliers?.id !== supplierData.id) {
        throw new ApiError('Access denied', 403, 'ACCESS_DENIED')
      }
    }
    // Buyers can view active campaigns, admins can view all campaigns

    // Get campaign statistics
    const { data: stats } = await context.supabase
      .from('campaign_stats')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('date', { ascending: false })
      .limit(30) // Last 30 days

    // Get recent calls for this campaign
    const { data: recentCalls } = await context.supabase
      .from('calls')
      .select(
        `
        id,
        tracking_number,
        caller_number,
        duration_seconds,
        status,
        quality_score,
        payout_amount,
        charge_amount,
        started_at,
        ended_at,
        caller_location,
        metadata
      `
      )
      .eq('campaign_id', campaignId)
      .order('started_at', { ascending: false })
      .limit(10)

    // Get tracking numbers for this campaign
    const { data: trackingNumbers } = await context.supabase
      .from('tracking_numbers')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('is_active', true)

    return {
      success: true,
      data: {
        campaign,
        stats: stats || [],
        recentCalls: recentCalls || [],
        trackingNumbers: trackingNumbers || [],
      },
    }
  })
}
