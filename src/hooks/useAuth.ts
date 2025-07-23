import { useAuthStore } from '../store/authStore'

export function useAuth() {
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const signIn = useAuthStore((state) => state.signIn)
  const signUp = useAuthStore((state) => state.signUp)
  const signOut = useAuthStore((state) => state.signOut)
  const loading = useAuthStore((state) => state.loading)

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
