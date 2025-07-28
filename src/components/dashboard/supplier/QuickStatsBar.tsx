import { useQuery } from '@tanstack/react-query'
import { PhoneIcon, CurrencyDollarIcon, ChartBarIcon, StarIcon } from '@heroicons/react/24/outline'
import { from } from '../../../lib/supabase-optimized'
import { useRealTimeStats } from '../../../hooks/useRealTimeStats'

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
  // For demo purposes, we'll calculate stats from the calls table
  console.log('Fetching stats for time range:', timeRange)

  // Calculate date range based on timeRange parameter
  const now = new Date()
  const startDate = new Date()
  switch (timeRange) {
    case '24h':
      startDate.setDate(now.getDate() - 1)
      break
    case '7d':
      startDate.setDate(now.getDate() - 7)
      break
    case '30d':
      startDate.setDate(now.getDate() - 30)
      break
  }

  // Fetch calls for the supplier in the time range
  const { data: calls, error } = await from('calls')
    .select('*')
    .eq('campaign_id', supplierId) // Using campaign_id as a proxy for supplier
    .gte('created_at', startDate.toISOString())
    .lte('created_at', now.toISOString())

  if (error || !calls) {
    console.error('Error fetching supplier stats:', error)
    // Return default stats if query fails
    return {
      totalCalls: 0,
      callsTrend: 0,
      totalMinutes: 0,
      minutesTrend: 0,
      conversionRate: 0,
      conversionTrend: 0,
      qualityScore: 85,
      qualityTrend: 0,
    }
  }

  // Calculate stats from calls data
  const totalCalls = calls.length
  const totalMinutes = calls.reduce((sum, call) => sum + (call.duration_seconds || 0) / 60, 0)
  const completedCalls = calls.filter(call => call.status === 'completed').length
  const conversionRate = totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0
  const qualityScore = calls.reduce((sum, call) => sum + (call.quality_score || 85), 0) / (calls.length || 1)

  // For trends, we'd need to fetch previous period data
  // For now, returning static trends
  return {
    totalCalls,
    callsTrend: 5.2,
    totalMinutes: Math.round(totalMinutes),
    minutesTrend: 3.8,
    conversionRate: Math.round(conversionRate * 10) / 10,
    conversionTrend: 2.1,
    qualityScore: Math.round(qualityScore),
    qualityTrend: 1.5,
  }
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

  // Use real-time updates for live stats
  const liveStats = useRealTimeStats(supplierId)

  // Merge real-time data with cached data
  const displayStats = liveStats ? { ...stats, ...liveStats } : stats

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
