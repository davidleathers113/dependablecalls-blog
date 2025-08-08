/**
 * Demo Mode Indicator Component
 * 
 * Shows users they are in demo mode with clear indicators and
 * provides easy transition to real registration/login.
 * 
 * Features:
 * - Prominent demo mode badge
 * - Easy exit to registration
 * - User type indicator
 * - Non-intrusive but clear visibility
 */

import { memo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import {
  EyeIcon,
  ArrowTopRightOnSquareIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { Button } from '../common/Button'

interface DemoModeIndicatorProps {
  /** Optional className for custom styling */
  className?: string
  /** Whether to show in compact mode (smaller) */
  compact?: boolean
  /** Whether to show the close button */
  showClose?: boolean
}

export const DemoModeIndicator = memo<DemoModeIndicatorProps>(({
  className = '',
  compact = false,
  showClose = true
}) => {
  const { isDemoMode, demoUserType, exitDemoMode } = useAuthStore()

  const handleExitDemo = useCallback(() => {
    exitDemoMode()
  }, [exitDemoMode])

  // Don't render if not in demo mode
  if (!isDemoMode || !demoUserType) {
    return null
  }

  const userTypeLabel = demoUserType.charAt(0).toUpperCase() + demoUserType.slice(1)

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1 bg-yellow-100 border border-yellow-300 rounded-full text-sm ${className}`}>
        <EyeIcon className="h-4 w-4 text-yellow-600" aria-hidden="true" />
        <span className="font-medium text-yellow-800">Demo Mode</span>
        <span className="text-yellow-700">({userTypeLabel})</span>
        {showClose && (
          <button
            onClick={handleExitDemo}
            className="ml-1 p-0.5 rounded-full hover:bg-yellow-200 transition-colors"
            aria-label="Exit demo mode"
            title="Exit demo mode"
          >
            <XMarkIcon className="h-3 w-3 text-yellow-600" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={`bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg shadow-sm ${className}`}>
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <EyeIcon className="h-6 w-6 text-yellow-600" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-semibold text-yellow-800">
                  Demo Mode Active
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-200 text-yellow-800">
                  {userTypeLabel} View
                </span>
              </div>
              <p className="text-sm text-yellow-700 mt-1">
                You're exploring a preview of the {userTypeLabel.toLowerCase()} dashboard with sample data.
                <span className="font-medium"> No real data is displayed.</span>
              </p>
            </div>
          </div>
          {showClose && (
            <div className="flex-shrink-0">
              <button
                onClick={handleExitDemo}
                className="p-1 rounded-md hover:bg-yellow-100 transition-colors"
                aria-label="Exit demo mode"
                title="Exit demo mode"
              >
                <XMarkIcon className="h-5 w-5 text-yellow-600" />
              </button>
            </div>
          )}
        </div>
        
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <Link
            to="/register"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
          >
            Create Real Account
            <ArrowTopRightOnSquareIcon className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
          
          <Link
            to="/login"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
          >
            Sign In
          </Link>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExitDemo}
            className="text-yellow-700 hover:text-yellow-800 hover:bg-yellow-100"
          >
            Exit Demo
          </Button>
        </div>
      </div>
    </div>
  )
})

DemoModeIndicator.displayName = 'DemoModeIndicator'

export default DemoModeIndicator