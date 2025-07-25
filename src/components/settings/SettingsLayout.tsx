import { ReactNode } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useSettingsStore } from '../../store/settingsStore'
import { SettingsSidebar } from './SettingsSidebar'
import { SettingsSaveBar } from './SettingsSaveBar'
import { Button } from '../common/Button'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

interface SettingsLayoutProps {
  children?: ReactNode
}

export function SettingsLayout({ children }: SettingsLayoutProps) {
  const navigate = useNavigate()
  const { userType } = useAuthStore()
  const { isDirty, isSaving, saveSettings, error } = useSettingsStore()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="bg-white border-b px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/app/dashboard')}
                className="flex items-center gap-2"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Back to Dashboard
              </Button>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Manage your account settings and preferences
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex">
          {/* Sidebar */}
          <SettingsSidebar userType={userType} />

          {/* Main content */}
          <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="bg-white shadow-sm rounded-lg">{children || <Outlet />}</div>
          </div>
        </div>

        {/* Save bar */}
        {isDirty && (
          <SettingsSaveBar
            onSave={saveSettings}
            onCancel={() => window.location.reload()}
            isSaving={isSaving}
          />
        )}
      </div>
    </div>
  )
}
