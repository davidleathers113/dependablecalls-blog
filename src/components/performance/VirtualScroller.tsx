/**
 * High-performance virtual scrolling component for large lists
 * Optimized for React 19.1 with efficient rendering and memory usage
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, startTransition } from 'react'

interface VirtualScrollerProps<T> {
  items: T[]
  itemHeight: number
  containerHeight: number
  renderItem: (item: T, index: number, isVisible: boolean) => React.ReactNode
  overscan?: number
  className?: string
  onScroll?: (scrollTop: number) => void
  loadMore?: () => void
  hasMore?: boolean
  loading?: boolean
}

// Performance monitoring hook
const usePerformanceMonitor = () => {
  const renderCount = useRef(0)
  const lastRenderTime = useRef(0)
  
  useEffect(() => {
    renderCount.current++
    
    // Only perform performance monitoring in development
    if (process.env.NODE_ENV === 'development') {
      const now = performance.now()
      if (lastRenderTime.current) {
        const renderTime = now - lastRenderTime.current
        if (renderTime > 16) { // 60fps threshold
          console.warn(`VirtualScroller render took ${renderTime.toFixed(2)}ms`)
        }
      }
      lastRenderTime.current = now
    }
  })
  
  return renderCount.current
}

export function VirtualScroller<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  className = '',
  onScroll,
  loadMore,
  hasMore = false,
  loading = false
}: VirtualScrollerProps<T>) {
  const [scrollTop, setScrollTop] = useState(0)
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollElementRef = useRef<HTMLDivElement>(null)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  
  // Performance monitoring (conditionally active in development)
  usePerformanceMonitor()

  // Calculate visible range with memoization
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    )
    
    return { startIndex, endIndex }
  }, [scrollTop, itemHeight, containerHeight, overscan, items.length])

  // Memoize visible items to prevent unnecessary re-renders
  const visibleItems = useMemo(() => {
    const { startIndex, endIndex } = visibleRange
    return items.slice(startIndex, endIndex + 1).map((item, index) => ({
      item,
      index: startIndex + index,
      key: startIndex + index
    }))
  }, [items, visibleRange])

  // Handle scroll with throttling
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = event.currentTarget.scrollTop
    
    // Use startTransition for non-urgent updates
    startTransition(() => {
      setScrollTop(newScrollTop)
      setIsScrolling(true)
      
      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
      
      // Set scrolling to false after scroll stops
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false)
      }, 150)
      
      onScroll?.(newScrollTop)
    })
  }, [onScroll])

  // Infinite scrolling logic
  useEffect(() => {
    const { endIndex } = visibleRange
    const threshold = items.length - 10 // Load more when 10 items from end
    
    if (endIndex >= threshold && hasMore && !loading && loadMore) {
      loadMore()
    }
  }, [visibleRange, items.length, hasMore, loading, loadMore])

  // Calculate total height and offset
  const totalHeight = items.length * itemHeight
  const offsetY = visibleRange.startIndex * itemHeight

  // Memoized style calculations
  const containerStyle = useMemo(() => ({
    height: containerHeight,
    overflow: 'auto',
    position: 'relative' as const
  }), [containerHeight])

  const innerStyle = useMemo(() => ({
    height: totalHeight,
    position: 'relative' as const
  }), [totalHeight])

  const contentStyle = useMemo(() => ({
    transform: `translateY(${offsetY}px)`,
    position: 'relative' as const
  }), [offsetY])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div
      ref={scrollElementRef}
      className={`virtual-scroller ${className}`}
      style={containerStyle}
      onScroll={handleScroll}
      role="list"
      aria-label="Virtual scrolling list"
    >
      <div style={innerStyle}>
        <div style={contentStyle}>
          {visibleItems.map(({ item, index, key }) => (
            <div
              key={key}
              style={{ height: itemHeight }}
              role="listitem"
              data-index={index}
              data-visible={!isScrolling}
            >
              {renderItem(item, index, !isScrolling)}
            </div>
          ))}
          
          {/* Loading indicator */}
          {loading && (
            <div
              style={{ height: itemHeight }}
              className="flex items-center justify-center"
            >
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Memoized wrapper for better performance
export const MemoizedVirtualScroller = React.memo(VirtualScroller) as typeof VirtualScroller

export default MemoizedVirtualScroller