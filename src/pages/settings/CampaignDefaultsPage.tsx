import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSettingsStore } from '../../store/settingsStore'
import { useAuthStore } from '../../store/authStore'
import type { BuyerSettings } from '../../types/settings'
import {
  SettingsSection,
  SettingsCard,
  SettingsField,
  SettingsInput,
  SettingsSelect,
  SettingsToggle,
  SettingsCheckboxGroup,
  SettingsAlert,
} from '../../components/settings'
import { Button } from '../../components/common/Button'
import {
  CurrencyDollarIcon,
  ClockIcon,
  MapPinIcon,
  PhoneIcon,
  BellAlertIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
// CampaignDefaultSettings type is accessed through roleSettings.campaigns

// Validation schema
const campaignDefaultsSchema = z.object({
  defaultBudget: z.object({
    dailyBudget: z.number().min(0).optional(),
    monthlyBudget: z.number().min(0).optional(),
    lifetimeBudget: z.number().min(0).optional(),
    alertPercentage: z.number().min(0).max(100),
  }),
  defaultTargeting: z.object({
    geoTargeting: z.array(z.string()).min(1, 'At least one location is required'),
    ageRange: z.tuple([z.number(), z.number()]).optional(),
    gender: z.array(z.string()).optional(),
    interests: z.array(z.string()).optional(),
  }),
  defaultQuality: z.object({
    minDuration: z.number().min(0),
    maxDuration: z.number().min(0),
    minQualityScore: z.number().min(0).max(100),
  }),
  approvalWorkflow: z.object({
    required: z.boolean(),
    approvers: z.array(z.string()),
    threshold: z.number().min(0),
    autoApprove: z.boolean(),
  }),
  namingConvention: z.string().min(1, 'Naming convention is required'),
  autoArchiveDays: z.number().min(0),
  // Additional fields for the form
  defaultBidAmounts: z.object({
    inbound: z.number().min(0),
    outbound: z.number().min(0),
    transfer: z.number().min(0),
  }),
  businessHours: z.object({
    enabled: z.boolean(),
    timezone: z.string(),
    schedule: z.array(z.object({
      day: z.string(),
      start: z.string(),
      end: z.string(),
      enabled: z.boolean(),
    })),
  }),
  callDurationRequirements: z.object({
    billableMinimum: z.number().min(0),
    qualifiedMinimum: z.number().min(0),
    maximumDuration: z.number().min(0),
  }),
  budgetAlerts: z.object({
    enabled: z.boolean(),
    thresholds: z.array(z.number()),
    recipients: z.array(z.string()),
  }),
})

type CampaignDefaultsFormData = z.infer<typeof campaignDefaultsSchema>

// Available locations for geo-targeting
const AVAILABLE_LOCATIONS = [
  { value: 'us', label: 'United States' },
  { value: 'ca', label: 'Canada' },
  { value: 'uk', label: 'United Kingdom' },
  { value: 'au', label: 'Australia' },
  { value: 'us-ca', label: 'California' },
  { value: 'us-ny', label: 'New York' },
  { value: 'us-tx', label: 'Texas' },
  { value: 'us-fl', label: 'Florida' },
]

// Days of week for business hours
const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

export default function CampaignDefaultsPage() {
  const { user, userType } = useAuthStore()
  const { roleSettings, updateRoleSetting, saveSettings, isLoading, isSaving, error } = useSettingsStore()

  // Get buyer settings with proper type guard
  const buyerSettings = userType === 'buyer' && 
    roleSettings && 
    typeof roleSettings === 'object' && 
    roleSettings !== null &&
    'campaigns' in roleSettings 
    ? (roleSettings as BuyerSettings).campaigns 
    : null

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<CampaignDefaultsFormData>({
    resolver: zodResolver(campaignDefaultsSchema),
    defaultValues: {
      defaultBudget: buyerSettings?.defaultBudget || {
        dailyBudget: undefined,
        monthlyBudget: undefined,
        lifetimeBudget: undefined,
        alertPercentage: 80,
      },
      defaultTargeting: buyerSettings?.defaultTargeting || {
        geoTargeting: ['us'],
        ageRange: undefined,
        gender: undefined,
        interests: undefined,
      },
      defaultQuality: buyerSettings?.defaultQuality || {
        minDuration: 30,
        maxDuration: 600,
        minQualityScore: 70,
      },
      approvalWorkflow: buyerSettings?.approvalWorkflow || {
        required: false,
        approvers: [],
        threshold: 1000,
        autoApprove: true,
      },
      namingConvention: buyerSettings?.namingConvention || '[Campaign Type] - [Date] - [ID]',
      autoArchiveDays: buyerSettings?.autoArchiveDays || 90,
      // Additional defaults
      defaultBidAmounts: {
        inbound: 25,
        outbound: 35,
        transfer: 45,
      },
      businessHours: {
        enabled: false,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        schedule: DAYS_OF_WEEK.map(day => ({
          day,
          start: '09:00',
          end: '17:00',
          enabled: day !== 'Saturday' && day !== 'Sunday',
        })),
      },
      callDurationRequirements: {
        billableMinimum: 30,
        qualifiedMinimum: 90,
        maximumDuration: 1800,
      },
      budgetAlerts: {
        enabled: true,
        thresholds: [50, 75, 90, 100],
        recipients: [user?.email || ''],
      },
    },
  })

  // Watch for form changes
  const businessHoursEnabled = watch('businessHours.enabled')
  const approvalRequired = watch('approvalWorkflow.required')
  const budgetAlertsEnabled = watch('budgetAlerts.enabled')

  // Load settings on mount
  useEffect(() => {
    if (buyerSettings) {
      reset({
        ...buyerSettings,
        // Map additional fields that might not be in settings yet
        defaultBidAmounts: {
          inbound: 25,
          outbound: 35,
          transfer: 45,
        },
        businessHours: {
          enabled: false,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          schedule: DAYS_OF_WEEK.map(day => ({
            day,
            start: '09:00',
            end: '17:00',
            enabled: day !== 'Saturday' && day !== 'Sunday',
          })),
        },
        callDurationRequirements: {
          billableMinimum: 30,
          qualifiedMinimum: 90,
          maximumDuration: 1800,
        },
        budgetAlerts: {
          enabled: true,
          thresholds: [50, 75, 90, 100],
          recipients: [user?.email || ''],
        },
      })
    }
  }, [buyerSettings, reset, user])

  const onSubmit = async (data: CampaignDefaultsFormData) => {
    // Update the campaign defaults in role settings
    updateRoleSetting('campaigns', data)
    
    // Save to backend
    await saveSettings()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Campaign Defaults</h1>
        <p className="mt-1 text-sm text-gray-600">
          Set default values and preferences for new campaigns
        </p>
      </div>

      {error && (
        <SettingsAlert variant="error" dismissible className="mb-6">
          {error}
        </SettingsAlert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Default Bid Amounts */}
        <SettingsSection
          title="Default Bid Amounts"
          description="Set default bid amounts for different call types"
          icon={<CurrencyDollarIcon className="h-5 w-5" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SettingsField
              label="Inbound Calls"
              description="Default bid for inbound calls"
              error={errors.defaultBidAmounts?.inbound?.message}
            >
              <SettingsInput
                {...register('defaultBidAmounts.inbound', { valueAsNumber: true })}
                type="number"
                min="0"
                step="0.01"
                leftAddon="$"
                placeholder="25.00"
              />
            </SettingsField>

            <SettingsField
              label="Outbound Calls"
              description="Default bid for outbound calls"
              error={errors.defaultBidAmounts?.outbound?.message}
            >
              <SettingsInput
                {...register('defaultBidAmounts.outbound', { valueAsNumber: true })}
                type="number"
                min="0"
                step="0.01"
                leftAddon="$"
                placeholder="35.00"
              />
            </SettingsField>

            <SettingsField
              label="Transfer Calls"
              description="Default bid for transfer calls"
              error={errors.defaultBidAmounts?.transfer?.message}
            >
              <SettingsInput
                {...register('defaultBidAmounts.transfer', { valueAsNumber: true })}
                type="number"
                min="0"
                step="0.01"
                leftAddon="$"
                placeholder="45.00"
              />
            </SettingsField>
          </div>
        </SettingsSection>

        {/* Business Hours */}
        <SettingsCard
          title="Business Hours"
          description="Set default operating hours for campaigns"
          icon={<ClockIcon className="h-5 w-5" />}
        >
          <div className="space-y-6">
            <SettingsToggle
              label="Enable Business Hours"
              description="Only accept calls during specified hours"
              checked={businessHoursEnabled}
              onChange={(checked) => setValue('businessHours.enabled', checked)}
            />

            {businessHoursEnabled && (
              <>
                <SettingsField label="Timezone">
                  <SettingsSelect
                    {...register('businessHours.timezone')}
                    options={[
                      { value: 'America/New_York', label: 'Eastern Time (ET)' },
                      { value: 'America/Chicago', label: 'Central Time (CT)' },
                      { value: 'America/Denver', label: 'Mountain Time (MT)' },
                      { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
                    ]}
                  />
                </SettingsField>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700">Schedule</label>
                  {DAYS_OF_WEEK.map((day, index) => (
                    <div key={day} className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        {...register(`businessHours.schedule.${index}.enabled`)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="w-24 text-sm">{day}</span>
                      <input
                        type="time"
                        {...register(`businessHours.schedule.${index}.start`)}
                        disabled={!watch(`businessHours.schedule.${index}.enabled`)}
                        className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-50"
                      />
                      <span className="text-sm text-gray-500">to</span>
                      <input
                        type="time"
                        {...register(`businessHours.schedule.${index}.end`)}
                        disabled={!watch(`businessHours.schedule.${index}.enabled`)}
                        className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-50"
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </SettingsCard>

        {/* Geographic Targeting */}
        <SettingsSection
          title="Geographic Targeting"
          description="Default locations for campaign targeting"
          icon={<MapPinIcon className="h-5 w-5" />}
        >
          <SettingsCheckboxGroup
            label="Default Target Locations"
            description="Select regions to target by default"
            options={AVAILABLE_LOCATIONS}
            values={watch('defaultTargeting.geoTargeting')}
            onChange={(values) => setValue('defaultTargeting.geoTargeting', values)}
            error={errors.defaultTargeting?.geoTargeting?.message}
            layout="grid"
            gridCols={2}
          />
        </SettingsSection>

        {/* Call Duration Requirements */}
        <SettingsCard
          title="Call Duration Requirements"
          description="Set minimum and maximum call duration thresholds"
          icon={<PhoneIcon className="h-5 w-5" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SettingsField
              label="Billable Minimum"
              description="Minimum seconds to bill"
              error={errors.callDurationRequirements?.billableMinimum?.message}
            >
              <SettingsInput
                {...register('callDurationRequirements.billableMinimum', { valueAsNumber: true })}
                type="number"
                min="0"
                rightAddon="seconds"
                placeholder="30"
              />
            </SettingsField>

            <SettingsField
              label="Qualified Minimum"
              description="Minimum seconds for qualified call"
              error={errors.callDurationRequirements?.qualifiedMinimum?.message}
            >
              <SettingsInput
                {...register('callDurationRequirements.qualifiedMinimum', { valueAsNumber: true })}
                type="number"
                min="0"
                rightAddon="seconds"
                placeholder="90"
              />
            </SettingsField>

            <SettingsField
              label="Maximum Duration"
              description="Maximum billable duration"
              error={errors.callDurationRequirements?.maximumDuration?.message}
            >
              <SettingsInput
                {...register('callDurationRequirements.maximumDuration', { valueAsNumber: true })}
                type="number"
                min="0"
                rightAddon="seconds"
                placeholder="1800"
              />
            </SettingsField>
          </div>
        </SettingsCard>

        {/* Budget Alerts */}
        <SettingsSection
          title="Budget Alerts"
          description="Configure budget threshold notifications"
          icon={<BellAlertIcon className="h-5 w-5" />}
        >
          <div className="space-y-6">
            <SettingsToggle
              label="Enable Budget Alerts"
              description="Get notified when campaigns reach budget thresholds"
              checked={budgetAlertsEnabled}
              onChange={(checked) => setValue('budgetAlerts.enabled', checked)}
            />

            {budgetAlertsEnabled && (
              <>
                <SettingsField
                  label="Alert Thresholds"
                  description="Percentage thresholds for budget alerts"
                >
                  <div className="flex gap-2">
                    {[50, 75, 90, 100].map((threshold) => (
                      <label key={threshold} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={watch('budgetAlerts.thresholds').includes(threshold)}
                          onChange={(e) => {
                            const current = watch('budgetAlerts.thresholds')
                            if (e.target.checked) {
                              setValue('budgetAlerts.thresholds', [...current, threshold])
                            } else {
                              setValue('budgetAlerts.thresholds', current.filter(t => t !== threshold))
                            }
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">{threshold}%</span>
                      </label>
                    ))}
                  </div>
                </SettingsField>

                <SettingsField
                  label="Alert Recipients"
                  description="Email addresses to notify (comma-separated)"
                >
                  <SettingsInput
                    value={watch('budgetAlerts.recipients').join(', ')}
                    onChange={(e) => {
                      const emails = e.target.value.split(',').map(email => email.trim()).filter(Boolean)
                      setValue('budgetAlerts.recipients', emails)
                    }}
                    placeholder="email1@example.com, email2@example.com"
                  />
                </SettingsField>
              </>
            )}
          </div>
        </SettingsSection>

        {/* Campaign Approval Workflow */}
        <SettingsCard
          title="Campaign Approval Workflow"
          description="Configure approval requirements for new campaigns"
          icon={<CheckCircleIcon className="h-5 w-5" />}
        >
          <div className="space-y-6">
            <SettingsToggle
              label="Require Approval"
              description="New campaigns must be approved before going live"
              checked={approvalRequired}
              onChange={(checked) => setValue('approvalWorkflow.required', checked)}
            />

            {approvalRequired && (
              <>
                <SettingsField
                  label="Budget Threshold"
                  description="Campaigns above this amount require approval"
                  error={errors.approvalWorkflow?.threshold?.message}
                >
                  <SettingsInput
                    {...register('approvalWorkflow.threshold', { valueAsNumber: true })}
                    type="number"
                    min="0"
                    leftAddon="$"
                    placeholder="1000"
                  />
                </SettingsField>

                <SettingsToggle
                  label="Auto-Approve Below Threshold"
                  description="Automatically approve campaigns below the budget threshold"
                  checked={watch('approvalWorkflow.autoApprove')}
                  onChange={(checked) => setValue('approvalWorkflow.autoApprove', checked)}
                />
              </>
            )}
          </div>
        </SettingsCard>

        {/* Additional Settings */}
        <SettingsSection
          title="Additional Settings"
          description="Other campaign default preferences"
        >
          <div className="space-y-6">
            <SettingsField
              label="Campaign Naming Convention"
              description="Default naming pattern for new campaigns"
              error={errors.namingConvention?.message}
            >
              <SettingsInput
                {...register('namingConvention')}
                placeholder="[Campaign Type] - [Date] - [ID]"
              />
            </SettingsField>

            <SettingsField
              label="Auto-Archive After"
              description="Days of inactivity before campaigns are archived"
              error={errors.autoArchiveDays?.message}
            >
              <SettingsInput
                {...register('autoArchiveDays', { valueAsNumber: true })}
                type="number"
                min="0"
                rightAddon="days"
                placeholder="90"
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
            disabled={!isDirty}
          >
            Save Campaign Defaults
          </Button>
        </div>
      </form>
    </div>
  )
}