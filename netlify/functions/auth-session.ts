import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { parseCookies, extractSessionFromCookies, isSessionExpired, createSessionCookies } from '../../src/lib/auth-cookies'
import type { Database } from '../../src/types/database'

const supabase = createClient<Database>(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
)

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: '',
    }
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  try {
    // Parse cookies from request
    const cookieHeader = event.headers.cookie || ''
    const cookies = parseCookies(cookieHeader)
    const { accessToken, refreshToken, sessionInfo } = extractSessionFromCookies(cookies)

    if (!accessToken) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({
          success: false,
          message: 'No session found',
          user: null,
          session: null,
        }),
      }
    }

    // Check if session is expired
    if (isSessionExpired(sessionInfo?.expires_at)) {
      // Try to refresh the session if we have a refresh token
      if (refreshToken) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
          refresh_token: refreshToken,
        })

        if (refreshError || !refreshData.session) {
          // Refresh failed, session is invalid
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Credentials': 'true',
            },
            body: JSON.stringify({
              success: false,
              message: 'Session expired',
              user: null,
              session: null,
            }),
          }
        }

        // Update cookies with new session
        const newSessionCookies = createSessionCookies(refreshData.session)
        
        // Get user details
        const { data: { user }, error: userError } = await supabase.auth.getUser(refreshData.session.access_token)
        
        if (userError || !user) {
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Credentials': 'true',
            },
            body: JSON.stringify({
              success: false,
              message: 'Failed to get user',
              user: null,
              session: null,
            }),
          }
        }

        // Get user profile and determine type
        const { data: userData } = await supabase
          .from('users')
          .select('id, email, first_name, last_name, status, is_active')
          .eq('id', user.id)
          .single()

        // Determine user type
        let userType: 'supplier' | 'buyer' | 'admin' | 'network' | undefined
        const [supplierCheck, buyerCheck, adminCheck, networkCheck] = await Promise.all([
          supabase.from('suppliers').select('id').eq('user_id', user.id).single(),
          supabase.from('buyers').select('id').eq('user_id', user.id).single(),
          supabase.from('admins').select('id').eq('user_id', user.id).single(),
          supabase.from('networks').select('id').eq('user_id', user.id).single(),
        ])

        if (adminCheck.data) {
          userType = 'admin'
        } else if (networkCheck.data) {
          userType = 'network'
        } else if (buyerCheck.data) {
          userType = 'buyer'
        } else if (supplierCheck.data) {
          userType = 'supplier'
        }

        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true',
            // Update cookies with refreshed session
            'Set-Cookie': newSessionCookies,
          },
          body: JSON.stringify({
            success: true,
            message: 'Session refreshed',
            user: {
              id: user.id,
              email: user.email,
              firstName: userData?.first_name,
              lastName: userData?.last_name,
              userType,
            },
            session: {
              expires_at: refreshData.session.expires_at,
            },
          }),
        }
      } else {
        // No refresh token, session is invalid
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true',
          },
          body: JSON.stringify({
            success: false,
            message: 'Session expired',
            user: null,
            session: null,
          }),
        }
      }
    }

    // Session is still valid, verify the access token
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken)

    if (userError || !user) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({
          success: false,
          message: 'Invalid session',
          user: null,
          session: null,
        }),
      }
    }

    // Get user profile
    const { data: userData } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, status, is_active')
      .eq('id', user.id)
      .single()

    // Determine user type
    let userType: 'supplier' | 'buyer' | 'admin' | 'network' | undefined
    const [supplierCheck, buyerCheck, adminCheck, networkCheck] = await Promise.all([
      supabase.from('suppliers').select('id').eq('user_id', user.id).single(),
      supabase.from('buyers').select('id').eq('user_id', user.id).single(),
      supabase.from('admins').select('id').eq('user_id', user.id).single(),
      supabase.from('networks').select('id').eq('user_id', user.id).single(),
    ])

    if (adminCheck.data) {
      userType = 'admin'
    } else if (networkCheck.data) {
      userType = 'network'
    } else if (buyerCheck.data) {
      userType = 'buyer'
    } else if (supplierCheck.data) {
      userType = 'supplier'
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({
        success: true,
        message: 'Session valid',
        user: {
          id: user.id,
          email: user.email,
          firstName: userData?.first_name,
          lastName: userData?.last_name,
          userType,
        },
        session: {
          expires_at: sessionInfo?.expires_at,
        },
      }),
    }
  } catch (error) {
    console.error('Session check error:', error)
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({
        error: 'Internal server error',
      }),
    }
  }
}