/**
 * Auth cookie utilities for managing authentication state
 * Note: These are primarily used by the Netlify functions for httpOnly cookie management
 */

export interface AuthSession {
  access_token: string
  refresh_token: string
  expires_at: number
  user_id: string
}

// Cookie configuration
export const AUTH_COOKIE_NAME = 'dce-auth-session'
export const REFRESH_COOKIE_NAME = 'dce-refresh-token'

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
}

/**
 * Parse cookie string to get specific cookie value
 */
export function parseCookie(cookieString: string, cookieName: string): string | null {
  const cookies = cookieString.split(';').map(c => c.trim())
  for (const cookie of cookies) {
    const [name, value] = cookie.split('=')
    if (name === cookieName) {
      return decodeURIComponent(value)
    }
  }
  return null
}

/**
 * Create a secure cookie string
 */
export function createCookie(name: string, value: string, options = COOKIE_OPTIONS): string {
  const parts = [`${name}=${encodeURIComponent(value)}`]
  
  if (options.httpOnly) parts.push('HttpOnly')
  if (options.secure) parts.push('Secure')
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`)
  if (options.path) parts.push(`Path=${options.path}`)
  if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`)
  
  return parts.join('; ')
}

/**
 * Clear authentication cookies
 */
export function clearAuthCookies(): string[] {
  return [
    `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0`,
    `${REFRESH_COOKIE_NAME}=; Path=/; Max-Age=0`,
  ]
}

/**
 * Parse multiple cookies from cookie string
 */
export function parseCookies(cookieString: string): Record<string, string> {
  const cookies: Record<string, string> = {}
  cookieString.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=')
    if (name && value) {
      cookies[name] = decodeURIComponent(value)
    }
  })
  return cookies
}

/**
 * Extract session from cookies
 */
export function extractSessionFromCookies(cookies: string): AuthSession | null {
  const sessionCookie = parseCookie(cookies, AUTH_COOKIE_NAME)
  if (!sessionCookie) return null
  
  try {
    return JSON.parse(sessionCookie) as AuthSession
  } catch {
    return null
  }
}