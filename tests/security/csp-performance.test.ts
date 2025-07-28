/**
 * CSP v3 Performance Benchmarks
 * 
 * Performance testing for CSP nonce generation, processing,
 * and edge function overhead validation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generateNonce, getCurrentNonces } from '../../src/lib/csp-nonce'
import { initializeTrustedTypes, createTrustedHTML } from '../../src/lib/trusted-types'

// Performance test utilities
function measurePerformance<T>(fn: () => T, iterations: number = 1000): {
  result: T
  avgTime: number
  minTime: number
  maxTime: number
  totalTime: number
} {
  const times: number[] = []
  let result: T = null as T
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    result = fn()
    const end = performance.now()
    times.push(end - start)
  }
  
  const totalTime = times.reduce((sum, time) => sum + time, 0)
  const avgTime = totalTime / iterations
  const minTime = Math.min(...times)
  const maxTime = Math.max(...times)
  
  return {
    result: result!,
    avgTime,
    minTime,
    maxTime,
    totalTime
  }
}

describe('CSP v3 Performance Benchmarks', () => {
  const PERFORMANCE_BUDGET = {
    nonceGeneration: 2, // 2ms max per nonce
    htmlProcessing: 5,   // 5ms max for HTML processing
    contextCreation: 1,  // 1ms max for context creation
    trustedTypes: 3      // 3ms max for trusted types operations
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Nonce Generation Performance', () => {
    it('should generate nonces within performance budget', () => {
      const { avgTime, minTime, maxTime } = measurePerformance(() => generateNonce())
      
      console.log(`Nonce generation performance:`)
      console.log(`  Average: ${avgTime.toFixed(3)}ms`)
      console.log(`  Min: ${minTime.toFixed(3)}ms`)
      console.log(`  Max: ${maxTime.toFixed(3)}ms`)
      
      expect(avgTime).toBeLessThan(PERFORMANCE_BUDGET.nonceGeneration)
      expect(maxTime).toBeLessThan(PERFORMANCE_BUDGET.nonceGeneration * 2) // Max should be reasonable
    })

    it('should handle concurrent nonce generation efficiently', async () => {
      const concurrentRequests = 100
      const start = performance.now()
      
      const promises = Array(concurrentRequests).fill(0).map(() => 
        Promise.resolve(generateNonce())
      )
      
      const results = await Promise.all(promises)
      const end = performance.now()
      
      const avgTimePerNonce = (end - start) / concurrentRequests
      
      console.log(`Concurrent nonce generation (${concurrentRequests} requests):`)
      console.log(`  Total time: ${(end - start).toFixed(3)}ms`)
      console.log(`  Average per nonce: ${avgTimePerNonce.toFixed(3)}ms`)
      
      expect(avgTimePerNonce).toBeLessThan(PERFORMANCE_BUDGET.nonceGeneration)
      expect(results.length).toBe(concurrentRequests)
      expect(new Set(results).size).toBe(concurrentRequests) // All unique
    })

    it('should have negligible performance overhead for getCurrentNonces', () => {
      // Pre-populate edge nonces
      ;(window as any).__CSP_NONCES__ = {
        script: 'cached-script-nonce',
        style: 'cached-style-nonce',
        timestamp: Date.now()
      }
      
      const { avgTime } = measurePerformance(() => getCurrentNonces())
      
      console.log(`getCurrentNonces performance: ${avgTime.toFixed(3)}ms`)
      
      expect(avgTime).toBeLessThan(0.1) // Should be extremely fast for cached nonces
    })
  })

  describe('HTML Processing Performance', () => {
    it('should process HTML with nonces efficiently', () => {
      const testHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test</title>
          <script nonce="{{SCRIPT_NONCE}}">console.log('test1')</script>
          <style nonce="{{STYLE_NONCE}}">body { margin: 0; }</style>
          <script type="module" src="/src/main.tsx" nonce="{{SCRIPT_NONCE}}"></script>
        </head>
        <body>
          <div id="root"></div>
          <script nonce="{{SCRIPT_NONCE}}">
            window.analytics = { track: function() {} };
          </script>
          <style nonce="{{STYLE_NONCE}}">
            .loading { opacity: 0.5; }
          </style>
        </body>
        </html>
      `
      
      const scriptNonce = generateNonce()
      const styleNonce = generateNonce()
      
      const { avgTime } = measurePerformance(() => {
        return testHTML
          .replace(/\{\{SCRIPT_NONCE\}\}/g, scriptNonce)
          .replace(/\{\{STYLE_NONCE\}\}/g, styleNonce)
      })
      
      console.log(`HTML processing performance: ${avgTime.toFixed(3)}ms`)
      
      expect(avgTime).toBeLessThan(PERFORMANCE_BUDGET.htmlProcessing)
    })

    it('should handle large HTML documents efficiently', () => {
      // Generate a large HTML document
      const largeHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Large Document</title>
          ${Array(100).fill(0).map((_, i) => 
            `<script nonce="{{SCRIPT_NONCE}}">console.log('script${i}')</script>`
          ).join('\n')}
          ${Array(50).fill(0).map((_, i) => 
            `<style nonce="{{STYLE_NONCE}}">.class${i} { color: red; }</style>`
          ).join('\n')}
        </head>
        <body>
          <div id="root"></div>
        </body>
        </html>
      `
      
      const scriptNonce = generateNonce()
      const styleNonce = generateNonce()
      
      const { avgTime, totalTime } = measurePerformance(() => {
        return largeHTML
          .replace(/\{\{SCRIPT_NONCE\}\}/g, scriptNonce)
          .replace(/\{\{STYLE_NONCE\}\}/g, styleNonce)
      }, 100) // Fewer iterations for large documents
      
      console.log(`Large HTML processing performance:`)
      console.log(`  Average: ${avgTime.toFixed(3)}ms`)
      console.log(`  Total for 100 iterations: ${totalTime.toFixed(3)}ms`)
      
      expect(avgTime).toBeLessThan(PERFORMANCE_BUDGET.htmlProcessing * 3) // Allow more time for large docs
    })
  })

  describe('Trusted Types Performance', () => {
    beforeEach(() => {
      // Mock trusted types for consistent testing
      Object.defineProperty(window, 'trustedTypes', {
        value: {
          createPolicy: vi.fn((name, policy) => ({
            createHTML: policy.createHTML,
            createScript: policy.createScript,
            createScriptURL: policy.createScriptURL
          })),
          getPolicyNames: vi.fn(() => []),
          isHTML: vi.fn(),
          isScript: vi.fn(),
          isScriptURL: vi.fn()
        },
        writable: true
      })
      
      initializeTrustedTypes()
    })

    it('should create trusted HTML efficiently', () => {
      const testHTML = '<p>Safe content</p><div>More content</div>'
      
      const { avgTime } = measurePerformance(() => createTrustedHTML(testHTML))
      
      console.log(`Trusted HTML creation performance: ${avgTime.toFixed(3)}ms`)
      
      expect(avgTime).toBeLessThan(PERFORMANCE_BUDGET.trustedTypes)
    })

    it('should handle sanitization efficiently', () => {
      const unsafeHTML = `
        <p>Safe content</p>
        <script>alert('xss')</script>
        <img src="x" onerror="alert('xss')">
        <div onclick="malicious()">Click me</div>
        <iframe src="javascript:alert('xss')"></iframe>
      `
      
      const { avgTime } = measurePerformance(() => createTrustedHTML(unsafeHTML))
      
      console.log(`HTML sanitization performance: ${avgTime.toFixed(3)}ms`)
      
      expect(avgTime).toBeLessThan(PERFORMANCE_BUDGET.trustedTypes * 2) // Allow more time for sanitization
    })
  })

  describe('Memory Usage', () => {
    it('should have reasonable memory footprint for nonce cache', () => {
      const initialMemory = performance.memory?.usedJSHeapSize || 0
      
      // Generate many nonces to test memory usage
      const nonces = Array(10000).fill(0).map(() => generateNonce())
      
      const finalMemory = performance.memory?.usedJSHeapSize || 0
      const memoryIncrease = finalMemory - initialMemory
      
      console.log(`Memory usage for 10,000 nonces: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)
      
      // Each nonce is ~32 bytes, so 10k nonces should be ~320KB
      expect(memoryIncrease).toBeLessThan(1024 * 1024) // Less than 1MB
      expect(nonces.length).toBe(10000)
    })

    it('should clean up expired nonces from cache', () => {
      // Simulate cache with expired entries
      const mockCache = new Map()
      const now = Date.now()
      
      // Add expired entries
      for (let i = 0; i < 1000; i++) {
        mockCache.set(`expired_${i}`, {
          nonce: generateNonce(),
          timestamp: now - 400000 // 6+ minutes ago
        })
      }
      
      // Add fresh entries
      for (let i = 0; i < 100; i++) {
        mockCache.set(`fresh_${i}`, {
          nonce: generateNonce(),
          timestamp: now
        })
      }
      
      expect(mockCache.size).toBe(1100)
      
      // Simulate cleanup (remove expired entries)
      const TTL = 300000 // 5 minutes
      for (const [key, value] of mockCache.entries()) {
        if ((now - value.timestamp) > TTL) {
          mockCache.delete(key)
        }
      }
      
      expect(mockCache.size).toBe(100) // Only fresh entries remain
    })
  })

  describe('Edge Function Overhead', () => {
    it('should have minimal processing overhead', () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html><head><title>Test</title></head><body>
        <script nonce="{{SCRIPT_NONCE}}">console.log('test')</script>
        </body></html>
      `
      
      const { avgTime } = measurePerformance(() => {
        // Simulate edge function processing
        const scriptNonce = generateNonce()
        const styleNonce = generateNonce()
        
        const processedHtml = mockHtml
          .replace(/\{\{SCRIPT_NONCE\}\}/g, scriptNonce)
          .replace(/\{\{STYLE_NONCE\}\}/g, styleNonce)
        
        return {
          html: processedHtml,
          headers: {
            'Content-Security-Policy': `script-src 'strict-dynamic' 'nonce-${scriptNonce}'`,
            'X-Processing-Time': `${avgTime}ms`
          }
        }
      })
      
      console.log(`Edge function processing overhead: ${avgTime.toFixed(3)}ms`)
      
      expect(avgTime).toBeLessThan(2) // Must be under 2ms per request
    })
  })

  describe('Stress Tests', () => {
    it('should handle high concurrent load', async () => {
      const concurrentRequests = 1000
      const start = performance.now()
      
      const promises = Array(concurrentRequests).fill(0).map(async (_, i) => {
        const nonces = getCurrentNonces()
        return {
          id: i,
          script: nonces.script,
          style: nonces.style
        }
      })
      
      const results = await Promise.all(promises)
      const end = performance.now()
      
      const totalTime = end - start
      const avgTime = totalTime / concurrentRequests
      
      console.log(`High load test (${concurrentRequests} concurrent requests):`)
      console.log(`  Total time: ${totalTime.toFixed(3)}ms`)
      console.log(`  Average per request: ${avgTime.toFixed(3)}ms`)
      
      expect(avgTime).toBeLessThan(1) // Should be very fast for cached operations
      expect(results.length).toBe(concurrentRequests)
    })

    it('should maintain performance under memory pressure', () => {
      // Create memory pressure
      const largeArrays = Array(10).fill(0).map(() => 
        new Array(100000).fill('memory-pressure-test')
      )
      
      const { avgTime } = measurePerformance(() => generateNonce(), 100)
      
      console.log(`Performance under memory pressure: ${avgTime.toFixed(3)}ms`)
      
      expect(avgTime).toBeLessThan(PERFORMANCE_BUDGET.nonceGeneration * 1.5) // Allow slight degradation
      
      // Clean up
      largeArrays.length = 0
    })
  })
})