import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ErrorBoundary, type ErrorFallbackProps } from '../../../src/components/common/ErrorBoundary'
import { withErrorBoundary } from '../../../src/components/common/withErrorBoundary'
import { useErrorHandler } from '../../../src/hooks/useErrorHandler'

// Mock the monitoring module
vi.mock('../../../src/lib/monitoring', () => ({
  captureError: vi.fn(),
  addBreadcrumb: vi.fn(),
}))

// Mock console methods to avoid noise in tests
const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
const consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {})
const consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {})

// Test component that throws an error
const ThrowError: React.FC<{ shouldThrow?: boolean; message?: string }> = ({
  shouldThrow = false,
  message = 'Test error',
}) => {
  if (shouldThrow) {
    throw new Error(message)
  }
  return <div>No error</div>
}

// Custom fallback component for testing
const CustomFallback: React.FC<ErrorFallbackProps> = ({ error, resetError, level }) => (
  <div data-testid="custom-fallback">
    <span>Custom fallback - Level: {level}</span>
    <span>Error: {error.message}</span>
    <button onClick={resetError} data-testid="custom-reset">
      Custom Reset
    </button>
  </div>
)

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    consoleSpy.mockClear()
    consoleGroupSpy.mockClear()
    consoleGroupEndSpy.mockClear()
  })

  describe('Normal rendering', () => {
    it('renders children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div data-testid="child">Child component</div>
        </ErrorBoundary>
      )

      expect(screen.getByTestId('child')).toBeInTheDocument()
      expect(screen.getByText('Child component')).toBeInTheDocument()
    })

    it('renders multiple children correctly', () => {
      render(
        <ErrorBoundary>
          <div data-testid="child1">Child 1</div>
          <div data-testid="child2">Child 2</div>
        </ErrorBoundary>
      )

      expect(screen.getByTestId('child1')).toBeInTheDocument()
      expect(screen.getByTestId('child2')).toBeInTheDocument()
    })
  })

  describe('Error handling', () => {
    it('catches errors and displays default fallback UI', () => {
      render(
        <ErrorBoundary level="component">
          <ThrowError shouldThrow message="Test error message" />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Refresh Page' })).toBeInTheDocument()
    })

    it('displays error message consistently', () => {
      render(
        <ErrorBoundary level="page">
          <ThrowError shouldThrow />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Refresh Page' })).toBeInTheDocument()
    })

    it('shows refresh page button', () => {
      render(
        <ErrorBoundary level="page">
          <ThrowError shouldThrow />
        </ErrorBoundary>
      )

      expect(screen.getByRole('button', { name: 'Refresh Page' })).toBeInTheDocument()
    })
  })

  describe('Custom fallback component', () => {
    it('renders custom fallback component when provided', () => {
      render(
        <ErrorBoundary fallback={CustomFallback} level="section">
          <ThrowError shouldThrow message="Custom test error" />
        </ErrorBoundary>
      )

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument()
      expect(screen.getByText('Custom fallback - Level: section')).toBeInTheDocument()
      expect(screen.getByText('Error: Custom test error')).toBeInTheDocument()
      expect(screen.getByTestId('custom-reset')).toBeInTheDocument()
    })
  })

  describe('Error reset functionality', () => {
    it('resets error state when reset button is clicked', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      )

      // Error should be displayed
      expect(screen.getByRole('alert')).toBeInTheDocument()

      // Click reset button
      fireEvent.click(screen.getByText('Try Again'))

      // Rerender with non-throwing component
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      )

      // Should show normal content
      expect(screen.getByText('No error')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('resets with custom fallback reset button', () => {
      const { rerender } = render(
        <ErrorBoundary fallback={CustomFallback}>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      )

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument()

      fireEvent.click(screen.getByTestId('custom-reset'))

      rerender(
        <ErrorBoundary fallback={CustomFallback}>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      )

      expect(screen.getByText('No error')).toBeInTheDocument()
    })
  })

  describe('Reset on props change', () => {
    it('resets error when resetKeys change', () => {
      let resetKey = 0
      const { rerender } = render(
        <ErrorBoundary resetKeys={[resetKey]} resetOnPropsChange>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      )

      // Error should be displayed
      expect(screen.getByRole('alert')).toBeInTheDocument()

      // Change resetKey
      resetKey = 1
      rerender(
        <ErrorBoundary resetKeys={[resetKey]} resetOnPropsChange>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      )

      // Should show normal content after reset
      expect(screen.getByText('No error')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('Error callback', () => {
    it('calls onError callback when error occurs', () => {
      const onErrorSpy = vi.fn()

      render(
        <ErrorBoundary onError={onErrorSpy}>
          <ThrowError shouldThrow message="Callback test error" />
        </ErrorBoundary>
      )

      expect(onErrorSpy).toHaveBeenCalledTimes(1)
      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Callback test error',
        }),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      )
    })

    it('handles errors in onError callback gracefully', () => {
      const faultyCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error')
      })

      // Should not crash when callback throws
      expect(() => {
        render(
          <ErrorBoundary onError={faultyCallback}>
            <ThrowError shouldThrow />
          </ErrorBoundary>
        )
      }).not.toThrow()

      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  describe('withErrorBoundary HOC', () => {
    it('wraps component with error boundary', () => {
      const TestComponent = ({ shouldThrow }: { shouldThrow: boolean }) => (
        <ThrowError shouldThrow={shouldThrow} />
      )

      const WrappedComponent = withErrorBoundary(TestComponent, {
        level: 'component',
      })

      render(<WrappedComponent shouldThrow />)

      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Component Error')).toBeInTheDocument()
    })

    it('passes props correctly to wrapped component', () => {
      const TestComponent = ({ testProp }: { testProp: string }) => (
        <div data-testid="wrapped-component">{testProp}</div>
      )

      const WrappedComponent = withErrorBoundary(TestComponent)

      render(<WrappedComponent testProp="test value" />)

      expect(screen.getByTestId('wrapped-component')).toBeInTheDocument()
      expect(screen.getByText('test value')).toBeInTheDocument()
    })
  })

  describe('Development mode features', () => {
    const originalMode = import.meta.env.MODE

    beforeEach(() => {
      // Mock development mode
      Object.defineProperty(import.meta.env, 'MODE', {
        value: 'development',
        writable: true,
      })
    })

    afterEach(() => {
      // Restore original mode
      Object.defineProperty(import.meta.env, 'MODE', {
        value: originalMode,
        writable: true,
      })
    })

    it('shows error details in development mode', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow message="Dev error" />
        </ErrorBoundary>
      )

      expect(screen.getByText('Error Details (Development Only)')).toBeInTheDocument()

      // Click details to expand
      fireEvent.click(screen.getByText('Error Details (Development Only)'))

      expect(screen.getByText('Dev error')).toBeInTheDocument()
    })
  })

  describe('useErrorHandler hook', () => {
    it('provides error handling function', async () => {
      let errorHandler: ((error: Error) => void) | null = null

      const TestComponent = () => {
        errorHandler = useErrorHandler()
        return <div>Test</div>
      }

      render(<TestComponent />)

      expect(errorHandler).toBeInstanceOf(Function)

      // Test calling the error handler
      const testError = new Error('Manual error')
      errorHandler!(testError)

      // Should call monitoring functions (these are mocked)
      const monitoring = await import('../../../src/lib/monitoring')
      const { captureError, addBreadcrumb } = monitoring
      expect(captureError).toHaveBeenCalledWith(
        testError,
        expect.objectContaining({
          context: 'useErrorHandler',
        })
      )
      expect(addBreadcrumb).toHaveBeenCalled()
    })
  })
})
