// State machine utilities for modal and UI state management

// Modal state types
export interface ModalState {
  isOpen: boolean
  isLoading: boolean
  error: string | null
  data: unknown
}

// State machine types
export interface StateMachine<TStates extends string, TEvents extends string> {
  currentState: TStates
  send: (event: TEvents) => void
  can: (event: TEvents) => boolean
  reset: () => void
}

// Modal state machine states
export type ModalStates = 'closed' | 'opening' | 'open' | 'closing' | 'error'
export type ModalEvents = 'OPEN' | 'CLOSE' | 'ERROR' | 'RESET'

// State machine transitions
interface StateTransitions<TStates extends string> {
  [state: string]: {
    [event: string]: TStates
  }
}

// Create modal state machine
export function createModalStateMachine<T = unknown>(
  initialState: ModalStates = 'closed'
): StateMachine<ModalStates, ModalEvents> & ModalState {
  let currentState: ModalStates = initialState
  let isOpen = false
  let isLoading = false
  let error: string | null = null
  let data: T | null = null

  const transitions: StateTransitions<ModalStates> = {
    closed: {
      OPEN: 'opening',
    },
    opening: {
      OPEN: 'open',
      ERROR: 'error',
      CLOSE: 'closed',
    },
    open: {
      CLOSE: 'closing',
      ERROR: 'error',
    },
    closing: {
      CLOSE: 'closed',
      ERROR: 'error',
    },
    error: {
      CLOSE: 'closed',
      RESET: 'closed',
    },
  }

  const updateModalState = (state: ModalStates) => {
    currentState = state
    isOpen = state === 'open' || state === 'opening'
    isLoading = state === 'opening' || state === 'closing'
    if (state !== 'error') {
      error = null
    }
  }

  return {
    get currentState() {
      return currentState
    },
    get isOpen() {
      return isOpen
    },
    get isLoading() {
      return isLoading
    },
    get error() {
      return error
    },
    get data() {
      return data
    },
    send(event: ModalEvents) {
      const nextState = transitions[currentState]?.[event]
      if (nextState) {
        updateModalState(nextState)
      }
    },
    can(event: ModalEvents): boolean {
      return !!transitions[currentState]?.[event]
    },
    reset() {
      updateModalState('closed')
      error = null
      data = null
    },
  }
}

// Enhanced modal actions for Zustand integration
export interface EnhancedModalActions<T = unknown> {
  openModal: (data?: T) => Promise<void>
  closeModal: () => void
  setModalError: (error: string) => void
  resetModal: () => void
}

export function createEnhancedModalActions<T = unknown>(
  set: (partial: Partial<unknown> | ((state: unknown) => Partial<unknown>), replace?: boolean) => void,
  stateMachine: StateMachine<ModalStates, ModalEvents> & ModalState
): EnhancedModalActions<T> {
  return {
    async openModal(data?: T) {
      if (stateMachine.can('OPEN')) {
        stateMachine.send('OPEN')
        set({ modalState: { ...stateMachine }, modalData: data })
        
        // Simulate async opening animation
        await new Promise(resolve => setTimeout(resolve, 150))
        
        if (stateMachine.currentState === 'opening') {
          stateMachine.send('OPEN')
          set({ modalState: { ...stateMachine } })
        }
      }
    },

    closeModal() {
      if (stateMachine.can('CLOSE')) {
        stateMachine.send('CLOSE')
        set({ modalState: { ...stateMachine } })
        
        // Simulate async closing animation
        setTimeout(() => {
          if (stateMachine.currentState === 'closing') {
            stateMachine.send('CLOSE')
            set({ modalState: { ...stateMachine }, modalData: null })
          }
        }, 150)
      }
    },

    setModalError(error: string) {
      if (stateMachine.can('ERROR')) {
        stateMachine.send('ERROR')
        set({ 
          modalState: { 
            ...stateMachine, 
            error 
          } 
        })
      }
    },

    resetModal() {
      stateMachine.reset()
      set({ 
        modalState: { ...stateMachine }, 
        modalData: null 
      })
    },
  }
}

// Dropdown state machine
export type DropdownStates = 'closed' | 'opening' | 'open' | 'closing'
export type DropdownEvents = 'TOGGLE' | 'OPEN' | 'CLOSE'

export function createDropdownStateMachine(
  initialState: DropdownStates = 'closed'
): StateMachine<DropdownStates, DropdownEvents> {
  let currentState: DropdownStates = initialState

  const transitions: StateTransitions<DropdownStates> = {
    closed: {
      TOGGLE: 'opening',
      OPEN: 'opening',
    },
    opening: {
      TOGGLE: 'closing',
      CLOSE: 'closing',
      OPEN: 'open',
    },
    open: {
      TOGGLE: 'closing',
      CLOSE: 'closing',
    },
    closing: {
      TOGGLE: 'opening',
      OPEN: 'opening',
      CLOSE: 'closed',
    },
  }

  return {
    get currentState() {
      return currentState
    },
    send(event: DropdownEvents) {
      const nextState = transitions[currentState]?.[event]
      if (nextState) {
        currentState = nextState
      }
    },
    can(event: DropdownEvents): boolean {
      return !!transitions[currentState]?.[event]
    },
    reset() {
      currentState = 'closed'
    },
  }
}

// Accordion/Expandable state machine
export type ExpandableStates = 'collapsed' | 'expanding' | 'expanded' | 'collapsing'
export type ExpandableEvents = 'TOGGLE' | 'EXPAND' | 'COLLAPSE'

export function createExpandableStateMachine(
  initialState: ExpandableStates = 'collapsed'
): StateMachine<ExpandableStates, ExpandableEvents> {
  let currentState: ExpandableStates = initialState

  const transitions: StateTransitions<ExpandableStates> = {
    collapsed: {
      TOGGLE: 'expanding',
      EXPAND: 'expanding',
    },
    expanding: {
      TOGGLE: 'collapsing',
      COLLAPSE: 'collapsing',
      EXPAND: 'expanded',
    },
    expanded: {
      TOGGLE: 'collapsing',
      COLLAPSE: 'collapsing',
    },
    collapsing: {
      TOGGLE: 'expanding',
      EXPAND: 'expanding',
      COLLAPSE: 'collapsed',
    },
  }

  return {
    get currentState() {
      return currentState
    },
    send(event: ExpandableEvents) {
      const nextState = transitions[currentState]?.[event]
      if (nextState) {
        currentState = nextState
      }
    },
    can(event: ExpandableEvents): boolean {
      return !!transitions[currentState]?.[event]
    },
    reset() {
      currentState = 'collapsed'
    },
  }
}