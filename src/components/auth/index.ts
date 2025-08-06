/**
 * Authentication Components Exports
 */

export { default as Login } from './Login'
export { default as LoginForm } from './LoginForm'
export { default as ProtectedRoute } from './ProtectedRoute'
export { withProtectedRoute } from './withProtectedRoute'
export { AuthHydrationGate } from './AuthHydrationGate'
export { useAuthHydrated, useAuthReady } from './hooks'

// Re-export types if needed
export type { default as AuthComponent } from './Login'