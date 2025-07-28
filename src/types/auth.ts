// MIGRATION PLAN: This file only imports types from @supabase/supabase-js
// Status: NO MIGRATION NEEDED - type imports don't affect bundle size
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { Database } from './database'

// Base User type from Supabase
export type BaseUser = SupabaseUser

// Extended User type with additional properties from our database
export interface User extends BaseUser {
  // Properties from suppliers table (if user is a supplier)
  company_name?: string

  // Properties from buyers table (if user is a buyer)

  // User type for role-based access
  userType?: 'supplier' | 'buyer' | 'admin' | 'network' | null
}

// Database types for convenience
export type DbUser = Database['public']['Tables']['users']['Row']
export type DbSupplier = Database['public']['Tables']['suppliers']['Row']
export type DbBuyer = Database['public']['Tables']['buyers']['Row']
export type DbAdmin = Database['public']['Tables']['admins']['Row']
// TODO: Update when database schema includes networks table
export type DbNetwork = {
  id: string
  user_id: string
  company_name: string
  buyer_id?: string | null
  buyer_status: 'pending' | 'active' | 'suspended' | 'banned'
  supplier_id?: string | null
  supplier_status: 'pending' | 'active' | 'suspended' | 'banned'
  margin_percentage: number
  routing_rules: unknown
  quality_thresholds: unknown
  approved_suppliers: string[]
  approved_buyers: string[]
  settings: unknown
  created_at: string
  updated_at: string
}

// Helper function to create extended user from Supabase user and database records
export function createExtendedUser(
  baseUser: SupabaseUser,
  supplier?: DbSupplier | null,
  buyer?: DbBuyer | null,
  admin?: DbAdmin | null,
  network?: DbNetwork | null
): User {
  const user: User = {
    ...baseUser,
    userType: admin
      ? 'admin'
      : network
        ? 'network'
        : buyer
          ? 'buyer'
          : supplier
            ? 'supplier'
            : null,
  }

  // Add supplier-specific properties
  if (supplier) {
    user.company_name = supplier.company_name
  }

  // Add buyer-specific properties
  if (buyer) {
    user.company_name = buyer.company_name
  }

  // Add network-specific properties
  if (network) {
    // Networks have both buyer and supplier properties
    user.company_name = network.company_name
    // Additional network-specific properties would be added here
    // when the database schema is updated
  }

  return user
}

// Type guards
export function isSupplier(user: User): boolean {
  return user.userType === 'supplier'
}

export function isBuyer(user: User): boolean {
  return user.userType === 'buyer'
}

export function isAdmin(user: User): boolean {
  return user.userType === 'admin'
}

export function isNetwork(user: User): boolean {
  return user.userType === 'network'
}

export type UserRole = 'supplier' | 'buyer' | 'admin' | 'network'
