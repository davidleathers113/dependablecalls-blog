/**
 * Example: Enhanced AuthStore with Error Management
 * 
 * This demonstrates how to integrate the DCE Error Management System
 * into a Zustand store, showcasing:
 * - Centralized error handling middleware
 * - Typed error creation and recovery
 * - Automatic retry with exponential backoff
 * - Error reporting and monitoring integration
 * - State rollback on critical errors
 */

import { create } from 'zustand'
import { devtools, subscribeWithSelector, persist } from 'zustand/middleware'
import { createMonitoringMiddleware } from '../utils/monitoringIntegration'
import { StorageFactory } from '../utils/storageFactory'
import { DataClassification, StorageType } from '../utils/dataClassification'

// Import the new error management system
import {
  createErrorHandlingMiddleware,
  createSafeAsync,
  createError,
  DCEError,
  ErrorHandlingMiddleware,
  createRetryableOperation,
} from '../errors'

// Types
// =====

// Zustand function type aliases for better type safety
type ZustandSetter<T> = (
  partial: Partial<T> | ((state: T) => Partial<T>),
  replace?: boolean,
  action?: string
) => void

type ZustandGetter<T> = () => T

interface User {
  id: string
  email: string
  userType: 'supplier' | 'buyer' | 'admin'
  profile?: {
    firstName?: string
    lastName?: string
    company?: string
  }
}

interface Session {
  accessToken?: string // Only metadata, actual token is httpOnly
  refreshToken?: string // Only metadata, actual token is httpOnly
  expiresAt: number
  user?: User
}

interface AuthState {
  user: User | null
  session: Session | null
  userType: 'supplier' | 'buyer' | 'admin' | null
  loading: boolean
  preferences: Record<string, unknown>

  // Computed properties
  isAuthenticated: boolean

  // Actions
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  setUserType: (userType: 'supplier' | 'buyer' | 'admin' | null) => void
  setPreferences: (preferences: Record<string, unknown>) => void

  // Auth operations with error handling
  signIn: (email: string, password: string) => Promise<void>
  signInWithMagicLink: (email: string) => Promise<void>
  signUp: (email: string, password: string, userType: 'supplier' | 'buyer' | 'admin') => Promise<void>
  signOut: () => Promise<void>
  checkSession: () => Promise<void>
  refreshSession: () => Promise<void>
  initializeFromServer: (user: User, session: Session, userType: 'supplier' | 'buyer' | 'admin') => void

  // Error management actions
  retryLastAuthOperation: () => Promise<void>
  clearAuthErrors: () => void
  getAuthErrorStatus: () => {
    hasError: boolean
    lastError: DCEError | null
    isRecovering: boolean
    canRetry: boolean
  }
}

// Enhanced AuthStore with Error Management
// =======================================

export const useEnhancedAuthStore = create<AuthState & ErrorHandlingMiddleware>()(
  devtools(
    createErrorHandlingMiddleware({
      storeName: 'enhanced-auth-store',
      enableRecovery: true,
      enableReporting: true,
      maxRecoveryAttempts: 3,
      recoveryTimeout: 30000,
      rollbackStrategy: {
        enabled: true,
        preserveInitialState: true,
        rollbackKeys: ['user', 'session', 'userType', 'loading'],
        skipForErrorTypes: ['ValidationError'],
      },
      customContext: {
        component: 'auth',
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      },
      development: {
        logErrors: true,
        logRecovery: true,
        breakOnErrors: false,
      },
    })(
      createMonitoringMiddleware({
        name: 'enhanced-auth-store',
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
            (set, get) => {
              // Create safe async wrappers for all auth operations
              const safeSignIn = createSafeAsync(signInOperation, { 
                storeName: 'enhanced-auth-store', 
                actionType: 'signIn' 
              })
              
              const safeSignUp = createSafeAsync(signUpOperation, { 
                storeName: 'enhanced-auth-store', 
                actionType: 'signUp' 
              })
              
              const safeCheckSession = createSafeAsync(checkSessionOperation, { 
                storeName: 'enhanced-auth-store', 
                actionType: 'checkSession' 
              })

              const safeRefreshSession = createSafeAsync(refreshSessionOperation, { 
                storeName: 'enhanced-auth-store', 
                actionType: 'refreshSession' 
              })

              return {
                // Initial state
                user: null,
                session: null,
                userType: null,
                loading: true,
                preferences: {},

                // Computed properties
                get isAuthenticated() {
                  return !!get().user && !!get().session
                },

                // Basic setters
                setUser: (user) => set({ user }, false, 'setUser'),
                setSession: (session) => set({ session }, false, 'setSession'),
                setUserType: (userType) => set({ userType }, false, 'setUserType'),
                setPreferences: (preferences) => 
                  set((state) => ({ 
                    preferences: { ...state.preferences, ...preferences } 
                  }), false, 'setPreferences'),

                // Enhanced auth operations with error handling
                signIn: async (email: string, password: string) => {
                  set({ loading: true }, false, 'signIn:start')
                  
                  try {
                    const result = await safeSignIn(email, password, set, get)
                    if (result) {
                      set({ loading: false }, false, 'signIn:success')
                    } else {
                      set({ loading: false }, false, 'signIn:failed')
                      throw createError.authentication('Sign in failed due to an error')
                    }
                  } catch (error) {
                    set({ loading: false }, false, 'signIn:error')
                    throw error
                  }
                },

                signInWithMagicLink: async (email: string) => {
                  set({ loading: true }, false, 'magicLink:start')
                  
                  try {
                    await createRetryableOperation(
                      async () => {
                        const response = await fetch('/.netlify/functions/auth-magic-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })

                        if (!response.ok) {
                          const errorData = await response.json()
                          throw createError.api(
            errorData.message || 'Magic link request failed',
            response.status,
            errorData.code
          )
                        }

                        return response.json()
                      },
                      {
        storeName: 'enhanced-auth-store',
        actionType: 'signInWithMagicLink',
        userId: undefined,
      },
                      {
        shouldRetry: (error, attempt) => {
          return error.message.includes('rate limit') ? attempt < 2 : attempt < 3
        }
      }
                    )
                    
                    set({ loading: false }, false, 'magicLink:success')
                  } catch (error) {
                    set({ loading: false }, false, 'magicLink:error')
                    throw error
                  }
                },

                signUp: async (email: string, password: string, userType: 'supplier' | 'buyer' | 'admin') => {
                  set({ loading: true }, false, 'signUp:start')
                  
                  try {
                    const result = await safeSignUp(email, password, userType, set, get)
                    if (result) {
                      set({ loading: false }, false, 'signUp:success')
                    } else {
                      set({ loading: false }, false, 'signUp:failed')
                      throw createError.authentication('Sign up failed due to an error')
                    }
                  } catch (error) {
                    set({ loading: false }, false, 'signUp:error')
                    throw error
                  }
                },

                signOut: async () => {
                  try {
                    // Call server-side logout with retry
                    await createRetryableOperation(
                      async () => {
                        const response = await fetch('/.netlify/functions/auth-logout', {
          method: 'POST',
          credentials: 'include',
        })
                        
                        if (!response.ok) {
                          throw createError.network(
            'Logout request failed',
            response.status,
            '/.netlify/functions/auth-logout',
            'POST'
          )
                        }
                      },
                      {
        storeName: 'enhanced-auth-store',
        actionType: 'signOut',
      }
                    )
                  } catch (error) {
                    // Even if server logout fails, clear local state
                    console.warn('Server logout failed, clearing local state:', error)
                  }
                  
                  // Always clear local state
                  set({ 
    user: null, 
    session: null, 
    userType: null 
  }, false, 'signOut:complete')
                },

                checkSession: async () => {
                  set({ loading: true }, false, 'checkSession:start')
                  
                  try {
                    await safeCheckSession(set, get)
                    set({ loading: false }, false, 'checkSession:complete')
                  } catch (error) {
                    set({ loading: false }, false, 'checkSession:error')
                    throw error
                  }
                },

                refreshSession: async () => {
                  try {
                    await safeRefreshSession(set, get)
                  } catch (error) {
                    // If refresh fails, clear session
                    set({ 
                      user: null, 
                      session: null, 
                      userType: null 
                    }, false, 'refreshSession:failed')
                    throw error
                  }
                },

                initializeFromServer: (user, session, userType) => {
                  set({ user, session, userType, loading: false }, false, 'initializeFromServer')
                },

                // Error management methods
                retryLastAuthOperation: async () => {
                  const state = get()
                  if ('retryLastAction' in state && typeof state.retryLastAction === 'function') {
                    await state.retryLastAction()
                  }
                },

                clearAuthErrors: () => {
                  const state = get()
                  if ('clearError' in state && typeof state.clearError === 'function') {
                    state.clearError()
                  }
                },

                getAuthErrorStatus: () => {
                  const state = get()
                  return {
                    hasError: 'hasError' in state ? Boolean(state.hasError) : false,
                    lastError: 'lastError' in state ? state.lastError as DCEError | null : null,
                    isRecovering: 'isRecovering' in state ? Boolean(state.isRecovering) : false,
                    canRetry: 'retryLastAction' in state && typeof state.retryLastAction === 'function',
                  }
                },
              }
            },
            {
              name: 'dce-enhanced-auth-preferences',
              partialize: (state) => ({
                preferences: state.preferences,
              }),
              skipHydration: true,
              storage: StorageFactory.createZustandStorage(
                DataClassification.INTERNAL,
                StorageType.LOCAL
              ),
            }
          )
        )
      )
    ),
    {
      name: 'enhanced-auth-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
)

// Auth Operation Implementations
// =============================

async function signInOperation(
  email: string, 
  password: string, 
  set: ZustandSetter<AuthState & ErrorHandlingMiddleware>, 
  _get: ZustandGetter<AuthState & ErrorHandlingMiddleware>
): Promise<boolean> {
  const response = await fetch('/.netlify/functions/auth-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    
    // Create appropriate error type based on status
    if (response.status === 401) {
      throw createError.authentication(
        errorData.message || 'Invalid credentials',
        { context: { endpoint: '/.netlify/functions/auth-login' } }
      )
    } else if (response.status === 429) {
      throw createError.network(
        'Too many login attempts. Please try again later.',
        response.status,
        '/.netlify/functions/auth-login',
        'POST'
      )
    } else {
      throw createError.api(
        errorData.message || 'Login failed',
        response.status,
        errorData.code,
        errorData
      )
    }
  }

  const data = await response.json()
  
  if (data.user) {
    set({ 
      user: data.user, 
      session: data.session,
      userType: data.user.userType,
    }, false, 'signIn:setUserData')
    return true
  }
  
  return false
}

async function signUpOperation(
  email: string, 
  password: string, 
  userType: 'supplier' | 'buyer' | 'admin',
  set: ZustandSetter<AuthState & ErrorHandlingMiddleware>, 
  _get: ZustandGetter<AuthState & ErrorHandlingMiddleware>
): Promise<boolean> {
  const response = await fetch('/.netlify/functions/auth-signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, userType }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    
    if (response.status === 409) {
      throw createError.business(
        'An account with this email already exists',
        'unique_email',
        'user',
        email
      )
    } else if (response.status === 400) {
      throw createError.validation(
        errorData.message || 'Invalid signup data',
        errorData.field,
        errorData.rule,
        errorData.value
      )
    } else {
      throw createError.api(
        errorData.message || 'Signup failed',
        response.status,
        errorData.code,
        errorData
      )
    }
  }

  const data = await response.json()
  
  if (data.user && data.session) {
    set({ 
      user: data.user, 
      session: data.session, 
      userType 
    }, false, 'signUp:setUserData')
    return true
  }
  
  return false
}

async function checkSessionOperation(
  set: ZustandSetter<AuthState & ErrorHandlingMiddleware>, 
  _get: ZustandGetter<AuthState & ErrorHandlingMiddleware>
): Promise<void> {
  const response = await fetch('/.netlify/functions/auth-session', {
    method: 'GET',
    credentials: 'include',
  })

  if (response.ok) {
    const data = await response.json()
    
    if (data.user && data.session) {
      set({ 
        user: data.user, 
        session: data.session,
        userType: data.user.userType,
      }, false, 'checkSession:setUserData')
    } else {
      set({ 
        user: null, 
        session: null, 
        userType: null 
      }, false, 'checkSession:clearUserData')
    }
  } else if (response.status === 401) {
    // Session expired or invalid
    set({ 
      user: null, 
      session: null, 
      userType: null 
    }, false, 'checkSession:sessionExpired')
  } else {
    throw createError.network(
      'Failed to check session',
      response.status,
      '/.netlify/functions/auth-session',
      'GET'
    )
  }
}

async function refreshSessionOperation(
  set: ZustandSetter<AuthState & ErrorHandlingMiddleware>, 
  _get: ZustandGetter<AuthState & ErrorHandlingMiddleware>
): Promise<void> {
  const response = await fetch('/.netlify/functions/auth-refresh', {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok) {
    throw createError.authentication(
      'Failed to refresh session',
      { 
        context: { 
          statusCode: response.status,
          endpoint: '/.netlify/functions/auth-refresh',
        } 
      }
    )
  }

  const data = await response.json()
  
  if (data.session) {
    set((state: AuthState & ErrorHandlingMiddleware) => ({ 
      ...state,
      session: data.session 
    }), false, 'refreshSession:updateSession')
  }
}

// Example usage hook for React components
// =====================================

export function useAuthErrorHandling() {
  const store = useEnhancedAuthStore()
  
  return {
    // Error state
    hasError: store.hasError || false,
    lastError: store.lastError || null,
    isRecovering: store.isRecovering || false,
    
    // Error actions
    clearError: store.clearAuthErrors,
    retry: store.retryLastAuthOperation,
    getStatus: store.getAuthErrorStatus,
    
    // Auth actions with error handling
    signIn: store.signIn,
    signUp: store.signUp,
    signOut: store.signOut,
    checkSession: store.checkSession,
    refreshSession: store.refreshSession,
  }
}

// Example React component usage
// ============================

/*
function LoginForm() {
  const { signIn, hasError, lastError, isRecovering, clearError, retry } = useAuthErrorHandling()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      await signIn(email, password)
    } catch (error) {
      // Error is automatically handled by the error management system
      console.log('Login failed, but error is handled by the system')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input 
        type="email" 
        value={email} 
        onChange={(e) => setEmail(e.target.value)} 
        placeholder="Email"
      />
      <input 
        type="password" 
        value={password} 
        onChange={(e) => setPassword(e.target.value)} 
        placeholder="Password"
      />
      
      <button type="submit" disabled={isRecovering}>
        {isRecovering ? 'Signing in...' : 'Sign In'}
      </button>

      {hasError && lastError && (
        <div className="error-banner">
          <p>Error: {lastError.message}</p>
          {lastError.retryable && (
            <button onClick={retry}>Retry</button>
          )}
          <button onClick={clearError}>Dismiss</button>
        </div>
      )}
    </form>
  )
}
*/