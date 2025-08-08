/**
 * Service Worker provider for React 19.1 optimization
 * Handles asset caching and offline functionality
 */

import React, { createContext, useContext, useEffect, useState } from 'react'

interface ServiceWorkerContextType {
  isSupported: boolean
  isRegistered: boolean
  updateAvailable: boolean
  isOffline: boolean
  updateServiceWorker: () => void
  showUpdatePrompt: boolean
  dismissUpdate: () => void
}

const ServiceWorkerContext = createContext<ServiceWorkerContextType | undefined>(undefined)

// Service worker registration and update logic
const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Worker not supported')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none' // Always check for updates
    })

    console.log('Service Worker registered successfully:', registration.scope)
    return registration
  } catch (error) {
    console.error('Service Worker registration failed:', error)
    return null
  }
}

interface ServiceWorkerProviderProps {
  children: React.ReactNode
  enableUpdatePrompt?: boolean
}

export const ServiceWorkerProvider: React.FC<ServiceWorkerProviderProps> = ({
  children,
  enableUpdatePrompt = true
}) => {
  const [isSupported] = useState('serviceWorker' in navigator)
  const [isRegistered, setIsRegistered] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  // Register service worker on mount
  useEffect(() => {
    if (!isSupported || process.env.NODE_ENV !== 'production') {
      return
    }

    registerServiceWorker().then((registration) => {
      if (registration) {
        setIsRegistered(true)

        // Check for updates
        const checkForUpdate = () => {
          registration.update().catch((error) => {
            console.warn('Service Worker update check failed:', error)
          })
        }

        // Handle waiting worker (update available)
        const handleWaiting = (worker: ServiceWorker) => {
          setWaitingWorker(worker)
          setUpdateAvailable(true)
          
          if (enableUpdatePrompt) {
            setShowUpdatePrompt(true)
          }
        }

        // Listen for service worker state changes
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing
          
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (
                installingWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                // New content is available
                handleWaiting(installingWorker)
              }
            })
          }
        })

        // Check for waiting worker on registration
        if (registration.waiting) {
          handleWaiting(registration.waiting)
        }

        // Check for updates periodically
        setInterval(checkForUpdate, 60000) // Check every minute
      }
    })
  }, [isSupported, enableUpdatePrompt])

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Listen for service worker messages
  useEffect(() => {
    if (!isSupported) return

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'SKIP_WAITING') {
        setUpdateAvailable(false)
        setShowUpdatePrompt(false)
        
        // Reload to activate new service worker
        window.location.reload()
      }
    }

    navigator.serviceWorker.addEventListener('message', handleMessage)
    
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage)
    }
  }, [isSupported])

  // Update service worker
  const updateServiceWorker = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' })
    }
  }

  // Dismiss update prompt
  const dismissUpdate = () => {
    setShowUpdatePrompt(false)
  }

  const value: ServiceWorkerContextType = {
    isSupported,
    isRegistered,
    updateAvailable,
    isOffline,
    updateServiceWorker,
    showUpdatePrompt,
    dismissUpdate
  }

  return (
    <ServiceWorkerContext.Provider value={value}>
      {children}
    </ServiceWorkerContext.Provider>
  )
}

// Hook to use service worker context
// eslint-disable-next-line react-refresh/only-export-components
export const useServiceWorker = (): ServiceWorkerContextType => {
  const context = useContext(ServiceWorkerContext)
  
  if (context === undefined) {
    throw new Error('useServiceWorker must be used within a ServiceWorkerProvider')
  }
  
  return context
}

// Update prompt component
export const UpdatePrompt: React.FC = React.memo(() => {
  const { showUpdatePrompt, updateServiceWorker, dismissUpdate } = useServiceWorker()

  if (!showUpdatePrompt) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <div className="flex items-start">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-900">
              Update Available
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              A new version of the app is available. Update now for the latest features and improvements.
            </p>
          </div>
        </div>
        
        <div className="flex justify-end space-x-2 mt-4">
          <button
            onClick={dismissUpdate}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Later
          </button>
          <button
            onClick={updateServiceWorker}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Update
          </button>
        </div>
      </div>
    </div>
  )
})

UpdatePrompt.displayName = 'UpdatePrompt'

// Offline indicator
export const OfflineIndicator: React.FC = React.memo(() => {
  const { isOffline } = useServiceWorker()

  if (!isOffline) {
    return null
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="bg-yellow-500 text-yellow-900 px-4 py-2 text-center text-sm font-medium">
        You're currently offline. Some features may be limited.
      </div>
    </div>
  )
})

OfflineIndicator.displayName = 'OfflineIndicator'

export default ServiceWorkerProvider