import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { render } from '@/test/test-utils'
import RegisterPage from '@/pages/auth/RegisterPage'

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
const mockSignUp = vi.fn()
vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    signUp: mockSignUp,
  })),
}))

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render registration form with all required fields', () => {
    render(<RegisterPage />)

    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument()
    expect(screen.getByText(/i am a.../i)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /supplier/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /buyer/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('should display navigation link to login', () => {
    render(<RegisterPage />)

    expect(screen.getByRole('link', { name: /sign in to existing account/i })).toHaveAttribute(
      'href',
      '/login'
    )
  })

  it('should have supplier selected by default', () => {
    render(<RegisterPage />)

    const supplierRadio = screen.getByRole('radio', { name: /supplier/i })
    const buyerRadio = screen.getByRole('radio', { name: /buyer/i })

    expect(supplierRadio).toBeChecked()
    expect(buyerRadio).not.toBeChecked()
  })

  it('should allow switching between user types', () => {
    render(<RegisterPage />)

    const supplierRadio = screen.getByRole('radio', { name: /supplier/i })
    const buyerRadio = screen.getByRole('radio', { name: /buyer/i })

    // Initially supplier should be selected
    expect(supplierRadio).toBeChecked()
    expect(buyerRadio).not.toBeChecked()

    // Click buyer radio
    fireEvent.click(buyerRadio)

    expect(buyerRadio).toBeChecked()
    expect(supplierRadio).not.toBeChecked()

    // Click supplier radio again
    fireEvent.click(supplierRadio)

    expect(supplierRadio).toBeChecked()
    expect(buyerRadio).not.toBeChecked()
  })

  it('should validate email field', async () => {
    render(<RegisterPage />)

    const emailInput = screen.getByLabelText(/email address/i)
    const submitButton = screen.getByRole('button', { name: /create account/i })

    // Test invalid email
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/invalid email address/i)).toBeInTheDocument()
    })
  })

  it('should validate password length', async () => {
    render(<RegisterPage />)

    const passwordInput = screen.getByLabelText(/^password$/i)
    const submitButton = screen.getByRole('button', { name: /create account/i })

    // Test short password
    fireEvent.change(passwordInput, { target: { value: '1234567' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument()
    })
  })

  it('should validate password confirmation', async () => {
    render(<RegisterPage />)

    const passwordInput = screen.getByLabelText(/^password$/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const submitButton = screen.getByRole('button', { name: /create account/i })

    // Enter different passwords
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.change(confirmPasswordInput, { target: { value: 'different123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/passwords don't match/i)).toBeInTheDocument()
    })
  })

  it('should validate terms acceptance', async () => {
    render(<RegisterPage />)

    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText(/^password$/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const submitButton = screen.getByRole('button', { name: /create account/i })

    // Fill valid data but don't accept terms
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/you must accept the terms and conditions/i)).toBeInTheDocument()
    })
  })

  it('should handle successful registration', async () => {
    mockSignUp.mockResolvedValueOnce(undefined)

    render(<RegisterPage />)

    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText(/^password$/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const termsCheckbox = screen.getByRole('checkbox')
    const submitButton = screen.getByRole('button', { name: /create account/i })

    // Fill in valid data
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } })
    fireEvent.click(termsCheckbox)
    fireEvent.click(submitButton)

    // Check loading state
    await waitFor(() => {
      expect(screen.getByText(/creating account.../i)).toBeInTheDocument()
    })

    // Check that signUp was called with correct arguments (default supplier)
    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith('test@example.com', 'password123', 'supplier')
    })

    // Check navigation after successful registration
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/app/dashboard')
    })
  })

  it('should handle registration with buyer user type', async () => {
    mockSignUp.mockResolvedValueOnce(undefined)

    render(<RegisterPage />)

    const buyerRadio = screen.getByRole('radio', { name: /buyer/i })
    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText(/^password$/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const termsCheckbox = screen.getByRole('checkbox')
    const submitButton = screen.getByRole('button', { name: /create account/i })

    // Select buyer user type
    fireEvent.click(buyerRadio)

    // Fill in valid data
    fireEvent.change(emailInput, { target: { value: 'buyer@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } })
    fireEvent.click(termsCheckbox)
    fireEvent.click(submitButton)

    // Check that signUp was called with buyer type
    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith('buyer@example.com', 'password123', 'buyer')
    })
  })

  it('should handle registration error with Error instance', async () => {
    const errorMessage = 'Email already exists'
    mockSignUp.mockRejectedValueOnce(new Error(errorMessage))

    render(<RegisterPage />)

    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText(/^password$/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const termsCheckbox = screen.getByRole('checkbox')
    const submitButton = screen.getByRole('button', { name: /create account/i })

    // Fill in data
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } })
    fireEvent.click(termsCheckbox)
    fireEvent.click(submitButton)

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    // Check that loading state is cleared
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
    expect(screen.queryByText(/creating account.../i)).not.toBeInTheDocument()
  })

  it('should handle registration error with non-Error instance', async () => {
    mockSignUp.mockRejectedValueOnce('String error')

    render(<RegisterPage />)

    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText(/^password$/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const termsCheckbox = screen.getByRole('checkbox')
    const submitButton = screen.getByRole('button', { name: /create account/i })

    // Fill in data
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } })
    fireEvent.click(termsCheckbox)
    fireEvent.click(submitButton)

    // Wait for default error message to appear
    await waitFor(() => {
      expect(screen.getByText(/failed to create account/i)).toBeInTheDocument()
    })
  })

  it('should disable submit button while loading', async () => {
    // Mock a slow sign up to test loading state
    mockSignUp.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 1000)))

    render(<RegisterPage />)

    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText(/^password$/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const termsCheckbox = screen.getByRole('checkbox')
    const submitButton = screen.getByRole('button', { name: /create account/i })

    // Fill in data and submit
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } })
    fireEvent.click(termsCheckbox)
    fireEvent.click(submitButton)

    // Check that button is disabled and shows loading text
    await waitFor(() => {
      const loadingButton = screen.getByRole('button', { name: /creating account.../i })
      expect(loadingButton).toBeDisabled()
    })
  })

  it('should clear error when form is resubmitted', async () => {
    // First submission fails
    mockSignUp.mockRejectedValueOnce(new Error('Network error'))

    render(<RegisterPage />)

    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText(/^password$/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const termsCheckbox = screen.getByRole('checkbox')
    const submitButton = screen.getByRole('button', { name: /create account/i })

    // First submission
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } })
    fireEvent.click(termsCheckbox)
    fireEvent.click(submitButton)

    // Wait for error
    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })

    // Second submission should succeed
    mockSignUp.mockResolvedValueOnce(undefined)
    fireEvent.click(submitButton)

    // Error should be cleared
    await waitFor(() => {
      expect(screen.queryByText(/network error/i)).not.toBeInTheDocument()
    })
  })

  it('should display terms and privacy policy links', () => {
    render(<RegisterPage />)

    expect(screen.getByRole('link', { name: /terms and conditions/i })).toHaveAttribute(
      'href',
      '/terms'
    )
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute(
      'href',
      '/privacy'
    )
  })

  it('should have proper accessibility attributes', () => {
    render(<RegisterPage />)

    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText(/^password$/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)

    expect(emailInput).toHaveAttribute('type', 'email')
    expect(emailInput).toHaveAttribute('autoComplete', 'email')
    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(passwordInput).toHaveAttribute('autoComplete', 'new-password')
    expect(confirmPasswordInput).toHaveAttribute('type', 'password')
    expect(confirmPasswordInput).toHaveAttribute('autoComplete', 'new-password')
  })

  it('should show user type descriptions', () => {
    render(<RegisterPage />)

    expect(screen.getByText(/i have traffic to send/i)).toBeInTheDocument()
    expect(screen.getByText(/i need quality calls/i)).toBeInTheDocument()
  })

  it('should highlight selected user type visually', () => {
    render(<RegisterPage />)

    const supplierRadio = screen.getByRole('radio', { name: /supplier/i })
    const buyerRadio = screen.getByRole('radio', { name: /buyer/i })

    // Initially supplier should be highlighted
    expect(supplierRadio).toBeChecked()

    // Click buyer to switch
    fireEvent.click(buyerRadio)
    expect(buyerRadio).toBeChecked()
    expect(supplierRadio).not.toBeChecked()
  })

  it('should not submit form with missing required fields', async () => {
    render(<RegisterPage />)

    const submitButton = screen.getByRole('button', { name: /create account/i })

    // Submit empty form
    fireEvent.click(submitButton)

    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText(/invalid email address/i)).toBeInTheDocument()
      expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument()
      expect(screen.getByText(/you must accept the terms and conditions/i)).toBeInTheDocument()
    })

    // Should not call signUp
    expect(mockSignUp).not.toHaveBeenCalled()
  })
})
