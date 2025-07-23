import { ErrorFallback } from './ErrorFallback'

interface AppErrorFallbackProps {
  error: Error
  resetErrorBoundary: () => void
}

export function AppErrorFallback({ error, resetErrorBoundary }: AppErrorFallbackProps) {
  return <ErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} isRoot={true} />
}
