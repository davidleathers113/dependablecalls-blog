/**
 * Rate Limiting Middleware for Netlify Edge Functions
 * 
 * Provides distributed rate limiting across edge functions with Redis backend
 * Includes geographic analysis, behavioral detection, and DDoS protection
 */

import type { HandlerEvent, HandlerResponse } from '@netlify/functions';
import { rateLimiter, UserContext, RateLimitResult } from '../../../src/lib/security/rate-limiter';
import { geoIPAnalyzer } from '../../../src/lib/security/geo-ip-analyzer';

export interface RateLimitMiddlewareOptions {
  skipPaths?: string[];
  skipMethods?: string[];
  customIdentifier?: (event: HandlerEvent) => string;
  onLimitExceeded?: (event: HandlerEvent, result: RateLimitResult) => Promise<void>;
  enableGeoBlocking?: boolean;
  enableBehavioralAnalysis?: boolean;
}

export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  'X-RateLimit-RetryAfter'?: string;
}

/**
 * Rate limiting middleware wrapper for Netlify functions
 */
export async function withRateLimit(
  event: HandlerEvent,
  handler: (event: HandlerEvent) => Promise<HandlerResponse>,
  options: RateLimitMiddlewareOptions = {}
): Promise<HandlerResponse> {
  const {
    skipPaths = [],
    skipMethods = ['OPTIONS'],
    customIdentifier,
    onLimitExceeded,
    enableGeoBlocking = true,
    enableBehavioralAnalysis = true
  } = options;

  // Skip rate limiting for specified methods
  if (skipMethods.includes(event.httpMethod)) {
    return handler(event);
  }

  // Skip rate limiting for specified paths
  const path = event.path || event.rawUrl;
  if (skipPaths.some(skipPath => path.includes(skipPath))) {
    return handler(event);
  }

  try {
    // Extract request information
    const requestInfo = await extractRequestInfo(event);
    
    // Geographic IP analysis and blocking
    if (enableGeoBlocking) {
      const geoResult = await geoIPAnalyzer.shouldBlockIP(requestInfo.ipAddress);
      
      if (geoResult.blocked) {
        return createGeoBlockResponse(geoResult.reason || 'Geographic restriction', geoResult.rule);
      }
    }

    // Generate rate limit identifier
    const identifier = customIdentifier ? customIdentifier(event) : generateIdentifier(requestInfo);
    
    // Get appropriate rate limit configuration
    const config = rateLimiter.getUserRateLimit(requestInfo, path);
    
    // Check rate limit
    const result = await rateLimiter.checkLimit(identifier, config, requestInfo);
    
    // Add rate limit headers to response
    const headers = generateRateLimitHeaders(result, config);

    if (!result.allowed) {
      // Log limit exceeded event
      if (onLimitExceeded) {
        await onLimitExceeded(event, result);
      }

      // Check if progressive CAPTCHA should be triggered
      if (enableBehavioralAnalysis) {
        const shouldShowCaptcha = await shouldTriggerCaptcha(requestInfo, result);
        if (shouldShowCaptcha) {
          return createCaptchaResponse(headers);
        }
      }

      return createRateLimitResponse(result, headers);
    }

    // Update last seen for IP tracking
    await geoIPAnalyzer.updateLastSeen(requestInfo.ipAddress);

    // Behavioral analysis for suspicious patterns
    if (enableBehavioralAnalysis) {
      await analyzeBehavioralPatterns(requestInfo);
    }

    // Execute the original handler
    const response = await handler(event);
    
    // Add rate limit headers to successful response
    return {
      ...response,
      headers: {
        ...response.headers,
        ...headers
      }
    };

  } catch (error) {
    console.error('Rate limiting middleware error:', error);
    // Fail open - execute handler if rate limiting fails
    return handler(event);
  }
}

/**
 * Extract request information from Netlify function event
 */
async function extractRequestInfo(event: HandlerEvent): Promise<UserContext> {
  const headers = event.headers as Record<string, string>;
  
  // Extract IP address (handling Netlify's forwarded headers)
  const ipAddress = extractIPAddress(event);
  
  // Extract user agent
  const userAgent = headers['user-agent'] || '';
  
  // Check authentication status (you may need to customize this based on your auth system)
  const { isAuthenticated, userId, userRole } = await extractAuthInfo(event);
  
  // Get geographic information
  let geoInfo;
  try {
    geoInfo = await geoIPAnalyzer.analyzeIP(ipAddress);
  } catch (error) {
    console.error('Failed to get geo info:', error);
    geoInfo = null;
  }

  return {
    userId,
    userRole: userRole || 'anonymous',
    isAuthenticated,
    ipAddress,
    userAgent,
    country: geoInfo?.country,
    city: geoInfo?.city
  };
}

/**
 * Extract IP address from request headers
 */
function extractIPAddress(event: HandlerEvent): string {
  const headers = event.headers as Record<string, string>;
  
  // Check various headers in order of preference
  const ipHeaders = [
    'x-nf-client-connection-ip',  // Netlify specific
    'cf-connecting-ip',           // Cloudflare
    'x-forwarded-for',           // Standard proxy header
    'x-real-ip',                 // Nginx
    'x-client-ip',               // General
    'x-forwarded',
    'x-cluster-client-ip',
    'forwarded-for',
    'forwarded'
  ];

  for (const header of ipHeaders) {
    const value = headers[header];
    if (value) {
      // Handle comma-separated IPs (take the first one)
      const ip = value.split(',')[0].trim();
      if (isValidIP(ip)) {
        return ip;
      }
    }
  }

  // Fallback to a default if no IP found
  return '127.0.0.1';
}

/**
 * Extract authentication information from request
 */
async function extractAuthInfo(event: HandlerEvent): Promise<{
  isAuthenticated: boolean;
  userId?: string;
  userRole?: 'anonymous' | 'supplier' | 'buyer' | 'admin';
}> {
  const headers = event.headers as Record<string, string>;
  
  // Check for authorization header
  const authHeader = headers.authorization;
  if (!authHeader) {
    return { isAuthenticated: false };
  }

  try {
    // You would implement your actual JWT verification here
    // This is a simplified example
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // Mock JWT decode - replace with actual verification
      if (token === 'mock-admin-token') {
        return {
          isAuthenticated: true,
          userId: 'admin-user',
          userRole: 'admin'
        };
      }
      
      if (token === 'mock-buyer-token') {
        return {
          isAuthenticated: true,
          userId: 'buyer-user',
          userRole: 'buyer'
        };
      }
      
      if (token === 'mock-supplier-token') {
        return {
          isAuthenticated: true,
          userId: 'supplier-user',
          userRole: 'supplier'
        };
      }
    }
  } catch (error) {
    console.error('Failed to extract auth info:', error);
  }

  return { isAuthenticated: false };
}

/**
 * Generate unique identifier for rate limiting
 */
function generateIdentifier(context: UserContext): string {
  if (context.isAuthenticated && context.userId) {
    return `user:${context.userId}`;
  }
  
  // Use IP + User Agent hash for anonymous users
  const identifier = `ip:${context.ipAddress}`;
  return identifier;
}

/**
 * Generate rate limit headers for response
 */
function generateRateLimitHeaders(result: RateLimitResult, config: { maxRequests: number }): RateLimitHeaders {
  const headers: RateLimitHeaders = {
    'X-RateLimit-Limit': config.maxRequests.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString()
  };

  if (result.retryAfter) {
    headers['X-RateLimit-RetryAfter'] = result.retryAfter.toString();
  }

  return headers;
}

/**
 * Create rate limit exceeded response
 */
function createRateLimitResponse(result: RateLimitResult, headers: RateLimitHeaders): HandlerResponse {
  return {
    statusCode: 429,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      retryAfter: result.retryAfter,
      resetTime: result.resetTime
    })
  };
}

/**
 * Create geographic blocking response
 */
function createGeoBlockResponse(reason: string, ruleId?: string): HandlerResponse {
  return {
    statusCode: 403,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      error: 'Geographic restriction',
      message: 'Access denied due to geographic restrictions.',
      reason,
      ruleId
    })
  };
}

/**
 * Create CAPTCHA challenge response
 */
function createCaptchaResponse(headers: RateLimitHeaders): HandlerResponse {
  return {
    statusCode: 429,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify({
      error: 'Rate limit exceeded',
      message: 'Please complete CAPTCHA verification to continue.',
      requiresCaptcha: true,
      captchaType: 'hcaptcha'
    })
  };
}

/**
 * Check if progressive CAPTCHA should be triggered
 */
async function shouldTriggerCaptcha(context: UserContext, result: RateLimitResult): Promise<boolean> {
  // Trigger CAPTCHA for repeated violations
  if (result.totalRequests > 50) { // Configurable threshold
    return true;
  }

  // Check if IP has been flagged as suspicious
  const isSuspicious = await rateLimiter.redis.sismember('suspicious_ips:global', context.ipAddress);
  if (isSuspicious) {
    return true;
  }

  // Geographic risk factor
  const geoInfo = await geoIPAnalyzer.analyzeIP(context.ipAddress);
  if (geoInfo.threatLevel === 'high' || geoInfo.threatLevel === 'critical') {
    return true;
  }

  return false;
}

/**
 * Analyze behavioral patterns for suspicious activity
 */
async function analyzeBehavioralPatterns(context: UserContext): Promise<void> {
  // Track request patterns
  const patternKey = `pattern:${context.ipAddress}`;
  const now = Date.now();
  
  try {
    // Store request timestamp
    await rateLimiter.redis.zadd(patternKey, now, now.toString());
    await rateLimiter.redis.expire(patternKey, 3600); // 1 hour
    
    // Get recent requests
    const recentRequests = await rateLimiter.redis.zrange(patternKey, -100, -1);
    
    if (recentRequests.length >= 10) {
      const timestamps = recentRequests.map(ts => parseInt(ts));
      
      // Check for suspicious patterns
      const isSuspicious = detectSuspiciousPatterns(timestamps);
      
      if (isSuspicious) {
        // Flag IP as suspicious
        await rateLimiter.addSuspiciousIP(context.ipAddress, context.country);
        
        // Log suspicious activity
        console.warn(`Suspicious activity detected for IP: ${context.ipAddress}`, {
          pattern: 'rapid_requests',
          requestCount: recentRequests.length,
          timeWindow: '1_hour'
        });
      }
    }
  } catch (error) {
    console.error('Failed to analyze behavioral patterns:', error);
  }
}

/**
 * Detect suspicious request patterns
 */
function detectSuspiciousPatterns(timestamps: number[]): boolean {
  if (timestamps.length < 10) return false;
  
  // Check for burst patterns (many requests in short time)
  const sortedTimestamps = timestamps.sort((a, b) => a - b);
  const latest = sortedTimestamps[sortedTimestamps.length - 1];
  const earliest = sortedTimestamps[0];
  
  // If 10+ requests in less than 30 seconds, it's suspicious
  if (latest - earliest < 30000) {
    return true;
  }
  
  // Check for regular intervals (bot-like behavior)
  const intervals = [];
  for (let i = 1; i < sortedTimestamps.length; i++) {
    intervals.push(sortedTimestamps[i] - sortedTimestamps[i - 1]);
  }
  
  // If intervals are too regular, it might be automated
  const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
  const standardDeviation = Math.sqrt(variance);
  
  // Low variance indicates regular intervals (bot-like)
  if (standardDeviation < avgInterval * 0.1) {
    return true;
  }
  
  return false;
}

/**
 * Validate IP address format
 */
function isValidIP(ip: string): boolean {
  // Simple IPv4 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part);
      return num >= 0 && num <= 255;
    });
  }
  
  // Simple IPv6 validation (basic)
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv6Regex.test(ip);
}

/**
 * DDoS detection and mitigation
 */
export async function detectDDoS(event: HandlerEvent): Promise<{
  isDDoS: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  mitigationActions: string[];
}> {
  const requestInfo = await extractRequestInfo(event);
  const now = Date.now();
  
  try {
    // Track global request patterns
    const globalKey = 'ddos:global';
    await rateLimiter.redis.zadd(globalKey, now, `${now}-${Math.random()}`);
    await rateLimiter.redis.expire(globalKey, 300); // 5 minutes
    
    // Count requests in last minute
    const lastMinute = now - 60000;
    const requestsLastMinute = await rateLimiter.redis.zcount(globalKey, lastMinute, now);
    
    // Count requests in last 5 minutes
    const last5Minutes = now - 300000;
    const requestsLast5Minutes = await rateLimiter.redis.zcount(globalKey, last5Minutes, now);
    
    // Count unique IPs in last minute
    const uniqueIPsKey = 'ddos:unique_ips';
    await rateLimiter.redis.sadd(uniqueIPsKey, requestInfo.ipAddress);
    await rateLimiter.redis.expire(uniqueIPsKey, 60);
    const uniqueIPs = await rateLimiter.redis.scard(uniqueIPsKey);
    
    // DDoS detection logic
    let isDDoS = false;
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const mitigationActions: string[] = [];
    
    // Thresholds for DDoS detection
    if (requestsLastMinute > 1000) {
      isDDoS = true;
      severity = 'critical';
      mitigationActions.push('activate_emergency_mode', 'block_all_anonymous', 'enable_strict_captcha');
    } else if (requestsLastMinute > 500) {
      isDDoS = true;
      severity = 'high';
      mitigationActions.push('enable_captcha', 'strict_rate_limits', 'block_suspicious_ips');
    } else if (requestsLastMinute > 200) {
      isDDoS = true;
      severity = 'medium';
      mitigationActions.push('enhanced_rate_limits', 'geographic_filtering');
    } else if (requestsLastMinute > 100) {
      isDDoS = true;
      severity = 'low';
      mitigationActions.push('monitor_closely', 'prepare_defenses');
    }
    
    // Check for low-and-slow attacks
    if (requestsLast5Minutes > 2000 && uniqueIPs < 10) {
      isDDoS = true;
      severity = Math.max(severity === 'low' ? 1 : severity === 'medium' ? 2 : severity === 'high' ? 3 : 4, 2) === 2 ? 'medium' : 'high';
      mitigationActions.push('block_low_unique_ip_sources');
    }
    
    return {
      isDDoS,
      severity,
      mitigationActions
    };
    
  } catch (error) {
    console.error('DDoS detection error:', error);
    return {
      isDDoS: false,
      severity: 'low',
      mitigationActions: []
    };
  }
}

/**
 * Apply DDoS mitigation measures
 */
export async function applyDDoSMitigation(
  event: HandlerEvent,
  mitigationActions: string[]
): Promise<HandlerResponse | null> {
  
  if (mitigationActions.includes('activate_emergency_mode')) {
    return {
      statusCode: 503,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '300'
      },
      body: JSON.stringify({
        error: 'Service temporarily unavailable',
        message: 'The service is experiencing high load. Please try again later.',
        retryAfter: 300
      })
    };
  }
  
  if (mitigationActions.includes('block_all_anonymous')) {
    const requestInfo = await extractRequestInfo(event);
    if (!requestInfo.isAuthenticated) {
      return {
        statusCode: 429,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Authentication required',
          message: 'Authentication is temporarily required for all requests.'
        })
      };
    }
  }
  
  // Additional mitigation measures would be implemented here
  // For example: strict CAPTCHA, enhanced filtering, etc.
  
  return null; // No mitigation response needed
}