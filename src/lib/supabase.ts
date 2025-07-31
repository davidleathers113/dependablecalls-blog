import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database-extended'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Check if we're using placeholder/mock configuration
const isPlaceholderConfig = !supabaseUrl || 
  !supabaseAnonKey ||
  supabaseUrl.includes('your-project.supabase.co') ||
  supabaseUrl === 'your_supabase_url' ||
  supabaseAnonKey === 'your_supabase_anon_key'

export const supabase = isPlaceholderConfig ? null as any : createClient<Database>(supabaseUrl, supabaseAnonKey, {
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