import { useAuthStore, type AuthState } from '../store/authStore'

export function useAuth() {
  const user = useAuthStore((state: AuthState) => state.user)
  const isAuthenticated = useAuthStore((state: AuthState) => state.isAuthenticated)
  const signIn = useAuthStore((state: AuthState) => state.signIn)
  const signUp = useAuthStore((state: AuthState) => state.signUp)
  const signOut = useAuthStore((state: AuthState) => state.signOut)
  const loading = useAuthStore((state: AuthState) => state.loading)

  return {
    user,
    isAuthenticated,
    signIn,
    signUp,
    signOut,
    loading,
    isSupplier: user?.user_metadata?.userType === 'supplier',
    isBuyer: user?.user_metadata?.userType === 'buyer',
    isAdmin: user?.user_metadata?.userType === 'admin',
  }
}
