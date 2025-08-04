/**
 * CSRF Protection Utilities
 * Implements double-submit cookie pattern for auth endpoints
 */

import { generateNonce } from './csp-nonce'

const CSRF_TOKEN_KEY = 'dce-csrf-token'
const CSRF_HEADER_NAME = 'X-CSRF-Token'

/**
 * Generate a CSRF token and store it in a secure cookie
 */
export function generateCSRFToken(): string {
  const token = generateNonce() // Reuse secure nonce generation
  
  // Set CSRF token in httpOnly cookie (should be done server-side)
  // For now, we'll use sessionStorage as a fallback
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(CSRF_TOKEN_KEY, token)
  }
  
  return token
}

/**
 * Get the current CSRF token from storage
 */
export function getCSRFToken(): string | null {
  if (typeof window === 'undefined') return null
  
  return sessionStorage.getItem(CSRF_TOKEN_KEY)
}

/**
 * Add CSRF headers to fetch requests for auth endpoints
 */
export function addCSRFHeaders(headers: HeadersInit = {}): HeadersInit {
  const token = getCSRFToken()
  
  if (!token) {
    // Generate new token if none exists
    const newToken = generateCSRFToken()
    return {
      ...headers,
      [CSRF_HEADER_NAME]: newToken,
    }
  }
  
  return {
    ...headers,
    [CSRF_HEADER_NAME]: token,
  }
}

/**
 * Initialize CSRF protection on app start
 */
export function initializeCSRFProtection(): void {
  if (typeof window === 'undefined') return
  
  // Generate initial CSRF token if none exists
  if (!getCSRFToken()) {
    generateCSRFToken()
  }
}

/**
 * Validate CSRF token (server-side usage example)
 */
export function validateCSRFToken(headerToken: string, cookieToken: string): boolean {
  if (!headerToken || !cookieToken) {
    return false
  }
  
  // Constant-time comparison to prevent timing attacks
  if (headerToken.length !== cookieToken.length) {
    return false
  }
  
  let result = 0
  for (let i = 0; i < headerToken.length; i++) {
    result |= headerToken.charCodeAt(i) ^ cookieToken.charCodeAt(i)
  }
  
  return result === 0
}