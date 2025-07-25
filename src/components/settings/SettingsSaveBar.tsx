import { Button } from '../common/Button'
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface SettingsSaveBarProps {
  onSave: () => void
  onCancel: () => void
  isSaving: boolean
}

export function SettingsSaveBar({ onSave, onCancel, isSaving }: SettingsSaveBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="bg-white border-t border-gray-200 shadow-lg">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-yellow-400 rounded-full animate-pulse" />
              <p className="text-sm text-gray-700">You have unsaved changes</p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={isSaving}
                className="flex items-center gap-2"
              >
                <XMarkIcon className="h-4 w-4" />
                Cancel
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={onSave}
                loading={isSaving}
                className="flex items-center gap-2"
              >
                <CheckIcon className="h-4 w-4" />
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
