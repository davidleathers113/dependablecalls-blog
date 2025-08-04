// Review & Launch step component for the campaign wizard
import type { UseFormReturn } from 'react-hook-form'
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { Card, CardContent, CardHeader } from '../../../components/common/Card'
import type { CreateCampaignFormData } from '../../../hooks/useCampaignWizard'

interface ReviewLaunchStepProps {
  form: UseFormReturn<CreateCampaignFormData>
  formData: Partial<CreateCampaignFormData>
  verticals: Array<{
    value: string
    label: string
    description: string
  }>
}

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
] as const

export function ReviewLaunchStep({ form, formData: _formData, verticals }: ReviewLaunchStepProps) {  
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
                      verticals.find((v) => v.value === form.watch('vertical'))
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
                    {form.watch('geo_targeting.countries')?.join(', ')}
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
                    {form.watch('payout_settings.payout_model')?.toUpperCase()}
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
}