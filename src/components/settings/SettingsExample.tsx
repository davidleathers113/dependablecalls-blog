/**
 * Example usage of settings components
 * This file demonstrates how to use the various settings components
 */

// React import removed - not needed in React 19
import { useForm } from 'react-hook-form'
import {
  SettingsSection,
  SettingsCard,
  SettingsField,
  SettingsInput,
  SettingsTextarea,
  SettingsSelect,
  SettingsToggle,
  SettingsRadioGroup,
  SettingsCheckboxGroup,
  SettingsAlert,
} from '.'
import { Button } from '../common/Button'
import { BellIcon, KeyIcon, GlobeAltIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'

interface SettingsFormData {
  // Profile
  displayName: string
  bio: string
  timezone: string

  // Notifications
  emailNotifications: boolean
  pushNotifications: boolean
  notificationFrequency: string
  notificationTypes: string[]

  // Security
  twoFactorEnabled: boolean
  apiKey: string
  sessionTimeout: number
}

export function SettingsExample() {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SettingsFormData>({
    defaultValues: {
      displayName: '',
      bio: '',
      timezone: 'America/New_York',
      emailNotifications: true,
      pushNotifications: false,
      notificationFrequency: 'instant',
      notificationTypes: ['security', 'billing'],
      twoFactorEnabled: false,
      apiKey: '',
      sessionTimeout: 30,
    },
  })

  const onSubmit = (data: SettingsFormData) => {
    console.log('Settings saved:', data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Alert Example */}
      <SettingsAlert
        variant="info"
        title="Settings Auto-Save"
        dismissible
        actions={
          <Button size="sm" variant="outline">
            Learn More
          </Button>
        }
      >
        Your settings are automatically saved as you make changes.
      </SettingsAlert>

      {/* Profile Section */}
      <SettingsSection
        title="Profile Information"
        description="Update your personal details and preferences"
        icon={<GlobeAltIcon className="h-6 w-6" />}
      >
        <div className="space-y-6">
          <SettingsField
            label="Display Name"
            description="This is how other users will see you"
            error={errors.displayName?.message}
            required
          >
            <SettingsInput
              {...register('displayName', { required: 'Display name is required' })}
              placeholder="Enter your display name"
            />
          </SettingsField>

          <SettingsField
            label="Bio"
            description="Tell us a bit about yourself"
            error={errors.bio?.message}
          >
            <SettingsTextarea
              {...register('bio')}
              placeholder="Write a short bio..."
              showCharCount
              maxLength={500}
              autoResize
              minRows={3}
              maxRows={6}
            />
          </SettingsField>

          <SettingsField label="Timezone" error={errors.timezone?.message}>
            <SettingsSelect
              {...register('timezone')}
              options={[
                { value: 'America/New_York', label: 'Eastern Time (ET)' },
                { value: 'America/Chicago', label: 'Central Time (CT)' },
                { value: 'America/Denver', label: 'Mountain Time (MT)' },
                { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
              ]}
            />
          </SettingsField>
        </div>
      </SettingsSection>

      {/* Notifications Section */}
      <SettingsCard
        title="Notification Preferences"
        description="Choose how and when you want to be notified"
        icon={<BellIcon className="h-6 w-6" />}
        variant="bordered"
      >
        <div className="space-y-6">
          <SettingsToggle
            label="Email Notifications"
            description="Receive notifications via email"
            checked={watch('emailNotifications')}
            onChange={(checked) => setValue('emailNotifications', checked)}
          />

          <SettingsToggle
            label="Push Notifications"
            description="Receive push notifications in your browser"
            checked={watch('pushNotifications')}
            onChange={(checked) => setValue('pushNotifications', checked)}
          />

          <SettingsRadioGroup
            label="Notification Frequency"
            options={[
              {
                value: 'instant',
                label: 'Instant',
                description: 'Get notified immediately',
              },
              {
                value: 'hourly',
                label: 'Hourly Digest',
                description: 'Receive a summary every hour',
              },
              {
                value: 'daily',
                label: 'Daily Digest',
                description: 'One summary per day',
              },
            ]}
            value={watch('notificationFrequency')}
            onChange={(value) => setValue('notificationFrequency', value)}
          />

          <SettingsCheckboxGroup
            label="Notification Types"
            description="Select which types of notifications you want to receive"
            options={[
              { value: 'security', label: 'Security Alerts' },
              { value: 'billing', label: 'Billing Updates' },
              { value: 'performance', label: 'Performance Reports' },
              { value: 'newsletter', label: 'Newsletter & Tips' },
            ]}
            values={watch('notificationTypes')}
            onChange={(values) => setValue('notificationTypes', values)}
            layout="grid"
            gridCols={2}
          />
        </div>
      </SettingsCard>

      {/* Security Section with Warning */}
      <SettingsCard
        title="Security Settings"
        description="Manage your account security"
        icon={<ShieldCheckIcon className="h-6 w-6" />}
        variant="warning"
        collapsible
        defaultCollapsed
      >
        <div className="space-y-6">
          <SettingsAlert variant="warning" size="sm">
            Changing security settings may affect your account access.
          </SettingsAlert>

          <SettingsToggle
            label="Two-Factor Authentication"
            description="Add an extra layer of security to your account"
            checked={watch('twoFactorEnabled')}
            onChange={(checked) => setValue('twoFactorEnabled', checked)}
            size="lg"
          />

          <SettingsField
            label="API Key"
            description="Your secret API key for programmatic access"
            layout="horizontal"
          >
            <SettingsInput
              {...register('apiKey')}
              type="password"
              leftIcon={<KeyIcon className="h-5 w-5" />}
              rightAddon={
                <Button size="sm" variant="ghost" type="button">
                  Regenerate
                </Button>
              }
            />
          </SettingsField>

          <SettingsField
            label="Session Timeout"
            description="Minutes of inactivity before automatic logout"
            layout="horizontal"
            error={errors.sessionTimeout?.message}
          >
            <SettingsInput
              {...register('sessionTimeout', {
                min: { value: 5, message: 'Minimum 5 minutes' },
                max: { value: 1440, message: 'Maximum 24 hours' },
              })}
              type="number"
              inputSize="sm"
              rightAddon="minutes"
            />
          </SettingsField>
        </div>
      </SettingsCard>

      {/* Form Actions */}
      <div className="flex justify-end gap-4 pt-6 border-t">
        <Button type="button" variant="outline">
          Cancel
        </Button>
        <Button type="submit">Save Changes</Button>
      </div>
    </form>
  )
}
