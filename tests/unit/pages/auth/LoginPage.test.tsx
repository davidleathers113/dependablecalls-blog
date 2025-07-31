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
const mockSignIn = vi.fn()
vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    signIn: mockSignIn,
  })),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render login form with all required fields', () => {
    render(<LoginPage />)

    expect(screen.getByRole('heading', { name: /sign in to your account/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/email address/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /remember me/i })).toBeInTheDocument()
  })

  it('should display navigation links', () => {
    render(<LoginPage />)

    expect(screen.getByRole('link', { name: /create a new account/i })).toHaveAttribute(
      'href',
      '/register'
    )
    expect(screen.getByRole('link', { name: /forgot your password/i })).toHaveAttribute(
      'href',
      '/forgot-password'
    )
  })

  it('should validate email field', async () => {
    render(<LoginPage />)

    const emailInput = screen.getByPlaceholderText(/email address/i)
    const passwordInput = screen.getByPlaceholderText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    // Test invalid email - need valid password to trigger email validation
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
    fireEvent.change(passwordInput, { target: { value: 'validpassword' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/invalid email address/i)).toBeInTheDocument()
    })
  })

  it('should validate password field', async () => {
    render(<LoginPage />)

    const emailInput = screen.getByPlaceholderText(/email address/i)
    const passwordInput = screen.getByPlaceholderText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    // Test short password - need valid email to trigger password validation
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: '12345' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 6 characters/i)).toBeInTheDocument()
    })
  })

  it('should handle successful login', async () => {
    mockSignIn.mockResolvedValueOnce(undefined)

    render(<LoginPage />)

    const emailInput = screen.getByPlaceholderText(/email address/i)
    const passwordInput = screen.getByPlaceholderText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    // Fill in valid credentials
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    // Check loading state
    await waitFor(() => {
      expect(screen.getByText(/signing in.../i)).toBeInTheDocument()
    })

    // Check that signIn was called with correct arguments
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123')
    })

    // Check navigation after successful login
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/app/dashboard')
    })
  })

  it('should handle login error with Error instance', async () => {
    const errorMessage = 'Invalid credentials'
    mockSignIn.mockRejectedValueOnce(new Error(errorMessage))

    render(<LoginPage />)

    const emailInput = screen.getByPlaceholderText(/email address/i)
    const passwordInput = screen.getByPlaceholderText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    // Fill in credentials
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
    fireEvent.click(submitButton)

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    // Check that loading state is cleared
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.queryByText(/signing in.../i)).not.toBeInTheDocument()
  })

  it('should handle login error with non-Error instance', async () => {
    mockSignIn.mockRejectedValueOnce('String error')

    render(<LoginPage />)

    const emailInput = screen.getByPlaceholderText(/email address/i)
    const passwordInput = screen.getByPlaceholderText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    // Fill in credentials
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
    fireEvent.click(submitButton)

    // Wait for default error message to appear
    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument()
    })
  })

  it('should disable submit button while loading', async () => {
    // Mock a slow sign in to test loading state
    mockSignIn.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 1000)))

    render(<LoginPage />)

    const emailInput = screen.getByPlaceholderText(/email address/i)
    const passwordInput = screen.getByPlaceholderText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    // Fill in credentials and submit
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    // Check that button is disabled and shows loading text
    await waitFor(() => {
      const loadingButton = screen.getByRole('button', { name: /signing in.../i })
      expect(loadingButton).toBeDisabled()
    })
  })

  it('should clear error when form is resubmitted', async () => {
    // First submission fails
    mockSignIn.mockRejectedValueOnce(new Error('Network error'))

    render(<LoginPage />)

    const emailInput = screen.getByPlaceholderText(/email address/i)
    const passwordInput = screen.getByPlaceholderText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    // First submission
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    // Wait for error
    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })

    // Second submission should succeed
    mockSignIn.mockResolvedValueOnce(undefined)
    fireEvent.click(submitButton)

    // Error should be cleared
    await waitFor(() => {
      expect(screen.queryByText(/network error/i)).not.toBeInTheDocument()
    })
  })

  it('should not submit form with missing fields', async () => {
    render(<LoginPage />)

    const submitButton = screen.getByRole('button', { name: /sign in/i })

    // Submit empty form
    fireEvent.click(submitButton)

    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText(/invalid email address/i)).toBeInTheDocument()
      expect(screen.getByText(/password must be at least 6 characters/i)).toBeInTheDocument()
    })

    // Should not call signIn
    expect(mockSignIn).not.toHaveBeenCalled()
  })

  it('should allow checking remember me checkbox', () => {
    render(<LoginPage />)

    const rememberMeCheckbox = screen.getByRole('checkbox', { name: /remember me/i })

    expect(rememberMeCheckbox).not.toBeChecked()

    fireEvent.click(rememberMeCheckbox)

    expect(rememberMeCheckbox).toBeChecked()
  })

  it('should handle form submission with Enter key', async () => {
    mockSignIn.mockResolvedValueOnce(undefined)

    render(<LoginPage />)

    const emailInput = screen.getByPlaceholderText(/email address/i)
    const passwordInput = screen.getByPlaceholderText(/password/i)

    // Fill in credentials
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })

    // Submit with Enter key on password field
    fireEvent.keyDown(passwordInput, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123')
    })
  })

  it('should have proper accessibility attributes', () => {
    render(<LoginPage />)

    const emailInput = screen.getByPlaceholderText(/email address/i)
    const passwordInput = screen.getByPlaceholderText(/password/i)

    expect(emailInput).toHaveAttribute('type', 'email')
    expect(emailInput).toHaveAttribute('autoComplete', 'email')
    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(passwordInput).toHaveAttribute('autoComplete', 'current-password')

    // Check for label association
    expect(screen.getByLabelText(/email address/i)).toBe(emailInput)
    expect(screen.getByLabelText(/password/i)).toBe(passwordInput)
  })
})
