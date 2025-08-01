/**
 * Advanced CSP v3 Nonce Handler - Netlify Edge Function
 * 
 * Generates and injects secure nonces for CSP strict-dynamic compliance.
 * Provides production-ready nonce management with performance optimization.
 */

import type { Context } from "@netlify/edge-functions";

interface NonceCache {
  script: string;
  style: string;
  timestamp: number;
  ttl: number;
}

// Global cache for nonce management (edge function memory)
const nonceCache = new Map<string, NonceCache>();
const NONCE_TTL = 300000; // 5 minutes
const MAX_CACHE_SIZE = 10000;

/**
 * Generate cryptographically secure nonce
 */
function generateSecureNonce(): string {
  // Use Web Crypto API for secure random generation
  const array = new Uint8Array(24); // 192 bits = 32 base64 chars
  crypto.getRandomValues(array);
  
  // Convert to base64url (URL-safe)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate nonce pair with performance optimization
 */
function generateNoncePair(): { script: string; style: string } {
  return {
    script: generateSecureNonce(),
    style: generateSecureNonce()
  };
}

/**
 * Get or create cached nonces for request
 */
function getCachedNonces(cacheKey: string): NonceCache {
  const now = Date.now();
  const cached = nonceCache.get(cacheKey);
  
  // Return cached if valid
  if (cached && (now - cached.timestamp) < cached.ttl) {
    return cached;
  }
  
  // Generate new nonces
  const nonces = generateNoncePair();
  const newCache: NonceCache = {
    script: nonces.script,
    style: nonces.style,
    timestamp: now,
    ttl: NONCE_TTL
  };
  
  // Cache management - prevent memory leaks
  if (nonceCache.size >= MAX_CACHE_SIZE) {
    // Remove oldest entries
    const entries = Array.from(nonceCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest 20%
    const toRemove = Math.floor(MAX_CACHE_SIZE * 0.2);
    for (let i = 0; i < toRemove; i++) {
      nonceCache.delete(entries[i][0]);
    }
  }
  
  nonceCache.set(cacheKey, newCache);
  return newCache;
}

/**
 * Create CSP header with nonces
 */
function createCSPHeader(scriptNonce: string, styleNonce: string): string {
  return [
    "default-src 'none'",
    `script-src 'strict-dynamic' 'nonce-${scriptNonce}' https://js.stripe.com https://cdn.jsdelivr.net`,
    `script-src-elem 'strict-dynamic' 'nonce-${scriptNonce}' https://js.stripe.com https://cdn.jsdelivr.net`,
    "script-src-attr 'none'",
    `style-src 'self' 'nonce-${styleNonce}' https://fonts.googleapis.com`,
    `style-src-elem 'self' 'nonce-${styleNonce}' https://fonts.googleapis.com`,
    "style-src-attr 'none'",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "media-src 'self'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.sentry.io",
    "frame-src https://js.stripe.com https://checkout.stripe.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://checkout.stripe.com",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "trusted-types dompurify default",
    "require-trusted-types-for 'script'",
    "report-to csp-violations",
    "report-uri /.netlify/functions/csp-report",
    "upgrade-insecure-requests"
  ].join('; ');
}

/**
 * Inject nonces into HTML content
 */
function injectNonces(html: string, scriptNonce: string, styleNonce: string): string {
  // Replace nonce placeholders
  let processedHtml = html
    .replace(/\{\{SCRIPT_NONCE\}\}/g, scriptNonce)
    .replace(/\{\{STYLE_NONCE\}\}/g, styleNonce)
    .replace(/__SCRIPT_NONCE__/g, scriptNonce)
    .replace(/__STYLE_NONCE__/g, styleNonce);
  
  // Add nonces to existing script/style tags
  processedHtml = processedHtml
    .replace(/<script(?!\s+nonce)([^>]*type=["']module["'][^>]*)>/gi, 
             `<script nonce="${scriptNonce}"$1>`)
    .replace(/<script(?!\s+nonce)([^>]*(?:src=|type=))>/gi, 
             `<script nonce="${scriptNonce}"$1>`)
    .replace(/<style(?!\s+nonce)([^>]*)>/gi, 
             `<style nonce="${styleNonce}"$1>`);
  
  // Inject nonce context into window for React
  const nonceScript = `
<script nonce="${scriptNonce}">
  window.__CSP_NONCES__ = {
    script: '${scriptNonce}',
    style: '${styleNonce}',
    timestamp: ${Date.now()}
  };
</script>`;
  
  // Insert before closing head tag
  processedHtml = processedHtml.replace('</head>', `${nonceScript}</head>`);
  
  return processedHtml;
}

/**
 * Create cache key from request
 */
function createCacheKey(request: Request): string {
  const url = new URL(request.url);
  const userAgent = request.headers.get('user-agent') || '';
  
  // Create cache key based on session/user context
  // In production, use session ID or user ID for user-specific nonces
  const baseKey = `${url.pathname}_${userAgent.slice(0, 50)}`;
  
  // Simple hash for consistent caching
  let hash = 0;
  for (let i = 0; i < baseKey.length; i++) {
    const char = baseKey.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return `nonce_${Math.abs(hash)}`;
}

/**
 * Main Edge Function Handler
 */
export default async (request: Request, context: Context) => {
  const startTime = performance.now();
  
  try {
    const url = new URL(request.url);
    
    // Only process HTML requests
    const acceptsHtml = request.headers.get('accept')?.includes('text/html');
    if (!acceptsHtml && !url.pathname.endsWith('.html') && url.pathname !== '/') {
      return; // Pass through non-HTML requests
    }
    
    // Get response from origin
    const response = await context.next();
    
    // Only process successful HTML responses
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') || !response.ok) {
      return response;
    }
    
    // Generate or retrieve nonces
    const cacheKey = createCacheKey(request);
    const nonces = getCachedNonces(cacheKey);
    
    // Get HTML content
    const html = await response.text();
    
    // Inject nonces
    const processedHtml = injectNonces(html, nonces.script, nonces.style);
    
    // Create CSP header
    const cspHeader = createCSPHeader(nonces.script, nonces.style);
    
    // Performance tracking
    const processingTime = performance.now() - startTime;
    
    // Create new response with enhanced headers
    const newResponse = new Response(processedHtml, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        'Content-Security-Policy': cspHeader,
        'Report-To': JSON.stringify({
          group: 'csp-violations',
          max_age: 10886400,
          endpoints: [{ url: '/.netlify/functions/csp-report' }]
        }),
        'X-CSP-Nonce-Generated': new Date().toISOString(),
        'X-Processing-Time': `${processingTime.toFixed(2)}ms`,
        'Cache-Control': 'no-cache, no-store, must-revalidate', // Prevent caching of nonce-injected content
      }
    });
    
    return newResponse;
    
  } catch (error) {
    console.error('CSP Nonce Handler Error:', error);
    
    // Return original response on error to prevent breaking the site
    return await context.next();
  }
};

export const config = {
  path: "/*",
  excludedPath: [
    "/api/*",
    "/assets/*", 
    "/*.js",
    "/*.css",
    "/*.png",
    "/*.jpg",
    "/*.jpeg", 
    "/*.gif",
    "/*.svg",
    "/*.webp",
    "/*.ico",
    "/*.woff",
    "/*.woff2",
    "/*.ttf",
    "/.netlify/*"
  ]
};