import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormErrorBoundary } from '../../components/forms/FormErrorBoundary'

// Reuse the same schema from CreateCampaignPage but make fields optional for partial updates
const editCampaignSchema = z.object({
  // Basic Information
  name: z.string().min(3, 'Campaign name must be at least 3 characters'),
  vertical: z.enum([
    'insurance',
    'home_services',
    'legal',
    'healthcare',
    'financial',
    'education',
    'real_estate',
    'automotive',
    'travel',
    'retail',
  ]),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  status: z.enum(['active', 'paused', 'ended']),
  
  // Targeting
  geoTargeting: z.object({
    countries: z.array(z.string()).min(1, 'Select at least one country'),
    states: z.array(z.string()).optional(),
    cities: z.array(z.string()).optional(),
    zipcodes: z.array(z.string()).optional(),
  }),
  timeTargeting: z.object({
    timezone: z.string(),
    businessHours: z.boolean(),
    customHours: z.object({
      monday: z.object({ start: z.string(), end: z.string(), enabled: z.boolean() }),
      tuesday: z.object({ start: z.string(), end: z.string(), enabled: z.boolean() }),
      wednesday: z.object({ start: z.string(), end: z.string(), enabled: z.boolean() }),
      thursday: z.object({ start: z.string(), end: z.string(), enabled: z.boolean() }),
      friday: z.object({ start: z.string(), end: z.string(), enabled: z.boolean() }),
      saturday: z.object({ start: z.string(), end: z.string(), enabled: z.boolean() }),
      sunday: z.object({ start: z.string(), end: z.string(), enabled: z.boolean() }),
    }).optional(),
  }),
  
  // Quality Requirements
  qualityRequirements: z.object({
    minCallDuration: z.number().min(30, 'Minimum call duration must be at least 30 seconds'),
    uniqueCallerOnly: z.boolean(),
    recordCalls: z.boolean(),
    requireKeypress: z.boolean(),
    blockDuplicates: z.boolean(),
    duplicateWindow: z.number().min(1).max(90).optional(),
  }),
  
  // Payout Settings
  payoutSettings: z.object({
    model: z.enum(['pay_per_call', 'pay_per_qualified_call', 'pay_per_conversion']),
    baseRate: z.number().min(0.01, 'Base rate must be greater than 0'),
    qualifiedRate: z.number().min(0.01).optional(),
    conversionRate: z.number().min(0.01).optional(),
    currency: z.enum(['USD', 'EUR', 'GBP', 'CAD', 'AUD']),
    dailyBudget: z.number().min(1).optional(),
    monthlyBudget: z.number().min(1).optional(),
  }),
})

type EditCampaignFormData = z.infer<typeof editCampaignSchema>

// Mock function to fetch campaign data - replace with actual API call
async function fetchCampaign(id: string): Promise<EditCampaignFormData | null> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Return mock data for demo
  if (id === '1') {
    return {
      name: 'Auto Insurance Leads - California',
      vertical: 'insurance',
      description: 'High-quality auto insurance leads from California residents seeking quotes',
      status: 'active',
      geoTargeting: {
        countries: ['US'],
        states: ['CA'],
        cities: ['Los Angeles', 'San Francisco', 'San Diego'],
      },
      timeTargeting: {
        timezone: 'America/Los_Angeles',
        businessHours: true,
      },
      qualityRequirements: {
        minCallDuration: 90,
        uniqueCallerOnly: true,
        recordCalls: true,
        requireKeypress: true,
        blockDuplicates: true,
        duplicateWindow: 30,
      },
      payoutSettings: {
        model: 'pay_per_qualified_call',
        baseRate: 15,
        qualifiedRate: 45,
        currency: 'USD',
        dailyBudget: 1000,
        monthlyBudget: 25000,
      },
    }
  }
  
  return null
}

// Mock function to update campaign - replace with actual API call
async function updateCampaign(id: string, data: EditCampaignFormData): Promise<void> {
  console.log('Updating campaign:', id, data)
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500))
}

function EditCampaignPageInner() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [campaignNotFound, setCampaignNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState<'basic' | 'targeting' | 'quality' | 'payout'>('basic')
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    watch,
  } = useForm<EditCampaignFormData>({
    resolver: zodResolver(editCampaignSchema),
  })
  
  const payoutModel = watch('payoutSettings.model')
  const blockDuplicates = watch('qualityRequirements.blockDuplicates')
  
  useEffect(() => {
    async function loadCampaign() {
      if (!id) {
        setCampaignNotFound(true)
        setLoading(false)
        return
      }
      
      try {
        const campaign = await fetchCampaign(id)
        if (campaign) {
          reset(campaign)
        } else {
          setCampaignNotFound(true)
        }
      } catch (error) {
        console.error('Failed to load campaign:', error)
        setCampaignNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    
    loadCampaign()
  }, [id, reset])
  
  const onSubmit = async (data: EditCampaignFormData) => {
    if (!id) return
    
    try {
      await updateCampaign(id, data)
      navigate('/app/campaigns')
    } catch (error) {
      console.error('Failed to update campaign:', error)
      alert('Failed to update campaign. Please try again.')
    }
  }
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading campaign...</p>
        </div>
      </div>
    )
  }
  
  if (campaignNotFound) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Campaign Not Found</h2>
          <p className="text-gray-600 mb-8">The campaign you're looking for doesn't exist or you don't have access to it.</p>
          <button
            onClick={() => navigate('/app/campaigns')}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
          >
            Back to Campaigns
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Edit Campaign</h1>
          <p className="mt-2 text-gray-600">Update your campaign settings and targeting options</p>
        </div>
        
        {/* Tab Navigation */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex">
              <button
                onClick={() => setActiveTab('basic')}
                className={`py-2 px-6 border-b-2 font-medium text-sm ${
                  activeTab === 'basic'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Basic Info
              </button>
              <button
                onClick={() => setActiveTab('targeting')}
                className={`py-2 px-6 border-b-2 font-medium text-sm ${
                  activeTab === 'targeting'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Targeting
              </button>
              <button
                onClick={() => setActiveTab('quality')}
                className={`py-2 px-6 border-b-2 font-medium text-sm ${
                  activeTab === 'quality'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Quality
              </button>
              <button
                onClick={() => setActiveTab('payout')}
                className={`py-2 px-6 border-b-2 font-medium text-sm ${
                  activeTab === 'payout'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Payout
              </button>
            </nav>
          </div>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information Tab */}
          {activeTab === 'basic' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Basic Information</h2>
              
              <div className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    {...register('name')}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>
                
                <div>
                  <label htmlFor="vertical" className="block text-sm font-medium text-gray-700">
                    Industry Vertical
                  </label>
                  <select
                    id="vertical"
                    {...register('vertical')}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  >
                    <option value="insurance">Insurance</option>
                    <option value="home_services">Home Services</option>
                    <option value="legal">Legal</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="financial">Financial</option>
                    <option value="education">Education</option>
                    <option value="real_estate">Real Estate</option>
                    <option value="automotive">Automotive</option>
                    <option value="travel">Travel</option>
                    <option value="retail">Retail</option>
                  </select>
                  {errors.vertical && (
                    <p className="mt-1 text-sm text-red-600">{errors.vertical.message}</p>
                  )}
                </div>
                
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    id="description"
                    rows={4}
                    {...register('description')}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                  {errors.description && (
                    <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                  )}
                </div>
                
                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                    Campaign Status
                  </label>
                  <select
                    id="status"
                    {...register('status')}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="ended">Ended</option>
                  </select>
                  {errors.status && (
                    <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Targeting Tab */}
          {activeTab === 'targeting' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Targeting Settings</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Geographic Targeting</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Countries</label>
                      <select
                        multiple
                        {...register('geoTargeting.countries')}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      >
                        <option value="US">United States</option>
                        <option value="CA">Canada</option>
                        <option value="GB">United Kingdom</option>
                        <option value="AU">Australia</option>
                      </select>
                      {errors.geoTargeting?.countries && (
                        <p className="mt-1 text-sm text-red-600">{errors.geoTargeting.countries.message}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        States/Provinces (optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., CA, NY, TX"
                        {...register('geoTargeting.states.0')}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Cities (optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Los Angeles, New York"
                        {...register('geoTargeting.cities.0')}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Time Targeting</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="timezone" className="block text-sm font-medium text-gray-700">
                        Timezone
                      </label>
                      <select
                        id="timezone"
                        {...register('timeTargeting.timezone')}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      >
                        <option value="America/New_York">Eastern Time</option>
                        <option value="America/Chicago">Central Time</option>
                        <option value="America/Denver">Mountain Time</option>
                        <option value="America/Los_Angeles">Pacific Time</option>
                      </select>
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="businessHours"
                        {...register('timeTargeting.businessHours')}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor="businessHours" className="ml-2 block text-sm text-gray-900">
                        Business hours only (9 AM - 5 PM)
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Quality Tab */}
          {activeTab === 'quality' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Quality Requirements</h2>
              
              <div className="space-y-6">
                <div>
                  <label htmlFor="minCallDuration" className="block text-sm font-medium text-gray-700">
                    Minimum Call Duration (seconds)
                  </label>
                  <input
                    type="number"
                    id="minCallDuration"
                    {...register('qualityRequirements.minCallDuration', { valueAsNumber: true })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                  {errors.qualityRequirements?.minCallDuration && (
                    <p className="mt-1 text-sm text-red-600">{errors.qualityRequirements.minCallDuration.message}</p>
                  )}
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="uniqueCallerOnly"
                      {...register('qualityRequirements.uniqueCallerOnly')}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="uniqueCallerOnly" className="ml-2 block text-sm text-gray-900">
                      Accept unique callers only
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="recordCalls"
                      {...register('qualityRequirements.recordCalls')}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="recordCalls" className="ml-2 block text-sm text-gray-900">
                      Record calls for quality assurance
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="requireKeypress"
                      {...register('qualityRequirements.requireKeypress')}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="requireKeypress" className="ml-2 block text-sm text-gray-900">
                      Require keypress confirmation
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="blockDuplicates"
                      {...register('qualityRequirements.blockDuplicates')}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="blockDuplicates" className="ml-2 block text-sm text-gray-900">
                      Block duplicate calls
                    </label>
                  </div>
                  
                  {blockDuplicates && (
                    <div className="ml-6">
                      <label htmlFor="duplicateWindow" className="block text-sm font-medium text-gray-700">
                        Duplicate window (days)
                      </label>
                      <input
                        type="number"
                        id="duplicateWindow"
                        {...register('qualityRequirements.duplicateWindow', { valueAsNumber: true })}
                        className="mt-1 block w-32 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Payout Tab */}
          {activeTab === 'payout' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Payout Settings</h2>
              
              <div className="space-y-6">
                <div>
                  <label htmlFor="payoutModel" className="block text-sm font-medium text-gray-700">
                    Payout Model
                  </label>
                  <select
                    id="payoutModel"
                    {...register('payoutSettings.model')}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  >
                    <option value="pay_per_call">Pay Per Call</option>
                    <option value="pay_per_qualified_call">Pay Per Qualified Call</option>
                    <option value="pay_per_conversion">Pay Per Conversion</option>
                  </select>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="baseRate" className="block text-sm font-medium text-gray-700">
                      Base Rate ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      id="baseRate"
                      {...register('payoutSettings.baseRate', { valueAsNumber: true })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                    {errors.payoutSettings?.baseRate && (
                      <p className="mt-1 text-sm text-red-600">{errors.payoutSettings.baseRate.message}</p>
                    )}
                  </div>
                  
                  {payoutModel === 'pay_per_qualified_call' && (
                    <div>
                      <label htmlFor="qualifiedRate" className="block text-sm font-medium text-gray-700">
                        Qualified Rate ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        id="qualifiedRate"
                        {...register('payoutSettings.qualifiedRate', { valueAsNumber: true })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      />
                    </div>
                  )}
                  
                  {payoutModel === 'pay_per_conversion' && (
                    <div>
                      <label htmlFor="conversionRate" className="block text-sm font-medium text-gray-700">
                        Conversion Rate ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        id="conversionRate"
                        {...register('payoutSettings.conversionRate', { valueAsNumber: true })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      />
                    </div>
                  )}
                </div>
                
                <div>
                  <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
                    Currency
                  </label>
                  <select
                    id="currency"
                    {...register('payoutSettings.currency')}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  >
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="CAD">CAD - Canadian Dollar</option>
                    <option value="AUD">AUD - Australian Dollar</option>
                  </select>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="dailyBudget" className="block text-sm font-medium text-gray-700">
                      Daily Budget (optional)
                    </label>
                    <input
                      type="number"
                      id="dailyBudget"
                      {...register('payoutSettings.dailyBudget', { valueAsNumber: true })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="monthlyBudget" className="block text-sm font-medium text-gray-700">
                      Monthly Budget (optional)
                    </label>
                    <input
                      type="number"
                      id="monthlyBudget"
                      {...register('payoutSettings.monthlyBudget', { valueAsNumber: true })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => navigate('/app/campaigns')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            
            <div className="flex space-x-3">
              {isDirty && (
                <button
                  type="button"
                  onClick={() => reset()}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Reset Changes
                </button>
              )}
              
              <button
                type="submit"
                disabled={isSubmitting || !isDirty}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                  isSubmitting || !isDirty
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-primary-600 hover:bg-primary-700'
                }`}
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function EditCampaignPage() {
  return (
    <FormErrorBoundary>
      <EditCampaignPageInner />
    </FormErrorBoundary>
  )
}