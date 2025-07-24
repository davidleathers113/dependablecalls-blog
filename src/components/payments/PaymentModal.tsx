import React, { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import QuickTopUpForm from './QuickTopUpForm'
import PaymentForm from './PaymentForm'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  type: 'topup' | 'invoice'
  invoiceData?: {
    amount: number
    invoiceId: string
    description: string
    billingPeriod: string
  }
  onSuccess?: (paymentIntentId: string, amount?: number) => void
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  type,
  invoiceData,
  onSuccess,
}) => {
  const handleSuccess = (paymentIntentId: string, amount?: number) => {
    onSuccess?.(paymentIntentId, amount)
    // Close modal after a short delay to show success message
    setTimeout(() => {
      onClose()
    }, 2000)
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                    {type === 'topup' ? 'Add Funds' : 'Pay Invoice'}
                  </Dialog.Title>
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                <div className="mt-2">
                  {type === 'topup' ? (
                    <QuickTopUpForm onSuccess={handleSuccess} onCancel={onClose} />
                  ) : invoiceData ? (
                    <PaymentForm
                      amount={invoiceData.amount}
                      description={invoiceData.description}
                      metadata={{
                        invoiceId: invoiceData.invoiceId,
                        buyerId: '', // Will be filled by PaymentForm from auth
                        billingPeriod: invoiceData.billingPeriod,
                      }}
                      onSuccess={handleSuccess}
                      onError={(error) => console.error('Payment error:', error)}
                    />
                  ) : (
                    <div className="text-center py-8 text-gray-500">No invoice data provided</div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
