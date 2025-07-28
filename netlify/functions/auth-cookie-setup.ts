import type { Handler } from '@netlify/functions'
import { generateCsrfToken } from '../../src/lib/csrf'
import { createCookie } from '../../src/lib/auth-cookies'

/**
 * Edge function to set up secure authentication cookies
 * This function sets CSRF tokens and other security headers
 */
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
    // Generate CSRF token for additional security
    const csrfToken = generateCsrfToken()
    
    // Create CSRF cookie (not httpOnly so client can read it)
    const csrfCookie = createCookie('dce-csrf-token', csrfToken, {
      maxAge: 2 * 60 * 60, // 2 hours in seconds
      httpOnly: false, // Client needs to read this
      secure: true,
      sameSite: 'strict',
      path: '/',
    })

    // Set security headers
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
        'Set-Cookie': csrfCookie,
        // Security headers
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
      },
      body: JSON.stringify({
        success: true,
        csrfToken,
        message: 'Authentication cookies configured',
      }),
    }
  } catch (error) {
    console.error('Cookie setup error:', error)
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