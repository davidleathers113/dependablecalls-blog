import { useAuthStore } from '../../../store/authStore'
import { useNetworkStore } from '../../../store/networkStore'
import {
  CurrencyDollarIcon,
  PhoneIcon,
  ChartBarIcon,
  ArrowsRightLeftIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline'

export function NetworkDashboard() {
  const { user } = useAuthStore()
  const { selectedMode, setSelectedMode } = useNetworkStore()

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with Mode Switcher */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Network Dashboard</h1>
              <p className="mt-1 text-sm text-gray-600">
                Manage your network operations, {user?.email}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">View Mode:</span>
              <div className="flex rounded-lg shadow-sm">
                <button
                  onClick={() => setSelectedMode('network')}
                  className={`px-4 py-2 text-sm font-medium rounded-l-lg ${
                    selectedMode === 'network'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }`}
                >
                  Network View
                </button>
                <button
                  onClick={() => setSelectedMode('buyer')}
                  className={`px-4 py-2 text-sm font-medium border-t border-b ${
                    selectedMode === 'buyer'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                  }`}
                >
                  Buyer Mode
                </button>
                <button
                  onClick={() => setSelectedMode('supplier')}
                  className={`px-4 py-2 text-sm font-medium rounded-r-lg ${
                    selectedMode === 'supplier'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }`}
                >
                  Supplier Mode
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Network Overview Metrics */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Revenue (Sell-side) */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Revenue (Selling)
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">$0.00</div>
                      <div className="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                        <span>↑ 0%</span>
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Total Cost (Buy-side) */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CurrencyDollarIcon className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Cost (Buying)</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">$0.00</div>
                      <div className="ml-2 flex items-baseline text-sm font-semibold text-red-600">
                        <span>↑ 0%</span>
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Net Margin */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ChartBarIcon className="h-6 w-6 text-primary-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Net Margin</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">$0.00</div>
                      <div className="ml-2 text-sm text-gray-600">(0%)</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Call Volume */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <PhoneIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Calls Routed</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">0</div>
                      <div className="ml-2 flex items-baseline text-sm font-semibold text-blue-600">
                        <span>→ 0%</span>
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Relationship Overview */}
        <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Supplier Relationships */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Supplier Partners</h3>
                <BuildingOfficeIcon className="h-5 w-5 text-gray-400" />
              </div>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Active</dt>
                  <dd className="mt-1 text-2xl font-semibold text-gray-900">0</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Pending</dt>
                  <dd className="mt-1 text-2xl font-semibold text-gray-900">0</dd>
                </div>
              </dl>
              <div className="mt-4">
                <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                  Manage Suppliers →
                </button>
              </div>
            </div>
          </div>

          {/* Buyer Relationships */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Buyer Partners</h3>
                <UserGroupIcon className="h-5 w-5 text-gray-400" />
              </div>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Active</dt>
                  <dd className="mt-1 text-2xl font-semibold text-gray-900">0</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Pending</dt>
                  <dd className="mt-1 text-2xl font-semibold text-gray-900">0</dd>
                </div>
              </dl>
              <div className="mt-4">
                <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                  Manage Buyers →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Call Flow Visualization */}
        <div className="mt-8 bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Call Flow Overview</h3>
              <ArrowsRightLeftIcon className="h-5 w-5 text-gray-400" />
            </div>
            <div className="text-center py-12 text-gray-500">
              <ArrowsRightLeftIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm">No active call flows</p>
              <p className="mt-1 text-xs text-gray-400">
                Set up supplier and buyer relationships to start routing calls
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-base font-medium text-yellow-800 mb-2">Network Setup Required</h3>
          <p className="text-sm text-yellow-700 mb-4">
            Complete these steps to start operating as a network:
          </p>
          <ol className="list-decimal list-inside text-sm text-yellow-700 space-y-1">
            <li>Complete network verification and compliance</li>
            <li>Add supplier relationships to source calls</li>
            <li>Add buyer relationships to sell calls</li>
            <li>Configure routing rules and margins</li>
            <li>Set up billing and payment information</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
