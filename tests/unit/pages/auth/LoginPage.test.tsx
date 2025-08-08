import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { render } from '../../../setup/test-utils'
import LoginPage from '@/pages/auth/LoginPage'

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

// Mock the auth store
const mockSignInWithMagicLink = vi.fn()
vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    signInWithMagicLink: mockSignInWithMagicLink,
  })),
}))

// Mock the hooks
vi.mock('@/hooks/useCsrf', () => ({
  useCsrfForm: vi.fn(() => ({
    submitWithCsrf: (fn: (data: unknown) => unknown) => fn,
  })),
}))

vi.mock('@/hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render magic link login form with email field', () => {
    render(<LoginPage />)

    expect(screen.getByRole('heading', { name: /sign in to your account/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send login link/i })).toBeInTheDocument()
    expect(screen.getByText(/we'll send you a secure link to sign in/i)).toBeInTheDocument()
  })

  it('should display navigation links', () => {
    render(<LoginPage />)

    expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute(
      'href',
      '/register'
    )
    expect(screen.getByText(/don't have an account/i)).toBeInTheDocument()
  })


  it('should handle successful magic link request', async () => {
    mockSignInWithMagicLink.mockResolvedValueOnce(undefined)

    render(<LoginPage />)

    const emailInput = screen.getByPlaceholderText(/you@example.com/i)
    const submitButton = screen.getByRole('button', { name: /send login link/i })

    // Fill in valid email
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(submitButton)

    // Check that signInWithMagicLink was called with correct email
    await waitFor(() => {
      expect(mockSignInWithMagicLink).toHaveBeenCalledWith('test@example.com')
    })

    // Check that success state is shown
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /check your email/i })).toBeInTheDocument()
      expect(screen.getByText(/we've sent a login link to/i)).toBeInTheDocument()
    })
  })

  it('should handle magic link error with Error instance', async () => {
    const errorMessage = 'Invalid email address'
    mockSignInWithMagicLink.mockRejectedValueOnce(new Error(errorMessage))

    render(<LoginPage />)

    const emailInput = screen.getByPlaceholderText(/you@example.com/i)
    const submitButton = screen.getByRole('button', { name: /send login link/i })

    // Fill in email
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(submitButton)

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    // Check that loading state is cleared
    expect(screen.getByRole('button', { name: /send login link/i })).toBeInTheDocument()
    expect(screen.queryByText(/sending login link.../i)).not.toBeInTheDocument()
  })

  it('should handle magic link error with non-Error instance', async () => {
    mockSignInWithMagicLink.mockRejectedValueOnce('String error')

    render(<LoginPage />)

    const emailInput = screen.getByPlaceholderText(/you@example.com/i)
    const submitButton = screen.getByRole('button', { name: /send login link/i })

    // Fill in email
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(submitButton)

    // Wait for default error message to appear
    await waitFor(() => {
      expect(screen.getByText(/failed to send login email/i)).toBeInTheDocument()
    })
  })

  it('should disable submit button while loading', async () => {
    // Mock a slow magic link request to test loading state
    mockSignInWithMagicLink.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 1000)))

    render(<LoginPage />)

    const emailInput = screen.getByPlaceholderText(/you@example.com/i)
    const submitButton = screen.getByRole('button', { name: /send login link/i })

    // Fill in email and submit
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(submitButton)

    // Check that button is disabled and shows loading text
    await waitFor(() => {
      const loadingButton = screen.getByRole('button', { name: /sending login link.../i })
      expect(loadingButton).toBeDisabled()
    })
  })

  it('should clear error when form is resubmitted', async () => {
    // First submission fails
    mockSignInWithMagicLink.mockRejectedValueOnce(new Error('Network error'))

    render(<LoginPage />)

    const emailInput = screen.getByPlaceholderText(/you@example.com/i)
    const submitButton = screen.getByRole('button', { name: /send login link/i })

    // First submission
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(submitButton)

    // Wait for error
    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })

    // Second submission should succeed
    mockSignInWithMagicLink.mockResolvedValueOnce(undefined)
    fireEvent.click(submitButton)

    // Error should be cleared
    await waitFor(() => {
      expect(screen.queryByText(/network error/i)).not.toBeInTheDocument()
    })
  })

  it('should not submit form with missing fields', async () => {
    render(<LoginPage />)

    const submitButton = screen.getByRole('button', { name: /send login link/i })

    // Submit empty form
    fireEvent.click(submitButton)

    // Should show validation error for required field
    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument()
    })

    // Should not call signInWithMagicLink
    expect(mockSignInWithMagicLink).not.toHaveBeenCalled()
  })

  it('should show success message after sending login link', async () => {
    mockSignInWithMagicLink.mockResolvedValueOnce(undefined)

    render(<LoginPage />)

    const emailInput = screen.getByPlaceholderText(/you@example.com/i)
    const submitButton = screen.getByRole('button', { name: /send login link/i })

    // Fill in email and submit
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
    fireEvent.click(submitButton)

    // Check success screen
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /check your email/i })).toBeInTheDocument()
      expect(screen.getByText(/we've sent a login link to/i)).toBeInTheDocument()
      expect(screen.getByText(/user@example.com/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /try a different email/i })).toBeInTheDocument()
    })
  })

  it('should allow going back to form from success screen', async () => {
    mockSignInWithMagicLink.mockResolvedValueOnce(undefined)

    render(<LoginPage />)

    const emailInput = screen.getByPlaceholderText(/you@example.com/i)
    const submitButton = screen.getByRole('button', { name: /send login link/i })

    // Submit form
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
    fireEvent.click(submitButton)

    // Wait for success screen
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /check your email/i })).toBeInTheDocument()
    })

    // Click try different email
    const tryDifferentButton = screen.getByRole('button', { name: /try a different email/i })
    fireEvent.click(tryDifferentButton)

    // Should be back to form
    expect(screen.getByRole('heading', { name: /sign in to your account/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument()
  })

  it('should have proper accessibility attributes', () => {
    render(<LoginPage />)

    const emailInput = screen.getByPlaceholderText(/you@example.com/i)

    expect(emailInput).toHaveAttribute('type', 'email')
    expect(emailInput).toHaveAttribute('autoComplete', 'email')
    expect(emailInput).toHaveAttribute('id', 'email')

    // Check for label association
    expect(screen.getByLabelText(/email address/i)).toBe(emailInput)
  })
})
