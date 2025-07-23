import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import {
  PlusIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  EllipsisVerticalIcon,
  PlayIcon,
  PauseIcon,
  PencilSquareIcon,
  DocumentDuplicateIcon,
  ChartBarIcon,
  EyeIcon,
  PhoneIcon,
  CurrencyDollarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

// Mock data - In real app, this would come from API/database
interface Campaign {
  id: string
  name: string
  status: 'active' | 'paused' | 'draft' | 'archived'
  type: 'supplier' | 'buyer'
  calls_today: number
  calls_this_month: number
  conversion_rate: number
  revenue_today: number
  revenue_this_month: number
  quality_score: number
  created_at: string
  updated_at: string
  tracking_numbers: string[]
  budget_remaining?: number
  daily_budget?: number
}

const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: '1',
    name: 'Home Insurance Leads - Northeast',
    status: 'active',
    type: 'supplier',
    calls_today: 47,
    calls_this_month: 1234,
    conversion_rate: 78.5,
    revenue_today: 1880,
    revenue_this_month: 49360,
    quality_score: 92,
    created_at: '2024-01-15',
    updated_at: '2024-01-22',
    tracking_numbers: ['+1-555-0123', '+1-555-0124'],
  },
  {
    id: '2',
    name: 'Auto Insurance - California',
    status: 'active',
    type: 'buyer',
    calls_today: 23,
    calls_this_month: 567,
    conversion_rate: 65.2,
    revenue_today: 0,
    revenue_this_month: 0,
    quality_score: 89,
    budget_remaining: 2340,
    daily_budget: 500,
    created_at: '2024-01-10',
    updated_at: '2024-01-22',
    tracking_numbers: ['+1-555-0125'],
  },
  {
    id: '3',
    name: 'Solar Panel Leads - Texas',
    status: 'paused',
    type: 'supplier',
    calls_today: 0,
    calls_this_month: 234,
    conversion_rate: 82.1,
    revenue_today: 0,
    revenue_this_month: 9360,
    quality_score: 94,
    created_at: '2024-01-08',
    updated_at: '2024-01-20',
    tracking_numbers: ['+1-555-0126', '+1-555-0127', '+1-555-0128'],
  },
]

type CampaignFilter = 'all' | 'active' | 'paused' | 'draft' | 'archived'
type CampaignSort = 'name' | 'created_at' | 'calls_today' | 'revenue_today' | 'quality_score'

export default function CampaignsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [campaigns] = useState<Campaign[]>(MOCK_CAMPAIGNS)
  const [filteredCampaigns, setFilteredCampaigns] = useState<Campaign[]>(campaigns)
  const [selectedFilter, setSelectedFilter] = useState<CampaignFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<CampaignSort>('created_at')
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)

  // Filter and search campaigns
  useEffect(() => {
    let filtered = campaigns

    // Apply status filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter((campaign) => campaign.status === selectedFilter)
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (campaign) =>
          campaign.name.toLowerCase().includes(query) ||
          campaign.tracking_numbers.some((number) => number.includes(query))
      )
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'created_at':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'calls_today':
          return b.calls_today - a.calls_today
        case 'revenue_today':
          return b.revenue_today - a.revenue_today
        case 'quality_score':
          return b.quality_score - a.quality_score
        default:
          return 0
      }
    })

    setFilteredCampaigns(filtered)
  }, [campaigns, selectedFilter, searchQuery, sortBy])

  const handleCampaignAction = async (action: string, campaignId: string) => {
    try {
      switch (action) {
        case 'pause':
          console.log('Pausing campaign:', campaignId)
          // await campaignService.pauseCampaign(campaignId)
          break
        case 'resume':
          console.log('Resuming campaign:', campaignId)
          // await campaignService.resumeCampaign(campaignId)
          break
        case 'duplicate':
          console.log('Duplicating campaign:', campaignId)
          // await campaignService.duplicateCampaign(campaignId)
          break
        case 'delete':
          console.log('Deleting campaign:', campaignId)
          // await campaignService.deleteCampaign(campaignId)
          break
      }
    } catch (error) {
      console.error('Campaign action failed:', error)
    }
  }

  const getStatusBadge = (status: Campaign['status']) => {
    const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium'

    switch (status) {
      case 'active':
        return `${baseClasses} bg-green-100 text-green-800`
      case 'paused':
        return `${baseClasses} bg-yellow-100 text-yellow-800`
      case 'draft':
        return `${baseClasses} bg-gray-100 text-gray-800`
      case 'archived':
        return `${baseClasses} bg-red-100 text-red-800`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`
    }
  }

  const getStatusIcon = (status: Campaign['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />
      case 'paused':
        return <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
      case 'draft':
        return <ClockIcon className="h-4 w-4 text-gray-500" />
      case 'archived':
        return <XCircleIcon className="h-4 w-4 text-red-500" />
      default:
        return <ClockIcon className="h-4 w-4 text-gray-500" />
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(dateString))
  }

  const userRole = user?.user_metadata?.role || 'supplier'

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="md:flex md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl">
              Campaign Management
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {userRole === 'supplier'
                ? 'Manage your traffic campaigns and track performance'
                : 'Manage your lead acquisition campaigns and monitor quality'}
            </p>
          </div>
          <div className="mt-4 flex md:ml-4 md:mt-0">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              <FunnelIcon className="-ml-0.5 mr-1.5 h-5 w-5 text-gray-400" />
              Filters
            </button>
            <Link
              to="/app/campaigns/create"
              className="ml-3 inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5" />
              New Campaign
            </Link>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
            <dt className="truncate text-sm font-medium text-gray-500">Total Campaigns</dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
              {campaigns.length}
            </dd>
          </div>
          <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
            <dt className="truncate text-sm font-medium text-gray-500">Calls Today</dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
              {campaigns.reduce((sum, c) => sum + c.calls_today, 0)}
            </dd>
          </div>
          <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
            <dt className="truncate text-sm font-medium text-gray-500">
              {userRole === 'supplier' ? 'Revenue Today' : 'Spend Today'}
            </dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
              {formatCurrency(campaigns.reduce((sum, c) => sum + c.revenue_today, 0))}
            </dd>
          </div>
          <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
            <dt className="truncate text-sm font-medium text-gray-500">Avg Quality Score</dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
              {Math.round(
                campaigns.reduce((sum, c) => sum + c.quality_score, 0) / campaigns.length
              )}
              %
            </dd>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="mt-8">
          <div className="sm:flex sm:items-center">
            <div className="sm:flex-auto">
              <div className="flex rounded-md shadow-sm">
                <div className="relative flex flex-grow items-stretch focus-within:z-10">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full rounded-none rounded-l-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                    placeholder="Search campaigns or tracking numbers..."
                  />
                </div>
              </div>
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 bg-gray-50 p-4 rounded-lg">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Status:</label>
                  <select
                    value={selectedFilter}
                    onChange={(e) => setSelectedFilter(e.target.value as CampaignFilter)}
                    className="rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Sort by:</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as CampaignSort)}
                    className="rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="created_at">Created Date</option>
                    <option value="name">Name</option>
                    <option value="calls_today">Calls Today</option>
                    <option value="revenue_today">Revenue Today</option>
                    <option value="quality_score">Quality Score</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Campaigns List */}
        <div className="mt-8">
          {filteredCampaigns.length === 0 ? (
            <div className="text-center py-12">
              <PhoneIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No campaigns found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchQuery
                  ? 'Try adjusting your search terms.'
                  : 'Get started by creating a new campaign.'}
              </p>
              {!searchQuery && (
                <div className="mt-6">
                  <Link
                    to="/app/campaigns/create"
                    className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                  >
                    <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5" />
                    New Campaign
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul role="list" className="divide-y divide-gray-200">
                {filteredCampaigns.map((campaign) => (
                  <li key={campaign.id} className="hover:bg-gray-50">
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedCampaigns.includes(campaign.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCampaigns([...selectedCampaigns, campaign.id])
                              } else {
                                setSelectedCampaigns(
                                  selectedCampaigns.filter((id) => id !== campaign.id)
                                )
                              }
                            }}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="ml-4 min-w-0 flex-1">
                            <div className="flex items-center">
                              {getStatusIcon(campaign.status)}
                              <p className="ml-2 text-sm font-medium text-gray-900 truncate">
                                {campaign.name}
                              </p>
                              <span className={`ml-2 ${getStatusBadge(campaign.status)}`}>
                                {campaign.status}
                              </span>
                            </div>
                            <div className="mt-2 flex">
                              <div className="flex items-center text-sm text-gray-500">
                                <PhoneIcon className="flex-shrink-0 mr-1.5 h-4 w-4" />
                                {campaign.calls_today} calls today ({campaign.calls_this_month} this
                                month)
                              </div>
                              <div className="ml-6 flex items-center text-sm text-gray-500">
                                <CurrencyDollarIcon className="flex-shrink-0 mr-1.5 h-4 w-4" />
                                {userRole === 'supplier'
                                  ? `${formatCurrency(campaign.revenue_today)} today`
                                  : campaign.budget_remaining
                                    ? `${formatCurrency(campaign.budget_remaining)} remaining`
                                    : `${formatCurrency(campaign.revenue_today)} spent today`}
                              </div>
                              <div className="ml-6 flex items-center text-sm text-gray-500">
                                <ChartBarIcon className="flex-shrink-0 mr-1.5 h-4 w-4" />
                                {campaign.quality_score}% quality
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">
                              {campaign.conversion_rate}% conversion
                            </p>
                            <p className="text-sm text-gray-500">
                              Updated {formatDate(campaign.updated_at)}
                            </p>
                          </div>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => navigate(`/campaigns/${campaign.id}`)}
                              className="p-1 text-gray-400 hover:text-gray-600"
                              title="View Details"
                            >
                              <EyeIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => navigate(`/campaigns/${campaign.id}/edit`)}
                              className="p-1 text-gray-400 hover:text-gray-600"
                              title="Edit Campaign"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                            </button>
                            {campaign.status === 'active' ? (
                              <button
                                onClick={() => handleCampaignAction('pause', campaign.id)}
                                className="p-1 text-gray-400 hover:text-yellow-600"
                                title="Pause Campaign"
                              >
                                <PauseIcon className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleCampaignAction('resume', campaign.id)}
                                className="p-1 text-gray-400 hover:text-green-600"
                                title="Resume Campaign"
                              >
                                <PlayIcon className="h-4 w-4" />
                              </button>
                            )}
                            <div className="relative">
                              <button className="p-1 text-gray-400 hover:text-gray-600">
                                <EllipsisVerticalIcon className="h-4 w-4" />
                              </button>
                              {/* Dropdown menu would go here */}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Bulk Actions */}
        {selectedCampaigns.length > 0 && (
          <div className="mt-4 bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm text-blue-700">
                {selectedCampaigns.length} campaign{selectedCampaigns.length > 1 ? 's' : ''}{' '}
                selected
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={() => console.log('Bulk pause:', selectedCampaigns)}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
                >
                  <PauseIcon className="mr-1 h-3 w-3" />
                  Pause
                </button>
                <button
                  onClick={() => console.log('Bulk resume:', selectedCampaigns)}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
                >
                  <PlayIcon className="mr-1 h-3 w-3" />
                  Resume
                </button>
                <button
                  onClick={() => console.log('Bulk duplicate:', selectedCampaigns)}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
                >
                  <DocumentDuplicateIcon className="mr-1 h-3 w-3" />
                  Duplicate
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
