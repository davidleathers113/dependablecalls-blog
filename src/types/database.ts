export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          phone: string | null
          user_type: 'supplier' | 'buyer' | 'admin'
          status: 'active' | 'suspended' | 'pending'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          full_name?: string | null
          phone?: string | null
          user_type: 'supplier' | 'buyer' | 'admin'
          status?: 'active' | 'suspended' | 'pending'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          phone?: string | null
          user_type?: 'supplier' | 'buyer' | 'admin'
          status?: 'active' | 'suspended' | 'pending'
          created_at?: string
          updated_at?: string
        }
      }
      suppliers: {
        Row: {
          id: string
          user_id: string
          company_name: string
          traffic_type: string[]
          payment_method: string
          tax_id: string | null
          billing_address: Json
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_name: string
          traffic_type: string[]
          payment_method: string
          tax_id?: string | null
          billing_address: Json
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_name?: string
          traffic_type?: string[]
          payment_method?: string
          tax_id?: string | null
          billing_address?: Json
          status?: string
          created_at?: string
        }
      }
      buyers: {
        Row: {
          id: string
          user_id: string
          company_name: string
          industry: string
          billing_type: 'prepaid' | 'postpaid'
          credit_limit: number | null
          stripe_customer_id: string | null
          billing_email: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_name: string
          industry: string
          billing_type: 'prepaid' | 'postpaid'
          credit_limit?: number | null
          stripe_customer_id?: string | null
          billing_email: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_name?: string
          industry?: string
          billing_type?: 'prepaid' | 'postpaid'
          credit_limit?: number | null
          stripe_customer_id?: string | null
          billing_email?: string
          status?: string
          created_at?: string
        }
      }
      campaigns: {
        Row: {
          id: string
          supplier_id: string
          name: string
          status: 'active' | 'paused' | 'ended'
          payout_per_call: number
          min_duration: number
          allowed_states: string[] | null
          blocked_states: string[] | null
          hours_of_operation: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          supplier_id: string
          name: string
          status?: 'active' | 'paused' | 'ended'
          payout_per_call: number
          min_duration?: number
          allowed_states?: string[] | null
          blocked_states?: string[] | null
          hours_of_operation?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          supplier_id?: string
          name?: string
          status?: 'active' | 'paused' | 'ended'
          payout_per_call?: number
          min_duration?: number
          allowed_states?: string[] | null
          blocked_states?: string[] | null
          hours_of_operation?: Json
          created_at?: string
          updated_at?: string
        }
      }
      buyer_campaigns: {
        Row: {
          id: string
          buyer_id: string
          name: string
          status: 'active' | 'paused' | 'ended'
          bid_amount: number
          daily_cap: number | null
          monthly_cap: number | null
          concurrency_cap: number | null
          target_criteria: Json
          ivr_settings: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          buyer_id: string
          name: string
          status?: 'active' | 'paused' | 'ended'
          bid_amount: number
          daily_cap?: number | null
          monthly_cap?: number | null
          concurrency_cap?: number | null
          target_criteria: Json
          ivr_settings?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          buyer_id?: string
          name?: string
          status?: 'active' | 'paused' | 'ended'
          bid_amount?: number
          daily_cap?: number | null
          monthly_cap?: number | null
          concurrency_cap?: number | null
          target_criteria?: Json
          ivr_settings?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      tracking_numbers: {
        Row: {
          id: string
          number: string
          campaign_id: string
          status: 'active' | 'inactive' | 'porting'
          created_at: string
        }
        Insert: {
          id?: string
          number: string
          campaign_id: string
          status?: 'active' | 'inactive' | 'porting'
          created_at?: string
        }
        Update: {
          id?: string
          number?: string
          campaign_id?: string
          status?: 'active' | 'inactive' | 'porting'
          created_at?: string
        }
      }
      calls: {
        Row: {
          id: string
          campaign_id: string
          buyer_campaign_id: string | null
          tracking_number: string
          caller_number: string
          destination_number: string | null
          started_at: string
          ended_at: string | null
          duration_seconds: number | null
          payout_amount: number | null
          charge_amount: number | null
          status: string
          metadata: Json | null
          recording_url: string | null
        }
        Insert: {
          id?: string
          campaign_id: string
          buyer_campaign_id?: string | null
          tracking_number: string
          caller_number: string
          destination_number?: string | null
          started_at?: string
          ended_at?: string | null
          duration_seconds?: number | null
          payout_amount?: number | null
          charge_amount?: number | null
          status: string
          metadata?: Json | null
          recording_url?: string | null
        }
        Update: {
          id?: string
          campaign_id?: string
          buyer_campaign_id?: string | null
          tracking_number?: string
          caller_number?: string
          destination_number?: string | null
          started_at?: string
          ended_at?: string | null
          duration_seconds?: number | null
          payout_amount?: number | null
          charge_amount?: number | null
          status?: string
          metadata?: Json | null
          recording_url?: string | null
        }
      }
      payouts: {
        Row: {
          id: string
          supplier_id: string
          amount: number
          status: string
          period_start: string
          period_end: string
          transaction_id: string | null
          paid_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          supplier_id: string
          amount: number
          status: string
          period_start: string
          period_end: string
          transaction_id?: string | null
          paid_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          supplier_id?: string
          amount?: number
          status?: string
          period_start?: string
          period_end?: string
          transaction_id?: string | null
          paid_at?: string | null
          created_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          buyer_id: string
          amount: number
          status: string
          period_start: string
          period_end: string
          due_date: string
          paid_at: string | null
          stripe_invoice_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          buyer_id: string
          amount: number
          status: string
          period_start: string
          period_end: string
          due_date: string
          paid_at?: string | null
          stripe_invoice_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          buyer_id?: string
          amount?: number
          status?: string
          period_start?: string
          period_end?: string
          due_date?: string
          paid_at?: string | null
          stripe_invoice_id?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}