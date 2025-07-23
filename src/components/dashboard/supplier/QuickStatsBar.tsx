import { useQuery } from '@tanstack/react-query'
import { PhoneIcon, CurrencyDollarIcon, ChartBarIcon, StarIcon } from '@heroicons/react/24/outline'
import { supabase } from '../../../lib/supabase'
import { useRealTimeStats } from '../../../hooks/useRealTimeStats'

interface QuickStatsBarProps {
  timeRange: '24h' | '7d' | '30d'
  supplierId: string
}

interface DashboardStats {
  totalCalls: number
  callsTrend: number
  revenue: number
  revenueTrend: number
  conversionRate: number
  conversionTrend: number
  qualityScore: number
  qualityTrend: number
}

async function fetchSupplierStats(supplierId: string, timeRange: string): Promise<DashboardStats> {
  const hoursBack = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720
  const now = new Date()
  const startTime = new Date(now.getTime() - hoursBack * 60 * 60 * 1000)

  // Fetch current period stats
  const { data: currentStats, error } = await supabase
    .from('supplier_stats_view')
    .select('*')
    .eq('supplier_id', supplierId)
    .gte('created_at', startTime.toISOString())
    .single()

  if (error) {
    console.error('Error fetching supplier stats:', error)
    // Return default stats if query fails
    return {
      totalCalls: 0,
      callsTrend: 0,
      revenue: 0,
      revenueTrend: 0,
      conversionRate: 0,
      conversionTrend: 0,
      qualityScore: 85,
      qualityTrend: 0,
    }
  }

  // Calculate previous period for trend comparison
  const prevStartTime = new Date(startTime.getTime() - hoursBack * 60 * 60 * 1000)
  const { data: prevStats } = await supabase
    .from('supplier_stats_view')
    .select('*')
    .eq('supplier_id', supplierId)
    .gte('created_at', prevStartTime.toISOString())
    .lt('created_at', startTime.toISOString())
    .single()

  const calculateTrend = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  return {
    totalCalls: currentStats?.total_calls || 0,
    callsTrend: calculateTrend(currentStats?.total_calls || 0, prevStats?.total_calls || 0),
    revenue: currentStats?.total_revenue || 0,
    revenueTrend: calculateTrend(currentStats?.total_revenue || 0, prevStats?.total_revenue || 0),
    conversionRate: currentStats?.conversion_rate || 0,
    conversionTrend: calculateTrend(
      currentStats?.conversion_rate || 0,
      prevStats?.conversion_rate || 0
    ),
    qualityScore: currentStats?.quality_score || 85,
    qualityTrend: calculateTrend(currentStats?.quality_score || 85, prevStats?.quality_score || 85),
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
        title="Revenue Today"
        value={displayStats?.revenue || 0}
        trend={displayStats?.revenueTrend || 0}
        icon={CurrencyDollarIcon}
        format="currency"
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
