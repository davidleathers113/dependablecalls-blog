import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuthStore } from '../../store/authStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useCsrfForm } from '../../hooks/useCsrf'
import { Input } from '../../components/common/Input'
import { Button } from '../../components/common/Button'
import { CameraIcon } from '@heroicons/react/24/outline'
import { z } from 'zod'
import type { ProfileSettings } from '../../types/settings'
// Profile update schema - defined locally since not in validation.ts
const profileUpdateSchema = z.object({
  displayName: z.string().min(1, 'Display name is required'),
  bio: z.string().optional(),
  timezone: z.string(),
  language: z.string(),
  dateFormat: z.string(),
  phoneFormat: z.string(),
  currency: z.string()
})

type UpdateProfileData = z.infer<typeof profileUpdateSchema>

export default function ProfileSettingsPage() {
  const { user } = useAuthStore()
  const { userSettings, updateUserSetting } = useSettingsStore()
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const { submitWithCsrf } = useCsrfForm<UpdateProfileData>()
  
  const form = useForm<UpdateProfileData>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      displayName: userSettings?.profile.displayName || '',
      bio: userSettings?.profile.bio || '',
      timezone: userSettings?.profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: userSettings?.profile.language || 'en' as const,
      dateFormat: userSettings?.profile.dateFormat || 'MM/DD/YYYY',
      phoneFormat: userSettings?.profile.phoneFormat || 'US',
      currency: userSettings?.profile.currency || 'USD'
    }
  })
  
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }
  
  const onSubmit = submitWithCsrf(async (data) => {
    const updatedProfile: ProfileSettings = {
      ...userSettings!.profile,
      ...data,
      language: data.language as ProfileSettings['language'],
      dateFormat: data.dateFormat as ProfileSettings['dateFormat'],
      phoneFormat: data.phoneFormat as ProfileSettings['phoneFormat'],
      currency: data.currency as ProfileSettings['currency']
    }
    
    await updateUserSetting('profile', updatedProfile)
    
    // Handle avatar upload separately if needed
    if (avatarFile) {
      // Upload avatar logic here
      console.log('Upload avatar:', avatarFile)
    }
  })
  
  // Timezone options
  const timezones = Intl.supportedValuesOf('timeZone').map(tz => ({
    value: tz,
    label: tz.replace(/_/g, ' ')
  }))
  
  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Profile Settings</h2>
        <p className="mt-1 text-sm text-gray-600">
          Manage your personal information and preferences
        </p>
      </div>
      
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Avatar Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-4">
            Profile Picture
          </label>
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="h-24 w-24 rounded-full bg-gray-200 overflow-hidden">
                {(avatarPreview || userSettings?.profile.avatarUrl) ? (
                  <img
                    src={avatarPreview || userSettings?.profile.avatarUrl}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <CameraIcon className="h-8 w-8 text-gray-400" />
                  </div>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
                id="avatar-upload"
              />
            </div>
            <div>
              <label
                htmlFor="avatar-upload"
                className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Change Avatar
              </label>
              <p className="mt-2 text-xs text-gray-500">
                JPG, GIF or PNG. 1MB max.
              </p>
            </div>
          </div>
        </div>
        
        {/* Personal Information */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <Input
              type="email"
              value={user?.email || ''}
              disabled
              className="bg-gray-50"
            />
            <p className="mt-1 text-xs text-gray-500">
              Email cannot be changed
            </p>
          </div>
          
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
              Display Name
            </label>
            <Input
              id="displayName"
              {...form.register('displayName')}
              placeholder="How you want to be called"
              error={form.formState.errors.displayName?.message}
            />
          </div>
        </div>
        
        {/* Bio */}
        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
            Bio
          </label>
          <textarea
            id="bio"
            {...form.register('bio')}
            rows={4}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="Tell us a bit about yourself..."
          />
          {form.formState.errors.bio && (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.bio.message}</p>
          )}
        </div>
        
        {/* Regional Settings */}
        <div className="pt-6 border-t border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Regional Settings</h3>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1">
                Timezone
              </label>
              <select
                id="timezone"
                {...form.register('timezone')}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                {timezones.map(tz => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">
                Language
              </label>
              <select
                id="language"
                {...form.register('language')}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="pt">Português</option>
                <option value="zh">中文</option>
                <option value="ja">日本語</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="dateFormat" className="block text-sm font-medium text-gray-700 mb-1">
                Date Format
              </label>
              <select
                id="dateFormat"
                {...form.register('dateFormat')}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="DD-MMM-YYYY">DD-MMM-YYYY</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="phoneFormat" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Format
              </label>
              <select
                id="phoneFormat"
                {...form.register('phoneFormat')}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="US">(555) 123-4567</option>
                <option value="International">+1 555 123 4567</option>
                <option value="E.164">+15551234567</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-1">
                Currency
              </label>
              <select
                id="currency"
                {...form.register('currency')}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="CAD">CAD - Canadian Dollar</option>
                <option value="AUD">AUD - Australian Dollar</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Form Actions */}
        <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
          >
            Reset
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={form.formState.isSubmitting}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  )
}