import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useSettingsStore } from '../../store/settingsStore'
import { useAuthStore } from '../../store/authStore'
import { useCsrfForm } from '../../hooks/useCsrf'
import { Button } from '../../components/common/Button'
import { Card } from '../../components/common/Card'
import { 
  ComputerDesktopIcon,
  SunIcon,
  MoonIcon,
  SparklesIcon,
  ChartBarIcon,
  ClockIcon,
  SpeakerWaveIcon,
  CommandLineIcon,
  ArrowPathIcon,
  ViewColumnsIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import type { UserPreferences } from '../../types/settings'

interface AccountFormData extends UserPreferences {
  [key: string]: unknown
}

export default function AccountSettingsPage() {
  const { userSettings, updateUserSetting, isSaving } = useSettingsStore()
  const { user } = useAuthStore()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const { submitWithCsrf } = useCsrfForm<AccountFormData>()

  const { register, handleSubmit, watch } = useForm<AccountFormData>({
    defaultValues: {
      theme: 'system',
      dashboardLayout: 'expanded',
      defaultPage: '/dashboard',
      tablePageSize: 25,
      soundAlerts: true,
      keyboardShortcuts: true,
      autoRefresh: true,
      refreshInterval: 30,
      compactMode: false,
      showOnboarding: true,
      ...userSettings?.preferences
    } as AccountFormData
  })

  const theme = watch('theme')
  const dashboardLayout = watch('dashboardLayout')

  const onSubmit = submitWithCsrf(async (data: AccountFormData) => {
    await updateUserSetting('preferences', data)
  })

  const handleDataExport = async () => {
    try {
      const response = await fetch('/api/settings/export-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.id}` // TODO: Use proper session token
        },
        body: JSON.stringify({
          includeAuditLog: true,
          format: 'pretty'
        })
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `dce-account-export-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') return
    
    // In a real app, this would call an API to delete the account
    console.log('Account deletion requested')
    setShowDeleteDialog(false)
    setDeleteConfirmation('')
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Account Settings</h2>
        <p className="mt-1 text-sm text-gray-600">
          Manage your account preferences and customization options
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Appearance */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Appearance</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Theme</label>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  {[
                    { value: 'light', icon: SunIcon, label: 'Light' },
                    { value: 'dark', icon: MoonIcon, label: 'Dark' },
                    { value: 'system', icon: ComputerDesktopIcon, label: 'System' }
                  ].map((option) => {
                    const Icon = option.icon
                    return (
                      <label
                        key={option.value}
                        className={`
                          relative flex items-center justify-center p-4 border rounded-lg cursor-pointer
                          ${theme === option.value 
                            ? 'border-primary-500 bg-primary-50' 
                            : 'border-gray-300 hover:bg-gray-50'
                          }
                        `}
                      >
                        <input
                          type="radio"
                          {...register('theme')}
                          value={option.value}
                          className="sr-only"
                        />
                        <div className="text-center">
                          <Icon className={`h-8 w-8 mx-auto mb-2 ${
                            theme === option.value ? 'text-primary-600' : 'text-gray-400'
                          }`} />
                          <span className={`text-sm ${
                            theme === option.value ? 'text-primary-700 font-medium' : 'text-gray-700'
                          }`}>
                            {option.label}
                          </span>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('compactMode')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Compact mode (smaller UI elements)
                </span>
              </label>
            </div>
          </div>
        </Card>

        {/* Dashboard Settings */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Dashboard</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Layout</label>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  {[
                    { value: 'expanded', icon: ViewColumnsIcon, label: 'Expanded', desc: 'Full-width content' },
                    { value: 'compact', icon: ChartBarIcon, label: 'Compact', desc: 'Centered content' }
                  ].map((option) => {
                    const Icon = option.icon
                    return (
                      <label
                        key={option.value}
                        className={`
                          relative flex items-start p-4 border rounded-lg cursor-pointer
                          ${dashboardLayout === option.value 
                            ? 'border-primary-500 bg-primary-50' 
                            : 'border-gray-300 hover:bg-gray-50'
                          }
                        `}
                      >
                        <input
                          type="radio"
                          {...register('dashboardLayout')}
                          value={option.value}
                          className="sr-only"
                        />
                        <Icon className={`h-5 w-5 mt-0.5 ${
                          dashboardLayout === option.value ? 'text-primary-600' : 'text-gray-400'
                        }`} />
                        <div className="ml-3">
                          <span className={`block text-sm font-medium ${
                            dashboardLayout === option.value ? 'text-primary-700' : 'text-gray-700'
                          }`}>
                            {option.label}
                          </span>
                          <span className="text-xs text-gray-500">{option.desc}</span>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">Default Landing Page</span>
                <select
                  {...register('defaultPage')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                >
                  <option value="/dashboard">Dashboard Overview</option>
                  <option value="/campaigns">Campaigns</option>
                  <option value="/calls">Call Logs</option>
                  <option value="/reports">Reports</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">Table Page Size</span>
                <select
                  {...register('tablePageSize', { valueAsNumber: true })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                >
                  <option value={10}>10 rows</option>
                  <option value={25}>25 rows</option>
                  <option value={50}>50 rows</option>
                  <option value={100}>100 rows</option>
                </select>
              </label>
            </div>
          </div>
        </Card>

        {/* Behavior */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Behavior</h3>
            
            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('soundAlerts')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <SpeakerWaveIcon className="h-5 w-5 ml-2 text-gray-400" />
                <span className="ml-2 text-sm text-gray-700">
                  Enable sound alerts for notifications
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('keyboardShortcuts')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <CommandLineIcon className="h-5 w-5 ml-2 text-gray-400" />
                <span className="ml-2 text-sm text-gray-700">
                  Enable keyboard shortcuts
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('showOnboarding')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <SparklesIcon className="h-5 w-5 ml-2 text-gray-400" />
                <span className="ml-2 text-sm text-gray-700">
                  Show onboarding tips and tutorials
                </span>
              </label>
            </div>
          </div>
        </Card>

        {/* Auto-Refresh */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Auto-Refresh</h3>
            
            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('autoRefresh')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <ArrowPathIcon className="h-5 w-5 ml-2 text-gray-400" />
                <span className="ml-2 text-sm text-gray-700">
                  Automatically refresh data
                </span>
              </label>

              {watch('autoRefresh') && (
                <div className="ml-7">
                  <label className="flex items-center">
                    <ClockIcon className="h-5 w-5 mr-2 text-gray-400" />
                    <span className="text-sm text-gray-700 mr-2">Refresh every</span>
                    <input
                      type="number"
                      {...register('refreshInterval', { 
                        min: 10, 
                        max: 300,
                        valueAsNumber: true 
                      })}
                      className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">seconds</span>
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    Minimum: 10 seconds, Maximum: 5 minutes
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Data Management */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Data Management</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-700">Export Account Data</h4>
                  <p className="text-sm text-gray-500">
                    Download all your settings and account data
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleDataExport}
                  className="flex items-center gap-2"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  Export Data
                </Button>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-start">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mt-0.5" />
                  <div className="ml-3 flex-1">
                    <h4 className="text-sm font-medium text-red-900">Delete Account</h4>
                    <p className="text-sm text-red-700 mt-1">
                      Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                      className="mt-3"
                    >
                      <TrashIcon className="h-4 w-4 mr-1" />
                      Delete Account
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>

      {/* Delete Account Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4 text-left">
                <h3 className="text-lg font-medium text-gray-900">Delete Account</h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    This will permanently delete your account and all associated data including:
                  </p>
                  <ul className="mt-2 text-sm text-gray-500 list-disc list-inside">
                    <li>All campaigns and call history</li>
                    <li>Payment and billing information</li>
                    <li>API keys and integrations</li>
                    <li>All settings and preferences</li>
                  </ul>
                  <p className="mt-3 text-sm text-gray-500">
                    Type <span className="font-mono font-semibold">DELETE</span> to confirm:
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                    placeholder="Type DELETE to confirm"
                  />
                </div>
              </div>
            </div>
            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
              <Button
                variant="danger"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmation !== 'DELETE'}
                className="w-full sm:ml-3 sm:w-auto"
              >
                Delete Account
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDeleteDialog(false)
                  setDeleteConfirmation('')
                }}
                className="mt-3 w-full sm:mt-0 sm:w-auto"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}