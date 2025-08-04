// MIGRATION PLAN: This file partially uses optimized imports from lib/supabase-optimized
// Status: PARTIAL MIGRATION ✅ - uses signInWithOtp, signUp from optimized, type imports only
// MONITORING: Enhanced with Phase 2.4 performance monitoring and debugging
import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import type { StateCreator } from 'zustand'
import { createMonitoringMiddleware } from './utils/monitoringIntegration'
import { StorageFactory } from './utils/storage/encryptedStorage'
import { DataClassification, StorageType } from './utils/dataClassification'
import type { Session } from '@supabase/supabase-js'
import { signInWithOtp, signUp } from '../lib/supabase-optimized'
import { type User, createExtendedUser, type UserRole } from '../types/auth'
import { addCSRFHeaders } from '../lib/csrf-protection'

// EMERGENCY FIX: Simplified type definition to resolve 510+ cascading TypeScript errors
// The complex middleware mutator chain was causing type mismatches

export interface AuthState {
  user: User | null
  session: Session | null
  userType: UserRole | null
  loading: boolean
  isAuthenticated: boolean
  _hasHydrated: boolean
  // User preferences (non-sensitive)
  preferences: {
    theme?: 'light' | 'dark'
    locale?: string
    timezone?: string
    emailNotifications?: boolean
  }
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  setUserType: (userType: UserRole | null) => void
  setPreferences: (preferences: Partial<AuthState['preferences']>) => void
  signIn: (email: string, password: string) => Promise<void>
  signInWithMagicLink: (email: string) => Promise<void>
  signUp: (
    email: string,
    password: string,
    userType: Exclude<UserRole, 'admin'>
  ) => Promise<void>
  signOut: () => Promise<void>
  checkSession: () => Promise<void>
  initializeFromServer: (user: User | null, session: Session | null, userType: UserRole | null) => void
}

// Create auth store with simplified StateCreator typing (emergency fix)
const createAuthStore: StateCreator<AuthState> = (set, get) => ({
      user: null,
      session: null,
      userType: null,
      loading: true,
      _hasHydrated: false,
      preferences: {},

      get isAuthenticated() {
        return !!get().user && !!get().session
      },

      setUser: (user: User | null) => set({ user }),
      setSession: (session: Session | null) => set({ session }),
      setUserType: (userType: UserRole | null) => set({ userType }),
      setPreferences: (preferences: Partial<AuthState['preferences']>) => 
        set((state: AuthState) => ({ 
          preferences: { ...state.preferences, ...preferences } 
        })),

      signIn: async (email: string, password: string) => {
        // Authentication is now handled server-side via Netlify functions
        // This method will make a request to the auth-login function
        const response = await fetch('/.netlify/functions/auth-login', {
          method: 'POST',
          headers: addCSRFHeaders({
            'Content-Type': 'application/json',
          }),
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
            session: data.session, // Store session metadata only
            userType: data.user.userType,
            loading: false,
          })
        }
      },

      signInWithMagicLink: async (email: string) => {
        const { error } = await signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/app/dashboard`,
            shouldCreateUser: false, // Prevent email enumeration attacks
          },
        })

        if (error) throw error
      },

      signUp: async (email: string, password: string, userType: Exclude<UserRole, 'admin'>) => {
        const { data, error } = await signUp({
          email,
          password,
          options: {
            data: { user_type: userType },
          },
        })

        if (error) throw error

        if (data.user && data.session) {
          // SECURITY: Don't trust client-sent userType - server will validate via RLS
          const extendedUser = createExtendedUser(data.user)
          // Remove client-side role assignment - rely on server validation
          set({ user: extendedUser, session: data.session, userType: null })
        }
      },

      signOut: async () => {
        // Call server-side logout to clear httpOnly cookies
        try {
          await fetch('/.netlify/functions/auth-logout', {
            method: 'POST',
            headers: addCSRFHeaders({}),
            credentials: 'include',
          })
        } catch (error) {
          console.error('Logout error:', error)
        }
        
        // Clear local state
        set({ user: null, session: null, userType: null })
      },

      checkSession: async () => {
        set({ loading: true })

        try {
          // Check session via server-side function that reads httpOnly cookies
          const response = await fetch('/.netlify/functions/auth-session', {
            method: 'GET',
            headers: addCSRFHeaders({}),
            credentials: 'include',
          })

          if (response.ok) {
            const data = await response.json()
            
            if (data.user && data.session) {
              const extendedUser = createExtendedUser(data.user)
              set({ 
                user: extendedUser, 
                session: data.session,
                // SECURITY: Get userType from server-validated JWT claims only
                userType: data.user.userType || null,
              })
            } else {
              set({ user: null, session: null, userType: null })
            }
          } else {
            set({ user: null, session: null, userType: null })
          }
        } catch (error) {
          console.error('Session check error:', error)
          set({ user: null, session: null, userType: null })
        }

        set({ loading: false })
      },
      
      initializeFromServer: (user: User | null, session: Session | null, userType: UserRole | null) => {
        // Used by server-side rendering or when session is validated server-side
        set({ user, session, userType, loading: false })
      },
    })

// Use conditional monitoring middleware to avoid TypeScript issues
const authStoreWithMiddleware = process.env.NODE_ENV === 'development'
  ? createMonitoringMiddleware({
      name: 'auth-store',
      enabled: true,
      options: {
        trackPerformance: true,
        trackStateChanges: true,
        trackSelectors: false,
        enableTimeTravel: true,
        maxHistorySize: 500,
      },
    })
  : <T>(f: StateCreator<T, [], [], T>): StateCreator<T, [], [], T> => f

// Legacy store implementation (emergency fix)
export const useAuthStoreLegacy = create<AuthState>()(
  authStoreWithMiddleware(
    devtools(
      subscribeWithSelector(
        persist(
          createAuthStore,
          {
            name: 'dce-user-preferences',
            // SECURITY: Only persist non-sensitive user preferences - NO auth data
            partialize: (state: AuthState) => ({
              preferences: state.preferences,
            }),
            // Skip hydration to prevent sensitive data leakage on SSR
            skipHydration: true,
            // Set hydration flag when store has rehydrated
            onRehydrateStorage: () => (state) => {
              if (state) {
                state._hasHydrated = true
              }
            },
            // Use localStorage for preferences (simplified for now)
            storage: {
              getItem: (name: string) => {
                const item = localStorage.getItem(name)
                return item ? JSON.parse(item) : null
              },
              setItem: (name: string, value: unknown) => {
                localStorage.setItem(name, JSON.stringify(value))
              },
              removeItem: (name: string) => {
                localStorage.removeItem(name)
              },
            },
          }
        )
      ),
      {
        name: 'auth-store',
        enabled: process.env.NODE_ENV === 'development',
      }
    )
  )
)

// Import the new v2 implementation
let useAuthStoreV2: any
try {
  const v2Module = require('./authStore.v2')
  useAuthStoreV2 = v2Module.useAuthStoreV2
} catch (error) {
  console.warn('[Auth Store] v2 implementation not available, using legacy')
}

// Export the appropriate implementation based on feature flag
export const useAuthStore = (() => {
  if (process.env.REACT_APP_USE_STANDARD_STORE === 'true' && useAuthStoreV2) {
    console.log('[Auth Store] Using v2 implementation with standard middleware')
    return useAuthStoreV2
  } else {
    console.log('[Auth Store] Using legacy implementation (emergency fix)')
    return useAuthStoreLegacy
  }
})()
