import { FormErrorBoundary } from './FormErrorBoundary'
import type { ComponentType } from 'react'
import type { z } from 'zod'

interface FormErrorBoundaryOptions {
  onRetry?: () => void
  onSaveDraft?: (data: Record<string, unknown>) => void
  onReset?: () => void
  formName?: string
  enableDraftSaving?: boolean
  validationSchema?: z.ZodSchema
}

/**
 * Higher-order component that wraps a form component with FormErrorBoundary
 */
export function withFormErrorBoundary<P extends object>(
  Component: ComponentType<P>,
  options?: FormErrorBoundaryOptions
) {
  return (props: P) => (
    <FormErrorBoundary {...options}>
      <Component {...props} />
    </FormErrorBoundary>
  )
}
