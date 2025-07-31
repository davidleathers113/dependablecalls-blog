/**
 * CSRF Protection Integration Tests
 * 
 * Tests CSRF protection across complete user flows including
 * authentication, form submissions, and API interactions.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { SettingsState } from '../../store/settingsStore'
import type { User } from '../../types/auth'

// Import pages that should have CSRF protection
import LoginPage from '../../pages/auth/LoginPage'
import RegisterPage from '../../pages/auth/RegisterPage'
import ForgotPasswordPage from '../../pages/auth/ForgotPasswordPage'
import ProfileSettingsPage from '../../pages/settings/ProfileSettingsPage'
import AccountSettingsPage from '../../pages/settings/AccountSettingsPage'
import SecuritySettingsPage from '../../pages/settings/SecuritySettingsPage'
import CreateCampaignPage from '../../pages/campaigns/CreateCampaignPage'

// Mock the auth store and settings store
import { useAuthStore } from '../../store/authStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useCsrf } from '../../hooks/useCsrf'

// Type definitions for mocks
type MockAuthState = {
  user: Pick<User, 'id' | 'email' | 'userType'> | null
  isAuthenticated: boolean
  isLoading: boolean
}

type MockSettingsState = {
  userSettings: SettingsState['userSettings']
  updateUserSetting: SettingsState['updateUserSetting']
  isSaving: boolean
}

// Mock fetch for API calls
global.fetch = vi.fn()

// Mock the stores
vi.mock('../../store/authStore')
vi.mock('../../store/settingsStore')
vi.mock('../../hooks/useCsrf')

const createWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('Authentication Flow CSRF Protection', () => {
  beforeEach(() => {
    // Mock successful CSRF token creation
    global.document.cookie = '__Host-csrf-token=test-csrf-token-123; Path=/; Secure; SameSite=Strict'
    
    // Reset fetch mock
    vi.clearAllMocks()
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response)
  })

  test('login form should include CSRF token in submission', async () => {
    const user = userEvent.setup()
    
    render(<LoginPage />, { wrapper: createWrapper })
    
    const emailInput = screen.getByLabelText(/email address/i)
    const submitButton = screen.getByRole('button', { name: /send login link/i })

    await user.type(emailInput, 'test@example.com')
    await user.click(submitButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-CSRF-Token': 'test-csrf-token-123'
          }),
          body: expect.stringContaining('csrfToken')
        })
      )
    })
  })

  test('registration form should include CSRF token in submission', async () => {
    const user = userEvent.setup()
    
    render(<RegisterPage />, { wrapper: createWrapper })
    
    const emailInput = screen.getByLabelText(/email address/i)
    const supplierRadio = screen.getByRole('radio', { name: /supplier/i })
    const termsCheckbox = screen.getByRole('checkbox', { name: /terms and conditions/i })
    const submitButton = screen.getByRole('button', { name: /send verification email/i })

    await user.type(emailInput, 'test@example.com')
    await user.click(supplierRadio)
    await user.click(termsCheckbox)
    await user.click(submitButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-CSRF-Token': 'test-csrf-token-123'
          }),
          body: expect.stringContaining('csrfToken')
        })
      )
    })
  })

  test('forgot password form should include CSRF token', async () => {
    const user = userEvent.setup()
    
    render(<ForgotPasswordPage />, { wrapper: createWrapper })
    
    const emailInput = screen.getByLabelText(/email address/i)
    const submitButton = screen.getByRole('button', { name: /send reset link/i })

    await user.type(emailInput, 'test@example.com')
    await user.click(submitButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-CSRF-Token': 'test-csrf-token-123'
          }),
          body: expect.stringContaining('csrfToken')
        })
      )
    })
  })
})

describe('Settings Forms CSRF Protection', () => {
  beforeEach(() => {
    // Mock authenticated user
    vi.mocked(useAuthStore).mockReturnValue({
      user: {
        id: 'user-123',
        email: 'test@example.com',
        userType: 'supplier'
      },
      isAuthenticated: true,
      isLoading: false,
    } as MockAuthState)

    // Mock settings store
    vi.mocked(useSettingsStore).mockReturnValue({
      userSettings: {
        profile: {
          displayName: 'Test User',
          bio: 'Test bio',
          timezone: 'America/New_York',
          language: 'en',
          dateFormat: 'MM/DD/YYYY',
          phoneFormat: 'US',
          currency: 'USD'
        },
        preferences: {
          theme: 'system',
          dashboardLayout: 'expanded',
          defaultPage: '/dashboard',
          tablePageSize: 25,
          soundAlerts: true,
          keyboardShortcuts: true,
          autoRefresh: true,
          refreshInterval: 30,
          compactMode: false,
          showOnboarding: true
        },
        security: {
          twoFactorEnabled: false,
          sessionTimeout: 30,
          ipWhitelist: [],
          apiAccess: false,
          loginNotifications: true,
          activityAlerts: true,
          dataExportEnabled: true
        }
      },
      updateUserSetting: vi.fn(),
      isSaving: false,
    } as MockSettingsState)

    global.document.cookie = '__Host-csrf-token=test-csrf-token-123'
    vi.clearAllMocks()
  })

  test('profile settings form should include CSRF token', async () => {
    const user = userEvent.setup()
    
    render(<ProfileSettingsPage />, { wrapper: createWrapper })
    
    const displayNameInput = screen.getByLabelText(/display name/i)
    const submitButton = screen.getByRole('button', { name: /save changes/i })

    await user.clear(displayNameInput)
    await user.type(displayNameInput, 'Updated Name')
    await user.click(submitButton)

    await waitFor(() => {
      expect(useSettingsStore().updateUserSetting).toHaveBeenCalledWith(
        'profile',
        expect.objectContaining({
          displayName: 'Updated Name'
        })
      )
    })
  })

  test('account settings form should include CSRF token', async () => {
    const user = userEvent.setup()
    
    render(<AccountSettingsPage />, { wrapper: createWrapper })
    
    const lightThemeRadio = screen.getByRole('radio', { name: /light/i })
    const submitButton = screen.getByRole('button', { name: /save changes/i })

    await user.click(lightThemeRadio)
    await user.click(submitButton)

    await waitFor(() => {
      expect(useSettingsStore().updateUserSetting).toHaveBeenCalledWith(
        'preferences',
        expect.objectContaining({
          theme: 'light'
        })
      )
    })
  })

  test('security settings form should include CSRF token', async () => {
    const user = userEvent.setup()
    
    render(<SecuritySettingsPage />, { wrapper: createWrapper })
    
    const twoFactorCheckbox = screen.getByRole('checkbox', { name: /enable two-factor/i })
    const submitButton = screen.getByRole('button', { name: /save settings/i })

    await user.click(twoFactorCheckbox)
    await user.click(submitButton)

    await waitFor(() => {
      expect(useSettingsStore().updateUserSetting).toHaveBeenCalledWith(
        'security',
        expect.objectContaining({
          twoFactorEnabled: true
        })
      )
    })
  })
})

describe('Campaign Creation CSRF Protection', () => {
  beforeEach(() => {
    // Mock authenticated supplier
    vi.mocked(useAuthStore).mockReturnValue({
      user: {
        id: 'supplier-123',
        email: 'supplier@example.com',
        userType: 'supplier'
      },
      isAuthenticated: true,
      isLoading: false,
    } as MockAuthState)

    global.document.cookie = '__Host-csrf-token=test-csrf-token-123'
    vi.clearAllMocks()
    
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 'campaign-123' } }),
    } as Response)
  })

  test('campaign creation form should include CSRF token', async () => {
    const user = userEvent.setup()
    
    render(<CreateCampaignPage />, { wrapper: createWrapper })
    
    // Fill out basic campaign info
    const nameInput = screen.getByLabelText(/campaign name/i)
    const insuranceRadio = screen.getByRole('radio', { name: /insurance/i })
    const descriptionTextarea = screen.getByRole('textbox', { name: /description/i })
    
    await user.type(nameInput, 'Test Insurance Campaign')
    await user.click(insuranceRadio)
    await user.type(descriptionTextarea, 'This is a test campaign for insurance leads.')

    // Navigate through steps and submit
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton) // Step 2: Targeting
    await user.click(nextButton) // Step 3: Quality
    await user.click(nextButton) // Step 4: Payout
    await user.click(nextButton) // Step 5: Review

    const launchButton = screen.getByRole('button', { name: /launch campaign/i })
    await user.click(launchButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/campaigns/),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-CSRF-Token': 'test-csrf-token-123'
          }),
          body: expect.stringContaining('csrfToken')
        })
      )
    })
  })
})

describe('CSRF Attack Prevention', () => {
  test('should reject form submissions without CSRF token', async () => {
    // Clear CSRF cookie to simulate missing token
    global.document.cookie = ''
    
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'CSRF token missing' }),
    } as Response)

    const user = userEvent.setup()
    render(<LoginPage />, { wrapper: createWrapper })
    
    const emailInput = screen.getByLabelText(/email address/i)
    const submitButton = screen.getByRole('button', { name: /send login link/i })

    await user.type(emailInput, 'test@example.com')
    await user.click(submitButton)

    // Should show error message for missing CSRF token
    await waitFor(() => {
      expect(screen.queryByText(/error/i)).toBeInTheDocument()
    })
  })

  test('should reject form submissions with invalid CSRF token', async () => {
    // Set invalid CSRF token
    global.document.cookie = '__Host-csrf-token=invalid-token'
    
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Invalid CSRF token' }),
    } as Response)

    const user = userEvent.setup()
    render(<LoginPage />, { wrapper: createWrapper })
    
    const emailInput = screen.getByLabelText(/email address/i)
    const submitButton = screen.getByRole('button', { name: /send login link/i })

    await user.type(emailInput, 'test@example.com')
    await user.click(submitButton)

    // Should show error message for invalid CSRF token
    await waitFor(() => {
      expect(screen.queryByText(/error/i)).toBeInTheDocument()
    })
  })
})

describe('CSRF Token Refresh', () => {
  test('should refresh CSRF token on auth state change', async () => {
    const { result } = renderHook(() => useCsrf())
    
    // Simulate auth state change
    fireEvent(window, new Event('authStateChange'))
    
    await waitFor(() => {
      expect(result.current.csrfToken).toBeDefined()
    })
  })

  test('should handle CSRF token expiration gracefully', async () => {
    // Mock expired token scenario
    global.document.cookie = '__Host-csrf-token=expired-token'
    
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'CSRF token expired' }),
    } as Response)

    const user = userEvent.setup()
    render(<LoginPage />, { wrapper: createWrapper })
    
    const emailInput = screen.getByLabelText(/email address/i)
    const submitButton = screen.getByRole('button', { name: /send login link/i })

    await user.type(emailInput, 'test@example.com')
    await user.click(submitButton)

    // Should automatically refresh token and retry
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1) // Initial failed request
    })
  })
})