/**
 * Integration Tests for Rate Limiting Middleware
 * 
 * Tests the complete rate limiting system integration with Netlify Edge Functions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { HandlerEvent, HandlerResponse } from '@netlify/functions';
import { withRateLimit, detectDDoS, applyDDoSMitigation } from '../../../netlify/functions/_shared/rate-limit-middleware';

// Mock external dependencies
vi.mock('../../../src/lib/security/rate-limiter');
vi.mock('../../../src/lib/security/geo-ip-analyzer');
vi.mock('../../../src/lib/security/behavioral-analyzer');
vi.mock('../../../src/lib/security/captcha-system');
vi.mock('../../../src/lib/security/bypass-protection');

describe('Rate Limiting Middleware Integration', () => {
  let mockEvent: HandlerEvent;
  let mockHandler: vi.Mock;

  beforeEach(() => {
    mockEvent = {
      httpMethod: 'POST',
      path: '/api/test',
      headers: {
        'user-agent': 'Mozilla/5.0 (test browser)',
        'x-forwarded-for': '192.168.1.1'
      },
      body: '{"test": "data"}',
      isBase64Encoded: false,
      multiValueHeaders: {},
      multiValueQueryStringParameters: null,
      queryStringParameters: null,
      pathParameters: null,
      requestContext: {} as any,
      stageVariables: null,
      rawUrl: 'https://test.com/api/test'
    };

    mockHandler = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ success: true }),
      headers: { 'Content-Type': 'application/json' }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('withRateLimit', () => {
    it('should allow requests within rate limits', async () => {
      // Mock rate limiter to allow request
      const { rateLimiter } = await import('../../../src/lib/security/rate-limiter');
      vi.mocked(rateLimiter.checkLimit).mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetTime: Date.now() + 60000,
        totalRequests: 1
      });

      const { geoIPAnalyzer } = await import('../../../src/lib/security/geo-ip-analyzer');
      vi.mocked(geoIPAnalyzer.shouldBlockIP).mockResolvedValue({
        blocked: false,
        action: 'allow'
      });

      const response = await withRateLimit(mockEvent, mockHandler);

      expect(response.statusCode).toBe(200);
      expect(response.headers).toHaveProperty('X-RateLimit-Limit');
      expect(response.headers).toHaveProperty('X-RateLimit-Remaining');
      expect(mockHandler).toHaveBeenCalledWith(mockEvent);
    });

    it('should block requests exceeding rate limits', async () => {
      const { rateLimiter } = await import('../../../src/lib/security/rate-limiter');
      vi.mocked(rateLimiter.checkLimit).mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 60000,
        totalRequests: 11,
        retryAfter: 60
      });

      const { geoIPAnalyzer } = await import('../../../src/lib/security/geo-ip-analyzer');
      vi.mocked(geoIPAnalyzer.shouldBlockIP).mockResolvedValue({
        blocked: false,
        action: 'allow'
      });

      const response = await withRateLimit(mockEvent, mockHandler);

      expect(response.statusCode).toBe(429);
      expect(response.headers).toHaveProperty('X-RateLimit-RetryAfter');
      expect(mockHandler).not.toHaveBeenCalled();
      
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Rate limit exceeded');
    });

    it('should block requests from restricted geographic locations', async () => {
      const { geoIPAnalyzer } = await import('../../../src/lib/security/geo-ip-analyzer');
      vi.mocked(geoIPAnalyzer.shouldBlockIP).mockResolvedValue({
        blocked: true,
        reason: 'High-risk country detected',
        rule: 'block-high-risk-countries',
        action: 'block'
      });

      const response = await withRateLimit(mockEvent, mockHandler);

      expect(response.statusCode).toBe(403);
      expect(mockHandler).not.toHaveBeenCalled();
      
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Geographic restriction');
      expect(body.reason).toBe('High-risk country detected');
    });

    it('should require CAPTCHA for suspicious activity', async () => {
      const { rateLimiter } = await import('../../../src/lib/security/rate-limiter');
      vi.mocked(rateLimiter.checkLimit).mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 60000,
        totalRequests: 51 // High request count
      });

      const { geoIPAnalyzer } = await import('../../../src/lib/security/geo-ip-analyzer');
      vi.mocked(geoIPAnalyzer.shouldBlockIP).mockResolvedValue({
        blocked: false,
        action: 'allow'
      });

      vi.mocked(geoIPAnalyzer.analyzeIP).mockResolvedValue({
        ip: '192.168.1.1',
        country: 'Test Country',
        countryCode: 'TC',
        region: 'Test Region',
        city: 'Test City',
        latitude: 0,
        longitude: 0,
        timezone: 'UTC',
        isp: 'Test ISP',
        organization: 'Test Org',
        asn: 'AS12345',
        isProxy: false,
        isVpn: false,
        isTor: false,
        isHosting: false,
        threatLevel: 'high',
        reputation: 30
      });

      const response = await withRateLimit(mockEvent, mockHandler, {
        enableBehavioralAnalysis: true
      });

      expect(response.statusCode).toBe(429);
      const body = JSON.parse(response.body);
      expect(body.requiresCaptcha).toBe(true);
      expect(body.captchaType).toBe('hcaptcha');
    });

    it('should skip rate limiting for OPTIONS requests', async () => {
      mockEvent.httpMethod = 'OPTIONS';

      const response = await withRateLimit(mockEvent, mockHandler);

      expect(response.statusCode).toBe(200);
      expect(mockHandler).toHaveBeenCalledWith(mockEvent);
    });

    it('should skip rate limiting for specified paths', async () => {
      const response = await withRateLimit(mockEvent, mockHandler, {
        skipPaths: ['/api/test']
      });

      expect(response.statusCode).toBe(200);
      expect(mockHandler).toHaveBeenCalledWith(mockEvent);
    });

    it('should handle middleware errors gracefully', async () => {
      const { rateLimiter } = await import('../../../src/lib/security/rate-limiter');
      vi.mocked(rateLimiter.checkLimit).mockRejectedValue(new Error('Redis connection failed'));

      const response = await withRateLimit(mockEvent, mockHandler);

      // Should fail open and allow request
      expect(response.statusCode).toBe(200);
      expect(mockHandler).toHaveBeenCalledWith(mockEvent);
    });

    it('should apply bypass protection penalties', async () => {
      // Mock bypass protection to detect header manipulation
      const { bypassProtection } = await import('../../../src/lib/security/bypass-protection');
      vi.mocked(bypassProtection.analyzeRequest).mockResolvedValue({
        bypassAttempted: true,
        bypassType: 'header_manipulation',
        penaltyMultiplier: 2.0,
        shouldBlock: false,
        reason: 'Suspicious headers detected'
      });

      const { rateLimiter } = await import('../../../src/lib/security/rate-limiter');
      vi.mocked(rateLimiter.checkLimit).mockResolvedValue({
        allowed: true,
        remaining: 5,
        resetTime: Date.now() + 60000,
        totalRequests: 5
      });

      const { geoIPAnalyzer } = await import('../../../src/lib/security/geo-ip-analyzer');
      vi.mocked(geoIPAnalyzer.shouldBlockIP).mockResolvedValue({
        blocked: false,
        action: 'allow'
      });

      // Add suspicious headers
      mockEvent.headers['x-bypass-rate-limit'] = 'true';
      mockEvent.headers['x-forwarded-for'] = '1.1.1.1';
      mockEvent.headers['x-real-ip'] = '2.2.2.2';

      const response = await withRateLimit(mockEvent, mockHandler);

      expect(response.statusCode).toBe(200);
      // Verify that bypass protection was called
      expect(bypassProtection.analyzeRequest).toHaveBeenCalled();
    });
  });

  describe('DDoS Detection and Mitigation', () => {
    it('should detect DDoS attacks', async () => {
      const { rateLimiter } = await import('../../../src/lib/security/rate-limiter');
      
      // Mock high request count
      vi.mocked(rateLimiter.redis.zadd).mockResolvedValue(1);
      vi.mocked(rateLimiter.redis.expire).mockResolvedValue(1);
      vi.mocked(rateLimiter.redis.zcount).mockResolvedValue(1500); // Above threshold
      vi.mocked(rateLimiter.redis.sadd).mockResolvedValue(1);
      vi.mocked(rateLimiter.redis.scard).mockResolvedValue(5);

      const ddosResult = await detectDDoS(mockEvent);

      expect(ddosResult.isDDoS).toBe(true);
      expect(ddosResult.severity).toBe('critical');
      expect(ddosResult.mitigationActions).toContain('activate_emergency_mode');
    });

    it('should apply DDoS mitigation measures', async () => {
      const mitigationResponse = await applyDDoSMitigation(mockEvent, ['activate_emergency_mode']);

      expect(mitigationResponse?.statusCode).toBe(503);
      expect(mitigationResponse?.headers).toHaveProperty('Retry-After');
      
      const body = JSON.parse(mitigationResponse?.body || '{}');
      expect(body.error).toBe('Service temporarily unavailable');
    });

    it('should block anonymous users during emergency mode', async () => {
      const mitigationResponse = await applyDDoSMitigation(mockEvent, ['block_all_anonymous']);

      expect(mitigationResponse?.statusCode).toBe(429);
      
      const body = JSON.parse(mitigationResponse?.body || '{}');
      expect(body.error).toBe('Authentication required');
    });

    it('should not apply mitigation for low-level threats', async () => {
      const { rateLimiter } = await import('../../../src/lib/security/rate-limiter');
      
      // Mock normal request count
      vi.mocked(rateLimiter.redis.zcount).mockResolvedValue(50); // Below threshold

      const ddosResult = await detectDDoS(mockEvent);

      expect(ddosResult.isDDoS).toBe(false);
      expect(ddosResult.severity).toBe('low');
      expect(ddosResult.mitigationActions).toHaveLength(0);
    });
  });

  describe('Header Analysis', () => {
    it('should extract IP from various forwarding headers', async () => {
      // Test Netlify-specific headers
      mockEvent.headers['x-nf-client-connection-ip'] = '203.0.113.1';
      
      const { rateLimiter } = await import('../../../src/lib/security/rate-limiter');
      vi.mocked(rateLimiter.checkLimit).mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetTime: Date.now() + 60000,
        totalRequests: 1
      });

      const { geoIPAnalyzer } = await import('../../../src/lib/security/geo-ip-analyzer');
      vi.mocked(geoIPAnalyzer.shouldBlockIP).mockResolvedValue({
        blocked: false,
        action: 'allow'
      });

      await withRateLimit(mockEvent, mockHandler);

      // Verify that the correct IP was used for rate limiting
      expect(rateLimiter.checkLimit).toHaveBeenCalledWith(
        expect.stringMatching(/ip:203\.0\.113\.1/),
        expect.any(Object),
        expect.objectContaining({
          ipAddress: '203.0.113.1'
        })
      );
    });

    it('should handle comma-separated IPs in forwarding headers', async () => {
      mockEvent.headers['x-forwarded-for'] = '203.0.113.1, 198.51.100.1, 192.168.1.1';
      
      const { rateLimiter } = await import('../../../src/lib/security/rate-limiter');
      vi.mocked(rateLimiter.checkLimit).mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetTime: Date.now() + 60000,
        totalRequests: 1
      });

      const { geoIPAnalyzer } = await import('../../../src/lib/security/geo-ip-analyzer');
      vi.mocked(geoIPAnalyzer.shouldBlockIP).mockResolvedValue({
        blocked: false,
        action: 'allow'
      });

      await withRateLimit(mockEvent, mockHandler);

      // Should use the first IP in the chain
      expect(rateLimiter.checkLimit).toHaveBeenCalledWith(
        expect.stringMatching(/ip:203\.0\.113\.1/),
        expect.any(Object),
        expect.objectContaining({
          ipAddress: '203.0.113.1'
        })
      );
    });

    it('should fallback to default IP when no valid headers found', async () => {
      // Remove IP headers
      delete mockEvent.headers['x-forwarded-for'];
      
      const { rateLimiter } = await import('../../../src/lib/security/rate-limiter');
      vi.mocked(rateLimiter.checkLimit).mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetTime: Date.now() + 60000,
        totalRequests: 1
      });

      const { geoIPAnalyzer } = await import('../../../src/lib/security/geo-ip-analyzer');
      vi.mocked(geoIPAnalyzer.shouldBlockIP).mockResolvedValue({
        blocked: false,
        action: 'allow'
      });

      await withRateLimit(mockEvent, mockHandler);

      // Should use fallback IP
      expect(rateLimiter.checkLimit).toHaveBeenCalledWith(
        expect.stringMatching(/ip:127\.0\.0\.1/),
        expect.any(Object),
        expect.objectContaining({
          ipAddress: '127.0.0.1'
        })
      );
    });
  });

  describe('Authentication Context', () => {
    it('should identify authenticated users from JWT tokens', async () => {
      mockEvent.headers.authorization = 'Bearer mock-buyer-token';
      
      const { rateLimiter } = await import('../../../src/lib/security/rate-limiter');
      vi.mocked(rateLimiter.checkLimit).mockResolvedValue({
        allowed: true,
        remaining: 119,
        resetTime: Date.now() + 60000,
        totalRequests: 1
      });

      vi.mocked(rateLimiter.getUserRateLimit).mockReturnValue({
        windowMs: 60000,
        maxRequests: 120, // Buyer limit
        store: 'redis'
      });

      const { geoIPAnalyzer } = await import('../../../src/lib/security/geo-ip-analyzer');
      vi.mocked(geoIPAnalyzer.shouldBlockIP).mockResolvedValue({
        blocked: false,
        action: 'allow'
      });

      await withRateLimit(mockEvent, mockHandler);

      expect(rateLimiter.getUserRateLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          isAuthenticated: true,
          userRole: 'buyer',
          userId: 'buyer-user'
        }),
        '/api/test'
      );
    });

    it('should apply different rate limits for different user roles', async () => {
      mockEvent.headers.authorization = 'Bearer mock-admin-token';
      
      const { rateLimiter } = await import('../../../src/lib/security/rate-limiter');
      vi.mocked(rateLimiter.checkLimit).mockResolvedValue({
        allowed: true,
        remaining: 299,
        resetTime: Date.now() + 60000,
        totalRequests: 1
      });

      vi.mocked(rateLimiter.getUserRateLimit).mockReturnValue({
        windowMs: 60000,
        maxRequests: 300, // Admin limit
        store: 'redis'
      });

      const { geoIPAnalyzer } = await import('../../../src/lib/security/geo-ip-analyzer');
      vi.mocked(geoIPAnalyzer.shouldBlockIP).mockResolvedValue({
        blocked: false,
        action: 'allow'
      });

      await withRateLimit(mockEvent, mockHandler);

      expect(rateLimiter.getUserRateLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          isAuthenticated: true,
          userRole: 'admin',
          userId: 'admin-user'
        }),
        '/api/test'
      );
    });
  });

  describe('Behavioral Analysis Integration', () => {
    it('should record request patterns for behavioral analysis', async () => {
      const { behavioralAnalyzer } = await import('../../../src/lib/security/behavioral-analyzer');
      const { rateLimiter } = await import('../../../src/lib/security/rate-limiter');
      const { geoIPAnalyzer } = await import('../../../src/lib/security/geo-ip-analyzer');

      vi.mocked(rateLimiter.checkLimit).mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetTime: Date.now() + 60000,
        totalRequests: 1
      });

      vi.mocked(geoIPAnalyzer.shouldBlockIP).mockResolvedValue({
        blocked: false,
        action: 'allow'
      });

      await withRateLimit(mockEvent, mockHandler, {
        enableBehavioralAnalysis: true
      });

      expect(behavioralAnalyzer.recordPattern).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: expect.any(String),
          endpoint: '/api/test',
          method: 'POST',
          timestamp: expect.any(Number)
        }),
        expect.objectContaining({
          ipAddress: expect.any(String)
        })
      );
    });
  });
});