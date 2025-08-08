/**
 * UI Store POC Tests
 * 
 * Validates that the new unified mutator chain and standard store factory
 * work correctly without TypeScript errors.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useUIStore, useActiveModal, useNotifications } from '@/store/uiStore'

describe('UI Store POC - Unified Mutator Chain', () => {
  beforeEach(() => {
    // Reset store before each test
    useUIStore.getState().reset()
  })

  describe('Store Creation', () => {
    it('should create store without TypeScript errors', () => {
      const { result } = renderHook(() => useUIStore())
      expect(result.current).toBeDefined()
      expect(result.current.activeModal).toBeNull()
    })

    it('should have all expected actions', () => {
      const store = useUIStore.getState()
      expect(typeof store.openModal).toBe('function')
      expect(typeof store.closeModal).toBe('function')
      expect(typeof store.toggleSidebar).toBe('function')
      expect(typeof store.addNotification).toBe('function')
      expect(typeof store.reset).toBe('function')
    })
  })

  describe('Modal Management', () => {
    it('should open and close modals', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.openModal('test-modal', { foo: 'bar' })
      })

      expect(result.current.activeModal).toBe('test-modal')
      expect(result.current.modalData).toEqual({ foo: 'bar' })

      act(() => {
        result.current.closeModal()
      })

      expect(result.current.activeModal).toBeNull()
      expect(result.current.modalData).toBeNull()
    })

    it('should work with modal selector', () => {
      const { result } = renderHook(() => useActiveModal())

      expect(result.current).toBeNull()

      act(() => {
        useUIStore.getState().openModal('test-modal')
      })

      expect(result.current).toBe('test-modal')
    })
  })

  describe('Notifications', () => {
    it('should add and remove notifications', () => {
      const { result } = renderHook(() => useNotifications())

      expect(result.current).toHaveLength(0)

      act(() => {
        useUIStore.getState().addNotification({
          type: 'success',
          title: 'Test Notification',
          message: 'This is a test',
        })
      })

      expect(result.current).toHaveLength(1)
      expect(result.current[0]).toMatchObject({
        type: 'success',
        title: 'Test Notification',
        message: 'This is a test',
      })
      expect(result.current[0].id).toBeDefined()
      expect(result.current[0].timestamp).toBeDefined()

      const notificationId = result.current[0].id

      act(() => {
        useUIStore.getState().removeNotification(notificationId)
      })

      expect(result.current).toHaveLength(0)
    })

    it('should auto-close notifications', async () => {
      const { result } = renderHook(() => useNotifications())

      act(() => {
        useUIStore.getState().addNotification({
          type: 'info',
          title: 'Auto-close test',
          duration: 100, // 100ms for fast test
        })
      })

      expect(result.current).toHaveLength(1)

      // Wait for auto-close using waitFor to handle async state updates
      await waitFor(() => {
        expect(result.current).toHaveLength(0)
      }, { timeout: 200 })
    })
  })

  describe('Sidebar State', () => {
    it('should toggle sidebar', () => {
      const { result } = renderHook(() => useUIStore())

      expect(result.current.isSidebarOpen).toBe(false)

      act(() => {
        result.current.toggleSidebar()
      })

      expect(result.current.isSidebarOpen).toBe(true)

      act(() => {
        result.current.toggleSidebar()
      })

      expect(result.current.isSidebarOpen).toBe(false)
    })

    it('should set sidebar view and auto-open', () => {
      const { result } = renderHook(() => useUIStore())

      expect(result.current.sidebarView).toBe('default')
      expect(result.current.isSidebarOpen).toBe(false)

      act(() => {
        result.current.setSidebarView('settings')
      })

      expect(result.current.sidebarView).toBe('settings')
      expect(result.current.isSidebarOpen).toBe(true)
    })
  })

  describe('Global Loading State', () => {
    it('should set global loading with message', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.setGlobalLoading(true, 'Loading data...')
      })

      expect(result.current.globalLoading).toBe(true)
      expect(result.current.loadingMessage).toBe('Loading data...')

      act(() => {
        result.current.setGlobalLoading(false)
      })

      expect(result.current.globalLoading).toBe(false)
      expect(result.current.loadingMessage).toBeNull()
    })
  })

  describe('Reset Functionality', () => {
    it('should reset entire store state', () => {
      const { result } = renderHook(() => useUIStore())

      // Modify state
      act(() => {
        result.current.openModal('test')
        result.current.toggleSidebar()
        result.current.addNotification({ type: 'info', title: 'Test' })
        result.current.setGlobalLoading(true, 'Test')
      })

      // Verify state is modified
      expect(result.current.activeModal).toBe('test')
      expect(result.current.isSidebarOpen).toBe(true)
      expect(result.current.notifications).toHaveLength(1)
      expect(result.current.globalLoading).toBe(true)

      // Reset
      act(() => {
        result.current.reset()
      })

      // Verify state is reset
      expect(result.current.activeModal).toBeNull()
      expect(result.current.isSidebarOpen).toBe(false)
      expect(result.current.notifications).toHaveLength(0)
      expect(result.current.globalLoading).toBe(false)
    })
  })

  describe('TypeScript Type Safety', () => {
    it('should enforce correct types for actions', () => {
      const { result } = renderHook(() => useUIStore())

      // These should compile without errors
      act(() => {
        result.current.openModal('test')
        result.current.openModal('test', { data: 123 })
        result.current.setSidebarView('settings')
        result.current.addNotification({ type: 'success', title: 'Test' })
      })

      // The following would be caught by TypeScript at compile time:
      // result.current.setSidebarView('invalid') // TS Error: Argument of type '"invalid"' is not assignable
      // result.current.addNotification({ type: 'invalid', title: 'Test' }) // TS Error: Type '"invalid"' is not assignable
      
      // Verify the types are working correctly at runtime
      expect(result.current.sidebarView).toBe('settings')
      expect(result.current.notifications).toHaveLength(1)
      expect(result.current.activeModal).toBe('test')
      expect(result.current.modalData).toEqual({ data: 123 })
    })
  })
})