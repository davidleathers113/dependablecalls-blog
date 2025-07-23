import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, stripe-signature',
}

interface Database {
  public: {
    Tables: {
      invoices: {
        Row: {
          id: string
          buyer_id: string
          status: string
          paid_at: string | null
          stripe_payment_intent_id: string | null
        }
        Insert: {
          status?: string
          paid_at?: string | null
          stripe_payment_intent_id?: string | null
        }
        Update: {
          status?: string
          paid_at?: string | null
          stripe_payment_intent_id?: string | null
        }
      }
      buyers: {
        Row: {
          id: string
          current_balance: number
        }
        Update: {
          current_balance?: number
        }
      }
      buyer_campaigns: {
        Row: {
          id: string
          buyer_id: string
          status: string
        }
        Update: {
          status?: string
        }
      }
      suppliers: {
        Row: {
          id: string
          user_id: string
          status: string
          settings: unknown
        }
        Update: {
          status?: string
          settings?: unknown
        }
      }
      payouts: {
        Row: {
          id: string
          supplier_id: string
          status: string
          transaction_id: string
        }
        Insert: {
          supplier_id: string
          amount: number
          fee_amount?: number
          net_amount: number
          status?: string
          period_start: string
          period_end: string
          payment_method?: string
          transaction_id?: string
          payment_details?: unknown
        }
        Update: {
          status?: string
          paid_at?: string
          processed_at?: string
          notes?: string
        }
      }
      disputes: {
        Insert: {
          call_id?: string
          raised_by?: string
          dispute_type: string
          reason: string
          description?: string
          amount_disputed?: number
          status?: string
          priority?: string
          evidence?: unknown
        }
      }
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
    })

    const supabase = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      return new Response('Missing stripe-signature header', {
        status: 400,
        headers: corsHeaders,
      })
    }

    const body = await req.text()
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured')
      return new Response('Webhook secret not configured', {
        status: 500,
        headers: corsHeaders,
      })
    }

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return new Response(`Webhook Error: ${err.message}`, {
        status: 400,
        headers: corsHeaders,
      })
    }

    console.log(`Processing webhook event: ${event.type}`)

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        console.log('Payment succeeded:', paymentIntent.id)

        // Update invoice status
        const { error: invoiceError } = await supabase
          .from('invoices')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id: paymentIntent.id,
          })
          .eq('stripe_payment_intent_id', paymentIntent.id)

        if (invoiceError) {
          console.error('Failed to update invoice:', invoiceError)
          break
        }

        // Update buyer balance if buyer_id is in metadata
        const buyerId = paymentIntent.metadata.buyer_id
        if (buyerId) {
          const { error: balanceError } = await supabase.rpc('update_buyer_balance', {
            buyer_uuid: buyerId,
            amount_to_add: paymentIntent.amount / 100,
          })

          if (balanceError) {
            console.error('Failed to update buyer balance:', balanceError)
          }
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        console.error('Payment failed:', paymentIntent.id)

        // Mark invoice as overdue
        const { error } = await supabase
          .from('invoices')
          .update({
            status: 'overdue',
          })
          .eq('stripe_payment_intent_id', paymentIntent.id)

        if (error) {
          console.error('Failed to update invoice status:', error)
          break
        }

        // Check for recurring failures and pause campaigns if needed
        const buyerId = paymentIntent.metadata.buyer_id
        if (buyerId) {
          const { data: recentFailures } = await supabase
            .from('invoices')
            .select('id')
            .eq('buyer_id', buyerId)
            .eq('status', 'overdue')
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

          if (recentFailures && recentFailures.length >= 3) {
            await supabase
              .from('buyer_campaigns')
              .update({ status: 'paused' })
              .eq('buyer_id', buyerId)
              .eq('status', 'active')

            console.log(`Paused campaigns for buyer ${buyerId} due to recurring payment failures`)
          }
        }
        break
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute
        console.warn('Dispute created:', dispute.id)

        const { error } = await supabase.from('disputes').insert({
          call_id: dispute.metadata.call_id,
          raised_by: dispute.metadata.buyer_id,
          dispute_type: 'billing',
          reason: `Stripe dispute: ${dispute.reason}`,
          description: `Dispute created for charge ${dispute.charge}. Reason: ${dispute.reason}`,
          amount_disputed: dispute.amount / 100,
          status: 'open',
          priority: 'high',
          evidence: [
            {
              type: 'stripe_dispute',
              dispute_id: dispute.id,
              reason: dispute.reason,
              evidence_details: dispute.evidence_details,
            },
          ],
        })

        if (error) {
          console.error('Failed to create dispute record:', error)
        }
        break
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account
        console.log('Connected account updated:', account.id)

        // Find supplier with this Stripe account
        const { data: supplier, error: findError } = await supabase
          .from('suppliers')
          .select('id, user_id')
          .contains('settings', { stripe_account_id: account.id })
          .single()

        if (findError || !supplier) {
          console.error('Could not find supplier for account:', account.id)
          break
        }

        // Update supplier status based on account capabilities
        const canReceivePayouts = account.charges_enabled && account.payouts_enabled
        const requiresAction =
          account.requirements?.currently_due && account.requirements.currently_due.length > 0

        const { error: updateError } = await supabase
          .from('suppliers')
          .update({
            status: canReceivePayouts && !requiresAction ? 'active' : 'pending',
            settings: {
              stripe_account_status: {
                charges_enabled: account.charges_enabled,
                payouts_enabled: account.payouts_enabled,
                details_submitted: account.details_submitted,
                requirements_due: account.requirements?.currently_due || [],
              },
            },
          })
          .eq('id', supplier.id)

        if (updateError) {
          console.error('Failed to update supplier status:', updateError)
        }
        break
      }

      case 'payout.created': {
        const payout = event.data.object as Stripe.Payout
        console.log('Payout created:', payout.id)

        const { error } = await supabase.from('payouts').insert({
          supplier_id: payout.metadata.supplier_id,
          amount: payout.amount / 100,
          fee_amount: 0,
          net_amount: payout.amount / 100,
          status: 'processing',
          period_start: payout.metadata.period_start,
          period_end: payout.metadata.period_end,
          payment_method: 'stripe',
          transaction_id: payout.id,
          payment_details: {
            stripe_payout_id: payout.id,
            currency: payout.currency,
            method: payout.method,
            bank_account: payout.destination,
          },
        })

        if (error) {
          console.error('Failed to create payout record:', error)
        }
        break
      }

      case 'payout.paid': {
        const payout = event.data.object as Stripe.Payout
        console.log('Payout completed:', payout.id)

        const { error } = await supabase
          .from('payouts')
          .update({
            status: 'completed',
            paid_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
          })
          .eq('transaction_id', payout.id)

        if (error) {
          console.error('Failed to update payout status:', error)
        }
        break
      }

      case 'payout.failed': {
        const payout = event.data.object as Stripe.Payout
        console.error('Payout failed:', payout.id)

        const { error } = await supabase
          .from('payouts')
          .update({
            status: 'failed',
            notes: `Payout failed: ${payout.failure_message || 'Unknown error'}`,
          })
          .eq('transaction_id', payout.id)

        if (error) {
          console.error('Failed to update payout status:', error)
        }
        break
      }

      case 'transfer.reversed': {
        const transfer = event.data.object as Stripe.Transfer
        console.warn('Transfer reversed:', transfer.id)

        const { error } = await supabase
          .from('payouts')
          .update({
            status: 'cancelled',
            notes: `Transfer reversed: ${transfer.reversal_details?.reason || 'Unknown reason'}`,
          })
          .eq('transaction_id', transfer.id)

        if (error) {
          console.error('Failed to update payout for reversed transfer:', error)
        }
        break
      }

      default:
        console.log(`Unhandled webhook event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      status: 200,
    })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return new Response(
      JSON.stringify({
        error: error.message,
        received: false,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 500,
      }
    )
  }
})
