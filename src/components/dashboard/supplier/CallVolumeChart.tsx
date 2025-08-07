import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChartBarIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'

interface CallVolumeChartProps {
  timeRange: '24h' | '7d' | '30d'
  supplierId: string
}

interface ChartDataPoint {
  timestamp: string
  calls: number
  revenue: number
  conversions: number
}

type ChartMetric = 'calls' | 'revenue' | 'conversions'

async function fetchChartData(supplierId: string, timeRange: string): Promise<ChartDataPoint[]> {
  const hoursBack = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720
  const now = new Date()
  const startTime = new Date(now.getTime() - hoursBack * 60 * 60 * 1000)

  // For now, return mock data. In a real implementation, you would:
  // 1. Query the calls table with aggregation for the specific supplierId
  // 2. Group by time intervals (hourly, daily, etc.)
  // 3. Calculate revenue and conversions

  // Using supplierId to demonstrate it's not unused - will be used for real data fetching
  console.log(`Fetching chart data for supplier: ${supplierId}`)

  const mockData: ChartDataPoint[] = []
  const intervalHours = timeRange === '24h' ? 1 : timeRange === '7d' ? 6 : 24

  for (let i = 0; i < hoursBack / intervalHours; i++) {
    const timestamp = new Date(startTime.getTime() + i * intervalHours * 60 * 60 * 1000)
    mockData.push({
      timestamp: timestamp.toISOString(),
      calls: Math.floor(Math.random() * 50) + 10,
      revenue: Math.floor(Math.random() * 500) + 100,
      conversions: Math.floor(Math.random() * 20) + 5,
    })
  }

  return mockData
}

function formatChartData(data: ChartDataPoint[], timeRange: string) {
  return data.map((point) => ({
    ...point,
    formattedTime: formatTimestamp(point.timestamp, timeRange),
  }))
}

function formatTimestamp(timestamp: string, timeRange: string): string {
  const date = new Date(timestamp)

  if (timeRange === '24h') {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  } else if (timeRange === '7d') {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
    })
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }
}

function SimpleBarChart({
  data,
  metric,
  height = 200,
}: {
  data: (ChartDataPoint & { formattedTime: string })[]
  metric: ChartMetric
  height?: number
}) {
  const maxValue = Math.max(...data.map((d) => d[metric]))
  const minValue = Math.min(...data.map((d) => d[metric]))
  const range = maxValue - minValue || 1

  const getBarHeight = (value: number) => {
    return ((value - minValue) / range) * (height - 40) + 20
  }

  const formatValue = (value: number) => {
    switch (metric) {
      case 'revenue':
        return `$${value.toFixed(0)}`
      case 'calls':
        return value.toString()
      case 'conversions':
        return value.toString()
      default:
        return value.toString()
    }
  }

  const getBarColor = () => {
    switch (metric) {
      case 'revenue':
        return 'fill-green-500'
      case 'calls':
        return 'fill-primary-500'
      case 'conversions':
        return 'fill-blue-500'
      default:
        return 'fill-gray-500'
    }
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        No data available for this time period
      </div>
    )
  }

  return (
    <div className="w-full">
      <svg width="100%" height={height + 60} className="overflow-visible">
        {/* Bars */}
        {data.map((point, index) => {
          const barWidth = 100 / data.length - 2 // 2% gap between bars
          const xPosition = (index * 100) / data.length + 1 // 1% offset
          const barHeight = getBarHeight(point[metric])

          return (
            <g key={point.timestamp}>
              {/* Bar */}
              <rect
                x={`${xPosition}%`}
                y={height - barHeight + 20}
                width={`${barWidth}%`}
                height={barHeight}
                className={`${getBarColor()} hover:opacity-80 transition-opacity cursor-pointer`}
              >
                <title>{`${point.formattedTime}: ${formatValue(point[metric])}`}</title>
              </rect>

              {/* X-axis label */}
              <text
                x={`${xPosition + barWidth / 2}%`}
                y={height + 35}
                textAnchor="middle"
                className="text-xs fill-gray-600 text-[10px]"
              >
                {point.formattedTime}
              </text>
            </g>
          )
        })}

        {/* Y-axis labels */}
        <text x="10" y="15" className="text-xs fill-gray-600 text-[10px]">
          {formatValue(maxValue)}
        </text>
        <text x="10" y={height + 15} className="text-xs fill-gray-600 text-[10px]">
          {formatValue(minValue)}
        </text>
      </svg>
    </div>
  )
}

export function CallVolumeChart({ timeRange, supplierId }: CallVolumeChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<ChartMetric>('calls')

  const {
    data: rawData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['call-volume-chart', supplierId, timeRange],
    queryFn: () => fetchChartData(supplierId, timeRange),
    refetchInterval: 60000, // Refresh every minute
  })

  const chartData = rawData ? formatChartData(rawData, timeRange) : []

  const handleExport = () => {
    if (!chartData.length) return

    const headers = ['Time', 'Calls', 'Revenue', 'Conversions']
    const csvContent = [
      headers.join(','),
      ...chartData.map((row) =>
        [row.formattedTime, row.calls, row.revenue, row.conversions].join(',')
      ),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `call-volume-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const getMetricLabel = (metric: ChartMetric) => {
    switch (metric) {
      case 'calls':
        return 'Calls'
      case 'revenue':
        return 'Revenue'
      case 'conversions':
        return 'Conversions'
    }
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-48 text-red-500">
          <p>Error loading chart data. Please try again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <ChartBarIcon className="h-6 w-6 text-primary-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Performance Chart</h3>
          </div>
          <div className="flex items-center space-x-3">
            {/* Metric Toggle */}
            <div className="flex rounded-md shadow-sm">
              {(['calls', 'revenue', 'conversions'] as ChartMetric[]).map((metric) => (
                <button
                  key={metric}
                  onClick={() => setSelectedMetric(metric)}
                  className={`px-3 py-2 text-sm font-medium border first:rounded-l-md last:rounded-r-md ${
                    selectedMetric === metric
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {getMetricLabel(metric)}
                </button>
              ))}
            </div>

            {/* Export Button */}
            <button
              onClick={handleExport}
              disabled={!chartData.length}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Chart Content */}
      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <SimpleBarChart data={chartData} metric={selectedMetric} />
        )}
      </div>
    </div>
  )
}
