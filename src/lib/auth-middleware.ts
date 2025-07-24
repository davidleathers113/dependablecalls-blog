import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
)

export interface AuthContext {
  user: {
    id: string
    email: string
    role?: 'supplier' | 'buyer' | 'admin'
  } | null
  supabase: SupabaseClient<Database>
}

export interface ApiRequest {
  headers: Record<string, string | string[] | undefined>
  body?: string
  httpMethod: string
  queryStringParameters?: Record<string, string>
}

export interface ApiResponse {
  statusCode: number
  headers?: Record<string, string>
  body: string
}

export class ApiError extends Error {
  public statusCode: number
  public code?: string

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code
  }
}

export async function withAuth<T>(
  request: ApiRequest,
  handler: (context: AuthContext, request: ApiRequest) => Promise<T>
): Promise<ApiResponse> {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.authorization || request.headers.Authorization

    if (!authHeader || typeof authHeader !== 'string') {
      throw new ApiError('Missing authorization header', 401, 'UNAUTHORIZED')
    }

    const token = authHeader.replace('Bearer ', '')

    if (!token) {
      throw new ApiError('Invalid authorization header format', 401, 'UNAUTHORIZED')
    }

    // Verify the JWT token with Supabase
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      throw new ApiError('Invalid or expired token', 401, 'UNAUTHORIZED')
    }

    // Get user role from database
    const { error: userError } = await supabase
      .from('users')
      .select('id, email, metadata')
      .eq('id', user.id)
      .single()

    if (userError) {
      console.error('Error fetching user data:', userError)
      throw new ApiError('User not found', 404, 'USER_NOT_FOUND')
    }

    // Determine user role by checking related tables
    let role: 'supplier' | 'buyer' | 'admin' | undefined

    const [supplierCheck, buyerCheck, adminCheck] = await Promise.all([
      supabase.from('suppliers').select('id').eq('user_id', user.id).single(),
      supabase.from('buyers').select('id').eq('user_id', user.id).single(),
      supabase.from('admins').select('id').eq('user_id', user.id).single(),
    ])

    if (adminCheck.data) {
      role = 'admin'
    } else if (buyerCheck.data) {
      role = 'buyer'
    } else if (supplierCheck.data) {
      role = 'supplier'
    }

    const context: AuthContext = {
      user: {
        id: user.id,
        email: user.email!,
        role,
      },
      supabase,
    }

    const result = await handler(context, request)

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      },
      body: JSON.stringify(result),
    }
  } catch (error) {
    console.error('API Error:', error)

    if (error instanceof ApiError) {
      return {
        statusCode: error.statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        },
        body: JSON.stringify({
          error: error.message,
          code: error.code,
        }),
      }
    }

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      },
      body: JSON.stringify({
        error: 'Internal server error',
      }),
    }
  }
}

export async function withoutAuth<T>(
  request: ApiRequest,
  handler: (supabase: SupabaseClient<Database>, request: ApiRequest) => Promise<T>
): Promise<ApiResponse> {
  try {
    const result = await handler(supabase, request)

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      },
      body: JSON.stringify(result),
    }
  } catch (error) {
    console.error('API Error:', error)

    if (error instanceof ApiError) {
      return {
        statusCode: error.statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        },
        body: JSON.stringify({
          error: error.message,
          code: error.code,
        }),
      }
    }

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      },
      body: JSON.stringify({
        error: 'Internal server error',
      }),
    }
  }
}

export function requireRole(allowedRoles: Array<'supplier' | 'buyer' | 'admin'>) {
  return function <T>(
    request: ApiRequest,
    handler: (context: AuthContext, request: ApiRequest) => Promise<T>
  ) {
    return withAuth(request, async (context, req) => {
      if (!context.user?.role || !allowedRoles.includes(context.user.role)) {
        throw new ApiError('Insufficient permissions', 403, 'FORBIDDEN')
      }
      return handler(context, req)
    })
  }
}
