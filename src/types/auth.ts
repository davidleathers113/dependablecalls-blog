import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { Database } from './database'

// Base User type from Supabase
export type BaseUser = SupabaseUser

// Extended User type with additional properties from our database
export interface User extends BaseUser {
  // Properties from suppliers table (if user is a supplier)
  stripe_account_id?: string | null
  stripe_onboarding_completed?: boolean
  stripe_charges_enabled?: boolean
  stripe_payouts_enabled?: boolean
  company_name?: string

  // Properties from buyers table (if user is a buyer)
  stripe_customer_id?: string | null
  stripe_payment_method_id?: string | null
  current_balance?: number
  credit_limit?: number
  auto_recharge_enabled?: boolean
  auto_recharge_threshold?: number
  auto_recharge_amount?: number

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
  credit_limit: number
  current_balance: number
  supplier_id?: string | null
  supplier_status: 'pending' | 'active' | 'suspended' | 'banned'
  credit_balance: number
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
    user.stripe_account_id = supplier.stripe_account_id
    user.stripe_onboarding_completed = supplier.stripe_onboarding_completed
    user.stripe_charges_enabled = supplier.stripe_charges_enabled
    user.stripe_payouts_enabled = supplier.stripe_payouts_enabled
    user.company_name = supplier.company_name
  }

  // Add buyer-specific properties
  if (buyer) {
    user.stripe_customer_id = buyer.stripe_customer_id
    user.stripe_payment_method_id = buyer.stripe_payment_method_id
    user.current_balance = buyer.current_balance
    user.credit_limit = buyer.credit_limit
    user.auto_recharge_enabled = buyer.auto_recharge_enabled
    user.auto_recharge_threshold = buyer.auto_recharge_threshold
    user.auto_recharge_amount = buyer.auto_recharge_amount
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
