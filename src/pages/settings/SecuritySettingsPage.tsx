import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useSettingsStore } from '../../store/settingsStore'
// import { useCsrfForm } from '../../hooks/useCsrf' // Not used
import { Button } from '../../components/common/Button'
import { Input } from '../../components/common/Input'
import { Card } from '../../components/common/Card'
import { 
  ShieldCheckIcon, 
  KeyIcon, 
  DevicePhoneMobileIcon,
  ClockIcon,
  GlobeAltIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import type { SecuritySettings } from '../../types/settings'

type SecurityFormData = SecuritySettings & {
  newIpAddress?: string
}

export default function SecuritySettingsPage() {
  const { userSettings, updateUserSetting, isSaving } = useSettingsStore()
  const [showAddIp, setShowAddIp] = useState(false)
  const [apiKeys, setApiKeys] = useState<Array<{ id: string; name: string; key: string; lastUsed?: string }>>([])
  const [showNewApiKey, setShowNewApiKey] = useState(false)
  const [newApiKeyName, setNewApiKeyName] = useState('')
  // const { submitWithCsrf } = useCsrfForm<SecurityFormData & Record<string, unknown>>() // Not used

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<SecurityFormData>({
    defaultValues: (userSettings?.security || {
      twoFactorEnabled: false,
      sessionTimeout: 30,
      ipWhitelist: [],
      apiAccess: false,
      loginNotifications: true,
      activityAlerts: true,
      dataExportEnabled: true
    }) as SecurityFormData
  })

  const twoFactorEnabled = watch('twoFactorEnabled')
  const ipWhitelist = watch('ipWhitelist') || []

  const onSubmit = async (data: SecurityFormData) => {
    const { newIpAddress, ...securitySettings } = data
    await updateUserSetting('security', securitySettings)
  }

  const addIpAddress = () => {
    const newIp = watch('newIpAddress')
    if (newIp && isValidIp(newIp)) {
      const currentList = ipWhitelist
      if (!currentList.includes(newIp)) {
        setValue('ipWhitelist', [...currentList, newIp])
        setValue('newIpAddress', '')
        setShowAddIp(false)
        handleSubmit(onSubmit)()
      }
    }
  }

  const removeIpAddress = (ip: string) => {
    const filtered = ipWhitelist.filter(item => item !== ip)
    setValue('ipWhitelist', filtered)
    handleSubmit(onSubmit)()
  }

  const isValidIp = (ip: string): boolean => {
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/
    const ipv6Pattern = /^([\da-fA-F]{1,4}:){7}[\da-fA-F]{1,4}$/
    return ipv4Pattern.test(ip) || ipv6Pattern.test(ip)
  }

  const generateApiKey = async () => {
    if (!newApiKeyName) return
    
    // Generate a mock API key
    const key = 'dce_' + Array.from({ length: 32 }, () => 
      Math.random().toString(36).charAt(2)
    ).join('')
    
    const newKey = {
      id: Date.now().toString(),
      name: newApiKeyName,
      key: key,
      lastUsed: undefined
    }
    
    setApiKeys([...apiKeys, newKey])
    setNewApiKeyName('')
    setShowNewApiKey(false)
    
    // In a real app, this would call an API to generate the key
    await updateUserSetting('security', { 
      ...userSettings!.security, 
      apiAccess: true 
    })
  }

  const deleteApiKey = (id: string) => {
    setApiKeys(apiKeys.filter(key => key.id !== id))
    if (apiKeys.length === 1) {
      updateUserSetting('security', { 
        ...userSettings!.security, 
        apiAccess: false 
      })
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Security Settings</h2>
        <p className="mt-1 text-sm text-gray-600">
          Manage your account security and access controls
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Two-Factor Authentication */}
        <Card>
          <div className="p-6">
            <div className="flex items-start">
              <ShieldCheckIcon className="h-6 w-6 text-gray-400 mt-0.5" />
              <div className="ml-3 flex-1">
                <h3 className="text-lg font-medium text-gray-900">Two-Factor Authentication</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Add an extra layer of security to your account
                </p>
                
                <div className="mt-4 space-y-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('twoFactorEnabled')}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Enable two-factor authentication</span>
                  </label>
                  
                  {twoFactorEnabled && (
                    <div className="ml-6 space-y-3">
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700">Authentication Method</span>
                        <select
                          {...register('twoFactorMethod')}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        >
                          <option value="app">Authenticator App</option>
                          <option value="sms">SMS</option>
                          <option value="email">Email</option>
                        </select>
                      </label>
                      
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <DevicePhoneMobileIcon className="h-4 w-4" />
                        Configure 2FA
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Session Management */}
        <Card>
          <div className="p-6">
            <div className="flex items-start">
              <ClockIcon className="h-6 w-6 text-gray-400 mt-0.5" />
              <div className="ml-3 flex-1">
                <h3 className="text-lg font-medium text-gray-900">Session Management</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Control how long you stay logged in
                </p>
                
                <div className="mt-4">
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">Session Timeout (minutes)</span>
                    <Input
                      type="number"
                      {...register('sessionTimeout', { 
                        min: 5, 
                        max: 1440,
                        valueAsNumber: true
                      })}
                      className="mt-1"
                      error={errors.sessionTimeout?.message}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Automatically log out after this period of inactivity (5-1440 minutes)
                    </p>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* IP Whitelist */}
        <Card>
          <div className="p-6">
            <div className="flex items-start">
              <GlobeAltIcon className="h-6 w-6 text-gray-400 mt-0.5" />
              <div className="ml-3 flex-1">
                <h3 className="text-lg font-medium text-gray-900">IP Whitelist</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Restrict access to specific IP addresses
                </p>
                
                <div className="mt-4 space-y-3">
                  {ipWhitelist.length > 0 && (
                    <div className="space-y-2">
                      {ipWhitelist.map((ip) => (
                        <div key={ip} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                          <span className="text-sm font-mono text-gray-700">{ip}</span>
                          <button
                            type="button"
                            onClick={() => removeIpAddress(ip)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {showAddIp ? (
                    <div className="flex items-center gap-2">
                      <Input
                        {...register('newIpAddress', {
                          validate: (value) => !value || isValidIp(value) || 'Invalid IP address'
                        })}
                        placeholder="Enter IP address"
                        className="flex-1"
                        error={errors.newIpAddress?.message}
                      />
                      <Button
                        type="button"
                        onClick={addIpAddress}
                        size="sm"
                      >
                        Add
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowAddIp(false)
                          setValue('newIpAddress', '')
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowAddIp(true)}
                      className="flex items-center gap-2"
                    >
                      <PlusIcon className="h-4 w-4" />
                      Add IP Address
                    </Button>
                  )}
                  
                  {ipWhitelist.length === 0 && !showAddIp && (
                    <p className="text-sm text-gray-500">
                      No IP restrictions. Access allowed from any IP address.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* API Access */}
        <Card>
          <div className="p-6">
            <div className="flex items-start">
              <KeyIcon className="h-6 w-6 text-gray-400 mt-0.5" />
              <div className="ml-3 flex-1">
                <h3 className="text-lg font-medium text-gray-900">API Access</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Manage API keys for programmatic access
                </p>
                
                <div className="mt-4 space-y-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('apiAccess')}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Enable API access</span>
                  </label>
                  
                  {watch('apiAccess') && (
                    <div className="space-y-3">
                      {apiKeys.length > 0 && (
                        <div className="space-y-2">
                          {apiKeys.map((apiKey) => (
                            <div key={apiKey.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{apiKey.name}</p>
                                <p className="text-xs font-mono text-gray-500">{apiKey.key.substring(0, 12)}...</p>
                                {apiKey.lastUsed && (
                                  <p className="text-xs text-gray-500">Last used: {apiKey.lastUsed}</p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => deleteApiKey(apiKey.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {showNewApiKey ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={newApiKeyName}
                            onChange={(e) => setNewApiKeyName(e.target.value)}
                            placeholder="API key name"
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            onClick={generateApiKey}
                            size="sm"
                            disabled={!newApiKeyName}
                          >
                            Generate
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setShowNewApiKey(false)
                              setNewApiKeyName('')
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setShowNewApiKey(true)}
                          className="flex items-center gap-2"
                        >
                          <PlusIcon className="h-4 w-4" />
                          Generate New API Key
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Activity Alerts */}
        <Card>
          <div className="p-6">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-6 w-6 text-gray-400 mt-0.5" />
              <div className="ml-3 flex-1">
                <h3 className="text-lg font-medium text-gray-900">Activity Alerts</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Get notified about important account activities
                </p>
                
                <div className="mt-4 space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('loginNotifications')}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Email me when someone logs into my account
                    </span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('activityAlerts')}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Alert me about suspicious activities
                    </span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('dataExportEnabled')}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Allow data export and download
                    </span>
                  </label>
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
    </div>
  )
}