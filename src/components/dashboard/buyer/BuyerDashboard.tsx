import { useState } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { 
  CurrencyDollarIcon, 
  PhoneIcon, 
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline'

interface BuyerStats {
  totalSpent: number
  spentTrend: number
  totalLeads: number
  leadsTrend: number
  activeCampaigns: number
  campaignsTrend: number
  conversionRate: number
  conversionTrend: number
  averageCallDuration: number
  durationTrend: number
  qualityScore: number
  qualityTrend: number
}

function StatCard({
  title,
  value,
  trend,
  icon: Icon,
  format = 'number',
}: {
  title: string
  value: number | string
  trend: number
  icon: React.ComponentType<{ className?: string }>
  format?: 'number' | 'currency' | 'percentage' | 'duration'
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
      case 'duration': {
        const minutes = Math.floor(val / 60)
        const seconds = val % 60
        return `${minutes}:${seconds.toString().padStart(2, '0')}`
      }
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

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Icon className="h-8 w-8 text-primary-600" />
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

export function BuyerDashboard() {
  const { user } = useAuth()
  const [selectedTimeRange, setSelectedTimeRange] = useState<'24h' | '7d' | '30d'>('7d')

  if (!user || user.user_metadata?.userType !== 'buyer') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Access denied. Buyer account required.</p>
      </div>
    )
  }

  // Mock data - in real app, this would come from API
  const stats: BuyerStats = {
    totalSpent: 45678,
    spentTrend: 12.5,
    totalLeads: 234,
    leadsTrend: 8.3,
    activeCampaigns: 5,
    campaignsTrend: 0,
    conversionRate: 32.5,
    conversionTrend: -2.1,
    averageCallDuration: 245, // seconds
    durationTrend: 5.7,
    qualityScore: 92,
    qualityTrend: 3.2,
  }

  return (
    <div data-testid="buyer-dashboard" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Buyer Dashboard</h1>
          <p className="text-gray-600">Monitor your campaigns and lead quality</p>
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
          title="Total Spent"
          value={stats.totalSpent}
          trend={stats.spentTrend}
          icon={CurrencyDollarIcon}
          format="currency"
        />
        <StatCard
          title="Total Leads"
          value={stats.totalLeads}
          trend={stats.leadsTrend}
          icon={PhoneIcon}
        />
        <StatCard
          title="Active Campaigns"
          value={stats.activeCampaigns}
          trend={stats.campaignsTrend}
          icon={ChartBarIcon}
        />
        <StatCard
          title="Conversion Rate"
          value={stats.conversionRate}
          trend={stats.conversionTrend}
          icon={ArrowTrendingUpIcon}
          format="percentage"
        />
        <StatCard
          title="Avg Call Duration"
          value={stats.averageCallDuration}
          trend={stats.durationTrend}
          icon={ClockIcon}
          format="duration"
        />
        <StatCard
          title="Quality Score"
          value={stats.qualityScore}
          trend={stats.qualityTrend}
          icon={UserGroupIcon}
        />
      </div>

      {/* Campaign Performance Table */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Campaign Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Campaign
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Leads
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CPL
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Conversion
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* Mock campaign data */}
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  Home Insurance - National
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    Active
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">87</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">$3,480</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">$40.00</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">35.2%</td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  Auto Loans - CA Only
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    Active
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">62</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">$2,170</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">$35.00</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">28.9%</td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  Solar Installation
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                    Paused
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">45</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">$2,700</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">$60.00</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">22.5%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Leads */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Recent Leads</h2>
        </div>
        <ul className="divide-y divide-gray-200">
          <li className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <PhoneIcon className="h-8 w-8 text-gray-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">+1 (555) 123-4567</p>
                  <p className="text-sm text-gray-500">Campaign: Home Insurance - National</p>
                  <p className="text-sm text-gray-500">Duration: 4:32 | Quality Score: 95</p>
                </div>
              </div>
              <div className="text-sm text-gray-500">2 minutes ago</div>
            </div>
          </li>
          <li className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <PhoneIcon className="h-8 w-8 text-gray-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">+1 (555) 987-6543</p>
                  <p className="text-sm text-gray-500">Campaign: Auto Loans - CA Only</p>
                  <p className="text-sm text-gray-500">Duration: 3:15 | Quality Score: 88</p>
                </div>
              </div>
              <div className="text-sm text-gray-500">15 minutes ago</div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  )
}