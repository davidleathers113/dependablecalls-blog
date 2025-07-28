/**
 * CSRF Token Protection for DCE Platform
 * 
 * This module provides CSRF token generation and validation utilities
 * that work with Supabase Auth and React Hook Form.
 * 
 * Security features:
 * - Cryptographically secure token generation
 * - Token binding to user sessions
 * - Time-based token expiration
 * - Double-submit cookie pattern
 */

import { v4 as uuidv4 } from 'uuid'
import { getUser } from './supabase-optimized'

// Constants
const CSRF_COOKIE_NAME = '__Host-csrf-token'
const CSRF_HEADER_NAME = 'X-CSRF-Token'
const TOKEN_EXPIRY_MS = 60 * 60 * 1000 // 1 hour

// Token storage interface
interface CsrfToken {
  token: string
  expiresAt: number
  userId?: string
}

// In-memory token store (for server-side validation)
const tokenStore = new Map<string, CsrfToken>()

/**
 * Generates a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return uuidv4().replace(/-/g, '') // Remove hyphens for a cleaner token
}

/**
 * Creates a new CSRF token for the current user session
 */
export async function createCsrfToken(): Promise<string> {
  const token = generateCsrfToken()
  const expiresAt = Date.now() + TOKEN_EXPIRY_MS
  
  // Get current user
  const { data: { user } } = await getUser()
  
  // Store token with metadata
  const tokenData: CsrfToken = {
    token,
    expiresAt,
    userId: user?.id
  }
  
  // Store in memory (for server-side validation)
  tokenStore.set(token, tokenData)
  
  // Set secure cookie (for double-submit pattern)
  if (typeof window !== 'undefined') {
    setCsrfCookie(token, expiresAt)
  }
  
  return token
}

/**
 * Sets the CSRF token as a secure cookie
 */
function setCsrfCookie(token: string, expiresAt: number): void {
  const expires = new Date(expiresAt).toUTCString()
  
  // Using __Host- prefix for maximum security
  // Requirements: Secure, Path=/, no Domain, SameSite=Strict
  document.cookie = `${CSRF_COOKIE_NAME}=${token}; Secure; Path=/; SameSite=Strict; Expires=${expires}`
}

/**
 * Gets the CSRF token from cookies
 */
export function getCsrfTokenFromCookie(): string | null {
  if (typeof window === 'undefined') return null
  
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === CSRF_COOKIE_NAME) {
      return value
    }
  }
  return null
}

/**
 * Validates a CSRF token
 */
export async function validateCsrfToken(token: string): Promise<boolean> {
  if (!token) return false
  
  // Check token store
  const tokenData = tokenStore.get(token)
  if (!tokenData) return false
  
  // Check expiration
  if (Date.now() > tokenData.expiresAt) {
    tokenStore.delete(token)
    return false
  }
  
  // Validate user session if token has userId
  if (tokenData.userId) {
    const { data: { user } } = await getUser()
    if (user?.id !== tokenData.userId) {
      return false
    }
  }
  
  return true
}

/**
 * Clears expired tokens from the store
 */
export function cleanupExpiredTokens(): void {
  const now = Date.now()
  for (const [token, data] of tokenStore.entries()) {
    if (now > data.expiresAt) {
      tokenStore.delete(token)
    }
  }
}

/**
 * Adds CSRF token to request headers
 */
export function addCsrfHeader(headers: HeadersInit = {}): HeadersInit {
  const token = getCsrfTokenFromCookie()
  if (token) {
    return {
      ...headers,
      [CSRF_HEADER_NAME]: token
    }
  }
  return headers
}

/**
 * Extracts CSRF token from request headers
 */
export function getCsrfTokenFromHeader(headers: Headers | HeadersInit): string | null {
  if (headers instanceof Headers) {
    return headers.get(CSRF_HEADER_NAME)
  }
  
  // Handle plain object headers
  const headerObj = headers as Record<string, string>
  return headerObj[CSRF_HEADER_NAME] || null
}

/**
 * Middleware helper for edge functions
 */
export async function verifyCsrfToken(request: Request): Promise<{ valid: boolean; error?: string }> {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return { valid: true }
  }
  
  // Get token from header
  const headerToken = getCsrfTokenFromHeader(request.headers)
  if (!headerToken) {
    return { valid: false, error: 'Missing CSRF token' }
  }
  
  // Get token from cookie for double-submit verification
  const cookieHeader = request.headers.get('cookie')
  const cookieToken = cookieHeader ? extractCsrfFromCookieHeader(cookieHeader) : null
  
  if (!cookieToken) {
    return { valid: false, error: 'Missing CSRF cookie' }
  }
  
  // Verify tokens match (double-submit pattern)
  if (headerToken !== cookieToken) {
    return { valid: false, error: 'CSRF token mismatch' }
  }
  
  // Validate token
  const isValid = await validateCsrfToken(headerToken)
  if (!isValid) {
    return { valid: false, error: 'Invalid or expired CSRF token' }
  }
  
  return { valid: true }
}

/**
 * Helper to extract CSRF token from cookie header string
 */
function extractCsrfFromCookieHeader(cookieHeader: string): string | null {
  const cookies = cookieHeader.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === CSRF_COOKIE_NAME) {
      return value
    }
  }
  return null
}

/**
 * React Hook Form integration helper
 */
export function withCsrfToken<T extends Record<string, unknown>>(data: T): T & { csrfToken: string } {
  const token = getCsrfTokenFromCookie()
  if (!token) {
    throw new Error('CSRF token not found')
  }
  return { ...data, csrfToken: token }
}

// Run cleanup periodically
if (typeof window !== 'undefined') {
  setInterval(cleanupExpiredTokens, 5 * 60 * 1000) // Every 5 minutes
}