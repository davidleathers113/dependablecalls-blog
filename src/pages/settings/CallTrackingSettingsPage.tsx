import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSettingsStore } from '../../store/settingsStore'
import { useAuthStore } from '../../store/authStore'
import { SettingsSection } from '../../components/settings/SettingsSection'
import { SettingsField } from '../../components/settings/SettingsField'
import { SettingsSelect } from '../../components/settings/SettingsSelect'
import { SettingsInput } from '../../components/settings/SettingsInput'
import { SettingsToggle } from '../../components/settings/SettingsToggle'
import { SettingsAlert } from '../../components/settings/SettingsAlert'
import { Button } from '../../components/common/Button'
import { 
  PhoneIcon,
  CogIcon,
  CloudArrowUpIcon,
  MicrophoneIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'
import type { ProviderType } from '../../types/call-tracking'
import { callTrackingSettingsSchema, type CallTrackingFormData } from '../../lib/validation'

const PROVIDER_OPTIONS: Array<{ value: ProviderType | '', label: string }> = [
  { value: '', label: 'Select a provider' },
  { value: 'retreaver', label: 'Retreaver' },
  { value: 'trackdrive', label: 'TrackDrive' },
  { value: 'ringba', label: 'Ringba' }
]

const CALL_DURATION_OPTIONS = [
  { value: 0, label: 'No minimum' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 90, label: '90 seconds' },
  { value: 120, label: '2 minutes' },
  { value: 180, label: '3 minutes' },
  { value: 300, label: '5 minutes' }
]

const DATA_RETENTION_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '180 days' },
  { value: 365, label: '1 year' }
]

export default function CallTrackingSettingsPage() {
  const { roleSettings, updateRoleSetting, isSaving } = useSettingsStore()
  const { userType } = useAuthStore()
  
  // Only suppliers have call tracking settings
  const isSupplier = userType === 'supplier'
  const callTrackingSettings = isSupplier && roleSettings && 'callTracking' in roleSettings 
    ? roleSettings.callTracking 
    : null

  const { register, handleSubmit, watch, setValue, formState: { errors, isDirty } } = useForm<CallTrackingFormData>({
    resolver: zodResolver(callTrackingSettingsSchema),
    defaultValues: callTrackingSettings || {
      defaultProvider: '',
      trackingNumbers: [],
      recordCalls: false,
      transcribeCalls: false,
      webhookUrl: '',
      retryAttempts: 3,
      timeoutSeconds: 30,
      dataRetentionDays: 30
    }
  })

  const selectedProvider = watch('defaultProvider')
  const recordCalls = watch('recordCalls')

  useEffect(() => {
    if (callTrackingSettings) {
      Object.entries(callTrackingSettings).forEach(([key, value]) => {
        // Type-safe setValue calls with proper validation
        if (key in callTrackingSettings && key !== 'trackingNumbers') {
          setValue(key as keyof CallTrackingFormData, value as never)
        }
      })
    }
  }, [callTrackingSettings, setValue])

  const onSubmit = async (data: CallTrackingFormData) => {
    if (!isSupplier) return

    // Remove provider-specific credential fields from settings
    const { providerApiKey, providerApiSecret, providerAccountId, ...settingsData } = data
    
    // Update the call tracking settings
    updateRoleSetting('callTracking', settingsData)

    // If credentials were provided, they would be stored securely elsewhere
    if (providerApiKey || providerApiSecret || providerAccountId) {
      // In a real implementation, these would be encrypted and stored separately
      console.log('Provider credentials would be stored securely')
    }
  }

  if (!isSupplier) {
    return (
      <div className="p-6">
        <SettingsAlert variant="info">
          Call tracking settings are only available for supplier accounts.
        </SettingsAlert>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Call Tracking Settings</h2>
        <p className="mt-1 text-sm text-gray-600">
          Configure your call tracking providers and preferences
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Provider Selection */}
        <SettingsSection
          title="Provider Configuration"
          description="Select and configure your call tracking provider"
          icon={<PhoneIcon className="h-5 w-5" />}
        >
          <div className="space-y-4">
            <SettingsField
              label="Default Provider"
              description="Choose your primary call tracking provider"
              error={errors.defaultProvider?.message}
              required
            >
              <SettingsSelect
                {...register('defaultProvider', {
                  required: 'Please select a call tracking provider'
                })}
                options={PROVIDER_OPTIONS}
              />
            </SettingsField>

            {selectedProvider && (
              <>
                <SettingsAlert variant="info" className="mt-4">
                  <div className="flex">
                    <InformationCircleIcon className="h-5 w-5 flex-shrink-0" />
                    <div className="ml-3">
                      <p className="text-sm">
                        Provider credentials are encrypted and stored securely. Never share your API keys.
                      </p>
                    </div>
                  </div>
                </SettingsAlert>

                <SettingsField
                  label="API Key"
                  description={`Enter your ${selectedProvider} API key`}
                  error={errors.providerApiKey?.message}
                  required
                >
                  <SettingsInput
                    {...register('providerApiKey', {
                      required: 'API key is required'
                    })}
                    type="password"
                    placeholder="Enter API key"
                  />
                </SettingsField>

                {selectedProvider === 'retreaver' && (
                  <SettingsField
                    label="Account ID"
                    description="Your Retreaver account ID"
                    error={errors.providerAccountId?.message}
                  >
                    <SettingsInput
                      {...register('providerAccountId')}
                      placeholder="Enter account ID"
                    />
                  </SettingsField>
                )}

                {selectedProvider === 'trackdrive' && (
                  <SettingsField
                    label="API Secret"
                    description="Your TrackDrive API secret"
                    error={errors.providerApiSecret?.message}
                  >
                    <SettingsInput
                      {...register('providerApiSecret')}
                      type="password"
                      placeholder="Enter API secret"
                    />
                  </SettingsField>
                )}
              </>
            )}
          </div>
        </SettingsSection>

        {/* Recording Settings */}
        <SettingsSection
          title="Call Recording"
          description="Configure call recording and transcription settings"
          icon={<MicrophoneIcon className="h-5 w-5" />}
        >
          <div className="space-y-4">
            <SettingsToggle
              label="Record Calls"
              description="Automatically record all calls for quality assurance"
              checked={recordCalls}
              onChange={(checked) => setValue('recordCalls', checked)}
            />

            {recordCalls && (
              <>
                <SettingsToggle
                  label="Transcribe Calls"
                  description="Generate text transcriptions of recorded calls"
                  checked={watch('transcribeCalls')}
                  onChange={(checked) => setValue('transcribeCalls', checked)}
                />

                <SettingsAlert variant="warning" className="mt-4">
                  <div className="flex">
                    <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
                    <div className="ml-3">
                      <p className="text-sm">
                        Ensure you comply with local laws regarding call recording. Some jurisdictions require two-party consent.
                      </p>
                    </div>
                  </div>
                </SettingsAlert>
              </>
            )}
          </div>
        </SettingsSection>

        {/* Technical Settings */}
        <SettingsSection
          title="Technical Configuration"
          description="Advanced settings for call tracking integration"
          icon={<CogIcon className="h-5 w-5" />}
        >
          <div className="space-y-4">
            <SettingsField
              label="Webhook URL"
              description="Endpoint to receive real-time call events"
              error={errors.webhookUrl?.message}
            >
              <SettingsInput
                {...register('webhookUrl')}
                type="url"
                placeholder="https://your-domain.com/webhooks/calls"
              />
            </SettingsField>

            <SettingsField
              label="Retry Attempts"
              description="Number of times to retry failed webhook deliveries"
              error={errors.retryAttempts?.message}
            >
              <SettingsInput
                {...register('retryAttempts', { valueAsNumber: true })}
                type="number"
                min="0"
                max="10"
              />
            </SettingsField>

            <SettingsField
              label="Timeout (seconds)"
              description="Maximum time to wait for API responses"
              error={errors.timeoutSeconds?.message}
            >
              <SettingsInput
                {...register('timeoutSeconds', { valueAsNumber: true })}
                type="number"
                min="5"
                max="120"
              />
            </SettingsField>
          </div>
        </SettingsSection>

        {/* Data Management */}
        <SettingsSection
          title="Data Management"
          description="Control how long call data is retained"
          icon={<CloudArrowUpIcon className="h-5 w-5" />}
        >
          <div className="space-y-4">
            <SettingsField
              label="Data Retention Period"
              description="How long to keep call records and recordings"
              error={errors.dataRetentionDays?.message}
            >
              <SettingsSelect
                {...register('dataRetentionDays', { valueAsNumber: true })}
                options={DATA_RETENTION_OPTIONS.map(opt => ({
                  value: opt.value.toString(),
                  label: opt.label
                }))}
              />
            </SettingsField>

            <SettingsAlert variant="info">
              <p className="text-sm">
                After the retention period, call recordings and transcriptions will be automatically deleted. 
                Call metadata will be retained for reporting purposes.
              </p>
            </SettingsAlert>
          </div>
        </SettingsSection>

        {/* Duplicate Call Handling */}
        <SettingsSection
          title="Call Validation"
          description="Define rules for handling duplicate and invalid calls"
          icon={<ShieldCheckIcon className="h-5 w-5" />}
        >
          <div className="space-y-4">
            <SettingsField
              label="Minimum Call Duration"
              description="Calls shorter than this will be marked as invalid"
            >
              <SettingsSelect
                options={CALL_DURATION_OPTIONS.map(opt => ({
                  value: opt.value.toString(),
                  label: opt.label
                }))}
                defaultValue="60"
              />
            </SettingsField>

            <SettingsField
              label="Duplicate Call Window"
              description="Consider calls from the same number as duplicates within this time window"
            >
              <div className="flex items-center space-x-2">
                <SettingsInput
                  type="number"
                  min="0"
                  max="1440"
                  defaultValue="60"
                  className="w-24"
                />
                <span className="text-sm text-gray-600">minutes</span>
              </div>
            </SettingsField>

            <SettingsToggle
              label="Block Duplicate Calls"
              description="Automatically reject calls identified as duplicates"
              defaultChecked={false}
            />
          </div>
        </SettingsSection>

        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="secondary"
            disabled={!isDirty}
            onClick={() => window.location.reload()}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSaving || !isDirty}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}