/**
 * Performance monitoring utilities for React 19.1 optimization
 * Tracks Core Web Vitals and component performance metrics
 */

import React from 'react'
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals'

// Chrome-specific performance.memory interface
interface ChromePerformance extends Performance {
  memory?: {
    jsHeapSizeLimit: number
    totalJSHeapSize: number
    usedJSHeapSize: number
  }
}

// Performance thresholds (in milliseconds)
export const PERFORMANCE_THRESHOLDS = {
  LCP: 2500,    // Largest Contentful Paint
  INP: 200,     // Interaction to Next Paint (replaces FID)
  CLS: 0.1,     // Cumulative Layout Shift
  FCP: 1800,    // First Contentful Paint
  TTFB: 600,    // Time to First Byte
  COMPONENT_RENDER: 16, // 60fps target
  BUNDLE_SIZE: 250000,  // 250KB max initial bundle
  IMAGE_LOAD: 3000,     // 3s max image load time
} as const

// Performance metrics storage
interface PerformanceMetrics {
  coreWebVitals: {
    lcp?: number
    inp?: number
    cls?: number
    fcp?: number
    ttfb?: number
  }
  customMetrics: {
    componentRenders: Map<string, number[]>
    bundleLoads: Map<string, number>
    imageLoads: Map<string, number>
    routeTransitions: Map<string, number>
  }
  memoryUsage: {
    jsHeapSizeLimit: number
    totalJSHeapSize: number
    usedJSHeapSize: number
  }[]
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    coreWebVitals: {},
    customMetrics: {
      componentRenders: new Map(),
      bundleLoads: new Map(),
      imageLoads: new Map(),
      routeTransitions: new Map()
    },
    memoryUsage: []
  }

  private observers: Map<string, PerformanceObserver> = new Map()
  private isEnabled = typeof window !== 'undefined' && 'performance' in window

  constructor() {
    if (this.isEnabled) {
      this.initializeCoreWebVitals()
      this.initializeCustomObservers()
      this.startMemoryMonitoring()
    }
  }

  private initializeCoreWebVitals() {
    const handleMetric = (metric: Metric) => {
      const { name, value } = metric
      
      switch (name) {
        case 'LCP':
          this.metrics.coreWebVitals.lcp = value
          this.logMetric('LCP', value, PERFORMANCE_THRESHOLDS.LCP)
          break
        case 'INP':
          this.metrics.coreWebVitals.inp = value
          this.logMetric('INP', value, PERFORMANCE_THRESHOLDS.INP)
          break
        case 'CLS':
          this.metrics.coreWebVitals.cls = value
          this.logMetric('CLS', value, PERFORMANCE_THRESHOLDS.CLS)
          break
        case 'FCP':
          this.metrics.coreWebVitals.fcp = value
          this.logMetric('FCP', value, PERFORMANCE_THRESHOLDS.FCP)
          break
        case 'TTFB':
          this.metrics.coreWebVitals.ttfb = value
          this.logMetric('TTFB', value, PERFORMANCE_THRESHOLDS.TTFB)
          break
      }
    }

    onCLS(handleMetric)
    onFCP(handleMetric)
    onINP(handleMetric)
    onLCP(handleMetric)
    onTTFB(handleMetric)
  }

  private initializeCustomObservers() {
    // Resource timing observer
    if ('PerformanceObserver' in window) {
      try {
        const resourceObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.entryType === 'resource') {
              const resource = entry as PerformanceResourceTiming
              
              // Track bundle loads
              if (resource.name.includes('.js') || resource.name.includes('.css')) {
                this.metrics.customMetrics.bundleLoads.set(
                  this.getResourceName(resource.name),
                  resource.duration
                )
              }
              
              // Track image loads
              if (resource.initiatorType === 'img') {
                this.metrics.customMetrics.imageLoads.set(
                  this.getResourceName(resource.name),
                  resource.duration
                )
                
                if (resource.duration > PERFORMANCE_THRESHOLDS.IMAGE_LOAD) {
                  console.warn(`Slow image load: ${resource.name} (${resource.duration.toFixed(2)}ms)`)
                }
              }
            }
          })
        })
        
        resourceObserver.observe({ entryTypes: ['resource'] })
        this.observers.set('resource', resourceObserver)
      } catch (error) {
        console.warn('Failed to initialize resource observer:', error)
      }

      // Navigation timing observer for route transitions
      try {
        const navigationObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.entryType === 'navigation') {
              const nav = entry as PerformanceNavigationTiming
              this.metrics.customMetrics.routeTransitions.set(
                window.location.pathname,
                nav.loadEventEnd - nav.fetchStart
              )
            }
          })
        })
        
        navigationObserver.observe({ entryTypes: ['navigation'] })
        this.observers.set('navigation', navigationObserver)
      } catch (error) {
        console.warn('Failed to initialize navigation observer:', error)
      }
    }
  }

  private startMemoryMonitoring() {
    if ('memory' in performance) {
      const collectMemoryStats = () => {
        const memory = (performance as ChromePerformance).memory
        if (memory) {
          this.metrics.memoryUsage.push({
            jsHeapSizeLimit: memory.jsHeapSizeLimit,
            totalJSHeapSize: memory.totalJSHeapSize,
            usedJSHeapSize: memory.usedJSHeapSize
          })
        }
        
        // Keep only last 10 samples
        if (this.metrics.memoryUsage.length > 10) {
          this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-10)
        }
        
        // Warn on high memory usage
        const usageRatio = memory ? memory.usedJSHeapSize / memory.jsHeapSizeLimit : 0
        if (usageRatio > 0.8) {
          console.warn(`High memory usage: ${(usageRatio * 100).toFixed(1)}%`)
        }
      }
      
      // Collect memory stats every 30 seconds
      setInterval(collectMemoryStats, 30000)
      collectMemoryStats() // Initial collection
    }
  }

  private getResourceName(url: string): string {
    try {
      return new URL(url).pathname.split('/').pop() || url
    } catch {
      return url
    }
  }

  private logMetric(name: string, value: number, threshold: number) {
    const status = value <= threshold ? '✅' : '⚠️'
    const message = `${status} ${name}: ${value.toFixed(2)}${name === 'CLS' ? '' : 'ms'} (threshold: ${threshold}${name === 'CLS' ? '' : 'ms'})`
    
    if (value > threshold) {
      console.warn(message)
    } else {
      console.log(message)
    }
  }

  // Public API methods
  trackComponentRender(componentName: string, renderTime: number) {
    if (!this.isEnabled) return
    
    const renders = this.metrics.customMetrics.componentRenders.get(componentName) || []
    renders.push(renderTime)
    
    // Keep only last 10 renders
    if (renders.length > 10) {
      renders.splice(0, renders.length - 10)
    }
    
    this.metrics.customMetrics.componentRenders.set(componentName, renders)
    
    // Warn on slow renders
    if (renderTime > PERFORMANCE_THRESHOLDS.COMPONENT_RENDER) {
      console.warn(`Slow component render: ${componentName} (${renderTime.toFixed(2)}ms)`)
    }
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  getComponentStats(componentName: string) {
    const renders = this.metrics.customMetrics.componentRenders.get(componentName) || []
    if (renders.length === 0) return null
    
    const avg = renders.reduce((a, b) => a + b, 0) / renders.length
    const max = Math.max(...renders)
    const min = Math.min(...renders)
    
    return { avg, max, min, count: renders.length }
  }

  getBundleStats() {
    return Array.from(this.metrics.customMetrics.bundleLoads.entries())
      .map(([name, duration]) => ({ name, duration }))
      .sort((a, b) => b.duration - a.duration)
  }

  getImageStats() {
    return Array.from(this.metrics.customMetrics.imageLoads.entries())
      .map(([name, duration]) => ({ name, duration }))
      .filter(item => item.duration > 1000) // Only show slow images
      .sort((a, b) => b.duration - a.duration)
  }

  getMemoryStats() {
    if (this.metrics.memoryUsage.length === 0) return null
    
    const latest = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1]
    const usagePercent = (latest.usedJSHeapSize / latest.jsHeapSizeLimit) * 100
    
    return {
      usedMB: Math.round(latest.usedJSHeapSize / 1024 / 1024),
      totalMB: Math.round(latest.totalJSHeapSize / 1024 / 1024),
      limitMB: Math.round(latest.jsHeapSizeLimit / 1024 / 1024),
      usagePercent: Math.round(usagePercent)
    }
  }

  generateReport(): string {
    const { coreWebVitals } = this.metrics
    const bundleStats = this.getBundleStats()
    const imageStats = this.getImageStats()
    const memoryStats = this.getMemoryStats()
    
    let report = '📊 Performance Report\n\n'
    
    // Core Web Vitals
    report += '🎯 Core Web Vitals:\n'
    if (coreWebVitals.lcp) report += `  LCP: ${coreWebVitals.lcp.toFixed(2)}ms\n`
    if (coreWebVitals.inp) report += `  INP: ${coreWebVitals.inp.toFixed(2)}ms\n`
    if (coreWebVitals.cls) report += `  CLS: ${coreWebVitals.cls.toFixed(3)}\n`
    if (coreWebVitals.fcp) report += `  FCP: ${coreWebVitals.fcp.toFixed(2)}ms\n`
    if (coreWebVitals.ttfb) report += `  TTFB: ${coreWebVitals.ttfb.toFixed(2)}ms\n`
    
    // Bundle performance
    if (bundleStats.length > 0) {
      report += '\n📦 Slowest Bundles:\n'
      bundleStats.slice(0, 5).forEach(({ name, duration }) => {
        report += `  ${name}: ${duration.toFixed(2)}ms\n`
      })
    }
    
    // Image performance
    if (imageStats.length > 0) {
      report += '\n🖼️ Slow Images:\n'
      imageStats.slice(0, 5).forEach(({ name, duration }) => {
        report += `  ${name}: ${duration.toFixed(2)}ms\n`
      })
    }
    
    // Memory usage
    if (memoryStats) {
      report += `\n💾 Memory Usage:\n`
      report += `  Used: ${memoryStats.usedMB}MB (${memoryStats.usagePercent}%)\n`
      report += `  Limit: ${memoryStats.limitMB}MB\n`
    }
    
    return report
  }

  cleanup() {
    this.observers.forEach(observer => {
      try {
        observer.disconnect()
      } catch (error) {
        console.warn('Error disconnecting performance observer:', error)
      }
    })
    this.observers.clear()
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor()

// React hook for component performance tracking
export function usePerformanceTracking(componentName: string) {
  const renderStart = performance.now()
  
  // Track render time after component updates
  React.useEffect(() => {
    const renderTime = performance.now() - renderStart
    performanceMonitor.trackComponentRender(componentName, renderTime)
  })
  
  return {
    getStats: () => performanceMonitor.getComponentStats(componentName)
  }
}

export default performanceMonitor