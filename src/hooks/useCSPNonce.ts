/**
 * CSP Nonce Hooks
 * 
 * Custom hooks for accessing CSP nonce values in React components.
 */

import { useContext } from 'react'
import { CSPContext } from '../lib/csp-context'
import type { CSPContext as CSPContextType } from '../lib/csp-nonce'

/**
 * Hook to access CSP nonce values
 */
export function useCSPNonce(): CSPContextType {
  const context = useContext(CSPContext)
  
  if (!context) {
    throw new Error('useCSPNonce must be used within a CSPProvider')
  }
  
  return context
}

/**
 * Hook for script nonce specifically
 */
export function useScriptNonce(): string {
  const { scriptNonce } = useCSPNonce()
  return scriptNonce
}

/**
 * Hook for style nonce specifically
 */
export function useStyleNonce(): string {
  const { styleNonce } = useCSPNonce()
  return styleNonce
}

/**
 * Hook for legacy nonce support
 */
export function useNonce(): string {
  const { nonce } = useCSPNonce()
  return nonce
}