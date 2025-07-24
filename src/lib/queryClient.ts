import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'
import { captureError, addBreadcrumb } from './monitoring'

/**
 * Custom error handling for React Query
 * Integrates with Sentry monitoring and error boundaries
 */
const handleQueryError = (error: Error, query?: unknown) => {
  // Add breadcrumb for debugging
  addBreadcrumb('React Query error occurred', 'query', 'error', {
    queryKey:
      query && typeof query === 'object' && 'queryKey' in query
        ? (query as { queryKey: unknown }).queryKey
        : 'unknown',
    errorMessage: error.message,
  })

  // Capture error with context
  captureError(error, {
    context: 'react-query',
    queryInfo: query,
  })
}

const handleMutationError = (
  error: Error,
  variables?: unknown,
  context?: unknown,
  mutation?: unknown
) => {
  // Add breadcrumb for debugging
  addBreadcrumb('React Query mutation error occurred', 'mutation', 'error', {
    mutationKey:
      mutation && typeof mutation === 'object' && 'mutationKey' in mutation
        ? (mutation as { mutationKey: unknown }).mutationKey
        : 'unknown',
    errorMessage: error.message,
    variables: typeof variables === 'object' ? variables : 'non-object',
  })

  // Capture error with context
  captureError(error, {
    context: 'react-query-mutation',
    variables,
    mutationContext: context,
  })
}

/**
 * Create and configure QueryClient with error boundary integration
 */
export const createQueryClient = () => {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: handleQueryError,
    }),
    mutationCache: new MutationCache({
      onError: handleMutationError,
    }),
    defaultOptions: {
      queries: {
        // Retry configuration
        retry: (failureCount, error) => {
          // Don't retry on 4xx errors (client errors)
          if (error && typeof error === 'object' && 'status' in error) {
            const status = error.status as number
            if (status >= 400 && status < 500) {
              return false
            }
          }

          // Retry up to 3 times for other errors
          return failureCount < 3
        },

        // Stale time configuration
        staleTime: 5 * 60 * 1000, // 5 minutes

        // Error handling
        throwOnError: (_, query) => {
          // Allow error boundaries to catch errors for critical operations
          if (query.meta?.critical) {
            return true
          }

          // Don't throw for background refetches
          if (query.state.data !== undefined) {
            return false
          }

          // Throw on initial load errors
          return true
        },

        // Network mode
        networkMode: 'online',

        // Refetch configuration
        refetchOnWindowFocus: false,
        refetchOnReconnect: 'always',
      },
      mutations: {
        // Retry configuration for mutations
        retry: (failureCount, error) => {
          // Don't retry mutations on client errors
          if (error && typeof error === 'object' && 'status' in error) {
            const status = error.status as number
            if (status >= 400 && status < 500) {
              return false
            }
          }

          // Only retry once for server errors
          return failureCount < 1
        },

        // Error handling
        throwOnError: true, // Always throw mutation errors to error boundaries

        // Network mode
        networkMode: 'online',
      },
    },
  })
}

/**
 * Singleton QueryClient instance
 */
export const queryClient = createQueryClient()

/**
 * Query keys factory for consistent key management
 */
export const queryKeys = {
  // Authentication
  auth: {
    user: ['auth', 'user'] as const,
    session: ['auth', 'session'] as const,
  },

  // Campaigns
  campaigns: {
    all: ['campaigns'] as const,
    lists: () => [...queryKeys.campaigns.all, 'list'] as const,
    list: (filters: string) => [...queryKeys.campaigns.lists(), { filters }] as const,
    details: () => [...queryKeys.campaigns.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.campaigns.details(), id] as const,
    analytics: (id: string) => [...queryKeys.campaigns.detail(id), 'analytics'] as const,
  },

  // Calls
  calls: {
    all: ['calls'] as const,
    lists: () => [...queryKeys.calls.all, 'list'] as const,
    list: (filters: string) => [...queryKeys.calls.lists(), { filters }] as const,
    details: () => [...queryKeys.calls.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.calls.details(), id] as const,
    recording: (id: string) => [...queryKeys.calls.detail(id), 'recording'] as const,
  },

  // Payments
  payments: {
    all: ['payments'] as const,
    transactions: () => [...queryKeys.payments.all, 'transactions'] as const,
    payouts: () => [...queryKeys.payments.all, 'payouts'] as const,
    billing: () => [...queryKeys.payments.all, 'billing'] as const,
    stripeAccount: () => [...queryKeys.payments.all, 'stripe-account'] as const,
  },

  // Reports
  reports: {
    all: ['reports'] as const,
    dashboard: () => [...queryKeys.reports.all, 'dashboard'] as const,
    performance: (timeRange: string) =>
      [...queryKeys.reports.all, 'performance', timeRange] as const,
    conversion: (timeRange: string) => [...queryKeys.reports.all, 'conversion', timeRange] as const,
  },
} as const

/**
 * Mutation keys factory for consistent key management
 */
export const mutationKeys = {
  // Authentication
  auth: {
    login: ['auth', 'login'] as const,
    logout: ['auth', 'logout'] as const,
    register: ['auth', 'register'] as const,
    resetPassword: ['auth', 'reset-password'] as const,
  },

  // Campaigns
  campaigns: {
    create: ['campaigns', 'create'] as const,
    update: ['campaigns', 'update'] as const,
    delete: ['campaigns', 'delete'] as const,
    activate: ['campaigns', 'activate'] as const,
    deactivate: ['campaigns', 'deactivate'] as const,
  },

  // Payments
  payments: {
    createPaymentIntent: ['payments', 'create-intent'] as const,
    processPayment: ['payments', 'process'] as const,
    requestPayout: ['payments', 'request-payout'] as const,
    connectStripe: ['payments', 'connect-stripe'] as const,
  },
} as const

export default queryClient
