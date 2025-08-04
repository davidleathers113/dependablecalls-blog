// MIGRATION PLAN: This file partially uses optimized imports from lib/supabase-optimized
// Status: PARTIAL MIGRATION ✅ - uses signInWithOtp, signUp from optimized, type imports only
// MONITORING: Enhanced with Phase 2.4 performance monitoring and debugging
import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { createMonitoringMiddleware } from './utils/monitoringIntegration'
import { StorageFactory } from './utils/storage/encryptedStorage'
import { DataClassification, StorageType } from './utils/dataClassification'
import type { Session } from '@supabase/supabase-js'
import { signInWithOtp, signUp } from '../lib/supabase-optimized'
import { type User, createExtendedUser } from '../types/auth'

interface AuthState {
  user: User | null
  session: Session | null
  userType: 'supplier' | 'buyer' | 'admin' | 'network' | null
  loading: boolean
  isAuthenticated: boolean
  // User preferences (non-sensitive)
  preferences: {
    theme?: 'light' | 'dark'
    locale?: string
    timezone?: string
    emailNotifications?: boolean
  }
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

export const useAuthStore = create<AuthState>()(
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
        persist(
          (set, get) => ({
      user: null,
      session: null,
      userType: null,
      loading: true,
      preferences: {},

      get isAuthenticated() {
        return !!get().user && !!get().session
      },

      setUser: (user) => set({ user }),
      setSession: (session) => set({ session }),
      setUserType: (userType) => set({ userType }),
      setPreferences: (preferences) => 
        set((state) => ({ 
          preferences: { ...state.preferences, ...preferences } 
        })),

      signIn: async (email, password) => {
        // Authentication is now handled server-side via Netlify functions
        // This method will make a request to the auth-login function
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
            session: data.session, // Store session metadata only
            userType: data.user.userType,
            loading: false,
          })
        }
      },

      signInWithMagicLink: async (email) => {
        const { error } = await signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/app/dashboard`,
          },
        })

        if (error) throw error
      },

      signUp: async (email, password, userType) => {
        const { data, error } = await signUp({
          email,
          password,
          options: {
            data: { user_type: userType },
          },
        })

        if (error) throw error

        if (data.user && data.session) {
          // For signup, create a basic extended user (additional data will be added later)
          const extendedUser = createExtendedUser(data.user)
          extendedUser.userType = userType
          set({ user: extendedUser, session: data.session, userType })
        }
      },

      signOut: async () => {
        // Call server-side logout to clear httpOnly cookies
        try {
          await fetch('/.netlify/functions/auth-logout', {
            method: 'POST',
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
            credentials: 'include',
          })

          if (response.ok) {
            const data = await response.json()
            
            if (data.user && data.session) {
              const extendedUser = createExtendedUser(data.user)
              set({ 
                user: extendedUser, 
                session: data.session,
                userType: data.user.userType,
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
      
      initializeFromServer: (user, session, userType) => {
        // Used by server-side rendering or when session is validated server-side
        set({ user, session, userType, loading: false })
      },
          }),
          {
            name: 'dce-user-preferences',
            // SECURITY: Only persist non-sensitive user preferences - NO auth data
            partialize: (state) => ({
              preferences: state.preferences,
            }),
            // Skip hydration to prevent sensitive data leakage on SSR
            skipHydration: true,
            // Use encrypted storage for user preferences (INTERNAL classification)
            storage: StorageFactory.createZustandStorage(
              DataClassification.INTERNAL,
              StorageType.LOCAL
            ),
          }
        )
      )
    ),
    {
      name: 'auth-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
)
