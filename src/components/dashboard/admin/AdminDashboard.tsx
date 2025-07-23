import { useState } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { 
  CurrencyDollarIcon, 
  PhoneIcon, 
  ChartBarIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ServerIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

interface AdminStats {
  totalRevenue: number
  revenueTrend: number
  totalCalls: number
  callsTrend: number
  activeSuppliers: number
  suppliersTrend: number
  activeBuyers: number
  buyersTrend: number
  fraudBlocked: number
  fraudTrend: number
  systemUptime: number
  uptimeTrend: number
}

function StatCard({
  title,
  value,
  trend,
  icon: Icon,
  format = 'number',
  color = 'primary',
}: {
  title: string
  value: number | string
  trend: number
  icon: React.ComponentType<{ className?: string }>
  format?: 'number' | 'currency' | 'percentage' | 'uptime'
  color?: 'primary' | 'warning' | 'success'
}) {
  const formatValue = (val: number | string) => {
    if (typeof val === 'string') return val
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(val)
      case 'percentage':
        return `${val.toFixed(1)}%`
      case 'uptime':
        return `${val.toFixed(2)}%`
      default:
        return val.toLocaleString()
    }
  }

  const getTrendColor = (trend: number) => {
    if (trend > 0) return 'text-green-600'
    if (trend < 0) return 'text-red-600'
    return 'text-gray-500'
  }

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return '↗'
    if (trend < 0) return '↘'
    return '→'
  }

  const iconColorClass = {
    primary: 'text-primary-600',
    warning: 'text-yellow-600',
    success: 'text-green-600',
  }[color]

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Icon className={`h-8 w-8 ${iconColorClass}`} />
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{formatValue(value)}</p>
          </div>
        </div>
        <div className={`text-sm font-medium ${getTrendColor(trend)}`}>
          <span className="inline-flex items-center">
            {getTrendIcon(trend)} {Math.abs(trend).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  )
}

export function AdminDashboard() {
  const { user } = useAuth()
  const [selectedTimeRange, setSelectedTimeRange] = useState<'24h' | '7d' | '30d'>('7d')

  if (!user || user.user_metadata?.userType !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Access denied. Admin account required.</p>
      </div>
    )
  }

  // Mock data - in real app, this would come from API
  const stats: AdminStats = {
    totalRevenue: 156789,
    revenueTrend: 15.3,
    totalCalls: 4567,
    callsTrend: 12.8,
    activeSuppliers: 45,
    suppliersTrend: 5.2,
    activeBuyers: 28,
    buyersTrend: 8.7,
    fraudBlocked: 234,
    fraudTrend: -12.5,
    systemUptime: 99.98,
    uptimeTrend: 0.1,
  }

  return (
    <div data-testid="admin-dashboard" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">Platform overview and system health</p>
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Platform Revenue"
          value={stats.totalRevenue}
          trend={stats.revenueTrend}
          icon={CurrencyDollarIcon}
          format="currency"
        />
        <StatCard
          title="Total Calls"
          value={stats.totalCalls}
          trend={stats.callsTrend}
          icon={PhoneIcon}
        />
        <StatCard
          title="Active Suppliers"
          value={stats.activeSuppliers}
          trend={stats.suppliersTrend}
          icon={UserGroupIcon}
        />
        <StatCard
          title="Active Buyers"
          value={stats.activeBuyers}
          trend={stats.buyersTrend}
          icon={ChartBarIcon}
        />
        <StatCard
          title="Fraud Blocked"
          value={stats.fraudBlocked}
          trend={stats.fraudTrend}
          icon={ShieldCheckIcon}
          color="warning"
        />
        <StatCard
          title="System Uptime"
          value={stats.systemUptime}
          trend={stats.uptimeTrend}
          icon={ServerIcon}
          format="uptime"
          color="success"
        />
      </div>

      {/* System Alerts */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">System Alerts</h2>
        </div>
        <ul className="divide-y divide-gray-200">
          <li className="px-6 py-4">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500 flex-shrink-0" />
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-900">High fraud activity detected</p>
                <p className="text-sm text-gray-500">
                  15 suspicious calls blocked from IP range 192.168.x.x
                </p>
              </div>
              <span className="text-sm text-gray-500">10 minutes ago</span>
            </div>
          </li>
          <li className="px-6 py-4">
            <div className="flex items-center">
              <ShieldCheckIcon className="h-6 w-6 text-green-500 flex-shrink-0" />
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-900">Security update completed</p>
                <p className="text-sm text-gray-500">
                  All systems patched and secured
                </p>
              </div>
              <span className="text-sm text-gray-500">2 hours ago</span>
            </div>
          </li>
        </ul>
      </div>

      {/* Top Performers Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Suppliers */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Top Suppliers</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Calls
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quality
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    LeadGen Pro
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">847</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">96%</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    CallMaster Inc
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">652</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">94%</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Premium Leads Co
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">523</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">92%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Buyers */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Top Buyers</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Buyer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Spent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Campaigns
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Insurance Direct
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">$24,580</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">8</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Solar Solutions
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">$18,920</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">5</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Home Services Hub
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">$15,340</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">6</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">System Status</h2>
        </div>
        <div className="px-6 py-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <ServerIcon className="h-5 w-5 text-gray-400 mr-3" />
                <span className="text-sm font-medium text-gray-900">API Server</span>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Operational
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <ServerIcon className="h-5 w-5 text-gray-400 mr-3" />
                <span className="text-sm font-medium text-gray-900">Database</span>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Operational
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <ClockIcon className="h-5 w-5 text-gray-400 mr-3" />
                <span className="text-sm font-medium text-gray-900">Real-time Processing</span>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Operational
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <ShieldCheckIcon className="h-5 w-5 text-gray-400 mr-3" />
                <span className="text-sm font-medium text-gray-900">Fraud Detection</span>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Active
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}