export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          phone: string | null
          first_name: string | null
          last_name: string | null
          avatar_url: string | null
          metadata: Json
          status: 'pending' | 'active' | 'suspended' | 'banned'
          is_active: boolean
          last_login: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          phone?: string | null
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          metadata?: Json
          status?: 'pending' | 'active' | 'suspended' | 'banned'
          is_active?: boolean
          last_login?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          phone?: string | null
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          metadata?: Json
          status?: 'pending' | 'active' | 'suspended' | 'banned'
          is_active?: boolean
          last_login?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      admins: {
        Row: {
          id: string
          user_id: string | null
          role: string | null
          permissions: Json
          is_active: boolean
          appointed_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          role?: string | null
          permissions?: Json
          is_active?: boolean
          appointed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          role?: string | null
          permissions?: Json
          is_active?: boolean
          appointed_by?: string | null
          created_at?: string
        }
      }
      suppliers: {
        Row: {
          id: string
          user_id: string | null
          company_name: string
          business_type: string | null
          tax_id: string | null
          website_url: string | null
          credit_balance: number
          minimum_payout: number
          payout_frequency: string
          verification_data: Json
          status: 'pending' | 'active' | 'suspended' | 'banned'
          settings: Json
          approved_at: string | null
          approved_by: string | null
          created_at: string
          updated_at: string
          stripe_account_id: string | null
          stripe_onboarding_completed: boolean
          stripe_charges_enabled: boolean
          stripe_payouts_enabled: boolean
        }
        Insert: {
          id?: string
          user_id?: string | null
          company_name: string
          business_type?: string | null
          tax_id?: string | null
          website_url?: string | null
          credit_balance?: number
          minimum_payout?: number
          payout_frequency?: string
          verification_data?: Json
          status?: 'pending' | 'active' | 'suspended' | 'banned'
          settings?: Json
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          updated_at?: string
          stripe_account_id?: string | null
          stripe_onboarding_completed?: boolean
          stripe_charges_enabled?: boolean
          stripe_payouts_enabled?: boolean
        }
        Update: {
          id?: string
          user_id?: string | null
          company_name?: string
          business_type?: string | null
          tax_id?: string | null
          website_url?: string | null
          credit_balance?: number
          minimum_payout?: number
          payout_frequency?: string
          verification_data?: Json
          status?: 'pending' | 'active' | 'suspended' | 'banned'
          settings?: Json
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          updated_at?: string
          stripe_account_id?: string | null
          stripe_onboarding_completed?: boolean
          stripe_charges_enabled?: boolean
          stripe_payouts_enabled?: boolean
        }
      }
      buyers: {
        Row: {
          id: string
          user_id: string | null
          company_name: string
          business_type: string | null
          tax_id: string | null
          website_url: string | null
          credit_limit: number
          current_balance: number
          auto_recharge_enabled: boolean
          auto_recharge_threshold: number
          auto_recharge_amount: number
          verification_data: Json
          status: 'pending' | 'active' | 'suspended' | 'banned'
          settings: Json
          approved_at: string | null
          approved_by: string | null
          created_at: string
          updated_at: string
          stripe_customer_id: string | null
          stripe_payment_method_id: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          company_name: string
          business_type?: string | null
          tax_id?: string | null
          website_url?: string | null
          credit_limit?: number
          current_balance?: number
          auto_recharge_enabled?: boolean
          auto_recharge_threshold?: number
          auto_recharge_amount?: number
          verification_data?: Json
          status?: 'pending' | 'active' | 'suspended' | 'banned'
          settings?: Json
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          updated_at?: string
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          company_name?: string
          business_type?: string | null
          tax_id?: string | null
          website_url?: string | null
          credit_limit?: number
          current_balance?: number
          auto_recharge_enabled?: boolean
          auto_recharge_threshold?: number
          auto_recharge_amount?: number
          verification_data?: Json
          status?: 'pending' | 'active' | 'suspended' | 'banned'
          settings?: Json
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          updated_at?: string
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
        }
      }
      campaigns: {
        Row: {
          id: string
          supplier_id: string | null
          name: string
          description: string | null
          category: string | null
          vertical: string | null
          targeting: Json
          routing_rules: Json
          bid_floor: number
          max_concurrent_calls: number | null
          daily_cap: number | null
          total_cap: number | null
          start_date: string | null
          end_date: string | null
          status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled'
          is_active: boolean
          stats: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          supplier_id?: string | null
          name: string
          description?: string | null
          category?: string | null
          vertical?: string | null
          targeting?: Json
          routing_rules?: Json
          bid_floor?: number
          max_concurrent_calls?: number | null
          daily_cap?: number | null
          total_cap?: number | null
          start_date?: string | null
          end_date?: string | null
          status?: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled'
          is_active?: boolean
          stats?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          supplier_id?: string | null
          name?: string
          description?: string | null
          category?: string | null
          vertical?: string | null
          targeting?: Json
          routing_rules?: Json
          bid_floor?: number
          max_concurrent_calls?: number | null
          daily_cap?: number | null
          total_cap?: number | null
          start_date?: string | null
          end_date?: string | null
          status?: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled'
          is_active?: boolean
          stats?: Json
          created_at?: string
          updated_at?: string
        }
      }
      calls: {
        Row: {
          id: string
          campaign_id: string | null
          buyer_id: string | null
          supplier_id: string | null
          tracking_number: string | null
          caller_number: string | null
          destination_number: string | null
          call_sid: string | null
          start_time: string | null
          end_time: string | null
          duration: number | null
          status: 'initiated' | 'ringing' | 'connected' | 'completed' | 'failed' | 'rejected'
          recording_url: string | null
          transcription: string | null
          quality_score: number | null
          fraud_score: number | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id?: string | null
          buyer_id?: string | null
          supplier_id?: string | null
          tracking_number?: string | null
          caller_number?: string | null
          destination_number?: string | null
          call_sid?: string | null
          start_time?: string | null
          end_time?: string | null
          duration?: number | null
          status?: 'initiated' | 'ringing' | 'connected' | 'completed' | 'failed' | 'rejected'
          recording_url?: string | null
          transcription?: string | null
          quality_score?: number | null
          fraud_score?: number | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string | null
          buyer_id?: string | null
          supplier_id?: string | null
          tracking_number?: string | null
          caller_number?: string | null
          destination_number?: string | null
          call_sid?: string | null
          start_time?: string | null
          end_time?: string | null
          duration?: number | null
          status?: 'initiated' | 'ringing' | 'connected' | 'completed' | 'failed' | 'rejected'
          recording_url?: string | null
          transcription?: string | null
          quality_score?: number | null
          fraud_score?: number | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          supplier_id: string | null
          buyer_id: string | null
          call_id: string | null
          amount: number
          type: string
          status: string
          payment_method: string | null
          stripe_payment_intent_id: string | null
          stripe_charge_id: string | null
          stripe_transfer_id: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          supplier_id?: string | null
          buyer_id?: string | null
          call_id?: string | null
          amount: number
          type: string
          status: string
          payment_method?: string | null
          stripe_payment_intent_id?: string | null
          stripe_charge_id?: string | null
          stripe_transfer_id?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          supplier_id?: string | null
          buyer_id?: string | null
          call_id?: string | null
          amount?: number
          type?: string
          status?: string
          payment_method?: string | null
          stripe_payment_intent_id?: string | null
          stripe_charge_id?: string | null
          stripe_transfer_id?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      payouts: {
        Row: {
          id: string
          supplier_id: string | null
          amount: number
          currency: string
          status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
          stripe_payout_id: string | null
          stripe_transfer_id: string | null
          batch_id: string | null
          paid_at: string | null
          failed_at: string | null
          failure_reason: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          supplier_id?: string | null
          amount: number
          currency?: string
          status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
          stripe_payout_id?: string | null
          stripe_transfer_id?: string | null
          batch_id?: string | null
          paid_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          supplier_id?: string | null
          amount?: number
          currency?: string
          status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
          stripe_payout_id?: string | null
          stripe_transfer_id?: string | null
          batch_id?: string | null
          paid_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      supplier_stats_view: {
        Row: {
          supplier_id: string | null
          total_calls: number | null
          total_minutes: number | null
          total_earnings: number | null
          average_call_duration: number | null
          conversion_rate: number | null
          quality_score: number | null
        }
      }
      buyer_stats_view: {
        Row: {
          buyer_id: string | null
          total_campaigns: number | null
          total_calls: number | null
          total_spent: number | null
          average_cost_per_call: number | null
          conversion_rate: number | null
        }
      }
      campaign_performance_view: {
        Row: {
          campaign_id: string | null
          campaign_name: string | null
          supplier_id: string | null
          status: string | null
          total_calls: number | null
          connected_calls: number | null
          total_minutes: number | null
          total_revenue: number | null
          average_call_duration: number | null
          connection_rate: number | null
        }
      }
    }
    Functions: {
      get_user_stats: {
        Args: {
          user_id: string
        }
        Returns: {
          total_calls: number
          total_minutes: number
          total_revenue: number
          average_call_duration: number
        }
      }
      calculate_supplier_payout: {
        Args: {
          supplier_id: string
          start_date: string
          end_date: string
        }
        Returns: {
          total_amount: number
          call_count: number
          calls: Json
        }
      }
      add_buyer_credits: {
        Args: {
          buyer_id: string
          amount: number
          payment_intent_id: string
        }
        Returns: {
          new_balance: number
          transaction_id: string
        }
      }
      deduct_buyer_balance: {
        Args: {
          buyer_id: string
          amount: number
          call_id: string
        }
        Returns: {
          new_balance: number
          transaction_id: string
        }
      }
    }
    Enums: {
      user_status: 'pending' | 'active' | 'suspended' | 'banned'
      campaign_status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled'
      call_status: 'initiated' | 'ringing' | 'connected' | 'completed' | 'failed' | 'rejected'
      payout_status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
      invoice_status: 'draft' | 'open' | 'paid' | 'overdue' | 'cancelled'
      dispute_status: 'open' | 'investigating' | 'resolved' | 'closed'
    }
  }
}
