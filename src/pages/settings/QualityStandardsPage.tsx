import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSettingsStore } from '../../store/settingsStore'
import { useAuthStore } from '../../store/authStore'
import {
  SettingsSection,
  SettingsCard,
  SettingsField,
  SettingsInput,
  SettingsSelect,
  SettingsToggle,
  SettingsCheckboxGroup,
  SettingsRadioGroup,
  SettingsAlert,
} from '../../components/settings'
import { Button } from '../../components/common/Button'
import {
  ClockIcon,
  UserIcon,
  MapPinIcon,
  CalendarDaysIcon,
  PhoneIcon,
  ChartBarIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import type { QualityRequirements } from '../../types/settings'

// Validation schema
const qualityStandardsSchema = z.object({
  minimumQualityScore: z.number().min(0).max(100),
  requiredCallDuration: z.object({
    min: z.number().min(0),
    max: z.number().min(0),
  }),
  requiredDataFields: z.array(z.object({
    field: z.string(),
    required: z.boolean(),
    validation: z.string().optional(),
  })),
  fraudTolerance: z.number().min(0).max(100),
  conversionDefinition: z.object({
    type: z.string(),
    duration: z.number().optional(),
    outcome: z.string().optional(),
    customEvents: z.array(z.string()).optional(),
  }),
  disputeWindow: z.number().min(0),
  // Additional fields for the form
  callerInfoRequirements: z.object({
    phoneNumberRequired: z.boolean(),
    nameRequired: z.boolean(),
    emailRequired: z.boolean(),
    addressRequired: z.boolean(),
    customFields: z.array(z.string()),
  }),
  geographicRestrictions: z.object({
    allowedCountries: z.array(z.string()),
    allowedStates: z.array(z.string()),
    blockedAreaCodes: z.array(z.string()),
    vpnBlocking: z.boolean(),
  }),
  timeRestrictions: z.object({
    allowedDays: z.array(z.string()),
    allowedHours: z.object({
      start: z.string(),
      end: z.string(),
      timezone: z.string(),
    }),
    holidayRestrictions: z.boolean(),
  }),
  concurrentCallLimits: z.object({
    maxPerHour: z.number().min(0),
    maxPerDay: z.number().min(0),
    maxPerCaller: z.number().min(0),
    duplicateCallWindow: z.number().min(0),
  }),
  qualityScoreWeights: z.object({
    duration: z.number().min(0).max(100),
    conversion: z.number().min(0).max(100),
    callerInfo: z.number().min(0).max(100),
    callQuality: z.number().min(0).max(100),
  }),
})

type QualityStandardsFormData = z.infer<typeof qualityStandardsSchema>

// Available countries for geo-targeting
const COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'AU', label: 'Australia' },
]

// US States
const US_STATES = [
  { value: 'CA', label: 'California' },
  { value: 'TX', label: 'Texas' },
  { value: 'FL', label: 'Florida' },
  { value: 'NY', label: 'New York' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'IL', label: 'Illinois' },
  { value: 'OH', label: 'Ohio' },
  { value: 'GA', label: 'Georgia' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'MI', label: 'Michigan' },
]

// Days of week
const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
]

// Required data fields
const DATA_FIELDS = [
  { field: 'caller_name', label: 'Caller Name', validation: 'text' },
  { field: 'caller_phone', label: 'Phone Number', validation: 'phone' },
  { field: 'caller_email', label: 'Email Address', validation: 'email' },
  { field: 'caller_address', label: 'Street Address', validation: 'address' },
  { field: 'caller_city', label: 'City', validation: 'text' },
  { field: 'caller_state', label: 'State', validation: 'state' },
  { field: 'caller_zip', label: 'ZIP Code', validation: 'zip' },
  { field: 'interested_product', label: 'Product Interest', validation: 'text' },
  { field: 'purchase_timeline', label: 'Purchase Timeline', validation: 'select' },
  { field: 'budget_range', label: 'Budget Range', validation: 'select' },
]

export default function QualityStandardsPage() {
  const { userType } = useAuthStore()
  const { roleSettings, updateRoleSetting, saveSettings, isLoading, isSaving, error } = useSettingsStore()

  // Get buyer settings
  const buyerSettings = userType === 'buyer' ? roleSettings as { quality: QualityRequirements } : null

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<QualityStandardsFormData>({
    resolver: zodResolver(qualityStandardsSchema),
    defaultValues: {
      minimumQualityScore: buyerSettings?.quality?.minimumQualityScore || 70,
      requiredCallDuration: buyerSettings?.quality?.requiredCallDuration || {
        min: 90,
        max: 1800,
      },
      requiredDataFields: buyerSettings?.quality?.requiredDataFields || DATA_FIELDS.slice(0, 3).map(field => ({
        field: field.field,
        required: true,
        validation: field.validation,
      })),
      fraudTolerance: buyerSettings?.quality?.fraudTolerance || 5,
      conversionDefinition: buyerSettings?.quality?.conversionDefinition || {
        type: 'duration',
        duration: 120,
        outcome: undefined,
        customEvents: undefined,
      },
      disputeWindow: buyerSettings?.quality?.disputeWindow || 72,
      // Additional defaults
      callerInfoRequirements: {
        phoneNumberRequired: true,
        nameRequired: true,
        emailRequired: false,
        addressRequired: false,
        customFields: [],
      },
      geographicRestrictions: {
        allowedCountries: ['US'],
        allowedStates: [],
        blockedAreaCodes: [],
        vpnBlocking: true,
      },
      timeRestrictions: {
        allowedDays: DAYS_OF_WEEK.map(d => d.value),
        allowedHours: {
          start: '08:00',
          end: '20:00',
          timezone: 'America/New_York',
        },
        holidayRestrictions: false,
      },
      concurrentCallLimits: {
        maxPerHour: 100,
        maxPerDay: 1000,
        maxPerCaller: 3,
        duplicateCallWindow: 24,
      },
      qualityScoreWeights: {
        duration: 30,
        conversion: 40,
        callerInfo: 20,
        callQuality: 10,
      },
    },
  })

  // Watch for form changes
  const conversionType = watch('conversionDefinition.type')
  const vpnBlocking = watch('geographicRestrictions.vpnBlocking')
  const holidayRestrictions = watch('timeRestrictions.holidayRestrictions')
  const qualityWeights = watch('qualityScoreWeights')

  // Calculate total weight
  const totalWeight = Object.values(qualityWeights).reduce((sum, weight) => sum + weight, 0)

  // Load settings on mount
  useEffect(() => {
    if (buyerSettings?.quality) {
      reset({
        ...buyerSettings.quality,
        // Map additional fields
        callerInfoRequirements: {
          phoneNumberRequired: true,
          nameRequired: true,
          emailRequired: false,
          addressRequired: false,
          customFields: [],
        },
        geographicRestrictions: {
          allowedCountries: ['US'],
          allowedStates: [],
          blockedAreaCodes: [],
          vpnBlocking: true,
        },
        timeRestrictions: {
          allowedDays: DAYS_OF_WEEK.map(d => d.value),
          allowedHours: {
            start: '08:00',
            end: '20:00',
            timezone: 'America/New_York',
          },
          holidayRestrictions: false,
        },
        concurrentCallLimits: {
          maxPerHour: 100,
          maxPerDay: 1000,
          maxPerCaller: 3,
          duplicateCallWindow: 24,
        },
        qualityScoreWeights: {
          duration: 30,
          conversion: 40,
          callerInfo: 20,
          callQuality: 10,
        },
      })
    }
  }, [buyerSettings, reset])

  const onSubmit = async (data: QualityStandardsFormData) => {
    // Update quality settings
    updateRoleSetting('quality', {
      minimumQualityScore: data.minimumQualityScore,
      requiredCallDuration: data.requiredCallDuration,
      requiredDataFields: data.requiredDataFields,
      fraudTolerance: data.fraudTolerance,
      conversionDefinition: data.conversionDefinition,
      disputeWindow: data.disputeWindow,
    })
    
    // Save to backend
    await saveSettings()
  }

  const handleAddBlockedAreaCode = () => {
    const input = document.getElementById('new-area-code') as HTMLInputElement
    if (input?.value) {
      const current = watch('geographicRestrictions.blockedAreaCodes')
      setValue('geographicRestrictions.blockedAreaCodes', [...current, input.value])
      input.value = ''
    }
  }

  const handleRemoveBlockedAreaCode = (code: string) => {
    const current = watch('geographicRestrictions.blockedAreaCodes')
    setValue('geographicRestrictions.blockedAreaCodes', current.filter(c => c !== code))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading quality standards...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Quality Standards</h1>
        <p className="mt-1 text-sm text-gray-600">
          Define call quality requirements and validation rules
        </p>
      </div>

      {error && (
        <SettingsAlert variant="error" dismissible className="mb-6">
          {error}
        </SettingsAlert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Call Duration Requirements */}
        <SettingsSection
          title="Call Duration Requirements"
          description="Set minimum and maximum call duration thresholds"
          icon={<ClockIcon className="h-5 w-5" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SettingsField
              label="Minimum Call Duration"
              description="Shortest acceptable call length"
              error={errors.requiredCallDuration?.min?.message}
            >
              <SettingsInput
                {...register('requiredCallDuration.min', { valueAsNumber: true })}
                type="number"
                min="0"
                rightAddon="seconds"
                placeholder="90"
              />
            </SettingsField>

            <SettingsField
              label="Maximum Call Duration"
              description="Longest billable call length"
              error={errors.requiredCallDuration?.max?.message}
            >
              <SettingsInput
                {...register('requiredCallDuration.max', { valueAsNumber: true })}
                type="number"
                min="0"
                rightAddon="seconds"
                placeholder="1800"
              />
            </SettingsField>
          </div>
        </SettingsSection>

        {/* Required Caller Information */}
        <SettingsCard
          title="Required Caller Information"
          description="Specify which caller details must be collected"
          icon={<UserIcon className="h-5 w-5" />}
        >
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">Basic Information</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('callerInfoRequirements.phoneNumberRequired')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Phone Number (Required)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('callerInfoRequirements.nameRequired')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Full Name</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('callerInfoRequirements.emailRequired')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Email Address</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('callerInfoRequirements.addressRequired')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Physical Address</span>
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">Required Data Fields</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {DATA_FIELDS.map((field) => (
                  <label key={field.field} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={watch('requiredDataFields').some(f => f.field === field.field && f.required)}
                      onChange={(e) => {
                        const current = watch('requiredDataFields')
                        if (e.target.checked) {
                          setValue('requiredDataFields', [
                            ...current.filter(f => f.field !== field.field),
                            { field: field.field, required: true, validation: field.validation }
                          ])
                        } else {
                          setValue('requiredDataFields', current.filter(f => f.field !== field.field))
                        }
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">{field.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </SettingsCard>

        {/* Geographic Restrictions */}
        <SettingsSection
          title="Geographic Restrictions"
          description="Control which locations can generate billable calls"
          icon={<MapPinIcon className="h-5 w-5" />}
        >
          <div className="space-y-6">
            <SettingsCheckboxGroup
              label="Allowed Countries"
              options={COUNTRIES}
              values={watch('geographicRestrictions.allowedCountries')}
              onChange={(values) => setValue('geographicRestrictions.allowedCountries', values)}
              layout="grid"
              gridCols={2}
            />

            <SettingsCheckboxGroup
              label="Allowed US States (leave empty for all)"
              options={US_STATES}
              values={watch('geographicRestrictions.allowedStates')}
              onChange={(values) => setValue('geographicRestrictions.allowedStates', values)}
              layout="grid"
              gridCols={3}
            />

            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">Blocked Area Codes</label>
              <div className="flex gap-2">
                <input
                  id="new-area-code"
                  type="text"
                  placeholder="e.g., 900"
                  className="block flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddBlockedAreaCode}
                >
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {watch('geographicRestrictions.blockedAreaCodes').map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700"
                  >
                    {code}
                    <button
                      type="button"
                      onClick={() => handleRemoveBlockedAreaCode(code)}
                      className="ml-2 text-gray-400 hover:text-gray-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <SettingsToggle
              label="Block VPN/Proxy Traffic"
              description="Reject calls from detected VPN or proxy connections"
              checked={vpnBlocking}
              onChange={(checked) => setValue('geographicRestrictions.vpnBlocking', checked)}
            />
          </div>
        </SettingsSection>

        {/* Time Restrictions */}
        <SettingsCard
          title="Time of Day Restrictions"
          description="Control when calls are accepted"
          icon={<CalendarDaysIcon className="h-5 w-5" />}
        >
          <div className="space-y-6">
            <SettingsCheckboxGroup
              label="Allowed Days"
              options={DAYS_OF_WEEK}
              values={watch('timeRestrictions.allowedDays')}
              onChange={(values) => setValue('timeRestrictions.allowedDays', values)}
              layout="horizontal"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <SettingsField label="Start Time">
                <input
                  type="time"
                  {...register('timeRestrictions.allowedHours.start')}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </SettingsField>

              <SettingsField label="End Time">
                <input
                  type="time"
                  {...register('timeRestrictions.allowedHours.end')}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </SettingsField>

              <SettingsField label="Timezone">
                <SettingsSelect
                  {...register('timeRestrictions.allowedHours.timezone')}
                  options={[
                    { value: 'America/New_York', label: 'Eastern Time' },
                    { value: 'America/Chicago', label: 'Central Time' },
                    { value: 'America/Denver', label: 'Mountain Time' },
                    { value: 'America/Los_Angeles', label: 'Pacific Time' },
                  ]}
                />
              </SettingsField>
            </div>

            <SettingsToggle
              label="Block Calls on Holidays"
              description="Reject calls on major US holidays"
              checked={holidayRestrictions}
              onChange={(checked) => setValue('timeRestrictions.holidayRestrictions', checked)}
            />
          </div>
        </SettingsCard>

        {/* Concurrent Call Limits */}
        <SettingsSection
          title="Concurrent Call Limits"
          description="Prevent call flooding and duplicate submissions"
          icon={<PhoneIcon className="h-5 w-5" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SettingsField
              label="Max Calls Per Hour"
              description="From all sources combined"
              error={errors.concurrentCallLimits?.maxPerHour?.message}
            >
              <SettingsInput
                {...register('concurrentCallLimits.maxPerHour', { valueAsNumber: true })}
                type="number"
                min="0"
                placeholder="100"
              />
            </SettingsField>

            <SettingsField
              label="Max Calls Per Day"
              description="24-hour rolling window"
              error={errors.concurrentCallLimits?.maxPerDay?.message}
            >
              <SettingsInput
                {...register('concurrentCallLimits.maxPerDay', { valueAsNumber: true })}
                type="number"
                min="0"
                placeholder="1000"
              />
            </SettingsField>

            <SettingsField
              label="Max Calls Per Caller"
              description="From same phone number"
              error={errors.concurrentCallLimits?.maxPerCaller?.message}
            >
              <SettingsInput
                {...register('concurrentCallLimits.maxPerCaller', { valueAsNumber: true })}
                type="number"
                min="0"
                placeholder="3"
              />
            </SettingsField>

            <SettingsField
              label="Duplicate Call Window"
              description="Hours before same caller can call again"
              error={errors.concurrentCallLimits?.duplicateCallWindow?.message}
            >
              <SettingsInput
                {...register('concurrentCallLimits.duplicateCallWindow', { valueAsNumber: true })}
                type="number"
                min="0"
                rightAddon="hours"
                placeholder="24"
              />
            </SettingsField>
          </div>
        </SettingsSection>

        {/* Quality Score Configuration */}
        <SettingsCard
          title="Quality Score Configuration"
          description="Define how call quality scores are calculated"
          icon={<ChartBarIcon className="h-5 w-5" />}
        >
          <div className="space-y-6">
            <SettingsField
              label="Minimum Quality Score"
              description="Calls below this score are rejected"
              error={errors.minimumQualityScore?.message}
            >
              <SettingsInput
                {...register('minimumQualityScore', { valueAsNumber: true })}
                type="number"
                min="0"
                max="100"
                rightAddon="%"
                placeholder="70"
              />
            </SettingsField>

            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">
                Quality Score Weights
                {totalWeight !== 100 && (
                  <span className="ml-2 text-sm text-red-600">
                    (Total must equal 100%, currently {totalWeight}%)
                  </span>
                )}
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SettingsField label="Call Duration Weight">
                  <SettingsInput
                    {...register('qualityScoreWeights.duration', { valueAsNumber: true })}
                    type="number"
                    min="0"
                    max="100"
                    rightAddon="%"
                  />
                </SettingsField>
                <SettingsField label="Conversion Rate Weight">
                  <SettingsInput
                    {...register('qualityScoreWeights.conversion', { valueAsNumber: true })}
                    type="number"
                    min="0"
                    max="100"
                    rightAddon="%"
                  />
                </SettingsField>
                <SettingsField label="Caller Info Weight">
                  <SettingsInput
                    {...register('qualityScoreWeights.callerInfo', { valueAsNumber: true })}
                    type="number"
                    min="0"
                    max="100"
                    rightAddon="%"
                  />
                </SettingsField>
                <SettingsField label="Audio Quality Weight">
                  <SettingsInput
                    {...register('qualityScoreWeights.callQuality', { valueAsNumber: true })}
                    type="number"
                    min="0"
                    max="100"
                    rightAddon="%"
                  />
                </SettingsField>
              </div>
            </div>

            <SettingsField
              label="Fraud Tolerance"
              description="Maximum acceptable fraud score"
              error={errors.fraudTolerance?.message}
            >
              <SettingsInput
                {...register('fraudTolerance', { valueAsNumber: true })}
                type="number"
                min="0"
                max="100"
                rightAddon="%"
                placeholder="5"
              />
            </SettingsField>
          </div>
        </SettingsCard>

        {/* Conversion Definition */}
        <SettingsSection
          title="Conversion Definition"
          description="Define what constitutes a successful conversion"
          icon={<ShieldCheckIcon className="h-5 w-5" />}
        >
          <div className="space-y-6">
            <SettingsRadioGroup
              label="Conversion Type"
              options={[
                { value: 'duration', label: 'Call Duration', description: 'Based on minimum call length' },
                { value: 'outcome', label: 'Call Outcome', description: 'Based on disposition code' },
                { value: 'custom', label: 'Custom Events', description: 'Based on specific actions' },
              ]}
              value={conversionType}
              onChange={(value) => setValue('conversionDefinition.type', value)}
            />

            {conversionType === 'duration' && (
              <SettingsField
                label="Minimum Duration for Conversion"
                description="Seconds required for a converted call"
              >
                <SettingsInput
                  {...register('conversionDefinition.duration', { valueAsNumber: true })}
                  type="number"
                  min="0"
                  rightAddon="seconds"
                  placeholder="120"
                />
              </SettingsField>
            )}

            {conversionType === 'outcome' && (
              <SettingsField
                label="Success Outcome"
                description="Disposition code for successful calls"
              >
                <SettingsSelect
                  {...register('conversionDefinition.outcome')}
                  options={[
                    { value: 'sale', label: 'Sale Made' },
                    { value: 'appointment', label: 'Appointment Set' },
                    { value: 'qualified', label: 'Lead Qualified' },
                    { value: 'interested', label: 'Interest Expressed' },
                  ]}
                />
              </SettingsField>
            )}

            <SettingsField
              label="Dispute Window"
              description="Hours to dispute call quality"
              error={errors.disputeWindow?.message}
            >
              <SettingsInput
                {...register('disputeWindow', { valueAsNumber: true })}
                type="number"
                min="0"
                rightAddon="hours"
                placeholder="72"
              />
            </SettingsField>
          </div>
        </SettingsSection>

        {/* Form Actions */}
        <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={() => reset()}
            disabled={!isDirty || isSaving}
          >
            Reset
          </Button>
          <Button
            type="submit"
            loading={isSaving}
            disabled={!isDirty || totalWeight !== 100}
          >
            Save Quality Standards
          </Button>
        </div>
      </form>
    </div>
  )
}