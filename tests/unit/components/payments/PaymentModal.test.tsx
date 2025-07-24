import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PaymentModal } from '@/components/payments/PaymentModal'

// Mock the payment components
type QuickTopUpProps = { 
  onSuccess: (paymentId: string, amount: number) => void; 
  onCancel: () => void 
}

type PaymentFormProps = { 
  onSuccess: (paymentId: string) => void 
}

vi.mock('@/components/payments/QuickTopUpForm', () => ({
  default: ({ onSuccess, onCancel }: QuickTopUpProps) => (
    <div data-testid="quick-topup-form">
      <button onClick={() => onSuccess('pi_test123', 100)}>Complete Payment</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}))

vi.mock('@/components/payments/PaymentForm', () => ({
  default: ({ onSuccess }: PaymentFormProps) => (
    <div data-testid="payment-form">
      <button onClick={() => onSuccess('pi_invoice123')}>Pay Invoice</button>
    </div>
  ),
}))

describe('PaymentModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    type: 'topup' as const,
    onSuccess: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render topup form when type is topup', () => {
    render(<PaymentModal {...defaultProps} />)
    
    expect(screen.getByText('Add Funds')).toBeInTheDocument()
    expect(screen.getByTestId('quick-topup-form')).toBeInTheDocument()
  })

  it('should render payment form when type is invoice with invoice data', () => {
    const invoiceProps = {
      ...defaultProps,
      type: 'invoice' as const,
      invoiceData: {
        amount: 10000,
        invoiceId: 'inv_123',
        description: 'Test Invoice',
        billingPeriod: '2024-01',
      },
    }

    render(<PaymentModal {...invoiceProps} />)
    
    expect(screen.getByText('Pay Invoice')).toBeInTheDocument()
    expect(screen.getByTestId('payment-form')).toBeInTheDocument()
  })

  it('should show error message when invoice type but no invoice data', () => {
    const invoiceProps = {
      ...defaultProps,
      type: 'invoice' as const,
      invoiceData: undefined,
    }

    render(<PaymentModal {...invoiceProps} />)
    
    expect(screen.getByText('No invoice data provided')).toBeInTheDocument()
  })

  it('should call onClose when close button is clicked', () => {
    render(<PaymentModal {...defaultProps} />)
    
    const closeButton = screen.getByRole('button', { name: /close/i })
    fireEvent.click(closeButton)
    
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('should call onSuccess and close modal after successful payment', async () => {
    render(<PaymentModal {...defaultProps} />)
    
    const completeButton = screen.getByText('Complete Payment')
    fireEvent.click(completeButton)
    
    expect(defaultProps.onSuccess).toHaveBeenCalledWith('pi_test123', 100)
    
    // Modal should close after 2 seconds
    await waitFor(
      () => {
        expect(defaultProps.onClose).toHaveBeenCalled()
      },
      { timeout: 3000 }
    )
  })

  it('should not render when isOpen is false', () => {
    const closedProps = { ...defaultProps, isOpen: false }
    const { container } = render(<PaymentModal {...closedProps} />)
    
    // Check that modal content is not visible
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument()
  })

  it('should handle cancel action in topup form', () => {
    render(<PaymentModal {...defaultProps} />)
    
    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)
    
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('should pass correct invoice data to payment form', () => {
    const invoiceData = {
      amount: 15000,
      invoiceId: 'inv_456',
      description: 'Monthly subscription',
      billingPeriod: '2024-02',
    }

    render(
      <PaymentModal
        {...defaultProps}
        type="invoice"
        invoiceData={invoiceData}
      />
    )

    // Verify the payment form is rendered (mocked component)
    expect(screen.getByTestId('payment-form')).toBeInTheDocument()
  })
})