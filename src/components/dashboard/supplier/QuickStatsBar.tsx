import { useQuery } from '@tanstack/react-query'
import { PhoneIcon, CurrencyDollarIcon, ChartBarIcon, StarIcon } from '@heroicons/react/24/outline'
import { MockDataService } from '../../../lib/mock-data-service'

interface QuickStatsBarProps {
  timeRange: '24h' | '7d' | '30d'
  supplierId: string
}

interface DashboardStats {
  totalCalls: number
  callsTrend: number
  totalMinutes: number
  minutesTrend: number
  conversionRate: number
  conversionTrend: number
  qualityScore: number
  qualityTrend: number
}

async function fetchSupplierStats(supplierId: string, timeRange: string): Promise<DashboardStats> {
  MockDataService.logMockUsage('QuickStatsBar', 'fetchSupplierStats')
  return await MockDataService.getSupplierStats(supplierId, timeRange)
}

function StatCard({
  title,
  value,
  trend,
  icon: Icon,
  format = 'number',
  loading = false,
}: {
  title: string
  value: number
  trend: number
  icon: React.ComponentType<{ className?: string }>
  format?: 'number' | 'currency' | 'percentage'
  loading?: boolean
}) {
  const formatValue = (val: number) => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(val)
      case 'percentage':
        return `${val.toFixed(1)}%`
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

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    )
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

export function QuickStatsBar({ timeRange, supplierId }: QuickStatsBarProps) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['supplier-stats', supplierId, timeRange],
    queryFn: () => fetchSupplierStats(supplierId, timeRange),
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Use the stats from the query
  const displayStats = stats

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        title="Today's Calls"
        value={displayStats?.totalCalls || 0}
        trend={displayStats?.callsTrend || 0}
        icon={PhoneIcon}
        loading={isLoading}
      />
      <StatCard
        title="Total Minutes"
        value={displayStats?.totalMinutes || 0}
        trend={displayStats?.minutesTrend || 0}
        icon={CurrencyDollarIcon}
        loading={isLoading}
      />
      <StatCard
        title="Conversion Rate"
        value={displayStats?.conversionRate || 0}
        trend={displayStats?.conversionTrend || 0}
        icon={ChartBarIcon}
        format="percentage"
        loading={isLoading}
      />
      <StatCard
        title="Quality Score"
        value={displayStats?.qualityScore || 85}
        trend={displayStats?.qualityTrend || 0}
        icon={StarIcon}
        loading={isLoading}
      />
    </div>
  )
}
