import crypto from 'crypto'
import Stripe from 'stripe'
import { stripeServerClient, stripeConfig } from './client'
import { supabase } from '../../lib/supabase'
import { getErrorMessage } from '../../lib/error-utils'
import type { WebhookHandlerMap } from './types'

interface Request {
  body: unknown
  headers: Record<string, string | string[] | undefined>
}

interface Response {
  status: (code: number) => Response
  json: (data: unknown) => Response
  send: (data: unknown) => Response
}

export const verifyWebhookSignature = (
  payload: string | Buffer,
  signature: string
): Stripe.Event => {
  try {
    return stripeServerClient.webhooks.constructEvent(
      payload,
      signature,
      stripeConfig.webhookSecret
    )
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    throw new Error(`Webhook signature verification failed: ${errorMessage}`)
  }
}

const webhookHandlers: WebhookHandlerMap = {
  'payment_intent.succeeded': async (event) => {
    const paymentIntent = event.data.object as Stripe.PaymentIntent
    console.log('Payment succeeded:', paymentIntent.id)

    try {
      // Update invoice status in database
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: 'stripe',
          stripe_payment_intent_id: paymentIntent.id,
        })
        .eq('stripe_payment_intent_id', paymentIntent.id)

      if (updateError) {
        console.error('Failed to update invoice status:', updateError)
        return
      }

      // Get buyer information from metadata
      const buyerId = paymentIntent.metadata.buyer_id
      if (!buyerId) {
        console.error('No buyer_id in payment intent metadata')
        return
      }

      // Update buyer's current balance (add to credit)
      const { data: balanceResult, error: balanceError } = await supabase.rpc('add_buyer_credits', {
        buyer_id: buyerId,
        amount: paymentIntent.amount / 100,
        payment_intent_id: paymentIntent.id,
      })

      if (balanceError) {
        console.error('Failed to update buyer balance:', balanceError)
      } else if (balanceResult) {
        console.log(
          `Updated buyer ${buyerId} balance to ${balanceResult.new_balance} (transaction: ${balanceResult.transaction_id})`
        )
      }

      console.log(`Payment processed successfully for buyer ${buyerId}`)
    } catch (error) {
      console.error('Error processing payment success:', getErrorMessage(error))
    }
  },

  'payment_intent.payment_failed': async (event) => {
    const paymentIntent = event.data.object as Stripe.PaymentIntent
    console.error('Payment failed:', paymentIntent.id)

    try {
      // Mark invoice as failed
      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'overdue',
          metadata: {
            ...paymentIntent.metadata,
            failure_reason: paymentIntent.last_payment_error?.message,
          },
        })
        .eq('stripe_payment_intent_id', paymentIntent.id)

      if (error) {
        console.error('Failed to update invoice status:', error)
        return
      }

      // Get buyer information and check for recurring failures
      const buyerId = paymentIntent.metadata.buyer_id
      if (buyerId) {
        const { data: recentFailures } = await supabase
          .from('invoices')
          .select('id')
          .eq('buyer_id', buyerId)
          .eq('status', 'overdue')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

        // If 3+ failures in last week, pause campaigns
        if (recentFailures && recentFailures.length >= 3) {
          await supabase
            .from('buyer_campaigns')
            .update({ status: 'paused' })
            .eq('buyer_id', buyerId)
            .eq('status', 'active')

          console.log(`Paused campaigns for buyer ${buyerId} due to recurring payment failures`)
        }
      }
    } catch (error) {
      console.error('Error processing payment failure:', getErrorMessage(error))
    }
  },

  'charge.dispute.created': async (event) => {
    const dispute = event.data.object as Stripe.Dispute
    console.warn('Dispute created:', dispute.id)

    try {
      // Create dispute record in database
      const { error } = await supabase.from('disputes').insert({
        call_id: dispute.metadata?.call_id,
        raised_by: dispute.metadata?.buyer_id,
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
    } catch (error) {
      console.error('Error processing dispute creation:', getErrorMessage(error))
    }
  },

  'account.updated': async (event) => {
    const account = event.data.object as Stripe.Account
    console.log('Connected account updated:', account.id)

    try {
      // Find supplier with this Stripe account
      const { data: supplier, error: findError } = await supabase
        .from('suppliers')
        .select('id, user_id')
        .eq('metadata->stripe_account_id', account.id)
        .maybeSingle()

      if (findError || !supplier) {
        console.error('Could not find supplier for account:', account.id)
        return
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

      console.log(`Updated supplier ${supplier.id} status based on Stripe account ${account.id}`)
    } catch (error) {
      console.error('Error processing account update:', getErrorMessage(error))
    }
  },

  'payout.created': async (event) => {
    const payout = event.data.object as Stripe.Payout
    console.log('Payout created:', payout.id)

    try {
      // Create payout record in database
      const { error } = await supabase.from('payouts').insert({
        supplier_id: payout.metadata?.supplier_id || '',
        amount: payout.amount / 100,
        fee_amount: 0, // Stripe fees are handled separately
        net_amount: payout.amount / 100,
        status: 'processing',
        period_start: payout.metadata?.period_start || '',
        period_end: payout.metadata?.period_end || '',
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
    } catch (error) {
      console.error('Error processing payout creation:', getErrorMessage(error))
    }
  },

  'payout.paid': async (event) => {
    const payout = event.data.object as Stripe.Payout
    console.log('Payout completed:', payout.id)

    try {
      // Mark payout as completed
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
    } catch (error) {
      console.error('Error processing payout completion:', getErrorMessage(error))
    }
  },

  'payout.failed': async (event) => {
    const payout = event.data.object as Stripe.Payout
    console.error('Payout failed:', payout.id)

    try {
      // Mark payout as failed
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

      // TODO: Send notification to supplier and admin
      // TODO: Schedule retry or manual intervention
    } catch (error) {
      console.error('Error processing payout failure:', getErrorMessage(error))
    }
  },

  'transfer.created': async (event) => {
    const transfer = event.data.object as Stripe.Transfer
    console.log('Transfer created:', transfer.id)

    // Transfers are handled by payout events
    // This is mainly for logging and audit trail
  },

  'transfer.reversed': async (event) => {
    const transfer = event.data.object as Stripe.Transfer
    console.warn('Transfer reversed:', transfer.id)

    try {
      // Find and update related payout
      const { error } = await supabase
        .from('payouts')
        .update({
          status: 'cancelled',
          notes: `Transfer reversed: Unknown reason`,
        })
        .eq('transaction_id', transfer.id)

      if (error) {
        console.error('Failed to update payout for reversed transfer:', error)
      }
    } catch (error) {
      console.error('Error processing transfer reversal:', getErrorMessage(error))
    }
  },
}

export const handleStripeWebhook = async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers['stripe-signature'] as string

  if (!signature) {
    res.status(400).send('Missing stripe-signature header')
    return
  }

  let event: Stripe.Event

  try {
    event = verifyWebhookSignature(req.body as string | Buffer, signature)
  } catch (err) {
    console.error('Webhook signature verification failed:', getErrorMessage(err))
    res.status(400).send(`Webhook Error: ${getErrorMessage(err)}`)
    return
  }

  const handler = webhookHandlers[event.type]

  if (handler) {
    try {
      await handler(event)
      res.json({ received: true })
    } catch (err) {
      console.error(`Error handling webhook ${event.type}:`, getErrorMessage(err))
      res.status(500).send(`Webhook handler error: ${getErrorMessage(err)}`)
    }
  } else {
    console.log(`Unhandled webhook event type: ${event.type}`)
    res.json({ received: true })
  }
}

export const timingSafeEqual = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)

  if (bufferA.length !== bufferB.length) {
    return false
  }

  return crypto.timingSafeEqual(bufferA, bufferB)
}
