import type { Handler } from '@netlify/functions'
import { withAuth } from '../../src/lib/auth-middleware'
import { withCsrfProtection } from './_shared/csrf-middleware'
import { clearSessionCookies } from '../../src/lib/auth-cookies'

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

  return withCsrfProtection(event, async (event) => {
    return withAuth(event, async (context) => {
    // Sign out the user from Supabase
    const { error } = await context.supabase.auth.signOut()

    if (error) {
      console.error('Logout error:', error)
      // Don't throw error, logout should always succeed from client perspective
    }

    // Clear all session cookies
    const clearCookies = clearSessionCookies()

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
        // Clear multiple cookies
        'Set-Cookie': clearCookies,
      },
      body: JSON.stringify({
        success: true,
        message: 'Logged out successfully',
      }),
    }
    })
  })
}
