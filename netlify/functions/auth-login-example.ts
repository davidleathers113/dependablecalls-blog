/**
 * EXAMPLE: CSRF-protected auth endpoint
 * This shows how to validate CSRF tokens in Netlify functions
 */

import type { Context } from '@netlify/functions'

// Simple constant-time comparison to prevent timing attacks
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }
  
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  
  return result === 0
}

export default async (request: Request, context: Context) => {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    // Get CSRF token from header and cookie
    const csrfHeader = request.headers.get('X-CSRF-Token')
    const cookies = request.headers.get('cookie') || ''
    const csrfCookie = cookies
      .split(';')
      .find(c => c.trim().startsWith('dce-csrf-token='))
      ?.split('=')[1]

    // Validate CSRF token
    if (!csrfHeader || !csrfCookie || !constantTimeCompare(csrfHeader, csrfCookie)) {
      return new Response(
        JSON.stringify({ error: 'Invalid CSRF token' }), 
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse request body
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // TODO: Implement actual authentication logic here
    // - Validate credentials with Supabase
    // - Set httpOnly cookies with session tokens
    // - Return user data (without sensitive tokens)

    return new Response(
      JSON.stringify({ 
        message: 'Login successful',
        user: { email, userType: 'supplier' } // Example response
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': [
            `auth-token=example-token; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`,
            `dce-csrf-token=${csrfHeader}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`
          ].join(', ')
        }
      }
    )

  } catch (error) {
    console.error('Auth login error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}