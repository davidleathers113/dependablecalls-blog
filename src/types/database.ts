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
          id?: string
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
          user_id: string
          role: string
          permissions: Json
          is_active: boolean
          appointed_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role?: string
          permissions?: Json
          is_active?: boolean
          appointed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: string
          permissions?: Json
          is_active?: boolean
          appointed_by?: string | null
          created_at?: string
        }
      }
      suppliers: {
        Row: {
          id: string
          user_id: string
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
        }
        Insert: {
          id?: string
          user_id: string
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
        }
        Update: {
          id?: string
          user_id?: string
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
        }
      }
      buyers: {
        Row: {
          id: string
          user_id: string
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
        }
        Insert: {
          id?: string
          user_id: string
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
        }
        Update: {
          id?: string
          user_id?: string
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
        }
      }
      campaigns: {
        Row: {
          id: string
          supplier_id: string
          name: string
          description: string | null
          category: string | null
          vertical: string | null
          targeting: Json
          routing_rules: Json
          bid_floor: number
          max_concurrent_calls: number
          daily_cap: number | null
          monthly_cap: number | null
          tracking_numbers: Json
          schedule: Json
          status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled'
          quality_threshold: number
          fraud_detection_enabled: boolean
          recording_enabled: boolean
          call_timeout_seconds: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          supplier_id: string
          name: string
          description?: string | null
          category?: string | null
          vertical?: string | null
          targeting?: Json
          routing_rules?: Json
          bid_floor?: number
          max_concurrent_calls?: number
          daily_cap?: number | null
          monthly_cap?: number | null
          tracking_numbers?: Json
          schedule?: Json
          status?: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled'
          quality_threshold?: number
          fraud_detection_enabled?: boolean
          recording_enabled?: boolean
          call_timeout_seconds?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          supplier_id?: string
          name?: string
          description?: string | null
          category?: string | null
          vertical?: string | null
          targeting?: Json
          routing_rules?: Json
          bid_floor?: number
          max_concurrent_calls?: number
          daily_cap?: number | null
          monthly_cap?: number | null
          tracking_numbers?: Json
          schedule?: Json
          status?: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled'
          quality_threshold?: number
          fraud_detection_enabled?: boolean
          recording_enabled?: boolean
          call_timeout_seconds?: number
          created_at?: string
          updated_at?: string
        }
      }
      buyer_campaigns: {
        Row: {
          id: string
          buyer_id: string
          name: string
          description: string | null
          targeting_criteria: Json
          max_bid: number
          daily_budget: number | null
          monthly_budget: number | null
          daily_cap: number | null
          monthly_cap: number | null
          schedule: Json
          quality_requirements: Json
          exclude_suppliers: string[]
          preferred_suppliers: string[]
          status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled'
          auto_approval_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          buyer_id: string
          name: string
          description?: string | null
          targeting_criteria?: Json
          max_bid: number
          daily_budget?: number | null
          monthly_budget?: number | null
          daily_cap?: number | null
          monthly_cap?: number | null
          schedule?: Json
          quality_requirements?: Json
          exclude_suppliers?: string[]
          preferred_suppliers?: string[]
          status?: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled'
          auto_approval_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          buyer_id?: string
          name?: string
          description?: string | null
          targeting_criteria?: Json
          max_bid?: number
          daily_budget?: number | null
          monthly_budget?: number | null
          daily_cap?: number | null
          monthly_cap?: number | null
          schedule?: Json
          quality_requirements?: Json
          exclude_suppliers?: string[]
          preferred_suppliers?: string[]
          status?: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled'
          auto_approval_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      calls: {
        Row: {
          id: string
          campaign_id: string | null
          buyer_campaign_id: string | null
          tracking_number: string
          caller_number: string
          destination_number: string | null
          caller_location: Json | null
          started_at: string
          answered_at: string | null
          ended_at: string | null
          duration_seconds: number
          billable_seconds: number
          payout_amount: number
          charge_amount: number
          margin_amount: number
          status: 'initiated' | 'ringing' | 'connected' | 'completed' | 'failed' | 'rejected'
          disposition: string | null
          quality_score: number | null
          fraud_score: number | null
          metadata: Json
          recording_url: string | null
          recording_duration: number | null
          call_flow: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id?: string | null
          buyer_campaign_id?: string | null
          tracking_number: string
          caller_number: string
          destination_number?: string | null
          caller_location?: Json | null
          started_at?: string
          answered_at?: string | null
          ended_at?: string | null
          duration_seconds?: number
          billable_seconds?: number
          payout_amount?: number
          charge_amount?: number
          margin_amount?: number
          status?: 'initiated' | 'ringing' | 'connected' | 'completed' | 'failed' | 'rejected'
          disposition?: string | null
          quality_score?: number | null
          fraud_score?: number | null
          metadata?: Json
          recording_url?: string | null
          recording_duration?: number | null
          call_flow?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string | null
          buyer_campaign_id?: string | null
          tracking_number?: string
          caller_number?: string
          destination_number?: string | null
          caller_location?: Json | null
          started_at?: string
          answered_at?: string | null
          ended_at?: string | null
          duration_seconds?: number
          billable_seconds?: number
          payout_amount?: number
          charge_amount?: number
          margin_amount?: number
          status?: 'initiated' | 'ringing' | 'connected' | 'completed' | 'failed' | 'rejected'
          disposition?: string | null
          quality_score?: number | null
          fraud_score?: number | null
          metadata?: Json
          recording_url?: string | null
          recording_duration?: number | null
          call_flow?: Json
          created_at?: string
          updated_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          buyer_id: string
          invoice_number: string
          amount: number
          tax_amount: number
          total_amount: number
          status: 'draft' | 'open' | 'paid' | 'overdue' | 'cancelled'
          period_start: string
          period_end: string
          due_date: string
          payment_terms: number
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          payment_method: string | null
          paid_at: string | null
          notes: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          buyer_id: string
          invoice_number?: string
          amount: number
          tax_amount?: number
          total_amount: number
          status?: 'draft' | 'open' | 'paid' | 'overdue' | 'cancelled'
          period_start: string
          period_end: string
          due_date: string
          payment_terms?: number
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          payment_method?: string | null
          paid_at?: string | null
          notes?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          buyer_id?: string
          invoice_number?: string
          amount?: number
          tax_amount?: number
          total_amount?: number
          status?: 'draft' | 'open' | 'paid' | 'overdue' | 'cancelled'
          period_start?: string
          period_end?: string
          due_date?: string
          payment_terms?: number
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          payment_method?: string | null
          paid_at?: string | null
          notes?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      payouts: {
        Row: {
          id: string
          supplier_id: string
          amount: number
          fee_amount: number
          net_amount: number
          status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
          period_start: string
          period_end: string
          payment_method: string | null
          payment_details: Json
          transaction_id: string | null
          reference_number: string | null
          notes: string | null
          processed_at: string | null
          paid_at: string | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          supplier_id: string
          amount: number
          fee_amount?: number
          net_amount: number
          status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
          period_start: string
          period_end: string
          payment_method?: string | null
          payment_details?: Json
          transaction_id?: string | null
          reference_number?: string | null
          notes?: string | null
          processed_at?: string | null
          paid_at?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          supplier_id?: string
          amount?: number
          fee_amount?: number
          net_amount?: number
          status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
          period_start?: string
          period_end?: string
          payment_method?: string | null
          payment_details?: Json
          transaction_id?: string | null
          reference_number?: string | null
          notes?: string | null
          processed_at?: string | null
          paid_at?: string | null
          created_at?: string
          created_by?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_supplier_balance: {
        Args: {
          supplier_uuid: string
        }
        Returns: number
      }
      calculate_buyer_balance: {
        Args: {
          buyer_uuid: string
        }
        Returns: number
      }
      calculate_quality_score: {
        Args: {
          call_duration: number
          call_metadata?: Json
        }
        Returns: number
      }
      detect_fraud_indicators: {
        Args: {
          caller_number: string
          call_duration: number
          caller_location?: Json
          call_metadata?: Json
        }
        Returns: Json
      }
      find_matching_buyer_campaigns: {
        Args: {
          supplier_campaign_id: string
          caller_location?: Json
          call_time?: string
        }
        Returns: {
          buyer_campaign_id: string
          buyer_id: string
          max_bid: number
          match_score: number
        }[]
      }
      calculate_call_billing: {
        Args: {
          campaign_id: string
          buyer_campaign_id: string
          call_duration: number
          quality_score: number
        }
        Returns: Json
      }
      get_campaign_performance: {
        Args: {
          campaign_uuid: string
          start_date?: string
          end_date?: string
        }
        Returns: Json
      }
      validate_phone_number: {
        Args: {
          phone_number: string
        }
        Returns: boolean
      }
      validate_campaign_targeting: {
        Args: {
          targeting: Json
        }
        Returns: boolean
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
