/**
 * Example Protected Netlify Edge Function with Rate Limiting
 * 
 * Demonstrates how to integrate the comprehensive rate limiting system
 * with actual Netlify Edge Functions
 */

import type { HandlerEvent, HandlerResponse } from '@netlify/functions';
import { withRateLimit, detectDDoS, applyDDoSMitigation } from './_shared/rate-limit-middleware';
import { withCsrfProtection } from './_shared/csrf-middleware';

/**
 * Example API endpoint with comprehensive security protection
 */
const protectedHandler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  // Your actual business logic here
  try {
    // Simulate some API processing
    const requestData = event.body ? JSON.parse(event.body) : {};
    
    // Example business logic
    const responseData = {
      message: 'Request processed successfully',
      timestamp: new Date().toISOString(),
      requestId: `req_${Date.now()}`,
      data: requestData
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify(responseData)
    };

  } catch (error) {
    console.error('Handler error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      })
    };
  }
};

/**
 * Main handler with layered security protection
 */
export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  try {
    // Layer 1: DDoS Detection and Mitigation
    const ddosResult = await detectDDoS(event);
    if (ddosResult.isDDoS) {
      const mitigationResponse = await applyDDoSMitigation(event, ddosResult.mitigationActions);
      if (mitigationResponse) {
        return mitigationResponse;
      }
    }

    // Layer 2: Rate Limiting with Geographic and Behavioral Analysis
    return await withRateLimit(
      event,
      // Layer 3: CSRF Protection
      (event) => withCsrfProtection(event, protectedHandler),
      {
        // Rate limiting configuration
        skipMethods: ['OPTIONS'],
        skipPaths: ['/health', '/status'],
        enableGeoBlocking: true,
        enableBehavioralAnalysis: true,
        
        // Custom identifier for rate limiting (optional)
        customIdentifier: (event) => {
          // Example: Use session ID for authenticated users, IP for anonymous
          const authHeader = event.headers.authorization;
          if (authHeader) {
            // Extract session ID from JWT or use user ID
            return `session:${authHeader.substring(0, 20)}`;
          }
          return `ip:${event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || '127.0.0.1'}`;
        },

        // Custom handler for when limits are exceeded
        onLimitExceeded: async (event, result) => {
          console.warn('Rate limit exceeded:', {
            ip: event.headers['x-forwarded-for'],
            userAgent: event.headers['user-agent'],
            endpoint: event.path,
            totalRequests: result.totalRequests,
            timestamp: new Date().toISOString()
          });

          // Additional custom logging or alerting could go here
        }
      }
    );

  } catch (error) {
    console.error('Security middleware error:', error);
    
    // Fail safe - return a generic error
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Service temporarily unavailable',
        message: 'Please try again later'
      })
    };
  }
};

/**
 * Alternative simpler implementation for endpoints with basic protection
 */
export const simpleProtectedHandler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  // Simple rate limiting only
  return await withRateLimit(event, protectedHandler, {
    enableGeoBlocking: false,
    enableBehavioralAnalysis: false
  });
};

/**
 * High-security implementation for sensitive endpoints
 */
export const highSecurityHandler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  return await withRateLimit(event, protectedHandler, {
    // Enable all security features
    enableGeoBlocking: true,
    enableBehavioralAnalysis: true,
    
    // More restrictive for sensitive endpoints
    customIdentifier: (event) => {
      // Require authentication for sensitive endpoints
      const authHeader = event.headers.authorization;
      if (!authHeader) {
        throw new Error('Authentication required');
      }
      return `user:${authHeader}`;
    },

    onLimitExceeded: async (event, result) => {
      // Enhanced logging for sensitive endpoints
      console.error('Security violation on sensitive endpoint:', {
        ip: event.headers['x-forwarded-for'],
        userAgent: event.headers['user-agent'],
        endpoint: event.path,
        method: event.httpMethod,
        totalRequests: result.totalRequests,
        headers: event.headers,
        timestamp: new Date().toISOString()
      });

      // Could trigger additional security measures here
      // such as temporary IP blocking, admin notifications, etc.
    }
  });
};