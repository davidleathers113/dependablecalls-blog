import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MINIMUM_PAYOUT_AMOUNT = 25.0 // $25 minimum payout

interface PayoutRequest {
  supplierId?: string
  forceProcess?: boolean
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

    // Parse request body
    const { supplierId, forceProcess = false }: PayoutRequest = await req.json()

    const results: Array<{
      supplier_id: string
      success: boolean
      amount?: number
      transfer_id?: string
      error?: string
    }> = []

    // Get suppliers eligible for payout
    let suppliersQuery = supabase
      .from('suppliers')
      .select(
        `
        id,
        user_id,
        company_name,
        settings,
        credit_balance
      `
      )
      .eq('status', 'active')
      .gte('credit_balance', forceProcess ? 0.01 : MINIMUM_PAYOUT_AMOUNT)

    if (supplierId) {
      suppliersQuery = suppliersQuery.eq('id', supplierId)
    }

    const { data: suppliers, error: suppliersError } = await suppliersQuery

    if (suppliersError) {
      throw new Error(`Failed to fetch suppliers: ${suppliersError.message}`)
    }

    if (!suppliers || suppliers.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No suppliers eligible for payout',
          results: [],
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
          status: 200,
        }
      )
    }

    // Process each supplier
    for (const supplier of suppliers) {
      try {
        const stripeAccountId = supplier.settings?.stripe_account_id

        if (!stripeAccountId) {
          results.push({
            supplier_id: supplier.id,
            success: false,
            error: 'No Stripe connected account',
          })
          continue
        }

        // Verify account can receive payouts
        const account = await stripe.accounts.retrieve(stripeAccountId)
        if (!account.payouts_enabled) {
          results.push({
            supplier_id: supplier.id,
            success: false,
            error: 'Payouts not enabled for connected account',
          })
          continue
        }

        const payoutAmount = supplier.credit_balance
        if (payoutAmount < MINIMUM_PAYOUT_AMOUNT && !forceProcess) {
          results.push({
            supplier_id: supplier.id,
            success: false,
            error: `Amount below minimum payout ($${MINIMUM_PAYOUT_AMOUNT})`,
          })
          continue
        }

        // Create transfer to connected account
        const transfer = await stripe.transfers.create({
          amount: Math.round(payoutAmount * 100), // Convert to cents
          currency: 'usd',
          destination: stripeAccountId,
          metadata: {
            supplier_id: supplier.id,
            company_name: supplier.company_name || '',
            payout_period: getCurrentPayoutPeriod(),
            platform: 'dependablecalls',
          },
        })

        // Record payout in database
        const { error: payoutError } = await supabase.from('payouts').insert({
          supplier_id: supplier.id,
          amount: payoutAmount,
          fee_amount: 0, // Stripe handles fees separately
          net_amount: payoutAmount,
          status: 'processing',
          period_start: getPayoutPeriodStart(),
          period_end: getPayoutPeriodEnd(),
          payment_method: 'stripe',
          transaction_id: transfer.id,
          payment_details: {
            stripe_transfer_id: transfer.id,
            stripe_account_id: stripeAccountId,
            currency: transfer.currency,
            created: transfer.created,
          },
        })

        if (payoutError) {
          console.error(`Failed to record payout for supplier ${supplier.id}:`, payoutError)
          // Continue processing other suppliers
        }

        // Update supplier credit balance (reset to 0)
        const { error: balanceError } = await supabase
          .from('suppliers')
          .update({ credit_balance: 0 })
          .eq('id', supplier.id)

        if (balanceError) {
          console.error(`Failed to update balance for supplier ${supplier.id}:`, balanceError)
        }

        results.push({
          supplier_id: supplier.id,
          success: true,
          amount: payoutAmount,
          transfer_id: transfer.id,
        })

        console.log(
          `Created payout transfer ${transfer.id} for supplier ${supplier.id}: $${payoutAmount}`
        )
      } catch (error) {
        console.error(`Error processing payout for supplier ${supplier.id}:`, error)

        let errorMessage = 'Unknown error'
        if (error instanceof Stripe.errors.StripeError) {
          errorMessage = error.message
        } else if (error instanceof Error) {
          errorMessage = error.message
        }

        results.push({
          supplier_id: supplier.id,
          success: false,
          error: errorMessage,
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const totalAmount = results
      .filter((r) => r.success && r.amount)
      .reduce((sum, r) => sum + (r.amount || 0), 0)

    return new Response(
      JSON.stringify({
        message: `Processed ${successCount} payouts totaling $${totalAmount.toFixed(2)}`,
        total_suppliers: suppliers.length,
        successful_payouts: successCount,
        total_amount: totalAmount,
        results,
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
    console.error('Payout processing error:', error)

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

// Helper functions
function getCurrentPayoutPeriod(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const week = Math.ceil(now.getDate() / 7)
  return `${year}-${month}-W${week}`
}

function getPayoutPeriodStart(): string {
  const now = new Date()
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  return lastWeek.toISOString().split('T')[0]
}

function getPayoutPeriodEnd(): string {
  const now = new Date()
  return now.toISOString().split('T')[0]
}
