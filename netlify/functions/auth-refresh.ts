import type { Handler } from '@netlify/functions'
import { withoutAuth, ApiError } from '../../src/lib/auth-middleware'
import { parseCookies, extractSessionFromCookies, createSessionCookies } from '../../src/lib/auth-cookies'
import { z } from 'zod'

const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required').optional(),
})

type RefreshTokenRequest = z.infer<typeof refreshTokenSchema>

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
    // First try to get refresh token from cookies
    const cookieHeader = event.headers.cookie || ''
    const cookies = parseCookies(cookieHeader)
    const { refreshToken: cookieRefreshToken } = extractSessionFromCookies(cookies)
    
    // Also check request body for backward compatibility
    let refreshToken = cookieRefreshToken
    if (request.body) {
      const requestData: RefreshTokenRequest = refreshTokenSchema.parse(JSON.parse(request.body))
      if (requestData.refresh_token) {
        refreshToken = requestData.refresh_token
      }
    }
    
    if (!refreshToken) {
      throw new ApiError('Refresh token is required', 400, 'MISSING_REFRESH_TOKEN')
    }

    // Refresh the session
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    })

    if (error) {
      console.error('Token refresh error:', error)
      throw new ApiError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN')
    }

    if (!data.session || !data.user) {
      throw new ApiError('Failed to refresh session', 500, 'REFRESH_FAILED')
    }

    // Get updated user information
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, status, is_active')
      .eq('id', data.user.id)
      .single()

    if (userError) {
      console.error('Error fetching user data:', userError)
      throw new ApiError('User not found', 404, 'USER_NOT_FOUND')
    }

    if (!userData.is_active || userData.status !== 'active') {
      throw new ApiError('Account is not active', 403, 'ACCOUNT_INACTIVE')
    }

    // Determine user role
    let userType: 'supplier' | 'buyer' | 'admin' | undefined

    const [supplierCheck, buyerCheck, adminCheck] = await Promise.all([
      supabase.from('suppliers').select('id, status').eq('user_id', data.user.id).single(),
      supabase.from('buyers').select('id, status').eq('user_id', data.user.id).single(),
      supabase.from('admins').select('id, role').eq('user_id', data.user.id).single(),
    ])

    if (adminCheck.data) {
      userType = 'admin'
    } else if (buyerCheck.data && buyerCheck.data.status === 'active') {
      userType = 'buyer'
    } else if (supplierCheck.data && supplierCheck.data.status === 'active') {
      userType = 'supplier'
    }

    // Create new session cookies
    const sessionCookies = createSessionCookies(data.session)
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
        // Set refreshed session cookies
        'Set-Cookie': sessionCookies,
      },
      body: JSON.stringify({
        success: true,
        message: 'Session refreshed successfully',
        user: {
          id: data.user.id,
          email: data.user.email,
          firstName: userData.first_name,
          lastName: userData.last_name,
          userType,
          needsEmailVerification: !data.user.email_confirmed_at,
        },
        // Only send non-sensitive session metadata
        session: {
          expires_at: data.session.expires_at,
        },
      }),
    }
  })
}
