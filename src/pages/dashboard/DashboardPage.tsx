import { useAuthStore } from '../../store/authStore'
import { SupplierDashboard } from '../../components/dashboard/supplier'
import { BuyerDashboard } from '../../components/dashboard/buyer/BuyerDashboard'
import { AdminDashboard } from '../../components/dashboard/admin/AdminDashboard'
import { NetworkDashboard } from '../../components/dashboard/network'

export default function DashboardPage() {
  const { user, userType, isDemoMode, demoUserType } = useAuthStore()
  
  // Use demo user type if in demo mode, otherwise use actual user type
  const currentUserType = isDemoMode ? demoUserType : userType

  // Render appropriate dashboard based on user type
  if (currentUserType === 'supplier') {
    return <SupplierDashboard />
  }

  if (currentUserType === 'buyer') {
    return <BuyerDashboard />
  }

  if (currentUserType === 'admin') {
    return <AdminDashboard />
  }

  if (currentUserType === 'network') {
    return <NetworkDashboard />
  }

  // Default fallback for unknown user types
  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome back, {isDemoMode ? 'Demo User' : user?.email}
        </p>
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-sm text-yellow-800">
            {isDemoMode 
              ? 'Demo mode active. Unable to determine demo user type.'
              : 'Unable to determine user type. Please contact support.'
            }
          </p>
        </div>
      </div>
    </div>
  )
}
