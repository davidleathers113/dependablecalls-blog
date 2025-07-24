import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { TimeoutError, ErrorFallback } from '../common/FallbackUI'
import { captureException } from '@sentry/react'
import { WifiIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

interface RealtimeErrorBoundaryProps {
  children: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  onReconnect?: () => void
  onFallbackToPolling?: () => void
  onRefresh?: () => void
  fallbackComponent?: ReactNode
  featureName?: string
  enableAutoReconnect?: boolean
  maxReconnectAttempts?: number
  reconnectDelay?: number
}

interface RealtimeErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorType?: 'websocket' | 'timeout' | 'connection' | 'data_sync' | 'unknown'
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting' | 'error'
  reconnectAttempts: number
  lastSuccessfulConnection?: Date
}

/**
 * RealtimeErrorBoundary - Specialized error boundary for real-time features
 *
 * Features:
 * - Handles WebSocket disconnections gracefully
 * - Automatic reconnection with exponential backoff
 * - Shows connection status to users
 * - Falls back to polling when WebSocket fails
 * - Preserves application state during reconnection
 */
export class RealtimeErrorBoundary extends Component<
  RealtimeErrorBoundaryProps,
  RealtimeErrorBoundaryState
> {
  private reconnectTimer?: NodeJS.Timeout
  private connectionMonitor?: NodeJS.Timeout

  constructor(props: RealtimeErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      connectionStatus: 'connected',
      reconnectAttempts: 0,
    }
  }

  componentDidMount() {
    // Set up connection monitoring
    this.startConnectionMonitoring()

    // Listen for WebSocket events if available
    this.setupWebSocketListeners()
  }

  componentWillUnmount() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }
    if (this.connectionMonitor) {
      clearInterval(this.connectionMonitor)
    }
  }

  static getDerivedStateFromError(error: Error): Partial<RealtimeErrorBoundaryState> {
    const errorType = RealtimeErrorBoundary.categorizeRealtimeError(error)

    return {
      hasError: true,
      error,
      errorType,
      connectionStatus: 'error',
    }
  }

  static categorizeRealtimeError(error: Error): RealtimeErrorBoundaryState['errorType'] {
    const errorMessage = error.message.toLowerCase()
    const errorName = error.name.toLowerCase()

    // WebSocket specific errors
    if (
      errorMessage.includes('websocket') ||
      errorMessage.includes('ws://') ||
      errorMessage.includes('wss://') ||
      errorName.includes('websocket')
    ) {
      return 'websocket'
    }

    // Timeout errors
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('timed out') ||
      errorName.includes('timeout')
    ) {
      return 'timeout'
    }

    // Connection errors
    if (
      errorMessage.includes('connection') ||
      errorMessage.includes('network') ||
      errorMessage.includes('offline')
    ) {
      return 'connection'
    }

    // Data synchronization errors
    if (
      errorMessage.includes('sync') ||
      errorMessage.includes('out of sync') ||
      errorMessage.includes('data mismatch')
    ) {
      return 'data_sync'
    }

    return 'unknown'
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console with real-time context
    console.error(
      `RealtimeErrorBoundary caught an error in ${this.props.featureName || 'unknown'} feature:`,
      error,
      errorInfo
    )

    // Capture in Sentry with real-time context
    captureException(error, {
      contexts: {
        realtime: {
          featureName: this.props.featureName,
          errorType: this.state.errorType,
          connectionStatus: this.state.connectionStatus,
          reconnectAttempts: this.state.reconnectAttempts,
          lastSuccessfulConnection: this.state.lastSuccessfulConnection?.toISOString(),
        },
      },
      tags: {
        component: 'RealtimeErrorBoundary',
        feature: this.props.featureName || 'unknown',
        errorType: this.state.errorType || 'unknown',
      },
    })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Start automatic reconnection if enabled
    if (this.props.enableAutoReconnect && this.shouldAttemptReconnect()) {
      this.scheduleReconnect()
    }
  }

  setupWebSocketListeners = () => {
    // This would integrate with your WebSocket implementation
    // Example with global WebSocket events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline)
      window.addEventListener('offline', this.handleOffline)
    }
  }

  startConnectionMonitoring = () => {
    // Monitor connection status periodically
    this.connectionMonitor = setInterval(() => {
      // This would check your actual WebSocket/real-time connection
      // For now, we'll use navigator.onLine as a proxy
      if (!navigator.onLine && this.state.connectionStatus === 'connected') {
        this.setState({ connectionStatus: 'disconnected' })
      }
    }, 5000)
  }

  handleOnline = () => {
    console.log('Connection restored')
    if (this.state.connectionStatus === 'disconnected') {
      this.handleReconnect()
    }
  }

  handleOffline = () => {
    console.log('Connection lost')
    this.setState({ connectionStatus: 'disconnected' })
  }

  shouldAttemptReconnect = (): boolean => {
    const maxAttempts = this.props.maxReconnectAttempts || 5
    return this.state.reconnectAttempts < maxAttempts
  }

  scheduleReconnect = () => {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s...
    const baseDelay = this.props.reconnectDelay || 1000
    const delay = Math.min(baseDelay * Math.pow(2, this.state.reconnectAttempts), 30000)

    console.log(`Scheduling reconnect in ${delay}ms (attempt ${this.state.reconnectAttempts + 1})`)

    this.setState({ connectionStatus: 'reconnecting' })

    this.reconnectTimer = setTimeout(() => {
      this.handleReconnect()
    }, delay)
  }

  handleReconnect = async () => {
    try {
      this.setState((prevState) => ({
        reconnectAttempts: prevState.reconnectAttempts + 1,
        connectionStatus: 'reconnecting',
      }))

      // Call custom reconnect handler if provided
      if (this.props.onReconnect) {
        await this.props.onReconnect()
      }

      // If successful, reset error state
      this.setState({
        hasError: false,
        error: undefined,
        errorType: undefined,
        connectionStatus: 'connected',
        reconnectAttempts: 0,
        lastSuccessfulConnection: new Date(),
      })
    } catch (error) {
      console.error('Reconnection failed:', error)

      if (this.shouldAttemptReconnect()) {
        this.scheduleReconnect()
      } else {
        this.setState({ connectionStatus: 'error' })
      }
    }
  }

  handleFallbackToPolling = () => {
    // Clear error state
    this.setState({
      hasError: false,
      error: undefined,
      errorType: undefined,
      connectionStatus: 'connected',
    })

    // Call custom fallback handler if provided
    if (this.props.onFallbackToPolling) {
      this.props.onFallbackToPolling()
    }
  }

  handleRefresh = () => {
    if (this.props.onRefresh) {
      this.props.onRefresh()
    } else {
      window.location.reload()
    }
  }

  renderConnectionStatus = () => {
    if (
      this.state.connectionStatus === 'disconnected' ||
      this.state.connectionStatus === 'reconnecting'
    ) {
      return (
        <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow-lg p-4 max-w-sm">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <WifiIcon className="h-5 w-5 text-yellow-600 animate-pulse" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  {this.state.connectionStatus === 'reconnecting'
                    ? 'Reconnecting...'
                    : 'Connection Lost'}
                </h3>
                <p className="mt-1 text-sm text-yellow-700">
                  {this.state.connectionStatus === 'reconnecting'
                    ? `Attempt ${this.state.reconnectAttempts} of ${this.props.maxReconnectAttempts || 5}`
                    : 'Real-time updates are temporarily unavailable'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallbackComponent) {
        return (
          <>
            {this.props.fallbackComponent}
            {this.renderConnectionStatus()}
          </>
        )
      }

      // Show timeout-specific error
      if (this.state.errorType === 'timeout') {
        return (
          <>
            <TimeoutError
              onRetry={this.handleReconnect}
              onCancel={() => this.setState({ hasError: false })}
              timeoutDuration={30}
              testId="realtime-timeout-error"
            />
            {this.renderConnectionStatus()}
          </>
        )
      }

      // Show connection-specific error
      if (this.state.errorType === 'websocket' || this.state.errorType === 'connection') {
        return (
          <>
            <div className="min-h-[400px] flex items-center justify-center p-6">
              <div className="max-w-md w-full text-center">
                <div className="flex justify-center mb-6">
                  <div className="rounded-full bg-yellow-100 p-3">
                    <WifiIcon className="h-8 w-8 text-yellow-600" aria-hidden="true" />
                  </div>
                </div>

                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Real-time Connection Error
                </h2>

                <p className="text-gray-600 mb-6 leading-relaxed">
                  {this.props.featureName
                    ? `The ${this.props.featureName} feature is temporarily unavailable.`
                    : 'Real-time features are temporarily unavailable.'}{' '}
                  We're working to restore the connection.
                </p>

                <div className="space-y-3">
                  {this.state.reconnectAttempts < (this.props.maxReconnectAttempts || 5) && (
                    <button
                      onClick={this.handleReconnect}
                      className="w-full flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
                      disabled={this.state.connectionStatus === 'reconnecting'}
                    >
                      <ArrowPathIcon
                        className={`h-4 w-4 mr-2 ${this.state.connectionStatus === 'reconnecting' ? 'animate-spin' : ''}`}
                      />
                      {this.state.connectionStatus === 'reconnecting'
                        ? 'Reconnecting...'
                        : 'Reconnect Now'}
                    </button>
                  )}

                  {this.props.onFallbackToPolling && (
                    <button
                      onClick={this.handleFallbackToPolling}
                      className="w-full flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                    >
                      Continue with Limited Features
                    </button>
                  )}

                  <button
                    onClick={this.handleRefresh}
                    className="w-full flex items-center justify-center px-4 py-2 text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
                  >
                    Refresh Page
                  </button>
                </div>

                {this.state.lastSuccessfulConnection && (
                  <p className="mt-4 text-xs text-gray-500">
                    Last connected: {this.state.lastSuccessfulConnection.toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
            {this.renderConnectionStatus()}
          </>
        )
      }

      // Generic real-time error
      return (
        <>
          <ErrorFallback
            title="Real-time Feature Error"
            message={`The ${this.props.featureName || 'real-time'} feature encountered an error. You can continue using other features while we resolve this issue.`}
            onRetry={this.handleReconnect}
            onGoHome={() => (window.location.href = '/app/dashboard')}
            showHomeButton={true}
            showBackButton={false}
            retryLabel="Try Reconnecting"
            testId="realtime-generic-error"
          />
          {this.renderConnectionStatus()}
        </>
      )
    }

    return (
      <>
        {this.props.children}
        {this.renderConnectionStatus()}
      </>
    )
  }
}

// Export as default for easier imports
export default RealtimeErrorBoundary
