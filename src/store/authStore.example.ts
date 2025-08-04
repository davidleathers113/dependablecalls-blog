/**
 * Auth Store with Phase 3.1b Middleware - EXAMPLE IMPLEMENTATION
 * This demonstrates how to integrate the new versioned persistence and runtime validation middleware
 * 
 * CHANGES FROM ORIGINAL:
 * - Replaced custom persist middleware with versionedPersistence
 * - Added runtimeValidation middleware for development
 * - Integrated with schema registry and migration system
 * - Enhanced with PII scanning and validation
 */

import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import { createMonitoringMiddleware } from './utils/monitoringIntegration'
import { 
  versionedPersistence, 
  runtimeValidation,
  createDCEStoreConfig,
  type VersionedPersistenceState,
  type VersionedPersistenceApi,
  type RuntimeValidationState,
  type RuntimeValidationApi,
} from './utils/middleware'
import type { Session } from '@supabase/supabase-js'
import { signInWithOtp, signUp } from '../lib/supabase-optimized'
import { type User, createExtendedUser } from '../types/auth'

// Import auth schemas and types
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { AuthPersisted } from './utils/schemas/authStore.schema'

interface AuthState {
  user: User | null
  session: Session | null
  userType: 'supplier' | 'buyer' | 'admin' | 'network' | null
  loading: boolean
  isAuthenticated: boolean
  
  // User preferences (these are persisted via the middleware)
  preferences: {
    theme?: 'light' | 'dark'
    locale?: string
    timezone?: string
    emailNotifications?: boolean
  }
  
  // Actions
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  setUserType: (userType: 'supplier' | 'buyer' | 'admin' | 'network' | null) => void
  setPreferences: (preferences: Partial<AuthState['preferences']>) => void
  signIn: (email: string, password: string) => Promise<void>
  signInWithMagicLink: (email: string) => Promise<void>
  signUp: (
    email: string,
    password: string,
    userType: 'supplier' | 'buyer' | 'network'
  ) => Promise<void>
  signOut: () => Promise<void>
  checkSession: () => Promise<void>
  initializeFromServer: (user: User | null, session: Session | null, userType: AuthState['userType']) => void
}

// Combined state type with middleware
type EnhancedAuthState = AuthState 
  & VersionedPersistenceState 
  & VersionedPersistenceApi 
  & RuntimeValidationState 
  & RuntimeValidationApi

// Create middleware configuration
const middlewareConfig = createDCEStoreConfig('auth-store', {
  persistence: {
    enabled: true,
    options: {
      // Only persist user preferences (not session data for security)
      persistedFields: ['preferences'],
      migrations: {
        autoMigrate: true,
        logMigrations: true,
        failOnMigrationError: false, // Don't break app on migration failure
        backupBeforeMigration: true,
      },
      validation: {
        validateOnLoad: true,
        validateOnSave: true,
        strict: false, // Lenient validation for user preferences
      },
      performance: {
        debounceMs: 200, // Slightly higher debounce for auth operations
        maxStateSizeBytes: 10 * 1024, // 10KB max for auth state
      },
    },
  },
  validation: {
    enabled: process.env.NODE_ENV === 'development',
    options: {
      triggers: {
        onChange: true,
        onInit: true,
        beforePersist: true,
        afterRehydrate: true,
      },
      behavior: {
        throwOnError: false, // Don't break auth flow on validation errors
        logToConsole: true,
        debounceMs: 200,
      },
      security: {
        scanForPII: true, // Important for auth store
        piiScanTrigger: 'onChange',
        reportPII: true,
        throwOnPII: false, // Don't break auth flow, just warn
      },
    },
  },
})

export const useAuthStore = create<EnhancedAuthState>()(
  devtools(
    createMonitoringMiddleware({
      name: 'auth-store',
      enabled: true,
      options: {
        trackPerformance: true,
        trackStateChanges: true,
        trackSelectors: false,
        enableTimeTravel: true,
        maxHistorySize: 500,
      },
    })(
      subscribeWithSelector(
        // Phase 3.1b: New runtime validation middleware
        runtimeValidation(
          // Phase 3.1b: New versioned persistence middleware
          versionedPersistence(
            (set, get) => ({
              // Initial state
              user: null,
              session: null,
              userType: null,
              loading: true,
              preferences: {},

              get isAuthenticated() {
                return !!get().user && !!get().session
              },

              // Actions
              setUser: (user) => set({ user }),
              
              setSession: (session) => {
                set({ session })
                // Note: Session is not persisted for security reasons
                // Only stored in memory, server uses httpOnly cookies
              },
              
              setUserType: (userType) => set({ userType }),
              
              setPreferences: (preferences) => {
                set((state) => ({ 
                  preferences: { ...state.preferences, ...preferences } 
                }))
                // Preferences are automatically persisted via middleware
              },

              signIn: async (email, password) => {
                try {
                  set({ loading: true })
                  
                  // Authentication is handled server-side via Netlify functions
                  const response = await fetch('/.netlify/functions/auth-login', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    credentials: 'include', // Important for cookies
                    body: JSON.stringify({ email, password }),
                  })

                  if (!response.ok) {
                    const error = await response.json()
                    throw new Error(error.error || 'Login failed')
                  }

                  const data = await response.json()
                  
                  // Server has set httpOnly cookies, we just store non-sensitive data
                  if (data.user) {
                    const extendedUser = createExtendedUser(data.user)
                    set({ 
                      user: extendedUser, 
                      userType: data.userType,
                      loading: false 
                    })
                    
                    // Session data is not stored in client state for security
                    // The middleware will automatically validate and persist appropriate data
                  }
                } catch (error) {
                  set({ loading: false })
                  console.error('Auth error:', error)
                  throw error
                }
              },

              signInWithMagicLink: async (email) => {
                try {
                  set({ loading: true })
                  await signInWithOtp({ email })
                  set({ loading: false })
                } catch (error) {
                  set({ loading: false })
                  throw error
                }
              },

              signUp: async (email, password, userType) => {
                try {
                  set({ loading: true })
                  await signUp({ email, password, options: { data: { userType } } })
                  set({ loading: false })
                } catch (error) {
                  set({ loading: false })
                  throw error
                }
              },

              signOut: async () => {
                try {
                  set({ loading: true })
                  
                  // Clear server-side session
                  await fetch('/.netlify/functions/auth-logout', {
                    method: 'POST',
                    credentials: 'include',
                  })
                  
                  // Clear client state
                  set({ 
                    user: null, 
                    session: null, 
                    userType: null, 
                    loading: false 
                  })
                  
                  // Clear any persisted data
                  get().clearPersisted()
                  
                } catch (error) {
                  set({ loading: false })
                  console.error('Sign out error:', error)
                }
              },

              checkSession: async () => {
                try {
                  set({ loading: true })
                  
                  const response = await fetch('/.netlify/functions/auth-session', {
                    credentials: 'include',
                  })
                  
                  if (response.ok) {
                    const data = await response.json()
                    if (data.user) {
                      const extendedUser = createExtendedUser(data.user)
                      set({ 
                        user: extendedUser, 
                        userType: data.userType,
                        loading: false 
                      })
                    } else {
                      set({ user: null, userType: null, loading: false })
                    }
                  } else {
                    set({ user: null, userType: null, loading: false })
                  }
                } catch (error) {
                  console.error('Session check error:', error)
                  set({ user: null, userType: null, loading: false })
                }
              },

              initializeFromServer: (user, session, userType) => {
                const extendedUser = user ? createExtendedUser(user) : null
                set({ 
                  user: extendedUser, 
                  session, // Note: session won't be persisted
                  userType, 
                  loading: false 
                })
              },
            }),
            middlewareConfig.persistence!.options!
          ),
          middlewareConfig.validation!.options!
        ),
        {
          name: 'auth-store-subscription', // For devtools
        }
      )
    ),
    {
      name: 'auth-store', // For devtools
    }
  )
)

// Development utilities
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Extend window interface for development utilities
  interface WindowDev {
    __authStore: typeof useAuthStore
    __authStoreDebug: {
      getValidationStatus: () => unknown
      getPIIScanStatus: () => unknown
      getMigrationStatus: () => unknown
      runValidation: () => unknown
      runPIIScan: () => unknown
      clearValidation: () => unknown
    }
  }

  const windowDev = window as unknown as Window & WindowDev
  
  // Store reference to the store itself, not the hook
  windowDev.__authStore = useAuthStore
  
  // Helper to inspect middleware state
  windowDev.__authStoreDebug = {
    getValidationStatus: () => useAuthStore.getState().getValidationStatus(),
    getPIIScanStatus: () => useAuthStore.getState().getPIIScanStatus(),
    getMigrationStatus: () => useAuthStore.getState().getMigrationStatus(),
    runValidation: () => useAuthStore.getState().validate(),
    runPIIScan: () => useAuthStore.getState().scanPII(),
    clearValidation: () => useAuthStore.getState().clearValidationStatus(),
  }
  
  console.log(`🔐 Auth Store initialized with Phase 3.1b middleware:
- Versioned Persistence: ${middlewareConfig.persistence?.enabled ? '✅' : '❌'}
- Runtime Validation: ${middlewareConfig.validation?.enabled ? '✅' : '❌'}
- PII Scanning: ${middlewareConfig.validation?.options?.security?.scanForPII ? '✅' : '❌'}
- Auto Migration: ${middlewareConfig.persistence?.options?.migrations?.autoMigrate ? '✅' : '❌'}`)
}