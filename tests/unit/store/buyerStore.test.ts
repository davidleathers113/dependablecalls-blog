import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useBuyerStore } from '@/store/buyerStore'
import { supabase } from '@/lib/supabase'

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  },
}))

describe('BuyerStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useBuyerStore.getState().reset()
    vi.clearAllMocks()
  })

  it('should have initial state', () => {
    const state = useBuyerStore.getState()

    expect(state.currentBalance).toBe(0)
    expect(state.creditLimit).toBe(0)
    expect(state.campaigns).toEqual([])
    expect(state.isLoading).toBe(false)
    expect(state.error).toBe(null)
  })

  describe('fetchBalance', () => {
    it('should fetch and update balance successfully', async () => {
      const mockBalance = {
        current_balance: 1500.5,
        credit_limit: 5000.0,
      }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockBalance,
              error: null,
            }),
          }),
        }),
      } as ReturnType<typeof vi.fn>)

      const store = useBuyerStore.getState()
      await store.fetchBalance('buyer_123')

      const updatedState = useBuyerStore.getState()
      expect(updatedState.currentBalance).toBe(1500.5)
      expect(updatedState.creditLimit).toBe(5000.0)
      expect(updatedState.isLoading).toBe(false)
      expect(updatedState.error).toBe(null)
    })

    it('should handle null balance values', async () => {
      const mockBalance = {
        current_balance: null,
        credit_limit: null,
      }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockBalance,
              error: null,
            }),
          }),
        }),
      } as ReturnType<typeof vi.fn>)

      const store = useBuyerStore.getState()
      await store.fetchBalance('buyer_123')

      const updatedState = useBuyerStore.getState()
      expect(updatedState.currentBalance).toBe(0)
      expect(updatedState.creditLimit).toBe(0)
    })

    it('should handle fetch balance error', async () => {
      const mockError = new Error('Database error')

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: mockError,
            }),
          }),
        }),
      } as ReturnType<typeof vi.fn>)

      const store = useBuyerStore.getState()
      await store.fetchBalance('buyer_123')

      const updatedState = useBuyerStore.getState()
      expect(updatedState.error).toBe('Database error')
      expect(updatedState.isLoading).toBe(false)
    })
  })

  describe('updateBalance', () => {
    it('should update balance immediately', () => {
      const store = useBuyerStore.getState()
      store.updateBalance(2500.75)

      const updatedState = useBuyerStore.getState()
      expect(updatedState.currentBalance).toBe(2500.75)
    })
  })

  describe('fetchCampaigns', () => {
    it('should fetch campaigns successfully', async () => {
      const mockCampaigns = [
        { id: '1', name: 'Campaign 1', status: 'active' },
        { id: '2', name: 'Campaign 2', status: 'paused' },
      ]

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockCampaigns,
              error: null,
            }),
          }),
        }),
      } as ReturnType<typeof vi.fn>)

      const store = useBuyerStore.getState()
      await store.fetchCampaigns('buyer_123')

      const updatedState = useBuyerStore.getState()
      expect(updatedState.campaigns).toEqual(mockCampaigns)
      expect(updatedState.isLoading).toBe(false)
      expect(updatedState.error).toBe(null)
    })

    it('should handle empty campaigns array', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      } as ReturnType<typeof vi.fn>)

      const store = useBuyerStore.getState()
      await store.fetchCampaigns('buyer_123')

      const updatedState = useBuyerStore.getState()
      expect(updatedState.campaigns).toEqual([])
    })

    it('should handle fetch campaigns error', async () => {
      const mockError = new Error('Failed to load campaigns')

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: mockError,
            }),
          }),
        }),
      } as ReturnType<typeof vi.fn>)

      const store = useBuyerStore.getState()
      await store.fetchCampaigns('buyer_123')

      const updatedState = useBuyerStore.getState()
      expect(updatedState.error).toBe('Failed to load campaigns')
      expect(updatedState.isLoading).toBe(false)
    })
  })

  describe('updateCampaign', () => {
    it('should update specific campaign', () => {
      // Set initial campaigns
      useBuyerStore.setState({
        campaigns: [
          { id: '1', name: 'Campaign 1', status: 'active' as const },
          { id: '2', name: 'Campaign 2', status: 'active' as const },
        ],
      })

      const store = useBuyerStore.getState()
      store.updateCampaign('2', { status: 'paused' })

      const updatedState = useBuyerStore.getState()
      expect(updatedState.campaigns[0].status).toBe('active')
      expect(updatedState.campaigns[1].status).toBe('paused')
    })

    it('should not modify campaigns if id not found', () => {
      const initialCampaigns = [{ id: '1', name: 'Campaign 1', status: 'active' as const }]

      useBuyerStore.setState({ campaigns: initialCampaigns })

      const store = useBuyerStore.getState()
      store.updateCampaign('999', { status: 'paused' })

      const updatedState = useBuyerStore.getState()
      expect(updatedState.campaigns).toEqual(initialCampaigns)
    })
  })

  describe('clearError', () => {
    it('should clear error message', () => {
      useBuyerStore.setState({ error: 'Test error' })

      const store = useBuyerStore.getState()
      store.clearError()

      const updatedState = useBuyerStore.getState()
      expect(updatedState.error).toBe(null)
    })
  })

  describe('reset', () => {
    it('should reset store to initial state', () => {
      // Set some state
      useBuyerStore.setState({
        currentBalance: 1000,
        creditLimit: 5000,
        campaigns: [{ id: '1', name: 'Test', status: 'active' as const }],
        isLoading: true,
        error: 'Some error',
      })

      const store = useBuyerStore.getState()
      store.reset()

      const updatedState = useBuyerStore.getState()
      expect(updatedState).toEqual({
        currentBalance: 0,
        creditLimit: 0,
        campaigns: [],
        isLoading: false,
        error: null,
        fetchBalance: expect.any(Function),
        updateBalance: expect.any(Function),
        fetchCampaigns: expect.any(Function),
        updateCampaign: expect.any(Function),
        clearError: expect.any(Function),
        reset: expect.any(Function),
      })
    })
  })

  describe('loading states', () => {
    it('should set isLoading during fetchBalance', async () => {
      const loadingStatesDuringFetch: boolean[] = []

      // Mock a delayed response
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              loadingStatesDuringFetch.push(useBuyerStore.getState().isLoading)
              return Promise.resolve({
                data: { current_balance: 100, credit_limit: 500 },
                error: null,
              })
            }),
          }),
        }),
      } as ReturnType<typeof vi.fn>)

      const store = useBuyerStore.getState()
      expect(store.isLoading).toBe(false)

      await store.fetchBalance('buyer_123')

      expect(loadingStatesDuringFetch[0]).toBe(true)
      expect(useBuyerStore.getState().isLoading).toBe(false)
    })
  })
})
