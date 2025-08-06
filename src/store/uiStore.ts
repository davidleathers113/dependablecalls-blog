/**
 * UI Store - Proof of Concept for Unified Mutator Chain
 * 
 * This simple store manages UI state like modals, sidebars, and notifications.
 * It serves as a POC for the new standardized store factory pattern.
 */

import { createUIStore } from './factories/createStandardStore'
import type { LightweightStateCreator } from './types/mutators'

// UI Store State Interface
export interface UIState {
  // Modal state
  activeModal: string | null
  modalData: Record<string, unknown> | null
  
  // Sidebar state
  isSidebarOpen: boolean
  sidebarView: 'default' | 'settings' | 'notifications'
  
  // Notifications
  notifications: Notification[]
  
  // Loading states
  globalLoading: boolean
  loadingMessage: string | null
  
  // Actions
  openModal: (modalId: string, data?: Record<string, unknown>) => void
  closeModal: () => void
  toggleSidebar: () => void
  setSidebarView: (view: UIState['sidebarView']) => void
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void
  removeNotification: (id: string) => void
  setGlobalLoading: (loading: boolean, message?: string) => void
  reset: () => void
}

// Notification type
export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  timestamp: number
  autoClose?: boolean
  duration?: number
}

// Initial state
const initialState = {
  activeModal: null,
  modalData: null,
  isSidebarOpen: false,
  sidebarView: 'default' as const,
  notifications: [],
  globalLoading: false,
  loadingMessage: null,
}

// Create the store using lightweight configuration (POC)
const createUIStoreState: LightweightStateCreator<UIState> = (set, get) => ({
  ...initialState,

  // Modal actions
  openModal: (modalId, data) => {
    set((state) => {
      state.activeModal = modalId
      state.modalData = data || null
    })
  },

  closeModal: () => {
    set((state) => {
      state.activeModal = null
      state.modalData = null
    })
  },

  // Sidebar actions
  toggleSidebar: () => {
    set((state) => {
      state.isSidebarOpen = !state.isSidebarOpen
    })
  },

  setSidebarView: (view) => {
    set((state) => {
      state.sidebarView = view
      state.isSidebarOpen = true // Auto-open when changing view
    })
  },

  // Notification actions
  addNotification: (notification) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: Date.now(),
    }

    set((state) => {
      state.notifications.push(newNotification)
    })

    // Auto-close if configured
    if (notification.autoClose !== false) {
      const duration = notification.duration || 5000
      setTimeout(() => {
        get().removeNotification(id)
      }, duration)
    }
  },

  removeNotification: (id) => {
    set((state) => {
      state.notifications = state.notifications.filter((n) => n.id !== id)
    })
  },

  // Loading actions
  setGlobalLoading: (loading, message) => {
    set((state) => {
      state.globalLoading = loading
      state.loadingMessage = message || null
    })
  },

  // Reset action
  reset: () => {
    set(initialState)
  },
})

// Create the store using the new factory
export const useUIStore = createUIStore<UIState>('ui-store', createUIStoreState)

// Selectors for common patterns
export const useActiveModal = () => useUIStore((state) => state.activeModal)
export const useModalData = () => useUIStore((state) => state.modalData)
export const useNotifications = () => useUIStore((state) => state.notifications)
export const useGlobalLoading = () => useUIStore((state) => ({
  isLoading: state.globalLoading,
  message: state.loadingMessage,
}))

// Development helpers
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as unknown as Record<string, unknown>).__uiStore = useUIStore
}