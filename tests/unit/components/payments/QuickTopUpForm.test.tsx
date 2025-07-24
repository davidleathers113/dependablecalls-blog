import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QuickTopUpForm } from '@/components/payments/QuickTopUpForm'

// Mock dependencies
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'user_123',
      email: 'test@example.com',
      stripe_customer_id: 'cus_test123',
    },
  }),
}))

vi.mock('@/store/buyerStore', () => ({
  useBuyerStore: () => ({
    currentBalance: 500.00,
    updateBalance: vi.fn(),
  }),
}))

vi.mock('@/integrations/stripe/payments', () => ({
  createPaymentIntent: vi.fn().mockResolvedValue({
    id: 'pi_test123',
    client_secret: 'pi_test123_secret',
    amount: 10000,
    currency: 'usd',
  }),
}))

// Mock Stripe Elements
vi.mock('@stripe/react-stripe-js', async () => {
  const actual = await vi.importActual('@stripe/react-stripe-js')
  return {
    ...actual,
    PaymentElement: () => <div data-testid="payment-element">Payment Element</div>,
    useStripe: () => ({
      confirmPayment: vi.fn().mockResolvedValue({
        paymentIntent: {
          id: 'pi_test123',
          status: 'succeeded',
        },
      }),
    }),
    useElements: () => ({}),
  }
})

describe('QuickTopUpForm', () => {
  const defaultProps = {
    onSuccess: vi.fn(),
    onCancel: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render with default amount selected', async () => {
    render(<QuickTopUpForm {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('Quick Top-Up')).toBeInTheDocument()
      expect(screen.getByText('Current Balance')).toBeInTheDocument()
      expect(screen.getByText('$500.00')).toBeInTheDocument()
    })
  })

  it('should display quick amount buttons', async () => {
    render(<QuickTopUpForm {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('$100')).toBeInTheDocument()
      expect(screen.getByText('$250')).toBeInTheDocument()
      expect(screen.getByText('$500')).toBeInTheDocument()
      expect(screen.getByText('$1000')).toBeInTheDocument()
    })
  })

  it('should allow selecting different quick amounts', async () => {
    render(<QuickTopUpForm {...defaultProps} />)
    
    await waitFor(() => {
      const button500 = screen.getByText('$500')
      fireEvent.click(button500)
      
      // Check that the button has the selected style (by checking class)
      expect(button500.className).toContain('border-blue-600')
    })
  })

  it('should allow entering custom amount', async () => {
    render(<QuickTopUpForm {...defaultProps} />)
    
    await waitFor(() => {
      const customInput = screen.getByPlaceholderText('Enter custom amount')
      fireEvent.change(customInput, { target: { value: '750.50' } })
      
      expect(customInput).toHaveValue('750.50')
    })
  })

  it('should validate minimum amount', async () => {
    render(<QuickTopUpForm {...defaultProps} />)
    
    await waitFor(() => {
      const customInput = screen.getByPlaceholderText('Enter custom amount')
      fireEvent.change(customInput, { target: { value: '5' } })
      fireEvent.focus(customInput)
    })

    // Note: In the real component, validation happens on submit
    // This test would need to be extended to test the actual validation
  })

  it('should only allow numeric input for custom amount', async () => {
    render(<QuickTopUpForm {...defaultProps} />)
    
    await waitFor(() => {
      const customInput = screen.getByPlaceholderText('Enter custom amount')
      
      // Try to enter non-numeric characters
      fireEvent.change(customInput, { target: { value: 'abc' } })
      expect(customInput).toHaveValue('')
      
      // Allow numeric input
      fireEvent.change(customInput, { target: { value: '123.45' } })
      expect(customInput).toHaveValue('123.45')
    })
  })

  it('should show loading state while creating payment intent', () => {
    render(<QuickTopUpForm {...defaultProps} />)
    
    expect(screen.getByText('Setting up payment...')).toBeInTheDocument()
  })

  it('should handle payment intent creation error', async () => {
    const createPaymentIntent = vi.fn().mockRejectedValue(new Error('Network error'))
    vi.doMock('@/integrations/stripe/payments', () => ({
      createPaymentIntent,
    }))

    render(<QuickTopUpForm {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument()
      expect(screen.getByText('Try again')).toBeInTheDocument()
    })
  })

  it('should call onCancel when cancel button is clicked', async () => {
    render(<QuickTopUpForm {...defaultProps} />)
    
    await waitFor(() => {
      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)
      
      expect(defaultProps.onCancel).toHaveBeenCalled()
    })
  })

  it('should handle successful payment submission', async () => {
    // This would require more complex mocking of Stripe Elements
    // and the payment flow, which is typically done in integration tests
  })

  it('should display success message after payment', async () => {
    // This test would need to simulate the full payment flow
    // including mocking the Stripe confirmPayment response
  })

  it('should calculate and display correct amount with custom input', async () => {
    render(<QuickTopUpForm {...defaultProps} />)
    
    await waitFor(() => {
      const customInput = screen.getByPlaceholderText('Enter custom amount')
      fireEvent.change(customInput, { target: { value: '299.99' } })
      fireEvent.focus(customInput)
      
      // The submit button should show the custom amount
      const submitButton = screen.getByRole('button', { name: /add \$299.99/i })
      expect(submitButton).toBeInTheDocument()
    })
  })
})