import { Switch } from '@headlessui/react'
import { useSettingsStore } from '../../store/settingsStore'
import { classNames } from '../../utils/classNames'
import type { NotificationSettings } from '../../types/settings'

interface NotificationCategory {
  id: keyof NotificationSettings['email']
  label: string
  description: string
  channels: Array<'email' | 'browser' | 'sms'>
  priority?: 'high' | 'medium' | 'low'
}

export default function NotificationSettingsPage() {
  const { userSettings, updateUserSetting } = useSettingsStore()
  
  const notificationCategories: NotificationCategory[] = [
    {
      id: 'newCalls',
      label: 'New Calls',
      description: 'Get notified when you receive new calls',
      channels: ['email', 'browser', 'sms'],
      priority: 'high'
    },
    {
      id: 'callCompleted', 
      label: 'Call Completed',
      description: 'Notifications when calls are completed',
      channels: ['email', 'browser']
    },
    {
      id: 'dailySummary',
      label: 'Daily Summary',
      description: 'Daily performance and activity summary',
      channels: ['email']
    },
    {
      id: 'weeklyReport',
      label: 'Weekly Report',
      description: 'Weekly performance analytics report',
      channels: ['email']
    },
    {
      id: 'campaignAlerts',
      label: 'Campaign Alerts',
      description: 'Important campaign status changes',
      channels: ['email', 'browser', 'sms'],
      priority: 'high'
    },
    {
      id: 'budgetAlerts',
      label: 'Budget Alerts',
      description: 'Notifications about budget thresholds',
      channels: ['email', 'browser'],
      priority: 'high'
    },
    {
      id: 'qualityAlerts',
      label: 'Quality Alerts',
      description: 'Call quality issues and improvements',
      channels: ['email', 'browser']
    },
    {
      id: 'fraudAlerts',
      label: 'Fraud Alerts',
      description: 'Suspicious activity and fraud detection',
      channels: ['email', 'browser', 'sms'],
      priority: 'high'
    },
    {
      id: 'systemUpdates',
      label: 'System Updates',
      description: 'Platform updates and maintenance',
      channels: ['email']
    },
    {
      id: 'marketingEmails',
      label: 'Marketing & Tips',
      description: 'Product tips and industry insights',
      channels: ['email']
    }
  ]
  
  const handleToggle = (
    category: keyof NotificationSettings['email'],
    channel: 'email' | 'browser' | 'sms',
    enabled: boolean
  ) => {
    if (!userSettings) return
    
    const updatedNotifications: NotificationSettings = {
      ...userSettings.notifications,
      [channel]: {
        ...userSettings.notifications[channel],
        [category]: enabled
      }
    }
    
    updateUserSetting('notifications', updatedNotifications)
  }
  
  const handleMasterToggle = (channel: 'email' | 'browser' | 'sms', enabled: boolean) => {
    if (!userSettings) return
    
    const updatedNotifications: NotificationSettings = {
      ...userSettings.notifications,
      [channel]: {
        ...userSettings.notifications[channel],
        enabled
      }
    }
    
    updateUserSetting('notifications', updatedNotifications)
  }
  
  if (!userSettings) return null
  
  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Notification Settings</h2>
        <p className="mt-1 text-sm text-gray-600">
          Choose how and when you want to be notified
        </p>
      </div>
      
      {/* Master Controls */}
      <div className="mb-8 space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <h3 className="text-sm font-medium text-gray-900">Email Notifications</h3>
            <p className="text-sm text-gray-500">Receive notifications via email</p>
          </div>
          <Switch
            checked={userSettings.notifications.email.enabled}
            onChange={(enabled) => handleMasterToggle('email', enabled)}
            className={classNames(
              userSettings.notifications.email.enabled ? 'bg-blue-600' : 'bg-gray-200',
              'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
            )}
          >
            <span
              className={classNames(
                userSettings.notifications.email.enabled ? 'translate-x-5' : 'translate-x-0',
                'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
              )}
            />
          </Switch>
        </div>
        
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <h3 className="text-sm font-medium text-gray-900">Browser Notifications</h3>
            <p className="text-sm text-gray-500">Get alerts in your browser</p>
          </div>
          <Switch
            checked={userSettings.notifications.browser.enabled}
            onChange={(enabled) => handleMasterToggle('browser', enabled)}
            className={classNames(
              userSettings.notifications.browser.enabled ? 'bg-blue-600' : 'bg-gray-200',
              'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
            )}
          >
            <span
              className={classNames(
                userSettings.notifications.browser.enabled ? 'translate-x-5' : 'translate-x-0',
                'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
              )}
            />
          </Switch>
        </div>
        
        {userSettings.notifications.sms && (
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="text-sm font-medium text-gray-900">SMS Notifications</h3>
              <p className="text-sm text-gray-500">Receive text messages for urgent alerts</p>
            </div>
            <Switch
              checked={userSettings.notifications.sms.enabled}
              onChange={(enabled) => handleMasterToggle('sms', enabled)}
              className={classNames(
                userSettings.notifications.sms.enabled ? 'bg-blue-600' : 'bg-gray-200',
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
              )}
            >
              <span
                className={classNames(
                  userSettings.notifications.sms.enabled ? 'translate-x-5' : 'translate-x-0',
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                )}
              />
            </Switch>
          </div>
        )}
      </div>
      
      {/* Notification Categories */}
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Types</h3>
          
          <div className="space-y-4">
            {notificationCategories.map((category) => (
              <div
                key={category.id}
                className={classNames(
                  'p-4 rounded-lg border',
                  category.priority === 'high' ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-white'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">
                      {category.label}
                      {category.priority === 'high' && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                          High Priority
                        </span>
                      )}
                    </h4>
                    <p className="mt-1 text-sm text-gray-500">{category.description}</p>
                  </div>
                  
                  <div className="flex items-center gap-6 ml-4">
                    {category.channels.includes('email') && (
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">Email</p>
                        <Switch
                          checked={userSettings.notifications.email[category.id] ?? false}
                          onChange={(enabled) => handleToggle(category.id, 'email', enabled)}
                          disabled={!userSettings.notifications.email.enabled}
                          className={classNames(
                            userSettings.notifications.email[category.id] ? 'bg-blue-600' : 'bg-gray-200',
                            'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'
                          )}
                        >
                          <span
                            className={classNames(
                              userSettings.notifications.email[category.id] ? 'translate-x-5' : 'translate-x-0',
                              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                            )}
                          />
                        </Switch>
                      </div>
                    )}
                    
                    {category.channels.includes('browser') && (
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">Browser</p>
                        <Switch
                          checked={category.id in userSettings.notifications.browser ? (userSettings.notifications.browser as unknown as Record<string, boolean>)[category.id] ?? false : false}
                          onChange={(enabled) => handleToggle(category.id, 'browser', enabled)}
                          disabled={!userSettings.notifications.browser.enabled}
                          className={classNames(
                            (category.id in userSettings.notifications.browser && (userSettings.notifications.browser as unknown as Record<string, boolean>)[category.id]) ? 'bg-blue-600' : 'bg-gray-200',
                            'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'
                          )}
                        >
                          <span
                            className={classNames(
                              (category.id in userSettings.notifications.browser && (userSettings.notifications.browser as unknown as Record<string, boolean>)[category.id]) ? 'translate-x-5' : 'translate-x-0',
                              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                            )}
                          />
                        </Switch>
                      </div>
                    )}
                    
                    {category.channels.includes('sms') && userSettings.notifications.sms && (
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">SMS</p>
                        <Switch
                          checked={category.id in userSettings.notifications.sms ? (userSettings.notifications.sms as unknown as Record<string, boolean>)[category.id] ?? false : false}
                          onChange={(enabled) => handleToggle(category.id, 'sms', enabled)}
                          disabled={!userSettings.notifications.sms.enabled}
                          className={classNames(
                            (category.id in userSettings.notifications.sms && (userSettings.notifications.sms as unknown as Record<string, boolean>)[category.id]) ? 'bg-blue-600' : 'bg-gray-200',
                            'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'
                          )}
                        >
                          <span
                            className={classNames(
                              (category.id in userSettings.notifications.sms && (userSettings.notifications.sms as unknown as Record<string, boolean>)[category.id]) ? 'translate-x-5' : 'translate-x-0',
                              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                            )}
                          />
                        </Switch>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Quiet Hours */}
        <div className="pt-6 border-t border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quiet Hours</h3>
          <p className="text-sm text-gray-500 mb-4">
            Set hours when you don't want to receive non-urgent notifications
          </p>
          
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-700">Enable Quiet Hours</span>
              <Switch
                checked={userSettings.notifications.quietHours?.enabled ?? false}
                onChange={(enabled) => {
                  const quietHours = userSettings.notifications.quietHours || {
                    enabled: false,
                    start: '22:00',
                    end: '08:00',
                    timezone: userSettings.profile.timezone,
                    weekendsOnly: false,
                    excludeUrgent: true
                  }
                  
                  updateUserSetting('notifications', {
                    ...userSettings.notifications,
                    quietHours: { ...quietHours, enabled }
                  })
                }}
                className={classNames(
                  userSettings.notifications.quietHours?.enabled ? 'bg-blue-600' : 'bg-gray-200',
                  'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                )}
              >
                <span
                  className={classNames(
                    userSettings.notifications.quietHours?.enabled ? 'translate-x-5' : 'translate-x-0',
                    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                  )}
                />
              </Switch>
            </div>
            
            {userSettings.notifications.quietHours?.enabled && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={userSettings.notifications.quietHours.start}
                      onChange={(e) => {
                        updateUserSetting('notifications', {
                          ...userSettings.notifications,
                          quietHours: {
                            ...userSettings.notifications.quietHours!,
                            start: e.target.value
                          }
                        })
                      }}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={userSettings.notifications.quietHours.end}
                      onChange={(e) => {
                        updateUserSetting('notifications', {
                          ...userSettings.notifications,
                          quietHours: {
                            ...userSettings.notifications.quietHours!,
                            end: e.target.value
                          }
                        })
                      }}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={userSettings.notifications.quietHours.excludeUrgent}
                      onChange={(e) => {
                        updateUserSetting('notifications', {
                          ...userSettings.notifications,
                          quietHours: {
                            ...userSettings.notifications.quietHours!,
                            excludeUrgent: e.target.checked
                          }
                        })
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Still send urgent notifications (fraud alerts, system downtime)
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}