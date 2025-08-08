import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/authStore'

// Mock the auth store
vi.mock('@/store/authStore')

describe('useAuth Hook', () => {
  const mockAuthStore = {
    user: null,
    isAuthenticated: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    loading: false,
  }

  beforeEach(() => {
    vi.mocked(useAuthStore).mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector(mockAuthStore)
      }
      return mockAuthStore
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Authentication State', () => {
    it('should return authentication state from store', () => {
      const { result } = renderHook(() => useAuth())

      expect(result.current.user).toBe(null)
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.loading).toBe(false)
      expect(result.current.signIn).toBeDefined()
      expect(result.current.signUp).toBeDefined()
      expect(result.current.signOut).toBeDefined()
    })

    it('should return authenticated user when logged in', () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        userType: 'supplier' as const,
        user_metadata: {
          userType: 'supplier' as const
        }
      }

      vi.mocked(useAuthStore).mockImplementation((selector) => {
        const state = {
          ...mockAuthStore,
          user: mockUser,
          isAuthenticated: true,
        }
        return typeof selector === 'function' ? selector(state) : state
      })

      const { result } = renderHook(() => useAuth())

      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
    })
  })

  describe('Role-based Properties', () => {
    it('should identify supplier role correctly', () => {
      const supplierUser = {
        id: 'supplier-123',
        email: 'supplier@example.com',
        userType: 'supplier' as const,
        user_metadata: {
          userType: 'supplier' as const
        }
      }

      vi.mocked(useAuthStore).mockImplementation((selector) => {
        const state = {
          ...mockAuthStore,
          user: supplierUser,
          isAuthenticated: true,
        }
        return typeof selector === 'function' ? selector(state) : state
      })

      const { result } = renderHook(() => useAuth())

      expect(result.current.isSupplier).toBe(true)
      expect(result.current.isBuyer).toBe(false)
      expect(result.current.isAdmin).toBe(false)
    })

    it('should identify buyer role correctly', () => {
      const buyerUser = {
        id: 'buyer-123',
        email: 'buyer@example.com',
        userType: 'buyer' as const,
        user_metadata: {
          userType: 'buyer' as const
        }
      }

      vi.mocked(useAuthStore).mockImplementation((selector) => {
        const state = {
          ...mockAuthStore,
          user: buyerUser,
          isAuthenticated: true,
        }
        return typeof selector === 'function' ? selector(state) : state
      })

      const { result } = renderHook(() => useAuth())

      expect(result.current.isSupplier).toBe(false)
      expect(result.current.isBuyer).toBe(true)
      expect(result.current.isAdmin).toBe(false)
    })

    it('should identify admin role correctly', () => {
      const adminUser = {
        id: 'admin-123',
        email: 'admin@example.com',
        userType: 'admin' as const,
        user_metadata: {
          userType: 'admin' as const
        }
      }

      vi.mocked(useAuthStore).mockImplementation((selector) => {
        const state = {
          ...mockAuthStore,
          user: adminUser,
          isAuthenticated: true,
        }
        return typeof selector === 'function' ? selector(state) : state
      })

      const { result } = renderHook(() => useAuth())

      expect(result.current.isSupplier).toBe(false)
      expect(result.current.isBuyer).toBe(false)
      expect(result.current.isAdmin).toBe(true)
    })

    it('should handle undefined user role', () => {
      const userWithoutRole = {
        id: 'user-123',
        email: 'user@example.com',
        userType: undefined,
        user_metadata: {}
      }

      vi.mocked(useAuthStore).mockImplementation((selector) => {
        const state = {
          ...mockAuthStore,
          user: userWithoutRole,
          isAuthenticated: true,
        }
        return typeof selector === 'function' ? selector(state) : state
      })

      const { result } = renderHook(() => useAuth())

      expect(result.current.isSupplier).toBe(false)
      expect(result.current.isBuyer).toBe(false)
      expect(result.current.isAdmin).toBe(false)
    })
  })

  describe('Authentication Actions', () => {
    it('should call signIn action with credentials', async () => {
      const { result } = renderHook(() => useAuth())

      await act(async () => {
        await result.current.signIn('test@example.com', 'password123')
      })

      expect(mockAuthStore.signIn).toHaveBeenCalledWith('test@example.com', 'password123')
    })

    it('should call signOut action', async () => {
      const { result } = renderHook(() => useAuth())

      await act(async () => {
        await result.current.signOut()
      })

      expect(mockAuthStore.signOut).toHaveBeenCalled()
    })

    it('should call signUp action with credentials and user type', async () => {
      const { result } = renderHook(() => useAuth())

      await act(async () => {
        await result.current.signUp('test@example.com', 'password123', 'supplier')
      })

      expect(mockAuthStore.signUp).toHaveBeenCalledWith('test@example.com', 'password123', 'supplier')
    })
  })

  describe('Loading States', () => {
    it('should return loading state during authentication', () => {
      vi.mocked(useAuthStore).mockImplementation((selector) => {
        const state = {
          ...mockAuthStore,
          loading: true,
        }
        return typeof selector === 'function' ? selector(state) : state
      })

      const { result } = renderHook(() => useAuth())

      expect(result.current.loading).toBe(true)
    })

  })
})