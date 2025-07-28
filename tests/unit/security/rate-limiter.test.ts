/**
 * Comprehensive Test Suite for Rate Limiting System
 * 
 * Tests Redis-based rate limiting, geographic analysis, behavioral detection,
 * CAPTCHA integration, and bypass protection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Redis from 'ioredis';
import { RedisRateLimiter, RateLimitTier, UserContext } from '../../../src/lib/security/rate-limiter';
import { GeoIPAnalyzer } from '../../../src/lib/security/geo-ip-analyzer';
import { BehavioralAnalyzer } from '../../../src/lib/security/behavioral-analyzer';
import { CaptchaSystem } from '../../../src/lib/security/captcha-system';
import { BypassProtection } from '../../../src/lib/security/bypass-protection';

// Mock Redis for testing
vi.mock('ioredis');

describe('RedisRateLimiter', () => {
  let rateLimiter: RedisRateLimiter;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      pipeline: vi.fn(() => ({
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn(() => Promise.resolve([[null, 0], [null, 5], [null, 1], [null, 1]]))
      })),
      zrem: vi.fn(),
      setex: vi.fn(),
      sadd: vi.fn(),
      sismember: vi.fn(() => Promise.resolve(0)),
      keys: vi.fn(() => Promise.resolve([])),
      del: vi.fn()
    };

    rateLimiter = new RedisRateLimiter(mockRedis);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('checkLimit', () => {
    it('should allow requests within rate limit', async () => {
      const config = { windowMs: 60000, maxRequests: 10, store: 'redis' as const };
      const context: UserContext = {
        isAuthenticated: false,
        ipAddress: '192.168.1.1',
        userRole: 'anonymous'
      };

      const result = await rateLimiter.checkLimit('test-identifier', config, context);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 10 - 5 - 1 = 4
      expect(mockRedis.pipeline).toHaveBeenCalled();
    });

    it('should block requests exceeding rate limit', async () => {
      // Mock Redis to return count >= maxRequests
      mockRedis.pipeline.mockReturnValue({
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn(() => Promise.resolve([[null, 0], [null, 10], [null, 1], [null, 1]]))
      });

      const config = { windowMs: 60000, maxRequests: 10, store: 'redis' as const };
      const context: UserContext = {
        isAuthenticated: false,
        ipAddress: '192.168.1.1',
        userRole: 'anonymous'
      };

      const result = await rateLimiter.checkLimit('test-identifier', config, context);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
    });

    it('should fail open on Redis error', async () => {
      mockRedis.pipeline.mockImplementation(() => {
        throw new Error('Redis connection failed');
      });

      const config = { windowMs: 60000, maxRequests: 10, store: 'redis' as const };
      const context: UserContext = {
        isAuthenticated: false,
        ipAddress: '192.168.1.1',
        userRole: 'anonymous'
      };

      const result = await rateLimiter.checkLimit('test-identifier', config, context);

      expect(result.allowed).toBe(true);
    });
  });

  describe('getUserRateLimit', () => {
    it('should return anonymous rate limit for unauthenticated users', () => {
      const context: UserContext = {
        isAuthenticated: false,
        ipAddress: '192.168.1.1',
        userRole: 'anonymous'
      };

      const config = rateLimiter.getUserRateLimit(context);

      expect(config.maxRequests).toBe(10); // Anonymous limit
      expect(config.windowMs).toBe(60000);
    });

    it('should return buyer rate limit for authenticated buyers', () => {
      const context: UserContext = {
        isAuthenticated: true,
        ipAddress: '192.168.1.1',
        userRole: 'buyer',
        userId: 'buyer-123'
      };

      const config = rateLimiter.getUserRateLimit(context);

      expect(config.maxRequests).toBe(120); // Buyer limit
    });

    it('should return admin rate limit for admin users', () => {
      const context: UserContext = {
        isAuthenticated: true,
        ipAddress: '192.168.1.1',
        userRole: 'admin',
        userId: 'admin-123'
      };

      const config = rateLimiter.getUserRateLimit(context);

      expect(config.maxRequests).toBe(300); // Admin limit
    });

    it('should apply endpoint-specific overrides', () => {
      const context: UserContext = {
        isAuthenticated: false,
        ipAddress: '192.168.1.1',
        userRole: 'anonymous'
      };

      const config = rateLimiter.getUserRateLimit(context, '/auth/login');

      expect(config.windowMs).toBe(15 * 60 * 1000); // 15 minutes for login
      expect(config.maxRequests).toBe(5); // 5 login attempts
    });
  });

  describe('suspicious IP tracking', () => {
    it('should detect suspicious IPs', async () => {
      mockRedis.sismember.mockResolvedValue(1);

      const isSuspicious = await rateLimiter.isIPSuspicious('192.168.1.1', 'US');

      expect(isSuspicious).toBe(true);
      expect(mockRedis.sismember).toHaveBeenCalledWith('suspicious_ips:US', '192.168.1.1');
    });

    it('should add IPs to suspicious list', async () => {
      await rateLimiter.addSuspiciousIP('192.168.1.1', 'US', 86400);

      expect(mockRedis.sadd).toHaveBeenCalledWith('suspicious_ips:global', '192.168.1.1');
      expect(mockRedis.sadd).toHaveBeenCalledWith('suspicious_ips:US', '192.168.1.1');
    });
  });
});

describe('GeoIPAnalyzer', () => {
  let geoAnalyzer: GeoIPAnalyzer;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      get: vi.fn(),
      setex: vi.fn(),
      exists: vi.fn(() => Promise.resolve(0)),
      set: vi.fn()
    };

    geoAnalyzer = new (class extends GeoIPAnalyzer {
      constructor() {
        super();
        this.redis = mockRedis;
      }
    })();
  });

  describe('analyzeIP', () => {
    it('should return cached geo info if available', async () => {
      const cachedData = {
        ip: '192.168.1.1',
        country: 'United States',
        countryCode: 'US',
        threatLevel: 'low',
        reputation: 95
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await geoAnalyzer.analyzeIP('192.168.1.1');

      expect(result).toEqual(cachedData);
      expect(mockRedis.get).toHaveBeenCalledWith('geoip:192.168.1.1');
    });

    it('should detect private IPs', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await geoAnalyzer.analyzeIP('192.168.1.1');

      expect(result.country).toBe('Local');
      expect(result.countryCode).toBe('LC');
    });

    it('should cache analysis results', async () => {
      mockRedis.get.mockResolvedValue(null);

      await geoAnalyzer.analyzeIP('8.8.8.8');

      expect(mockRedis.setex).toHaveBeenCalled();
    });
  });

  describe('shouldBlockIP', () => {
    it('should block IPs matching geographic rules', async () => {
      mockRedis.get.mockImplementation((key) => {
        if (key === 'geoip:8.8.8.8') {
          return Promise.resolve(JSON.stringify({
            ip: '8.8.8.8',
            country: 'China',
            countryCode: 'CN',
            threatLevel: 'high',
            reputation: 20,
            isTor: false,
            isVpn: false,
            isProxy: false
          }));
        }
        if (key === 'geoip:rules') {
          return Promise.resolve(JSON.stringify([
            {
              id: 'block-high-risk',
              type: 'block',
              countries: ['CN'],
              conditions: { maxThreatLevel: 'medium' },
              priority: 1,
              enabled: true
            }
          ]));
        }
        return null;
      });

      const result = await geoAnalyzer.shouldBlockIP('8.8.8.8');

      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('China');
    });

    it('should allow IPs not matching any rules', async () => {
      mockRedis.get.mockImplementation((key) => {
        if (key === 'geoip:8.8.8.8') {
          return Promise.resolve(JSON.stringify({
            ip: '8.8.8.8',
            country: 'United States',
            countryCode: 'US',
            threatLevel: 'low',
            reputation: 95
          }));
        }
        return null;
      });

      const result = await geoAnalyzer.shouldBlockIP('8.8.8.8');

      expect(result.blocked).toBe(false);
      expect(result.action).toBe('allow');
    });
  });
});

describe('BehavioralAnalyzer', () => {
  let behavioralAnalyzer: BehavioralAnalyzer;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      zadd: vi.fn(),
      zremrangebyscore: vi.fn(),
      zcard: vi.fn(() => Promise.resolve(10)),
      zrange: vi.fn(() => Promise.resolve([])),
      expire: vi.fn(),
      setex: vi.fn(),
      sadd: vi.fn(),
      get: vi.fn(),
      keys: vi.fn(() => Promise.resolve([]))
    };

    behavioralAnalyzer = new (class extends BehavioralAnalyzer {
      constructor() {
        super();
        this.redis = mockRedis;
      }
    })();
  });

  describe('recordPattern', () => {
    it('should store behavior patterns in Redis', async () => {
      const pattern = {
        ipAddress: '192.168.1.1',
        timestamp: Date.now(),
        endpoint: '/api/test',
        method: 'GET',
        responseStatus: 200,
        responseTime: 100
      };

      const context: UserContext = {
        isAuthenticated: false,
        ipAddress: '192.168.1.1',
        userRole: 'anonymous'
      };

      await behavioralAnalyzer.recordPattern(pattern, context);

      expect(mockRedis.zadd).toHaveBeenCalled();
      expect(mockRedis.expire).toHaveBeenCalled();
    });
  });

  describe('analyzePatterns', () => {
    it('should detect burst activity', async () => {
      const now = Date.now();
      const burstPatterns = Array.from({ length: 35 }, (_, i) => ({
        timestamp: now - i * 1000, // 35 requests in last 35 seconds
        ipAddress: '192.168.1.1',
        endpoint: '/api/test',
        method: 'GET',
        responseStatus: 200,
        responseTime: 100
      }));

      mockRedis.zrange.mockResolvedValue(
        burstPatterns.map(p => JSON.stringify(p))
      );

      const context: UserContext = {
        isAuthenticated: false,
        ipAddress: '192.168.1.1',
        userRole: 'anonymous'
      };

      const activities = await behavioralAnalyzer.analyzePatterns('ip:192.168.1.1', context);

      expect(activities).toHaveLength(1);
      expect(activities[0].type).toBe('burst_requests');
      expect(activities[0].severity).toBe('medium');
    });

    it('should detect regular intervals (bot behavior)', async () => {
      const now = Date.now();
      const regularPatterns = Array.from({ length: 15 }, (_, i) => ({
        timestamp: now - i * 10000, // Regular 10-second intervals
        ipAddress: '192.168.1.1',
        endpoint: '/api/test',
        method: 'GET',
        responseStatus: 200,
        responseTime: 100
      }));

      mockRedis.zrange.mockResolvedValue(
        regularPatterns.map(p => JSON.stringify(p))
      );

      const context: UserContext = {
        isAuthenticated: false,
        ipAddress: '192.168.1.1',
        userRole: 'anonymous'
      };

      const activities = await behavioralAnalyzer.analyzePatterns('ip:192.168.1.1', context);

      expect(activities).toHaveLength(1);
      expect(activities[0].type).toBe('regular_intervals');
    });

    it('should detect error farming', async () => {
      const now = Date.now();
      const errorPatterns = Array.from({ length: 25 }, (_, i) => ({
        timestamp: now - i * 10000,
        ipAddress: '192.168.1.1',
        endpoint: '/api/test',
        method: 'GET',
        responseStatus: 404, // All errors
        responseTime: 50
      }));

      mockRedis.zrange.mockResolvedValue(
        errorPatterns.map(p => JSON.stringify(p))
      );

      const context: UserContext = {
        isAuthenticated: false,
        ipAddress: '192.168.1.1',
        userRole: 'anonymous'
      };

      const activities = await behavioralAnalyzer.analyzePatterns('ip:192.168.1.1', context);

      expect(activities).toHaveLength(1);
      expect(activities[0].type).toBe('error_farming');
    });
  });

  describe('getBehaviorScore', () => {
    it('should return cached behavior score', async () => {
      const score = {
        overallScore: 75,
        riskFactors: {
          burstActivity: 10,
          regularIntervals: 0,
          errorRate: 5,
          endpointScanning: 0,
          credentialStuffing: 0,
          sessionAnomalies: 0
        },
        recommendations: ['Monitor closely']
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(score));

      const context: UserContext = {
        isAuthenticated: false,
        ipAddress: '192.168.1.1',
        userRole: 'anonymous'
      };

      const result = await behavioralAnalyzer.getBehaviorScore(context);

      expect(result).toEqual(score);
    });

    it('should return default score if none cached', async () => {
      mockRedis.get.mockResolvedValue(null);

      const context: UserContext = {
        isAuthenticated: false,
        ipAddress: '192.168.1.1',
        userRole: 'anonymous'
      };

      const result = await behavioralAnalyzer.getBehaviorScore(context);

      expect(result?.overallScore).toBe(100);
      expect(result?.recommendations).toEqual([]);
    });
  });
});

describe('CaptchaSystem', () => {
  let captchaSystem: CaptchaSystem;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      setex: vi.fn(),
      zadd: vi.fn(),
      expire: vi.fn(),
      get: vi.fn(),
      del: vi.fn(),
      zcount: vi.fn(() => Promise.resolve(0)),
      sismember: vi.fn(() => Promise.resolve(0))
    };

    captchaSystem = new (class extends CaptchaSystem {
      constructor() {
        super();
        this.redis = mockRedis;
      }
    })();
  });

  describe('shouldRequireCaptcha', () => {
    it('should require CAPTCHA for low behavior scores', async () => {
      const context: UserContext = {
        isAuthenticated: false,
        ipAddress: '192.168.1.1',
        userRole: 'anonymous'
      };

      const behaviorScore = {
        overallScore: 30, // Below threshold of 60
        riskFactors: {
          burstActivity: 40,
          regularIntervals: 0,
          errorRate: 20,
          endpointScanning: 0,
          credentialStuffing: 0,
          sessionAnomalies: 0
        },
        recommendations: []
      };

      const result = await captchaSystem.shouldRequireCaptcha(
        context,
        behaviorScore
      );

      expect(result.required).toBe(true);
      expect(result.reason).toContain('Low behavior score');
    });

    it('should require CAPTCHA for high request rates', async () => {
      const context: UserContext = {
        isAuthenticated: false,
        ipAddress: '192.168.1.1',
        userRole: 'anonymous'
      };

      const result = await captchaSystem.shouldRequireCaptcha(
        context,
        undefined,
        35 // Above threshold of 30
      );

      expect(result.required).toBe(true);
      expect(result.reason).toContain('High request rate');
    });

    it('should not require CAPTCHA for trusted admin users', async () => {
      const context: UserContext = {
        isAuthenticated: true,
        ipAddress: '192.168.1.1',
        userRole: 'admin',
        userId: 'admin-123'
      };

      const result = await captchaSystem.shouldRequireCaptcha(context);

      expect(result.required).toBe(false);
      expect(result.reason).toBe('Trusted user role');
    });
  });

  describe('createChallenge', () => {
    it('should create a CAPTCHA challenge', async () => {
      const context: UserContext = {
        isAuthenticated: false,
        ipAddress: '192.168.1.1',
        userRole: 'anonymous'
      };

      const challenge = await captchaSystem.createChallenge(context, 'medium');

      expect(challenge.id).toBeDefined();
      expect(challenge.difficulty).toBe('medium');
      expect(challenge.ipAddress).toBe('192.168.1.1');
      expect(challenge.verified).toBe(false);
      expect(mockRedis.setex).toHaveBeenCalled();
    });
  });

  describe('verifyChallenge', () => {
    it('should verify valid CAPTCHA response', async () => {
      const challenge = {
        id: 'test-challenge',
        verified: false,
        expiry: Date.now() + 600000,
        attempts: 0,
        maxAttempts: 3
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(challenge));

      // Mock successful verification
      global.fetch = vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ success: true })
        })
      ) as any;

      const context: UserContext = {
        isAuthenticated: false,
        ipAddress: '192.168.1.1',
        userRole: 'anonymous'
      };

      const result = await captchaSystem.verifyChallenge(
        'test-challenge',
        'valid-response',
        context
      );

      expect(result.success).toBe(true);
    });

    it('should reject invalid CAPTCHA response', async () => {
      const challenge = {
        id: 'test-challenge',
        verified: false,
        expiry: Date.now() + 600000,
        attempts: 0,
        maxAttempts: 3
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(challenge));

      // Mock failed verification
      global.fetch = vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ success: false, 'error-codes': ['invalid-input-response'] })
        })
      ) as any;

      const context: UserContext = {
        isAuthenticated: false,
        ipAddress: '192.168.1.1',
        userRole: 'anonymous'
      };

      const result = await captchaSystem.verifyChallenge(
        'test-challenge',
        'invalid-response',
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid-input-response');
    });

    it('should reject expired challenges', async () => {
      const challenge = {
        id: 'test-challenge',
        verified: false,
        expiry: Date.now() - 1000, // Expired
        attempts: 0,
        maxAttempts: 3
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(challenge));

      const context: UserContext = {
        isAuthenticated: false,
        ipAddress: '192.168.1.1',
        userRole: 'anonymous'
      };

      const result = await captchaSystem.verifyChallenge(
        'test-challenge',
        'valid-response',
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Challenge expired');
    });
  });
});

describe('BypassProtection', () => {
  let bypassProtection: BypassProtection;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      sadd: vi.fn(),
      scard: vi.fn(),
      smembers: vi.fn(() => Promise.resolve([])),
      expire: vi.fn(),
      lpush: vi.fn(),
      ltrim: vi.fn(),
      lrange: vi.fn(() => Promise.resolve([])),
      zadd: vi.fn(),
      zcount: vi.fn(() => Promise.resolve(0)),
      zrange: vi.fn(() => Promise.resolve([])),
      zrangebyscore: vi.fn(() => Promise.resolve([])),
      setex: vi.fn(),
      keys: vi.fn(() => Promise.resolve([]))
    };

    bypassProtection = new (class extends BypassProtection {
      constructor() {
        super();
        this.redis = mockRedis;
      }
    })();
  });

  describe('analyzeRequest', () => {
    it('should detect header manipulation attempts', async () => {
      const context: UserContext = {
        isAuthenticated: false,
        ipAddress: '192.168.1.1',
        userRole: 'anonymous'
      };

      const headers = {
        'x-bypass-rate-limit': 'true', // Honeypot header
        'x-forwarded-for': '1.1.1.1',
        'x-real-ip': '2.2.2.2', // Inconsistent IPs
        'x-client-ip': '3.3.3.3'
      };

      const result = await bypassProtection.analyzeRequest(context, headers);

      expect(result.bypassAttempted).toBe(true);
      expect(result.bypassType).toBe('header_manipulation');
      expect(result.penaltyMultiplier).toBeGreaterThan(1);
    });

    it('should detect IP rotation', async () => {
      mockRedis.scard.mockResolvedValue(6); // Above threshold of 5

      const context: UserContext = {
        isAuthenticated: true,
        ipAddress: '192.168.1.1',
        userRole: 'buyer',
        userId: 'buyer-123'
      };

      const result = await bypassProtection.analyzeRequest(context, {});

      expect(result.bypassAttempted).toBe(true);
      expect(result.bypassType).toBe('ip_rotation');
    });

    it('should detect user agent rotation', async () => {
      mockRedis.scard.mockResolvedValue(12); // Above threshold of 10

      const context: UserContext = {
        isAuthenticated: false,
        ipAddress: '192.168.1.1',
        userRole: 'anonymous',
        userAgent: 'Mozilla/5.0 (rotating agent)'
      };

      const result = await bypassProtection.analyzeRequest(context, {});

      expect(result.bypassAttempted).toBe(true);
      expect(result.bypassType).toBe('user_agent_rotation');
    });

    it('should not detect bypass for normal requests', async () => {
      mockRedis.scard.mockResolvedValue(1); // Normal counts

      const context: UserContext = {
        isAuthenticated: true,
        ipAddress: '192.168.1.1',
        userRole: 'buyer',
        userId: 'buyer-123'
      };

      const headers = {
        'user-agent': 'Mozilla/5.0 (normal browser)',
        'accept': 'application/json'
      };

      const result = await bypassProtection.analyzeRequest(context, headers);

      expect(result.bypassAttempted).toBe(false);
      expect(result.penaltyMultiplier).toBe(1.0);
    });
  });

  describe('getBypassAttempts', () => {
    it('should retrieve bypass attempts by type', async () => {
      const attemptData = {
        id: 'test-attempt',
        type: 'header_manipulation',
        severity: 'high',
        confidence: 85,
        lastDetected: Date.now()
      };

      mockRedis.keys.mockResolvedValue(['bypass:type:header_manipulation']);
      mockRedis.zrevrange.mockResolvedValue(['test-attempt']);
      mockRedis.get.mockResolvedValue(JSON.stringify(attemptData));

      const attempts = await bypassProtection.getBypassAttempts('header_manipulation');

      expect(attempts).toHaveLength(1);
      expect(attempts[0].type).toBe('header_manipulation');
    });
  });

  describe('getStats', () => {
    it('should calculate bypass protection statistics', async () => {
      const mockAttempts = [
        {
          type: 'header_manipulation',
          severity: 'high',
          lastDetected: Date.now(),
          evidence: { originalIP: '1.1.1.1' },
          blocked: true
        },
        {
          type: 'ip_rotation',
          severity: 'medium',
          lastDetected: Date.now(),
          evidence: { originalIP: '2.2.2.2' },
          blocked: false
        }
      ];

      // Mock the getBypassAttempts method
      vi.spyOn(bypassProtection, 'getBypassAttempts').mockResolvedValue(mockAttempts as any);

      const stats = await bypassProtection.getStats('day');

      expect(stats.totalAttempts).toBe(2);
      expect(stats.attemptsByType.header_manipulation).toBe(1);
      expect(stats.attemptsByType.ip_rotation).toBe(1);
      expect(stats.mitigationEffectiveness).toBe(50); // 1 blocked out of 2
    });
  });
});

describe('Integration Tests', () => {
  describe('Rate Limiting with Geographic Blocking', () => {
    it('should block requests from blocked countries before rate limiting', async () => {
      // This would test the integration between rate limiter and geo analyzer
      // Implementation would depend on how the middleware integrates these components
    });
  });

  describe('Rate Limiting with Behavioral Analysis', () => {
    it('should apply behavioral penalties to rate limits', async () => {
      // Test integration between rate limiter and behavioral analyzer
    });
  });

  describe('CAPTCHA with Rate Limiting', () => {
    it('should require CAPTCHA when rate limits are exceeded', async () => {
      // Test integration between rate limiter and CAPTCHA system
    });
  });
});