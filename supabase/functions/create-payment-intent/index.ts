import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PaymentIntentRequest {
  amount: number
  currency?: string
  customerId?: string
  invoiceId?: string
  buyerId?: string
  metadata?: Record<string, string>
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders,
    })
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
    })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the authorization header to verify the user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Missing authorization header', {
        status: 401,
        headers: corsHeaders,
      })
    }

    // Parse request body
    const {
      amount,
      currency = 'usd',
      customerId,
      invoiceId,
      buyerId,
      metadata = {},
    }: PaymentIntentRequest = await req.json()

    // Validate required parameters
    if (!amount || amount <= 0) {
      return new Response('Invalid amount', {
        status: 400,
        headers: corsHeaders,
      })
    }

    // Convert amount to cents for Stripe
    const amountInCents = Math.round(amount * 100)

    // Verify user authorization with Supabase
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))

    if (authError || !user) {
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders,
      })
    }

    // Create customer if needed
    let stripeCustomerId = customerId
    if (!stripeCustomerId && user.email) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: user.id,
          buyer_id: buyerId || '',
        },
      })
      stripeCustomerId = customer.id

      // Update buyer record with Stripe customer ID
      if (buyerId) {
        await supabase
          .from('buyers')
          .update({
            settings: { stripe_customer_id: customer.id },
          })
          .eq('id', buyerId)
      }
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      customer: stripeCustomerId,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        user_id: user.id,
        buyer_id: buyerId || '',
        invoice_id: invoiceId || '',
        platform: 'dependablecalls',
        ...metadata,
      },
    })

    // Update invoice with payment intent ID if provided
    if (invoiceId) {
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          stripe_payment_intent_id: paymentIntent.id,
          status: 'open',
        })
        .eq('id', invoiceId)
        .eq('buyer_id', buyerId)

      if (updateError) {
        console.error('Failed to update invoice:', updateError)
        // Don't fail the payment intent creation for this
      }
    }

    console.log(`Created payment intent ${paymentIntent.id} for user ${user.id}`)

    return new Response(
      JSON.stringify({
        id: paymentIntent.id,
        client_secret: paymentIntent.client_secret,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Payment intent creation error:', error)

    // Handle Stripe-specific errors
    if (error instanceof Stripe.errors.StripeError) {
      return new Response(
        JSON.stringify({
          error: 'Payment processing error',
          code: error.code,
          message: error.message,
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
          status: 400,
        }
      )
    }

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message,
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
