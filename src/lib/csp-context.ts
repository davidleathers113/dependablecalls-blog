/**
 * CSP Context Definition
 * 
 * React context for CSP nonce values.
 */

import { createContext } from 'react'
import type { CSPContext as CSPContextType } from './csp-nonce'

export const CSPContext = createContext<CSPContextType | null>(null)