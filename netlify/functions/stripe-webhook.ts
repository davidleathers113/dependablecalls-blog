/**
 * Stripe Webhook Handler with PCI DSS Compliance
 * 
 * This function handles Stripe webhooks with full signature verification,
 * replay attack prevention, and comprehensive security logging.
 */

import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database'
import { z } from 'zod'
import Stripe from 'stripe'
import crypto from 'crypto'

// Initialize Stripe with security settings
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
  typescript: true,
  timeout: 30000,
  maxNetworkRetries: 3,
  telemetry: false, // Disable telemetry for security
})

// Initialize Supabase client
const supabase = createClient<Database>(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

// Webhook event schemas for validation
const paymentIntentSchema = z.object({
  id: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: z.enum(['succeeded', 'payment_failed', 'canceled']),
  customer: z.string().nullable(),
  metadata: z.record(z.unknown()),
  created: z.number(),
  payment_method: z.string().nullable(),
})

const setupIntentSchema = z.object({
  id: z.string(),
  status: z.enum(['succeeded', 'requires_payment_method', 'canceled']),
  customer: z.string().nullable(),
  payment_method: z.string().nullable(),
  metadata: z.record(z.unknown()),
})

// Security logging function
async function logSecurityEvent(
  eventType: 'webhook_received' | 'signature_verified' | 'signature_failed' | 'replay_detected' | 'processing_error',
  details: Record<string, unknown>,
  riskLevel: 'low' | 'medium' | 'high' = 'low'
) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event_type: eventType,
    risk_level: riskLevel,
    details: sanitizeLogData(details),
    source: 'stripe_webhook',
  }

  try {
    await supabase.from('security_logs').insert(logEntry)
  } catch (error) {
    console.error('Failed to log security event:', error)
  }
}

// Sanitize sensitive data from logs (PCI DSS Requirement 3)
function sanitizeLogData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...data }
  
  // Remove or mask sensitive fields
  const sensitiveFields = ['card', 'payment_method', 'source', 'bank_account']
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]'
    }
  })
  
  // Mask potential card numbers in strings
  if (typeof sanitized.payload === 'string') {
    sanitized.payload = sanitized.payload.replace(/\b\d{13,19}\b/g, '****-****-****-****')
  }
  
  return sanitized
}

// Verify webhook signature (PCI DSS Requirement 4)
function verifyWebhookSignature(payload: string, signature: string): Stripe.Event | null {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
    return event
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return null
  }
}

// Check for replay attacks (PCI DSS Requirement 10)
const processedEvents = new Set<string>()
const EVENT_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

function isReplayAttack(eventId: string, timestamp: number): boolean {
  const now = Date.now()
  const eventTime = timestamp * 1000
  
  // Check if event is too old
  if (now - eventTime > EVENT_EXPIRY_MS) {
    return true
  }
  
  // Check if event was already processed
  if (processedEvents.has(eventId)) {
    return true
  }
  
  // Add to processed set
  processedEvents.add(eventId)
  
  // Clean up old events periodically
  if (processedEvents.size > 1000) {
    processedEvents.clear()
  }
  
  return false
}

// Process payment intent events
async function handlePaymentIntentEvent(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent
  
  // Validate payment intent data
  const validatedPayment = paymentIntentSchema.parse(paymentIntent)
  
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSucceeded(validatedPayment)
      break
    case 'payment_intent.payment_failed':
      await handlePaymentFailed(validatedPayment)
      break
    case 'payment_intent.canceled':
      await handlePaymentCanceled(validatedPayment)
      break
  }
}

// Handle successful payment
async function handlePaymentSucceeded(payment: z.infer<typeof paymentIntentSchema>) {
  try {
    // Extract campaign and buyer information from metadata
    const campaignId = payment.metadata.campaign_id as string
    const buyerId = payment.metadata.buyer_id as string
    
    if (!campaignId || !buyerId) {
      throw new Error('Missing required metadata in payment')
    }
    
    // Record the payment transaction
    const { error: insertError } = await supabase
      .from('payment_transactions')
      .insert({
        stripe_payment_intent_id: payment.id,
        campaign_id: campaignId,
        buyer_id: buyerId,
        amount: payment.amount,
        currency: payment.currency,
        status: 'completed',
        payment_method: payment.payment_method,
        created_at: new Date(payment.created * 1000).toISOString(),
        metadata: payment.metadata,
      })
    
    if (insertError) {
      throw insertError
    }
    
    // Update buyer balance if applicable
    if (payment.metadata.auto_recharge === 'true') {
      await supabase.rpc('add_buyer_credit', {
        buyer_id: buyerId,
        amount: payment.amount,
        transaction_id: payment.id,
      })
    }
    
    await logSecurityEvent('webhook_received', {
      event_type: 'payment_intent.succeeded',
      payment_id: payment.id,
      amount: payment.amount,
      campaign_id: campaignId,
    })
    
  } catch (error) {
    console.error('Error processing payment succeeded:', error)
    await logSecurityEvent('processing_error', {
      event_type: 'payment_intent.succeeded',
      payment_id: payment.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'high')
    throw error
  }
}

// Handle failed payment
async function handlePaymentFailed(payment: z.infer<typeof paymentIntentSchema>) {
  try {
    const campaignId = payment.metadata.campaign_id as string
    const buyerId = payment.metadata.buyer_id as string
    
    // Record the failed payment
    await supabase
      .from('payment_transactions')
      .insert({
        stripe_payment_intent_id: payment.id,
        campaign_id: campaignId,
        buyer_id: buyerId,
        amount: payment.amount,
        currency: payment.currency,
        status: 'failed',
        payment_method: payment.payment_method,
        created_at: new Date(payment.created * 1000).toISOString(),
        metadata: payment.metadata,
      })
    
    // Check for fraud indicators
    await checkForFraudIndicators(payment, buyerId)
    
    await logSecurityEvent('webhook_received', {
      event_type: 'payment_intent.payment_failed',
      payment_id: payment.id,
      amount: payment.amount,
    }, 'medium')
    
  } catch (error) {
    await logSecurityEvent('processing_error', {
      event_type: 'payment_intent.payment_failed',
      payment_id: payment.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'high')
    throw error
  }
}

// Handle canceled payment
async function handlePaymentCanceled(payment: z.infer<typeof paymentIntentSchema>) {
  try {
    const campaignId = payment.metadata.campaign_id as string
    const buyerId = payment.metadata.buyer_id as string
    
    await supabase
      .from('payment_transactions')
      .insert({
        stripe_payment_intent_id: payment.id,
        campaign_id: campaignId,
        buyer_id: buyerId,
        amount: payment.amount,
        currency: payment.currency,
        status: 'canceled',
        payment_method: payment.payment_method,
        created_at: new Date(payment.created * 1000).toISOString(),
        metadata: payment.metadata,
      })
    
    await logSecurityEvent('webhook_received', {
      event_type: 'payment_intent.canceled',
      payment_id: payment.id,
      amount: payment.amount,
    })
    
  } catch (error) {
    await logSecurityEvent('processing_error', {
      event_type: 'payment_intent.canceled',
      payment_id: payment.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'high')
    throw error
  }
}

// Check for fraud indicators
async function checkForFraudIndicators(payment: z.infer<typeof paymentIntentSchema>, buyerId: string) {
  try {
    // Check payment velocity (multiple failed payments in short time)
    const { data: recentFailures } = await supabase
      .from('payment_transactions')
      .select('id')
      .eq('buyer_id', buyerId)
      .eq('status', 'failed')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
    
    if (recentFailures && recentFailures.length >= 3) {
      await logSecurityEvent('webhook_received', {
        alert_type: 'fraud_velocity',
        buyer_id: buyerId,
        failed_attempts: recentFailures.length,
        payment_id: payment.id,
      }, 'high')
      
      // Could trigger account suspension or additional verification
      await supabase
        .from('fraud_alerts')
        .insert({
          buyer_id: buyerId,
          alert_type: 'high_failure_velocity',
          risk_score: 85,
          details: { failed_payments: recentFailures.length, timeframe: '1_hour' },
        })
    }
  } catch (error) {
    console.error('Error checking fraud indicators:', error)
  }
}

// Main webhook handler
export const handler: Handler = async (event) => {
  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Allow': 'POST' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }
  
  const signature = event.headers['stripe-signature']
  const payload = event.body
  
  if (!signature || !payload) {
    await logSecurityEvent('signature_failed', {
      reason: 'missing_signature_or_payload',
      headers: Object.keys(event.headers),
    }, 'high')
    
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing signature or payload' }),
    }
  }
  
  try {
    // Verify webhook signature
    const stripeEvent = verifyWebhookSignature(payload, signature)
    
    if (!stripeEvent) {
      await logSecurityEvent('signature_failed', {
        reason: 'invalid_signature',
        event_id: 'unknown',
      }, 'high')
      
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid signature' }),
      }
    }
    
    await logSecurityEvent('signature_verified', {
      event_id: stripeEvent.id,
      event_type: stripeEvent.type,
    })
    
    // Check for replay attacks
    if (isReplayAttack(stripeEvent.id, stripeEvent.created)) {
      await logSecurityEvent('replay_detected', {
        event_id: stripeEvent.id,
        event_type: stripeEvent.type,
      }, 'high')
      
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Duplicate or expired event' }),
      }
    }
    
    // Process the event based on type
    switch (stripeEvent.type) {
      case 'payment_intent.succeeded':
      case 'payment_intent.payment_failed':
      case 'payment_intent.canceled':
        await handlePaymentIntentEvent(stripeEvent)
        break
        
      case 'setup_intent.succeeded':
        // Handle setup intent for saving payment methods
        const setupIntent = setupIntentSchema.parse(stripeEvent.data.object)
        await logSecurityEvent('webhook_received', {
          event_type: 'setup_intent.succeeded',
          setup_intent_id: setupIntent.id,
        })
        break
        
      default:
        // Log unhandled event types for monitoring
        await logSecurityEvent('webhook_received', {
          event_type: stripeEvent.type,
          event_id: stripeEvent.id,
          status: 'unhandled',
        })
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        received: true,
        event_id: stripeEvent.id,
        event_type: stripeEvent.type,
      }),
    }
    
  } catch (error) {
    console.error('Webhook processing error:', error)
    
    await logSecurityEvent('processing_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      payload_preview: payload?.substring(0, 100),
    }, 'high')
    
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Invalid event data',
          details: error.errors,
        }),
      }
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    }
  }
}