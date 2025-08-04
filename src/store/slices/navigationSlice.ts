// Navigation State Machine Slice
// Manages navigation state for layout components (mobile menu, sidebar, user dropdown)

import type { BaseSlice, LoadingState } from '../utils/createSlice'
import { createSlice, createBaseActions } from '../utils/createSlice'
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
  canTransitionTo: (newType: string) => boolean
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
  loadingState: { status: 'idle' } as LoadingState,
  
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

export const useNavigationStore = createSlice<NavigationSliceState>(
  (set, get) => {
    
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
      ...createBaseActions(set),

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

      // Stub implementations for other methods (shortened for brevity)
      setFocusTrap: () => {},
      restoreFocus: () => {},
      setActiveElement: () => {},
      updateTabSequence: () => {},
      startAnimation: () => {},
      stopAnimation: () => {},
      updateAnimationProgress: () => {},
      updatePreferences: () => {},
      persistSidebarState: () => {},
      enableReducedMotion: () => {},
      openMenu: () => {},
      closeMenu: () => {},
      closeAllMenus: () => {},
      toggleDropdown: () => {},
      closeAllDropdowns: () => {},
      setBreadcrumbs: () => {},
      addBreadcrumb: () => {},
      removeBreadcrumb: () => {},
      clearBreadcrumbs: () => {},
      getTransitionHistory: () => [],
      rollbackState: () => false,
      canTransitionTo: () => true,
      debugStateMachines: () => {},
      announceStateChange: () => {},
      updateAriaStates: () => {},
      batchStateUpdate: () => {},

      // Reset functionality
      reset: () => set(initialState),
    }
  },
  {
    name: 'navigation',
    persist: {
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
    },
  }
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
    isLoading: store.loadingState.status === 'loading',
    error: store.loadingState.status === 'failed' ? store.loadingState.error : null,
    
    // All actions from the store
    ...store,
  }
}

// =============================================================================
// Export Types for Component Usage
// =============================================================================

export type { 
  EnhancedNavigationState, 
  NavigationElement, 
  FocusState, 
  AnimationState, 
  NavigationPreferences,
  NavigationSliceState 
}