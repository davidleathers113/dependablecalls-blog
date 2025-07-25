import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useSettingsStore } from '../../store/settingsStore'
import { useAuthStore } from '../../store/authStore'
import { SettingsSection } from '../../components/settings/SettingsSection'
import { SettingsField } from '../../components/settings/SettingsField'
import { SettingsSelect } from '../../components/settings/SettingsSelect'
import { SettingsInput } from '../../components/settings/SettingsInput'
import { SettingsToggle } from '../../components/settings/SettingsToggle'
import { SettingsAlert } from '../../components/settings/SettingsAlert'
import { SettingsRadioGroup } from '../../components/settings/SettingsRadioGroup'
import { Button } from '../../components/common/Button'
import { 
  CreditCardIcon,
  BuildingLibraryIcon,
  DocumentTextIcon,
  CalendarIcon,
  BellIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'
import type { PayoutSettings } from '../../types/settings'

interface PayoutFormData extends PayoutSettings {
  // Additional form-specific fields
  confirmAccountNumber?: string
  confirmRoutingNumber?: string
  acceptTerms?: boolean
}

const PAYOUT_METHOD_OPTIONS = [
  { 
    value: 'bank_transfer', 
    label: 'ACH Bank Transfer',
    description: 'Direct deposit to your bank account (1-2 business days)'
  },
  { 
    value: 'wire', 
    label: 'Wire Transfer',
    description: 'Same-day processing for amounts over $1,000'
  },
  { 
    value: 'paypal', 
    label: 'PayPal',
    description: 'Instant transfers with a 2.9% fee'
  },
  { 
    value: 'check', 
    label: 'Paper Check',
    description: 'Mailed checks (5-7 business days)'
  }
]

const PAYOUT_SCHEDULE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly (Every Monday)' },
  { value: 'biweekly', label: 'Bi-weekly (1st and 15th)' },
  { value: 'monthly', label: 'Monthly (1st of month)' },
  { value: 'net30', label: 'NET 30' }
]

const MINIMUM_PAYOUT_OPTIONS = [
  { value: 50, label: '$50' },
  { value: 100, label: '$100' },
  { value: 250, label: '$250' },
  { value: 500, label: '$500' },
  { value: 1000, label: '$1,000' }
]

export default function PayoutSettingsPage() {
  const { roleSettings, updateRoleSetting, isSaving } = useSettingsStore()
  const { userType } = useAuthStore()
  const [showBankDetails, setShowBankDetails] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState<'unverified' | 'pending' | 'verified'>('unverified')
  
  // Only suppliers have payout settings
  const isSupplier = userType === 'supplier'
  const payoutSettings = isSupplier && roleSettings && 'payouts' in roleSettings 
    ? roleSettings.payouts 
    : null

  const { 
    register, 
    handleSubmit, 
    watch, 
    setValue, 
    formState: { errors, isDirty },
    setError
  } = useForm<PayoutFormData>({
    defaultValues: payoutSettings || {
      preferredMethod: 'bank_transfer',
      minimumPayout: 100,
      payoutSchedule: 'weekly',
      bankDetails: undefined,
      taxInformation: {
        taxId: '',
        vatNumber: '',
        taxExempt: false,
        w9Filed: false
      },
      invoiceSettings: {
        generateAutomatically: true,
        emailTo: [],
        includeDetails: true,
        customTemplate: undefined
      }
    }
  })

  const selectedMethod = watch('preferredMethod')
  const bankDetails = watch('bankDetails')
  const confirmAccountNumber = watch('confirmAccountNumber')
  const confirmRoutingNumber = watch('confirmRoutingNumber')

  useEffect(() => {
    if (payoutSettings) {
      Object.entries(payoutSettings).forEach(([key, value]) => {
        setValue(key as keyof PayoutFormData, value)
      })
      if (payoutSettings.bankDetails) {
        setShowBankDetails(true)
        setVerificationStatus('verified')
      }
    }
  }, [payoutSettings, setValue])

  const validateBankDetails = () => {
    let isValid = true

    if (bankDetails?.accountNumber !== confirmAccountNumber) {
      setError('confirmAccountNumber', {
        type: 'manual',
        message: 'Account numbers do not match'
      })
      isValid = false
    }

    if (bankDetails?.routingNumber !== confirmRoutingNumber) {
      setError('confirmRoutingNumber', {
        type: 'manual',
        message: 'Routing numbers do not match'
      })
      isValid = false
    }

    return isValid
  }

  const onSubmit = async (data: PayoutFormData) => {
    if (!isSupplier) return

    // Validate bank details if ACH is selected
    if (data.preferredMethod === 'bank_transfer' && showBankDetails) {
      if (!validateBankDetails()) return
    }

    // Remove confirmation fields - using rest syntax to exclude them
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { confirmAccountNumber, confirmRoutingNumber, acceptTerms, ...settingsData } = data
    
    // Update the payout settings
    updateRoleSetting('payouts', settingsData)

    // Simulate bank verification process
    if (showBankDetails && verificationStatus === 'unverified') {
      setVerificationStatus('pending')
      setTimeout(() => setVerificationStatus('verified'), 3000)
    }
  }

  if (!isSupplier) {
    return (
      <div className="p-6">
        <SettingsAlert type="info">
          Payout settings are only available for supplier accounts.
        </SettingsAlert>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Payout Settings</h2>
        <p className="mt-1 text-sm text-gray-600">
          Configure how and when you receive payments for your traffic
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Payout Method */}
        <SettingsSection
          title="Payout Method"
          description="Choose how you want to receive your payments"
          icon={<CreditCardIcon className="h-5 w-5" />}
        >
          <div className="space-y-4">
            <SettingsRadioGroup
              {...register('preferredMethod', {
                required: 'Please select a payout method'
              })}
              options={PAYOUT_METHOD_OPTIONS}
              error={errors.preferredMethod?.message}
            />

            {selectedMethod === 'bank_transfer' && (
              <div className="mt-4">
                {!showBankDetails ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowBankDetails(true)}
                    className="w-full"
                  >
                    <BuildingLibraryIcon className="h-4 w-4 mr-2" />
                    Add Bank Account Details
                  </Button>
                ) : (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-900">Bank Account Information</h4>
                      {verificationStatus === 'verified' && (
                        <span className="flex items-center text-sm text-green-600">
                          <CheckCircleIcon className="h-4 w-4 mr-1" />
                          Verified
                        </span>
                      )}
                    </div>

                    <SettingsField
                      label="Account Holder Name"
                      error={errors.bankDetails?.accountName?.message}
                      required
                    >
                      <SettingsInput
                        {...register('bankDetails.accountName', {
                          required: 'Account holder name is required'
                        })}
                        placeholder="John Doe or Company LLC"
                      />
                    </SettingsField>

                    <SettingsField
                      label="Bank Name"
                      error={errors.bankDetails?.bankName?.message}
                      required
                    >
                      <SettingsInput
                        {...register('bankDetails.bankName', {
                          required: 'Bank name is required'
                        })}
                        placeholder="Wells Fargo"
                      />
                    </SettingsField>

                    <SettingsField
                      label="Routing Number"
                      error={errors.bankDetails?.routingNumber?.message}
                      required
                    >
                      <SettingsInput
                        {...register('bankDetails.routingNumber', {
                          required: 'Routing number is required',
                          pattern: {
                            value: /^\d{9}$/,
                            message: 'Routing number must be 9 digits'
                          }
                        })}
                        placeholder="123456789"
                        maxLength={9}
                      />
                    </SettingsField>

                    <SettingsField
                      label="Confirm Routing Number"
                      error={errors.confirmRoutingNumber?.message}
                      required
                    >
                      <SettingsInput
                        {...register('confirmRoutingNumber', {
                          required: 'Please confirm routing number'
                        })}
                        placeholder="123456789"
                        maxLength={9}
                      />
                    </SettingsField>

                    <SettingsField
                      label="Account Number"
                      error={errors.bankDetails?.accountNumber?.message}
                      required
                    >
                      <SettingsInput
                        {...register('bankDetails.accountNumber', {
                          required: 'Account number is required',
                          minLength: {
                            value: 4,
                            message: 'Account number must be at least 4 digits'
                          },
                          maxLength: {
                            value: 17,
                            message: 'Account number must be at most 17 digits'
                          }
                        })}
                        type="password"
                        placeholder="••••••••••"
                      />
                    </SettingsField>

                    <SettingsField
                      label="Confirm Account Number"
                      error={errors.confirmAccountNumber?.message}
                      required
                    >
                      <SettingsInput
                        {...register('confirmAccountNumber', {
                          required: 'Please confirm account number'
                        })}
                        type="password"
                        placeholder="••••••••••"
                      />
                    </SettingsField>

                    {verificationStatus === 'pending' && (
                      <SettingsAlert type="info">
                        <p className="text-sm">
                          Verifying your bank account... This may take a few moments.
                        </p>
                      </SettingsAlert>
                    )}
                  </div>
                )}
              </div>
            )}

            {selectedMethod === 'paypal' && (
              <SettingsField
                label="PayPal Email"
                description="Email address associated with your PayPal account"
                required
              >
                <SettingsInput
                  type="email"
                  placeholder="your-email@example.com"
                />
              </SettingsField>
            )}
          </div>
        </SettingsSection>

        {/* Payout Schedule */}
        <SettingsSection
          title="Payout Schedule"
          description="Set when you want to receive your payments"
          icon={<CalendarIcon className="h-5 w-5" />}
        >
          <div className="space-y-4">
            <SettingsField
              label="Payment Frequency"
              description="How often you want to receive payouts"
              error={errors.payoutSchedule?.message}
            >
              <SettingsSelect
                {...register('payoutSchedule')}
                options={PAYOUT_SCHEDULE_OPTIONS}
              />
            </SettingsField>

            <SettingsField
              label="Minimum Payout Amount"
              description="Payouts will be held until this threshold is reached"
              error={errors.minimumPayout?.message}
            >
              <SettingsSelect
                {...register('minimumPayout', { valueAsNumber: true })}
                options={MINIMUM_PAYOUT_OPTIONS.map(opt => ({
                  value: opt.value.toString(),
                  label: opt.label
                }))}
              />
            </SettingsField>

            <SettingsAlert type="info">
              <p className="text-sm">
                Next payout: <strong>Monday, January 15, 2024</strong> (estimated $2,450.00)
              </p>
            </SettingsAlert>
          </div>
        </SettingsSection>

        {/* Tax Information */}
        <SettingsSection
          title="Tax Information"
          description="Required for compliance and reporting"
          icon={<DocumentTextIcon className="h-5 w-5" />}
        >
          <div className="space-y-4">
            <SettingsField
              label="Tax ID / EIN"
              description="Your Tax Identification Number or Employer Identification Number"
              error={errors.taxInformation?.taxId?.message}
              required
            >
              <SettingsInput
                {...register('taxInformation.taxId', {
                  required: 'Tax ID is required for payouts'
                })}
                placeholder="XX-XXXXXXX"
              />
            </SettingsField>

            <SettingsField
              label="VAT Number"
              description="Required for international suppliers"
              error={errors.taxInformation?.vatNumber?.message}
            >
              <SettingsInput
                {...register('taxInformation.vatNumber')}
                placeholder="Optional"
              />
            </SettingsField>

            <SettingsToggle
              label="Tax Exempt"
              description="Check if your organization has tax-exempt status"
              {...register('taxInformation.taxExempt')}
            />

            <SettingsToggle
              label="W-9 Filed"
              description="I have submitted a completed W-9 form"
              {...register('taxInformation.w9Filed')}
            />

            {!watch('taxInformation.w9Filed') && (
              <SettingsAlert type="warning">
                <div className="flex">
                  <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
                  <div className="ml-3">
                    <p className="text-sm">
                      A completed W-9 form is required before your first payout. 
                      <a href="#" className="ml-1 font-medium underline">Download W-9 Form</a>
                    </p>
                  </div>
                </div>
              </SettingsAlert>
            )}
          </div>
        </SettingsSection>

        {/* Invoice Settings */}
        <SettingsSection
          title="Invoice Settings"
          description="Configure how invoices are generated and delivered"
          icon={<DocumentTextIcon className="h-5 w-5" />}
        >
          <div className="space-y-4">
            <SettingsToggle
              label="Generate Invoices Automatically"
              description="Create invoices for each payout automatically"
              {...register('invoiceSettings.generateAutomatically')}
            />

            <SettingsField
              label="Invoice Recipients"
              description="Email addresses to receive invoice copies (comma-separated)"
            >
              <SettingsInput
                placeholder="billing@company.com, accounting@company.com"
                onChange={(e) => {
                  const emails = e.target.value.split(',').map(email => email.trim()).filter(Boolean)
                  setValue('invoiceSettings.emailTo', emails)
                }}
                defaultValue={watch('invoiceSettings.emailTo')?.join(', ')}
              />
            </SettingsField>

            <SettingsToggle
              label="Include Detailed Call Logs"
              description="Attach detailed call reports to invoices"
              {...register('invoiceSettings.includeDetails')}
            />
          </div>
        </SettingsSection>

        {/* Payout Notifications */}
        <SettingsSection
          title="Payout Notifications"
          description="Get notified about payout status and issues"
          icon={<BellIcon className="h-5 w-5" />}
        >
          <div className="space-y-4">
            <SettingsToggle
              label="Payout Initiated"
              description="Notify when a payout is sent"
              defaultChecked={true}
            />

            <SettingsToggle
              label="Payout Received"
              description="Confirm when funds are deposited"
              defaultChecked={true}
            />

            <SettingsToggle
              label="Payout Failed"
              description="Alert if a payout fails or is rejected"
              defaultChecked={true}
            />

            <SettingsToggle
              label="Threshold Reached"
              description="Notify when minimum payout amount is reached"
              defaultChecked={false}
            />
          </div>
        </SettingsSection>

        {/* Terms Acceptance */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <label className="flex items-start">
            <input
              type="checkbox"
              {...register('acceptTerms', {
                required: 'You must accept the terms to save payout settings'
              })}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded mt-0.5"
            />
            <span className="ml-2 text-sm text-gray-700">
              I understand that payout information is subject to verification and that providing false 
              information may result in account suspension. I agree to the{' '}
              <a href="#" className="text-primary-600 hover:text-primary-500">Payout Terms of Service</a>.
            </span>
          </label>
          {errors.acceptTerms && (
            <p className="mt-1 text-sm text-red-600">{errors.acceptTerms.message}</p>
          )}
        </div>

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
            {isSaving ? 'Saving...' : 'Save Payout Settings'}
          </Button>
        </div>
      </form>
    </div>
  )
}