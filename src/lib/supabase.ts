import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database-extended'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false, // We'll handle refresh via server-side
    persistSession: false, // No localStorage, using httpOnly cookies
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: {
      // Custom storage that does nothing - all session handling is server-side
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
    },
  },
})