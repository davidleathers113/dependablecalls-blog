// Basic Info step component for the campaign wizard
import React from 'react'
import { UseFormReturn } from 'react-hook-form'
import { InformationCircleIcon } from '@heroicons/react/24/outline'
import { Card, CardContent, CardHeader } from '../../../components/common/Card'
import { Input } from '../../../components/common/Input'
import type { CreateCampaignFormData } from '../../../hooks/useCampaignWizard'

interface BasicInfoStepProps {
  form: UseFormReturn<CreateCampaignFormData>
  formData: Partial<CreateCampaignFormData>
  updateData: (field: keyof CreateCampaignFormData, value: CreateCampaignFormData[keyof CreateCampaignFormData]) => void
  errors: Record<string, string[]>
  verticals: Array<{
    value: string
    label: string
    description: string
  }>
}

export function BasicInfoStep({ 
  form, 
  formData: _formData, // eslint-disable-line @typescript-eslint/no-unused-vars
  updateData: _updateData, // eslint-disable-line @typescript-eslint/no-unused-vars
  errors: _errors, // eslint-disable-line @typescript-eslint/no-unused-vars
  verticals 
}: BasicInfoStepProps) {
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
              {verticals.map((vertical) => (
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
}