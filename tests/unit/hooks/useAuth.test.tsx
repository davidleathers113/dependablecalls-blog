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
    login: vi.fn(),
    logout: vi.fn(),
    loading: false,
    error: null,
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
      expect(result.current.error).toBe(null)
    })

    it('should return authenticated user when logged in', () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'supplier',
        profile: {
          company_name: 'Test Company',
          phone: '+1234567890',
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
        role: 'supplier' as const,
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
        role: 'buyer' as const,
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
        role: 'admin' as const,
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
        role: undefined,
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
    it('should call login action with credentials', async () => {
      const { result } = renderHook(() => useAuth())

      await act(async () => {
        await result.current.login('test@example.com', 'password123')
      })

      expect(mockAuthStore.login).toHaveBeenCalledWith('test@example.com', 'password123')
    })

    it('should call logout action', async () => {
      const { result } = renderHook(() => useAuth())

      await act(async () => {
        await result.current.logout()
      })

      expect(mockAuthStore.logout).toHaveBeenCalled()
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

    it('should return error state when authentication fails', () => {
      const authError = 'Invalid credentials'

      vi.mocked(useAuthStore).mockImplementation((selector) => {
        const state = {
          ...mockAuthStore,
          error: authError,
        }
        return typeof selector === 'function' ? selector(state) : state
      })

      const { result } = renderHook(() => useAuth())

      expect(result.current.error).toBe(authError)
    })
  })

  describe('Permissions', () => {
    it('should check if user has specific permission', () => {
      const userWithPermissions = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'supplier',
        permissions: ['view_campaigns', 'create_campaigns', 'edit_campaigns'],
      }

      vi.mocked(useAuthStore).mockImplementation((selector) => {
        const state = {
          ...mockAuthStore,
          user: userWithPermissions,
          isAuthenticated: true,
        }
        return typeof selector === 'function' ? selector(state) : state
      })

      const { result } = renderHook(() => useAuth())

      expect(result.current.hasPermission?.('view_campaigns')).toBe(true)
      expect(result.current.hasPermission?.('delete_campaigns')).toBe(false)
    })

    it('should handle user without permissions array', () => {
      const userWithoutPermissions = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'supplier',
      }

      vi.mocked(useAuthStore).mockImplementation((selector) => {
        const state = {
          ...mockAuthStore,
          user: userWithoutPermissions,
          isAuthenticated: true,
        }
        return typeof selector === 'function' ? selector(state) : state
      })

      const { result } = renderHook(() => useAuth())

      expect(result.current.hasPermission?.('view_campaigns')).toBe(false)
    })

    it('should return false for unauthenticated user permissions', () => {
      const { result } = renderHook(() => useAuth())

      expect(result.current.hasPermission?.('view_campaigns')).toBe(false)
    })
  })

  describe('Profile Information', () => {
    it('should return user profile information', () => {
      const userWithProfile = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'supplier',
        profile: {
          company_name: 'Test Company',
          phone: '+1234567890',
          website: 'https://testcompany.com',
          industry: 'HVAC',
          monthly_volume: 1000,
        }
      }

      vi.mocked(useAuthStore).mockImplementation((selector) => {
        const state = {
          ...mockAuthStore,
          user: userWithProfile,
          isAuthenticated: true,
        }
        return typeof selector === 'function' ? selector(state) : state
      })

      const { result } = renderHook(() => useAuth())

      expect(result.current.profile).toEqual(userWithProfile.profile)
    })

    it('should return null profile for unauthenticated user', () => {
      const { result } = renderHook(() => useAuth())

      expect(result.current.profile).toBe(null)
    })

    it('should return null profile when user has no profile', () => {
      const userWithoutProfile = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'supplier',
      }

      vi.mocked(useAuthStore).mockImplementation((selector) => {
        const state = {
          ...mockAuthStore,
          user: userWithoutProfile,
          isAuthenticated: true,
        }
        return typeof selector === 'function' ? selector(state) : state
      })

      const { result } = renderHook(() => useAuth())

      expect(result.current.profile).toBe(undefined)
    })
  })

  describe('Session Management', () => {
    it('should check if session is valid', () => {
      const userWithValidSession = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'supplier',
        session: {
          expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        }
      }

      vi.mocked(useAuthStore).mockImplementation((selector) => {
        const state = {
          ...mockAuthStore,
          user: userWithValidSession,
          isAuthenticated: true,
        }
        return typeof selector === 'function' ? selector(state) : state
      })

      const { result } = renderHook(() => useAuth())

      expect(result.current.isSessionValid).toBe(true)
    })

    it('should detect expired session', () => {
      const userWithExpiredSession = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'supplier',
        session: {
          expires_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        }
      }

      vi.mocked(useAuthStore).mockImplementation((selector) => {
        const state = {
          ...mockAuthStore,
          user: userWithExpiredSession,
          isAuthenticated: true,
        }
        return typeof selector === 'function' ? selector(state) : state
      })

      const { result } = renderHook(() => useAuth())

      expect(result.current.isSessionValid).toBe(false)
    })

    it('should handle user without session info', () => {
      const userWithoutSession = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'supplier',
      }

      vi.mocked(useAuthStore).mockImplementation((selector) => {
        const state = {
          ...mockAuthStore,
          user: userWithoutSession,
          isAuthenticated: true,
        }
        return typeof selector === 'function' ? selector(state) : state
      })

      const { result } = renderHook(() => useAuth())

      expect(result.current.isSessionValid).toBe(true) // Default to true if no session info
    })
  })
})