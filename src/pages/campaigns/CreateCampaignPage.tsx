import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthStore } from '../../store/authStore'
import {
  ChevronLeftIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  PhoneIcon,
  GlobeAltIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { Button } from '../../components/common/Button'
import { Card, CardContent, CardHeader } from '../../components/common/Card'
import { Input } from '../../components/common/Input'
import { Loading } from '../../components/common/Loading'
import { FormErrorBoundary } from '../../components/forms/FormErrorBoundary'

// Campaign creation schema
const createCampaignSchema = z.object({
  name: z
    .string()
    .min(3, 'Campaign name must be at least 3 characters')
    .max(100, 'Campaign name must be less than 100 characters'),
  vertical: z.enum([
    'insurance',
    'home_services',
    'legal',
    'medical',
    'financial',
    'education',
    'automotive',
    'real_estate',
  ]),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be less than 500 characters'),
  target_cpa: z
    .number()
    .min(1, 'Target CPA must be at least $1')
    .max(1000, 'Target CPA must be less than $1,000'),
  daily_budget: z
    .number()
    .min(10, 'Daily budget must be at least $10')
    .max(10000, 'Daily budget must be less than $10,000'),
  monthly_budget: z
    .number()
    .min(100, 'Monthly budget must be at least $100')
    .max(100000, 'Monthly budget must be less than $100,000'),
  geo_targeting: z.object({
    countries: z.array(z.string()).min(1, 'Select at least one country'),
    states: z.array(z.string()).optional(),
    cities: z.array(z.string()).optional(),
    radius_miles: z.number().min(1).max(500).optional(),
  }),
  time_targeting: z.object({
    days_of_week: z
      .array(
        z.enum([
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday',
          'sunday',
        ] as const)
      )
      .min(1, 'Select at least one day'),
    hours: z.object({
      start: z.string().length(5, 'Invalid time format'), // HH:MM format
      end: z.string().length(5, 'Invalid time format'),
    }),
    timezone: z.string().min(1, 'Select a timezone'),
  }),
  quality_requirements: z.object({
    minimum_call_duration: z
      .number()
      .min(30, 'Minimum call duration must be at least 30 seconds')
      .max(600, 'Maximum call duration is 10 minutes'),
    quality_score_threshold: z.number().min(1).max(100),
    allow_transferred_calls: z.boolean(),
    require_unique_callers: z.boolean(),
  }),
  payout_settings: z.object({
    payout_model: z.enum(['cpa', 'cpc', 'cpm']),
    base_payout: z
      .number()
      .min(1, 'Base payout must be at least $1')
      .max(500, 'Base payout must be less than $500'),
    bonus_conditions: z
      .array(
        z.object({
          condition: z.string(),
          bonus_amount: z.number().min(0),
        })
      )
      .optional(),
  }),
})

type CreateCampaignFormData = z.infer<typeof createCampaignSchema>

const CAMPAIGN_VERTICALS = [
  { value: 'insurance', label: 'Insurance', description: 'Auto, home, life, and health insurance' },
  {
    value: 'home_services',
    label: 'Home Services',
    description: 'HVAC, plumbing, roofing, and contractors',
  },
  { value: 'legal', label: 'Legal Services', description: 'Personal injury, DUI, and family law' },
  { value: 'medical', label: 'Medical', description: 'Healthcare services and treatments' },
  {
    value: 'financial',
    label: 'Financial Services',
    description: 'Loans, mortgages, and financial planning',
  },
  { value: 'education', label: 'Education', description: 'Online courses and degree programs' },
  { value: 'automotive', label: 'Automotive', description: 'Car sales, repairs, and services' },
  {
    value: 'real_estate',
    label: 'Real Estate',
    description: 'Property buying, selling, and rentals',
  },
]

const US_STATES = [
  'Alabama',
  'Alaska',
  'Arizona',
  'Arkansas',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'Florida',
  'Georgia',
  'Hawaii',
  'Idaho',
  'Illinois',
  'Indiana',
  'Iowa',
  'Kansas',
  'Kentucky',
  'Louisiana',
  'Maine',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Montana',
  'Nebraska',
  'Nevada',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'New York',
  'North Carolina',
  'North Dakota',
  'Ohio',
  'Oklahoma',
  'Oregon',
  'Pennsylvania',
  'Rhode Island',
  'South Carolina',
  'South Dakota',
  'Tennessee',
  'Texas',
  'Utah',
  'Vermont',
  'Virginia',
  'Washington',
  'West Virginia',
  'Wisconsin',
  'Wyoming',
]

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

const DAYS_OF_WEEK: Array<{ value: DayOfWeek; label: string }> = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
]

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
]

function CreateCampaignPageInner() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)

  // Restore draft on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem('formDraft_createCampaign')
    if (savedDraft) {
      try {
        const { data } = JSON.parse(savedDraft)
        // In a real implementation, we would merge this data into the form
        console.log('Draft data available:', data)
      } catch (err) {
        console.error('Failed to restore draft:', err)
      }
    }
  }, [])

  const form = useForm<CreateCampaignFormData>({
    resolver: zodResolver(createCampaignSchema),
    defaultValues: {
      name: '',
      vertical: 'insurance',
      description: '',
      target_cpa: 50,
      daily_budget: 500,
      monthly_budget: 15000,
      geo_targeting: {
        countries: ['US'],
        states: [],
        cities: [],
      },
      time_targeting: {
        days_of_week: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        hours: {
          start: '09:00',
          end: '17:00',
        },
        timezone: 'America/New_York',
      },
      quality_requirements: {
        minimum_call_duration: 60,
        quality_score_threshold: 70,
        allow_transferred_calls: true,
        require_unique_callers: true,
      },
      payout_settings: {
        payout_model: 'cpa',
        base_payout: 25,
        bonus_conditions: [],
      },
    },
  })

  const handleSubmit = async (data: CreateCampaignFormData) => {
    if (!user) {
      navigate('/login')
      return
    }

    setIsSubmitting(true)
    try {
      // TODO: Replace with actual API call
      console.log('Creating campaign:', data)

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Mock successful creation
      const campaignId = 'new-campaign-id'

      navigate(`/app/campaigns/${campaignId}`, {
        state: {
          message: 'Campaign created successfully! It may take a few minutes to become active.',
        },
      })
    } catch (error) {
      console.error('Failed to create campaign:', error)
      // Handle error (show toast, etc.)
    } finally {
      setIsSubmitting(false)
    }
  }

  const steps = [
    { id: 1, name: 'Basic Info', description: 'Campaign details and vertical' },
    { id: 2, name: 'Targeting', description: 'Geographic and time targeting' },
    { id: 3, name: 'Quality', description: 'Quality requirements and filters' },
    { id: 4, name: 'Payout', description: 'Pricing and payout settings' },
    { id: 5, name: 'Review', description: 'Review and launch campaign' },
  ]

  const currentStepData = steps[currentStep - 1]
  const isLastStep = currentStep === steps.length

  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 1:
        return form.watch('name') && form.watch('vertical') && form.watch('description')
      case 2:
        return (
          form.watch('geo_targeting.countries').length > 0 &&
          form.watch('time_targeting.days_of_week').length > 0
        )
      case 3:
        return form.watch('quality_requirements.minimum_call_duration') > 0
      case 4:
        return form.watch('payout_settings.base_payout') > 0
      default:
        return true
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h3 className="text-lg font-medium flex items-center">
                  <InformationCircleIcon className="h-5 w-5 mr-2 text-blue-500" />
                  Campaign Basics
                </h3>
                <p className="text-sm text-gray-600">
                  Start by providing basic information about your campaign.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  {...form.register('name')}
                  label="Campaign Name"
                  placeholder="e.g., Auto Insurance - California"
                  error={form.formState.errors.name?.message}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vertical</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CAMPAIGN_VERTICALS.map((vertical) => (
                      <label
                        key={vertical.value}
                        className={`relative cursor-pointer rounded-lg border p-4 hover:border-blue-300 ${
                          form.watch('vertical') === vertical.value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300'
                        }`}
                      >
                        <input
                          {...form.register('vertical')}
                          type="radio"
                          value={vertical.value}
                          className="absolute top-4 right-4 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <h4 className="font-medium text-gray-900">{vertical.label}</h4>
                          <p className="text-sm text-gray-500">{vertical.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  {form.formState.errors.vertical && (
                    <p className="mt-1 text-sm text-red-600">
                      {form.formState.errors.vertical.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    {...form.register('description')}
                    rows={4}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Describe your campaign goals, target audience, and specific requirements..."
                  />
                  {form.formState.errors.description && (
                    <p className="mt-1 text-sm text-red-600">
                      {form.formState.errors.description.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    {...form.register('target_cpa', { valueAsNumber: true })}
                    type="number"
                    label="Target CPA ($)"
                    placeholder="50"
                    error={form.formState.errors.target_cpa?.message}
                  />
                  <Input
                    {...form.register('daily_budget', { valueAsNumber: true })}
                    type="number"
                    label="Daily Budget ($)"
                    placeholder="500"
                    error={form.formState.errors.daily_budget?.message}
                  />
                </div>

                <Input
                  {...form.register('monthly_budget', { valueAsNumber: true })}
                  type="number"
                  label="Monthly Budget ($)"
                  placeholder="15000"
                  error={form.formState.errors.monthly_budget?.message}
                />
              </CardContent>
            </Card>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h3 className="text-lg font-medium flex items-center">
                  <GlobeAltIcon className="h-5 w-5 mr-2 text-green-500" />
                  Geographic Targeting
                </h3>
                <p className="text-sm text-gray-600">
                  Define where you want to receive calls from.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    States (Leave empty for nationwide)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto border rounded-md p-3">
                    {US_STATES.map((state) => (
                      <label key={state} className="flex items-center">
                        <input
                          type="checkbox"
                          value={state}
                          checked={form.watch('geo_targeting.states')?.includes(state) || false}
                          onChange={(e) => {
                            const states = form.watch('geo_targeting.states') || []
                            if (e.target.checked) {
                              form.setValue('geo_targeting.states', [...states, state])
                            } else {
                              form.setValue(
                                'geo_targeting.states',
                                states.filter((s) => s !== state)
                              )
                            }
                          }}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{state}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-lg font-medium flex items-center">
                  <ClockIcon className="h-5 w-5 mr-2 text-purple-500" />
                  Time Targeting
                </h3>
                <p className="text-sm text-gray-600">Set when your campaign should be active.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Days of Week
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <label key={day.value} className="flex items-center">
                        <input
                          type="checkbox"
                          value={day.value}
                          checked={form.watch('time_targeting.days_of_week').includes(day.value)}
                          onChange={(e) => {
                            const days = form.watch('time_targeting.days_of_week')
                            if (e.target.checked) {
                              form.setValue('time_targeting.days_of_week', [...days, day.value])
                            } else {
                              form.setValue(
                                'time_targeting.days_of_week',
                                days.filter((d) => d !== day.value)
                              )
                            }
                          }}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{day.label}</span>
                      </label>
                    ))}
                  </div>
                  {form.formState.errors.time_targeting?.days_of_week && (
                    <p className="mt-1 text-sm text-red-600">
                      {form.formState.errors.time_targeting.days_of_week.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    {...form.register('time_targeting.hours.start')}
                    type="time"
                    label="Start Time"
                    error={form.formState.errors.time_targeting?.hours?.start?.message}
                  />
                  <Input
                    {...form.register('time_targeting.hours.end')}
                    type="time"
                    label="End Time"
                    error={form.formState.errors.time_targeting?.hours?.end?.message}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                    <select
                      {...form.register('time_targeting.timezone')}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                      {TIMEZONES.map((timezone) => (
                        <option key={timezone} value={timezone}>
                          {timezone.replace('America/', '').replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                    {form.formState.errors.time_targeting?.timezone && (
                      <p className="mt-1 text-sm text-red-600">
                        {form.formState.errors.time_targeting.timezone.message}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h3 className="text-lg font-medium flex items-center">
                  <ShieldCheckIcon className="h-5 w-5 mr-2 text-green-500" />
                  Quality Requirements
                </h3>
                <p className="text-sm text-gray-600">
                  Set standards for call quality and filtering.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    {...form.register('quality_requirements.minimum_call_duration', {
                      valueAsNumber: true,
                    })}
                    type="number"
                    label="Minimum Call Duration (seconds)"
                    placeholder="60"
                    error={
                      form.formState.errors.quality_requirements?.minimum_call_duration?.message
                    }
                  />
                  <Input
                    {...form.register('quality_requirements.quality_score_threshold', {
                      valueAsNumber: true,
                    })}
                    type="number"
                    label="Quality Score Threshold (%)"
                    min="1"
                    max="100"
                    placeholder="70"
                    error={
                      form.formState.errors.quality_requirements?.quality_score_threshold?.message
                    }
                  />
                </div>

                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      {...form.register('quality_requirements.allow_transferred_calls')}
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Allow transferred calls</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      {...form.register('quality_requirements.require_unique_callers')}
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Require unique callers (block repeat calls)
                    </span>
                  </label>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h3 className="text-lg font-medium flex items-center">
                  <CurrencyDollarIcon className="h-5 w-5 mr-2 text-green-500" />
                  Payout Settings
                </h3>
                <p className="text-sm text-gray-600">
                  Configure how much you'll pay for qualified calls.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payout Model
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label
                      className={`cursor-pointer rounded-lg border p-4 ${
                        form.watch('payout_settings.payout_model') === 'cpa'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300'
                      }`}
                    >
                      <input
                        {...form.register('payout_settings.payout_model')}
                        type="radio"
                        value="cpa"
                        className="sr-only"
                      />
                      <div className="text-center">
                        <h4 className="font-medium">CPA</h4>
                        <p className="text-sm text-gray-500">Cost Per Acquisition</p>
                      </div>
                    </label>
                    <label
                      className={`cursor-pointer rounded-lg border p-4 ${
                        form.watch('payout_settings.payout_model') === 'cpc'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300'
                      }`}
                    >
                      <input
                        {...form.register('payout_settings.payout_model')}
                        type="radio"
                        value="cpc"
                        className="sr-only"
                      />
                      <div className="text-center">
                        <h4 className="font-medium">CPC</h4>
                        <p className="text-sm text-gray-500">Cost Per Call</p>
                      </div>
                    </label>
                    <label
                      className={`cursor-pointer rounded-lg border p-4 ${
                        form.watch('payout_settings.payout_model') === 'cpm'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300'
                      }`}
                    >
                      <input
                        {...form.register('payout_settings.payout_model')}
                        type="radio"
                        value="cpm"
                        className="sr-only"
                      />
                      <div className="text-center">
                        <h4 className="font-medium">CPM</h4>
                        <p className="text-sm text-gray-500">Cost Per Mille</p>
                      </div>
                    </label>
                  </div>
                </div>

                <Input
                  {...form.register('payout_settings.base_payout', { valueAsNumber: true })}
                  type="number"
                  label="Base Payout ($)"
                  placeholder="25"
                  error={form.formState.errors.payout_settings?.base_payout?.message}
                />
              </CardContent>
            </Card>
          </div>
        )

      case 5:
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h3 className="text-lg font-medium flex items-center">
                  <CheckCircleIcon className="h-5 w-5 mr-2 text-green-500" />
                  Review Campaign
                </h3>
                <p className="text-sm text-gray-600">
                  Review your campaign settings before launching.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-gray-900">Basic Information</h4>
                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        <p>
                          <span className="font-medium">Name:</span> {form.watch('name')}
                        </p>
                        <p>
                          <span className="font-medium">Vertical:</span>{' '}
                          {
                            CAMPAIGN_VERTICALS.find((v) => v.value === form.watch('vertical'))
                              ?.label
                          }
                        </p>
                        <p>
                          <span className="font-medium">Target CPA:</span> $
                          {form.watch('target_cpa')}
                        </p>
                        <p>
                          <span className="font-medium">Daily Budget:</span> $
                          {form.watch('daily_budget')}
                        </p>
                        <p>
                          <span className="font-medium">Monthly Budget:</span> $
                          {form.watch('monthly_budget')}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900">Geographic Targeting</h4>
                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        <p>
                          <span className="font-medium">Countries:</span>{' '}
                          {form.watch('geo_targeting.countries').join(', ')}
                        </p>
                        <p>
                          <span className="font-medium">States:</span>{' '}
                          {form.watch('geo_targeting.states') &&
                          form.watch('geo_targeting.states')!.length > 0
                            ? form.watch('geo_targeting.states')!.slice(0, 3).join(', ') +
                              (form.watch('geo_targeting.states')!.length > 3
                                ? `... (+${form.watch('geo_targeting.states')!.length - 3} more)`
                                : '')
                            : 'All states'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-gray-900">Time Targeting</h4>
                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        <p>
                          <span className="font-medium">Days:</span>{' '}
                          {form
                            .watch('time_targeting.days_of_week')
                            .map((d) => DAYS_OF_WEEK.find((day) => day.value === d)?.label)
                            .join(', ')}
                        </p>
                        <p>
                          <span className="font-medium">Hours:</span>{' '}
                          {form.watch('time_targeting.hours.start')} -{' '}
                          {form.watch('time_targeting.hours.end')}
                        </p>
                        <p>
                          <span className="font-medium">Timezone:</span>{' '}
                          {form.watch('time_targeting.timezone')}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900">Quality & Payout</h4>
                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        <p>
                          <span className="font-medium">Min Call Duration:</span>{' '}
                          {form.watch('quality_requirements.minimum_call_duration')}s
                        </p>
                        <p>
                          <span className="font-medium">Quality Threshold:</span>{' '}
                          {form.watch('quality_requirements.quality_score_threshold')}%
                        </p>
                        <p>
                          <span className="font-medium">Payout Model:</span>{' '}
                          {form.watch('payout_settings.payout_model').toUpperCase()}
                        </p>
                        <p>
                          <span className="font-medium">Base Payout:</span> $
                          {form.watch('payout_settings.base_payout')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <div className="flex">
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">Campaign Review</h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>
                          Your campaign will be reviewed by our team and should be active within 2-4
                          hours. You'll receive an email notification when it's approved and live.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="py-6">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/app/campaigns')}
            className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ChevronLeftIcon className="h-4 w-4 mr-1" />
            Back to Campaigns
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create New Campaign</h1>
              <p className="text-sm text-gray-600 mt-1">{currentStepData.description}</p>
            </div>
            <div className="text-sm text-gray-500">
              Step {currentStep} of {steps.length}
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                    currentStep > step.id
                      ? 'bg-green-500 border-green-500 text-white'
                      : currentStep === step.id
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'bg-white border-gray-300 text-gray-500'
                  }`}
                >
                  {currentStep > step.id ? (
                    <CheckCircleIcon className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-medium">{step.id}</span>
                  )}
                </div>
                <div className="ml-3 hidden sm:block">
                  <p
                    className={`text-sm font-medium ${
                      currentStep >= step.id ? 'text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    {step.name}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 mx-4 h-0.5 ${
                      currentStep > step.id ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          {renderStepContent()}

          {/* Navigation */}
          <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
            >
              Previous
            </Button>

            <div className="flex space-x-3">
              <Button type="button" variant="outline" onClick={() => navigate('/app/campaigns')}>
                Cancel
              </Button>

              {isLastStep ? (
                <Button type="submit" loading={isSubmitting} disabled={!canProceedToNextStep()}>
                  {isSubmitting ? (
                    <>
                      <Loading variant="spinner" className="mr-2" />
                      Creating Campaign...
                    </>
                  ) : (
                    <>
                      <PhoneIcon className="h-4 w-4 mr-2" />
                      Launch Campaign
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => setCurrentStep(currentStep + 1)}
                  disabled={!canProceedToNextStep()}
                >
                  Next
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// Export with error boundary wrapper
export default function CreateCampaignPage() {
  const [retryKey, setRetryKey] = useState(0)

  const handleRetry = () => {
    setRetryKey((prev) => prev + 1)
  }

  const handleSaveDraft = (data: Record<string, unknown>) => {
    localStorage.setItem(
      'formDraft_createCampaign',
      JSON.stringify({
        data,
        timestamp: new Date().toISOString(),
      })
    )
    alert('Draft saved successfully!')
  }

  const handleReset = () => {
    localStorage.removeItem('formDraft_createCampaign')
    setRetryKey((prev) => prev + 1)
  }

  return (
    <FormErrorBoundary
      formName="createCampaign"
      enableDraftSaving={true}
      validationSchema={createCampaignSchema}
      onRetry={handleRetry}
      onSaveDraft={handleSaveDraft}
      onReset={handleReset}
      onError={(error) => {
        console.error('Campaign creation form error:', error)
      }}
    >
      <CreateCampaignPageInner key={retryKey} />
    </FormErrorBoundary>
  )
}
