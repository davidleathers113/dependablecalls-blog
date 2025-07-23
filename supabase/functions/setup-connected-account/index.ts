import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ConnectedAccountRequest {
  supplierId: string
  companyName?: string
  email?: string
  refreshUrl: string
  returnUrl: string
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

    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Missing authorization header', {
        status: 401,
        headers: corsHeaders,
      })
    }

    // Verify user authorization
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

    // Parse request body
    const { supplierId, companyName, email, refreshUrl, returnUrl }: ConnectedAccountRequest =
      await req.json()

    // Validate required parameters
    if (!supplierId || !refreshUrl || !returnUrl) {
      return new Response('Missing required parameters', {
        status: 400,
        headers: corsHeaders,
      })
    }

    // Verify supplier ownership
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', supplierId)
      .eq('user_id', user.id)
      .single()

    if (supplierError || !supplier) {
      return new Response('Supplier not found or access denied', {
        status: 404,
        headers: corsHeaders,
      })
    }

    // Check if supplier already has a connected account
    const existingStripeAccountId = supplier.settings?.stripe_account_id
    let account: Stripe.Account

    if (existingStripeAccountId) {
      // Retrieve existing account
      try {
        account = await stripe.accounts.retrieve(existingStripeAccountId)
      } catch (error) {
        // If account doesn't exist, create a new one
        if (error.code === 'resource_missing') {
          account = await createNewAccount()
        } else {
          throw error
        }
      }
    } else {
      // Create new account
      account = await createNewAccount()
    }

    async function createNewAccount(): Promise<Stripe.Account> {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: email || user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          supplier_id: supplierId,
          user_id: user.id,
          company_name: companyName || supplier.company_name || '',
          platform: 'dependablecalls',
        },
      })

      // Update supplier record with Stripe account ID
      const { error: updateError } = await supabase
        .from('suppliers')
        .update({
          settings: {
            ...supplier.settings,
            stripe_account_id: account.id,
            stripe_onboarding_started: new Date().toISOString(),
          },
        })
        .eq('id', supplierId)

      if (updateError) {
        throw new Error(`Failed to update supplier: ${updateError.message}`)
      }

      return account
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    })

    console.log(`Created account link for supplier ${supplierId}, account ${account.id}`)

    return new Response(
      JSON.stringify({
        account_id: account.id,
        onboarding_url: accountLink.url,
        expires_at: accountLink.expires_at,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        requirements: account.requirements,
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
    console.error('Connected account setup error:', error)

    // Handle Stripe-specific errors
    if (error instanceof Stripe.errors.StripeError) {
      return new Response(
        JSON.stringify({
          error: 'Account setup error',
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
