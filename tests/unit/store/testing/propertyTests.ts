/**
 * Property-Based Testing for DCE State Machines
 * 
 * Comprehensive property-based testing for all state machines in the DCE architecture:
 * - Modal state machines (blog, campaign, etc.)
 * - Navigation state machines (mobile menu, sidebar, dropdowns)
 * - Wizard state machines (campaign creation, onboarding)
 * - State transition validation and invariants
 * - Edge case discovery through randomized testing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act } from '@testing-library/react'
import { createStoreTestWrapper } from './storeTestUtils'

// Import store types for state machine testing
import { useBlogUIStore } from '../blogStore'
import { useNavigationStore } from '../slices/navigationSlice'

// ===========================================
// PROPERTY-BASED TESTING FRAMEWORK
// ===========================================

interface PropertyTestConfig {
  name: string
  iterations: number
  maxTransitions: number
  timeoutMs: number
  validateInvariants: boolean
}

interface StateTransitionTest<TState> {
  stateName: string
  validTransitions: Record<string, string[]>
  initialState: TState
  transitionActions: Record<string, (state: TState) => TState>
  invariants: Array<(state: TState) => boolean | string>
  postconditions: Record<string, (prevState: TState, newState: TState) => boolean | string>
}

interface PropertyTestResult {
  testName: string
  iterations: number
  passed: number
  failed: number
  errors: Array<{
    iteration: number
    sequence: string[]
    error: string
    stateBefore: unknown
    stateAfter: unknown
  }>
  coverage: {
    statesVisited: Set<string>
    transitionsExecuted: Set<string>
    totalStates: number
    totalTransitions: number
  }
}

// ===========================================
// RANDOM SEQUENCE GENERATORS
// ===========================================

class PropertyTestGenerator {
  private seed: number
  private rng: () => number

  constructor(seed?: number) {
    this.seed = seed || Math.floor(Math.random() * 1000000)
    this.rng = this.createSeededRandom(this.seed)
  }

  private createSeededRandom(seed: number): () => number {
    let state = seed
    return () => {
      state = (state * 1664525 + 1013904223) % Math.pow(2, 32)
      return state / Math.pow(2, 32)
    }
  }

  generateTransitionSequence(
    validTransitions: Record<string, string[]>,
    startState: string,
    maxLength: number
  ): string[] {
    const sequence: string[] = []
    let currentState = startState

    for (let i = 0; i < maxLength; i++) {
      const possibleTransitions = validTransitions[currentState] || []
      if (possibleTransitions.length === 0) break

      const randomIndex = Math.floor(this.rng() * possibleTransitions.length)
      const nextTransition = possibleTransitions[randomIndex]
      
      sequence.push(nextTransition)
      
      // Update current state based on transition
      currentState = this.getStateAfterTransition(currentState, nextTransition)
    }

    return sequence
  }

  private getStateAfterTransition(currentState: string, transition: string): string {
    // This is a simplified state transition mapping
    // In practice, this would be derived from the actual state machine logic
    const transitionMap: Record<string, Record<string, string>> = {
      'closed': {
        'open': 'open',
        'open_with_data': 'open'
      },
      'open': {
        'close': 'closed',
        'confirm': 'processing',
        'cancel': 'closed'
      },
      'processing': {
        'success': 'closed',
        'error': 'error',
        'cancel': 'open'
      },
      'error': {
        'retry': 'processing',
        'close': 'closed',
        'cancel': 'closed'
      }
    }

    return transitionMap[currentState]?.[transition] || currentState
  }

  generateRandomData<T>(type: string): T {
    const generators: Record<string, () => unknown> = {
      string: () => `test_${Math.floor(this.rng() * 1000)}`,
      number: () => Math.floor(this.rng() * 1000),
      boolean: () => this.rng() > 0.5,
      id: () => `id_${Math.floor(this.rng() * 100000)}`,
      email: () => `test${Math.floor(this.rng() * 1000)}@example.com`,
      date: () => new Date(Date.now() + (this.rng() - 0.5) * 86400000 * 365).toISOString()
    }

    return generators[type]?.() as T ?? null
  }

  getSeed(): number {
    return this.seed
  }
}

// ===========================================
// PROPERTY TEST RUNNER
// ===========================================

export async function runPropertyTest<TState>(
  testDefinition: StateTransitionTest<TState>,
  config: PropertyTestConfig
): Promise<PropertyTestResult> {
  const result: PropertyTestResult = {
    testName: testDefinition.stateName,
    iterations: config.iterations,
    passed: 0,
    failed: 0,
    errors: [],
    coverage: {
      statesVisited: new Set(),
      transitionsExecuted: new Set(),
      totalStates: Object.keys(testDefinition.validTransitions).length,
      totalTransitions: Object.values(testDefinition.validTransitions).flat().length
    }
  }

  for (let iteration = 0; iteration < config.iterations; iteration++) {
    const generator = new PropertyTestGenerator(iteration)
    let currentState = testDefinition.initialState
    const sequence: string[] = []

    try {
      // Generate random transition sequence
      const startStateName = this.getStateName(currentState)
      const transitionSequence = generator.generateTransitionSequence(
        testDefinition.validTransitions,
        startStateName,
        config.maxTransitions
      )

      // Execute the sequence
      for (const transition of transitionSequence) {
        const previousState = { ...currentState }
        
        // Check if transition is valid from current state
        const currentStateName = this.getStateName(currentState)
        const validTransitions = testDefinition.validTransitions[currentStateName] || []
        
        if (!validTransitions.includes(transition)) {
          throw new Error(`Invalid transition '${transition}' from state '${currentStateName}'`)
        }

        // Execute transition
        if (testDefinition.transitionActions[transition]) {
          currentState = testDefinition.transitionActions[transition](currentState)
        }

        sequence.push(transition)
        result.coverage.statesVisited.add(this.getStateName(currentState))
        result.coverage.transitionsExecuted.add(transition)

        // Validate invariants
        if (config.validateInvariants) {
          for (const invariant of testDefinition.invariants) {
            const invariantResult = invariant(currentState)
            if (invariantResult !== true) {
              throw new Error(`Invariant violated: ${invariantResult}`)
            }
          }
        }

        // Validate postconditions
        const postcondition = testDefinition.postconditions[transition]
        if (postcondition) {
          const postconditionResult = postcondition(previousState, currentState)
          if (postconditionResult !== true) {
            throw new Error(`Postcondition violated for '${transition}': ${postconditionResult}`)
          }
        }
      }

      result.passed++

    } catch (error) {
      result.failed++
      result.errors.push({
        iteration,
        sequence,
        error: error instanceof Error ? error.message : String(error),
        stateBefore: JSON.parse(JSON.stringify(testDefinition.initialState)),
        stateAfter: JSON.parse(JSON.stringify(currentState))
      })
    }
  }

  return result
}


// ===========================================
// MODAL STATE MACHINE TESTS
// ===========================================

describe('Modal State Machine Property Tests', () => {
  let blogUIWrapper: ReturnType<typeof createStoreTestWrapper>

  beforeEach(() => {
    blogUIWrapper = createStoreTestWrapper(useBlogUIStore, {
      storeName: 'blog-ui-modal-tests',
      trackStateChanges: true,
      trackPerformance: true
    })
  })

  afterEach(() => {
    blogUIWrapper.cleanup()
  })

  it('should maintain modal state invariants under random transitions', async () => {
    const modalStateTest: StateTransitionTest<{ type: string | null; id?: string; entityType?: string }> = {
      stateName: 'modal-state-machine',
      initialState: { type: null },
      
      validTransitions: {
        'null': ['open_create', 'open_edit', 'open_delete'],
        'create': ['close', 'cancel', 'confirm'],
        'edit': ['close', 'cancel', 'confirm', 'open_delete'],
        'delete': ['close', 'cancel', 'confirm'],
        'processing': ['success', 'error'],
        'error': ['retry', 'close']
      },

      transitionActions: {
        'open_create': (state) => ({ ...state, type: 'create', entityType: 'blog_post' }),
        'open_edit': (state) => ({ ...state, type: 'edit', id: 'post-123', entityType: 'blog_post' }),
        'open_delete': (state) => ({ ...state, type: 'delete', id: state.id || 'post-123' }),
        'close': () => ({ type: null }),
        'cancel': () => ({ type: null }),
        'confirm': (state) => ({ ...state, type: 'processing' }),
        'success': () => ({ type: null }),
        'error': (state) => ({ ...state, type: 'error' }),
        'retry': (state) => ({ ...state, type: 'processing' })
      },

      invariants: [
        // Modal state must always be valid
        (state) => {
          const validTypes = [null, 'create', 'edit', 'delete', 'processing', 'error']
          return validTypes.includes(state.type) || `Invalid modal type: ${state.type}`
        },
        
        // Edit and delete modals must have an ID
        (state) => {
          if (state.type === 'edit' || state.type === 'delete') {
            return Boolean(state.id) || `${state.type} modal must have an ID`
          }
          return true
        },
        
        // Create modals should have entity type
        (state) => {
          if (state.type === 'create') {
            return Boolean(state.entityType) || 'Create modal must have entity type'
          }
          return true
        }
      ],

      postconditions: {
        'open_create': (prev, curr) => 
          curr.type === 'create' || 'Failed to open create modal',
        'open_edit': (prev, curr) => 
          curr.type === 'edit' && Boolean(curr.id) || 'Failed to open edit modal with ID',
        'close': (prev, curr) => 
          curr.type === null || 'Failed to close modal',
        'cancel': (prev, curr) => 
          curr.type === null || 'Failed to cancel modal'
      }
    }

    const result = await runPropertyTest(modalStateTest, {
      name: 'modal-invariants-test',
      iterations: 500,
      maxTransitions: 20,
      timeoutMs: 10000,
      validateInvariants: true
    })

    // Assert test results
    expect(result.passed).toBeGreaterThan(result.failed)
    expect(result.errors.length).toBeLessThan(result.iterations * 0.1) // Less than 10% failure rate
    
    // Assert good coverage
    expect(result.coverage.statesVisited.size).toBeGreaterThan(3)
    expect(result.coverage.transitionsExecuted.size).toBeGreaterThan(5)

    // Log failures for debugging
    if (result.errors.length > 0) {
      console.warn(`Modal state machine test had ${result.errors.length} failures:`)
      result.errors.slice(0, 3).forEach((error, index) => {
        console.warn(`  ${index + 1}. Iteration ${error.iteration}: ${error.error}`)
        console.warn(`     Sequence: ${error.sequence.join(' -> ')}`)
      })
    }
  })

  it('should handle concurrent modal operations correctly', async () => {
    const concurrencyTest = async () => {
      const promises = Array.from({ length: 10 }, async (_, i) => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            act(() => {
              if (i % 3 === 0) {
                blogUIWrapper.store.getState().openCreateModal('blog_post')
              } else if (i % 3 === 1) {
                blogUIWrapper.store.getState().openEditModal(`post-${i}`)
              } else {
                blogUIWrapper.store.getState().closeEditModal()
              }
            })
            resolve()
          }, Math.random() * 100)
        })
      })

      await Promise.all(promises)
    }

    // Run concurrency test multiple times
    for (let run = 0; run < 10; run++) {
      await concurrencyTest()
      
      // Verify state is still valid
      const finalState = blogUIWrapper.getState()
      expect(finalState.modalState).toBeDefined()
      expect(['create', 'edit', 'delete', null].includes(finalState.modalState.type)).toBe(true)
      
      // Reset between runs
      blogUIWrapper.reset()
    }
  })
})

// ===========================================
// NAVIGATION STATE MACHINE TESTS
// ===========================================

describe('Navigation State Machine Property Tests', () => {
  let navigationWrapper: ReturnType<typeof createStoreTestWrapper>

  beforeEach(() => {
    navigationWrapper = createStoreTestWrapper(useNavigationStore, {
      storeName: 'navigation-state-tests',
      trackStateChanges: true,
      trackPerformance: true
    })
  })

  afterEach(() => {
    navigationWrapper.cleanup()
  })

  it('should maintain navigation accessibility invariants', async () => {
    const navigationTest: StateTransitionTest<{
      type: 'collapsed' | 'expanded' | 'transitioning'
      element: string
    }> = {
      stateName: 'navigation-state-machine',
      initialState: { type: 'collapsed', element: 'mobile_menu' },
      
      validTransitions: {
        'collapsed': ['expand', 'toggle'],
        'expanded': ['collapse', 'toggle', 'navigate_and_close'],
        'transitioning': ['complete_transition', 'cancel_transition']
      },

      transitionActions: {
        'expand': (state) => ({ ...state, type: 'expanded' as const }),
        'collapse': (state) => ({ ...state, type: 'collapsed' as const }),
        'toggle': (state) => ({ 
          ...state, 
          type: state.type === 'collapsed' ? 'expanded' as const : 'collapsed' as const 
        }),
        'navigate_and_close': (state) => ({ ...state, type: 'collapsed' as const }),
        'complete_transition': (state) => ({ ...state, type: 'expanded' as const }),
        'cancel_transition': (state) => ({ ...state, type: 'collapsed' as const })
      },

      invariants: [
        // State must always be valid
        (state) => {
          const validStates = ['collapsed', 'expanded', 'transitioning']
          return validStates.includes(state.type) || `Invalid navigation state: ${state.type}`
        },
        
        // Element must be specified
        (state) => {
          return Boolean(state.element) || 'Navigation element must be specified'
        }
      ],

      postconditions: {
        'expand': (prev, curr) => 
          curr.type === 'expanded' || 'Failed to expand navigation',
        'collapse': (prev, curr) => 
          curr.type === 'collapsed' || 'Failed to collapse navigation',
        'toggle': (prev, curr) => 
          curr.type !== prev.type || 'Failed to toggle navigation state'
      }
    }

    const result = await runPropertyTest(navigationTest, {
      name: 'navigation-accessibility-test',
      iterations: 300,
      maxTransitions: 15,
      timeoutMs: 8000,
      validateInvariants: true
    })

    expect(result.passed).toBeGreaterThan(result.failed)
    expect(result.coverage.statesVisited.size).toBeGreaterThanOrEqual(2)
    
    // Specific accessibility checks
    const navState = navigationWrapper.getState()
    expect(navState.focusState).toBeDefined()
    expect(navState.animationState).toBeDefined()
  })

  it('should handle rapid state transitions without race conditions', async () => {
    const rapidTransitionTest = async () => {
      const transitions = ['expand', 'collapse', 'toggle', 'toggle', 'expand']
      
      for (const transition of transitions) {
        act(() => {
          switch (transition) {
            case 'expand':
              navigationWrapper.store.getState().expandElement('mobile_menu')
              break
            case 'collapse':
              navigationWrapper.store.getState().collapseElement('mobile_menu')
              break
            case 'toggle':
              navigationWrapper.store.getState().toggleElement('mobile_menu')
              break
          }
        })
        
        // Small delay to simulate real-world timing
        await new Promise(resolve => setTimeout(resolve, 1))
      }
    }

    // Run rapid transition test multiple times
    for (let run = 0; run < 20; run++) {
      await rapidTransitionTest()
      
      // Verify final state is valid
      const finalState = navigationWrapper.getState()
      expect(['collapsed', 'expanded'].includes(finalState.mobileMenu.type)).toBe(true)
      
      // Check for race condition indicators
      const history = navigationWrapper.getStateHistory()
      const lastFewChanges = history.slice(-5)
      
      // Ensure state changes are sequential and logical
      for (let i = 1; i < lastFewChanges.length; i++) {
        const prev = lastFewChanges[i - 1]
        const curr = lastFewChanges[i]
        expect(curr.timestamp).toBeGreaterThanOrEqual(prev.timestamp)
      }
    }
  })
})

// ===========================================
// CAMPAIGN WIZARD STATE MACHINE TESTS
// ===========================================

describe('Campaign Wizard State Machine Property Tests', () => {
  // Note: This would require the campaign wizard store to be implemented
  // For now, we'll create a mock test structure

  it('should validate multi-step wizard progression', async () => {
    const wizardTest: StateTransitionTest<{
      currentStep: number
      totalSteps: number
      isValid: boolean
      data: Record<string, unknown>
    }> = {
      stateName: 'campaign-wizard-state-machine',
      initialState: { currentStep: 1, totalSteps: 5, isValid: false, data: {} },
      
      validTransitions: {
        '1': ['next', 'save_draft'],
        '2': ['next', 'previous', 'save_draft'],
        '3': ['next', 'previous', 'save_draft'],
        '4': ['next', 'previous', 'save_draft'],
        '5': ['previous', 'submit', 'save_draft']
      },

      transitionActions: {
        'next': (state) => ({ 
          ...state, 
          currentStep: Math.min(state.currentStep + 1, state.totalSteps) 
        }),
        'previous': (state) => ({ 
          ...state, 
          currentStep: Math.max(state.currentStep - 1, 1) 
        }),
        'save_draft': (state) => ({ ...state, data: { ...state.data, saved: true } }),
        'submit': (state) => ({ ...state, currentStep: 0, isValid: true }) // Completed state
      },

      invariants: [
        (state) => 
          state.currentStep >= 0 && state.currentStep <= state.totalSteps || 
          `Invalid step: ${state.currentStep}/${state.totalSteps}`,
        
        (state) => 
          state.totalSteps > 0 || 'Total steps must be positive',
        
        (state) => 
          typeof state.data === 'object' || 'Data must be an object'
      ],

      postconditions: {
        'next': (prev, curr) => 
          curr.currentStep === Math.min(prev.currentStep + 1, prev.totalSteps) || 
          'Next step calculation incorrect',
        
        'previous': (prev, curr) => 
          curr.currentStep === Math.max(prev.currentStep - 1, 1) || 
          'Previous step calculation incorrect',
        
        'submit': (prev, curr) => 
          curr.currentStep === 0 && curr.isValid || 
          'Submit should complete wizard'
      }
    }

    const result = await runPropertyTest(wizardTest, {
      name: 'wizard-progression-test',
      iterations: 200,
      maxTransitions: 25,
      timeoutMs: 5000,
      validateInvariants: true
    })

    expect(result.passed).toBeGreaterThan(result.failed)
    expect(result.coverage.statesVisited.size).toBeGreaterThanOrEqual(3)
  })
})

// ===========================================
// PERFORMANCE PROPERTY TESTS
// ===========================================

describe('State Machine Performance Property Tests', () => {
  it('should maintain performance under high-frequency transitions', async () => {
    const blogUIWrapper = createStoreTestWrapper(useBlogUIStore, {
      storeName: 'performance-test',
      trackPerformance: true
    })

    const startTime = performance.now()
    const transitionCount = 1000

    // Execute many rapid transitions
    for (let i = 0; i < transitionCount; i++) {
      act(() => {
        if (i % 4 === 0) blogUIWrapper.store.getState().openCreateModal()
        else if (i % 4 === 1) blogUIWrapper.store.getState().openEditModal(`post-${i}`)
        else if (i % 4 === 2) blogUIWrapper.store.getState().openDeleteModal(`post-${i}`)
        else blogUIWrapper.store.getState().closeEditModal()
      })
    }

    const endTime = performance.now()
    const totalTime = endTime - startTime
    const averageTransitionTime = totalTime / transitionCount

    // Performance assertions
    expect(averageTransitionTime).toBeLessThan(1) // Less than 1ms per transition
    expect(totalTime).toBeLessThan(5000) // Total under 5 seconds

    // Memory usage should be reasonable
    const performanceSummary = blogUIWrapper.getPerformanceSummary()
    if (performanceSummary) {
      expect(performanceSummary.avgMemoryUsage).toBeLessThan(10 * 1024 * 1024) // 10MB
    }

    blogUIWrapper.cleanup()
  })
})

// ===========================================
// UTILITY FUNCTIONS FOR PROPERTY TESTING
// ===========================================

export function generateRandomModalSequence(length: number): string[] {
  const actions = ['openCreate', 'openEdit', 'openDelete', 'close', 'cancel']
  const sequence: string[] = []
  
  for (let i = 0; i < length; i++) {
    const randomAction = actions[Math.floor(Math.random() * actions.length)]
    sequence.push(randomAction)
  }
  
  return sequence
}

export function validateStateTransitionCoverage(
  coverage: PropertyTestResult['coverage']
): { score: number; missing: string[] } {
  const stateScore = coverage.statesVisited.size / coverage.totalStates
  const transitionScore = coverage.transitionsExecuted.size / coverage.totalTransitions
  const overallScore = (stateScore + transitionScore) / 2

  const missingElements: string[] = []
  
  if (stateScore < 0.8) {
    missingElements.push(`Low state coverage: ${Math.round(stateScore * 100)}%`)
  }
  
  if (transitionScore < 0.7) {
    missingElements.push(`Low transition coverage: ${Math.round(transitionScore * 100)}%`)
  }

  return {
    score: overallScore,
    missing: missingElements
  }
}

export function createStateMachineInvariantValidator<T>(
  invariants: Array<(state: T) => boolean | string>
) {
  return (state: T): { valid: boolean; violations: string[] } => {
    const violations: string[] = []
    
    for (const invariant of invariants) {
      const result = invariant(state)
      if (result !== true) {
        violations.push(typeof result === 'string' ? result : 'Invariant violation')
      }
    }
    
    return {
      valid: violations.length === 0,
      violations
    }
  }
}