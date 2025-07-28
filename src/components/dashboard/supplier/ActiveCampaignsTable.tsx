import { useQuery } from '@tanstack/react-query'
import { PlayIcon, PauseIcon, EyeIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import { from } from '../../../lib/supabase-optimized'

interface ActiveCampaignsTableProps {
  supplierId: string
}

interface Campaign {
  id: string
  name: string
  buyer_name: string
  status: 'active' | 'paused' | 'completed'
  bid_amount: number
  daily_cap: number
  calls_today: number
  revenue_today: number
  conversion_rate: number
  quality_score: number
  created_at: string
}

async function fetchActiveCampaigns(supplierId: string): Promise<Campaign[]> {
  const { data, error } = await from('campaigns')
    .select('*')
    .eq('supplier_id', supplierId)
    .in('status', ['active', 'paused'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching campaigns:', error)
    return []
  }

  // Map database fields to Campaign interface
  return (data || []).map(campaign => ({
    id: campaign.id,
    name: campaign.name,
    buyer_name: 'Unknown', // This field doesn't exist in campaigns table, would need a join
    status: campaign.status as Campaign['status'],
    bid_amount: campaign.bid_floor,
    daily_cap: campaign.daily_cap || 0,
    quality_score: campaign.quality_threshold || 0,
    calls_today: 0, // Would need to be calculated from calls table
    revenue_today: 0, // Would need to be calculated
    conversion_rate: 0, // Would need to be calculated
    created_at: campaign.created_at || new Date().toISOString()
  }))
}

function CampaignStatusBadge({ status }: { status: Campaign['status'] }) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return {
          className: 'bg-green-100 text-green-800',
          text: 'Active',
          icon: '🟢',
        }
      case 'paused':
        return {
          className: 'bg-yellow-100 text-yellow-800',
          text: 'Paused',
          icon: '⏸️',
        }
      case 'completed':
        return {
          className: 'bg-gray-100 text-gray-800',
          text: 'Completed',
          icon: '✅',
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

function ProgressBar({ current, max, label }: { current: number; max: number; label: string }) {
  const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0
  const isNearLimit = percentage >= 90

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>{label}</span>
        <span>
          {current}/{max}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            isNearLimit ? 'bg-red-500' : 'bg-primary-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

export function ActiveCampaignsTable({ supplierId }: ActiveCampaignsTableProps) {
  const {
    data: campaigns,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['active-campaigns', supplierId],
    queryFn: () => fetchActiveCampaigns(supplierId),
    refetchInterval: 60000, // Refresh every minute
  })

  const handleToggleCampaign = async (campaignId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'

    try {
      const { error } = await from('campaigns')
        .update({ status: newStatus })
        .eq('id', campaignId)

      if (error) {
        console.error('Error updating campaign status:', error)
        // In a real app, you'd show a toast notification here
      }
    } catch (err) {
      console.error('Error toggling campaign:', err)
    }
  }

  const handleViewDetails = (campaignId: string) => {
    // In a real implementation, this would navigate to campaign details
    console.log('Viewing campaign details:', campaignId)
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Campaigns</h3>
          <div className="text-center py-8 text-red-500">
            <p>Error loading campaigns. Please try again.</p>
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
          <h3 className="text-lg font-semibold text-gray-900">Active Campaigns</h3>
          {isLoading && (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {isLoading ? (
          // Loading skeleton
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                </div>
              ))}
            </div>
          </div>
        ) : campaigns?.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <ChartBarIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No active campaigns found.</p>
            <p className="text-sm mt-1">Join campaigns to start receiving calls.</p>
          </div>
        ) : (
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
                  Bid
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Today's Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Performance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {campaigns?.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{campaign.name}</div>
                      <div className="text-sm text-gray-500">{campaign.buyer_name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <CampaignStatusBadge status={campaign.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${campaign.bid_amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="w-32">
                      <ProgressBar
                        current={campaign.calls_today}
                        max={campaign.daily_cap}
                        label="Calls"
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      <div className="flex items-center justify-between mb-1">
                        <span>Revenue:</span>
                        <span className="font-medium text-green-600">
                          ${campaign.revenue_today.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-1">
                        <span>Conv. Rate:</span>
                        <span className="font-medium">{campaign.conversion_rate.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Quality:</span>
                        <span className="font-medium">{campaign.quality_score}/100</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleToggleCampaign(campaign.id, campaign.status)}
                      className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-medium ${
                        campaign.status === 'active'
                          ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                          : 'bg-green-100 text-green-800 hover:bg-green-200'
                      }`}
                    >
                      {campaign.status === 'active' ? (
                        <>
                          <PauseIcon className="h-3 w-3 mr-1" />
                          Pause
                        </>
                      ) : (
                        <>
                          <PlayIcon className="h-3 w-3 mr-1" />
                          Resume
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleViewDetails(campaign.id)}
                      className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-primary-100 text-primary-800 hover:bg-primary-200"
                    >
                      <EyeIcon className="h-3 w-3 mr-1" />
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
