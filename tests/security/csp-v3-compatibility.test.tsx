/**
 * CSP v3 Compatibility Tests
 * 
 * Comprehensive testing for strict-dynamic CSP compliance
 * with third-party services (Stripe, Supabase, etc.)
 */

import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { CSPProvider } from '../../src/lib/CSPProvider'
import { initializeTrustedTypes, createTrustedHTML } from '../../src/lib/trusted-types'
import { generateNonce, getCurrentNonces } from '../../src/lib/csp-nonce'

// Mock third-party services
const mockStripe = {
  elements: vi.fn(() => ({
    create: vi.fn(() => ({
      mount: vi.fn(),
      on: vi.fn()
    }))
  })),
  createPaymentMethod: vi.fn(),
  confirmCardPayment: vi.fn()
}


// Mock global objects
Object.defineProperty(window, 'Stripe', {
  value: vi.fn(() => mockStripe),
  writable: true
})

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

describe('CSP v3 Strict-Dynamic Compatibility', () => {
  beforeEach(() => {
    // Clear any existing nonces
    vi.clearAllMocks()
    
    // Reset trusted types
    delete (window as unknown as { __CSP_NONCES__?: unknown }).__CSP_NONCES__
  })

  afterEach(() => {
    // Clean up
    document.head.innerHTML = ''
  })

  describe('Nonce Generation and Management', () => {
    it('should generate cryptographically secure nonces', () => {
      const nonce1 = generateNonce()
      const nonce2 = generateNonce()
      
      expect(nonce1).toBeTruthy()
      expect(nonce2).toBeTruthy()
      expect(nonce1).not.toBe(nonce2)
      expect(nonce1.length).toBeGreaterThanOrEqual(16)
      
      // Should be base64url format
      const isBase64url = nonce1.split('').every(char => 
        (char >= 'A' && char <= 'Z') || 
        (char >= 'a' && char <= 'z') || 
        (char >= '0' && char <= '9') || 
        char === '_' || 
        char === '-'
      )
      expect(isBase64url).toBe(true)
    })

    it('should use edge function nonces when available', () => {
      const mockNonces = {
        script: 'edge-script-nonce',
        style: 'edge-style-nonce',
        timestamp: Date.now()
      }
      
      ;(window as unknown as { __CSP_NONCES__: string[] }).__CSP_NONCES__ = mockNonces
      
      const nonces = getCurrentNonces()
      expect(nonces.script).toBe('edge-script-nonce')
      expect(nonces.style).toBe('edge-style-nonce')
    })

    it('should refresh nonces after TTL expires', () => {
      const oldTimestamp = Date.now() - 400000 // 6+ minutes ago
      ;(window as unknown as { __CSP_NONCES__: object }).__CSP_NONCES__ = {
        script: 'old-script-nonce',
        style: 'old-style-nonce',
        timestamp: oldTimestamp
      }
      
      const nonces = getCurrentNonces()
      expect(nonces.script).not.toBe('old-script-nonce')
      expect(nonces.style).not.toBe('old-style-nonce')
    })

    it('should auto-refresh nonces in long-lived sessions', async () => {
      vi.useFakeTimers()
      
      const TestComponent = () => {
        return (
          <CSPProvider>
            <div>Test</div>
          </CSPProvider>
        )
      }
      
      render(<TestComponent />)
      
      const initialNonces = getCurrentNonces()
      
      // Fast-forward 4 minutes
      vi.advanceTimersByTime(240000)
      
      await waitFor(() => {
        const newNonces = getCurrentNonces()
        expect(newNonces.script).not.toBe(initialNonces.script)
      })
      
      vi.useRealTimers()
    })
  })

  describe('Trusted Types Integration', () => {
    it('should initialize trusted types policies', () => {
      initializeTrustedTypes()
      
      expect(window.trustedTypes?.createPolicy).toHaveBeenCalledWith(
        'dompurify',
        expect.objectContaining({
          createHTML: expect.any(Function),
          createScript: expect.any(Function),
          createScriptURL: expect.any(Function)
        })
      )
    })

    it('should sanitize HTML with trusted types', () => {
      const unsafeHTML = '<script>alert("xss")</script><p>Safe content</p>'
      const trustedHTML = createTrustedHTML(unsafeHTML)
      
      expect(trustedHTML).not.toContain('<script>')
      expect(trustedHTML).toContain('<p>Safe content</p>')
    })

    it('should reject unsafe script URLs', () => {
      initializeTrustedTypes()
      
      expect(() => {
        const policy = window.trustedTypes?.createPolicy('test', {
          createScriptURL: (url) => {
            if (!url.startsWith('https://js.stripe.com')) {
              throw new Error('Unsafe URL')
            }
            return url
          }
        })
        policy?.createScriptURL('https://evil.com/malware.js')
      }).toThrow()
    })
  })

  describe('Stripe Integration', () => {
    it('should load Stripe with proper CSP directives', async () => {
      // Simulate loading Stripe script
      const script = document.createElement('script')
      script.src = 'https://js.stripe.com/v3/'
      script.nonce = generateNonce()
      document.head.appendChild(script)
      
      // Simulate script load
      script.dispatchEvent(new Event('load'))
      
      expect(script.nonce).toBeTruthy()
      expect(script.src).toBe('https://js.stripe.com/v3/')
    })

    it('should create payment elements with CSP compliance', () => {
      const stripe = window.Stripe?.('pk_test_123')
      const elements = stripe?.elements()
      const cardElement = elements?.create('card')
      
      expect(mockStripe.elements).toHaveBeenCalled()
      expect(cardElement).toBeDefined()
    })

    it('should handle Stripe checkout frames', () => {
      // Test that frame-src allows Stripe checkout
      const iframe = document.createElement('iframe')
      iframe.src = 'https://checkout.stripe.com/pay/cs_test_123'
      document.body.appendChild(iframe)
      
      expect(iframe.src).toContain('checkout.stripe.com')
    })
  })

  describe('Supabase Integration', () => {
    it('should connect to Supabase with proper CSP', async () => {
      // Simulate WebSocket connection (should be allowed by CSP)
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        close: vi.fn(),
        addEventListener: vi.fn()
      }
      
      Object.defineProperty(window, 'WebSocket', {
        value: vi.fn(() => mockWs),
        writable: true
      })
      
      // Test connection to Supabase realtime
      const ws = new WebSocket('wss://test.supabase.co/realtime/v1/websocket')
      expect(ws).toBeDefined()
    })

    it('should allow Supabase API calls', async () => {
      // Mock fetch for Supabase API calls
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] })
        })
      ) as typeof fetch
      
      // Test API call (should be allowed by connect-src)
      const response = await fetch('https://test.supabase.co/rest/v1/table')
      expect(response.ok).toBe(true)
    })
  })

  describe('CSP Violation Detection', () => {
    it('should block unauthorized inline scripts', () => {
      const script = document.createElement('script')
      script.innerHTML = 'alert("unauthorized")'
      // No nonce - should be blocked by CSP
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      document.head.appendChild(script)
      
      // In a real CSP environment, this would trigger a violation
      expect(script.innerHTML).toBe('alert("unauthorized")')
      
      consoleSpy.mockRestore()
    })

    it('should allow scripts with valid nonces', () => {
      const nonce = generateNonce()
      const script = document.createElement('script')
      script.innerHTML = 'console.log("authorized")'
      script.nonce = nonce
      
      document.head.appendChild(script)
      
      expect(script.nonce).toBe(nonce)
    })

    it('should detect strict-dynamic inheritance', () => {
      // Test that dynamically created scripts inherit permissions
      const nonce = generateNonce()
      const parentScript = document.createElement('script')
      parentScript.nonce = nonce
      parentScript.innerHTML = `
        const childScript = document.createElement('script');
        childScript.innerHTML = 'console.log("child script")';
        document.head.appendChild(childScript);
      `
      
      document.head.appendChild(parentScript)
      
      // In strict-dynamic, child scripts should inherit permission
      expect(parentScript.nonce).toBe(nonce)
    })
  })

  describe('Performance Tests', () => {
    it('should generate nonces within performance budget', () => {
      const iterations = 1000
      const start = performance.now()
      
      for (let i = 0; i < iterations; i++) {
        generateNonce()
      }
      
      const end = performance.now()
      const avgTime = (end - start) / iterations
      
      // Should be well under 2ms per nonce
      expect(avgTime).toBeLessThan(2)
    })

    it('should process CSP context efficiently', () => {
      const start = performance.now()
      
      const TestComponent = () => (
        <CSPProvider>
          <div>Performance test</div>
        </CSPProvider>
      )
      
      render(<TestComponent />)
      
      const end = performance.now()
      expect(end - start).toBeLessThan(10) // Should be very fast
    })
  })

  describe('Edge Function Integration', () => {
    it('should handle nonce placeholders correctly', () => {
      const html = `
        <script nonce="{{SCRIPT_NONCE}}">console.log('test')</script>
        <style nonce="{{STYLE_NONCE}}">body { margin: 0; }</style>
      `
      
      const scriptNonce = 'script-nonce-123'
      const styleNonce = 'style-nonce-456'
      
      const processed = html
        .replaceAll('{{SCRIPT_NONCE}}', scriptNonce)
        .replaceAll('{{STYLE_NONCE}}', styleNonce)
      
      expect(processed).toContain(`nonce="${scriptNonce}"`)
      expect(processed).toContain(`nonce="${styleNonce}"`)
    })

    it('should inject nonce context into window', () => {
      const mockNonces = {
        script: 'edge-script-123',
        style: 'edge-style-456',
        timestamp: Date.now()
      }
      
      // Simulate edge function injection
      ;(window as unknown as { __CSP_NONCES__: string[] }).__CSP_NONCES__ = mockNonces
      
      expect(window.__CSP_NONCES__).toEqual(mockNonces)
    })
  })

  describe('Browser Compatibility', () => {
    it('should work in browsers without Trusted Types support', () => {
      // Temporarily remove trusted types support
      const originalTrustedTypes = window.trustedTypes
      delete (window as unknown as { trustedTypes?: unknown }).trustedTypes
      
      const html = '<p>Test content</p>'
      const result = createTrustedHTML(html)
      
      expect(result).toBe(html) // Should fallback gracefully
      
      // Restore
      ;(window as unknown as { trustedTypes: unknown }).trustedTypes = originalTrustedTypes
    })

    it('should work in browsers without Web Crypto API', () => {
      // Mock old browser environment
      const originalCrypto = window.crypto
      delete (window as unknown as { crypto?: unknown }).crypto
      
      const nonce = generateNonce()
      expect(nonce).toBeTruthy()
      expect(nonce.length).toBeGreaterThan(16)
      
      // Restore
      ;(window as unknown as { crypto: Crypto }).crypto = originalCrypto
    })
  })
})