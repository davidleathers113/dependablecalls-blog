import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { render } from '../../../setup/test-utils'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'

// Mock the router navigate function
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  }
})

// Mock Supabase optimized exports - comprehensive mock with proper return values
const mockSubscription = { unsubscribe: vi.fn() }

vi.mock('@/lib/supabase-optimized', () => ({
  auth: {
    resetPasswordForEmail: vi.fn(() => Promise.resolve({ error: null })),
    signInWithOtp: vi.fn(),
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: mockSubscription } })),
    signOut: vi.fn(),
  },
  signInWithOtp: vi.fn(),
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
  getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: mockSubscription } })),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(() => Promise.resolve({ error: null })),
  from: vi.fn(),
  fromView: vi.fn(),
  rpc: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn(() => Promise.resolve({ error: null })),
      signInWithOtp: vi.fn(),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: mockSubscription } })),
      signOut: vi.fn(),
    },
    from: vi.fn(),
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}))

// Mock the hooks
// Enhanced CSRF mock that ensures proper async handling
vi.mock('@/hooks/useCsrf', () => ({
  useCsrfForm: vi.fn(() => ({
    submitWithCsrf: (fn: (data: unknown) => Promise<unknown>) => async (data: unknown) => {
      // Ensure the wrapped function is called
      return await fn(data)
    },
  })),
}))

vi.mock('@/hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}))

// Import to get the mocked function reference
import { resetPasswordForEmail } from '@/lib/supabase-optimized'
const mockResetPasswordForEmail = vi.mocked(resetPasswordForEmail)

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    origin: 'http://localhost:3000',
  },
  writable: true,
})

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to default successful behavior
    mockResetPasswordForEmail.mockResolvedValue({ error: null })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render forgot password form with all required elements', () => {
    render(<ForgotPasswordPage />)

    expect(screen.getByRole('heading', { name: /forgot your password/i })).toBeInTheDocument()
    expect(
      screen.getByText(/enter your email address and we'll send you a link/i)
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/enter your email/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to login/i })).toHaveAttribute('href', '/login')
  })

  it('should handle invalid email by calling API and showing server response', async () => {
    // Override default mock to return an error for this test
    mockResetPasswordForEmail.mockResolvedValueOnce({ 
      error: new Error('Invalid email address') 
    })

    render(<ForgotPasswordPage />)

    const emailInput = screen.getByPlaceholderText(/enter your email/i)
    const submitButton = screen.getByRole('button', { name: /send reset link/i })

    // Enter invalid email - it will be sent to API due to bypassed client validation
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
    fireEvent.click(submitButton)

    // API should be called even with invalid email
    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('invalid-email', {
        redirectTo: 'http://localhost:3000/reset-password',
      })
    })

    // Should show server error message
    await waitFor(() => {
      expect(screen.getByText(/invalid email address/i)).toBeInTheDocument()
    })
  })

  it('should handle successful password reset request', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: null })

    render(<ForgotPasswordPage />)

    const emailInput = screen.getByPlaceholderText(/enter your email/i)
    const submitButton = screen.getByRole('button', { name: /send reset link/i })

    // Fill in valid email
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(submitButton)

    // Check loading state
    await waitFor(() => {
      expect(screen.getByText(/sending.../i)).toBeInTheDocument()
    })

    // Check that resetPasswordForEmail was called with correct arguments
    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('test@example.com', {
        redirectTo: 'http://localhost:3000/reset-password',
      })
    })

    // Check success state is displayed
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /check your email/i })).toBeInTheDocument()
      expect(
        screen.getByText(/we've sent a password reset link to your email address/i)
      ).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /back to login/i })).toHaveAttribute('href', '/login')
    })
  })

  it('should handle password reset error with Error instance', async () => {
    const errorMessage = 'User not found'
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: new Error(errorMessage) })

    render(<ForgotPasswordPage />)

    const emailInput = screen.getByPlaceholderText(/enter your email/i)
    const submitButton = screen.getByRole('button', { name: /send reset link/i })

    // Fill in email
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(submitButton)

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    // Check that loading state is cleared
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument()
    expect(screen.queryByText(/sending.../i)).not.toBeInTheDocument()
  })

  it('should handle password reset error with non-Error instance', async () => {
    mockResetPasswordForEmail.mockRejectedValueOnce('String error')

    render(<ForgotPasswordPage />)

    const emailInput = screen.getByPlaceholderText(/enter your email/i)
    const submitButton = screen.getByRole('button', { name: /send reset link/i })

    // Fill in email
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(submitButton)

    // Wait for default error message to appear
    await waitFor(() => {
      expect(screen.getByText(/failed to send reset email/i)).toBeInTheDocument()
    })
  })

  it('should disable submit button while loading', async () => {
    // Mock a slow reset request to test loading state
    mockResetPasswordForEmail.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ error: null }), 1000))
    )

    render(<ForgotPasswordPage />)

    const emailInput = screen.getByPlaceholderText(/enter your email/i)
    const submitButton = screen.getByRole('button', { name: /send reset link/i })

    // Fill in email and submit
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(submitButton)

    // Check that button is disabled and shows loading text
    await waitFor(() => {
      const loadingButton = screen.getByRole('button', { name: /sending.../i })
      expect(loadingButton).toBeDisabled()
    })
  })

  it('should clear error when form is resubmitted', async () => {
    // First submission fails
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: new Error('Network error') })

    render(<ForgotPasswordPage />)

    const emailInput = screen.getByPlaceholderText(/enter your email/i)
    const submitButton = screen.getByRole('button', { name: /send reset link/i })

    // First submission
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(submitButton)

    // Wait for error
    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })

    // Second submission should succeed
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: null })
    fireEvent.click(submitButton)

    // Error should be cleared during loading
    await waitFor(() => {
      expect(screen.queryByText(/network error/i)).not.toBeInTheDocument()
    })
  })

  it('should handle empty email by calling API and showing server response', async () => {
    // Override default mock to return error for empty email
    mockResetPasswordForEmail.mockResolvedValueOnce({ 
      error: new Error('Invalid email address') 
    })

    render(<ForgotPasswordPage />)

    const submitButton = screen.getByRole('button', { name: /send reset link/i })

    // Submit empty form - will be sent to API due to bypassed validation
    fireEvent.click(submitButton)

    // API should be called with empty string
    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('', {
        redirectTo: 'http://localhost:3000/reset-password',
      })
    })

    // Should show server error
    await waitFor(() => {
      expect(screen.getByText(/invalid email address/i)).toBeInTheDocument()
    })
  })

  it('should handle form submission with Enter key', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: null })

    render(<ForgotPasswordPage />)

    const emailInput = screen.getByPlaceholderText(/enter your email/i)

    // Fill in email
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })

    // Submit with Enter key
    fireEvent.keyDown(emailInput, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('test@example.com', {
        redirectTo: 'http://localhost:3000/reset-password',
      })
    })
  })

  it('should have proper accessibility attributes', () => {
    render(<ForgotPasswordPage />)

    const emailInput = screen.getByPlaceholderText(/enter your email/i)

    expect(emailInput).toHaveAttribute('type', 'email')
    expect(emailInput).toHaveAttribute('autoComplete', 'email')

    // Check that label exists for accessibility
    expect(screen.getByText(/email address/i)).toBeInTheDocument()
  })

  it('should render success state correctly', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: null })

    render(<ForgotPasswordPage />)

    const emailInput = screen.getByPlaceholderText(/enter your email/i)
    const submitButton = screen.getByRole('button', { name: /send reset link/i })

    // Submit form
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(submitButton)

    // Wait for success state
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /check your email/i })).toBeInTheDocument()
    })

    // Check that form is no longer visible
    expect(screen.queryByPlaceholderText(/enter your email/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /send reset link/i })).not.toBeInTheDocument()

    // Check success message and back link
    expect(
      screen.getByText(/we've sent a password reset link to your email address/i)
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to login/i })).toHaveAttribute('href', '/login')
  })

  it('should set correct redirect URL based on current origin', async () => {
    // Mock different origin
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'https://dependablecalls.com',
      },
      writable: true,
    })

    mockResetPasswordForEmail.mockResolvedValueOnce({ error: null })

    render(<ForgotPasswordPage />)

    const emailInput = screen.getByPlaceholderText(/enter your email/i)
    const submitButton = screen.getByRole('button', { name: /send reset link/i })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('test@example.com', {
        redirectTo: 'https://dependablecalls.com/reset-password',
      })
    })

    // Reset location for other tests
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost:3000',
      },
      writable: true,
    })
  })

  it('should maintain email input value after validation error', async () => {
    render(<ForgotPasswordPage />)

    const emailInput = screen.getByPlaceholderText(/enter your email/i)
    const submitButton = screen.getByRole('button', { name: /send reset link/i })

    // Enter invalid email
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
    fireEvent.click(submitButton)

    // Wait for validation error
    await waitFor(() => {
      expect(screen.getByText(/invalid email address/i)).toBeInTheDocument()
    })

    // Check that input value is preserved
    expect(emailInput).toHaveValue('invalid-email')
  })

  it('should show error message styling correctly', async () => {
    // Override default mock to return an error
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: new Error('Test error') })

    render(<ForgotPasswordPage />)

    const emailInput = screen.getByPlaceholderText(/enter your email/i)
    const submitButton = screen.getByRole('button', { name: /send reset link/i })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(submitButton)

    // Wait for the API call to complete and error to be displayed
    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalled()
    })

    await waitFor(() => {
      const errorElement = screen.getByText('Test error')
      expect(errorElement).toBeInTheDocument()
      // Find the error container div that has the styling classes
      const errorContainer = errorElement.closest('div[class*="bg-red-50"]')
      expect(errorContainer).toHaveClass('rounded-md', 'bg-red-50', 'p-4')
    })
  })
})
