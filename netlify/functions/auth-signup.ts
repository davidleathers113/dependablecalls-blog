import type { Handler } from '@netlify/functions'
import { withoutAuth, ApiError } from '../../src/lib/auth-middleware'
import { z } from 'zod'

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  userType: z.enum(['supplier', 'buyer'], {
    errorMap: () => ({ message: 'User type must be either supplier or buyer' }),
  }),
  companyName: z.string().min(1, 'Company name is required'),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
})

type SignupRequest = z.infer<typeof signupSchema>

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

    const requestData: SignupRequest = signupSchema.parse(JSON.parse(request.body))

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', requestData.email)
      .single()

    if (existingUser) {
      throw new ApiError('User with this email already exists', 409, 'USER_EXISTS')
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: requestData.email,
      password: requestData.password,
      options: {
        data: {
          first_name: requestData.firstName,
          last_name: requestData.lastName,
          user_type: requestData.userType,
        },
      },
    })

    if (authError) {
      console.error('Auth signup error:', authError)
      throw new ApiError(authError.message, 400, 'SIGNUP_FAILED')
    }

    if (!authData.user) {
      throw new ApiError('Failed to create user account', 500, 'SIGNUP_FAILED')
    }

    // Create user profile
    const { error: userError } = await supabase.from('users').insert({
      id: authData.user.id,
      email: requestData.email,
      first_name: requestData.firstName,
      last_name: requestData.lastName,
      phone: requestData.phone,
      status: 'pending',
    })

    if (userError) {
      console.error('User profile creation error:', userError)
      // Clean up auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id)
      throw new ApiError('Failed to create user profile', 500, 'PROFILE_CREATION_FAILED')
    }

    // Create role-specific record
    if (requestData.userType === 'supplier') {
      const { error: supplierError } = await supabase.from('suppliers').insert({
        user_id: authData.user.id,
        company_name: requestData.companyName,
        website_url: requestData.website || null,
        status: 'pending',
      })

      if (supplierError) {
        console.error('Supplier creation error:', supplierError)
        throw new ApiError('Failed to create supplier profile', 500, 'SUPPLIER_CREATION_FAILED')
      }
    } else {
      const { error: buyerError } = await supabase.from('buyers').insert({
        user_id: authData.user.id,
        company_name: requestData.companyName,
        website_url: requestData.website || null,
        status: 'pending',
      })

      if (buyerError) {
        console.error('Buyer creation error:', buyerError)
        throw new ApiError('Failed to create buyer profile', 500, 'BUYER_CREATION_FAILED')
      }
    }

    return {
      success: true,
      message: 'Account created successfully. Please check your email to verify your account.',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        userType: requestData.userType,
        needsEmailVerification: !authData.user.email_confirmed_at,
      },
    }
  })
}
