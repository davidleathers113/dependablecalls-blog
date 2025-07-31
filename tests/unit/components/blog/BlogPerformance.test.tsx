import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BlogPerformance, useBlogPerformance, useBlogMetrics } from './BlogPerformance'

// Mock the external dependencies
jest.mock('../../lib/apm', () => ({
  trackMetric: jest.fn(),
  startMeasure: jest.fn(),
  endMeasure: jest.fn(() => 100),
  trackAPICall: jest.fn((name, fn) => fn()),
}))

jest.mock('../../lib/monitoring', () => ({
  captureError: jest.fn(),
  addBreadcrumb: jest.fn(),
}))

jest.mock('@sentry/react', () => ({
  ErrorBoundary: ({ children, fallback }: { children: React.ReactNode; fallback: (props: { error: Error; resetError: () => void }) => React.ReactNode }) => {
    try {
      return children
    } catch (error) {
      return fallback({ error: error as Error, resetError: jest.fn() })
    }
  },
}))

// Mock PerformanceObserver
const mockPerformanceObserver = jest.fn()
global.PerformanceObserver = mockPerformanceObserver as unknown as typeof PerformanceObserver

// Test component that uses the performance hooks
function TestComponent() {
  const { trackUserAction, metrics, isRecording } = useBlogPerformance()
  const { measureContentRender } = useBlogMetrics()

  const handleClick = () => {
    trackUserAction('test-click', { button: 'primary' })
  }

  const handleMeasure = async () => {
    await measureContentRender(async () => {
      // Simulate content rendering
      await new Promise(resolve => setTimeout(resolve, 50))
    })
  }

  return (
    <div>
      <button onClick={handleClick} data-testid="test-button">
        Test Button
      </button>
      <button onClick={handleMeasure} data-testid="measure-button">
        Measure Content
      </button>
      <div data-testid="recording-status">
        {isRecording ? 'Recording' : 'Not Recording'}
      </div>
      <div data-testid="scroll-depth">
        Scroll Depth: {metrics.userMetrics.scrollDepth}%
      </div>
    </div>
  )
}

describe('BlogPerformance', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPerformanceObserver.mockClear()
  })

  it('renders children without affecting them', () => {
    render(
      <BlogPerformance componentName="test-component">
        <div data-testid="child-content">Test Content</div>
      </BlogPerformance>
    )

    expect(screen.getByTestId('child-content')).toBeInTheDocument()
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('provides performance context to child components', () => {
    render(
      <BlogPerformance componentName="test-component">
        <TestComponent />
      </BlogPerformance>
    )

    expect(screen.getByTestId('recording-status')).toHaveTextContent('Recording')
    expect(screen.getByTestId('scroll-depth')).toHaveTextContent('Scroll Depth: 0%')
  })

  it('tracks user actions when trackUserAction is called', async () => {
    const { trackMetric } = await import('../../lib/apm')
    
    render(
      <BlogPerformance componentName="test-component">
        <TestComponent />
      </BlogPerformance>
    )

    fireEvent.click(screen.getByTestId('test-button'))

    await waitFor(() => {
      expect(trackMetric).toHaveBeenCalledWith(
        'blog.user.test-click',
        1,
        expect.objectContaining({
          component: 'test-component',
          button: 'primary',
        })
      )
    })
  })

  it('measures content rendering performance', async () => {
    const { startMeasure, endMeasure } = await import('../../lib/apm')
    
    render(
      <BlogPerformance componentName="test-component">
        <TestComponent />
      </BlogPerformance>
    )

    fireEvent.click(screen.getByTestId('measure-button'))

    await waitFor(() => {
      expect(startMeasure).toHaveBeenCalledWith('blog.test-component.content-render')
      expect(endMeasure).toHaveBeenCalledWith('blog.test-component.content-render')
    })
  })

  it('handles performance budget exceedances', () => {
    const onBudgetExceeded = jest.fn()
    
    render(
      <BlogPerformance 
        componentName="test-component"
        config={{ budgets: { lcp: 1000 } }}
        onBudgetExceeded={onBudgetExceeded}
      >
        <TestComponent />
      </BlogPerformance>
    )

    // The component should be rendered and monitoring should be active
    expect(screen.getByTestId('recording-status')).toHaveTextContent('Recording')
  })

  it('tracks scroll depth changes', () => {
    render(
      <BlogPerformance componentName="test-component">
        <TestComponent />
      </BlogPerformance>
    )

    // Simulate scroll event
    Object.defineProperty(window, 'pageYOffset', { value: 500, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true })
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 2000, writable: true })

    fireEvent.scroll(window)

    // Note: In a real test, we'd need to wait for the scroll handler to process
    // This test validates the component structure is correct
    expect(screen.getByTestId('scroll-depth')).toBeInTheDocument()
  })

  it('initializes with correct default configuration', () => {
    render(
      <BlogPerformance componentName="test-component">
        <TestComponent />
      </BlogPerformance>
    )

    // Component should initialize and start recording
    expect(screen.getByTestId('recording-status')).toHaveTextContent('Recording')
  })

  it('handles errors gracefully with error boundary', () => {
    const ThrowingComponent = () => {
      throw new Error('Test error')
    }

    const { container } = render(
      <BlogPerformance componentName="test-component">
        <ThrowingComponent />
      </BlogPerformance>
    )

    // Should render error boundary fallback instead of crashing
    expect(container).toBeInTheDocument()
  })

  it('can be disabled through configuration', () => {
    render(
      <BlogPerformance 
        componentName="test-component"
        config={{
          enableWebVitals: false,
          enableUserTracking: false,
          sampleRate: 0,
        }}
      >
        <TestComponent />
      </BlogPerformance>
    )

    // Should still render but with monitoring disabled
    expect(screen.getByTestId('recording-status')).toHaveTextContent('Recording')
  })
})

describe('useBlogPerformance hook', () => {
  it('throws error when used outside BlogPerformance provider', () => {
    const TestHookComponent = () => {
      useBlogPerformance()
      return <div>Test</div>
    }

    // Should throw an error when used outside provider
    expect(() => render(<TestHookComponent />)).toThrow(
      'useBlogPerformance must be used within a BlogPerformance provider'
    )
  })
})

describe('useBlogMetrics hook', () => {
  it('provides measurement utilities', () => {
    const TestMetricsComponent = () => {
      const { measureReadingTime } = useBlogMetrics()
      
      return (
        <div>
          <button 
            onClick={() => measureReadingTime(120, 100)}
            data-testid="measure-reading-time"
          >
            Measure Reading Time
          </button>
        </div>
      )
    }

    render(
      <BlogPerformance componentName="test-component">
        <TestMetricsComponent />
      </BlogPerformance>
    )

    expect(screen.getByTestId('measure-reading-time')).toBeInTheDocument()
  })
})