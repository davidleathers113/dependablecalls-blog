// Navigation State Machine Slice
// Manages navigation state for layout components (mobile menu, sidebar, user dropdown)

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { BaseSlice, LoadingState } from '../utils/createSlice'
import { createBaseActions } from '../utils/createSlice'
// Local interfaces for navigation state machine
export interface StateTransition {
  from: string
  to: string
  timestamp: number
  reason?: string
  metadata?: Record<string, unknown>
}

export interface StateMachine<TState> {
  state: TState
  previousState: TState | null
  transitions: StateTransition[]
  canTransitionTo: (newType: EnhancedNavigationState["type"]) => boolean
  transition: (newState: TState, reason?: string, metadata?: Record<string, unknown>) => void
  rollback: () => boolean
}

// =============================================================================
// Enhanced Navigation State Types
// =============================================================================

// Extended navigation state with multiple navigation elements
export type EnhancedNavigationState = 
  | { type: 'collapsed'; element: 'mobile_menu' | 'desktop_sidebar' | 'user_dropdown' }
  | { type: 'expanded'; element: 'mobile_menu' | 'desktop_sidebar' | 'user_dropdown'; activeSection?: string }
  | { type: 'opening'; element: 'mobile_menu' | 'desktop_sidebar' | 'user_dropdown'; progress?: number }
  | { type: 'closing'; element: 'mobile_menu' | 'desktop_sidebar' | 'user_dropdown'; progress?: number }
  | { type: 'overlay'; element: 'mobile_menu'; backdrop?: boolean }
  | { type: 'mini'; element: 'desktop_sidebar'; showLabels?: boolean }

// Navigation element configuration
export interface NavigationElement {
  id: string
  type: 'mobile_menu' | 'desktop_sidebar' | 'user_dropdown'
  state: EnhancedNavigationState
  persistent?: boolean // For user preferences
  animationDuration?: number
  focusTrapEnabled?: boolean
  ariaLabel?: string
  isAccessible?: boolean
}

// Focus management for accessibility
export interface FocusState {
  activeElement: string | null
  focusedElementId: string | null
  focusTrapActive: boolean
  restoreFocusTo: string | null
  tabSequence: string[]
}

// Animation state for transitions
export interface AnimationState {
  isAnimating: boolean
  animationType: 'opening' | 'closing' | 'idle'
  startTime: number
  duration: number
  easing: 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear'
}

// User preferences for navigation
export interface NavigationPreferences {
  sidebarCollapsed: boolean
  reducedMotion: boolean
  focusTrapEnabled: boolean
  autoCloseMobileMenu: boolean
  rememberUserMenuState: boolean
}

// =============================================================================
// Navigation Slice State Interface
// =============================================================================

interface NavigationSliceState extends BaseSlice {
  // Navigation elements
  mobileMenu: NavigationElement
  desktopSidebar: NavigationElement
  userDropdown: NavigationElement
  
  // State machines for each element
  mobileMenuStateMachine: StateMachine<EnhancedNavigationState>
  sidebarStateMachine: StateMachine<EnhancedNavigationState>
  userDropdownStateMachine: StateMachine<EnhancedNavigationState>
  
  // Global navigation state
  activeMenus: Set<string>
  openedDropdowns: Set<string>
  breadcrumbs: Array<{ label: string; path: string; active: boolean }>
  
  // Focus and accessibility state
  focusState: FocusState
  animationState: AnimationState
  
  // User preferences
  preferences: NavigationPreferences
  
  // Actions - Mobile Menu
  openMobileMenu: () => void
  closeMobileMenu: () => void
  toggleMobileMenu: () => void
  setMobileMenuState: (state: EnhancedNavigationState) => void
  
  // Actions - Desktop Sidebar  
  expandSidebar: () => void
  collapseSidebar: () => void
  toggleSidebar: () => void
  setSidebarMini: (showLabels?: boolean) => void
  setSidebarState: (state: EnhancedNavigationState) => void
  
  // Actions - User Dropdown
  openUserDropdown: () => void
  closeUserDropdown: () => void
  toggleUserDropdown: () => void
  setUserDropdownState: (state: EnhancedNavigationState) => void
  
  // Focus management actions
  setFocusTrap: (enabled: boolean, elementId?: string) => void
  restoreFocus: () => void
  setActiveElement: (elementId: string | null) => void
  updateTabSequence: (sequence: string[]) => void
  
  // Animation actions
  startAnimation: (type: 'opening' | 'closing', duration?: number, easing?: AnimationState['easing']) => void
  stopAnimation: () => void
  updateAnimationProgress: (progress: number) => void
  
  // Preference actions
  updatePreferences: (preferences: Partial<NavigationPreferences>) => void
  persistSidebarState: (collapsed: boolean) => void
  enableReducedMotion: (enabled: boolean) => void
  
  // Menu management
  openMenu: (menuId: string) => void
  closeMenu: (menuId: string) => void
  closeAllMenus: () => void
  toggleDropdown: (dropdownId: string) => void
  closeAllDropdowns: () => void
  
  // Breadcrumb management
  setBreadcrumbs: (breadcrumbs: Array<{ label: string; path: string; active: boolean }>) => void
  addBreadcrumb: (label: string, path: string, makeActive?: boolean) => void
  removeBreadcrumb: (path: string) => void
  clearBreadcrumbs: () => void
  
  // State machine utilities
  getTransitionHistory: (element: 'mobile_menu' | 'desktop_sidebar' | 'user_dropdown') => StateTransition[]
  rollbackState: (element: 'mobile_menu' | 'desktop_sidebar' | 'user_dropdown') => boolean
  canTransitionTo: (element: 'mobile_menu' | 'desktop_sidebar' | 'user_dropdown', newState: EnhancedNavigationState['type']) => boolean
  debugStateMachines: () => void
  
  // Enhanced accessibility
  announceStateChange: (element: 'mobile_menu' | 'desktop_sidebar' | 'user_dropdown', message: string) => void
  updateAriaStates: () => void
  
  // Performance optimization
  batchStateUpdate: (updates: { 
    mobileMenu?: Partial<NavigationElement>
    desktopSidebar?: Partial<NavigationElement>
    userDropdown?: Partial<NavigationElement>
  }) => void
}

// =============================================================================
// State Machine Factory Functions
// =============================================================================

// Create enhanced navigation state machine
function createEnhancedNavigationStateMachine(
  elementType: 'mobile_menu' | 'desktop_sidebar' | 'user_dropdown',
  initialState: EnhancedNavigationState = { type: 'collapsed', element: elementType }
): StateMachine<EnhancedNavigationState> {
  let state = initialState
  let previousState: EnhancedNavigationState | null = null
  const transitions: StateTransition[] = []

  // Element-specific transition rules
  const canTransitionTo = (newType: EnhancedNavigationState['type']): boolean => {
    switch (elementType) {
      case 'mobile_menu':
        // Mobile menu can be collapsed, expanded, opening, closing, or overlay
        if (state.type === 'opening' && newType !== 'expanded' && newType !== 'collapsed') return false
        if (state.type === 'closing' && newType !== 'collapsed' && newType !== 'expanded') return false
        return true
        
      case 'desktop_sidebar':
        // Desktop sidebar can be collapsed, expanded, mini, opening, closing
        if (newType === 'overlay') return false // Desktop sidebar doesn't use overlay
        if (state.type === 'opening' && newType !== 'expanded' && newType !== 'collapsed') return false
        if (state.type === 'closing' && newType !== 'collapsed' && newType !== 'expanded') return false
        return true
        
      case 'user_dropdown':
        // User dropdown is simpler - collapsed, expanded, opening, closing
        if (newType === 'overlay' || newType === 'mini') return false
        if (state.type === 'opening' && newType !== 'expanded' && newType !== 'collapsed') return false
        if (state.type === 'closing' && newType !== 'collapsed' && newType !== 'expanded') return false
        return true
        
      default:
        return true
    }
  }

  return {
    state,
    previousState,
    transitions,
    canTransitionTo,

    transition: (newState: EnhancedNavigationState, reason?: string, metadata?: Record<string, unknown>): void => {
      if (!canTransitionTo(newState.type)) {
        throw new Error(`Invalid navigation transition from ${state.type} to ${newState.type} for ${elementType}`)
      }

      previousState = state
      transitions.push({
        from: state.type,
        to: newState.type,
        timestamp: Date.now(),
        reason,
        metadata: {
          ...metadata,
          elementType,
          elementId: elementType
        }
      })
      state = newState
    },

    rollback: (): boolean => {
      if (previousState) {
        const currentState = state
        state = previousState
        previousState = currentState
        transitions.push({
          from: currentState.type,
          to: state.type,
          timestamp: Date.now(),
          reason: 'rollback',
          metadata: { elementType }
        })
        return true
      }
      return false
    }
  }
}

// =============================================================================
// Initial State Setup
// =============================================================================

// Create state machine instances for each navigation element
const mobileMenuStateMachine = createEnhancedNavigationStateMachine('mobile_menu')
const sidebarStateMachine = createEnhancedNavigationStateMachine('desktop_sidebar', { type: 'expanded', element: 'desktop_sidebar' })
const userDropdownStateMachine = createEnhancedNavigationStateMachine('user_dropdown')

// Initial navigation elements
const initialMobileMenu: NavigationElement = {
  id: 'mobile-menu',
  type: 'mobile_menu',
  state: { type: 'collapsed', element: 'mobile_menu' },
  persistent: false,
  animationDuration: 300,
  focusTrapEnabled: true,
  ariaLabel: 'Mobile navigation menu',
  isAccessible: true
}

const initialDesktopSidebar: NavigationElement = {
  id: 'desktop-sidebar', 
  type: 'desktop_sidebar',
  state: { type: 'expanded', element: 'desktop_sidebar' },
  persistent: true,
  animationDuration: 200,
  focusTrapEnabled: false,
  ariaLabel: 'Main navigation sidebar',
  isAccessible: true
}

const initialUserDropdown: NavigationElement = {
  id: 'user-dropdown',
  type: 'user_dropdown',
  state: { type: 'collapsed', element: 'user_dropdown' },
  persistent: false,
  animationDuration: 150,
  focusTrapEnabled: false,
  ariaLabel: 'User account menu',
  isAccessible: true
}

// Initial state
const initialState = {
  loading: { isLoading: false, error: null } as LoadingState,
  
  // Navigation elements
  mobileMenu: initialMobileMenu,
  desktopSidebar: initialDesktopSidebar,
  userDropdown: initialUserDropdown,
  
  // State machines
  mobileMenuStateMachine,
  sidebarStateMachine, 
  userDropdownStateMachine,
  
  // Global state
  activeMenus: new Set<string>(),
  openedDropdowns: new Set<string>(),
  breadcrumbs: [],
  
  // Focus and accessibility
  focusState: {
    activeElement: null,
    focusedElementId: null,
    focusTrapActive: false,
    restoreFocusTo: null,
    tabSequence: []
  } as FocusState,
  
  // Animation state
  animationState: {
    isAnimating: false,
    animationType: 'idle' as const,
    startTime: 0,
    duration: 0,
    easing: 'ease-in-out' as const
  } as AnimationState,
  
  // User preferences (will be loaded from localStorage)
  preferences: {
    sidebarCollapsed: false,
    reducedMotion: false,
    focusTrapEnabled: true,
    autoCloseMobileMenu: true,
    rememberUserMenuState: false
  } as NavigationPreferences
}

// =============================================================================
// Navigation Slice Implementation
// =============================================================================

export const useNavigationStore = create<NavigationSliceState>()(
  devtools(
    persist(
      (set, get): NavigationSliceState => {
    
    // Helper function to update element state and state machine
    const updateElementState = (
      elementType: 'mobile_menu' | 'desktop_sidebar' | 'user_dropdown',
      newState: EnhancedNavigationState,
      reason?: string
    ) => {
      const stateMachine = elementType === 'mobile_menu' ? get().mobileMenuStateMachine :
                          elementType === 'desktop_sidebar' ? get().sidebarStateMachine :
                          get().userDropdownStateMachine
      
      const elementKey = elementType === 'mobile_menu' ? 'mobileMenu' :
                        elementType === 'desktop_sidebar' ? 'desktopSidebar' :
                        'userDropdown'
      
      // Check if transition is allowed
      if (!stateMachine.canTransitionTo(newState.type)) {
        console.warn(`Invalid transition from ${stateMachine.state.type} to ${newState.type} for ${elementType}`)
        return false
      }
      
      // Update state machine
      stateMachine.transition(newState, reason)
      
      // Update element state
      set(state => ({
        [elementKey]: {
          ...state[elementKey],
          state: newState
        }
      }))
      
      // Update accessibility states
      get().updateAriaStates()
      
      return true
    }
    
    // Helper function to handle animations
    const withAnimation = async (
      elementType: 'mobile_menu' | 'desktop_sidebar' | 'user_dropdown',
      targetState: EnhancedNavigationState,
      reason?: string
    ) => {
      const element = elementType === 'mobile_menu' ? get().mobileMenu :
                    elementType === 'desktop_sidebar' ? get().desktopSidebar :
                    get().userDropdown
      
      const { reducedMotion } = get().preferences
      
      if (reducedMotion) {
        // Skip animation, go directly to target state
        updateElementState(elementType, targetState, reason)
        return
      }
      
      // Start animation
      const animationType = targetState.type === 'expanded' ? 'opening' : 'closing'
      get().startAnimation(animationType, element.animationDuration)
      
      // Set transitioning state
      const transitionState: EnhancedNavigationState = {
        type: targetState.type === 'expanded' ? 'opening' : 'closing',
        element: elementType,
        progress: 0
      }
      updateElementState(elementType, transitionState, `${reason}_animation_start`)
      
      // Wait for animation to complete
      await new Promise(resolve => setTimeout(resolve, element.animationDuration || 300))
      
      // Set final state
      updateElementState(elementType, targetState, `${reason}_animation_complete`)
      get().stopAnimation()
    }

    return {
      ...initialState,
      ...createBaseActions(),

      // =======================================================================
      // Mobile Menu Actions
      // =======================================================================
      
      openMobileMenu: async () => {
        const targetState: EnhancedNavigationState = { 
          type: 'overlay', 
          element: 'mobile_menu', 
          backdrop: true 
        }
        
        // Close other menus first
        get().closeAllDropdowns()
        
        // Enable focus trap for mobile menu
        get().setFocusTrap(true, 'mobile-menu')
        
        await withAnimation('mobile_menu', targetState, 'open_mobile_menu')
        
        // Announce to screen readers
        get().announceStateChange('mobile_menu', 'Mobile menu opened')
      },

      closeMobileMenu: async () => {
        const targetState: EnhancedNavigationState = { 
          type: 'collapsed', 
          element: 'mobile_menu' 
        }
        
        // Disable focus trap
        get().setFocusTrap(false)
        get().restoreFocus()
        
        await withAnimation('mobile_menu', targetState, 'close_mobile_menu')
        
        // Announce to screen readers
        get().announceStateChange('mobile_menu', 'Mobile menu closed')
      },

      toggleMobileMenu: () => {
        const currentState = get().mobileMenu.state
        if (currentState.type === 'collapsed') {
          get().openMobileMenu()
        } else {
          get().closeMobileMenu()
        }
      },

      setMobileMenuState: (state: EnhancedNavigationState) => {
        updateElementState('mobile_menu', state, 'set_mobile_menu_state')
      },

      // =======================================================================
      // Desktop Sidebar Actions
      // =======================================================================
      
      expandSidebar: async () => {
        const targetState: EnhancedNavigationState = { 
          type: 'expanded', 
          element: 'desktop_sidebar' 
        }
        
        await withAnimation('desktop_sidebar', targetState, 'expand_sidebar')
        
        // Persist user preference
        get().persistSidebarState(false)
        
        // Announce to screen readers
        get().announceStateChange('desktop_sidebar', 'Sidebar expanded')
      },

      collapseSidebar: async () => {
        const targetState: EnhancedNavigationState = { 
          type: 'collapsed', 
          element: 'desktop_sidebar' 
        }
        
        await withAnimation('desktop_sidebar', targetState, 'collapse_sidebar')
        
        // Persist user preference
        get().persistSidebarState(true)
        
        // Announce to screen readers
        get().announceStateChange('desktop_sidebar', 'Sidebar collapsed')
      },

      toggleSidebar: () => {
        const currentState = get().desktopSidebar.state
        if (currentState.type === 'collapsed') {
          get().expandSidebar()
        } else if (currentState.type === 'expanded') {
          get().collapseSidebar()
        }
      },

      setSidebarMini: async (showLabels = false) => {
        const targetState: EnhancedNavigationState = { 
          type: 'mini', 
          element: 'desktop_sidebar',
          showLabels 
        }
        
        await withAnimation('desktop_sidebar', targetState, 'set_sidebar_mini')
        
        // Announce to screen readers
        get().announceStateChange('desktop_sidebar', `Sidebar set to mini mode${showLabels ? ' with labels' : ''}`)
      },

      setSidebarState: (state: EnhancedNavigationState) => {
        updateElementState('desktop_sidebar', state, 'set_sidebar_state')
      },

      // =======================================================================
      // User Dropdown Actions
      // =======================================================================
      
      openUserDropdown: async () => {
        const targetState: EnhancedNavigationState = { 
          type: 'expanded', 
          element: 'user_dropdown' 
        }
        
        // Close other dropdowns
        get().closeAllDropdowns()
        
        await withAnimation('user_dropdown', targetState, 'open_user_dropdown')
        
        // Add to opened dropdowns set
        const newDropdowns = new Set(get().openedDropdowns)
        newDropdowns.add('user-dropdown')
        set({ openedDropdowns: newDropdowns })
        
        // Announce to screen readers
        get().announceStateChange('user_dropdown', 'User menu opened')
      },

      closeUserDropdown: async () => {
        const targetState: EnhancedNavigationState = { 
          type: 'collapsed', 
          element: 'user_dropdown' 
        }
        
        await withAnimation('user_dropdown', targetState, 'close_user_dropdown')
        
        // Remove from opened dropdowns set
        const newDropdowns = new Set(get().openedDropdowns)
        newDropdowns.delete('user-dropdown')
        set({ openedDropdowns: newDropdowns })
        
        // Announce to screen readers
        get().announceStateChange('user_dropdown', 'User menu closed')
      },

      toggleUserDropdown: () => {
        const currentState = get().userDropdown.state
        if (currentState.type === 'collapsed') {
          get().openUserDropdown()
        } else {
          get().closeUserDropdown()
        }
      },

      setUserDropdownState: (state: EnhancedNavigationState) => {
        updateElementState('user_dropdown', state, 'set_user_dropdown_state')
      },

      // Focus management implementations
      setFocusTrap: (enabled: boolean, elementId?: string) => {
        set(state => ({ 
          focusState: { 
            ...state.focusState, 
            focusTrapActive: enabled,
            focusedElementId: elementId || null
          } 
        }))
      },
      restoreFocus: () => {
        const { focusState } = get()
        if (focusState.restoreFocusTo) {
          const element = document.getElementById(focusState.restoreFocusTo)
          element?.focus()
        }
      },
      setActiveElement: (elementId: string | null) => {
        set(state => ({ 
          focusState: { ...state.focusState, activeElement: elementId } 
        }))
      },
      updateTabSequence: (sequence: string[]) => {
        set(state => ({ 
          focusState: { ...state.focusState, tabSequence: sequence } 
        }))
      },
      
      // Animation implementations
      startAnimation: (type: 'opening' | 'closing', duration = 300, easing = 'ease-in-out' as const) => {
        set({ 
          animationState: { 
            isAnimating: true, 
            animationType: type, 
            startTime: Date.now(), 
            duration, 
            easing 
          } 
        })
      },
      stopAnimation: () => {
        set({ 
          animationState: { 
            isAnimating: false, 
            animationType: 'idle' as const, 
            startTime: 0, 
            duration: 0, 
            easing: 'ease-in-out' as const 
          } 
        })
      },
      updateAnimationProgress: (progress: number) => {
        set(state => ({ 
          animationState: { ...state.animationState, startTime: Date.now() - (progress * state.animationState.duration) } 
        }))
      },
      
      // Preferences implementations
      updatePreferences: (prefs: Partial<NavigationPreferences>) => {
        set(state => ({ 
          preferences: { ...state.preferences, ...prefs } 
        }))
      },
      persistSidebarState: (collapsed: boolean) => {
        set(state => ({ 
          preferences: { ...state.preferences, sidebarCollapsed: collapsed } 
        }))
      },
      enableReducedMotion: (enabled: boolean) => {
        set(state => ({ 
          preferences: { ...state.preferences, reducedMotion: enabled } 
        }))
      },
      
      // Menu management implementations
      openMenu: (menuId: string) => {
        set(state => {
          const newMenus = new Set(state.activeMenus)
          newMenus.add(menuId)
          return { activeMenus: newMenus }
        })
      },
      closeMenu: (menuId: string) => {
        set(state => {
          const newMenus = new Set(state.activeMenus)
          newMenus.delete(menuId)
          return { activeMenus: newMenus }
        })
      },
      closeAllMenus: () => {
        set({ activeMenus: new Set() })
      },
      toggleDropdown: (dropdownId: string) => {
        set(state => {
          const newDropdowns = new Set(state.openedDropdowns)
          if (newDropdowns.has(dropdownId)) {
            newDropdowns.delete(dropdownId)
          } else {
            newDropdowns.add(dropdownId)
          }
          return { openedDropdowns: newDropdowns }
        })
      },
      closeAllDropdowns: () => {
        set({ openedDropdowns: new Set() })
      },
      
      // Breadcrumb implementations
      setBreadcrumbs: (breadcrumbs: Array<{ label: string; path: string; active: boolean }>) => {
        set({ breadcrumbs })
      },
      addBreadcrumb: (label: string, path: string, makeActive = false) => {
        set(state => {
          const breadcrumbs = makeActive 
            ? state.breadcrumbs.map(b => ({ ...b, active: false }))
            : state.breadcrumbs
          return { breadcrumbs: [...breadcrumbs, { label, path, active: makeActive }] }
        })
      },
      removeBreadcrumb: (path: string) => {
        set(state => ({ 
          breadcrumbs: state.breadcrumbs.filter(b => b.path !== path) 
        }))
      },
      clearBreadcrumbs: () => {
        set({ breadcrumbs: [] })
      },
      
      // State machine utilities
      getTransitionHistory: (element: 'mobile_menu' | 'desktop_sidebar' | 'user_dropdown') => {
        const stateMachine = element === 'mobile_menu' ? get().mobileMenuStateMachine :
                           element === 'desktop_sidebar' ? get().sidebarStateMachine :
                           get().userDropdownStateMachine
        return stateMachine.transitions
      },
      rollbackState: (element: 'mobile_menu' | 'desktop_sidebar' | 'user_dropdown') => {
        const stateMachine = element === 'mobile_menu' ? get().mobileMenuStateMachine :
                           element === 'desktop_sidebar' ? get().sidebarStateMachine :
                           get().userDropdownStateMachine
        return stateMachine.rollback()
      },
      canTransitionTo: (element: 'mobile_menu' | 'desktop_sidebar' | 'user_dropdown', newState: EnhancedNavigationState['type']) => {
        const stateMachine = element === 'mobile_menu' ? get().mobileMenuStateMachine :
                           element === 'desktop_sidebar' ? get().sidebarStateMachine :
                           get().userDropdownStateMachine
        return stateMachine.canTransitionTo(newState)
      },
      debugStateMachines: () => {
        console.log('Navigation State Machines:', {
          mobileMenu: get().mobileMenuStateMachine,
          sidebar: get().sidebarStateMachine,
          userDropdown: get().userDropdownStateMachine
        })
      },
      
      // Accessibility implementations
      announceStateChange: (_element: 'mobile_menu' | 'desktop_sidebar' | 'user_dropdown', message: string) => {
        // Create or update aria-live region for screen readers
        const announcement = document.getElementById('navigation-announcements') || 
                           (() => {
                             const el = document.createElement('div')
                             el.id = 'navigation-announcements'
                             el.className = 'sr-only'
                             el.setAttribute('aria-live', 'polite')
                             el.setAttribute('aria-atomic', 'true')
                             document.body.appendChild(el)
                             return el
                           })()
        announcement.textContent = message
      },
      updateAriaStates: () => {
        // Update ARIA attributes based on current state
        const state = get()
        const mobileMenuEl = document.getElementById(state.mobileMenu.id)
        const sidebarEl = document.getElementById(state.desktopSidebar.id)
        const dropdownEl = document.getElementById(state.userDropdown.id)
        
        if (mobileMenuEl) {
          mobileMenuEl.setAttribute('aria-expanded', 
            (state.mobileMenu.state.type === 'expanded' || state.mobileMenu.state.type === 'overlay').toString())
        }
        if (sidebarEl) {
          sidebarEl.setAttribute('aria-expanded', 
            (state.desktopSidebar.state.type === 'expanded').toString())
        }
        if (dropdownEl) {
          dropdownEl.setAttribute('aria-expanded', 
            (state.userDropdown.state.type === 'expanded').toString())
        }
      },
      
      // Batch update implementation
      batchStateUpdate: (updates: { 
        mobileMenu?: Partial<NavigationElement>
        desktopSidebar?: Partial<NavigationElement>
        userDropdown?: Partial<NavigationElement>
      }) => {
        set(state => {
          const newState: Partial<NavigationSliceState> = {}
          if (updates.mobileMenu) {
            newState.mobileMenu = { ...state.mobileMenu, ...updates.mobileMenu }
          }
          if (updates.desktopSidebar) {
            newState.desktopSidebar = { ...state.desktopSidebar, ...updates.desktopSidebar }
          }
          if (updates.userDropdown) {
            newState.userDropdown = { ...state.userDropdown, ...updates.userDropdown }
          }
          return newState
        })
      },

      // Reset functionality
      reset: () => set(initialState),
    }
      },
      {
        name: 'navigation',
        partialize: (state) => ({
          // Persist user preferences and sidebar state
          preferences: state.preferences,
          desktopSidebar: {
            ...state.desktopSidebar,
            // Only persist the collapsed/expanded state, not transitioning states
            state: state.desktopSidebar.state.type === 'collapsed' || state.desktopSidebar.state.type === 'expanded' 
                   ? state.desktopSidebar.state 
                   : { type: 'expanded', element: 'desktop_sidebar' }
          }
        }),
        version: 1,
      }
    ),
    {
      name: 'navigation-store',
    }
  )
)

// =============================================================================
// Enhanced Selectors
// =============================================================================

export const navigationSelectors = {
  // Mobile menu selectors
  selectMobileMenuState: (state: NavigationSliceState) => state.mobileMenu.state,
  selectIsMobileMenuOpen: (state: NavigationSliceState) => 
    state.mobileMenu.state.type === 'expanded' || state.mobileMenu.state.type === 'overlay',
  
  // Desktop sidebar selectors  
  selectSidebarState: (state: NavigationSliceState) => state.desktopSidebar.state,
  selectIsSidebarCollapsed: (state: NavigationSliceState) => state.desktopSidebar.state.type === 'collapsed',
  selectIsSidebarExpanded: (state: NavigationSliceState) => state.desktopSidebar.state.type === 'expanded',
  
  // User dropdown selectors
  selectUserDropdownState: (state: NavigationSliceState) => state.userDropdown.state,
  selectIsUserDropdownOpen: (state: NavigationSliceState) => state.userDropdown.state.type === 'expanded',
  
  // Global state selectors
  selectActiveMenus: (state: NavigationSliceState) => state.activeMenus,
  selectOpenedDropdowns: (state: NavigationSliceState) => state.openedDropdowns,
  selectBreadcrumbs: (state: NavigationSliceState) => state.breadcrumbs,
  
  // Preference selectors
  selectPreferences: (state: NavigationSliceState) => state.preferences,
  selectReducedMotion: (state: NavigationSliceState) => state.preferences.reducedMotion,
  selectAutoCloseMobileMenu: (state: NavigationSliceState) => state.preferences.autoCloseMobileMenu,
}

// =============================================================================
// Enhanced Hook  
// =============================================================================

export const useNavigation = () => {
  const store = useNavigationStore()
  
  return {
    // Element states
    mobileMenu: store.mobileMenu,
    desktopSidebar: store.desktopSidebar,
    userDropdown: store.userDropdown,
    
    // Computed states using selectors
    isMobileMenuOpen: navigationSelectors.selectIsMobileMenuOpen(store),
    isSidebarCollapsed: navigationSelectors.selectIsSidebarCollapsed(store),
    isSidebarExpanded: navigationSelectors.selectIsSidebarExpanded(store),
    isUserDropdownOpen: navigationSelectors.selectIsUserDropdownOpen(store),
    
    // Global states
    activeMenus: store.activeMenus,
    openedDropdowns: store.openedDropdowns,
    breadcrumbs: store.breadcrumbs,
    preferences: store.preferences,
    
    // Loading state
    isLoading: store.loading.isLoading,
    error: store.loading.error,
    
    // Actions (explicitly list to avoid duplicates)
    openMobileMenu: store.openMobileMenu,
    closeMobileMenu: store.closeMobileMenu,
    toggleMobileMenu: store.toggleMobileMenu,
    setMobileMenuState: store.setMobileMenuState,
    expandSidebar: store.expandSidebar,
    collapseSidebar: store.collapseSidebar,
    toggleSidebar: store.toggleSidebar,
    setSidebarMini: store.setSidebarMini,
    setSidebarState: store.setSidebarState,
    openUserDropdown: store.openUserDropdown,
    closeUserDropdown: store.closeUserDropdown,
    toggleUserDropdown: store.toggleUserDropdown,
    setUserDropdownState: store.setUserDropdownState,
    setFocusTrap: store.setFocusTrap,
    restoreFocus: store.restoreFocus,
    setActiveElement: store.setActiveElement,
    updateTabSequence: store.updateTabSequence,
    startAnimation: store.startAnimation,
    stopAnimation: store.stopAnimation,
    updateAnimationProgress: store.updateAnimationProgress,
    updatePreferences: store.updatePreferences,
    persistSidebarState: store.persistSidebarState,
    enableReducedMotion: store.enableReducedMotion,
    openMenu: store.openMenu,
    closeMenu: store.closeMenu,
    closeAllMenus: store.closeAllMenus,
    toggleDropdown: store.toggleDropdown,
    closeAllDropdowns: store.closeAllDropdowns,
    setBreadcrumbs: store.setBreadcrumbs,
    addBreadcrumb: store.addBreadcrumb,
    removeBreadcrumb: store.removeBreadcrumb,
    clearBreadcrumbs: store.clearBreadcrumbs,
    getTransitionHistory: store.getTransitionHistory,
    rollbackState: store.rollbackState,
    canTransitionTo: store.canTransitionTo,
    debugStateMachines: store.debugStateMachines,
    announceStateChange: store.announceStateChange,
    updateAriaStates: store.updateAriaStates,
    batchStateUpdate: store.batchStateUpdate,
    reset: store.reset,
  }
}

// =============================================================================
// Export Types for Component Usage
// =============================================================================

// Note: All types are already exported at their definition points above
// NavigationSliceState is exported as part of the interface definition