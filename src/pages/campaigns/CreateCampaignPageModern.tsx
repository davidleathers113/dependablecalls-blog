// Modern CreateCampaignPage using the wizard state machine
// This demonstrates how to migrate from manual step management to the wizard state machine
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeftIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  PhoneIcon,
  GlobeAltIcon,
  // ClockIcon, - unused
  CurrencyDollarIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { Button } from '../../components/common/Button'
// import { Card, CardContent, CardHeader } from '../../components/common/Card' - unused
// import { Input } from '../../components/common/Input' - unused
import { Loading } from '../../components/common/Loading'
import { FormErrorBoundary } from '../../components/forms/FormErrorBoundary'
import { useCampaignWizardIntegration } from '../../hooks/useCampaignWizard'

// Step components for better organization
import { BasicInfoStep } from './steps/BasicInfoStep'
import { TargetingStep } from './steps/TargetingStep'
import { CallHandlingStep } from './steps/CallHandlingStep'
import { BudgetScheduleStep } from './steps/BudgetScheduleStep'
import { ReviewLaunchStep } from './steps/ReviewLaunchStep'

// Constants matching the original implementation
const CAMPAIGN_VERTICALS = [
  { value: 'insurance', label: 'Insurance', description: 'Auto, home, life, and health insurance' },
  {
    value: 'home_services',
    label: 'Home Services',
    description: 'HVAC, plumbing, roofing, and contractors',
  },
  { value: 'legal', label: 'Legal Services', description: 'Personal injury, DUI, and family law' },
  { value: 'medical', label: 'Medical', description: 'Healthcare services and treatments' },
  {
    value: 'financial',
    label: 'Financial Services',
    description: 'Loans, mortgages, and financial planning',
  },
  { value: 'education', label: 'Education', description: 'Online courses and degree programs' },
  { value: 'automotive', label: 'Automotive', description: 'Car sales, repairs, and services' },
  {
    value: 'real_estate',
    label: 'Real Estate',
    description: 'Property buying, selling, and rentals',
  },
]

// Icon mapping for steps
const STEP_ICONS = {
  'InformationCircleIcon': InformationCircleIcon,
  'GlobeAltIcon': GlobeAltIcon,
  'ShieldCheckIcon': ShieldCheckIcon,
  'CurrencyDollarIcon': CurrencyDollarIcon,
  'CheckCircleIcon': CheckCircleIcon,
}

function CreateCampaignPageModern() {
  const navigate = useNavigate()
  const wizard = useCampaignWizardIntegration()

  // Step content renderer using the wizard state machine
  const renderStepContent = () => {
    if (!wizard.currentStepInfo) {
      return <div>Loading...</div>
    }

    switch (wizard.currentStepInfo.id) {
      case 'basic-info':
        return (
          <BasicInfoStep
            form={wizard.form}
            formData={wizard.formData}
            updateData={wizard.form.setValue}
            errors={wizard.getStepErrors()}
            verticals={CAMPAIGN_VERTICALS}
          />
        )

      case 'targeting':
        return (
          <TargetingStep
            form={wizard.form}
            formData={wizard.formData}
            updateData={wizard.form.setValue}
            errors={wizard.getStepErrors()}
          />
        )

      case 'call-handling':
        return (
          <CallHandlingStep
            form={wizard.form}
            formData={wizard.formData}          
            updateData={wizard.form.setValue}
            errors={wizard.getStepErrors()}
          />
        )

      case 'budget-schedule':
        return (
          <BudgetScheduleStep
            form={wizard.form}
            formData={wizard.formData}
            updateData={wizard.form.setValue}
            errors={wizard.getStepErrors()}
          />
        )

      case 'review-launch':
        return (
          <ReviewLaunchStep
            form={wizard.form}
            formData={wizard.formData}
            verticals={CAMPAIGN_VERTICALS}
          />
        )

      default:
        return <div>Unknown step</div>
    }
  }

  return (
    <div className="py-6">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/app/campaigns')}
            className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ChevronLeftIcon className="h-4 w-4 mr-1" />
            Back to Campaigns
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create New Campaign</h1>
              <p className="text-sm text-gray-600 mt-1">
                {wizard.currentStepInfo?.description}
              </p>
              
              {/* Draft status indicator */}
              {wizard.draftSaved && wizard.lastSaved && (
                <p className="text-xs text-green-600 mt-1">
                  Draft saved {new Date(wizard.lastSaved).toLocaleTimeString()}
                </p>
              )}
              
              {/* Error indicator */}
              {wizard.hasRecoverableError && (
                <p className="text-xs text-red-600 mt-1">
                  Please correct the errors below to continue
                </p>
              )}
            </div>
            
            <div className="text-sm text-gray-500">
              Step {wizard.currentStepNumber} of {wizard.totalSteps}
              {wizard.completionPercentage > 0 && (
                <span className="ml-2 text-blue-600">
                  ({wizard.completionPercentage}% complete)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {wizard.steps.map((step, index) => {
              const Icon = STEP_ICONS[step.icon as keyof typeof STEP_ICONS]
              const isCurrentStep = wizard.currentStepInfo.id === step.id
              const isCompleted = wizard.visitedStepIds.includes(step.id) && 
                                 wizard.wizard.getStepById(step.id)?.isComplete
              const isAccessible = wizard.isStepAccessible(step.id)
              const hasErrors = wizard.hasStepErrors(step.id)
              
              return (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => isAccessible ? wizard.handleGoToStep(step.id) : undefined}
                    disabled={!isAccessible}
                    className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                      isCompleted
                        ? 'bg-green-500 border-green-500 text-white'
                        : isCurrentStep
                          ? hasErrors
                            ? 'bg-red-500 border-red-500 text-white'
                            : 'bg-blue-500 border-blue-500 text-white'
                          : isAccessible
                            ? 'bg-white border-gray-300 text-gray-500 hover:border-blue-300'
                            : 'bg-gray-100 border-gray-200 text-gray-400'
                    } ${isAccessible ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                  >
                    {isCompleted ? (
                      <CheckCircleIcon className="h-5 w-5" />
                    ) : hasErrors && isCurrentStep ? (
                      <ExclamationTriangleIcon className="h-5 w-5" />
                    ) : Icon ? (
                      <Icon className="h-4 w-4" />
                    ) : (
                      <span className="text-sm font-medium">{step.number}</span>
                    )}
                  </button>
                  
                  <div className="ml-3 hidden sm:block">
                    <p className={`text-sm font-medium ${
                      isCurrentStep ? 'text-gray-900' : 
                      isAccessible ? 'text-gray-700' : 'text-gray-400'
                    }`}>
                      {step.name}
                    </p>
                    {hasErrors && isCurrentStep && (
                      <p className="text-xs text-red-600">Has errors</p>
                    )}
                  </div>
                  
                  {index < wizard.steps.length - 1 && (
                    <div className={`flex-1 mx-4 h-0.5 ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Wizard State Debug Info (development only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-4 p-3 bg-gray-100 rounded text-xs text-gray-600">
            <strong>Wizard State:</strong> {wizard.wizardState.type} | 
            <strong> Current Step:</strong> {wizard.currentStepInfo.name} |
            <strong> Can Proceed:</strong> {wizard.canProceedToNextStep ? 'Yes' : 'No'} |
            <strong> Has Errors:</strong> {wizard.hasStepErrors() ? 'Yes' : 'No'}
          </div>
        )}

        {/* Form Content */}
        <form onSubmit={wizard.handleSubmit}>
          {renderStepContent()}

          {/* Navigation */}
          <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={wizard.handlePreviousStep}
              disabled={wizard.isFirstStep || wizard.isLoading}
            >
              Previous
            </Button>

            <div className="flex items-center space-x-3">
              {/* Draft Management */}
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={wizard.handleSaveDraft}
                  disabled={wizard.isLoading}
                  className="text-sm"
                >
                  Save Draft
                </Button>
                
                {wizard.lastSaved && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={wizard.handleClearDraft}
                    disabled={wizard.isLoading}
                    className="text-sm text-red-600"
                  >
                    Clear Draft
                  </Button>
                )}
              </div>
              
              <Button 
                type="button" 
                variant="outline" 
                onClick={wizard.handleCancel}
                disabled={wizard.isLoading}
              >
                Cancel
              </Button>

              {wizard.isLastStep ? (
                <Button 
                  type="submit" 
                  loading={wizard.isLoading} 
                  disabled={!wizard.canProceedToNextStep}
                >
                  {wizard.isLoading ? (
                    <>
                      <Loading variant="spinner" className="mr-2" />
                      Creating Campaign...
                    </>
                  ) : (
                    <>
                      <PhoneIcon className="h-4 w-4 mr-2" />
                      Launch Campaign
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={wizard.handleNextStep}
                  disabled={!wizard.canProceedToNextStep || wizard.isLoading}
                >
                  Next
                </Button>
              )}
            </div>
          </div>
        </form>

        {/* Error Display */}
        {wizard.error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{wizard.error}</p>
                </div>
                <div className="mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={wizard.handleRetry}
                    className="text-red-700 border-red-300 hover:bg-red-50"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Export with error boundary wrapper (matches original pattern)
export default function CreateCampaignPageWithBoundary() {
  const [retryKey, setRetryKey] = useState(0)

  const handleRetry = () => {
    setRetryKey((prev) => prev + 1)
  }

  const handleSaveDraft = (data: Record<string, unknown>) => {
    // This is handled by the wizard state machine now
    console.log('Draft save triggered by error boundary:', data)
  }

  const handleReset = () => {
    // Reset wizard state
    setRetryKey((prev) => prev + 1)
  }

  return (
    <FormErrorBoundary
      formName="createCampaignModern"
      enableDraftSaving={true}
      onRetry={handleRetry}
      onSaveDraft={handleSaveDraft}
      onReset={handleReset}
      onError={(error) => {
        console.error('Modern campaign creation form error:', error)
      }}
    >
      <CreateCampaignPageModern key={retryKey} />
    </FormErrorBoundary>
  )
}

