import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { z } from 'zod'

// Campaign wizard form data schema (matches CreateCampaignFormData)
const campaignWizardSchema = z.object({
  name: z
    .string()
    .min(3, 'Campaign name must be at least 3 characters')
    .max(100, 'Campaign name must be less than 100 characters'),
  vertical: z.enum([
    'insurance',
    'home_services',
    'legal',
    'medical',
    'financial',
    'education',
    'automotive',
    'real_estate',
  ]),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be less than 500 characters'),
  target_cpa: z
    .number()
    .min(1, 'Target CPA must be at least $1')
    .max(1000, 'Target CPA must be less than $1,000'),
  daily_budget: z
    .number()
    .min(10, 'Daily budget must be at least $10')
    .max(10000, 'Daily budget must be less than $10,000'),
  monthly_budget: z
    .number()
    .min(100, 'Monthly budget must be at least $100')
    .max(100000, 'Monthly budget must be less than $100,000'),
  geo_targeting: z.object({
    countries: z.array(z.string()).min(1, 'Select at least one country'),
    states: z.array(z.string()).optional(),
    cities: z.array(z.string()).optional(),
    radius_miles: z.number().min(1).max(500).optional(),
  }),
  time_targeting: z.object({
    days_of_week: z
      .array(
        z.enum([
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday',
          'sunday',
        ] as const)
      )
      .min(1, 'Select at least one day'),
    hours: z.object({
      start: z.string().length(5, 'Invalid time format'),
      end: z.string().length(5, 'Invalid time format'),
    }),
    timezone: z.string().min(1, 'Select a timezone'),
  }),
  quality_requirements: z.object({
    minimum_call_duration: z
      .number()
      .min(30, 'Minimum call duration must be at least 30 seconds')
      .max(600, 'Maximum call duration is 10 minutes'),
    quality_score_threshold: z.number().min(1).max(100),
    allow_transferred_calls: z.boolean(),
    require_unique_callers: z.boolean(),
  }),
  payout_settings: z.object({
    payout_model: z.enum(['cpa', 'cpc', 'cpm']),
    base_payout: z
      .number()
      .min(1, 'Base payout must be at least $1')
      .max(500, 'Base payout must be less than $500'),
    bonus_conditions: z
      .array(
        z.object({
          condition: z.string(),
          bonus_amount: z.number().min(0),
        })
      )
      .optional(),
  }),
})

// Step-specific validation schemas
const step1Schema = z.object({
  name: campaignWizardSchema.shape.name,
  vertical: campaignWizardSchema.shape.vertical,
  description: campaignWizardSchema.shape.description,
})

const step2Schema = z.object({
  geo_targeting: campaignWizardSchema.shape.geo_targeting,
  time_targeting: campaignWizardSchema.shape.time_targeting,
})

const step3Schema = z.object({
  quality_requirements: campaignWizardSchema.shape.quality_requirements,
})

const step4Schema = z.object({
  target_cpa: campaignWizardSchema.shape.target_cpa,
  daily_budget: campaignWizardSchema.shape.daily_budget,
  monthly_budget: campaignWizardSchema.shape.monthly_budget,
  payout_settings: campaignWizardSchema.shape.payout_settings,
})

export type CampaignWizardFormData = z.infer<typeof campaignWizardSchema>

// Export the schema for external validation use
export { campaignWizardSchema }

// Wizard state types
export type WizardState = 
  | { type: 'idle' }
  | { type: 'active'; currentStepId: string }
  | { type: 'validating'; stepId: string }
  | { type: 'error'; message: string; stepId?: string }
  | { type: 'completing' }
  | { type: 'completed'; data: CampaignWizardFormData }
  | { type: 'cancelled' }

export interface WizardStep {
  id: string
  name: string
  description: string
  isComplete: boolean
  isValid: boolean
  validationErrors: Record<string, string[]>
  data: Partial<CampaignWizardFormData>
}

// Step configuration
const WIZARD_STEPS: Array<{ id: string; name: string; description: string }> = [
  { id: 'basic-info', name: 'Basic Info', description: 'Campaign details and vertical' },
  { id: 'targeting', name: 'Targeting', description: 'Geographic and time targeting' },
  { id: 'call-handling', name: 'Quality', description: 'Quality requirements and filters' },
  { id: 'budget-schedule', name: 'Payout', description: 'Pricing and payout settings' },
  { id: 'review-launch', name: 'Review', description: 'Review and launch campaign' },
]

const stepSchemas = {
  'basic-info': step1Schema,
  'targeting': step2Schema,
  'call-handling': step3Schema,
  'budget-schedule': step4Schema,
  'review-launch': campaignWizardSchema, // Full validation for final step
}

interface CampaignWizardStore {
  // State
  wizardState: WizardState
  steps: WizardStep[]
  currentStep: WizardStep | null
  formData: Partial<CampaignWizardFormData>
  visitedStepIds: string[]
  completionPercentage: number
  draftSaved: boolean
  lastSaved: Date | null
  isLoading: boolean
  error: string | null
  hasRecoverableError: boolean

  // Actions
  initializeWizard: () => void
  resetWizard: () => void
  cancelWizard: () => void
  nextStep: () => Promise<boolean>
  previousStep: () => void
  goToStep: (stepId: string) => Promise<boolean>
  updateCurrentStepData: (data: Partial<CampaignWizardFormData>) => void
  updateStepData: (stepId: string, data: Partial<CampaignWizardFormData>) => void
  validateCurrentStep: () => Promise<boolean>
  validateStep: (stepId: string) => Promise<boolean>
  completeWizard: () => Promise<CampaignWizardFormData>
  saveDraft: () => void
  loadDraft: () => boolean
  clearDraft: () => void
  setError: (message: string, stepId?: string) => void
  clearError: () => void
  getStepById: (stepId: string) => WizardStep | undefined
  isStepAccessible: (stepId: string) => boolean
  canNavigateToStep: (stepId: string) => boolean
  hasStepErrors: (stepId: string) => boolean
  getStepErrors: (stepId: string) => Record<string, string[]>
  clearStepErrors: (stepId: string) => void
}

// Helper functions
const createInitialSteps = (): WizardStep[] => {
  return WIZARD_STEPS.map(step => ({
    id: step.id,
    name: step.name,
    description: step.description,
    isComplete: false,
    isValid: false,
    validationErrors: {},
    data: {},
  }))
}

const calculateCompletionPercentage = (steps: WizardStep[]): number => {
  const completedSteps = steps.filter(step => step.isComplete)
  return Math.round((completedSteps.length / steps.length) * 100)
}

const validateStepData = async (stepId: string, data: Partial<CampaignWizardFormData>): Promise<{ isValid: boolean; errors: Record<string, string[]> }> => {
  const schema = stepSchemas[stepId as keyof typeof stepSchemas]
  if (!schema) {
    return { isValid: true, errors: {} }
  }

  try {
    schema.parse(data)
    return { isValid: true, errors: {} }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string[]> = {}
      error.errors.forEach(err => {
        const path = err.path.join('.')
        if (!errors[path]) {
          errors[path] = []
        }
        errors[path].push(err.message)
      })
      return { isValid: false, errors }
    }
    return { isValid: false, errors: { general: ['Validation failed'] } }
  }
}

const DRAFT_STORAGE_KEY = 'campaignWizard_draft'

export const useCampaignWizardStore = create<CampaignWizardStore>()(
  immer((set, get) => ({
    // Initial state
    wizardState: { type: 'idle' },
    steps: createInitialSteps(),
    currentStep: null,
    formData: {},
    visitedStepIds: [],
    completionPercentage: 0,
    draftSaved: false,
    lastSaved: null,
    isLoading: false,
    error: null,
    hasRecoverableError: false,

    // Actions
    initializeWizard: () => {
      set(state => {
        state.wizardState = { type: 'active', currentStepId: 'basic-info' }
        state.steps = createInitialSteps()
        state.currentStep = state.steps[0]
        state.visitedStepIds = ['basic-info']
        state.formData = {}
        state.error = null
        state.hasRecoverableError = false
      })
    },

    resetWizard: () => {
      set(state => {
        state.wizardState = { type: 'idle' }
        state.steps = createInitialSteps()
        state.currentStep = null
        state.formData = {}
        state.visitedStepIds = []
        state.completionPercentage = 0
        state.draftSaved = false
        state.lastSaved = null
        state.error = null
        state.hasRecoverableError = false
      })
    },

    cancelWizard: () => {
      set(state => {
        state.wizardState = { type: 'cancelled' }
      })
    },

    nextStep: async () => {
      const state = get()
      if (!state.currentStep) return false

      // Validate current step
      const isValid = await get().validateCurrentStep()
      if (!isValid) return false

      // Find next step
      const currentIndex = state.steps.findIndex(step => step.id === state.currentStep!.id)
      const nextIndex = currentIndex + 1

      if (nextIndex >= state.steps.length) {
        // This is the last step, complete the wizard
        try {
          await get().completeWizard()
          return true
        } catch {
          return false
        }
      }

      // Move to next step
      const nextStep = state.steps[nextIndex]
      set(state => {
        state.wizardState = { type: 'active', currentStepId: nextStep.id }
        state.currentStep = nextStep
        if (!state.visitedStepIds.includes(nextStep.id)) {
          state.visitedStepIds.push(nextStep.id)
        }
        state.completionPercentage = calculateCompletionPercentage(state.steps)
      })

      return true
    },

    previousStep: () => {
      const state = get()
      if (!state.currentStep) return

      const currentIndex = state.steps.findIndex(step => step.id === state.currentStep!.id)
      const prevIndex = currentIndex - 1

      if (prevIndex >= 0) {
        const prevStep = state.steps[prevIndex]
        set(state => {
          state.wizardState = { type: 'active', currentStepId: prevStep.id }
          state.currentStep = prevStep
        })
      }
    },

    goToStep: async (stepId: string) => {
      const state = get()
      const targetStep = state.steps.find(step => step.id === stepId)
      if (!targetStep) return false

      // Check if step is accessible
      if (!get().canNavigateToStep(stepId)) return false

      set(state => {
        state.wizardState = { type: 'active', currentStepId: stepId }
        state.currentStep = targetStep
        if (!state.visitedStepIds.includes(stepId)) {
          state.visitedStepIds.push(stepId)
        }
      })

      return true
    },

    updateCurrentStepData: (data: Partial<CampaignWizardFormData>) => {
      const state = get()
      if (!state.currentStep) return

      set(state => {
        // Update form data
        state.formData = { ...state.formData, ...data }
        
        // Update current step data
        if (state.currentStep) {
          state.currentStep.data = { ...state.currentStep.data, ...data }
        }

        // Mark draft as unsaved
        state.draftSaved = false
      })
    },

    updateStepData: (stepId: string, data: Partial<CampaignWizardFormData>) => {
      set(state => {
        const step = state.steps.find(s => s.id === stepId)
        if (step) {
          step.data = { ...step.data, ...data }
        }
        
        // Update global form data
        state.formData = { ...state.formData, ...data }
        state.draftSaved = false
      })
    },

    validateCurrentStep: async () => {
      const state = get()
      if (!state.currentStep) return false

      return await get().validateStep(state.currentStep.id)
    },

    validateStep: async (stepId: string) => {
      const state = get()
      const step = state.steps.find(s => s.id === stepId)
      if (!step) return false

      set(state => {
        state.wizardState = { type: 'validating', stepId }
        state.isLoading = true
      })

      try {
        const { isValid, errors } = await validateStepData(stepId, state.formData)
        
        set(state => {
          const step = state.steps.find(s => s.id === stepId)
          if (step) {
            step.isValid = isValid
            step.isComplete = isValid
            step.validationErrors = errors
          }
          
          state.wizardState = { type: 'active', currentStepId: state.currentStep?.id || stepId }
          state.isLoading = false
          state.completionPercentage = calculateCompletionPercentage(state.steps)
        })

        return isValid
      } catch (error) {
        set(state => {
          state.wizardState = { 
            type: 'error', 
            message: error instanceof Error ? error.message : 'Validation failed',
            stepId 
          }
          state.isLoading = false
          state.hasRecoverableError = true
        })
        return false
      }
    },

    completeWizard: async () => {
      const state = get()
      
      set(state => {
        state.wizardState = { type: 'completing' }
        state.isLoading = true
      })

      try {
        // Validate all data
        const validatedData = campaignWizardSchema.parse(state.formData)
        
        set(state => {
          state.wizardState = { type: 'completed', data: validatedData }
          state.isLoading = false
          state.completionPercentage = 100
        })

        // Clear draft after successful completion
        get().clearDraft()
        
        return validatedData
      } catch (error) {
        set(state => {
          state.wizardState = { 
            type: 'error', 
            message: error instanceof Error ? error.message : 'Failed to complete wizard'
          }
          state.isLoading = false
          state.hasRecoverableError = true
        })
        throw error
      }
    },

    saveDraft: () => {
      const state = get()
      try {
        const draftData = {
          formData: state.formData,
          currentStepId: state.currentStep?.id,
          visitedStepIds: state.visitedStepIds,
          timestamp: new Date().toISOString(),
        }
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData))
        
        set(state => {
          state.draftSaved = true
          state.lastSaved = new Date()
        })
      } catch (_error) {
        console.warn('Failed to save draft:', _error)
      }
    },

    loadDraft: () => {
      try {
        const draftJson = localStorage.getItem(DRAFT_STORAGE_KEY)
        if (!draftJson) return false

        const draft = JSON.parse(draftJson)
        
        set(state => {
          state.formData = draft.formData || {}
          state.visitedStepIds = draft.visitedStepIds || ['basic-info']
          state.draftSaved = true
          state.lastSaved = draft.timestamp ? new Date(draft.timestamp) : null
          
          // Update steps with draft data
          state.steps.forEach(step => {
            step.data = draft.formData || {}
          })
          
          // Set current step
          const currentStepId = draft.currentStepId || 'basic-info'
          const currentStep = state.steps.find(step => step.id === currentStepId)
          if (currentStep) {
            state.currentStep = currentStep
            state.wizardState = { type: 'active', currentStepId }
          }
        })
        
        return true
      } catch (_error) {
        console.warn('Failed to load draft:', _error)
        return false
      }
    },

    clearDraft: () => {
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY)
        set(state => {
          state.draftSaved = false
          state.lastSaved = null
        })
      } catch (_error) {
        console.warn('Failed to clear draft:', _error)
      }
    },

    setError: (message: string, stepId?: string) => {
      set(state => {
        state.wizardState = { type: 'error', message, stepId }
        state.error = message
        state.hasRecoverableError = true
        state.isLoading = false
      })
    },

    clearError: () => {
      set(state => {
        const currentStepId = state.currentStep?.id || 'basic-info'
        state.wizardState = { type: 'active', currentStepId }
        state.error = null
        state.hasRecoverableError = false
      })
    },

    getStepById: (stepId: string) => {
      return get().steps.find(step => step.id === stepId)
    },

    isStepAccessible: (stepId: string) => {
      const state = get()
      const stepIndex = state.steps.findIndex(step => step.id === stepId)
      if (stepIndex === -1) return false

      // First step is always accessible
      if (stepIndex === 0) return true

      // Can access if visited or if all previous steps are complete
      if (state.visitedStepIds.includes(stepId)) return true

      for (let i = 0; i < stepIndex; i++) {
        if (!state.steps[i].isComplete) return false
      }
      
      return true
    },

    canNavigateToStep: (stepId: string) => {
      return get().isStepAccessible(stepId)
    },

    hasStepErrors: (stepId: string) => {
      const step = get().getStepById(stepId)
      return step ? Object.keys(step.validationErrors).length > 0 : false
    },

    getStepErrors: (stepId: string) => {
      const step = get().getStepById(stepId)
      return step?.validationErrors || {}
    },

    clearStepErrors: (stepId: string) => {
      set(state => {
        const step = state.steps.find(s => s.id === stepId)
        if (step) {
          step.validationErrors = {}
        }
      })
    },
  }))
)

// Export the hook for external use
export const useCampaignWizard = useCampaignWizardStore