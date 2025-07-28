import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAuthStore } from '@/store/authStore'

// Mock Supabase
const mockSupabase = {
  auth: {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    getUser: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    resetPasswordForEmail: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  })),
}

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}))

describe('AuthStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.getState().reset?.()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useAuthStore.getState()
      
      expect(state.user).toBe(null)
      expect(state.isAuthenticated).toBe(false)
      expect(state.loading).toBe(false)
      expect(state.error).toBe(null)
    })
  })

  describe('Login', () => {
    it('should login user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: {
          role: 'supplier',
        },
      }

      const mockSession = {
        user: mockUser,
        access_token: 'mock-token',
        expires_at: Date.now() + 3600000,
      }

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      })

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: {
                id: 'profile-123',
                user_id: 'user-123',
                company_name: 'Test Company',
                role: 'supplier',
              },
              error: null,
            })),
          })),
        })),
      })

      const { login } = useAuthStore.getState()
      
      await login('test@example.com', 'password123')
      
      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(true)
      expect(state.user).toMatchObject({
        id: 'user-123',
        email: 'test@example.com',
        role: 'supplier',
      })
      expect(state.loading).toBe(false)
      expect(state.error).toBe(null)
    })

    it('should handle login error', async () => {
      const loginError = {
        message: 'Invalid login credentials',
        status: 400,
      }

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: loginError,
      })

      const { login } = useAuthStore.getState()
      
      await login('invalid@example.com', 'wrongpassword')
      
      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.user).toBe(null)
      expect(state.loading).toBe(false)
      expect(state.error).toBe('Invalid login credentials')
    })

    it('should set loading state during login', async () => {
      let resolveLogin: (value: any) => void
      const loginPromise = new Promise((resolve) => {
        resolveLogin = resolve
      })

      mockSupabase.auth.signInWithPassword.mockReturnValue(loginPromise)

      const { login } = useAuthStore.getState()
      
      // Start login
      const loginCall = login('test@example.com', 'password123')
      
      // Check loading state
      expect(useAuthStore.getState().loading).toBe(true)
      
      // Resolve login
      resolveLogin!({
        data: { user: null, session: null },
        error: { message: 'Login failed' },
      })
      
      await loginCall
      
      // Check final state
      expect(useAuthStore.getState().loading).toBe(false)
    })
  })

  describe('Logout', () => {
    it('should logout user successfully', async () => {
      // Set initial authenticated state
      useAuthStore.setState({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'supplier',
        },
        isAuthenticated: true,
      })

      mockSupabase.auth.signOut.mockResolvedValue({
        error: null,
      })

      const { logout } = useAuthStore.getState()
      
      await logout()
      
      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.user).toBe(null)
      expect(state.error).toBe(null)
    })

    it('should handle logout error', async () => {
      useAuthStore.setState({
        user: { id: 'user-123', email: 'test@example.com', role: 'supplier' },
        isAuthenticated: true,
      })

      mockSupabase.auth.signOut.mockResolvedValue({
        error: { message: 'Logout failed' },
      })

      const { logout } = useAuthStore.getState()
      
      await logout()
      
      const state = useAuthStore.getState()
      // Should still clear local state even if remote logout fails
      expect(state.isAuthenticated).toBe(false)
      expect(state.user).toBe(null)
      expect(state.error).toBe('Logout failed')
    })
  })

  describe('Registration', () => {
    it('should register user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'new@example.com',
        email_confirmed_at: null,
      }

      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: null },
        error: null,
      })

      const { register } = useAuthStore.getState()
      
      await register('new@example.com', 'password123', {
        role: 'supplier',
        company_name: 'New Company',
      })
      
      const state = useAuthStore.getState()
      expect(state.loading).toBe(false)
      expect(state.error).toBe(null)
      // User should not be authenticated until email is confirmed
      expect(state.isAuthenticated).toBe(false)
    })

    it('should handle registration error', async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Email already registered' },
      })

      const { register } = useAuthStore.getState()
      
      await register('existing@example.com', 'password123', {
        role: 'supplier',
        company_name: 'Company',
      })
      
      const state = useAuthStore.getState()
      expect(state.error).toBe('Email already registered')
      expect(state.isAuthenticated).toBe(false)
    })
  })

  describe('Session Management', () => {
    it('should initialize from existing session', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: { role: 'supplier' },
      }

      const mockSession = {
        user: mockUser,
        access_token: 'mock-token',
        expires_at: Date.now() + 3600000,
      }

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: {
                id: 'profile-123',
                user_id: 'user-123',
                company_name: 'Test Company',
                role: 'supplier',
              },
              error: null,
            })),
          })),
        })),
      })

      const { initializeFromSession } = useAuthStore.getState()
      
      await initializeFromSession()
      
      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(true)
      expect(state.user).toMatchObject({
        id: 'user-123',
        email: 'test@example.com',
        role: 'supplier',
      })
    })

    it('should handle no existing session', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      })

      const { initializeFromSession } = useAuthStore.getState()
      
      await initializeFromSession()
      
      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.user).toBe(null)
    })

    it('should handle expired session', async () => {
      const expiredSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'expired-token',
        expires_at: Date.now() - 3600000, // 1 hour ago
      }

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: expiredSession },
        error: null,
      })

      const { initializeFromSession } = useAuthStore.getState()
      
      await initializeFromSession()
      
      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.user).toBe(null)
    })
  })

  describe('Profile Management', () => {
    it('should update user profile', async () => {
      useAuthStore.setState({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'supplier',
          profile: {
            company_name: 'Old Company',
            phone: '+1234567890',
          },
        },
        isAuthenticated: true,
      })

      const updatedProfile = {
        company_name: 'New Company Name',
        phone: '+0987654321',
        website: 'https://newcompany.com',
      }

      mockSupabase.from.mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({
            data: [{ ...updatedProfile, user_id: 'user-123' }],
            error: null,
          })),
        })),
      })

      const { updateProfile } = useAuthStore.getState()
      
      await updateProfile(updatedProfile)
      
      const state = useAuthStore.getState()
      expect(state.user?.profile).toMatchObject(updatedProfile)
      expect(state.error).toBe(null)
    })

    it('should handle profile update error', async () => {
      useAuthStore.setState({
        user: { id: 'user-123', email: 'test@example.com', role: 'supplier' },
        isAuthenticated: true,
      })

      mockSupabase.from.mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({
            data: null,
            error: { message: 'Update failed' },
          })),
        })),
      })

      const { updateProfile } = useAuthStore.getState()
      
      await updateProfile({ company_name: 'New Name' })
      
      const state = useAuthStore.getState()
      expect(state.error).toBe('Update failed')
    })
  })

  describe('Password Management', () => {
    it('should request password reset successfully', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null,
      })

      const { requestPasswordReset } = useAuthStore.getState()
      
      await requestPasswordReset('test@example.com')
      
      const state = useAuthStore.getState()
      expect(state.error).toBe(null)
      expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({
          redirectTo: expect.stringContaining('/reset-password'),
        })
      )
    })

    it('should handle password reset error', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: { message: 'Email not found' },
      })

      const { requestPasswordReset } = useAuthStore.getState()
      
      await requestPasswordReset('nonexistent@example.com')
      
      const state = useAuthStore.getState()
      expect(state.error).toBe('Email not found')
    })
  })

  describe('Error Handling', () => {
    it('should clear error when clearError is called', () => {
      useAuthStore.setState({ error: 'Some error' })
      
      const { clearError } = useAuthStore.getState()
      clearError()
      
      expect(useAuthStore.getState().error).toBe(null)
    })

    it('should handle network errors gracefully', async () => {
      mockSupabase.auth.signInWithPassword.mockRejectedValue(
        new Error('Network error')
      )

      const { login } = useAuthStore.getState()
      
      await login('test@example.com', 'password123')
      
      const state = useAuthStore.getState()
      expect(state.error).toBe('Network error')
      expect(state.loading).toBe(false)
      expect(state.isAuthenticated).toBe(false)
    })
  })

  describe('Role-based Access', () => {
    it('should check permissions correctly', () => {
      useAuthStore.setState({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'supplier',
          permissions: ['view_campaigns', 'create_campaigns'],
        },
        isAuthenticated: true,
      })

      const { hasPermission } = useAuthStore.getState()
      
      expect(hasPermission('view_campaigns')).toBe(true)
      expect(hasPermission('create_campaigns')).toBe(true)
      expect(hasPermission('delete_campaigns')).toBe(false)
    })

    it('should handle user without permissions', () => {
      useAuthStore.setState({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'supplier',
        },
        isAuthenticated: true,
      })

      const { hasPermission } = useAuthStore.getState()
      
      expect(hasPermission('view_campaigns')).toBe(false)
    })

    it('should return false for unauthenticated user', () => {
      const { hasPermission } = useAuthStore.getState()
      
      expect(hasPermission('view_campaigns')).toBe(false)
    })
  })

  describe('State Persistence', () => {
    it('should persist authentication state', () => {
      const authenticatedState = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'supplier',
        },
        isAuthenticated: true,
      }

      useAuthStore.setState(authenticatedState)
      
      // Simulate page reload by getting fresh state
      const persistedState = useAuthStore.getState()
      
      expect(persistedState.user).toEqual(authenticatedState.user)
      expect(persistedState.isAuthenticated).toBe(true)
    })

    it('should clear persisted state on logout', async () => {
      useAuthStore.setState({
        user: { id: 'user-123', email: 'test@example.com', role: 'supplier' },
        isAuthenticated: true,
      })

      mockSupabase.auth.signOut.mockResolvedValue({ error: null })

      const { logout } = useAuthStore.getState()
      await logout()

      const state = useAuthStore.getState()
      expect(state.user).toBe(null)
      expect(state.isAuthenticated).toBe(false)
    })
  })
})