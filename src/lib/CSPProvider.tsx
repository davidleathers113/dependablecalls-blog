/**
 * CSP Provider for React Applications
 * 
 * Provides CSP nonce context throughout the React component tree
 * for secure inline content handling.
 */

import React, { useMemo, useEffect, useState } from 'react'
import { getCurrentNonces, refreshNonces, type CSPContext } from './csp-nonce'
import { CSPContext as CSPContextProvider } from './csp-context'

export interface CSPProviderProps {
  children: React.ReactNode
  nonce?: string
  scriptNonce?: string
  styleNonce?: string
}

/**
 * CSP Provider Component
 * 
 * Provides nonce values for CSP compliance throughout the component tree.
 * In SSR scenarios, nonces should be passed from the server.
 */
export function CSPProvider({ 
  children, 
  nonce, 
  scriptNonce, 
  styleNonce 
}: CSPProviderProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  
  const cspContext = useMemo(() => {
    if (scriptNonce && styleNonce) {
      return {
        nonce: scriptNonce, // Legacy support
        scriptNonce,
        styleNonce
      }
    }
    
    if (nonce) {
      return {
        nonce,
        scriptNonce: nonce,
        styleNonce: nonce
      }
    }
    
    // Get nonces from edge function or generate new ones
    const currentNonces = getCurrentNonces();
    return {
      nonce: currentNonces.script, // Legacy support
      scriptNonce: currentNonces.script,
      styleNonce: currentNonces.style
    }
  }, [nonce, scriptNonce, styleNonce]) // refreshKey not needed in calculation

  // Auto-refresh nonces for long-lived sessions (every 4 minutes)
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      // Only refresh if no explicit nonces were provided
      if (!nonce && !scriptNonce && !styleNonce) {
        refreshNonces();
        setRefreshKey(prev => prev + 1);
      }
    }, 240000); // 4 minutes

    return () => clearInterval(refreshInterval);
  }, [nonce, scriptNonce, styleNonce]);

  return (
    <CSPContextProvider.Provider value={cspContext}>
      {children}
    </CSPContextProvider.Provider>
  )
}

// Hooks have been moved to src/hooks/useCSPNonce.ts
// This file now only exports the CSPProvider component

/**
 * Component for secure inline styles with nonce
 */
export interface SecureStyleProps {
  children: string
  id?: string
}

export function SecureStyle({ children, id }: SecureStyleProps) {
  const { styleNonce } = useCSPNonce()
  
  return (
    <style
      id={id}
      nonce={styleNonce}
      dangerouslySetInnerHTML={{ __html: children }}
    />
  )
}

/**
 * Component for secure inline scripts with nonce
 */
export interface SecureScriptProps {
  children: string
  type?: string
  id?: string
}

export function SecureScript({ children, type = 'text/javascript', id }: SecureScriptProps) {
  const { scriptNonce } = useCSPNonce()
  
  return (
    <script
      id={id}
      type={type}
      nonce={scriptNonce}
      dangerouslySetInnerHTML={{ __html: children }}
    />
  )
}