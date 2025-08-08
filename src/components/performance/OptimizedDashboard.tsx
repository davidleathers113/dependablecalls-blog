/**
 * Optimized dashboard components with React 19.1 performance features
 * Uses memoization, virtual scrolling, and efficient state management
 */

import React, { memo, useMemo, useCallback, startTransition } from 'react'
import { ChartBarIcon, PhoneIcon, CurrencyDollarIcon, ClockIcon } from '@heroicons/react/24/outline'
import { VirtualScroller } from './VirtualScroller'
// import { LazyImage } from './LazyImage' // Available but not used in current implementation
import { usePerformanceTracking } from '../../lib/performance-monitor'

// Types
interface DashboardData {
  totalCalls: number
  revenue: number
  activeSuppliers: number
  avgCallDuration: number
  recentCalls: CallRecord[]
  callsByHour: { hour: number; count: number }[]
  topSuppliers: { name: string; calls: number; revenue: number }[]
}

interface CallRecord {
  id: string
  supplier: string
  duration: number
  revenue: number
  timestamp: Date
  status: 'completed' | 'ongoing' | 'failed'
}

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  change?: number
  className?: string
}

// Memoized stat card component
const StatCard = memo<StatCardProps>(({ title, value, icon: Icon, change, className = '' }) => {
  const changeColor = useMemo(() => {
    if (!change) return 'text-gray-500'
    return change > 0 ? 'text-green-600' : 'text-red-600'
  }, [change])
  
  const changePrefix = useMemo(() => {
    if (!change) return ''
    return change > 0 ? '+' : ''
  }, [change])

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <Icon className="h-8 w-8 text-gray-400" />
        </div>
        <div className="ml-5 w-0 flex-1">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
            <dd className="flex items-baseline">
              <div className="text-2xl font-semibold text-gray-900">
                {typeof value === 'number' ? value.toLocaleString() : value}
              </div>
              {change !== undefined && (
                <div className={`ml-2 flex items-baseline text-sm font-semibold ${changeColor}`}>
                  {changePrefix}{Math.abs(change)}%
                </div>
              )}
            </dd>
          </dl>
        </div>
      </div>
    </div>
  )
})

StatCard.displayName = 'StatCard'

// Memoized call item for virtual scrolling
const CallItem = memo<{ call: CallRecord; index: number; isVisible: boolean }>(({ call, isVisible }) => {
  // Only render expensive content when visible
  const statusColor = useMemo(() => {
    switch (call.status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'ongoing': return 'bg-blue-100 text-blue-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }, [call.status])

  const formattedDuration = useMemo(() => {
    if (!isVisible) return ''
    const minutes = Math.floor(call.duration / 60)
    const seconds = call.duration % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }, [call.duration, isVisible])

  const formattedRevenue = useMemo(() => {
    if (!isVisible) return ''
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(call.revenue)
  }, [call.revenue, isVisible])

  return (
    <div className="flex items-center justify-between py-4 px-6 border-b border-gray-200 hover:bg-gray-50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <PhoneIcon className="h-5 w-5 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {call.supplier}
            </p>
            <p className="text-sm text-gray-500">
              {isVisible ? new Intl.RelativeTimeFormat().format(
                Math.floor((call.timestamp.getTime() - Date.now()) / 1000 / 60),
                'minute'
              ) : ''}
            </p>
          </div>
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">{formattedRevenue}</p>
          <p className="text-sm text-gray-500">{formattedDuration}</p>
        </div>
        
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
          {call.status}
        </span>
      </div>
    </div>
  )
})

CallItem.displayName = 'CallItem'

// Chart component with canvas optimization
const HourlyCallsChart = memo<{ data: { hour: number; count: number }[] }>(({ data }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  
  // Draw chart using Canvas API for better performance
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || data.length === 0) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    
    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height)
    
    // Draw chart
    const maxCalls = Math.max(...data.map(d => d.count))
    const barWidth = rect.width / data.length
    const barMaxHeight = rect.height - 40
    
    ctx.fillStyle = '#3B82F6'
    
    data.forEach((item, index) => {
      const barHeight = (item.count / maxCalls) * barMaxHeight
      const x = index * barWidth + 10
      const y = rect.height - barHeight - 20
      
      ctx.fillRect(x, y, barWidth - 20, barHeight)
      
      // Draw labels
      ctx.fillStyle = '#6B7280'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(
        `${item.hour}:00`,
        x + (barWidth - 20) / 2,
        rect.height - 5
      )
      
      ctx.fillStyle = '#3B82F6'
    })
  }, [data])
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Calls by Hour</h3>
      <canvas
        ref={canvasRef}
        className="w-full h-64"
        style={{ width: '100%', height: '256px' }}
      />
    </div>
  )
})

HourlyCallsChart.displayName = 'HourlyCallsChart'

// Main optimized dashboard component
export interface OptimizedDashboardProps {
  data: DashboardData
  onRefresh?: () => void
  loading?: boolean
}

export const OptimizedDashboard = memo<OptimizedDashboardProps>(({
  data,
  onRefresh,
  loading = false
}) => {
  usePerformanceTracking('OptimizedDashboard')
  
  // Memoized stat calculations
  const stats = useMemo(() => [
    {
      title: 'Total Calls',
      value: data.totalCalls,
      icon: PhoneIcon,
      change: 12.5
    },
    {
      title: 'Revenue',
      value: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0
      }).format(data.revenue),
      icon: CurrencyDollarIcon,
      change: 8.2
    },
    {
      title: 'Active Suppliers',
      value: data.activeSuppliers,
      icon: ChartBarIcon,
      change: -2.1
    },
    {
      title: 'Avg Duration',
      value: `${Math.floor(data.avgCallDuration / 60)}:${(data.avgCallDuration % 60).toString().padStart(2, '0')}`,
      icon: ClockIcon,
      change: 5.7
    }
  ], [data.totalCalls, data.revenue, data.activeSuppliers, data.avgCallDuration])
  
  // Optimized refresh handler with transition
  const handleRefresh = useCallback(() => {
    startTransition(() => {
      onRefresh?.()
    })
  }, [onRefresh])
  
  // Virtual scrolling render function
  const renderCallItem = useCallback((call: CallRecord, index: number, isVisible: boolean) => (
    <CallItem key={call.id} call={call} index={index} isVisible={isVisible} />
  ), [])
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {stats.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>

        {/* Charts and Tables Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Hourly Calls Chart */}
          <HourlyCallsChart data={data.callsByHour} />
          
          {/* Top Suppliers */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Top Suppliers</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {data.topSuppliers.map((supplier, index) => (
                <div key={supplier.name} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-500 w-8">
                      {index + 1}
                    </span>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">{supplier.name}</p>
                      <p className="text-sm text-gray-500">{supplier.calls} calls</p>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD'
                    }).format(supplier.revenue)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Calls - Virtual Scrolling */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Calls</h3>
          </div>
          <VirtualScroller
            items={data.recentCalls}
            itemHeight={76}
            containerHeight={400}
            renderItem={renderCallItem}
            className="border-t border-gray-200"
          />
        </div>
      </div>
    </div>
  )
})

OptimizedDashboard.displayName = 'OptimizedDashboard'

export default OptimizedDashboard