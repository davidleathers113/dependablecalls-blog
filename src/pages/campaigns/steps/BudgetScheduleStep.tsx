// Budget & Schedule step component for the campaign wizard
import React from 'react'
import { UseFormReturn } from 'react-hook-form'
import { CurrencyDollarIcon } from '@heroicons/react/24/outline'
import { Card, CardContent, CardHeader } from '../../../components/common/Card'
import { Input } from '../../../components/common/Input'
import type { CreateCampaignFormData } from '../../../hooks/useCampaignWizard'

interface BudgetScheduleStepProps {
  form: UseFormReturn<CreateCampaignFormData>
  formData: Partial<CreateCampaignFormData>
  updateData: (field: keyof CreateCampaignFormData, value: unknown) => void
  errors: Record<string, string[]>
}

export function BudgetScheduleStep({ form, formData: _formData, updateData: _updateData, errors: _errors }: BudgetScheduleStepProps) { // eslint-disable-line @typescript-eslint/no-unused-vars
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
}