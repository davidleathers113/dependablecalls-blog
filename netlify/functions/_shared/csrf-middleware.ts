/**
 * CSRF Middleware for Netlify Edge Functions
 * 
 * Provides CSRF token validation for state-changing requests
 */

import type { HandlerEvent, HandlerResponse } from '@netlify/functions'
import { verifyCsrfToken, getCsrfTokenFromHeader } from '../../../src/lib/csrf'

export interface CsrfMiddlewareOptions {
  skipMethods?: string[]
  skipPaths?: string[]
}

const DEFAULT_SKIP_METHODS = ['GET', 'HEAD', 'OPTIONS']

/**
 * CSRF protection middleware for Netlify functions
 */
export async function withCsrfProtection(
  event: HandlerEvent,
  handler: (event: HandlerEvent) => Promise<HandlerResponse>,
  options: CsrfMiddlewareOptions = {}
): Promise<HandlerResponse> {
  const { skipMethods = DEFAULT_SKIP_METHODS, skipPaths = [] } = options

  // Skip CSRF check for safe methods
  if (skipMethods.includes(event.httpMethod)) {
    return handler(event)
  }

  // Skip CSRF check for specified paths
  const path = event.path || event.rawUrl
  if (skipPaths.some(skipPath => path.includes(skipPath))) {
    return handler(event)
  }

  // Create a Request object for CSRF verification
  const request = new Request(event.rawUrl, {
    method: event.httpMethod,
    headers: new Headers(event.headers as Record<string, string>),
    body: event.body,
  })

  // Verify CSRF token
  const { valid, error } = await verifyCsrfToken(request)

  if (!valid) {
    return {
      statusCode: 403,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'CSRF validation failed',
        message: error || 'Invalid or missing CSRF token',
      }),
    }
  }

  // Token is valid, proceed with the handler
  return handler(event)
}

/**
 * Helper to extract CSRF token from event headers
 */
export function getCsrfTokenFromEvent(event: HandlerEvent): string | null {
  const headers = event.headers as Record<string, string>
  return getCsrfTokenFromHeader(headers)
}