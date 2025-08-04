/**
 * Phase 4 Performance Optimization: Resource Cleanup Utilities
 * 
 * This module provides lifecycle management for timers, subscriptions, and other
 * resources to prevent memory leaks and improve performance.
 */

import * as React from 'react'
import type { StateCreator } from 'zustand'

// Type imports for centralized StoreMutators declaration
type WithImmer<S> = S extends { getState: () => infer T; setState: infer SetState }
  ? S & {
      setState: SetState extends (...a: unknown[]) => infer Sr
        ? (
            partial: T | Partial<T> | ((draft: T) => void),
            replace?: boolean | undefined
          ) => Sr
        : never
    }
  : never

type Write<T, U> = Omit<T, keyof U> & U
type StoreErrorHandling<S> = S extends { getState: () => infer T }
  ? S & {
      setState: (
        partial: T | Partial<T> | ((state: T) => T | Partial<T>),
        replace?: boolean | undefined,
        action?: string | { type: unknown }
      ) => void
    }
  : never

export interface CleanupResource {
  id: string
  type: 'timer' | 'interval' | 'subscription' | 'listener' | 'custom'
  cleanup: () => void
  createdAt: number
  metadata?: Record<string, unknown>
}

export interface ResourceCleanupState {
  __resources: Map<string, CleanupResource>
  __cleanup_enabled: boolean
}

// Centralized StoreMutators declaration to avoid conflicts
declare module 'zustand/vanilla' {
  interface StoreMutators<S, A> {
    'zustand/resource-cleanup': WithResourceCleanup<S>
    'zustand/immer': WithImmer<S>
    errorHandling: Write<S, StoreErrorHandling<S>>
  }
}

type WithResourceCleanup<S> = S extends { getState: () => unknown }
  ? S & {
      addResource: (resource: CleanupResource) => void
      removeResource: (id: string) => void
      cleanupAll: () => void
      cleanupByType: (type: CleanupResource['type']) => void
      getResourceCount: () => number
      getResourceStats: () => ResourceStats
    }
  : never

export interface ResourceStats {
  total: number
  byType: Record<CleanupResource['type'], number>
  oldestResource: number | null
  memoryEstimate: number
}

/**
 * Enhanced resource cleanup middleware
 */
export const resourceCleanup = <T>(
  config: {
    enableAutoCleanup?: boolean
    maxAge?: number
    maxResources?: number
    cleanupInterval?: number
  } = {}
) => {
  const {
    enableAutoCleanup = true,
    maxAge = 5 * 60 * 1000, // 5 minutes
    maxResources = 100,
    cleanupInterval = 30 * 1000, // 30 seconds
  } = config

  return (
    initializer: StateCreator<T, [], [], T>
  ): StateCreator<T, [], [], T & ResourceCleanupState> => {
    return (set, get, store) => {
      type T_WithCleanup = T & ResourceCleanupState
      
      const resources = new Map<string, CleanupResource>()
      let cleanupIntervalId: NodeJS.Timeout | null = null
      
      // Auto cleanup function
      const autoCleanup = () => {
        const now = Date.now()
        const resourcesToCleanup: string[] = []
        
        resources.forEach((resource, id) => {
          if (now - resource.createdAt > maxAge) {
            resourcesToCleanup.push(id)
          }
        })
        
        // Cleanup old resources
        resourcesToCleanup.forEach(id => {
          const resource = resources.get(id)
          if (resource) {
            try {
              resource.cleanup()
            } catch (error) {
              console.warn(`Failed to cleanup resource ${id}:`, error)
            }
            resources.delete(id)
          }
        })
        
        // Cleanup excess resources (keep newest ones)
        if (resources.size > maxResources) {
          const sortedResources = Array.from(resources.entries())
            .sort((a, b) => a[1].createdAt - b[1].createdAt)
          
          const toRemove = sortedResources.slice(0, resources.size - maxResources)
          toRemove.forEach(([id, resource]) => {
            try {
              resource.cleanup()
            } catch (error) {
              console.warn(`Failed to cleanup excess resource ${id}:`, error)
            }
            resources.delete(id)
          })
        }
        
        // Update state with current resource count
        const currentState = get() as T_WithCleanup
        if (currentState.__resources.size !== resources.size) {
          set({ __resources: new Map(resources) } as Partial<T_WithCleanup>)
        }
      }
      
      // Start auto cleanup if enabled
      if (enableAutoCleanup) {
        cleanupIntervalId = setInterval(autoCleanup, cleanupInterval)
      }
      
      // Resource management methods
      const addResource = (resource: CleanupResource) => {
        resources.set(resource.id, resource)
        set({ __resources: new Map(resources) } as Partial<T_WithCleanup>)
        
        if (process.env.NODE_ENV === 'development') {
          console.debug(`Added resource ${resource.id} (type: ${resource.type})`)
        }
      }
      
      const removeResource = (id: string) => {
        const resource = resources.get(id)
        if (resource) {
          try {
            resource.cleanup()
          } catch (error) {
            console.warn(`Failed to cleanup resource ${id}:`, error)
          }
          resources.delete(id)
          set({ __resources: new Map(resources) } as Partial<T_WithCleanup>)
          
          if (process.env.NODE_ENV === 'development') {
            console.debug(`Removed resource ${id}`)
          }
        }
      }
      
      const cleanupAll = () => {
        resources.forEach((resource, id) => {
          try {
            resource.cleanup()
          } catch (error) {
            console.warn(`Failed to cleanup resource ${id}:`, error)
          }
        })
        resources.clear()
        
        if (cleanupIntervalId) {
          clearInterval(cleanupIntervalId)
          cleanupIntervalId = null
        }
        
        set({ 
          __resources: new Map(),
          __cleanup_enabled: false
        } as Partial<T_WithCleanup>)
        
        if (process.env.NODE_ENV === 'development') {
          console.debug('Cleaned up all resources')
        }
      }
      
      const cleanupByType = (type: CleanupResource['type']) => {
        const toCleanup: string[] = []
        resources.forEach((resource, id) => {
          if (resource.type === type) {
            toCleanup.push(id)
          }
        })
        
        toCleanup.forEach(id => removeResource(id))
      }
      
      const getResourceCount = () => resources.size
      
      const getResourceStats = (): ResourceStats => {
        const stats: ResourceStats = {
          total: resources.size,
          byType: {
            timer: 0,
            interval: 0,
            subscription: 0,
            listener: 0,
            custom: 0,
          },
          oldestResource: null,
          memoryEstimate: 0,
        }
        
        let oldestTime = Infinity
        resources.forEach(resource => {
          stats.byType[resource.type]++
          if (resource.createdAt < oldestTime) {
            oldestTime = resource.createdAt
            stats.oldestResource = resource.createdAt
          }
        })
        
        // Rough memory estimate (8 bytes per resource minimum)
        stats.memoryEstimate = resources.size * 8
        
        return stats
      }
      
      // Initialize base state
      const initialState = initializer(set, get, store)
      
      // Note: Zustand StoreApi doesn't have a destroy method
      // Cleanup should be handled by the component lifecycle or manual cleanup
      
      return {
        ...initialState,
        __resources: resources,
        __cleanup_enabled: enableAutoCleanup,
        addResource,
        removeResource,
        cleanupAll,
        cleanupByType,
        getResourceCount,
        getResourceStats,
      } as T_WithCleanup
    }
  }
}

/**
 * Utility functions for common resource types
 */
export const createTimerResource = (
  id: string,
  callback: () => void,
  delay: number,
  metadata?: Record<string, unknown>
): CleanupResource => {
  const timerId = setTimeout(callback, delay)
  
  return {
    id,
    type: 'timer',
    cleanup: () => clearTimeout(timerId),
    createdAt: Date.now(),
    metadata: { delay, ...metadata },
  }
}

export const createIntervalResource = (
  id: string,
  callback: () => void,
  interval: number,
  metadata?: Record<string, unknown>
): CleanupResource => {
  const intervalId = setInterval(callback, interval)
  
  return {
    id,
    type: 'interval',
    cleanup: () => clearInterval(intervalId),
    createdAt: Date.now(),
    metadata: { interval, ...metadata },
  }
}

export const createSubscriptionResource = (
  id: string,
  unsubscribe: () => void,
  metadata?: Record<string, unknown>
): CleanupResource => {
  return {
    id,
    type: 'subscription',
    cleanup: unsubscribe,
    createdAt: Date.now(),
    metadata,
  }
}

export const createListenerResource = (
  id: string,
  element: EventTarget,
  event: string,
  listener: EventListener,
  options?: AddEventListenerOptions,
  metadata?: Record<string, unknown>
): CleanupResource => {
  element.addEventListener(event, listener, options)
  
  return {
    id,
    type: 'listener',
    cleanup: () => element.removeEventListener(event, listener, options),
    createdAt: Date.now(),
    metadata: { event, ...metadata },
  }
}

export const createCustomResource = (
  id: string,
  cleanup: () => void,
  metadata?: Record<string, unknown>
): CleanupResource => {
  return {
    id,
    type: 'custom',
    cleanup,
    createdAt: Date.now(),
    metadata,
  }
}

/**
 * Hook for using resource cleanup in components
 */
export const useResourceCleanup = () => {
  const resources = React.useMemo(() => new Map<string, CleanupResource>(), [])
  
  const addResource = (resource: CleanupResource) => {
    resources.set(resource.id, resource)
  }
  
  const removeResource = (id: string) => {
    const resource = resources.get(id)
    if (resource) {
      resource.cleanup()
      resources.delete(id)
    }
  }
  
  const cleanupAll = React.useCallback(() => {
    resources.forEach(resource => {
      try {
        resource.cleanup()
      } catch (error) {
        console.warn(`Cleanup error for resource ${resource.id}:`, error)
      }
    })
    resources.clear()
  }, [resources])
  
  // Cleanup when component unmounts
  React.useEffect(() => {
    return cleanupAll
  }, [cleanupAll])
  
  return {
    addResource,
    removeResource,
    cleanupAll,
    createTimer: (id: string, callback: () => void, delay: number) => {
      const resource = createTimerResource(id, callback, delay)
      addResource(resource)
      return resource
    },
    createInterval: (id: string, callback: () => void, interval: number) => {
      const resource = createIntervalResource(id, callback, interval)
      addResource(resource)
      return resource
    },
    createSubscription: (id: string, unsubscribe: () => void) => {
      const resource = createSubscriptionResource(id, unsubscribe)
      addResource(resource)
      return resource
    },
  }
}

export type ResourceCleanupMiddleware = typeof resourceCleanup