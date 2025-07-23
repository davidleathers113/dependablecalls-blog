import React, { useState, useEffect, useCallback } from 'react'
import {
  BanknotesIcon,
  CalendarIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '@/hooks/useAuth'
import { getPayoutHistory, getPayoutBalance } from '@/integrations/stripe/payouts'
import { formatCurrency, formatDate } from '@/utils/format'

interface PayoutData {
  id: string
  amount: number
  currency: string
  status: 'pending' | 'in_transit' | 'paid' | 'failed'
  created: number
  arrival_date: number
  description?: string
  failure_code?: string
  failure_message?: string
}

interface PayoutBalance {
  available: Array<{
    amount: number
    currency: string
  }>
  pending: Array<{
    amount: number
    currency: string
  }>
}

interface PayoutStats {
  thisWeek: number
  thisMonth: number
  lastMonth: number
  total: number
}

export const PayoutDashboard: React.FC = () => {
  const { user } = useAuth()
  const [balance, setBalance] = useState<PayoutBalance | null>(null)
  const [payouts, setPayouts] = useState<PayoutData[]>([])
  const [stats, setStats] = useState<PayoutStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')

  const loadPayoutData = useCallback(async () => {
    if (!user?.stripe_account_id) return

    try {
      setIsLoading(true)
      setError('')

      const [balanceData, payoutHistory] = await Promise.all([
        getPayoutBalance(user.stripe_account_id),
        getPayoutHistory(user.stripe_account_id, { limit: 50 }),
      ])

      setBalance(balanceData)
      setPayouts(payoutHistory)
      setStats(calculateStats(payoutHistory))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load payout data'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [user?.stripe_account_id])

  useEffect(() => {
    if (user?.stripe_account_id) {
      loadPayoutData()
    }
  }, [user?.stripe_account_id, loadPayoutData])

  const calculateStats = (payoutHistory: PayoutData[]): PayoutStats => {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

    const paidPayouts = payoutHistory.filter((p) => p.status === 'paid')

    return {
      thisWeek:
        paidPayouts
          .filter((p) => new Date(p.created * 1000) >= weekAgo)
          .reduce((sum, p) => sum + p.amount, 0) / 100,
      thisMonth:
        paidPayouts
          .filter((p) => new Date(p.created * 1000) >= monthAgo)
          .reduce((sum, p) => sum + p.amount, 0) / 100,
      lastMonth:
        paidPayouts
          .filter((p) => {
            const date = new Date(p.created * 1000)
            return date >= twoMonthsAgo && date < monthAgo
          })
          .reduce((sum, p) => sum + p.amount, 0) / 100,
      total: paidPayouts.reduce((sum, p) => sum + p.amount, 0) / 100,
    }
  }

  const getStatusColor = (status: PayoutData['status']) => {
    switch (status) {
      case 'paid':
        return 'text-green-600 bg-green-100'
      case 'in_transit':
        return 'text-blue-600 bg-blue-100'
      case 'pending':
        return 'text-yellow-600 bg-yellow-100'
      case 'failed':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: PayoutData['status']) => {
    switch (status) {
      case 'paid':
        return <CheckCircleIcon className="w-4 h-4" />
      case 'in_transit':
        return <ClockIcon className="w-4 h-4" />
      case 'pending':
        return <ClockIcon className="w-4 h-4" />
      case 'failed':
        return <ExclamationTriangleIcon className="w-4 h-4" />
      default:
        return <ClockIcon className="w-4 h-4" />
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading payout data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
        <button onClick={loadPayoutData} className="mt-2 text-red-700 hover:text-red-800 underline">
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <BanknotesIcon className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Available Balance</p>
              <p className="text-2xl font-bold text-gray-900">
                {balance?.available?.[0]
                  ? formatCurrency(balance.available[0].amount / 100, balance.available[0].currency)
                  : '$0.00'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ClockIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">
                {balance?.pending?.[0]
                  ? formatCurrency(balance.pending[0].amount / 100, balance.pending[0].currency)
                  : '$0.00'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center">
              <ChartBarIcon className="w-5 h-5 text-gray-400" />
              <span className="ml-2 text-sm font-medium text-gray-600">This Week</span>
            </div>
            <p className="text-lg font-bold text-gray-900 mt-2">{formatCurrency(stats.thisWeek)}</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center">
              <CalendarIcon className="w-5 h-5 text-gray-400" />
              <span className="ml-2 text-sm font-medium text-gray-600">This Month</span>
            </div>
            <p className="text-lg font-bold text-gray-900 mt-2">
              {formatCurrency(stats.thisMonth)}
            </p>
            {stats.lastMonth > 0 && (
              <p
                className={`text-sm mt-1 ${
                  stats.thisMonth > stats.lastMonth ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {stats.thisMonth > stats.lastMonth ? '+' : ''}
                {(((stats.thisMonth - stats.lastMonth) / stats.lastMonth) * 100).toFixed(1)}% vs
                last month
              </p>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center">
              <CalendarIcon className="w-5 h-5 text-gray-400" />
              <span className="ml-2 text-sm font-medium text-gray-600">Last Month</span>
            </div>
            <p className="text-lg font-bold text-gray-900 mt-2">
              {formatCurrency(stats.lastMonth)}
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center">
              <BanknotesIcon className="w-5 h-5 text-gray-400" />
              <span className="ml-2 text-sm font-medium text-gray-600">All Time</span>
            </div>
            <p className="text-lg font-bold text-gray-900 mt-2">{formatCurrency(stats.total)}</p>
          </div>
        </div>
      )}

      {/* Payout History */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Payout History</h3>
        </div>

        {payouts.length === 0 ? (
          <div className="p-6 text-center">
            <BanknotesIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No payouts yet</p>
            <p className="text-sm text-gray-400 mt-1">Payouts are processed weekly on Fridays</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Arrival Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payouts.map((payout) => (
                  <tr key={payout.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(new Date(payout.created * 1000))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(payout.amount / 100, payout.currency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(payout.status)}`}
                      >
                        {getStatusIcon(payout.status)}
                        <span className="ml-1 capitalize">{payout.status.replace('_', ' ')}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {payout.arrival_date ? formatDate(new Date(payout.arrival_date * 1000)) : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {payout.description || 'Payout'}
                      {payout.status === 'failed' && payout.failure_message && (
                        <div className="text-red-600 text-xs mt-1">{payout.failure_message}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Next Payout Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <CalendarIcon className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="ml-3">
            <h4 className="text-sm font-medium text-blue-800">Next Payout</h4>
            <p className="text-sm text-blue-700 mt-1">
              Payouts are processed weekly on Fridays. Available balance will be paid out on the
              next Friday.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PayoutDashboard
