import { useState } from 'react'

export interface FormSubmissionState {
  isLoading: boolean
  error: string | null
  isSuccess: boolean
}

export function useFormSubmission() {
  const [state, setState] = useState<FormSubmissionState>({
    isLoading: false,
    error: null,
    isSuccess: false,
  })

  const setLoading = (isLoading: boolean) => {
    setState((prev) => ({ ...prev, isLoading, error: null }))
  }

  const setError = (error: string) => {
    setState((prev) => ({ ...prev, isLoading: false, error, isSuccess: false }))
  }

  const setSuccess = () => {
    setState((prev) => ({ ...prev, isLoading: false, error: null, isSuccess: true }))
  }

  const reset = () => {
    setState({ isLoading: false, error: null, isSuccess: false })
  }

  const handleSubmit = async <T>(
    data: T,
    submitFn: (data: T) => Promise<void>,
    options?: {
      onSuccess?: () => void
      onError?: (error: unknown) => void
      resetSuccessAfter?: number
    }
  ) => {
    setLoading(true)

    try {
      await submitFn(data)
      setSuccess()
      options?.onSuccess?.()

      if (options?.resetSuccessAfter) {
        setTimeout(() => {
          setState((prev) => ({ ...prev, isSuccess: false }))
        }, options.resetSuccessAfter)
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      options?.onError?.(err)
    }
  }

  return {
    ...state,
    setLoading,
    setError,
    setSuccess,
    reset,
    handleSubmit,
  }
}
