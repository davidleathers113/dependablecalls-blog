import React, { useState, useEffect, useCallback } from 'react'
import {
  CreditCardIcon,
  BanknotesIcon,
  ChartBarIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/utils/format'
import PaymentForm from './PaymentForm'
import PayoutDashboard from './PayoutDashboard'
import StripeConnectOnboarding from './StripeConnectOnboarding'

interface Transaction {
  id: string
  stripe_payment_intent_id: string
  amount: number
  currency: string
  status: 'pending' | 'processing' | 'succeeded' | 'failed'
  type: 'charge' | 'refund'
  description?: string
  created_at: string
  updated_at: string
}

interface Invoice {
  id: string
  number: string
  amount: number
  currency: string
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'
  due_date: string
  created_at: string
  billing_period: string
}

interface PaymentStats {
  totalSpent: number
  totalEarned: number
  thisMonth: number
  lastMonth: number
  pendingPayments: number
  failedPayments: number
}

export const PaymentDashboard: React.FC = () => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'payouts' | 'invoices'>(
    'overview'
  )
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [stats, setStats] = useState<PaymentStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  const loadPaymentData = useCallback(async () => {
    if (!user) return

    try {
      setIsLoading(true)
      setError('')

      const [transactionsResult, invoicesResult, statsResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('invoices')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
        calculatePaymentStats(user.id),
      ])

      if (transactionsResult.error) throw transactionsResult.error
      if (invoicesResult.error) throw invoicesResult.error

      setTransactions(transactionsResult.data || [])
      setInvoices(invoicesResult.data || [])
      setStats(statsResult)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load payment data'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadPaymentData()
    }
  }, [user, loadPaymentData])

  const calculatePaymentStats = async (userId: string): Promise<PaymentStats> => {
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

    // Get transaction stats
    const { data: transactionStats } = await supabase
      .from('transactions')
      .select('amount, type, status, created_at')
      .eq('user_id', userId)

    if (!transactionStats) {
      return {
        totalSpent: 0,
        totalEarned: 0,
        thisMonth: 0,
        lastMonth: 0,
        pendingPayments: 0,
        failedPayments: 0,
      }
    }

    const successfulCharges = transactionStats.filter(
      (t) => t.type === 'charge' && t.status === 'succeeded'
    )
    const successfulPayouts = transactionStats.filter(
      (t) => t.type === 'payout' && t.status === 'succeeded'
    )
    const thisMonthTransactions = transactionStats.filter(
      (t) => new Date(t.created_at) >= thisMonthStart && t.status === 'succeeded'
    )
    const lastMonthTransactions = transactionStats.filter((t) => {
      const date = new Date(t.created_at)
      return date >= lastMonthStart && date <= lastMonthEnd && t.status === 'succeeded'
    })

    return {
      totalSpent: successfulCharges.reduce((sum, t) => sum + t.amount, 0),
      totalEarned: successfulPayouts.reduce((sum, t) => sum + t.amount, 0),
      thisMonth: thisMonthTransactions.reduce(
        (sum, t) => sum + (t.type === 'charge' ? t.amount : -t.amount),
        0
      ),
      lastMonth: lastMonthTransactions.reduce(
        (sum, t) => sum + (t.type === 'charge' ? t.amount : -t.amount),
        0
      ),
      pendingPayments: transactionStats.filter((t) => t.status === 'processing').length,
      failedPayments: transactionStats.filter((t) => t.status === 'failed').length,
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'succeeded':
      case 'paid':
        return 'text-green-600 bg-green-100'
      case 'processing':
      case 'pending':
        return 'text-yellow-600 bg-yellow-100'
      case 'failed':
      case 'void':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'succeeded':
      case 'paid':
        return <CheckCircleIcon className="w-4 h-4" />
      case 'processing':
      case 'pending':
        return <ClockIcon className="w-4 h-4" />
      case 'failed':
      case 'void':
        return <ExclamationTriangleIcon className="w-4 h-4" />
      default:
        return <ClockIcon className="w-4 h-4" />
    }
  }

  const handlePayInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setShowPaymentForm(true)
  }

  const handlePaymentSuccess = () => {
    setShowPaymentForm(false)
    setSelectedInvoice(null)
    loadPaymentData() // Refresh data
  }

  const handlePaymentError = (error: string) => {
    console.error('Payment error:', error)
    // Could show a toast notification here
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading payment data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
        <button
          onClick={loadPaymentData}
          className="mt-2 text-red-700 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Overview', icon: ChartBarIcon },
            { id: 'payments', name: 'Payments', icon: CreditCardIcon },
            ...(user?.role === 'supplier'
              ? [{ id: 'payouts' as const, name: 'Payouts', icon: BanknotesIcon }]
              : []),
            { id: 'invoices', name: 'Invoices', icon: CalendarIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() =>
                setActiveTab(tab.id as 'overview' | 'payments' | 'payouts' | 'invoices')
              }
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-5 h-5 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <CreditCardIcon className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      {user?.role === 'buyer' ? 'Total Spent' : 'Total Earned'}
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(
                        user?.role === 'buyer' ? stats.totalSpent : stats.totalEarned
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CalendarIcon className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">This Month</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(stats.thisMonth)}
                    </p>
                    {stats.lastMonth > 0 && (
                      <p
                        className={`text-sm mt-1 ${
                          stats.thisMonth > stats.lastMonth ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {stats.thisMonth > stats.lastMonth ? '+' : ''}
                        {(((stats.thisMonth - stats.lastMonth) / stats.lastMonth) * 100).toFixed(1)}
                        %
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <ClockIcon className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Pending</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.pendingPayments}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Failed</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.failedPayments}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
            </div>
            <div className="p-6">
              {transactions.slice(0, 5).length === 0 ? (
                <p className="text-gray-500 text-center">No recent activity</p>
              ) : (
                <div className="space-y-4">
                  {transactions.slice(0, 5).map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`p-2 rounded-lg ${getStatusColor(transaction.status)}`}>
                          {getStatusIcon(transaction.status)}
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-900">
                            {transaction.type === 'charge' ? 'Payment' : 'Refund'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatDate(new Date(transaction.created_at))}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-sm font-medium ${
                            transaction.type === 'charge' ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {transaction.type === 'charge' ? '-' : '+'}
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </p>
                        <p className="text-sm text-gray-500 capitalize">{transaction.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="space-y-6">
          {/* Payment Form Modal */}
          {showPaymentForm && selectedInvoice && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg max-w-md w-full max-h-screen overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-medium text-gray-900">
                      Pay Invoice {selectedInvoice.number}
                    </h3>
                    <button
                      onClick={() => setShowPaymentForm(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <span className="sr-only">Close</span>
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                  <PaymentForm
                    amount={selectedInvoice.amount * 100} // Convert to cents
                    currency={selectedInvoice.currency}
                    description={`Invoice ${selectedInvoice.number} - ${selectedInvoice.billing_period}`}
                    metadata={{
                      invoiceId: selectedInvoice.id,
                      buyerId: user?.id || '',
                      billingPeriod: selectedInvoice.billing_period,
                    }}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Transactions Table */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Payment History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(new Date(transaction.created_at))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                        {transaction.type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <span
                          className={
                            transaction.type === 'charge' ? 'text-red-600' : 'text-green-600'
                          }
                        >
                          {transaction.type === 'charge' ? '-' : '+'}
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}
                        >
                          {getStatusIcon(transaction.status)}
                          <span className="ml-1 capitalize">{transaction.status}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {transaction.description || 'Payment transaction'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'payouts' && user?.role === 'supplier' && (
        <div className="space-y-6">
          {/* Stripe Connect Onboarding */}
          {!user.stripe_account_id && (
            <StripeConnectOnboarding
              onComplete={(accountId) => {
                console.log('Stripe account connected:', accountId)
                // Refresh user data
                loadPaymentData()
              }}
              onError={(error) => {
                console.error('Stripe onboarding error:', error)
              }}
            />
          )}

          {/* Payout Dashboard */}
          {user.stripe_account_id && <PayoutDashboard />}
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Invoices</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {invoice.number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}
                      >
                        {getStatusIcon(invoice.status)}
                        <span className="ml-1 capitalize">{invoice.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(new Date(invoice.due_date))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {invoice.status === 'open' && (
                        <button
                          onClick={() => handlePayInvoice(invoice)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Pay Now
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default PaymentDashboard
