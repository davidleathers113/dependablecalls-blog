// Call Handling step component for the campaign wizard
import React from 'react'
import { UseFormReturn } from 'react-hook-form'
import { ShieldCheckIcon } from '@heroicons/react/24/outline'
import { Card, CardContent, CardHeader } from '../../../components/common/Card'
import { Input } from '../../../components/common/Input'
import type { CreateCampaignFormData } from '../../../hooks/useCampaignWizard'

interface CallHandlingStepProps {
  form: UseFormReturn<CreateCampaignFormData>
  formData: Partial<CreateCampaignFormData>
  updateData: (field: keyof CreateCampaignFormData, value: unknown) => void
  errors: Record<string, string[]>
}

export function CallHandlingStep({ form, formData: _formData, updateData: _updateData, errors: _errors }: CallHandlingStepProps) { // eslint-disable-line @typescript-eslint/no-unused-vars
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
}