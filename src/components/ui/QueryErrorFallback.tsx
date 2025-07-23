import { ErrorFallback } from './ErrorFallback'

interface QueryErrorFallbackProps {
  error: Error
  resetErrorBoundary: () => void
}

export function QueryErrorFallback({ error, resetErrorBoundary }: QueryErrorFallbackProps) {
  return <ErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} isRoot={false} />
}
