/**
 * Immer Bootstrap
 * 
 * One-time initialization of Immer features at application startup.
 * This prevents multiple initializations and side-effects from module imports.
 */

import { enablePatches, enableMapSet } from 'immer'

/**
 * Initialize Immer features once at application startup
 * This should be called early in the application initialization chain
 */
// Type for our initialization flag
interface ImmerGlobal {
  __immerInitialized?: boolean
}

export function initializeImmer(): void {
  const global = globalThis as typeof globalThis & ImmerGlobal
  
  // Check if already initialized to prevent double initialization
  if (!global.__immerInitialized) {
    // Enable patch support for time-travel debugging
    enablePatches()
    
    // Enable Map and Set support in Immer
    enableMapSet()
    
    // Mark as initialized to prevent re-initialization
    global.__immerInitialized = true
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[Immer] Initialized with patches and Map/Set support')
    }
  }
}

/**
 * Check if Immer has been initialized
 */
export function isImmerInitialized(): boolean {
  const global = globalThis as typeof globalThis & ImmerGlobal
  return Boolean(global.__immerInitialized)
}