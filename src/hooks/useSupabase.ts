import { supabase } from '@/lib/supabase'

/**
 * Hook to access the Supabase client instance
 * Ensures consistent client usage across the application
 */
export function useSupabase() {
  return supabase
}