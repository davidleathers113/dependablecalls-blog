export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          variables?: Json
          query?: string
          operationName?: string
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admins: {
        Row: {
          appointed_by: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          permissions: Json | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          appointed_by?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          permissions?: Json | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          appointed_by?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          permissions?: Json | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admins_appointed_by_fkey"
            columns: ["appointed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          created_at: string | null
          id: string
          ip_address: unknown | null
          new_data: Json | null
          old_data: Json | null
          operation: string
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_buyers: {
        Row: {
          blocked_at: string | null
          blocked_by: string | null
          buyer_id: string | null
          id: string
          reason: string
          status: string
          unblocked_at: string | null
          unblocked_by: string | null
        }
        Insert: {
          blocked_at?: string | null
          blocked_by?: string | null
          buyer_id?: string | null
          id?: string
          reason: string
          status?: string
          unblocked_at?: string | null
          unblocked_by?: string | null
        }
        Update: {
          blocked_at?: string | null
          blocked_by?: string | null
          buyer_id?: string | null
          id?: string
          reason?: string
          status?: string
          unblocked_at?: string | null
          unblocked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocked_buyers_blocked_by_fkey"
            columns: ["blocked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_buyers_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_buyers_unblocked_by_fkey"
            columns: ["unblocked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_authors: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string
          id: string
          social_links: Json | null
          storage_quota_mb: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name: string
          id?: string
          social_links?: Json | null
          storage_quota_mb?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string
          id?: string
          social_links?: Json | null
          storage_quota_mb?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_authors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_categories: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          name: string
          parent_id: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "blog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_comments: {
        Row: {
          content: string
          content_sanitized: string | null
          created_at: string | null
          id: string
          ip_address: unknown | null
          parent_id: string | null
          post_id: string | null
          status: string | null
          updated_at: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          content: string
          content_sanitized?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          parent_id?: string | null
          post_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string
          content_sanitized?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          parent_id?: string | null
          post_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "blog_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_categories: {
        Row: {
          category_id: string
          post_id: string
        }
        Insert: {
          category_id: string
          post_id: string
        }
        Update: {
          category_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "blog_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_post_categories_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_tags: {
        Row: {
          post_id: string
          tag_id: string
        }
        Insert: {
          post_id: string
          tag_id: string
        }
        Update: {
          post_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_post_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "blog_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string
          content: string
          content_sanitized: string | null
          created_at: string | null
          embedding: string | null
          excerpt: string | null
          featured_image_url: string | null
          id: string
          metadata: Json | null
          published_at: string | null
          reading_time_minutes: number | null
          search_vector: unknown | null
          slug: string
          status: string | null
          subtitle: string | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          author_id: string
          content: string
          content_sanitized?: string | null
          created_at?: string | null
          embedding?: string | null
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          metadata?: Json | null
          published_at?: string | null
          reading_time_minutes?: number | null
          search_vector?: unknown | null
          slug: string
          status?: string | null
          subtitle?: string | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          author_id?: string
          content?: string
          content_sanitized?: string | null
          created_at?: string | null
          embedding?: string | null
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          metadata?: Json | null
          published_at?: string | null
          reading_time_minutes?: number | null
          search_vector?: unknown | null
          slug?: string
          status?: string | null
          subtitle?: string | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "blog_authors"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_tags: {
        Row: {
          created_at: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      breach_detection_rules: {
        Row: {
          auto_response_actions: Json | null
          conditions: Json
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          rule_name: string
          rule_type: string
          severity: string | null
          updated_at: string | null
        }
        Insert: {
          auto_response_actions?: Json | null
          conditions: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          rule_name: string
          rule_type: string
          severity?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_response_actions?: Json | null
          conditions?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          rule_name?: string
          rule_type?: string
          severity?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      buyer_campaign_stats: {
        Row: {
          avg_cost: number | null
          avg_duration: number | null
          buyer_campaign_id: string | null
          calls_accepted: number | null
          calls_completed: number | null
          calls_received: number | null
          conversion_rate: number | null
          conversions: number | null
          created_at: string | null
          date: string
          hour: number | null
          id: string
          quality_score_avg: number | null
          total_cost: number | null
          total_duration: number | null
          updated_at: string | null
        }
        Insert: {
          avg_cost?: number | null
          avg_duration?: number | null
          buyer_campaign_id?: string | null
          calls_accepted?: number | null
          calls_completed?: number | null
          calls_received?: number | null
          conversion_rate?: number | null
          conversions?: number | null
          created_at?: string | null
          date: string
          hour?: number | null
          id?: string
          quality_score_avg?: number | null
          total_cost?: number | null
          total_duration?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_cost?: number | null
          avg_duration?: number | null
          buyer_campaign_id?: string | null
          calls_accepted?: number | null
          calls_completed?: number | null
          calls_received?: number | null
          conversion_rate?: number | null
          conversions?: number | null
          created_at?: string | null
          date?: string
          hour?: number | null
          id?: string
          quality_score_avg?: number | null
          total_cost?: number | null
          total_duration?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buyer_campaign_stats_buyer_campaign_id_fkey"
            columns: ["buyer_campaign_id"]
            isOneToOne: false
            referencedRelation: "buyer_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_campaigns: {
        Row: {
          auto_approval_enabled: boolean | null
          buyer_id: string | null
          created_at: string | null
          daily_budget: number | null
          daily_cap: number | null
          description: string | null
          exclude_suppliers: string[] | null
          id: string
          max_bid: number
          monthly_budget: number | null
          monthly_cap: number | null
          name: string
          preferred_suppliers: string[] | null
          quality_requirements: Json | null
          schedule: Json | null
          status: Database["public"]["Enums"]["campaign_status"] | null
          targeting_criteria: Json | null
          updated_at: string | null
        }
        Insert: {
          auto_approval_enabled?: boolean | null
          buyer_id?: string | null
          created_at?: string | null
          daily_budget?: number | null
          daily_cap?: number | null
          description?: string | null
          exclude_suppliers?: string[] | null
          id?: string
          max_bid: number
          monthly_budget?: number | null
          monthly_cap?: number | null
          name: string
          preferred_suppliers?: string[] | null
          quality_requirements?: Json | null
          schedule?: Json | null
          status?: Database["public"]["Enums"]["campaign_status"] | null
          targeting_criteria?: Json | null
          updated_at?: string | null
        }
        Update: {
          auto_approval_enabled?: boolean | null
          buyer_id?: string | null
          created_at?: string | null
          daily_budget?: number | null
          daily_cap?: number | null
          description?: string | null
          exclude_suppliers?: string[] | null
          id?: string
          max_bid?: number
          monthly_budget?: number | null
          monthly_cap?: number | null
          name?: string
          preferred_suppliers?: string[] | null
          quality_requirements?: Json | null
          schedule?: Json | null
          status?: Database["public"]["Enums"]["campaign_status"] | null
          targeting_criteria?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buyer_campaigns_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
        ]
      }
      buyers: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          auto_recharge_amount: number | null
          auto_recharge_enabled: boolean | null
          auto_recharge_threshold: number | null
          business_type: string | null
          company_name: string
          created_at: string | null
          credit_limit: number | null
          current_balance: number | null
          id: string
          settings: Json | null
          settings_updated_at: string | null
          status: Database["public"]["Enums"]["user_status"] | null
          tax_id: string | null
          tax_id_search_hash: string | null
          updated_at: string | null
          user_id: string | null
          verification_data: Json | null
          website_url: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          auto_recharge_amount?: number | null
          auto_recharge_enabled?: boolean | null
          auto_recharge_threshold?: number | null
          business_type?: string | null
          company_name: string
          created_at?: string | null
          credit_limit?: number | null
          current_balance?: number | null
          id?: string
          settings?: Json | null
          settings_updated_at?: string | null
          status?: Database["public"]["Enums"]["user_status"] | null
          tax_id?: string | null
          tax_id_search_hash?: string | null
          updated_at?: string | null
          user_id?: string | null
          verification_data?: Json | null
          website_url?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          auto_recharge_amount?: number | null
          auto_recharge_enabled?: boolean | null
          auto_recharge_threshold?: number | null
          business_type?: string | null
          company_name?: string
          created_at?: string | null
          credit_limit?: number | null
          current_balance?: number | null
          id?: string
          settings?: Json | null
          settings_updated_at?: string | null
          status?: Database["public"]["Enums"]["user_status"] | null
          tax_id?: string | null
          tax_id_search_hash?: string | null
          updated_at?: string | null
          user_id?: string | null
          verification_data?: Json | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buyers_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          call_id: string | null
          event_data: Json | null
          event_type: string
          id: string
          timestamp: string | null
        }
        Insert: {
          call_id?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          timestamp?: string | null
        }
        Update: {
          call_id?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_quality_scores: {
        Row: {
          call_id: string | null
          content_score: number | null
          created_at: string | null
          duration_score: number | null
          flags: Json | null
          id: string
          intent_score: number | null
          notes: string | null
          overall_score: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          scoring_model: string | null
          technical_score: number | null
        }
        Insert: {
          call_id?: string | null
          content_score?: number | null
          created_at?: string | null
          duration_score?: number | null
          flags?: Json | null
          id?: string
          intent_score?: number | null
          notes?: string | null
          overall_score?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scoring_model?: string | null
          technical_score?: number | null
        }
        Update: {
          call_id?: string | null
          content_score?: number | null
          created_at?: string | null
          duration_score?: number | null
          flags?: Json | null
          id?: string
          intent_score?: number | null
          notes?: string | null
          overall_score?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scoring_model?: string | null
          technical_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "call_quality_scores_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_quality_scores_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          answered_at: string | null
          billable_seconds: number | null
          buyer_campaign_id: string | null
          call_flow: Json | null
          caller_location: Json | null
          caller_number: string
          caller_number_search_hash: string | null
          campaign_id: string | null
          charge_amount: number | null
          created_at: string | null
          destination_number: string | null
          destination_number_search_hash: string | null
          disposition: string | null
          duration_seconds: number | null
          ended_at: string | null
          external_id: string | null
          fraud_score: number | null
          id: string
          last_synced_at: string | null
          margin_amount: number | null
          metadata: Json | null
          payout_amount: number | null
          provider: string | null
          provider_data: Json | null
          quality_score: number | null
          recording_duration: number | null
          recording_url: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["call_status"] | null
          tracking_number: string
          updated_at: string | null
        }
        Insert: {
          answered_at?: string | null
          billable_seconds?: number | null
          buyer_campaign_id?: string | null
          call_flow?: Json | null
          caller_location?: Json | null
          caller_number: string
          caller_number_search_hash?: string | null
          campaign_id?: string | null
          charge_amount?: number | null
          created_at?: string | null
          destination_number?: string | null
          destination_number_search_hash?: string | null
          disposition?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          external_id?: string | null
          fraud_score?: number | null
          id?: string
          last_synced_at?: string | null
          margin_amount?: number | null
          metadata?: Json | null
          payout_amount?: number | null
          provider?: string | null
          provider_data?: Json | null
          quality_score?: number | null
          recording_duration?: number | null
          recording_url?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["call_status"] | null
          tracking_number: string
          updated_at?: string | null
        }
        Update: {
          answered_at?: string | null
          billable_seconds?: number | null
          buyer_campaign_id?: string | null
          call_flow?: Json | null
          caller_location?: Json | null
          caller_number?: string
          caller_number_search_hash?: string | null
          campaign_id?: string | null
          charge_amount?: number | null
          created_at?: string | null
          destination_number?: string | null
          destination_number_search_hash?: string | null
          disposition?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          external_id?: string | null
          fraud_score?: number | null
          id?: string
          last_synced_at?: string | null
          margin_amount?: number | null
          metadata?: Json | null
          payout_amount?: number | null
          provider?: string | null
          provider_data?: Json | null
          quality_score?: number | null
          recording_duration?: number | null
          recording_url?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["call_status"] | null
          tracking_number?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_buyer_campaign_id_fkey"
            columns: ["buyer_campaign_id"]
            isOneToOne: false
            referencedRelation: "buyer_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_stats: {
        Row: {
          avg_duration: number | null
          avg_payout: number | null
          calls_count: number | null
          campaign_id: string | null
          completed_calls: number | null
          connected_calls: number | null
          conversion_rate: number | null
          created_at: string | null
          date: string
          hour: number | null
          id: string
          quality_score_avg: number | null
          total_duration: number | null
          total_payout: number | null
          updated_at: string | null
        }
        Insert: {
          avg_duration?: number | null
          avg_payout?: number | null
          calls_count?: number | null
          campaign_id?: string | null
          completed_calls?: number | null
          connected_calls?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          date: string
          hour?: number | null
          id?: string
          quality_score_avg?: number | null
          total_duration?: number | null
          total_payout?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_duration?: number | null
          avg_payout?: number | null
          calls_count?: number | null
          campaign_id?: string | null
          completed_calls?: number | null
          connected_calls?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          date?: string
          hour?: number | null
          id?: string
          quality_score_avg?: number | null
          total_duration?: number | null
          total_payout?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_stats_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          bid_floor: number
          call_timeout_seconds: number | null
          category: string | null
          created_at: string | null
          daily_cap: number | null
          description: string | null
          fraud_detection_enabled: boolean | null
          id: string
          max_concurrent_calls: number | null
          monthly_cap: number | null
          name: string
          quality_threshold: number | null
          recording_enabled: boolean | null
          routing_rules: Json | null
          schedule: Json | null
          status: Database["public"]["Enums"]["campaign_status"] | null
          supplier_id: string | null
          targeting: Json | null
          tracking_numbers: Json | null
          updated_at: string | null
          vertical: string | null
        }
        Insert: {
          bid_floor?: number
          call_timeout_seconds?: number | null
          category?: string | null
          created_at?: string | null
          daily_cap?: number | null
          description?: string | null
          fraud_detection_enabled?: boolean | null
          id?: string
          max_concurrent_calls?: number | null
          monthly_cap?: number | null
          name: string
          quality_threshold?: number | null
          recording_enabled?: boolean | null
          routing_rules?: Json | null
          schedule?: Json | null
          status?: Database["public"]["Enums"]["campaign_status"] | null
          supplier_id?: string | null
          targeting?: Json | null
          tracking_numbers?: Json | null
          updated_at?: string | null
          vertical?: string | null
        }
        Update: {
          bid_floor?: number
          call_timeout_seconds?: number | null
          category?: string | null
          created_at?: string | null
          daily_cap?: number | null
          description?: string | null
          fraud_detection_enabled?: boolean | null
          id?: string
          max_concurrent_calls?: number | null
          monthly_cap?: number | null
          name?: string
          quality_threshold?: number | null
          recording_enabled?: boolean | null
          routing_rules?: Json | null
          schedule?: Json | null
          status?: Database["public"]["Enums"]["campaign_status"] | null
          supplier_id?: string | null
          targeting?: Json | null
          tracking_numbers?: Json | null
          updated_at?: string | null
          vertical?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_audit_logs: {
        Row: {
          data_affected: string[]
          error: string | null
          executed_by: string
          id: string
          legal_basis: string
          operation: string
          subject_id: string
          success: boolean
          timestamp: string
        }
        Insert: {
          data_affected: string[]
          error?: string | null
          executed_by: string
          id?: string
          legal_basis: string
          operation: string
          subject_id: string
          success: boolean
          timestamp?: string
        }
        Update: {
          data_affected?: string[]
          error?: string | null
          executed_by?: string
          id?: string
          legal_basis?: string
          operation?: string
          subject_id?: string
          success?: boolean
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_audit_logs_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_audit_logs_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_anomalies: {
        Row: {
          anomaly_type: string
          connection_data: Json | null
          description: string | null
          detected_at: string | null
          id: string
          is_resolved: boolean | null
          resolved_at: string | null
          severity: string | null
          user_id: string | null
        }
        Insert: {
          anomaly_type: string
          connection_data?: Json | null
          description?: string | null
          detected_at?: string | null
          id?: string
          is_resolved?: boolean | null
          resolved_at?: string | null
          severity?: string | null
          user_id?: string | null
        }
        Update: {
          anomaly_type?: string
          connection_data?: Json | null
          description?: string | null
          detected_at?: string | null
          id?: string
          is_resolved?: boolean | null
          resolved_at?: string | null
          severity?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connection_anomalies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          reference_id: string | null
          transaction_type: string
          user_id: string | null
          user_type: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          transaction_type: string
          user_id?: string | null
          user_type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          transaction_type?: string
          user_id?: string | null
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      data_access_audit: {
        Row: {
          access_method: string | null
          classification_level: string | null
          column_names: string[] | null
          created_at: string | null
          id: string
          justification: string | null
          new_values: Json | null
          old_values: Json | null
          operation: string
          record_ids: string[] | null
          session_context: Json | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          access_method?: string | null
          classification_level?: string | null
          column_names?: string[] | null
          created_at?: string | null
          id?: string
          justification?: string | null
          new_values?: Json | null
          old_values?: Json | null
          operation: string
          record_ids?: string[] | null
          session_context?: Json | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          access_method?: string | null
          classification_level?: string | null
          column_names?: string[] | null
          created_at?: string | null
          id?: string
          justification?: string | null
          new_values?: Json | null
          old_values?: Json | null
          operation?: string
          record_ids?: string[] | null
          session_context?: Json | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_access_audit_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      data_access_logs: {
        Row: {
          business_purpose: string
          client_ip: unknown | null
          context: Json
          field_name: string
          id: string
          operation: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          business_purpose: string
          client_ip?: unknown | null
          context: Json
          field_name: string
          id?: string
          operation: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          business_purpose?: string
          client_ip?: unknown | null
          context?: Json
          field_name?: string
          id?: string
          operation?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_access_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      data_classification_rules: {
        Row: {
          access_restrictions: Json | null
          classification_level: string
          classification_reason: string | null
          column_name: string | null
          created_at: string | null
          encryption_required: boolean | null
          id: string
          masking_rules: Json | null
          retention_period: unknown | null
          table_name: string
          updated_at: string | null
        }
        Insert: {
          access_restrictions?: Json | null
          classification_level: string
          classification_reason?: string | null
          column_name?: string | null
          created_at?: string | null
          encryption_required?: boolean | null
          id?: string
          masking_rules?: Json | null
          retention_period?: unknown | null
          table_name: string
          updated_at?: string | null
        }
        Update: {
          access_restrictions?: Json | null
          classification_level?: string
          classification_reason?: string | null
          column_name?: string | null
          created_at?: string | null
          encryption_required?: boolean | null
          id?: string
          masking_rules?: Json | null
          retention_period?: unknown | null
          table_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      data_subject_requests: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          id: string
          reason: string | null
          request_id: string
          request_type: string
          requested_at: string
          requested_by: string
          requested_fields: string[] | null
          response_data: Json | null
          status: string
          subject_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          id?: string
          reason?: string | null
          request_id: string
          request_type: string
          requested_at?: string
          requested_by: string
          requested_fields?: string[] | null
          response_data?: Json | null
          status?: string
          subject_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          id?: string
          reason?: string | null
          request_id?: string
          request_type?: string
          requested_at?: string
          requested_by?: string
          requested_fields?: string[] | null
          response_data?: Json | null
          status?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_subject_requests_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_subject_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_subject_requests_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      database_connections: {
        Row: {
          application_name: string | null
          backend_start: string | null
          client_addr: unknown | null
          client_hostname: string | null
          client_port: number | null
          connection_id: number | null
          created_at: string | null
          database_name: string | null
          id: string
          is_ssl: boolean | null
          query: string | null
          query_start: string | null
          ssl_cipher: string | null
          ssl_version: string | null
          state: string | null
          state_change: string | null
          user_id: string | null
          username: string | null
          wait_event: string | null
          wait_event_type: string | null
        }
        Insert: {
          application_name?: string | null
          backend_start?: string | null
          client_addr?: unknown | null
          client_hostname?: string | null
          client_port?: number | null
          connection_id?: number | null
          created_at?: string | null
          database_name?: string | null
          id?: string
          is_ssl?: boolean | null
          query?: string | null
          query_start?: string | null
          ssl_cipher?: string | null
          ssl_version?: string | null
          state?: string | null
          state_change?: string | null
          user_id?: string | null
          username?: string | null
          wait_event?: string | null
          wait_event_type?: string | null
        }
        Update: {
          application_name?: string | null
          backend_start?: string | null
          client_addr?: unknown | null
          client_hostname?: string | null
          client_port?: number | null
          connection_id?: number | null
          created_at?: string | null
          database_name?: string | null
          id?: string
          is_ssl?: boolean | null
          query?: string | null
          query_start?: string | null
          ssl_cipher?: string | null
          ssl_version?: string | null
          state?: string | null
          state_change?: string | null
          user_id?: string | null
          username?: string | null
          wait_event?: string | null
          wait_event_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "database_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          amount_disputed: number | null
          assigned_to: string | null
          call_id: string | null
          created_at: string | null
          description: string | null
          dispute_type: string
          evidence: Json | null
          id: string
          priority: string | null
          raised_by: string | null
          reason: string
          resolution: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["dispute_status"] | null
          updated_at: string | null
        }
        Insert: {
          amount_disputed?: number | null
          assigned_to?: string | null
          call_id?: string | null
          created_at?: string | null
          description?: string | null
          dispute_type: string
          evidence?: Json | null
          id?: string
          priority?: string | null
          raised_by?: string | null
          reason: string
          resolution?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"] | null
          updated_at?: string | null
        }
        Update: {
          amount_disputed?: number | null
          assigned_to?: string | null
          call_id?: string | null
          created_at?: string | null
          description?: string | null
          dispute_type?: string
          evidence?: Json | null
          id?: string
          priority?: string | null
          raised_by?: string | null
          reason?: string
          resolution?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disputes_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      encryption_audit_logs: {
        Row: {
          context: Json
          error: string | null
          field_name: string
          id: string
          key_id: string | null
          log_id: string
          operation: string
          performance_ms: number | null
          record_id: string
          success: boolean
          table_name: string
          timestamp: string
          user_id: string | null
        }
        Insert: {
          context: Json
          error?: string | null
          field_name: string
          id?: string
          key_id?: string | null
          log_id: string
          operation: string
          performance_ms?: number | null
          record_id: string
          success: boolean
          table_name: string
          timestamp?: string
          user_id?: string | null
        }
        Update: {
          context?: Json
          error?: string | null
          field_name?: string
          id?: string
          key_id?: string | null
          log_id?: string
          operation?: string
          performance_ms?: number | null
          record_id?: string
          success?: boolean
          table_name?: string
          timestamp?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "encryption_audit_logs_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "encryption_key_status"
            referencedColumns: ["key_id"]
          },
          {
            foreignKeyName: "encryption_audit_logs_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "encryption_keys"
            referencedColumns: ["key_id"]
          },
          {
            foreignKeyName: "encryption_audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      encryption_keys: {
        Row: {
          algorithm: string
          created_at: string
          deactivated_at: string | null
          deactivation_reason: string | null
          derivation_function: string
          expires_at: string
          id: string
          is_active: boolean
          key_id: string
          key_type: string
          rotated_from_key_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          algorithm?: string
          created_at?: string
          deactivated_at?: string | null
          deactivation_reason?: string | null
          derivation_function?: string
          expires_at: string
          id?: string
          is_active?: boolean
          key_id: string
          key_type?: string
          rotated_from_key_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          algorithm?: string
          created_at?: string
          deactivated_at?: string | null
          deactivation_reason?: string | null
          derivation_function?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          key_id?: string
          key_type?: string
          rotated_from_key_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      fraud_alerts: {
        Row: {
          alert_type: string
          buyer_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          resolved_at: string | null
          resolved_by: string | null
          risk_score: number
          status: string
        }
        Insert: {
          alert_type: string
          buyer_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          risk_score: number
          status?: string
        }
        Update: {
          alert_type?: string
          buyer_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          risk_score?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fraud_alerts_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_assessments: {
        Row: {
          amount: number
          assessed_at: string | null
          blocked: boolean
          buyer_id: string | null
          id: string
          payment_transaction_id: string | null
          reasons: string[] | null
          risk_level: string
          risk_score: number
        }
        Insert: {
          amount: number
          assessed_at?: string | null
          blocked?: boolean
          buyer_id?: string | null
          id?: string
          payment_transaction_id?: string | null
          reasons?: string[] | null
          risk_level: string
          risk_score: number
        }
        Update: {
          amount?: number
          assessed_at?: string | null
          blocked?: boolean
          buyer_id?: string | null
          id?: string
          payment_transaction_id?: string | null
          reasons?: string[] | null
          risk_level?: string
          risk_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "fraud_assessments_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_assessments_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          call_id: string | null
          created_at: string | null
          description: string
          id: string
          invoice_id: string | null
          metadata: Json | null
          quantity: number | null
          total_amount: number
          unit_price: number
        }
        Insert: {
          call_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          quantity?: number | null
          total_amount: number
          unit_price: number
        }
        Update: {
          call_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          quantity?: number | null
          total_amount?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          buyer_id: string | null
          created_at: string | null
          due_date: string
          id: string
          invoice_number: string
          metadata: Json | null
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          payment_terms: number | null
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["invoice_status"] | null
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          tax_amount: number | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          amount: number
          buyer_id?: string | null
          created_at?: string | null
          due_date: string
          id?: string
          invoice_number: string
          metadata?: Json | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_terms?: number | null
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["invoice_status"] | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          tax_amount?: number | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          amount?: number
          buyer_id?: string | null
          created_at?: string | null
          due_date?: string
          id?: string
          invoice_number?: string
          metadata?: Json | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_terms?: number | null
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["invoice_status"] | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          tax_amount?: number | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
        ]
      }
      key_rotations: {
        Row: {
          created_at: string
          error: string | null
          id: string
          new_key_id: string
          old_key_id: string
          records_migrated: number
          rotation_completed: string | null
          rotation_id: string
          rotation_started: string
          status: string
          total_records: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          new_key_id: string
          old_key_id: string
          records_migrated?: number
          rotation_completed?: string | null
          rotation_id: string
          rotation_started?: string
          status?: string
          total_records?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          new_key_id?: string
          old_key_id?: string
          records_migrated?: number
          rotation_completed?: string | null
          rotation_id?: string
          rotation_started?: string
          status?: string
          total_records?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "key_rotations_new_key_id_fkey"
            columns: ["new_key_id"]
            isOneToOne: false
            referencedRelation: "encryption_key_status"
            referencedColumns: ["key_id"]
          },
          {
            foreignKeyName: "key_rotations_new_key_id_fkey"
            columns: ["new_key_id"]
            isOneToOne: false
            referencedRelation: "encryption_keys"
            referencedColumns: ["key_id"]
          },
          {
            foreignKeyName: "key_rotations_old_key_id_fkey"
            columns: ["old_key_id"]
            isOneToOne: false
            referencedRelation: "encryption_key_status"
            referencedColumns: ["key_id"]
          },
          {
            foreignKeyName: "key_rotations_old_key_id_fkey"
            columns: ["old_key_id"]
            isOneToOne: false
            referencedRelation: "encryption_keys"
            referencedColumns: ["key_id"]
          },
        ]
      }
      mfa_attempts: {
        Row: {
          created_at: string
          error_code: string | null
          id: string
          ip_address: unknown
          metadata: Json
          method: string
          success: boolean
          user_agent: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          id?: string
          ip_address: unknown
          metadata?: Json
          method: string
          success: boolean
          user_agent: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_code?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json
          method?: string
          success?: boolean
          user_agent?: string
          user_id?: string | null
        }
        Relationships: []
      }
      mfa_audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json
          id: string
          ip_address: unknown
          method: string | null
          risk_score: number
          success: boolean
          user_agent: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          id?: string
          ip_address: unknown
          method?: string | null
          risk_score?: number
          success: boolean
          user_agent: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          id?: string
          ip_address?: unknown
          method?: string | null
          risk_score?: number
          success?: boolean
          user_agent?: string
          user_id?: string | null
        }
        Relationships: []
      }
      mfa_backup_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mfa_secrets: {
        Row: {
          backup_codes_encrypted: string[]
          created_at: string
          id: string
          is_active: boolean
          secret_encrypted: string
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          backup_codes_encrypted?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          secret_encrypted: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          backup_codes_encrypted?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          secret_encrypted?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      mfa_settings: {
        Row: {
          backup_codes_generated: boolean
          created_at: string
          last_backup_codes_viewed: string | null
          require_mfa: boolean
          sms_backup_enabled: boolean
          sms_rate_limit_count: number
          sms_rate_limit_reset_at: string
          totp_enabled: boolean
          trusted_devices_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          backup_codes_generated?: boolean
          created_at?: string
          last_backup_codes_viewed?: string | null
          require_mfa?: boolean
          sms_backup_enabled?: boolean
          sms_rate_limit_count?: number
          sms_rate_limit_reset_at?: string
          totp_enabled?: boolean
          trusted_devices_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          backup_codes_generated?: boolean
          created_at?: string
          last_backup_codes_viewed?: string | null
          require_mfa?: boolean
          sms_backup_enabled?: boolean
          sms_rate_limit_count?: number
          sms_rate_limit_reset_at?: string
          totp_enabled?: boolean
          trusted_devices_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mfa_sms_verifications: {
        Row: {
          attempts: number
          created_at: string
          expires_at: string
          id: string
          phone_number_encrypted: string
          user_id: string
          verification_code_hash: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          expires_at: string
          id?: string
          phone_number_encrypted: string
          user_id: string
          verification_code_hash: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          expires_at?: string
          id?: string
          phone_number_encrypted?: string
          user_id?: string
          verification_code_hash?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      mfa_trusted_devices: {
        Row: {
          created_at: string
          device_fingerprint: string
          device_name: string
          id: string
          ip_address: unknown
          is_active: boolean
          last_used_at: string
          trusted_until: string
          user_agent: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_fingerprint: string
          device_name: string
          id?: string
          ip_address: unknown
          is_active?: boolean
          last_used_at?: string
          trusted_until: string
          user_agent: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_fingerprint?: string
          device_name?: string
          id?: string
          ip_address?: unknown
          is_active?: boolean
          last_used_at?: string
          trusted_until?: string
          user_agent?: string
          user_id?: string
        }
        Relationships: []
      }
      migration_logs: {
        Row: {
          completed_at: string | null
          encrypted_fields: number
          errors: string[] | null
          id: string
          migration_id: string
          processed_records: number
          started_at: string
          status: string
          table_name: string
          total_records: number
        }
        Insert: {
          completed_at?: string | null
          encrypted_fields?: number
          errors?: string[] | null
          id?: string
          migration_id: string
          processed_records?: number
          started_at?: string
          status?: string
          table_name: string
          total_records?: number
        }
        Update: {
          completed_at?: string | null
          encrypted_fields?: number
          errors?: string[] | null
          id?: string
          migration_id?: string
          processed_records?: number
          started_at?: string
          status?: string
          table_name?: string
          total_records?: number
        }
        Relationships: []
      }
      networks: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          business_type: string | null
          company_name: string
          created_at: string | null
          id: string
          settings: Json | null
          settings_updated_at: string | null
          status: string | null
          tax_id: string | null
          updated_at: string | null
          user_id: string | null
          verification_data: Json | null
          website_url: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          business_type?: string | null
          company_name: string
          created_at?: string | null
          id?: string
          settings?: Json | null
          settings_updated_at?: string | null
          status?: string | null
          tax_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          verification_data?: Json | null
          website_url?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          business_type?: string | null
          company_name?: string
          created_at?: string | null
          id?: string
          settings?: Json | null
          settings_updated_at?: string | null
          status?: string | null
          tax_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          verification_data?: Json | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "networks_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "networks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_method_security: {
        Row: {
          buyer_id: string | null
          card_brand: string | null
          created_at: string | null
          failure_count: number | null
          id: string
          is_blocked: boolean | null
          last_failure_at: string | null
          last_four: string | null
          risk_score: number | null
          stripe_payment_method_id: string
          updated_at: string | null
        }
        Insert: {
          buyer_id?: string | null
          card_brand?: string | null
          created_at?: string | null
          failure_count?: number | null
          id?: string
          is_blocked?: boolean | null
          last_failure_at?: string | null
          last_four?: string | null
          risk_score?: number | null
          stripe_payment_method_id: string
          updated_at?: string | null
        }
        Update: {
          buyer_id?: string | null
          card_brand?: string | null
          created_at?: string | null
          failure_count?: number | null
          id?: string
          is_blocked?: boolean | null
          last_failure_at?: string | null
          last_four?: string | null
          risk_score?: number | null
          stripe_payment_method_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_method_security_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          buyer_id: string | null
          campaign_id: string | null
          created_at: string | null
          currency: string
          failure_code: string | null
          failure_message: string | null
          id: string
          metadata: Json | null
          payment_method: string | null
          status: string
          stripe_payment_intent_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          buyer_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          status: string
          stripe_payment_intent_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          buyer_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          status?: string
          stripe_payment_intent_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          fee_amount: number | null
          id: string
          net_amount: number
          notes: string | null
          paid_at: string | null
          payment_details: Json | null
          payment_method: string | null
          period_end: string
          period_start: string
          processed_at: string | null
          reference_number: string | null
          status: Database["public"]["Enums"]["payout_status"] | null
          supplier_id: string | null
          transaction_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          fee_amount?: number | null
          id?: string
          net_amount: number
          notes?: string | null
          paid_at?: string | null
          payment_details?: Json | null
          payment_method?: string | null
          period_end: string
          period_start: string
          processed_at?: string | null
          reference_number?: string | null
          status?: Database["public"]["Enums"]["payout_status"] | null
          supplier_id?: string | null
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          fee_amount?: number | null
          id?: string
          net_amount?: number
          notes?: string | null
          paid_at?: string | null
          payment_details?: Json | null
          payment_method?: string | null
          period_end?: string
          period_start?: string
          processed_at?: string | null
          reference_number?: string | null
          status?: Database["public"]["Enums"]["payout_status"] | null
          supplier_id?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payouts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      pci_compliance_logs: {
        Row: {
          assessment_date: string | null
          assessor: string | null
          control_name: string
          evidence: Json | null
          id: string
          next_review_date: string | null
          notes: string | null
          requirement: string
          status: string
        }
        Insert: {
          assessment_date?: string | null
          assessor?: string | null
          control_name: string
          evidence?: Json | null
          id?: string
          next_review_date?: string | null
          notes?: string | null
          requirement: string
          status: string
        }
        Update: {
          assessment_date?: string | null
          assessor?: string | null
          control_name?: string
          evidence?: Json | null
          id?: string
          next_review_date?: string | null
          notes?: string | null
          requirement?: string
          status?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          action: string
          conditions: Json | null
          created_at: string | null
          description: string | null
          id: string
          resource: string
          updated_at: string | null
        }
        Insert: {
          action: string
          conditions?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          resource: string
          updated_at?: string | null
        }
        Update: {
          action?: string
          conditions?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          resource?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      provider_configs: {
        Row: {
          api_base_url: string | null
          created_at: string | null
          credentials: Json
          features: Json | null
          id: string
          is_active: boolean | null
          name: string
          provider_type: string
          rate_limits: Json | null
          settings: Json | null
          updated_at: string | null
          webhook_url: string | null
        }
        Insert: {
          api_base_url?: string | null
          created_at?: string | null
          credentials: Json
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          provider_type: string
          rate_limits?: Json | null
          settings?: Json | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_base_url?: string | null
          created_at?: string | null
          credentials?: Json
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          provider_type?: string
          rate_limits?: Json | null
          settings?: Json | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      provider_tracking_numbers: {
        Row: {
          campaign_id: string | null
          capabilities: Json | null
          created_at: string | null
          external_id: string | null
          id: string
          metadata: Json | null
          number: string
          provider: string
          provisioned_at: string | null
          released_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          campaign_id?: string | null
          capabilities?: Json | null
          created_at?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json | null
          number: string
          provider: string
          provisioned_at?: string | null
          released_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string | null
          capabilities?: Json | null
          created_at?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json | null
          number?: string
          provider?: string
          provisioned_at?: string | null
          released_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_tracking_numbers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      query_security_analysis: {
        Row: {
          detected_at: string | null
          execution_time: unknown | null
          id: string
          is_blocked: boolean | null
          normalized_query: string | null
          query_hash: string
          raw_query: string
          risk_score: number | null
          rows_affected: number | null
          security_flags: Json | null
          tables_accessed: string[] | null
          user_id: string | null
        }
        Insert: {
          detected_at?: string | null
          execution_time?: unknown | null
          id?: string
          is_blocked?: boolean | null
          normalized_query?: string | null
          query_hash: string
          raw_query: string
          risk_score?: number | null
          rows_affected?: number | null
          security_flags?: Json | null
          tables_accessed?: string[] | null
          user_id?: string | null
        }
        Update: {
          detected_at?: string | null
          execution_time?: unknown | null
          id?: string
          is_blocked?: boolean | null
          normalized_query?: string | null
          query_hash?: string
          raw_query?: string
          risk_score?: number | null
          rows_affected?: number | null
          security_flags?: Json | null
          tables_accessed?: string[] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "query_security_analysis_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          permissions: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          permissions?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          permissions?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          action: string | null
          created_at: string | null
          error_message: string | null
          event_data: Json | null
          event_type: string
          id: string
          ip_address: unknown | null
          outcome: string | null
          resource_id: string | null
          resource_type: string | null
          risk_level: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          error_message?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown | null
          outcome?: string | null
          resource_id?: string | null
          resource_type?: string | null
          risk_level?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          error_message?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown | null
          outcome?: string | null
          resource_id?: string | null
          resource_type?: string | null
          risk_level?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      security_contexts: {
        Row: {
          created_at: string | null
          device_fingerprint: string | null
          expires_at: string | null
          geo_location: Json | null
          id: string
          ip_address: unknown
          is_active: boolean | null
          risk_score: number | null
          session_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          device_fingerprint?: string | null
          expires_at?: string | null
          geo_location?: Json | null
          id?: string
          ip_address: unknown
          is_active?: boolean | null
          risk_score?: number | null
          session_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          device_fingerprint?: string | null
          expires_at?: string | null
          geo_location?: Json | null
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          risk_score?: number | null
          session_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_contexts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      security_incidents: {
        Row: {
          affected_resources: Json | null
          affected_users: string[] | null
          assigned_to: string | null
          client_ip: unknown | null
          created_at: string | null
          description: string | null
          detection_method: string | null
          detector_id: string | null
          evidence: Json | null
          field_name: string | null
          id: string
          incident_type: string
          key_id: string | null
          record_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          response_actions: Json | null
          severity: string | null
          status: string | null
          table_name: string | null
          title: string
          updated_at: string | null
          user_agent: string | null
        }
        Insert: {
          affected_resources?: Json | null
          affected_users?: string[] | null
          assigned_to?: string | null
          client_ip?: unknown | null
          created_at?: string | null
          description?: string | null
          detection_method?: string | null
          detector_id?: string | null
          evidence?: Json | null
          field_name?: string | null
          id?: string
          incident_type: string
          key_id?: string | null
          record_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          response_actions?: Json | null
          severity?: string | null
          status?: string | null
          table_name?: string | null
          title: string
          updated_at?: string | null
          user_agent?: string | null
        }
        Update: {
          affected_resources?: Json | null
          affected_users?: string[] | null
          assigned_to?: string | null
          client_ip?: unknown | null
          created_at?: string | null
          description?: string | null
          detection_method?: string | null
          detector_id?: string | null
          evidence?: Json | null
          field_name?: string | null
          id?: string
          incident_type?: string
          key_id?: string | null
          record_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          response_actions?: Json | null
          severity?: string | null
          status?: string | null
          table_name?: string | null
          title?: string
          updated_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_incidents_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_incidents_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "encryption_key_status"
            referencedColumns: ["key_id"]
          },
          {
            foreignKeyName: "security_incidents_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "encryption_keys"
            referencedColumns: ["key_id"]
          },
        ]
      }
      security_logs: {
        Row: {
          buyer_id: string | null
          details: Json | null
          event_type: string
          id: string
          ip_address: unknown | null
          risk_level: string
          source: string | null
          timestamp: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          buyer_id?: string | null
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown | null
          risk_level: string
          source?: string | null
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          buyer_id?: string | null
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown | null
          risk_level?: string
          source?: string | null
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      service_account_access_log: {
        Row: {
          access_granted: boolean
          action: string
          created_at: string | null
          denial_reason: string | null
          function_name: string
          id: string
          ip_address: unknown | null
          request_context: Json | null
          resource: string
          service_account_id: string | null
          user_agent: string | null
        }
        Insert: {
          access_granted: boolean
          action: string
          created_at?: string | null
          denial_reason?: string | null
          function_name: string
          id?: string
          ip_address?: unknown | null
          request_context?: Json | null
          resource: string
          service_account_id?: string | null
          user_agent?: string | null
        }
        Update: {
          access_granted?: boolean
          action?: string
          created_at?: string | null
          denial_reason?: string | null
          function_name?: string
          id?: string
          ip_address?: unknown | null
          request_context?: Json | null
          resource?: string
          service_account_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_account_access_log_service_account_id_fkey"
            columns: ["service_account_id"]
            isOneToOne: false
            referencedRelation: "service_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      service_accounts: {
        Row: {
          api_key_hash: string
          created_at: string | null
          description: string | null
          expires_at: string | null
          function_names: string[]
          id: string
          is_active: boolean | null
          last_used_at: string | null
          name: string
          permissions: Json
          rotation_due_at: string
          updated_at: string | null
        }
        Insert: {
          api_key_hash: string
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          function_names?: string[]
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name: string
          permissions?: Json
          rotation_due_at: string
          updated_at?: string | null
        }
        Update: {
          api_key_hash?: string
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          function_names?: string[]
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name?: string
          permissions?: Json
          rotation_due_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      settings_audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown | null
          metadata: Json | null
          new_value: Json | null
          old_value: Json | null
          setting_key: string
          setting_type: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
          setting_key: string
          setting_type: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
          setting_key?: string
          setting_type?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settings_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      settings_templates: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          settings: Json
          updated_at: string | null
          user_type: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          settings: Json
          updated_at?: string | null
          user_type: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          settings?: Json
          updated_at?: string | null
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "settings_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          business_type: string | null
          company_name: string
          created_at: string | null
          credit_balance: number | null
          id: string
          minimum_payout: number | null
          payout_frequency: string | null
          settings: Json | null
          settings_updated_at: string | null
          status: Database["public"]["Enums"]["user_status"] | null
          tax_id: string | null
          tax_id_search_hash: string | null
          updated_at: string | null
          user_id: string | null
          verification_data: Json | null
          website_url: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          business_type?: string | null
          company_name: string
          created_at?: string | null
          credit_balance?: number | null
          id?: string
          minimum_payout?: number | null
          payout_frequency?: string | null
          settings?: Json | null
          settings_updated_at?: string | null
          status?: Database["public"]["Enums"]["user_status"] | null
          tax_id?: string | null
          tax_id_search_hash?: string | null
          updated_at?: string | null
          user_id?: string | null
          verification_data?: Json | null
          website_url?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          business_type?: string | null
          company_name?: string
          created_at?: string | null
          credit_balance?: number | null
          id?: string
          minimum_payout?: number | null
          payout_frequency?: string | null
          settings?: Json | null
          settings_updated_at?: string | null
          status?: Database["public"]["Enums"]["user_status"] | null
          tax_id?: string | null
          tax_id_search_hash?: string | null
          updated_at?: string | null
          user_id?: string | null
          verification_data?: Json | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_status: {
        Row: {
          created_at: string | null
          error_details: string | null
          id: string
          last_successful_sync_at: string | null
          last_sync_at: string | null
          provider: string
          records_failed: number | null
          records_synced: number | null
          status: string | null
          sync_duration: number | null
          sync_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_details?: string | null
          id?: string
          last_successful_sync_at?: string | null
          last_sync_at?: string | null
          provider: string
          records_failed?: number | null
          records_synced?: number | null
          status?: string | null
          sync_duration?: number | null
          sync_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_details?: string | null
          id?: string
          last_successful_sync_at?: string | null
          last_sync_at?: string | null
          provider?: string
          records_failed?: number | null
          records_synced?: number | null
          status?: string | null
          sync_duration?: number | null
          sync_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tracking_numbers: {
        Row: {
          area_code: string | null
          assigned_at: string | null
          campaign_id: string | null
          country_code: string | null
          created_at: string | null
          display_number: string | null
          id: string
          is_active: boolean | null
          number: string
        }
        Insert: {
          area_code?: string | null
          assigned_at?: string | null
          campaign_id?: string | null
          country_code?: string | null
          created_at?: string | null
          display_number?: string | null
          id?: string
          is_active?: boolean | null
          number: string
        }
        Update: {
          area_code?: string | null
          assigned_at?: string | null
          campaign_id?: string | null
          country_code?: string | null
          created_at?: string | null
          display_number?: string | null
          id?: string
          is_active?: boolean | null
          number?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_numbers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          expires_at: string | null
          is_active: boolean | null
          metadata: Json | null
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          expires_at?: string | null
          is_active?: boolean | null
          metadata?: Json | null
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          expires_at?: string | null
          is_active?: boolean | null
          metadata?: Json | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          default_role: string | null
          email: string
          email_search_hash: string | null
          first_name: string | null
          id: string
          is_active: boolean | null
          last_login: string | null
          last_name: string | null
          metadata: Json | null
          phone: string | null
          phone_search_hash: string | null
          settings_version: number | null
          status: Database["public"]["Enums"]["user_status"] | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          default_role?: string | null
          email: string
          email_search_hash?: string | null
          first_name?: string | null
          id: string
          is_active?: boolean | null
          last_login?: string | null
          last_name?: string | null
          metadata?: Json | null
          phone?: string | null
          phone_search_hash?: string | null
          settings_version?: number | null
          status?: Database["public"]["Enums"]["user_status"] | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          default_role?: string | null
          email?: string
          email_search_hash?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          last_name?: string | null
          metadata?: Json | null
          phone?: string | null
          phone_search_hash?: string | null
          settings_version?: number | null
          status?: Database["public"]["Enums"]["user_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string | null
          error: string | null
          event_type: string | null
          id: string
          payload: Json | null
          processed: boolean | null
          processed_at: string | null
          processing_attempts: number | null
          processing_duration: number | null
          provider: string
          response_status: number | null
          signature: string | null
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          processing_attempts?: number | null
          processing_duration?: number | null
          provider: string
          response_status?: number | null
          signature?: string | null
        }
        Update: {
          created_at?: string | null
          error?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          processing_attempts?: number | null
          processing_duration?: number | null
          provider?: string
          response_status?: number | null
          signature?: string | null
        }
        Relationships: []
      }
      webhook_security_logs: {
        Row: {
          error_message: string | null
          event_id: string | null
          event_type: string | null
          id: string
          processing_status: string
          received_at: string | null
          replay_detected: boolean | null
          signature_valid: boolean | null
          timestamp_valid: boolean | null
          webhook_source: string
        }
        Insert: {
          error_message?: string | null
          event_id?: string | null
          event_type?: string | null
          id?: string
          processing_status: string
          received_at?: string | null
          replay_detected?: boolean | null
          signature_valid?: boolean | null
          timestamp_valid?: boolean | null
          webhook_source: string
        }
        Update: {
          error_message?: string | null
          event_id?: string | null
          event_type?: string | null
          id?: string
          processing_status?: string
          received_at?: string | null
          replay_detected?: boolean | null
          signature_valid?: boolean | null
          timestamp_valid?: boolean | null
          webhook_source?: string
        }
        Relationships: []
      }
    }
    Views: {
      encryption_key_status: {
        Row: {
          age: unknown | null
          algorithm: string | null
          created_at: string | null
          expires_at: string | null
          is_active: boolean | null
          key_id: string | null
          key_type: string | null
          status: string | null
        }
        Insert: {
          age?: never
          algorithm?: string | null
          created_at?: string | null
          expires_at?: string | null
          is_active?: boolean | null
          key_id?: string | null
          key_type?: string | null
          status?: never
        }
        Update: {
          age?: never
          algorithm?: string | null
          created_at?: string | null
          expires_at?: string | null
          is_active?: boolean | null
          key_id?: string | null
          key_type?: string | null
          status?: never
        }
        Relationships: []
      }
      encryption_performance_summary: {
        Row: {
          avg_performance_ms: number | null
          error_count: number | null
          field_name: string | null
          hour_bucket: string | null
          operation: string | null
          operation_count: number | null
          p95_performance_ms: number | null
          table_name: string | null
        }
        Relationships: []
      }
      gdpr_compliance_summary: {
        Row: {
          avg_completion_hours: number | null
          request_count: number | null
          request_date: string | null
          request_type: string | null
          status: string | null
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          action: string | null
          resource: string | null
          role_name: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles_view: {
        Row: {
          assigned_at: string | null
          expires_at: string | null
          is_active: boolean | null
          permissions: Json | null
          role_description: string | null
          role_id: string | null
          role_name: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_buyer_credit: {
        Args: { buyer_id: string; amount: number; transaction_id: string }
        Returns: undefined
      }
      analyze_data_access_patterns: {
        Args: Record<PropertyKey, never>
        Returns: {
          risk_score: number
          access_pattern: string
          user_id: string
          details: Json
        }[]
      }
      analyze_query_security: {
        Args: { user_uuid?: string; query_text: string }
        Returns: Json
      }
      assign_user_role: {
        Args: {
          assigned_by_user_id?: string
          expires_at_param?: string
          target_role_name: string
          target_user_id: string
        }
        Returns: boolean
      }
      auto_block_suspicious_query: {
        Args: { user_uuid?: string; risk_score: number; query_hash: string }
        Returns: boolean
      }
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      calculate_buyer_balance: {
        Args: { buyer_uuid: string }
        Returns: number
      }
      calculate_call_billing: {
        Args: {
          campaign_id: string
          quality_score: number
          call_duration: number
          buyer_campaign_id: string
        }
        Returns: Json
      }
      calculate_quality_score: {
        Args: { call_duration: number; call_metadata?: Json }
        Returns: number
      }
      calculate_supplier_balance: {
        Args: { supplier_uuid: string }
        Returns: number
      }
      check_user_permission: {
        Args: { action_name: string; user_uuid: string; resource_name: string }
        Returns: boolean
      }
      check_user_permission_with_context: {
        Args: {
          user_uuid: string
          action_name: string
          context_data?: Json
          resource_name: string
        }
        Returns: boolean
      }
      check_velocity_limits: {
        Args: { amount: number; buyer_id: string }
        Returns: Json
      }
      cleanup_audit_logs: {
        Args: { retention_days?: number }
        Returns: number
      }
      cleanup_expired_mfa_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_audit_logs: {
        Args: { retention_days?: number }
        Returns: number
      }
      cleanup_test_users: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_full_user: {
        Args: {
          p_email: string
          p_password: string
          p_first_name: string
          p_credit_balance?: number
          p_last_name: string
          p_user_type: string
          p_company?: string
          p_business_type?: string
          p_credit_limit?: number
          p_current_balance?: number
        }
        Returns: string
      }
      create_security_incident: {
        Args: {
          title: string
          incident_type: string
          evidence?: Json
          auto_response?: boolean
          description: string
          severity: string
        }
        Returns: string
      }
      detect_connection_anomalies: {
        Args: Record<PropertyKey, never>
        Returns: undefined
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
      detect_suspicious_logins: {
        Args: Record<PropertyKey, never>
        Returns: {
          details: Json
          time_window: unknown
          user_id: string
          suspicious_pattern: string
          event_count: number
        }[]
      }
      escalate_security_incident: {
        Args: { incident_id: string }
        Returns: boolean
      }
      execute_incident_response: {
        Args: { incident_id: string }
        Returns: boolean
      }
      find_matching_buyer_campaigns: {
        Args: {
          call_time?: string
          caller_location?: Json
          supplier_campaign_id: string
        }
        Returns: {
          match_score: number
          max_bid: number
          buyer_id: string
          buyer_campaign_id: string
        }[]
      }
      generate_blog_slug: {
        Args: { title: string }
        Returns: string
      }
      generate_secure_password: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_tracking_number: {
        Args: { campaign_uuid: string }
        Returns: string
      }
      get_active_encryption_key: {
        Args: { key_type_param?: string }
        Returns: {
          created_at: string
          key_id: string
          algorithm: string
          expires_at: string
        }[]
      }
      get_blog_statistics: {
        Args: { author_id_param?: string }
        Returns: {
          total_posts: number
          published_posts: number
          draft_posts: number
          total_views: number
          total_comments: number
          avg_reading_time: number
        }[]
      }
      get_buyer_id: {
        Args: { user_uuid?: string }
        Returns: string
      }
      get_campaign_performance: {
        Args: { campaign_uuid: string; start_date?: string; end_date?: string }
        Returns: Json
      }
      get_connection_pool_stats: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_data_classification: {
        Args: { column_name?: string; table_name: string }
        Returns: string
      }
      get_database_connections: {
        Args: Record<PropertyKey, never>
        Returns: {
          client_port: number
          datname: string
          usename: string
          application_name: string
          backend_start: string
          query_start: string
          state_change: string
          state: string
          query: string
          wait_event: string
          wait_event_type: string
          ssl: boolean
          ssl_version: string
          ssl_cipher: string
          client_hostname: string
          client_addr: unknown
          pid: number
        }[]
      }
      get_long_running_queries: {
        Args: Record<PropertyKey, never>
        Returns: {
          usename: string
          pid: number
          datname: string
          client_addr: unknown
          query_start: string
          duration: unknown
          state: string
          query: string
        }[]
      }
      get_recent_queries: {
        Args: { time_window_minutes?: number }
        Returns: {
          calls: number
          mean_time: number
          rows: number
          first_seen: string
          user_id: string
          query_text: string
          total_time: number
        }[]
      }
      get_service_account_usage_stats: {
        Args: { time_window_hours?: number }
        Returns: {
          service_account_id: string
          service_account_name: string
          total_requests: number
          successful_requests: number
          failed_requests: number
          success_rate: number
          unique_functions: number
          last_used: string
        }[]
      }
      get_service_accounts_due_for_rotation: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          name: string
          rotation_due_at: string
          days_overdue: number
        }[]
      }
      get_supplier_id: {
        Args: { user_uuid?: string }
        Returns: string
      }
      get_system_health_stats: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_user_roles: {
        Args: { user_uuid: string }
        Returns: {
          role_description: string
          expires_at: string
          assigned_at: string
          role_name: string
          role_id: string
        }[]
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      is_admin: {
        Args: { user_uuid?: string }
        Returns: boolean
      }
      is_buyer: {
        Args: { user_uuid?: string }
        Returns: boolean
      }
      is_mfa_required_for_user: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      is_supplier: {
        Args: { user_uuid?: string }
        Returns: boolean
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      log_data_access: {
        Args: {
          user_uuid: string
          record_ids?: string[]
          operation: string
          table_name: string
          classification_level?: string
          new_values?: Json
          old_values?: Json
          column_names?: string[]
        }
        Returns: string
      }
      log_security_event: {
        Args: {
          event_type: string
          risk_level?: string
          event_data?: Json
          resource_id: string
          resource_type: string
          user_uuid: string
        }
        Returns: string
      }
      log_security_incident: {
        Args: {
          severity_param: string
          incident_type_param: string
          description_param: string
          user_id_param?: string
          key_id_param?: string
          table_name_param?: string
          field_name_param?: string
          client_ip_param?: unknown
        }
        Returns: string
      }
      log_service_account_access: {
        Args: {
          service_account_uuid: string
          function_name: string
          resource: string
          action: string
          access_granted: boolean
          denial_reason?: string
          context_data?: Json
        }
        Returns: string
      }
      process_hourly_stats: {
        Args: { target_hour?: string }
        Returns: undefined
      }
      run_security_monitoring: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      search_similar_posts: {
        Args: {
          query_embedding: string
          match_count?: number
          threshold?: number
        }
        Returns: {
          id: string
          title: string
          slug: string
          excerpt: string
          similarity: number
        }[]
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      validate_campaign_targeting: {
        Args: { targeting: Json }
        Returns: boolean
      }
      validate_ip_whitelist_condition: {
        Args: { ip_whitelist: Json; client_ip: string }
        Returns: boolean
      }
      validate_permission_conditions: {
        Args: { conditions: Json; context_data: Json }
        Returns: boolean
      }
      validate_phone_number: {
        Args: { phone_number: string }
        Returns: boolean
      }
      validate_service_account_permission: {
        Args: {
          service_account_uuid: string
          function_name: string
          resource: string
          action: string
          context_data?: Json
        }
        Returns: Json
      }
      validate_time_range_condition: {
        Args: { time_range: Json; check_time: string }
        Returns: boolean
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      call_status:
        | "initiated"
        | "ringing"
        | "connected"
        | "completed"
        | "failed"
        | "rejected"
      campaign_status: "draft" | "active" | "paused" | "completed" | "cancelled"
      dispute_status: "open" | "investigating" | "resolved" | "closed"
      invoice_status: "draft" | "open" | "paid" | "overdue" | "cancelled"
      payout_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      user_status: "pending" | "active" | "suspended" | "banned"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      call_status: [
        "initiated",
        "ringing",
        "connected",
        "completed",
        "failed",
        "rejected",
      ],
      campaign_status: ["draft", "active", "paused", "completed", "cancelled"],
      dispute_status: ["open", "investigating", "resolved", "closed"],
      invoice_status: ["draft", "open", "paid", "overdue", "cancelled"],
      payout_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      user_status: ["pending", "active", "suspended", "banned"],
    },
  },
} as const

