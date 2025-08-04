// Targeting step component for the campaign wizard
import type { UseFormReturn } from 'react-hook-form'
import { GlobeAltIcon, ClockIcon } from '@heroicons/react/24/outline'
import { Card, CardContent, CardHeader } from '../../../components/common/Card'
import { Input } from '../../../components/common/Input'
import type { CreateCampaignFormData } from '../../../hooks/useCampaignWizard'

interface TargetingStepProps {
  form: UseFormReturn<CreateCampaignFormData>
  formData: Partial<CreateCampaignFormData>
  updateData: <K extends keyof CreateCampaignFormData>(field: K, value: CreateCampaignFormData[K]) => void
  errors: Record<string, string[]>
}

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
  'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
  'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
]

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
] as const

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
]

export function TargetingStep({ form, formData: _formData, updateData: _updateData, errors: _errors }: TargetingStepProps) {  
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
}