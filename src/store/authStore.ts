/**
 * Auth Store v2 - Migrated to Standard Store Factory
 * 
 * This migrated version uses the createStandardStore factory to resolve
 * the cascading TypeScript errors and restore full type safety.
 * 
 * Key improvements:
 * - Uses StandardStateCreator with proper mutator types
 * - Applies middleware in correct order: immer → devtools → subscribeWithSelector → persist
 * - Removes emergency type simplifications
 * - Maintains all existing functionality
 * - Adds comprehensive monitoring and debugging
 */

import type { Session } from '@supabase/supabase-js'
import { signInWithOtp, signUp } from '../lib/supabase-optimized'
import { type User, createExtendedUser, type UserRole } from '../types/auth'
import { addCSRFHeaders } from '../lib/csrf-protection'
import { createAuthStore } from './factories/createStandardStore'
import type { StandardStateCreator } from './types/mutators'

// Safe fetch with timeout
async function safeFetch(input: RequestInfo, init: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  
  try {
    const response = await fetch(input, { 
      ...init, 
      signal: controller.signal 
    })
    return response
  } finally {
    clearTimeout(timeout)
  }
}

// Auth Store State Interface (unchanged from original)
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

// Initial state
const initialState = {
  user: null,
  session: null,
  userType: null,
  loading: true,
  _hasHydrated: false,
  preferences: {},
}

// Create auth store using StandardStateCreator with proper typing
const createAuthStoreState: StandardStateCreator<AuthState> = (set, _get) => ({
  ...initialState,
  
  // Remove getter from state - will create as selector instead
  isAuthenticated: false,

  // State setters with immer support
  setUser: (user: User | null) => {
    set((state) => {
      state.user = user
      state.isAuthenticated = !!user && !!state.session
    })
  },

  setSession: (session: Session | null) => {
    set((state) => {
      state.session = session
      state.isAuthenticated = !!state.user && !!session
    })
  },

  setUserType: (userType: UserRole | null) => {
    set((state) => {
      state.userType = userType
    })
  },

  setPreferences: (preferences: Partial<AuthState['preferences']>) => {
    set((state) => {
      state.preferences = { ...state.preferences, ...preferences }
    })
  },

  // Authentication methods (maintained from original)
  signIn: async (email: string, password: string) => {
    // Authentication is now handled server-side via Netlify functions
    // This method will make a request to the auth-login function
    const response = await safeFetch('/.netlify/functions/auth-login', {
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
      set((state) => {
        state.user = extendedUser
        state.session = data.session // Store session metadata only
        state.userType = data.user.userType
        state.loading = false
        state.isAuthenticated = true
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
      set((state) => {
        state.user = extendedUser
        state.session = data.session
        state.userType = null
      })
    }
  },

  signOut: async () => {
    // Call server-side logout to clear httpOnly cookies
    try {
      await safeFetch('/.netlify/functions/auth-logout', {
        method: 'POST',
        headers: addCSRFHeaders({}),
        credentials: 'include',
      })
    } catch (error) {
      console.error('Logout error:', error)
    }
    
    // Clear local state
    set((state) => {
      state.user = null
      state.session = null
      state.userType = null
      state.isAuthenticated = false
    })
  },

  checkSession: async () => {
    set((state) => {
      state.loading = true
    })

    try {
      // Check session via server-side function that reads httpOnly cookies
      const response = await safeFetch('/.netlify/functions/auth-session', {
        method: 'GET',
        headers: addCSRFHeaders({}),
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        
        if (data.user && data.session) {
          const extendedUser = createExtendedUser(data.user)
          set((state) => {
            state.user = extendedUser
            state.session = data.session
            // SECURITY: Get userType from server-validated JWT claims only
            state.userType = data.user.userType || null
            state.isAuthenticated = true
          })
        } else {
          set((state) => {
            state.user = null
            state.session = null
            state.userType = null
          })
        }
      } else {
        set((state) => {
          state.user = null
          state.session = null
          state.userType = null
        })
      }
    } catch (error) {
      console.error('Session check error:', error)
      set((state) => {
        state.user = null
        state.session = null
        state.userType = null
      })
    }

    set((state) => {
      state.loading = false
    })
  },
  
  initializeFromServer: (user: User | null, session: Session | null, userType: UserRole | null) => {
    // Used by server-side rendering or when session is validated server-side
    set((state) => {
      state.user = user
      state.session = session
      state.userType = userType
      state.loading = false
      state.isAuthenticated = !!user && !!session
    })
  },
})

// Create the store using the standardized factory
export const useAuthStore = createAuthStore<AuthState>(
  'auth-store',
  createAuthStoreState,
  {
    // SECURITY: Only persist non-sensitive user preferences - NO auth data
    partialize: (state: AuthState): Partial<AuthState> => ({
      preferences: state.preferences,
      _hasHydrated: state._hasHydrated,
    }),
    // Remove skipHydration to allow proper hydration
    // Set _hasHydrated when store is rehydrated
    onRehydrateStorage: () => (state: AuthState | undefined): void => {
      if (state) {
        state._hasHydrated = true
      }
    },
    // Use localStorage for preferences (could be upgraded to encrypted storage later)
    storage: {
      getItem: (name: string): string | null => {
        const item = localStorage.getItem(name)
        return item ? JSON.parse(item) : null
      },
      setItem: (name: string, value: unknown): void => {
        localStorage.setItem(name, JSON.stringify(value))
      },
      removeItem: (name: string): void => {
        localStorage.removeItem(name)
      },
    },
  }
)

// Selectors for common access patterns
export const useAuthUser = () => useAuthStore((state) => state.user)
export const useAuthSession = () => useAuthStore((state) => state.session)
export const useAuthUserType = () => useAuthStore((state) => state.userType)
export const useAuthLoading = () => useAuthStore((state) => state.loading)
// Derived selector for isAuthenticated instead of stored value
export const useIsAuthenticated = () => useAuthStore((state) => !!state.user && !!state.session)
export const useAuthPreferences = () => useAuthStore((state) => state.preferences)

// Auth actions
export const useAuthActions = () => useAuthStore((state) => ({
  setUser: state.setUser,
  setSession: state.setSession,
  setUserType: state.setUserType,
  setPreferences: state.setPreferences,
  signIn: state.signIn,
  signInWithMagicLink: state.signInWithMagicLink,
  signUp: state.signUp,
  signOut: state.signOut,
  checkSession: state.checkSession,
  initializeFromServer: state.initializeFromServer,
}))

// Development helpers
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as unknown as { __authStore: typeof useAuthStore }).__authStore = useAuthStore
  console.log('[Auth Store] Loaded with standard middleware chain')
}