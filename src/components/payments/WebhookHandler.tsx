import { useEffect, useRef, useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type Stripe from 'stripe'
import { RealtimeErrorBoundary } from '../realtime/RealtimeErrorBoundary'

interface WebhookPayload {
  id: string
  type: string
  data: {
    object: Stripe.Event.Data.Object
  }
  created: number
}

interface WebhookHandlerProps {
  onWebhookReceived?: (event: WebhookPayload) => void
}

// Inner component without error boundary
const WebhookHandlerInner: React.FC<WebhookHandlerProps> = ({ onWebhookReceived }) => {
  const handledEvents = useRef<Set<string>>(new Set())

  const handleWebhookEvent = useCallback(
    async (payload: { new: WebhookPayload }) => {
      const event = payload.new as WebhookPayload

      // Prevent duplicate processing
      if (handledEvents.current.has(event.id)) {
        return
      }
      handledEvents.current.add(event.id)

      try {
        logger.info('Processing webhook event', {
          type: event.type,
          id: event.id,
        })

        await processWebhookEvent(event)
        onWebhookReceived?.(event)
      } catch (error) {
        logger.error('Error processing webhook event', {
          eventId: event.id,
          eventType: event.type,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onWebhookReceived]
  )

  useEffect(() => {
    // Subscribe to real-time webhook events from Supabase
    const channel = supabase
      .channel('webhook-events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webhook_events',
        },
        handleWebhookEvent
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Webhook handler connected to real-time events')
        } else if (status === 'CLOSED') {
          logger.warn('Webhook handler disconnected from real-time events')
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('Webhook handler channel error')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [handleWebhookEvent])

  const processWebhookEvent = async (event: WebhookPayload) => {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent)
        break

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent)
        break

      case 'charge.dispute.created':
        await handleDisputeCreated(event.data.object as Stripe.Dispute)
        break

      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account)
        break

      case 'account.application.authorized':
        await handleAccountAuthorized(event.data.object as Stripe.Account)
        break

      case 'account.application.deauthorized':
        await handleAccountDeauthorized(event.data.object as Stripe.Account)
        break

      case 'payout.created':
        await handlePayoutCreated(event.data.object as Stripe.Payout)
        break

      case 'payout.paid':
        await handlePayoutPaid(event.data.object as Stripe.Payout)
        break

      case 'payout.failed':
        await handlePayoutFailed(event.data.object as Stripe.Payout)
        break

      case 'transfer.created':
        await handleTransferCreated(event.data.object as Stripe.Transfer)
        break

      case 'transfer.reversed':
        await handleTransferReversed(event.data.object as Stripe.Transfer)
        break

      default:
        logger.warn('Unhandled webhook event type', { type: event.type })
    }
  }

  const handlePaymentSucceeded = async (paymentIntent: Stripe.PaymentIntent) => {
    const { metadata } = paymentIntent

    try {
      // Update transaction status
      const { error: transactionError } = await supabase
        .from('transactions')
        .update({
          status: 'succeeded',
          stripe_payment_intent_id: paymentIntent.id,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_payment_intent_id', paymentIntent.id)

      if (transactionError) {
        logger.error('Failed to update transaction status', transactionError)
      }

      // Update buyer account balance if applicable
      if (metadata.buyerId) {
        const { error: balanceError } = await supabase.rpc('add_buyer_credits', {
          buyer_id: metadata.buyerId,
          amount: paymentIntent.amount / 100,
        })

        if (balanceError) {
          logger.error('Failed to update buyer balance', balanceError)
        }
      }

      // Update campaign budget if applicable
      if (metadata.invoiceId) {
        const { error: campaignError } = await supabase
          .from('invoices')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
          })
          .eq('id', metadata.invoiceId)

        if (campaignError) {
          logger.error('Failed to update invoice status', campaignError)
        }
      }

      logger.info('Payment succeeded processed', {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        buyerId: metadata.buyerId,
      })
    } catch (error) {
      logger.error('Error processing payment success', error)
      throw error
    }
  }

  const handlePaymentFailed = async (paymentIntent: Stripe.PaymentIntent) => {
    const { metadata } = paymentIntent

    try {
      // Update transaction status
      const { error: transactionError } = await supabase
        .from('transactions')
        .update({
          status: 'failed',
          failure_reason: paymentIntent.last_payment_error?.message,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_payment_intent_id', paymentIntent.id)

      if (transactionError) {
        logger.error('Failed to update failed transaction', transactionError)
      }

      // Notify buyer of failed payment
      if (metadata.buyerId) {
        await supabase.from('notifications').insert({
          user_id: metadata.buyerId,
          type: 'payment_failed',
          title: 'Payment Failed',
          message: `Payment of $${(paymentIntent.amount / 100).toFixed(2)} failed. Please update your payment method.`,
          data: {
            payment_intent_id: paymentIntent.id,
            amount: paymentIntent.amount / 100,
            error: paymentIntent.last_payment_error?.message,
          },
        })
      }

      logger.info('Payment failed processed', {
        paymentIntentId: paymentIntent.id,
        error: paymentIntent.last_payment_error?.message,
      })
    } catch (error) {
      logger.error('Error processing payment failure', error)
      throw error
    }
  }

  const handleDisputeCreated = async (dispute: Stripe.Dispute) => {
    try {
      // Record dispute in database
      const { error } = await supabase.from('disputes').insert({
        stripe_charge_id: dispute.charge as string,
        amount: dispute.amount / 100,
        currency: dispute.currency,
        reason: dispute.reason,
        status: dispute.status,
        evidence_due_by: dispute.evidence_details?.due_by
          ? new Date(dispute.evidence_details.due_by * 1000).toISOString()
          : null,
        created_at: new Date().toISOString(),
      })

      if (error) {
        logger.error('Failed to record dispute', error)
      }

      // Notify admin team
      await supabase.from('notifications').insert({
        user_id: null, // System notification
        type: 'dispute_created',
        title: 'Payment Dispute Created',
        message: `A dispute has been created for charge ${dispute.charge}`,
        data: {
          charge_id: dispute.charge,
          amount: dispute.amount / 100,
          reason: dispute.reason,
        },
      })

      logger.info('Dispute created', {
        chargeId: dispute.charge,
        amount: dispute.amount / 100,
        reason: dispute.reason,
      })
    } catch (error) {
      logger.error('Error processing dispute creation', error)
      throw error
    }
  }

  const handleAccountUpdated = async (account: Stripe.Account) => {
    try {
      // Update connected account status
      const { error } = await supabase
        .from('users')
        .update({
          stripe_account_status: {
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
            details_submitted: account.details_submitted,
            requirements_currently_due: account.requirements?.currently_due || [],
            updated_at: new Date().toISOString(),
          },
        })
        .eq('stripe_account_id', account.id)

      if (error) {
        logger.error('Failed to update account status', error)
      }

      logger.info('Account updated', {
        accountId: account.id,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
      })
    } catch (error) {
      logger.error('Error processing account update', error)
      throw error
    }
  }

  const handleAccountAuthorized = async (account: Stripe.Account) => {
    try {
      // Mark account as authorized
      const { error } = await supabase
        .from('users')
        .update({
          stripe_account_authorized: true,
          authorized_at: new Date().toISOString(),
        })
        .eq('stripe_account_id', account.id)

      if (error) {
        logger.error('Failed to mark account as authorized', error)
      }

      logger.info('Account authorized', { accountId: account.id })
    } catch (error) {
      logger.error('Error processing account authorization', error)
      throw error
    }
  }

  const handleAccountDeauthorized = async (account: Stripe.Account) => {
    try {
      // Mark account as deauthorized
      const { error } = await supabase
        .from('users')
        .update({
          stripe_account_authorized: false,
          deauthorized_at: new Date().toISOString(),
        })
        .eq('stripe_account_id', account.id)

      if (error) {
        logger.error('Failed to mark account as deauthorized', error)
      }

      logger.info('Account deauthorized', { accountId: account.id })
    } catch (error) {
      logger.error('Error processing account deauthorization', error)
      throw error
    }
  }

  const handlePayoutCreated = async (payout: Stripe.Payout) => {
    try {
      // Record payout creation
      const { error } = await supabase.from('payouts').insert({
        stripe_payout_id: payout.id,
        stripe_account_id: payout.destination as string,
        amount: payout.amount / 100,
        currency: payout.currency,
        status: 'created',
        arrival_date: payout.arrival_date
          ? new Date(payout.arrival_date * 1000).toISOString()
          : null,
        created_at: new Date().toISOString(),
      })

      if (error) {
        logger.error('Failed to record payout creation', error)
      }

      logger.info('Payout created', {
        payoutId: payout.id,
        amount: payout.amount / 100,
        arrivalDate: payout.arrival_date,
      })
    } catch (error) {
      logger.error('Error processing payout creation', error)
      throw error
    }
  }

  const handlePayoutPaid = async (payout: Stripe.Payout) => {
    try {
      // Update payout status
      const { error } = await supabase
        .from('payouts')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .eq('stripe_payout_id', payout.id)

      if (error) {
        logger.error('Failed to update payout status', error)
      }

      logger.info('Payout paid', {
        payoutId: payout.id,
        amount: payout.amount / 100,
      })
    } catch (error) {
      logger.error('Error processing payout payment', error)
      throw error
    }
  }

  const handlePayoutFailed = async (payout: Stripe.Payout) => {
    try {
      // Update payout status with failure info
      const { error } = await supabase
        .from('payouts')
        .update({
          status: 'failed',
          failure_code: payout.failure_code,
          failure_message: payout.failure_message,
          failed_at: new Date().toISOString(),
        })
        .eq('stripe_payout_id', payout.id)

      if (error) {
        logger.error('Failed to update failed payout', error)
      }

      // Notify supplier of failed payout
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('stripe_account_id', payout.destination)
        .single()

      if (user) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'payout_failed',
          title: 'Payout Failed',
          message: `Payout of $${(payout.amount / 100).toFixed(2)} failed: ${payout.failure_message}`,
          data: {
            payout_id: payout.id,
            amount: payout.amount / 100,
            failure_code: payout.failure_code,
            failure_message: payout.failure_message,
          },
        })
      }

      logger.info('Payout failed', {
        payoutId: payout.id,
        failureCode: payout.failure_code,
        failureMessage: payout.failure_message,
      })
    } catch (error) {
      logger.error('Error processing payout failure', error)
      throw error
    }
  }

  const handleTransferCreated = async (transfer: Stripe.Transfer) => {
    try {
      // Record transfer creation
      const { error } = await supabase.from('transfers').insert({
        stripe_transfer_id: transfer.id,
        destination_account_id: transfer.destination as string,
        amount: transfer.amount / 100,
        currency: transfer.currency,
        status: 'created',
        metadata: transfer.metadata,
        created_at: new Date().toISOString(),
      })

      if (error) {
        logger.error('Failed to record transfer creation', error)
      }

      logger.info('Transfer created', {
        transferId: transfer.id,
        amount: transfer.amount / 100,
        destination: transfer.destination,
      })
    } catch (error) {
      logger.error('Error processing transfer creation', error)
      throw error
    }
  }

  const handleTransferReversed = async (transfer: Stripe.Transfer) => {
    try {
      // Update transfer status
      const { error } = await supabase
        .from('transfers')
        .update({
          status: 'reversed',
          reversed_at: new Date().toISOString(),
        })
        .eq('stripe_transfer_id', transfer.id)

      if (error) {
        logger.error('Failed to update reversed transfer', error)
      }

      logger.info('Transfer reversed', {
        transferId: transfer.id,
        amount: transfer.amount / 100,
      })
    } catch (error) {
      logger.error('Error processing transfer reversal', error)
      throw error
    }
  }

  // This component doesn't render anything visible
  return null
}

// Wrapped version with error boundary
export const WebhookHandler: React.FC<WebhookHandlerProps> = ({ onWebhookReceived }) => {
  const [retryKey, setRetryKey] = useState(0)

  const handleReconnect = async () => {
    // Force component re-mount to reconnect
    setRetryKey((prev) => prev + 1)
    logger.info('Attempting to reconnect webhook handler')
  }

  const handleFallbackToPolling = () => {
    // In a real implementation, this would switch to polling mode
    logger.info('Falling back to polling mode for webhook events')
    // You could implement a polling mechanism here
  }

  return (
    <RealtimeErrorBoundary
      featureName="Webhook Processing"
      enableAutoReconnect={true}
      maxReconnectAttempts={5}
      reconnectDelay={2000}
      onReconnect={handleReconnect}
      onFallbackToPolling={handleFallbackToPolling}
      onError={(error) => {
        logger.error('Webhook handler error boundary caught error', error)
      }}
    >
      <WebhookHandlerInner key={retryKey} onWebhookReceived={onWebhookReceived} />
    </RealtimeErrorBoundary>
  )
}

export default WebhookHandler
