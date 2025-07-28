import type { Handler } from '@netlify/functions'
import { withoutAuth, ApiError } from '../../src/lib/auth-middleware'
import { withCsrfProtection } from './_shared/csrf-middleware'
import { z } from 'zod'

const magicLinkSchema = z.object({
  email: z.string().email('Invalid email address'),
  redirectTo: z.string().url().optional(),
})

type MagicLinkRequest = z.infer<typeof magicLinkSchema>

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
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

  return withCsrfProtection(event, async (event) => {
    return withoutAuth(event, async (supabase, request) => {
    if (!request.body) {
      throw new ApiError('Request body is required', 400)
    }

    const requestData: MagicLinkRequest = magicLinkSchema.parse(JSON.parse(request.body))

    // Get the origin from the request headers
    const origin = request.headers.origin || request.headers.referer || 'http://localhost:5173'
    const redirectTo = requestData.redirectTo || `${origin}/app/dashboard`

    // Send magic link
    const { error } = await supabase.auth.signInWithOtp({
      email: requestData.email,
      options: {
        emailRedirectTo: redirectTo,
      },
    })

    if (error) {
      console.error('Magic link error:', error)
      
      // Handle specific error cases
      if (error.message.includes('rate limit')) {
        throw new ApiError('Too many requests. Please wait a moment before trying again.', 429, 'RATE_LIMIT')
      } else if (error.message.includes('invalid')) {
        throw new ApiError('Invalid email address', 400, 'INVALID_EMAIL')
      } else {
        throw new ApiError('Failed to send magic link', 500, 'SEND_FAILED')
      }
    }

    return {
      success: true,
      message: 'Magic link sent successfully. Please check your email.',
    }
    })
  })
}