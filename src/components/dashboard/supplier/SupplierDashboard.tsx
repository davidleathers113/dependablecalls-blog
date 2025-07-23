import { useState } from 'react'
import { QuickStatsBar } from './QuickStatsBar'
import { CallVolumeChart } from './CallVolumeChart'
import { RecentCallsList } from './RecentCallsList'
import { ActiveCampaignsTable } from './ActiveCampaignsTable'
import { useAuth } from '../../../hooks/useAuth'

export function SupplierDashboard() {
  const { user } = useAuth()
  const [selectedTimeRange, setSelectedTimeRange] = useState<'24h' | '7d' | '30d'>('7d')

  if (!user || user.user_metadata?.userType !== 'supplier') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Access denied. Supplier account required.</p>
      </div>
    )
  }

  return (
    <div data-testid="supplier-dashboard" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supplier Dashboard</h1>
          <p className="text-gray-600">Track your call performance and earnings</p>
        </div>
        <div className="flex items-center space-x-2">
          <label htmlFor="timeRange" className="text-sm text-gray-700">
            Time Range:
          </label>
          <select
            id="timeRange"
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value as '24h' | '7d' | '30d')}
            className="rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <QuickStatsBar timeRange={selectedTimeRange} supplierId={user.id} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Performance Chart */}
        <div className="lg:col-span-1">
          <CallVolumeChart timeRange={selectedTimeRange} supplierId={user.id} />
        </div>

        {/* Right Column - Recent Calls */}
        <div className="lg:col-span-1">
          <RecentCallsList supplierId={user.id} />
        </div>
      </div>

      {/* Active Campaigns Table */}
      <ActiveCampaignsTable supplierId={user.id} />
    </div>
  )
}
