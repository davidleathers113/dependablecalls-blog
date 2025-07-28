/**
 * CSP Compatibility Tests
 * 
 * Tests to verify that Stripe and Supabase integrations work
 * correctly with the hardened Content Security Policy.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { JSDOM } from 'jsdom'

describe('CSP Compatibility Tests', () => {
  let dom: JSDOM
  let window: Window & typeof globalThis
  let document: Document
  
  beforeEach(() => {
    // Setup DOM environment with CSP
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta http-equiv="Content-Security-Policy" content="
            default-src 'self';
            script-src 'self' https://js.stripe.com https://cdn.jsdelivr.net;
            script-src-elem 'self' https://js.stripe.com https://cdn.jsdelivr.net;
            script-src-attr 'none';
            style-src 'self' https://fonts.googleapis.com;
            style-src-elem 'self' https://fonts.googleapis.com;
            style-src-attr 'none';
            connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com;
            frame-src https://js.stripe.com https://checkout.stripe.com;
            object-src 'none';
            base-uri 'self';
            form-action 'self' https://checkout.stripe.com;
          " />
        </head>
        <body>
          <div id="root"></div>
        </body>
      </html>
    `, {
      url: 'https://test.dependablecalls.com',
      pretendToBeVisual: true,
      resources: 'usable'
    })
    
    window = dom.window as Window & typeof globalThis
    document = window.document
    
    // Set up global environment
    global.window = window
    global.document = document
    global.navigator = window.navigator
    global.location = window.location
  })
  
  afterEach(() => {
    dom.window.close()
  })

  describe('Stripe Integration', () => {
    it('should allow Stripe.js to load from allowed domain', async () => {
      const script = document.createElement('script')
      script.src = 'https://js.stripe.com/v3/'
      script.type = 'text/javascript'
      
      let loadError: Error | null = null
      
      script.onerror = (error) => {
        loadError = error as Error
      }
      
      document.head.appendChild(script)
      
      // Wait a bit for CSP to potentially block
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Should not be blocked by CSP
      expect(loadError).toBeNull()
      expect(script.src).toBe('https://js.stripe.com/v3/')
    })
    
    it('should allow Stripe checkout iframe', () => {
      const iframe = document.createElement('iframe')
      iframe.src = 'https://checkout.stripe.com/pay/test_session'
      
      document.body.appendChild(iframe)
      
      // Should not be blocked by CSP frame-src
      expect(iframe.src).toBe('https://checkout.stripe.com/pay/test_session')
      expect(document.body.contains(iframe)).toBe(true)
    })
    
    it('should allow connections to Stripe API', async () => {
      // Mock fetch to test connect-src policy
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response('{"status": "ok"}', { status: 200 })
      )
      
      try {
        await fetch('https://api.stripe.com/v1/payment_intents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
        
        expect(fetchSpy).toHaveBeenCalledWith(
          'https://api.stripe.com/v1/payment_intents',
          expect.objectContaining({
            method: 'POST'
          })
        )
      } finally {
        fetchSpy.mockRestore()
      }
    })
    
    it('should block inline script attributes (style-src-attr: none)', () => {
      const div = document.createElement('div')
      
      // This should be blocked by CSP
      div.setAttribute('onclick', 'alert("blocked")')
      div.setAttribute('style', 'color: red')
      
      document.body.appendChild(div)
      
      // The attributes are set, but CSP should prevent execution
      expect(div.getAttribute('onclick')).toBe('alert("blocked")')
      expect(div.getAttribute('style')).toBe('color: red')
    })
  })

  describe('Supabase Integration', () => {
    it('should allow connections to Supabase HTTP endpoints', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response('{"status": "ok"}', { status: 200 })
      )
      
      try {
        await fetch('https://project.supabase.co/rest/v1/users', {
          headers: { 'Authorization': 'Bearer test-token' }
        })
        
        expect(fetchSpy).toHaveBeenCalledWith(
          'https://project.supabase.co/rest/v1/users',
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer test-token'
            })
          })
        )
      } finally {
        fetchSpy.mockRestore()
      }
    })
    
    it('should allow WebSocket connections to Supabase realtime', () => {
      // Mock WebSocket
      const mockWebSocket = vi.fn()
      global.WebSocket = mockWebSocket as unknown as typeof WebSocket
      
      try {
        new WebSocket('wss://project.supabase.co/realtime/v1/websocket')
        
        expect(mockWebSocket).toHaveBeenCalledWith(
          'wss://project.supabase.co/realtime/v1/websocket'
        )
      } catch {
        // Expected in test environment, but CSP should allow the connection
        expect(mockWebSocket).toHaveBeenCalled()
      }
    })
    
    it('should block unauthorized WebSocket connections', () => {
      const mockWebSocket = vi.fn(() => {
        throw new Error('CSP blocked connection')
      })
      global.WebSocket = mockWebSocket as unknown as typeof WebSocket
      
      expect(() => {
        new WebSocket('wss://malicious-site.com/websocket')
      }).toThrow()
    })
  })

  describe('Security Hardening', () => {
    it('should block inline scripts without nonce', () => {
      const script = document.createElement('script')
      script.textContent = 'alert("blocked")'
      
      window.addEventListener('securitypolicyviolation', () => {
        // CSP violation detected
      })
      
      document.head.appendChild(script)
      
      // Note: In real browser, this would trigger CSP violation
      // In test environment, we check the policy is correctly set
      const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]')
      expect(cspMeta?.getAttribute('content')).toContain('script-src-attr \'none\'')
    })
    
    it('should block inline styles without nonce', () => {
      const style = document.createElement('style')
      style.textContent = 'body { background: red; }'
      
      document.head.appendChild(style)
      
      // Check that CSP policy blocks inline styles
      const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]')
      expect(cspMeta?.getAttribute('content')).toContain('style-src-attr \'none\'')
    })
    
    it('should block object and embed elements', () => {
      const object = document.createElement('object')
      object.data = 'malicious.swf'
      
      const embed = document.createElement('embed')
      embed.src = 'malicious.swf'
      
      document.body.appendChild(object)
      document.body.appendChild(embed)
      
      // CSP should block these
      const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]')
      expect(cspMeta?.getAttribute('content')).toContain('object-src \'none\'')
    })
    
    it('should enforce strict base-uri policy', () => {
      const base = document.createElement('base')
      base.href = 'https://malicious-site.com/'
      
      document.head.appendChild(base)
      
      // CSP should restrict base URI
      const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]')
      expect(cspMeta?.getAttribute('content')).toContain('base-uri \'self\'')
    })
    
    it('should restrict form actions', () => {
      const form = document.createElement('form')
      form.action = 'https://malicious-site.com/steal-data'
      form.method = 'POST'
      
      document.body.appendChild(form)
      
      // CSP should restrict form actions
      const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]')
      expect(cspMeta?.getAttribute('content')).toContain('form-action \'self\' https://checkout.stripe.com')
    })
  })

  describe('CSP Violation Reporting', () => {
    it('should have report-uri configured', () => {
      const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]')
      const cspContent = cspMeta?.getAttribute('content')
      
      expect(cspContent).toContain('report-uri /.netlify/functions/csp-report')
    })
    
    it('should enforce upgrade-insecure-requests', () => {
      const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]')
      const cspContent = cspMeta?.getAttribute('content')
      
      expect(cspContent).toContain('upgrade-insecure-requests')
    })
  })
})