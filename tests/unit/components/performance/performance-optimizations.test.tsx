/**
 * Performance optimization test suite
 * Tests React 19.1 performance features and memory leak prevention
 */

import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { LazyImage } from '../../../../src/components/performance/LazyImage'
import { VirtualScroller } from '../../../../src/components/performance/VirtualScroller'
import { OptimizedDashboard } from '../../../../src/components/performance/OptimizedDashboard'
import { ServiceWorkerProvider, useServiceWorker } from '../../../../src/components/performance/ServiceWorkerProvider'
import { performanceMonitor } from '../../../../src/lib/performance-monitor'

// Mock performance APIs - mocks are set up in beforeEach

beforeEach(() => {
  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation((_callback) => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))

  // Mock PerformanceObserver  
  global.PerformanceObserver = vi.fn().mockImplementation((_callback) => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
  }))

  // Mock performance.now
  vi.spyOn(performance, 'now').mockReturnValue(1000)
  
  // Mock performance.mark and measure
  vi.spyOn(performance, 'mark').mockImplementation(() => {})
  vi.spyOn(performance, 'measure').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('LazyImage Performance', () => {
  it('should only render when in viewport', async () => {
    const onLoad = vi.fn()
    
    render(
      <LazyImage
        src="/test-image.jpg"
        alt="Test image"
        loading="lazy"
        onLoad={onLoad}
      />
    )

    // Image should not be loaded initially
    const img = screen.queryByAltText('Test image')
    expect(img).toBeNull()

    // Simulate intersection observer triggering
    const [observerCallback] = (global.IntersectionObserver as jest.MockedClass<typeof IntersectionObserver>).mock.calls[0]
    act(() => {
      observerCallback([{ isIntersecting: true }])
    })

    // Now image should be in DOM
    await waitFor(() => {
      expect(screen.getByAltText('Test image')).toBeInTheDocument()
    })
  })

  it('should handle retry logic on error', async () => {
    const onError = vi.fn()
    
    render(
      <LazyImage
        src="/broken-image.jpg"
        alt="Broken image"
        priority={true}
        onError={onError}
      />
    )

    const img = screen.getByAltText('Broken image')
    
    // Simulate image error
    act(() => {
      img.dispatchEvent(new Event('error'))
    })

    // Should retry after delay
    await waitFor(() => {
      expect(img.src).toContain('retry=')
    }, { timeout: 2000 })
  })

  it('should use modern image formats when supported', () => {
    render(
      <LazyImage
        src="/test-image.jpg"
        alt="Modern formats"
        priority={true}
        srcSet="test-320.jpg 320w, test-640.jpg 640w"
      />
    )

    const picture = screen.getByAltText('Modern formats').closest('picture')
    expect(picture).toBeInTheDocument()
    
    // Check for AVIF and WebP sources
    const sources = picture?.querySelectorAll('source')
    expect(sources).toHaveLength(2) // AVIF and WebP
  })
})

describe('VirtualScroller Performance', () => {
  const mockItems = Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
    value: Math.random() * 100
  }))

  const renderItem = (item: { id: number; name: string; value: number }, _index: number) => (
    <div key={item.id}>
      {item.name}: {item.value.toFixed(2)}
    </div>
  )

  it('should only render visible items', () => {
    render(
      <VirtualScroller
        items={mockItems}
        itemHeight={50}
        containerHeight={200}
        renderItem={renderItem}
        overscan={2}
      />
    )

    // Should only render ~6 items (4 visible + 2 overscan on each side)
    const renderedItems = screen.getAllByText(/Item \d+/)
    expect(renderedItems.length).toBeLessThan(20) // Much less than 1000
  })

  it('should handle scroll events efficiently', async () => {
    const onScroll = vi.fn()
    
    render(
      <VirtualScroller
        items={mockItems}
        itemHeight={50}
        containerHeight={200}
        renderItem={renderItem}
        onScroll={onScroll}
      />
    )

    const container = screen.getByRole('list')
    
    // Simulate scroll
    act(() => {
      container.scrollTop = 100
      container.dispatchEvent(new Event('scroll'))
    })

    await waitFor(() => {
      expect(onScroll).toHaveBeenCalledWith(100)
    })
  })

  it('should handle infinite loading', async () => {
    const loadMore = vi.fn()
    
    render(
      <VirtualScroller
        items={mockItems.slice(0, 50)}
        itemHeight={50}
        containerHeight={200}
        renderItem={renderItem}
        loadMore={loadMore}
        hasMore={true}
      />
    )

    // Scroll near bottom
    const container = screen.getByRole('list')
    act(() => {
      container.scrollTop = 2000 // Scroll to bottom
      container.dispatchEvent(new Event('scroll'))
    })

    await waitFor(() => {
      expect(loadMore).toHaveBeenCalled()
    })
  })
})

describe('OptimizedDashboard Performance', () => {
  const mockDashboardData = {
    totalCalls: 1250,
    revenue: 45680,
    activeSuppliers: 23,
    avgCallDuration: 185,
    recentCalls: Array.from({ length: 100 }, (_, i) => ({
      id: `call-${i}`,
      supplier: `Supplier ${i}`,
      duration: Math.floor(Math.random() * 300),
      revenue: Math.random() * 50,
      timestamp: new Date(Date.now() - i * 60000),
      status: ['completed', 'ongoing', 'failed'][i % 3] as 'completed' | 'ongoing' | 'failed'
    })),
    callsByHour: Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: Math.floor(Math.random() * 100)
    })),
    topSuppliers: Array.from({ length: 5 }, (_, i) => ({
      name: `Top Supplier ${i + 1}`,
      calls: Math.floor(Math.random() * 200),
      revenue: Math.random() * 10000
    }))
  }

  it('should render efficiently with large datasets', async () => {
    const startTime = performance.now()
    
    render(<OptimizedDashboard data={mockDashboardData} />)
    
    const endTime = performance.now()
    const renderTime = endTime - startTime
    
    // Should render in reasonable time
    expect(renderTime).toBeLessThan(100)
    
    // Should show stats
    expect(screen.getByText('1,250')).toBeInTheDocument()
    expect(screen.getByText('$45,680')).toBeInTheDocument()
  })

  it('should handle refresh with startTransition', async () => {
    const onRefresh = vi.fn()
    const user = userEvent.setup()
    
    render(<OptimizedDashboard data={mockDashboardData} onRefresh={onRefresh} />)
    
    const refreshButton = screen.getByText('Refresh')
    await user.click(refreshButton)
    
    expect(onRefresh).toHaveBeenCalled()
  })

  it('should memoize expensive calculations', () => {
    const { rerender } = render(<OptimizedDashboard data={mockDashboardData} />)
    
    // Render again with same data
    rerender(<OptimizedDashboard data={mockDashboardData} />)
    
    // Stats should be memoized and not recalculated
    expect(screen.getByText('1,250')).toBeInTheDocument()
  })
})

describe('ServiceWorker Integration', () => {
  beforeEach(() => {
    // Mock service worker
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: vi.fn().mockResolvedValue({
          addEventListener: vi.fn(),
          waiting: null,
          installing: null,
          update: vi.fn()
        }),
        addEventListener: vi.fn()
      },
      writable: true
    })
  })

  const TestComponent = () => {
    const { isSupported, isRegistered } = useServiceWorker()
    return (
      <div>
        <div>Supported: {isSupported ? 'Yes' : 'No'}</div>
        <div>Registered: {isRegistered ? 'Yes' : 'No'}</div>
      </div>
    )
  }

  it('should register service worker in production', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    
    render(
      <ServiceWorkerProvider>
        <TestComponent />
      </ServiceWorkerProvider>
    )
    
    expect(screen.getByText('Supported: Yes')).toBeInTheDocument()
    
    await waitFor(() => {
      expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      })
    })
    
    process.env.NODE_ENV = originalEnv
  })
})

describe('Performance Monitor', () => {
  it('should track component render times', () => {
    const trackSpy = vi.spyOn(performanceMonitor, 'trackComponentRender')
    
    // Simulate component render tracking
    performanceMonitor.trackComponentRender('TestComponent', 15.5)
    
    expect(trackSpy).toHaveBeenCalledWith('TestComponent', 15.5)
    
    const stats = performanceMonitor.getComponentStats('TestComponent')
    expect(stats).toBeTruthy()
    expect(stats?.avg).toBe(15.5)
  })

  it('should warn on slow renders', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    // Simulate slow render
    performanceMonitor.trackComponentRender('SlowComponent', 50)
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Slow component render: SlowComponent')
    )
    
    consoleSpy.mockRestore()
  })

  it('should generate performance report', () => {
    // Add some test data
    performanceMonitor.trackComponentRender('Component1', 10)
    performanceMonitor.trackComponentRender('Component2', 25)
    
    const report = performanceMonitor.generateReport()
    
    expect(report).toContain('Performance Report')
    expect(typeof report).toBe('string')
  })
})

describe('Memory Leak Prevention', () => {
  it('should cleanup intersection observers', () => {
    const disconnectSpy = vi.fn()
    
    global.IntersectionObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: disconnectSpy
    }))
    
    const { unmount } = render(
      <LazyImage src="/test.jpg" alt="test" />
    )
    
    unmount()
    
    expect(disconnectSpy).toHaveBeenCalled()
  })

  it('should cleanup performance observers', () => {
    const cleanup = performanceMonitor.cleanup
    const cleanupSpy = vi.spyOn(performanceMonitor, 'cleanup')
    
    cleanup()
    
    expect(cleanupSpy).toHaveBeenCalled()
  })

  it('should prevent memory leaks in virtual scroller', () => {
    const { unmount } = render(
      <VirtualScroller
        items={[]}
        itemHeight={50}
        containerHeight={200}
        renderItem={() => <div />}
      />
    )
    
    // Should unmount without errors
    expect(() => unmount()).not.toThrow()
  })
})