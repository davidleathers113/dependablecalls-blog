import { useEffect, useState } from 'react'
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
  SettingsRadioGroup,
  SettingsAlert,
} from '../../components/settings'
import { Button } from '../../components/common/Button'
import { Card } from '../../components/common/Card'
import {
  CreditCardIcon,
  BanknotesIcon,
  DocumentTextIcon,
  PlusIcon,
  TrashIcon,
  ShieldCheckIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline'
import type { BillingSettings, PaymentMethod as PaymentMethodType } from '../../types/settings'

// Validation schema
const billingSettingsSchema = z.object({
  paymentMethod: z.enum(['credit_card', 'ach', 'wire', 'invoice']),
  autoRecharge: z.object({
    enabled: z.boolean(),
    threshold: z.number().min(0),
    amount: z.number().min(0),
    maxMonthly: z.number().min(0),
  }),
  invoicePreferences: z.object({
    frequency: z.string(),
    format: z.string(),
    recipients: z.array(z.string().email('Invalid email address')),
    includeDetails: z.boolean(),
  }),
  spendAlerts: z.array(z.object({
    type: z.string(),
    threshold: z.number().min(0),
    recipients: z.array(z.string().email('Invalid email address')),
  })),
  creditLimit: z.number().min(0).optional(),
  approvalRequired: z.object({
    threshold: z.number().min(0),
    approvers: z.array(z.string().email('Invalid email address')),
    escalation: z.array(z.string().email('Invalid email address')),
  }),
})

type BillingSettingsFormData = z.infer<typeof billingSettingsSchema>

// Mock payment methods for demo
interface PaymentMethodDetails {
  id: string
  type: 'credit_card' | 'ach'
  last4: string
  brand?: string
  bankName?: string
  isDefault: boolean
  expiryDate?: string
}

const MOCK_PAYMENT_METHODS: PaymentMethodDetails[] = [
  {
    id: '1',
    type: 'credit_card',
    last4: '4242',
    brand: 'Visa',
    isDefault: true,
    expiryDate: '12/25',
  },
  {
    id: '2',
    type: 'ach',
    last4: '6789',
    bankName: 'Chase Bank',
    isDefault: false,
  },
]

export default function BillingSettingsPage() {
  const { user, userType } = useAuthStore()
  const { roleSettings, updateRoleSetting, saveSettings, isLoading, isSaving, error } = useSettingsStore()
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodDetails[]>(MOCK_PAYMENT_METHODS)
  const [showAddPayment, setShowAddPayment] = useState(false)
  const [, setSelectedPaymentMethod] = useState<string>('1')

  // Get buyer settings
  const buyerSettings = userType === 'buyer' ? roleSettings as { billing: BillingSettings } : null

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<BillingSettingsFormData>({
    resolver: zodResolver(billingSettingsSchema),
    defaultValues: {
      paymentMethod: buyerSettings?.billing?.paymentMethod || 'credit_card',
      autoRecharge: buyerSettings?.billing?.autoRecharge || {
        enabled: false,
        threshold: 100,
        amount: 500,
        maxMonthly: 5000,
      },
      invoicePreferences: buyerSettings?.billing?.invoicePreferences || {
        frequency: 'monthly',
        format: 'pdf',
        recipients: [user?.email || ''],
        includeDetails: true,
      },
      spendAlerts: buyerSettings?.billing?.spendAlerts || [
        { type: 'daily', threshold: 1000, recipients: [user?.email || ''] },
        { type: 'monthly', threshold: 10000, recipients: [user?.email || ''] },
      ],
      creditLimit: buyerSettings?.billing?.creditLimit,
      approvalRequired: buyerSettings?.billing?.approvalRequired || {
        threshold: 5000,
        approvers: [],
        escalation: [],
      },
    },
  })

  // Watch for form changes
  const autoRechargeEnabled = watch('autoRecharge.enabled')
  const spendAlerts = watch('spendAlerts')
  const paymentMethodType = watch('paymentMethod')

  // Load settings on mount
  useEffect(() => {
    if (buyerSettings?.billing) {
      reset(buyerSettings.billing)
    }
  }, [buyerSettings, reset])

  const onSubmit = async (data: BillingSettingsFormData) => {
    // Update billing settings
    updateRoleSetting('billing', data)
    
    // Save to backend
    await saveSettings()
  }

  const handleAddSpendAlert = () => {
    const currentAlerts = watch('spendAlerts')
    setValue('spendAlerts', [
      ...currentAlerts,
      { type: 'custom', threshold: 0, recipients: [user?.email || ''] }
    ])
  }

  const handleRemoveSpendAlert = (index: number) => {
    const currentAlerts = watch('spendAlerts')
    setValue('spendAlerts', currentAlerts.filter((_, i) => i !== index))
  }

  const handleSetDefaultPaymentMethod = (id: string) => {
    setPaymentMethods(methods =>
      methods.map(method => ({
        ...method,
        isDefault: method.id === id,
      }))
    )
    setSelectedPaymentMethod(id)
  }

  const handleRemovePaymentMethod = (id: string) => {
    setPaymentMethods(methods => methods.filter(method => method.id !== id))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading billing settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Billing Settings</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage payment methods, billing preferences, and spending controls
        </p>
      </div>

      {error && (
        <SettingsAlert variant="error" dismissible className="mb-6">
          {error}
        </SettingsAlert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Payment Methods */}
        <SettingsSection
          title="Payment Methods"
          description="Manage your payment methods for billing"
          icon={<CreditCardIcon className="h-5 w-5" />}
          actions={
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowAddPayment(true)}
              className="flex items-center gap-2"
            >
              <PlusIcon className="h-4 w-4" />
              Add Payment Method
            </Button>
          }
        >
          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <Card key={method.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <input
                      type="radio"
                      name="defaultPayment"
                      checked={method.isDefault}
                      onChange={() => handleSetDefaultPaymentMethod(method.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <div className="flex items-center gap-3">
                      {method.type === 'credit_card' ? (
                        <CreditCardIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <BanknotesIcon className="h-5 w-5 text-gray-400" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {method.type === 'credit_card' ? (
                            <>
                              {method.brand} ending in {method.last4}
                              <span className="ml-2 text-gray-500">Exp: {method.expiryDate}</span>
                            </>
                          ) : (
                            <>
                              {method.bankName} ending in {method.last4}
                            </>
                          )}
                        </p>
                        {method.isDefault && (
                          <span className="text-xs text-blue-600">Default payment method</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemovePaymentMethod(method.id)}
                    disabled={method.isDefault}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}

            {paymentMethods.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No payment methods added yet
              </div>
            )}

            <SettingsField
              label="Default Payment Type"
              description="Choose the default payment type for new charges"
            >
              <SettingsRadioGroup
                options={[
                  { value: 'credit_card', label: 'Credit Card', description: 'Instant payment processing' },
                  { value: 'ach', label: 'ACH Transfer', description: 'Bank transfer (2-3 days)' },
                  { value: 'wire', label: 'Wire Transfer', description: 'For large payments' },
                  { value: 'invoice', label: 'Invoice', description: 'Net 30 terms (approval required)' },
                ]}
                value={paymentMethodType}
                onChange={(value) => setValue('paymentMethod', value as PaymentMethodType)}
              />
            </SettingsField>
          </div>
        </SettingsSection>

        {/* Auto-Reload Settings */}
        <SettingsCard
          title="Auto-Reload"
          description="Automatically add funds when balance is low"
          icon={<BanknotesIcon className="h-5 w-5" />}
        >
          <div className="space-y-6">
            <SettingsToggle
              label="Enable Auto-Reload"
              description="Automatically reload your account when balance falls below threshold"
              checked={autoRechargeEnabled}
              onChange={(checked) => setValue('autoRecharge.enabled', checked)}
            />

            {autoRechargeEnabled && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <SettingsField
                    label="Reload Threshold"
                    description="Reload when balance falls below"
                    error={errors.autoRecharge?.threshold?.message}
                  >
                    <SettingsInput
                      {...register('autoRecharge.threshold', { valueAsNumber: true })}
                      type="number"
                      min="0"
                      leftAddon="$"
                      placeholder="100"
                    />
                  </SettingsField>

                  <SettingsField
                    label="Reload Amount"
                    description="Amount to add each time"
                    error={errors.autoRecharge?.amount?.message}
                  >
                    <SettingsInput
                      {...register('autoRecharge.amount', { valueAsNumber: true })}
                      type="number"
                      min="0"
                      leftAddon="$"
                      placeholder="500"
                    />
                  </SettingsField>

                  <SettingsField
                    label="Monthly Limit"
                    description="Maximum auto-reload per month"
                    error={errors.autoRecharge?.maxMonthly?.message}
                  >
                    <SettingsInput
                      {...register('autoRecharge.maxMonthly', { valueAsNumber: true })}
                      type="number"
                      min="0"
                      leftAddon="$"
                      placeholder="5000"
                    />
                  </SettingsField>
                </div>

                <SettingsAlert variant="info" size="sm">
                  Auto-reload charges will use your default payment method
                </SettingsAlert>
              </>
            )}
          </div>
        </SettingsCard>

        {/* Budget Alerts and Limits */}
        <SettingsSection
          title="Budget Alerts & Limits"
          description="Set spending alerts and credit limits"
          icon={<BellAlertIcon className="h-5 w-5" />}
          actions={
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAddSpendAlert}
              className="flex items-center gap-2"
            >
              <PlusIcon className="h-4 w-4" />
              Add Alert
            </Button>
          }
        >
          <div className="space-y-6">
            <SettingsField
              label="Credit Limit"
              description="Maximum outstanding balance allowed (leave empty for no limit)"
              error={errors.creditLimit?.message}
            >
              <SettingsInput
                {...register('creditLimit', { valueAsNumber: true })}
                type="number"
                min="0"
                leftAddon="$"
                placeholder="No limit"
              />
            </SettingsField>

            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">Spending Alerts</label>
              {spendAlerts.map((_, index) => (
                <Card key={index} className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SettingsField label="Alert Type">
                      <SettingsSelect
                        {...register(`spendAlerts.${index}.type`)}
                        options={[
                          { value: 'daily', label: 'Daily Spend' },
                          { value: 'weekly', label: 'Weekly Spend' },
                          { value: 'monthly', label: 'Monthly Spend' },
                          { value: 'campaign', label: 'Per Campaign' },
                          { value: 'custom', label: 'Custom' },
                        ]}
                      />
                    </SettingsField>

                    <SettingsField
                      label="Threshold"
                      error={errors.spendAlerts?.[index]?.threshold?.message}
                    >
                      <SettingsInput
                        {...register(`spendAlerts.${index}.threshold`, { valueAsNumber: true })}
                        type="number"
                        min="0"
                        leftAddon="$"
                        placeholder="1000"
                      />
                    </SettingsField>

                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveSpendAlert(index)}
                        className="mb-1"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </SettingsSection>

        {/* Invoice Preferences */}
        <SettingsCard
          title="Invoice Preferences"
          description="Configure how you receive invoices and statements"
          icon={<DocumentTextIcon className="h-5 w-5" />}
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SettingsField label="Invoice Frequency">
                <SettingsSelect
                  {...register('invoicePreferences.frequency')}
                  options={[
                    { value: 'weekly', label: 'Weekly' },
                    { value: 'biweekly', label: 'Bi-weekly' },
                    { value: 'monthly', label: 'Monthly' },
                    { value: 'quarterly', label: 'Quarterly' },
                  ]}
                />
              </SettingsField>

              <SettingsField label="Invoice Format">
                <SettingsSelect
                  {...register('invoicePreferences.format')}
                  options={[
                    { value: 'pdf', label: 'PDF Document' },
                    { value: 'csv', label: 'CSV Spreadsheet' },
                    { value: 'xml', label: 'XML Data' },
                    { value: 'json', label: 'JSON Data' },
                  ]}
                />
              </SettingsField>
            </div>

            <SettingsToggle
              label="Include Detailed Call Records"
              description="Include individual call details in invoices"
              checked={watch('invoicePreferences.includeDetails')}
              onChange={(checked) => setValue('invoicePreferences.includeDetails', checked)}
            />

            <SettingsField
              label="Invoice Recipients"
              description="Email addresses to receive invoices (comma-separated)"
              error={errors.invoicePreferences?.recipients?.message}
            >
              <SettingsInput
                value={watch('invoicePreferences.recipients').join(', ')}
                onChange={(e) => {
                  const emails = e.target.value.split(',').map(email => email.trim()).filter(Boolean)
                  setValue('invoicePreferences.recipients', emails)
                }}
                placeholder="billing@company.com, accounting@company.com"
              />
            </SettingsField>
          </div>
        </SettingsCard>

        {/* Spending Limits */}
        <SettingsSection
          title="Spending Controls"
          description="Set approval requirements for large expenses"
          icon={<ShieldCheckIcon className="h-5 w-5" />}
        >
          <div className="space-y-6">
            <SettingsField
              label="Approval Threshold"
              description="Charges above this amount require approval"
              error={errors.approvalRequired?.threshold?.message}
            >
              <SettingsInput
                {...register('approvalRequired.threshold', { valueAsNumber: true })}
                type="number"
                min="0"
                leftAddon="$"
                placeholder="5000"
              />
            </SettingsField>

            <SettingsField
              label="Approvers"
              description="Email addresses of users who can approve charges (comma-separated)"
              error={errors.approvalRequired?.approvers?.message}
            >
              <SettingsInput
                value={watch('approvalRequired.approvers').join(', ')}
                onChange={(e) => {
                  const emails = e.target.value.split(',').map(email => email.trim()).filter(Boolean)
                  setValue('approvalRequired.approvers', emails)
                }}
                placeholder="manager@company.com, cfo@company.com"
              />
            </SettingsField>

            <SettingsField
              label="Escalation Contacts"
              description="Notify these users if approval is pending too long (comma-separated)"
              error={errors.approvalRequired?.escalation?.message}
            >
              <SettingsInput
                value={watch('approvalRequired.escalation').join(', ')}
                onChange={(e) => {
                  const emails = e.target.value.split(',').map(email => email.trim()).filter(Boolean)
                  setValue('approvalRequired.escalation', emails)
                }}
                placeholder="executive@company.com"
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
            Save Billing Settings
          </Button>
        </div>
      </form>

      {/* Add Payment Method Modal */}
      {showAddPayment && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Add Payment Method</h3>
            <p className="text-sm text-gray-500 mb-6">
              You will be redirected to our secure payment processor to add a new payment method.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddPayment(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  // In a real app, this would redirect to Stripe or payment processor
                  console.log('Redirect to payment processor')
                  setShowAddPayment(false)
                }}
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}