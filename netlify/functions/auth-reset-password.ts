import type { Handler } from '@netlify/functions'
import { withoutAuth, ApiError } from '../../src/lib/auth-middleware'
import { z } from 'zod'

const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>

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

    const requestData: ResetPasswordRequest = resetPasswordSchema.parse(JSON.parse(request.body))

    // Check if user exists first
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, is_active, status')
      .eq('email', requestData.email)
      .single()

    if (!existingUser) {
      // Don't reveal if user exists or not for security
      return {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      }
    }

    if (!existingUser.is_active || existingUser.status !== 'active') {
      throw new ApiError('Account is not active', 403, 'ACCOUNT_INACTIVE')
    }

    // Send password reset email
    const { error } = await supabase.auth.resetPasswordForEmail(requestData.email, {
      redirectTo: `${process.env.VITE_APP_URL || 'http://localhost:5173'}/reset-password`,
    })

    if (error) {
      console.error('Password reset error:', error)
      throw new ApiError('Failed to send password reset email', 500, 'RESET_FAILED')
    }

    return {
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    }
  })
}
