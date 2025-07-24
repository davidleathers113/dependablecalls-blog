import type { Handler } from '@netlify/functions'
import { withoutAuth, ApiError } from '../../src/lib/auth-middleware'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginRequest = z.infer<typeof loginSchema>

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

    const requestData: LoginRequest = loginSchema.parse(JSON.parse(request.body))

    // Authenticate with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: requestData.email,
      password: requestData.password,
    })

    if (authError) {
      console.error('Login error:', authError)
      throw new ApiError('Invalid email or password', 401, 'INVALID_CREDENTIALS')
    }

    if (!authData.user) {
      throw new ApiError('Login failed', 500, 'LOGIN_FAILED')
    }

    // Get user profile and role information
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, status, is_active')
      .eq('id', authData.user.id)
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
      supabase.from('suppliers').select('id, status').eq('user_id', authData.user.id).single(),
      supabase.from('buyers').select('id, status').eq('user_id', authData.user.id).single(),
      supabase.from('admins').select('id, role').eq('user_id', authData.user.id).single(),
    ])

    if (adminCheck.data) {
      userType = 'admin'
    } else if (buyerCheck.data) {
      userType = 'buyer'
      if (buyerCheck.data.status !== 'active') {
        throw new ApiError('Buyer account is not active', 403, 'ACCOUNT_INACTIVE')
      }
    } else if (supplierCheck.data) {
      userType = 'supplier'
      if (supplierCheck.data.status !== 'active') {
        throw new ApiError('Supplier account is not active', 403, 'ACCOUNT_INACTIVE')
      }
    }

    return {
      success: true,
      message: 'Login successful',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        firstName: userData.first_name,
        lastName: userData.last_name,
        userType,
        needsEmailVerification: !authData.user.email_confirmed_at,
      },
      session: {
        access_token: authData.session?.access_token,
        refresh_token: authData.session?.refresh_token,
        expires_at: authData.session?.expires_at,
      },
    }
  })
}
