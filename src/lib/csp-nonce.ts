/**
 * Advanced CSP v3 Nonce Management
 * 
 * Production-ready nonce system with strict-dynamic support,
 * edge function integration, and performance optimization.
*/
import { randomBytes } from 'crypto'

// Global type declarations for CSP nonces
declare global {
  interface Window {
    __CSP_NONCES__?: {
      script: string;
      style: string;
      timestamp: number;
    };
  }
  
  // Extend globalThis to include window property
  interface GlobalThis {
    window?: Window & typeof globalThis;
  }
}

// Browser-compatible nonce generation
function generateBrowserNonce(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    // Modern browsers with Web Crypto API
    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  } else {
    // Fallback for environments without Web Crypto
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

/**
 * Node.js compatible secure nonce generation
 */
export function generateNonce(): string {
  if (typeof globalThis !== 'undefined' && typeof globalThis.window === 'undefined') {
    // Node.js environment - use crypto module
    try {
      return randomBytes(24).toString('base64url');
    } catch {
      // Fallback if crypto is not available
      return generateBrowserNonce();
    }
  }
  
  return generateBrowserNonce();
}

/**
 * Get nonces from edge function injection
 */
export function getEdgeNonces(): { script: string; style: string } | null {
  if (typeof globalThis === 'undefined' || typeof globalThis.window === 'undefined') return null;
  
  const nonces = globalThis.window.__CSP_NONCES__;
  if (nonces && nonces.script && nonces.style) {
    // Check if nonces are still fresh (within 5 minutes)
    const age = Date.now() - (nonces.timestamp || 0);
    if (age < 300000) { // 5 minutes
      return {
        script: nonces.script,
        style: nonces.style
      };
    }
  }
  
  return null;
}

/**
 * Get or create nonce for the current request
 * Enhanced for edge function integration
 */
let currentNonces: { script: string; style: string } | null = null;

export function getCurrentNonces(): { script: string; style: string } {
  // Try to get from edge function first
  const edgeNonces = getEdgeNonces();
  if (edgeNonces) {
    return edgeNonces;
  }
  
  // Generate new nonces if needed
  if (!currentNonces) {
    currentNonces = {
      script: generateNonce(),
      style: generateNonce()
    };
  }
  
  return currentNonces;
}

/**
 * Legacy support - get script nonce
 */
export function getCurrentNonce(): string {
  return getCurrentNonces().script;
}

/**
 * Reset nonces (typically on new request in SSR)
 */
export function resetNonce(): void {
  currentNonces = null;
}

/**
 * Nonce refresh for long-lived sessions
 */
export function refreshNonces(): { script: string; style: string } {
  currentNonces = {
    script: generateNonce(),
    style: generateNonce()
  };
  
  // Update window nonces if in browser
  if (typeof globalThis !== 'undefined' && typeof globalThis.window !== 'undefined') {
    globalThis.window.__CSP_NONCES__ = {
      ...currentNonces,
      timestamp: Date.now()
    };
  }
  
  return currentNonces;
}

/**
 * CSP nonce context for React applications
 */
export interface CSPContext {
  nonce: string
  scriptNonce: string
  styleNonce: string
}

/**
 * Create CSP context with separate nonces for scripts and styles
 */
export function createCSPContext(): CSPContext {
  const scriptNonce = generateNonce()
  const styleNonce = generateNonce()
  
  return {
    nonce: scriptNonce, // Legacy support
    scriptNonce,
    styleNonce
  }
}

/**
 * Validate nonce format
 */
export function isValidNonce(nonce: string): boolean {
  // Base64 pattern: alphanumeric + / and + with optional padding
  const base64Pattern = /^[A-Za-z0-9+/]+=*$/
  return base64Pattern.test(nonce) && nonce.length >= 16
}

/**
 * Generate CSP-compliant nonce attribute
 */
export function createNonceAttribute(nonce: string): string {
  if (!isValidNonce(nonce)) {
    throw new Error('Invalid nonce format')
  }
  return `nonce-${nonce}`
}