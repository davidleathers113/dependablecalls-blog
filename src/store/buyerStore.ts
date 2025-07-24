import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type Campaign = Database['public']['Tables']['buyer_campaigns']['Row']

interface BuyerStore {
  // State
  currentBalance: number
  creditLimit: number
  campaigns: Campaign[]
  isLoading: boolean
  error: string | null

  // Actions
  fetchBalance: (buyerId: string) => Promise<void>
  updateBalance: (newBalance: number) => void
  fetchCampaigns: (buyerId: string) => Promise<void>
  updateCampaign: (campaignId: string, updates: Partial<Campaign>) => void
  clearError: () => void
  reset: () => void
}

const initialState = {
  currentBalance: 0,
  creditLimit: 0,
  campaigns: [],
  isLoading: false,
  error: null,
}

export const useBuyerStore = create<BuyerStore>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        fetchBalance: async (buyerId: string) => {
          set({ isLoading: true, error: null })

          try {
            const { data, error } = await supabase
              .from('buyers')
              .select('current_balance, credit_limit')
              .eq('id', buyerId)
              .single()

            if (error) throw error

            set({
              currentBalance: data.current_balance || 0,
              creditLimit: data.credit_limit || 0,
              isLoading: false,
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to fetch balance'
            set({ error: message, isLoading: false })
          }
        },

        updateBalance: (newBalance: number) => {
          set({ currentBalance: newBalance })
        },

        fetchCampaigns: async (buyerId: string) => {
          set({ isLoading: true, error: null })

          try {
            const { data, error } = await supabase
              .from('buyer_campaigns')
              .select('*')
              .eq('buyer_id', buyerId)
              .order('created_at', { ascending: false })

            if (error) throw error

            set({
              campaigns: data || [],
              isLoading: false,
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to fetch campaigns'
            set({ error: message, isLoading: false })
          }
        },

        updateCampaign: (campaignId: string, updates: Partial<Campaign>) => {
          set((state) => ({
            campaigns: state.campaigns.map((campaign) =>
              campaign.id === campaignId ? { ...campaign, ...updates } : campaign
            ),
          }))
        },

        clearError: () => set({ error: null }),

        reset: () => set(initialState),
      }),
      {
        name: 'buyer-store',
      }
    )
  )
)
