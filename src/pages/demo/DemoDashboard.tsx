/**
 * Demo Dashboard Page
 * 
 * Renders the appropriate dashboard based on the demo user type.
 * Uses real dashboard components but with demo data service.
 * 
 * Security: Only displays mock data, no real operations possible.
 */

import { useParams, Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { DemoModeIndicator } from '../../components/demo/DemoModeIndicator'

// Demo-wrapped versions that use demo data
import { DemoSupplierDashboard } from '../../components/demo/DemoSupplierDashboard'
import { DemoBuyerDashboard } from '../../components/demo/DemoBuyerDashboard'
import { DemoAdminDashboard } from '../../components/demo/DemoAdminDashboard'
import { DemoNetworkDashboard } from '../../components/demo/DemoNetworkDashboard'

export default function DemoDashboard() {
  const { userType } = useParams<{ userType: string }>()
  const { isDemoMode, enterDemoMode } = useAuthStore()

  // Validate user type parameter
  if (!userType || !['supplier', 'buyer', 'admin', 'network'].includes(userType)) {
    return <Navigate to="/demo/supplier" replace />
  }

  // Ensure demo mode is active for the requested user type
  if (!isDemoMode) {
    // Auto-enter demo mode with the requested user type
    enterDemoMode(userType as 'supplier' | 'buyer' | 'admin' | 'network')
  }

  // Render the appropriate demo dashboard
  const renderDashboard = () => {
    switch (userType) {
      case 'supplier':
        return <DemoSupplierDashboard />
      case 'buyer':
        return <DemoBuyerDashboard />
      case 'admin':
        return <DemoAdminDashboard />
      case 'network':
        return <DemoNetworkDashboard />
      default:
        return <Navigate to="/demo/supplier" replace />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Demo mode indicator */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-3">
            <DemoModeIndicator compact />
          </div>
        </div>
      </div>

      {/* Demo dashboard content */}
      {renderDashboard()}
    </div>
  )
}