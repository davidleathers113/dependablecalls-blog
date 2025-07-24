import React, { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { FormSubmissionError, FormValidationError } from '../common/FallbackUI'
import { captureException } from '@sentry/react'
import { z } from 'zod'

interface FormErrorBoundaryProps {
  children: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  onRetry?: () => void
  onSaveDraft?: (data: Record<string, unknown>) => void
  onReset?: () => void
  fallbackComponent?: ReactNode
  formName?: string
  enableDraftSaving?: boolean
  validationSchema?: z.ZodSchema
}

interface FormErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorType?: 'validation' | 'submission' | 'network' | 'unknown'
  validationErrors?: Record<string, string>
  formData?: Record<string, unknown>
  retryCount: number
}

/**
 * FormErrorBoundary - Specialized error boundary for form components
 *
 * Features:
 * - Detects validation vs submission errors
 * - Preserves form data during errors
 * - Provides draft saving functionality
 * - Handles network timeouts gracefully
 * - Integrates with form validation schemas
 */
export class FormErrorBoundary extends Component<FormErrorBoundaryProps, FormErrorBoundaryState> {
  private readonly MAX_RETRY_COUNT = 3
  private formDataInterval?: NodeJS.Timeout

  constructor(props: FormErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      retryCount: 0,
      formData: {},
    }
  }

  componentDidMount() {
    // Set up periodic form data capture if draft saving is enabled
    if (this.props.enableDraftSaving) {
      this.formDataInterval = setInterval(this.captureFormData, 5000)
    }

    // Restore any saved drafts
    this.restoreDraft()
  }

  componentWillUnmount() {
    if (this.formDataInterval) {
      clearInterval(this.formDataInterval)
    }
  }

  static getDerivedStateFromError(error: Error): Partial<FormErrorBoundaryState> {
    const errorType = FormErrorBoundary.categorizeFormError(error)
    const validationErrors = FormErrorBoundary.extractValidationErrors(error)

    return {
      hasError: true,
      error,
      errorType,
      validationErrors,
    }
  }

  static categorizeFormError(error: Error): FormErrorBoundaryState['errorType'] {
    const errorMessage = error.message.toLowerCase()
    const errorName = error.name.toLowerCase()

    // Zod validation errors
    if (error instanceof z.ZodError || errorName.includes('validation')) {
      return 'validation'
    }

    // Network/submission errors
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('fetch') ||
      errorName.includes('network')
    ) {
      return 'network'
    }

    // Form submission errors
    if (
      errorMessage.includes('submit') ||
      errorMessage.includes('submission') ||
      errorMessage.includes('400') ||
      errorMessage.includes('422')
    ) {
      return 'submission'
    }

    return 'unknown'
  }

  static extractValidationErrors(error: Error): Record<string, string> | undefined {
    // Handle Zod errors
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {}
      error.errors.forEach((err) => {
        const path = err.path.join('.')
        errors[path] = err.message
      })
      return errors
    }

    // Handle custom validation error format
    if ('validationErrors' in error && typeof error.validationErrors === 'object') {
      return error.validationErrors as Record<string, string>
    }

    return undefined
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console with form context
    console.error(
      `FormErrorBoundary caught an error in ${this.props.formName || 'unknown'} form:`,
      error,
      errorInfo
    )

    // Capture current form data before error handling
    this.captureFormData()

    // Capture in Sentry with form context
    captureException(error, {
      contexts: {
        form: {
          formName: this.props.formName,
          errorType: this.state.errorType,
          hasValidationErrors: Boolean(this.state.validationErrors),
          retryCount: this.state.retryCount,
        },
      },
      tags: {
        component: 'FormErrorBoundary',
        form: this.props.formName || 'unknown',
        errorType: this.state.errorType || 'unknown',
      },
    })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  captureFormData = () => {
    try {
      const forms = document.querySelectorAll('form')
      const formData: Record<string, unknown> = {}

      forms.forEach((form) => {
        const data = new FormData(form)
        data.forEach((value, key) => {
          formData[key] = value
        })
      })

      this.setState({ formData })

      // Save to localStorage for draft functionality
      if (this.props.enableDraftSaving && this.props.formName) {
        const draftKey = `formDraft_${this.props.formName}`
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            data: formData,
            timestamp: new Date().toISOString(),
          })
        )
      }
    } catch (err) {
      console.error('Failed to capture form data:', err)
    }
  }

  restoreDraft = () => {
    if (!this.props.enableDraftSaving || !this.props.formName) return

    try {
      const draftKey = `formDraft_${this.props.formName}`
      const draftData = localStorage.getItem(draftKey)

      if (draftData) {
        const { data, timestamp } = JSON.parse(draftData)

        // Check if draft is less than 24 hours old
        const draftAge = Date.now() - new Date(timestamp).getTime()
        if (draftAge < 24 * 60 * 60 * 1000) {
          this.setState({ formData: data })
          console.log('Draft restored for form:', this.props.formName)
        } else {
          // Clear old draft
          localStorage.removeItem(draftKey)
        }
      }
    } catch (err) {
      console.error('Failed to restore draft:', err)
    }
  }

  handleRetry = () => {
    const newRetryCount = this.state.retryCount + 1

    if (newRetryCount > this.MAX_RETRY_COUNT) {
      console.error('Max retry count reached for form submission')
      return
    }

    // Clear error state and increment retry count
    this.setState({
      hasError: false,
      error: undefined,
      errorType: undefined,
      validationErrors: undefined,
      retryCount: newRetryCount,
    })

    // Call custom retry handler if provided
    if (this.props.onRetry) {
      this.props.onRetry()
    }
  }

  handleSaveDraft = () => {
    if (this.state.formData && this.props.onSaveDraft) {
      this.props.onSaveDraft(this.state.formData)
    }
  }

  handleReset = () => {
    // Clear all state and drafts
    this.setState({
      hasError: false,
      error: undefined,
      errorType: undefined,
      validationErrors: undefined,
      formData: {},
      retryCount: 0,
    })

    // Clear saved draft
    if (this.props.formName) {
      const draftKey = `formDraft_${this.props.formName}`
      localStorage.removeItem(draftKey)
    }

    // Call custom reset handler if provided
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  componentDidUpdate(prevProps: FormErrorBoundaryProps) {
    // Reset error state if children change (e.g., navigating to a different form)
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({
        hasError: false,
        error: undefined,
        errorType: undefined,
        validationErrors: undefined,
        retryCount: 0,
      })
    }
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallbackComponent) {
        return this.props.fallbackComponent
      }

      // Show validation errors if present
      if (this.state.errorType === 'validation' && this.state.validationErrors) {
        return (
          <div className="space-y-4">
            <FormValidationError
              errors={this.state.validationErrors}
              onRetry={this.handleRetry}
              title="Please fix the following errors"
              message="Your form contains validation errors:"
              testId="form-validation-error"
            />

            {this.props.enableDraftSaving && (
              <div className="flex space-x-2 px-4">
                <button
                  onClick={this.handleSaveDraft}
                  className="text-sm text-primary-600 hover:text-primary-700 underline"
                >
                  Save as Draft
                </button>
                <button
                  onClick={this.handleReset}
                  className="text-sm text-gray-600 hover:text-gray-700 underline"
                >
                  Reset Form
                </button>
              </div>
            )}
          </div>
        )
      }

      // Show submission error for other error types
      const errorMessage =
        this.state.errorType === 'network'
          ? 'Network error occurred. Please check your connection and try again.'
          : 'There was an error submitting your form. Please try again.'

      return (
        <div className="space-y-4">
          <FormSubmissionError
            onRetry={this.handleRetry}
            message={errorMessage}
            testId="form-submission-error"
          />

          {this.state.retryCount > 0 && (
            <p className="text-sm text-gray-600 px-4">
              Retry attempt {this.state.retryCount} of {this.MAX_RETRY_COUNT}
            </p>
          )}

          {this.props.enableDraftSaving &&
            this.state.formData &&
            Object.keys(this.state.formData).length > 0 && (
              <div className="flex space-x-2 px-4">
                <button
                  onClick={this.handleSaveDraft}
                  className="text-sm text-primary-600 hover:text-primary-700 underline"
                >
                  Save as Draft
                </button>
                <span className="text-sm text-gray-500">Your form data has been preserved</span>
              </div>
            )}
        </div>
      )
    }

    return this.props.children
  }
}

// Export as default for easier imports
export default FormErrorBoundary
