import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database'
import { z } from 'zod'
import crypto from 'crypto'

// Initialize Supabase client with service role for webhook operations
const supabase = createClient<Database>(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role key for admin operations
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

// Call event schema from telephony provider
const callEventSchema = z.object({
  eventType: z.enum([
    'call.initiated',
    'call.ringing',
    'call.connected',
    'call.completed',
    'call.failed',
    'call.recording.ready',
    'call.transcription.ready',
  ]),
  callSid: z.string(),
  trackingNumber: z.string(),
  callerNumber: z.string(),
  destinationNumber: z.string().optional(),
  timestamp: z.string().datetime(),
  duration: z.number().optional(),
  recordingUrl: z.string().url().optional(),
  transcriptionText: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

type CallEvent = z.infer<typeof callEventSchema>

// Verify webhook signature
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  try {
    // Verify webhook signature
    const signature = event.headers['x-webhook-signature']
    const webhookSecret = process.env.TELEPHONY_WEBHOOK_SECRET

    if (!signature || !webhookSecret) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Missing signature or webhook secret' }),
      }
    }

    if (!verifyWebhookSignature(event.body!, signature, webhookSecret)) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid signature' }),
      }
    }

    // Parse and validate event data
    const eventData: CallEvent = callEventSchema.parse(JSON.parse(event.body!))

    // Find the call record by call SID
    const { data: existingCall, error: findError } = await supabase
      .from('calls')
      .select('*')
      .eq('call_sid', eventData.callSid)
      .single()

    if (findError && findError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is OK for initiated events
      console.error('Error finding call:', findError)
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Database error' }),
      }
    }

    // Handle different event types
    switch (eventData.eventType) {
      case 'call.initiated': {
        if (existingCall) {
          return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Call already exists' }),
          }
        }

        // Find campaign by tracking number
        const { data: trackingNumber } = await supabase
          .from('tracking_numbers')
          .select('campaign_id')
          .eq('number', eventData.trackingNumber)
          .eq('is_active', true)
          .single()

        if (!trackingNumber) {
          console.error('No active campaign found for tracking number:', eventData.trackingNumber)
          return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Tracking number not found' }),
          }
        }

        // Get campaign details
        const { data: campaign } = await supabase
          .from('campaigns')
          .select('id, supplier_id, bid_floor')
          .eq('id', trackingNumber.campaign_id)
          .eq('status', 'active')
          .single()

        if (!campaign) {
          return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Campaign not active' }),
          }
        }

        // Create new call record
        const { error: insertError } = await supabase.from('calls').insert({
          call_sid: eventData.callSid,
          campaign_id: campaign.id,
          supplier_id: campaign.supplier_id,
          tracking_number: eventData.trackingNumber,
          caller_number: eventData.callerNumber,
          destination_number: eventData.destinationNumber || null,
          status: 'initiated',
          started_at: eventData.timestamp,
          metadata: eventData.metadata || {},
        })

        if (insertError) {
          console.error('Error creating call:', insertError)
          return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to create call record' }),
          }
        }

        break
      }

      case 'call.ringing': {
        if (!existingCall) {
          return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Call not found' }),
          }
        }

        await supabase
          .from('calls')
          .update({
            status: 'ringing',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingCall.id)

        break
      }

      case 'call.connected': {
        if (!existingCall) {
          return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Call not found' }),
          }
        }

        await supabase
          .from('calls')
          .update({
            status: 'connected',
            connected_at: eventData.timestamp,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingCall.id)

        break
      }

      case 'call.completed': {
        if (!existingCall) {
          return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Call not found' }),
          }
        }

        // Calculate payout based on duration and campaign settings
        const duration = eventData.duration || 0
        const { data: campaign } = await supabase
          .from('campaigns')
          .select('bid_floor, quality_threshold')
          .eq('id', existingCall.campaign_id!)
          .single()

        let payoutAmount = 0
        if (campaign && duration >= 30) {
          // Basic payout calculation (can be enhanced with quality scoring)
          payoutAmount = campaign.bid_floor
        }

        await supabase
          .from('calls')
          .update({
            status: 'completed',
            ended_at: eventData.timestamp,
            duration_seconds: duration,
            payout_amount: payoutAmount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingCall.id)

        // Update supplier balance if payout is due
        if (payoutAmount > 0 && existingCall.supplier_id) {
          await supabase.rpc('add_supplier_credit', {
            supplier_id: existingCall.supplier_id,
            amount: payoutAmount,
            call_id: existingCall.id,
          })
        }

        break
      }

      case 'call.failed': {
        if (!existingCall) {
          return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Call not found' }),
          }
        }

        await supabase
          .from('calls')
          .update({
            status: 'failed',
            ended_at: eventData.timestamp,
            metadata: {
              ...((existingCall.metadata as object) || {}),
              failure_reason: eventData.metadata?.reason || 'Unknown',
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingCall.id)

        break
      }

      case 'call.recording.ready': {
        if (!existingCall) {
          return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Call not found' }),
          }
        }

        await supabase
          .from('calls')
          .update({
            recording_url: eventData.recordingUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingCall.id)

        // Trigger quality scoring if enabled
        // This could call another function or queue a job

        break
      }

      case 'call.transcription.ready': {
        if (!existingCall) {
          return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Call not found' }),
          }
        }

        await supabase
          .from('calls')
          .update({
            transcription: eventData.transcriptionText,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingCall.id)

        // Trigger quality scoring based on transcription
        // This could analyze keywords, intent, etc.

        break
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        eventType: eventData.eventType,
        callSid: eventData.callSid 
      }),
    }
  } catch (error) {
    console.error('Webhook error:', error)

    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Invalid event data', 
          details: error.errors 
        }),
      }
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    }
  }
}