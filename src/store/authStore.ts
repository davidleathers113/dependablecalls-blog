import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { type User, createExtendedUser } from '../types/auth'

interface AuthState {
  user: User | null
  session: Session | null
  userType: 'supplier' | 'buyer' | 'admin' | 'network' | null
  loading: boolean
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  setUserType: (userType: 'supplier' | 'buyer' | 'admin' | 'network' | null) => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (
    email: string,
    password: string,
    userType: 'supplier' | 'buyer' | 'network'
  ) => Promise<void>
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
          // Determine user type by checking related tables
          const [supplierCheck, buyerCheck, adminCheck, networkCheck] = await Promise.all([
            supabase.from('suppliers').select('*').eq('user_id', data.user.id).single(),
            supabase.from('buyers').select('*').eq('user_id', data.user.id).single(),
            supabase.from('admins').select('*').eq('user_id', data.user.id).single(),
            supabase.from('networks').select('*').eq('user_id', data.user.id).single(),
          ])

          const extendedUser = createExtendedUser(
            data.user,
            supplierCheck.data,
            buyerCheck.data,
            adminCheck.data,
            networkCheck.data
          )

          let userType: 'supplier' | 'buyer' | 'admin' | 'network' | null = null
          if (adminCheck.data) {
            userType = 'admin'
          } else if (networkCheck.data) {
            userType = 'network'
          } else if (buyerCheck.data) {
            userType = 'buyer'
          } else if (supplierCheck.data) {
            userType = 'supplier'
          }

          set({ user: extendedUser, session: data.session, userType })
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
          // For signup, create a basic extended user (additional data will be added later)
          const extendedUser = createExtendedUser(data.user)
          extendedUser.userType = userType
          set({ user: extendedUser, session: data.session, userType })
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
          // Determine user type by checking related tables
          const [supplierCheck, buyerCheck, adminCheck, networkCheck] = await Promise.all([
            supabase.from('suppliers').select('*').eq('user_id', session.user.id).single(),
            supabase.from('buyers').select('*').eq('user_id', session.user.id).single(),
            supabase.from('admins').select('*').eq('user_id', session.user.id).single(),
            supabase.from('networks').select('*').eq('user_id', session.user.id).single(),
          ])

          const extendedUser = createExtendedUser(
            session.user,
            supplierCheck.data,
            buyerCheck.data,
            adminCheck.data,
            networkCheck.data
          )

          let userType: 'supplier' | 'buyer' | 'admin' | 'network' | null = null
          if (adminCheck.data) {
            userType = 'admin'
          } else if (networkCheck.data) {
            userType = 'network'
          } else if (buyerCheck.data) {
            userType = 'buyer'
          } else if (supplierCheck.data) {
            userType = 'supplier'
          }

          set({ user: extendedUser, session, userType })
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
