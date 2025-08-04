// Custom hook for integrating the campaign wizard state machine with CreateCampaignPage
import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCampaignWizard as useBaseCampaignWizard, type CampaignWizardFormData, campaignWizardSchema } from '../store/slices/campaignWizardSlice'

// Step configuration that maps to the original CreateCampaignPage steps
export const CAMPAIGN_WIZARD_STEPS = [
  { 
    id: 'basic-info', 
    number: 1,
    name: 'Basic Info', 
    description: 'Campaign details and vertical',
    icon: 'InformationCircleIcon',
  },
  { 
    id: 'targeting', 
    number: 2,
    name: 'Targeting', 
    description: 'Geographic and time targeting',
    icon: 'GlobeAltIcon',
  },
  { 
    id: 'call-handling', 
    number: 3,
    name: 'Quality', 
    description: 'Quality requirements and filters',
    icon: 'ShieldCheckIcon',
  },
  { 
    id: 'budget-schedule', 
    number: 4,
    name: 'Payout', 
    description: 'Pricing and payout settings',
    icon: 'CurrencyDollarIcon',
  },
  { 
    id: 'review-launch', 
    number: 5,
    name: 'Review', 
    description: 'Review and launch campaign',
    icon: 'CheckCircleIcon',
  },
] as const

/**
 * Enhanced campaign wizard hook that integrates the state machine with react-hook-form
 * This provides a bridge between the existing CreateCampaignPage and the new wizard state machine.
 */
export function useCampaignWizardIntegration() {
  const navigate = useNavigate()
  const wizard = useBaseCampaignWizard()
  
  // React Hook Form integration
  const form = useForm<CampaignWizardFormData>({
    resolver: zodResolver(campaignWizardSchema),
    defaultValues: wizard.formData as CampaignWizardFormData,
    mode: 'onChange', // Enable real-time validation
  })
  
  // Initialize wizard on mount
  useEffect(() => {
    if (wizard.wizardState.type === 'idle') {
      wizard.initializeWizard()
    }
  }, [wizard])
  
  // Sync form data with wizard state
  useEffect(() => {
    const subscription = form.watch((data) => {
      // Update wizard state when form data changes
      if (wizard.currentStep) {
        wizard.updateCurrentStepData(data as Partial<CampaignWizardFormData>)
      }
    })
    
    return () => subscription.unsubscribe()
  }, [form, wizard])
  
  // Sync wizard data to form when it changes
  useEffect(() => {
    const wizardData = wizard.formData
    if (wizardData) {
      // Only update form if wizard data is different from current form data
      const currentFormData = form.getValues()
      const hasChanges = Object.keys(wizardData).some((key) => {
        const wizardValue = wizardData[key as keyof CampaignWizardFormData]
        const formValue = currentFormData[key as keyof CampaignWizardFormData]
        return JSON.stringify(wizardValue) !== JSON.stringify(formValue)
      })
      
      if (hasChanges) {
        form.reset(wizardData as CampaignWizardFormData)
      }
    }
  }, [wizard, form])
  
  // Auto-save draft when form data changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!wizard.draftSaved && wizard.wizardState.type === 'active') {
        wizard.saveDraft()
      }
    }, 2000) // Auto-save after 2 seconds of inactivity
    
    return () => clearTimeout(timer)
  }, [wizard])
  
  // Get current step info
  const getCurrentStepInfo = useCallback(() => {
    const currentStep = wizard.currentStep
    if (!currentStep) {
      return CAMPAIGN_WIZARD_STEPS[0]
    }
    
    return CAMPAIGN_WIZARD_STEPS.find(step => step.id === currentStep.id) || CAMPAIGN_WIZARD_STEPS[0]
  }, [wizard])
  
  // Check if current step can proceed
  const canProceedToNextStep = useCallback(() => {
    const currentStep = wizard.currentStep
    if (!currentStep) {
      return false
    }
    
    // Use wizard's built-in validation state
    return currentStep.isValid || currentStep.isComplete
  }, [wizard])
  
  // Check if specific step requirements are met (legacy compatibility)
  const canProceedLegacyCheck = useCallback(() => {
    const currentStepInfo = getCurrentStepInfo()
    const formData = form.getValues()
    
    switch (currentStepInfo.id) {
      case 'basic-info':
        return formData.name && formData.vertical && formData.description
      case 'targeting':
        return (
          formData.geo_targeting?.countries?.length > 0 &&
          formData.time_targeting?.days_of_week?.length > 0
        )
      case 'call-handling':
        return formData.quality_requirements?.minimum_call_duration > 0
      case 'budget-schedule':
        return formData.payout_settings?.base_payout > 0
      case 'review-launch':
        return true // Review step can always proceed to submission
      default:
        return true
    }
  }, [getCurrentStepInfo, form])
  
  // Navigation handlers
  const handleNextStep = useCallback(async () => {
    // Validate current step first
    const isValid = await wizard.validateCurrentStep()
    if (!isValid) {
      return false
    }
    
    // If this is the last step, complete the wizard
    const currentStepInfo = getCurrentStepInfo()
    if (currentStepInfo.number === CAMPAIGN_WIZARD_STEPS.length) {
      try {
        const completedData = await wizard.completeWizard()
        
        // Navigate to success page or show confirmation
        navigate('/app/campaigns', {
          state: {
            message: 'Campaign created successfully! It may take a few minutes to become active.',
            campaignData: completedData,
          },
        })
        
        return true
      } catch (error) {
        console.error('Failed to complete wizard:', error)
        return false
      }
    }
    
    // Move to next step
    return await wizard.nextStep()
  }, [wizard, getCurrentStepInfo, navigate])
  
  const handlePreviousStep = useCallback(() => {
    wizard.previousStep()
  }, [wizard])
  
  const handleGoToStep = useCallback(async (stepId: string) => {
    return await wizard.goToStep(stepId)
  }, [wizard])
  
  // Form submission handler
  const handleSubmit = useCallback(async (data: CampaignWizardFormData) => {
    try {
      // Update wizard with final form data
      wizard.updateCurrentStepData(data)
      
      // Complete the wizard
      const completedData = await wizard.completeWizard()
      
      // TODO: Replace with actual API call
      console.log('Creating campaign:', completedData)
      
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000))
      
      // Navigate to success
      navigate('/app/campaigns', {
        state: {
          message: 'Campaign created successfully! It may take a few minutes to become active.',
        },
      })
    } catch (error) {
      console.error('Failed to create campaign:', error)
      wizard.setError(error instanceof Error ? error.message : 'Failed to create campaign')
    }
  }, [wizard, navigate])
  
  // Cancel handler
  const handleCancel = useCallback(() => {
    wizard.cancelWizard()
    navigate('/app/campaigns')
  }, [wizard, navigate])
  
  // Reset handler for error recovery
  const handleRetry = useCallback(() => {
    wizard.resetWizard()
    form.reset()
  }, [wizard, form])
  
  // Draft management handlers
  const handleSaveDraft = useCallback(() => {
    wizard.saveDraft()
    // Show user feedback
    // Could trigger a toast notification here
  }, [wizard])
  
  const handleLoadDraft = useCallback(() => {
    const loaded = wizard.loadDraft()
    if (loaded) {
      // Sync loaded data to form
      form.reset(wizard.formData as CampaignWizardFormData)
    }
    return loaded
  }, [wizard, form])
  
  const handleClearDraft = useCallback(() => {
    wizard.clearDraft()
    form.reset()
  }, [wizard, form])
  
  // Get step validation errors for display
  const getStepErrors = useCallback((stepId?: string) => {
    const targetStepId = stepId || getCurrentStepInfo().id
    return wizard.getStepErrors(targetStepId)
  }, [wizard, getCurrentStepInfo])
  
  // Check if step has errors
  const hasStepErrors = useCallback((stepId?: string) => {
    const targetStepId = stepId || getCurrentStepInfo().id
    return wizard.hasStepErrors(targetStepId)
  }, [wizard, getCurrentStepInfo])
  
  return {
    // Form integration
    form,
    handleSubmit: form.handleSubmit(handleSubmit),
    
    // Wizard state
    wizardState: wizard.wizardState,
    currentStep: wizard.currentStep,
    currentStepInfo: getCurrentStepInfo(),
    completionPercentage: wizard.completionPercentage,
    visitedStepIds: wizard.visitedStepIds,
    
    // Step management
    steps: CAMPAIGN_WIZARD_STEPS,
    currentStepNumber: getCurrentStepInfo().number,
    totalSteps: CAMPAIGN_WIZARD_STEPS.length,
    isFirstStep: getCurrentStepInfo().number === 1,
    isLastStep: getCurrentStepInfo().number === CAMPAIGN_WIZARD_STEPS.length,
    
    // Navigation
    canProceedToNextStep: canProceedToNextStep(),
    canProceedLegacyCheck: canProceedLegacyCheck(),
    handleNextStep,
    handlePreviousStep,
    handleGoToStep,
    canNavigateToStep: wizard.canNavigateToStep,
    
    // Lifecycle
    handleCancel,
    handleRetry,
    
    // Draft management
    draftSaved: wizard.draftSaved,
    lastSaved: wizard.lastSaved,
    handleSaveDraft,
    handleLoadDraft,
    handleClearDraft,
    
    // Error handling
    isLoading: wizard.isLoading,
    error: wizard.error,
    hasRecoverableError: wizard.hasRecoverableError,
    getStepErrors,
    hasStepErrors,
    clearStepErrors: wizard.clearStepErrors,
    
    // Utility
    formData: wizard.formData,
    isStepAccessible: wizard.isStepAccessible,
    
    // Raw wizard access for advanced usage
    wizard,
  }
}

// Helper hook for step-specific logic
export function useWizardStep(stepId: string) {
  const wizard = useBaseCampaignWizard()
  
  const step = wizard.getStepById(stepId)
  const isCurrentStep = wizard.currentStep?.id === stepId
  const isAccessible = wizard.isStepAccessible(stepId)
  const isCompleted = step?.isComplete || false
  const hasErrors = wizard.hasStepErrors(stepId)
  const errors = wizard.getStepErrors(stepId)
  
  const navigateToStep = useCallback(async () => {
    return await wizard.goToStep(stepId)
  }, [wizard, stepId])
  
  const updateStepData = useCallback((data: Partial<CampaignWizardFormData>) => {
    wizard.updateStepData(stepId, data)
  }, [wizard, stepId])
  
  const validateStep = useCallback(async () => {
    return await wizard.validateStep(stepId)
  }, [wizard, stepId])
  
  return {
    step,
    isCurrentStep,
    isAccessible,
    isCompleted,
    hasErrors,
    errors,
    navigateToStep,
    updateStepData,
    validateStep,
  }
}

// Re-export the form data type for convenience
export type { CampaignWizardFormData as CreateCampaignFormData }