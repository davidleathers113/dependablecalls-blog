import { ErrorFallback } from './ErrorFallback'

interface AppErrorFallbackProps {
  error: Error
  resetErrorBoundary: () => void
  errorInfo?: { componentStack?: string; [key: string]: unknown }
}

export function AppErrorFallback({ error, resetErrorBoundary, errorInfo }: AppErrorFallbackProps) {
  return (
    <ErrorFallback
      error={error}
      resetErrorBoundary={resetErrorBoundary}
      errorInfo={errorInfo}
      isRoot={true}
    />
  )
}
