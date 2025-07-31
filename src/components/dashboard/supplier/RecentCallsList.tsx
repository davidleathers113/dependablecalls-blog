import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  PhoneIcon,
  PlayIcon,
  EyeIcon,
  ClockIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline'
import { MockDataService } from '../../../lib/mock-data-service'

interface RecentCallsListProps {
  supplierId: string
}

interface CallRecord {
  id: string
  created_at: string
  caller_number: string
  duration: number
  status: 'active' | 'completed' | 'failed'
  buyer_name: string
  campaign_name: string
  payout: number
  quality_score?: number
}

async function fetchRecentCalls(supplierId: string): Promise<CallRecord[]> {
  MockDataService.logMockUsage('RecentCallsList', 'fetchRecentCalls')
  return await MockDataService.getRecentCalls(supplierId)
}


function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

function formatPhoneNumber(phoneNumber: string): string {
  // Basic phone number formatting for US numbers
  const cleaned = phoneNumber.includes('***') ? phoneNumber : phoneNumber.replace(/\D/g, '')
  if (phoneNumber.includes('***')) {
    return phoneNumber // Already masked
  }
  if (cleaned.length === 10) {
    return `***-***-${cleaned.slice(-4)}`
  }
  return `***-***-${cleaned.slice(-4) || '****'}`
}

function CallStatusBadge({ status }: { status: CallRecord['status'] }) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return {
          className: 'bg-green-100 text-green-800',
          text: 'Active',
          icon: '🟢',
        }
      case 'completed':
        return {
          className: 'bg-blue-100 text-blue-800',
          text: 'Completed',
          icon: '✅',
        }
      case 'failed':
        return {
          className: 'bg-red-100 text-red-800',
          text: 'Failed',
          icon: '❌',
        }
      default:
        return {
          className: 'bg-gray-100 text-gray-800',
          text: 'Unknown',
          icon: '❓',
        }
    }
  }

  const config = getStatusConfig(status)

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      <span className="mr-1">{config.icon}</span>
      {config.text}
    </span>
  )
}

function CallRow({ call }: { call: CallRecord }) {
  const [showDetails, setShowDetails] = useState(false)

  const handlePlayRecording = () => {
    // In a real implementation, this would open an audio player modal
    console.log('Playing recording for call:', call.id)
    // Could integrate with a service like Twilio for call recordings
  }

  const handleViewDetails = () => {
    setShowDetails(!showDetails)
  }

  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <div className="p-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1">
            {/* Call Status */}
            <div className="flex-shrink-0">
              <PhoneIcon className="h-5 w-5 text-gray-400" />
            </div>

            {/* Call Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {formatPhoneNumber(call.caller_number)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(call.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  {/* Duration */}
                  <div className="flex items-center text-sm text-gray-600">
                    <ClockIcon className="h-4 w-4 mr-1" />
                    {formatDuration(call.duration)}
                  </div>

                  {/* Payout */}
                  <div className="flex items-center text-sm text-green-600 font-medium">
                    <CurrencyDollarIcon className="h-4 w-4 mr-1" />
                    {call.payout.toFixed(2)}
                  </div>

                  {/* Status */}
                  <CallStatusBadge status={call.status} />
                </div>
              </div>

              <div className="mt-1 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{call.buyer_name}</span>
                  <span className="mx-2">•</span>
                  <span>{call.campaign_name}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2 ml-4">
            {call.status === 'completed' && (
              <button
                onClick={handlePlayRecording}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Play Recording"
              >
                <PlayIcon className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={handleViewDetails}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="View Details"
            >
              <EyeIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Expanded Details */}
        {showDetails && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Call ID:</span>
                <span className="ml-2 font-mono">{call.id.slice(0, 8)}...</span>
              </div>
              {call.quality_score && (
                <div>
                  <span className="text-gray-500">Quality Score:</span>
                  <span className="ml-2 font-medium">{call.quality_score}/100</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function RecentCallsList({ supplierId }: RecentCallsListProps) {
  const [loadingMore, setLoadingMore] = useState(false)

  const {
    data: calls,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['recent-calls', supplierId],
    queryFn: () => fetchRecentCalls(supplierId),
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Use the calls from the query
  const displayCalls = calls || []

  const handleLoadMore = async () => {
    setLoadingMore(true)
    try {
      // In a real implementation, this would fetch more calls with pagination
      await refetch()
    } finally {
      setLoadingMore(false)
    }
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Calls</h3>
          <div className="text-center py-8 text-red-500">
            <p>Error loading calls. Please try again.</p>
            <button
              onClick={() => refetch()}
              className="mt-2 text-primary-600 hover:text-primary-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Recent Calls</h3>
          {isLoading && (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
          )}
        </div>
      </div>

      {/* Calls List */}
      <div className="divide-y divide-gray-200">
        {isLoading && !calls ? (
          // Loading skeleton
          <div className="p-4 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center space-x-4">
                  <div className="h-5 w-5 bg-gray-200 rounded"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                  </div>
                  <div className="h-6 w-16 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : displayCalls.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <PhoneIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No recent calls found.</p>
            <p className="text-sm mt-1">Calls will appear here once you start receiving traffic.</p>
          </div>
        ) : (
          <>
            {displayCalls.map((call) => (
              <CallRow key={call.id} call={call} />
            ))}

            {/* Load More Button */}
            {displayCalls.length >= 10 && (
              <div className="p-4 text-center border-t border-gray-200">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="text-primary-600 hover:text-primary-700 font-medium text-sm disabled:opacity-50"
                >
                  {loadingMore ? 'Loading...' : 'Load More Calls'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
