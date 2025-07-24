import type { Handler } from '@netlify/functions'
import { withoutAuth, ApiError } from '../../src/lib/auth-middleware'
import { z } from 'zod'

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
  type: z.enum(['signup', 'email_change', 'recovery'], {
    errorMap: () => ({ message: 'Invalid verification type' }),
  }),
})

type VerifyEmailRequest = z.infer<typeof verifyEmailSchema>

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

  return withoutAuth(event, async (supabase, request) => {
    if (!request.body) {
      throw new ApiError('Request body is required', 400)
    }

    const requestData: VerifyEmailRequest = verifyEmailSchema.parse(JSON.parse(request.body))

    // Verify the email token
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: requestData.token,
      type: requestData.type,
    })

    if (error) {
      console.error('Email verification error:', error)
      throw new ApiError('Invalid or expired verification token', 400, 'INVALID_TOKEN')
    }

    if (!data.user) {
      throw new ApiError('Verification failed', 500, 'VERIFICATION_FAILED')
    }

    // Update user status if this is a signup verification
    if (requestData.type === 'signup') {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          status: 'active',
          is_active: true,
        })
        .eq('id', data.user.id)

      if (updateError) {
        console.error('Error updating user status:', updateError)
        // Don't throw error here - verification was successful
      }

      // Also update supplier/buyer status if applicable
      const [supplierUpdate, buyerUpdate] = await Promise.all([
        supabase.from('suppliers').update({ status: 'pending' }).eq('user_id', data.user.id),
        supabase.from('buyers').update({ status: 'pending' }).eq('user_id', data.user.id),
      ])

      if (supplierUpdate.error) {
        console.error('Error updating supplier status:', supplierUpdate.error)
      }
      if (buyerUpdate.error) {
        console.error('Error updating buyer status:', buyerUpdate.error)
      }
    }

    return {
      success: true,
      message:
        requestData.type === 'signup'
          ? 'Email verified successfully. Your account is now active.'
          : 'Email verification successful.',
      user: {
        id: data.user.id,
        email: data.user.email,
        emailVerified: true,
      },
    }
  })
}
