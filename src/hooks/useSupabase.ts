import { supabase } from '@/lib/supabase-optimized'

/**
 * Hook to access the Supabase client instance
 * Ensures consistent client usage across the application
 * 
 * Note: This returns the full client for backward compatibility.
 * Consider using specific imports from @/lib/supabase-optimized
 * for better tree-shaking (e.g., auth, from, rpc).
 */
export function useSupabase() {
  return supabase
}