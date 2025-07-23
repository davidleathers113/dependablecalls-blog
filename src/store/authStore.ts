import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  userType: 'supplier' | 'buyer' | 'admin' | null
  loading: boolean
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  setUserType: (userType: 'supplier' | 'buyer' | 'admin' | null) => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, userType: 'supplier' | 'buyer') => Promise<void>
  signOut: () => Promise<void>
  checkSession: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      userType: null,
      loading: true,

      get isAuthenticated() {
        return !!get().user && !!get().session
      },

      setUser: (user) => set({ user }),
      setSession: (session) => set({ session }),
      setUserType: (userType) => set({ userType }),

      signIn: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        if (data.user && data.session) {
          set({ user: data.user, session: data.session })

          // Fetch user type from users table
          const { data: userData } = await supabase
            .from('users')
            .select('user_type')
            .eq('id', data.user.id)
            .single()

          if (userData) {
            set({ userType: userData.user_type })
          }
        }
      },

      signUp: async (email, password, userType) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { user_type: userType },
          },
        })

        if (error) throw error

        if (data.user && data.session) {
          set({ user: data.user, session: data.session, userType })
        }
      },

      signOut: async () => {
        await supabase.auth.signOut()
        set({ user: null, session: null, userType: null })
      },

      checkSession: async () => {
        set({ loading: true })

        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session) {
          set({ user: session.user, session })

          // Fetch user type
          const { data: userData } = await supabase
            .from('users')
            .select('user_type')
            .eq('id', session.user.id)
            .single()

          if (userData) {
            set({ userType: userData.user_type })
          }
        }

        set({ loading: false })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        userType: state.userType,
      }),
    }
  )
)
