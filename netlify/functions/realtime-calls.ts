import type { Handler } from '@netlify/functions'
import { withAuth, ApiError } from '../../src/lib/auth-middleware'
import { z } from 'zod'

const callSubscriptionSchema = z.object({
  action: z.enum(['subscribe', 'unsubscribe']),
  callId: z.string().uuid('Invalid call ID').optional(),
  campaignId: z.string().uuid('Invalid campaign ID').optional(),
  filters: z
    .object({
      status: z
        .array(z.enum(['initiated', 'ringing', 'connected', 'completed', 'failed', 'rejected']))
        .optional(),
      qualityScoreMin: z.number().min(0).max(100).optional(),
      dateRange: z
        .object({
          start: z.string().datetime(),
          end: z.string().datetime(),
        })
        .optional(),
    })
    .optional(),
})

type CallSubscriptionRequest = z.infer<typeof callSubscriptionSchema>

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  return withAuth(event, async (context, request) => {
    if (!request.body) {
      throw new ApiError('Request body is required', 400)
    }

    const requestData: CallSubscriptionRequest = callSubscriptionSchema.parse(
      JSON.parse(request.body)
    )

    // Generate channel name and filters based on user role
    let channelName = 'calls'
    const channelFilters: string[] = []

    // Role-based filtering
    if (context.user?.role === 'supplier') {
      // Suppliers only see calls from their campaigns
      const { data: supplierData } = await context.supabase
        .from('suppliers')
        .select('id')
        .eq('user_id', context.user.id)
        .single()

      if (supplierData) {
        // Get all campaigns for this supplier
        const { data: campaigns } = await context.supabase
          .from('campaigns')
          .select('id')
          .eq('supplier_id', supplierData.id)

        if (campaigns && campaigns.length > 0) {
          const campaignIds = campaigns.map((c) => c.id)
          channelFilters.push(`campaign_id=in.(${campaignIds.join(',')})`)
        } else {
          // No campaigns, no calls to see
          throw new ApiError('No campaigns found for supplier', 404, 'NO_CAMPAIGNS')
        }
      }
    } else if (context.user?.role === 'buyer') {
      // Buyers see calls from their buyer campaigns
      const { data: buyerData } = await context.supabase
        .from('buyers')
        .select('id')
        .eq('user_id', context.user.id)
        .single()

      if (buyerData) {
        // Get all buyer campaigns
        const { data: buyerCampaigns } = await context.supabase
          .from('buyer_campaigns')
          .select('id')
          .eq('buyer_id', buyerData.id)

        if (buyerCampaigns && buyerCampaigns.length > 0) {
          const campaignIds = buyerCampaigns.map((bc) => bc.id)
          channelFilters.push(`buyer_campaign_id=in.(${campaignIds.join(',')})`)
        }
      }
    }
    // Admins see all calls (no filtering)

    // Specific campaign filter
    if (requestData.campaignId) {
      // Verify access to the campaign
      const { data: campaign } = await context.supabase
        .from('campaigns')
        .select('id, supplier_id')
        .eq('id', requestData.campaignId)
        .single()

      if (!campaign) {
        throw new ApiError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND')
      }

      // Check access permissions for suppliers
      if (context.user?.role === 'supplier') {
        const { data: supplierData } = await context.supabase
          .from('suppliers')
          .select('id')
          .eq('user_id', context.user.id)
          .single()

        if (!supplierData || campaign.supplier_id !== supplierData.id) {
          throw new ApiError('Access denied', 403, 'ACCESS_DENIED')
        }
      }

      channelFilters.push(`campaign_id=eq.${requestData.campaignId}`)
    }

    // Specific call subscription
    if (requestData.callId) {
      // Verify access to the call
      const { data: call } = await context.supabase
        .from('calls')
        .select('id, campaign_id, buyer_campaign_id')
        .eq('id', requestData.callId)
        .single()

      if (!call) {
        throw new ApiError('Call not found', 404, 'CALL_NOT_FOUND')
      }

      // Verify user has access to this call based on campaign ownership
      // (Access check logic would go here based on role)

      channelName = `calls:id=eq.${requestData.callId}`
    }

    // Apply additional filters
    if (requestData.filters) {
      if (requestData.filters.status && requestData.filters.status.length > 0) {
        const statusFilter = requestData.filters.status.map((s) => `status=eq.${s}`).join(',')
        channelFilters.push(`(${statusFilter})`)
      }

      if (requestData.filters.qualityScoreMin !== undefined) {
        channelFilters.push(`quality_score=gte.${requestData.filters.qualityScoreMin}`)
      }

      if (requestData.filters.dateRange) {
        channelFilters.push(`started_at=gte.${requestData.filters.dateRange.start}`)
        channelFilters.push(`started_at=lte.${requestData.filters.dateRange.end}`)
      }
    }

    // Build final channel name
    if (channelFilters.length > 0 && !requestData.callId) {
      channelName = `calls:${channelFilters.join(':')}`
    }

    // Create subscription configuration
    const subscriptionConfig = {
      event: '*', // Listen to all events
      schema: 'public',
      table: 'calls',
      filter: channelFilters.length > 0 ? channelFilters.join(' AND ') : undefined,
    }

    // Generate JWT token for real-time subscription
    const realtimeToken = await context.supabase.auth.getSession()

    if (!realtimeToken.data.session) {
      throw new ApiError('Failed to generate realtime token', 500, 'TOKEN_GENERATION_FAILED')
    }

    // Get call quality subscription config if needed
    const qualitySubscriptionConfig = requestData.callId
      ? {
          event: '*',
          schema: 'public',
          table: 'call_quality_scores',
          filter: `call_id=eq.${requestData.callId}`,
        }
      : null

    return {
      success: true,
      action: requestData.action,
      subscription: {
        channel: channelName,
        config: subscriptionConfig,
        qualityConfig: qualitySubscriptionConfig,
        token: realtimeToken.data.session.access_token,
        url: process.env.VITE_SUPABASE_URL || '',
        anonKey: process.env.VITE_SUPABASE_ANON_KEY || '',
      },
      instructions: {
        subscribe: `Use the Supabase client to subscribe to channel: ${channelName}`,
        events: ['INSERT', 'UPDATE', 'DELETE'],
        example: `
          const channel = supabase
            .channel('${channelName}')
            .on('postgres_changes', ${JSON.stringify(subscriptionConfig, null, 2)}, 
              (payload) => {
                console.log('Call change:', payload)
                // Handle different event types
                switch(payload.eventType) {
                  case 'INSERT':
                    // New call started
                    break;
                  case 'UPDATE':
                    // Call status updated
                    break;
                  case 'DELETE':
                    // Call removed (rare)
                    break;
                }
              }
            )
            ${
              qualitySubscriptionConfig
                ? `.on('postgres_changes', ${JSON.stringify(
                    qualitySubscriptionConfig,
                    null,
                    2
                  )}, (payload) => console.log('Quality score update:', payload))`
                : ''
            }
            .subscribe()
        `,
      },
    }
  })
}