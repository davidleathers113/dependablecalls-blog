/**
 * Mock Database Types for DCE Platform Tables
 *
 * This file provides temporary type definitions for DCE platform tables
 * that don't exist in the current Supabase schema but are needed by the
 * application code to compile successfully.
 */

import type { Json } from './database.generated'

// DCE Platform Enums
export type CallStatus = 'initiated' | 'ringing' | 'connected' | 'completed' | 'failed' | 'rejected'
export type CampaignStatus = 'active' | 'paused' | 'completed' | 'draft'
export type UserRole = 'supplier' | 'buyer' | 'admin'
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface MockEnums {
  call_status: CallStatus
  campaign_status: CampaignStatus
  user_role: UserRole
  payment_status: PaymentStatus
}

// Mock table definitions for DCE platform
export interface MockTables {
  // Users table - extends auth.users with DCE-specific fields
  users: {
    Row: {
      id: string
      email: string
      role: UserRole
      company_name: string | null
      phone: string | null
      created_at: string
      updated_at: string
      metadata: Json | null
    }
    Insert: {
      id?: string
      email: string
      role: UserRole
      company_name?: string | null
      phone?: string | null
      created_at?: string
      updated_at?: string
      metadata?: Json | null
    }
    Update: {
      id?: string
      email?: string
      role?: UserRole
      company_name?: string | null
      phone?: string | null
      created_at?: string
      updated_at?: string
      metadata?: Json | null
    }
    Relationships: []
  }

  // Suppliers table
  suppliers: {
    Row: {
      id: string
      user_id: string
      company_name: string
      contact_email: string
      phone: string | null
      website: string | null
      description: string | null
      is_verified: boolean
      quality_score: number | null
      total_calls: number
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      user_id: string
      company_name: string
      contact_email: string
      phone?: string | null
      website?: string | null
      description?: string | null
      is_verified?: boolean
      quality_score?: number | null
      total_calls?: number
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      user_id?: string
      company_name?: string
      contact_email?: string
      phone?: string | null
      website?: string | null
      description?: string | null
      is_verified?: boolean
      quality_score?: number | null
      total_calls?: number
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      {
        foreignKeyName: 'suppliers_user_id_fkey'
        columns: ['user_id']
        isOneToOne: true
        referencedRelation: 'users'
        referencedColumns: ['id']
      },
    ]
  }

  // Campaigns table
  campaigns: {
    Row: {
      id: string
      name: string
      supplier_id: string
      vertical: string
      description: string | null
      bid_floor: number
      daily_cap: number | null
      monthly_cap: number | null
      quality_threshold: number | null
      status: CampaignStatus
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      name: string
      supplier_id: string
      vertical: string
      description?: string | null
      bid_floor: number
      daily_cap?: number | null
      monthly_cap?: number | null
      quality_threshold?: number | null
      status?: CampaignStatus
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      name?: string
      supplier_id?: string
      vertical?: string
      description?: string | null
      bid_floor?: number
      daily_cap?: number | null
      monthly_cap?: number | null
      quality_threshold?: number | null
      status?: CampaignStatus
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      {
        foreignKeyName: 'campaigns_supplier_id_fkey'
        columns: ['supplier_id']
        isOneToOne: false
        referencedRelation: 'suppliers'
        referencedColumns: ['id']
      },
    ]
  }

  // Buyers table
  buyers: {
    Row: {
      id: string
      user_id: string
      company_name: string
      contact_email: string
      phone: string | null
      website: string | null
      description: string | null
      is_verified: boolean
      credit_limit: number
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      user_id: string
      company_name: string
      contact_email: string
      phone?: string | null
      website?: string | null
      description?: string | null
      is_verified?: boolean
      credit_limit?: number
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      user_id?: string
      company_name?: string
      contact_email?: string
      phone?: string | null
      website?: string | null
      description?: string | null
      is_verified?: boolean
      credit_limit?: number
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      {
        foreignKeyName: 'buyers_user_id_fkey'
        columns: ['user_id']
        isOneToOne: true
        referencedRelation: 'users'
        referencedColumns: ['id']
      },
    ]
  }

  // Buyer Campaigns table (junction table between buyers and campaigns)
  buyer_campaigns: {
    Row: {
      id: string
      buyer_id: string
      campaign_id: string
      name: string
      bid_amount: number
      daily_budget: number | null
      is_active: boolean
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      buyer_id: string
      campaign_id: string
      name: string
      bid_amount: number
      daily_budget?: number | null
      is_active?: boolean
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      buyer_id?: string
      campaign_id?: string
      name?: string
      bid_amount?: number
      daily_budget?: number | null
      is_active?: boolean
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      {
        foreignKeyName: 'buyer_campaigns_buyer_id_fkey'
        columns: ['buyer_id']
        isOneToOne: false
        referencedRelation: 'buyers'
        referencedColumns: ['id']
      },
      {
        foreignKeyName: 'buyer_campaigns_campaign_id_fkey'
        columns: ['campaign_id']
        isOneToOne: false
        referencedRelation: 'campaigns'
        referencedColumns: ['id']
      },
    ]
  }

  // Calls table
  calls: {
    Row: {
      id: string
      campaign_id: string
      supplier_id: string
      buyer_campaign_id: string | null
      caller_number: string
      tracking_number: string
      started_at: string | null
      duration_seconds: number | null
      status: CallStatus
      quality_score: number | null
      payout_amount: number | null
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      campaign_id: string
      supplier_id: string
      buyer_campaign_id?: string | null
      caller_number: string
      tracking_number: string
      started_at?: string | null
      duration_seconds?: number | null
      status?: CallStatus
      quality_score?: number | null
      payout_amount?: number | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      campaign_id?: string
      supplier_id?: string
      buyer_campaign_id?: string | null
      caller_number?: string
      tracking_number?: string
      started_at?: string | null
      duration_seconds?: number | null
      status?: CallStatus
      quality_score?: number | null
      payout_amount?: number | null
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      {
        foreignKeyName: 'calls_campaign_id_fkey'
        columns: ['campaign_id']
        isOneToOne: false
        referencedRelation: 'campaigns'
        referencedColumns: ['id']
      },
      {
        foreignKeyName: 'calls_supplier_id_fkey'
        columns: ['supplier_id']
        isOneToOne: false
        referencedRelation: 'suppliers'
        referencedColumns: ['id']
      },
      {
        foreignKeyName: 'calls_buyer_campaign_id_fkey'
        columns: ['buyer_campaign_id']
        isOneToOne: false
        referencedRelation: 'buyer_campaigns'
        referencedColumns: ['id']
      },
    ]
  }

  // Payments table
  payments: {
    Row: {
      id: string
      supplier_id: string
      amount: number
      currency: string
      payment_status: PaymentStatus
      stripe_payment_intent_id: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      supplier_id: string
      amount: number
      currency?: string
      payment_status?: PaymentStatus
      stripe_payment_intent_id?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      supplier_id?: string
      amount?: number
      currency?: string
      payment_status?: PaymentStatus
      stripe_payment_intent_id?: string | null
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      {
        foreignKeyName: 'payments_supplier_id_fkey'
        columns: ['supplier_id']
        isOneToOne: false
        referencedRelation: 'suppliers'
        referencedColumns: ['id']
      },
    ]
  }
}
