# Campaign Wizard State Machine

This implementation demonstrates how to migrate from manual step management to a comprehensive wizard state machine for the Create Campaign flow.

## Overview

The campaign wizard state machine provides:

- **Type-safe state management** using Zustand and discriminated unions
- **Validation at each step** using Zod schemas
- **Navigation guards** that prevent skipping steps
- **Draft saving/loading** with automatic persistence
- **Error recovery** with step-specific error states
- **Progress tracking** with completion percentage
- **Reusable architecture** for other multi-step forms

## Architecture

### Core Components

1. **`campaignWizardSlice.ts`** - Main wizard state machine implementation
2. **`useCampaignWizard.ts`** - Integration hook with react-hook-form
3. **`CreateCampaignPageModern.tsx`** - Example modernized page component
4. **`steps/`** - Individual step components for better organization

### State Machine Flow

```
idle -> active -> validating -> (error | active) -> completing -> completed
  ^                                |
  |                                v
  +-- cancelled <------------------+
```

## Key Features

### 1. Step-by-Step Validation

Each step has its own Zod schema for incremental validation:

```typescript
const stepSchemas = {
  'basic-info': step1Schema,
  'targeting': step2Schema,
  'call-handling': step3Schema,
  'budget-schedule': step4Schema,
  'review-launch': campaignWizardSchema, // Full validation
}
```

### 2. Navigation Guards

Users cannot skip steps unless all previous steps are complete:

```typescript
canNavigateToStep: (stepId: string): boolean => {
  const targetStepIndex = steps.findIndex(step => step.id === stepId)
  // Can navigate backwards to visited steps
  // Can navigate forward only if all previous steps are completed
}
```

### 3. Draft Management

Automatic draft saving with persistence:

```typescript
// Auto-save after 2 seconds of inactivity
useEffect(() => {
  const timer = setTimeout(() => {
    if (!wizard.draftSaved && wizard.wizardState.type === 'active') {
      wizard.saveDraft()
    }
  }, 2000)
  return () => clearTimeout(timer)
}, [wizard.formData])
```

### 4. Error Recovery

Step-specific error states with recovery options:

```typescript
// Set errors for specific step
setStepError: (stepId: string, errors: Record<string, string[]>) => void

// Check if step has errors
hasStepErrors: (stepId: string): boolean => {
  const step = steps.find(s => s.id === stepId)
  return Object.keys(step?.validationErrors || {}).length > 0
}
```

## Usage Examples

### Basic Usage

```typescript
import { useCampaignWizardIntegration } from '../hooks/useCampaignWizard'

function CreateCampaignPage() {
  const wizard = useCampaignWizardIntegration()
  
  return (
    <form onSubmit={wizard.handleSubmit}>
      {/* Current step content */}
      {wizard.currentStepInfo.id === 'basic-info' && (
        <BasicInfoStep form={wizard.form} />
      )}
      
      {/* Navigation */}
      <Button onClick={wizard.handlePreviousStep} disabled={wizard.isFirstStep}>
        Previous
      </Button>
      <Button onClick={wizard.handleNextStep} disabled={!wizard.canProceedToNextStep}>
        {wizard.isLastStep ? 'Launch Campaign' : 'Next'}
      </Button>
    </form>
  )
}
```

### Advanced Step Component

```typescript
import { useWizardStep } from '../hooks/useCampaignWizard'

function BasicInfoStep() {
  const step = useWizardStep('basic-info')
  
  return (
    <div>
      {step.hasErrors && (
        <div className="error-banner">
          {Object.entries(step.errors).map(([field, messages]) => (
            <div key={field}>{messages.join(', ')}</div>
          ))}
        </div>
      )}
      
      {/* Step content */}
      <input onChange={(e) => step.updateStepData({ name: e.target.value })} />
      
      <Button onClick={step.validateStep}>
        Validate This Step
      </Button>
    </div>
  )
}
```

### Creating Reusable Wizards

```typescript
import { createWizardHook } from '../store/slices/campaignWizardSlice'

const useSupplierOnboardingWizard = createWizardHook({
  steps: [
    { id: 'company-info', title: 'Company Information' },
    { id: 'verification', title: 'Verification Documents' },
    { id: 'payment-setup', title: 'Payment Setup' },
  ],
  validationSchema: supplierOnboardingSchema,
  stepSchemas: {
    'company-info': companyInfoSchema,
    'verification': verificationSchema,
    'payment-setup': paymentSetupSchema,
  },
  defaultData: {},
  storageKey: 'supplierOnboarding_draft',
})
```

## Migration Guide

### From Manual Step Management

**Before (Manual):**
```typescript
const [currentStep, setCurrentStep] = useState(1)

const canProceedToNextStep = () => {
  switch (currentStep) {
    case 1: return form.watch('name') && form.watch('vertical')
    case 2: return form.watch('geo_targeting.countries').length > 0
    // ... manual validation for each step
  }
}

const handleNextStep = () => {
  if (canProceedToNextStep()) {
    setCurrentStep(currentStep + 1)
  }
}
```

**After (State Machine):**
```typescript
const wizard = useCampaignWizardIntegration()

// Navigation and validation handled automatically
const handleNextStep = async () => {
  return await wizard.handleNextStep() // Handles validation + navigation
}

// Step validation is automatic based on Zod schemas
const canProceed = wizard.canProceedToNextStep // Computed automatically
```

### Benefits of Migration

1. **Type Safety**: All states and transitions are type-safe
2. **Validation**: Consistent validation using Zod schemas
3. **Error Handling**: Comprehensive error states and recovery
4. **Draft Management**: Automatic draft saving/loading
5. **Navigation Guards**: Prevent skipping required steps
6. **Progress Tracking**: Built-in completion percentage
7. **Reusability**: Pattern can be reused for other wizards
8. **Testing**: State machine is easily testable

## State Machine Debugging

In development, you can inspect the wizard state:

```typescript
// Enable debug logging
const wizard = useCampaignWizardIntegration()

console.log('Wizard State:', wizard.wizardState)
console.log('Current Step:', wizard.currentStep)
console.log('Completion:', wizard.completionPercentage)
console.log('Visited Steps:', wizard.visitedStepIds)
console.log('Can Proceed:', wizard.canProceedToNextStep)
```

## Testing

The state machine architecture makes testing much easier:

```typescript
import { useCampaignWizardStore } from '../campaignWizardSlice'

describe('Campaign Wizard', () => {
  it('should validate step before proceeding', async () => {
    const wizard = useCampaignWizardStore.getState()
    wizard.initializeWizard()
    
    // Try to proceed without valid data
    const canProceed = await wizard.nextStep()
    expect(canProceed).toBe(false)
    expect(wizard.wizardState.type).toBe('error')
    
    // Add valid data and try again
    wizard.updateCurrentStepData({ name: 'Test Campaign', vertical: 'insurance' })
    const canProceedNow = await wizard.nextStep()
    expect(canProceedNow).toBe(true)
  })
})
```

## Performance Considerations

- **Lazy Loading**: Step components can be lazy-loaded
- **Memoization**: Form data changes are debounced for auto-save
- **Validation**: Only validates current step unless full validation is requested
- **Persistence**: Only essential data is persisted, not computed state

## Future Enhancements

1. **Conditional Steps**: Steps that appear based on previous selections
2. **Parallel Validation**: Validate multiple steps in parallel
3. **Step Templates**: Reusable step configurations
4. **Wizard Analytics**: Track where users drop off
5. **A/B Testing**: Different wizard flows for experimentation

This implementation provides a solid foundation for complex multi-step forms while maintaining type safety and excellent developer experience.