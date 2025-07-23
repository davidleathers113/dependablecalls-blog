# Settings Pages

# Page Structure
- `SettingsOverview.tsx` - Main settings dashboard
- `ProfileSettings.tsx` - User profile management
- `AccountSettings.tsx` - Account preferences
- `NotificationSettings.tsx` - Notification preferences
- `SecuritySettings.tsx` - Password and 2FA
- `IntegrationSettings.tsx` - API keys and webhooks
- `BillingSettings.tsx` - Payment and billing preferences

# Settings Overview
```tsx
export function SettingsOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const settingsCategories = [
    {
      id: 'profile',
      title: 'Profile Settings',
      description: 'Manage your personal information and company details',
      icon: UserIcon,
      href: '/settings/profile',
    },
    {
      id: 'account',
      title: 'Account Preferences',
      description: 'Configure your account settings and preferences',
      icon: CogIcon,
      href: '/settings/account',
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Control how and when you receive notifications',
      icon: BellIcon,
      href: '/settings/notifications',
    },
    {
      id: 'security',
      title: 'Security',
      description: 'Manage your password and two-factor authentication',
      icon: ShieldCheckIcon,
      href: '/settings/security',
    },
    {
      id: 'integrations',
      title: 'Integrations',
      description: 'API keys, webhooks, and third-party integrations',
      icon: CommandLineIcon,
      href: '/settings/integrations',
    },
    {
      id: 'billing',
      title: 'Billing',
      description: 'Payment methods and billing preferences',
      icon: CreditCardIcon,
      href: '/settings/billing',
    },
  ];
  
  return (
    <AppLayout>
      <div className="settings-overview">
        <PageHeader
          title="Settings"
          subtitle="Manage your account and preferences"
        />
        
        <div className="settings-grid">
          {settingsCategories.map(category => (
            <SettingsCard
              key={category.id}
              {...category}
              onClick={() => navigate(category.href)}
            />
          ))}
        </div>
        
        <div className="account-summary">
          <AccountSummaryCard user={user} />
        </div>
      </div>
    </AppLayout>
  );
}
```

# Profile Settings
```tsx
export function ProfileSettings() {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  
  const form = useForm({
    resolver: zodResolver(profileSettingsSchema),
    defaultValues: {
      firstName: user?.first_name || '',
      lastName: user?.last_name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      company: user?.profile?.company || '',
      title: user?.profile?.title || '',
      bio: user?.profile?.bio || '',
      website: user?.profile?.website || '',
      timezone: user?.profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });
  
  const handleSave = async (data: ProfileFormData) => {
    try {
      await updateUser({
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone,
        profile: {
          company: data.company,
          title: data.title,
          bio: data.bio,
          website: data.website,
          timezone: data.timezone,
        },
      });
      
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };
  
  return (
    <AppLayout>
      <div className="profile-settings">
        <PageHeader
          title="Profile Settings"
          breadcrumbs={[
            { label: 'Settings', href: '/settings' },
            { label: 'Profile' },
          ]}
          action={
            <Button
              onClick={() => setIsEditing(!isEditing)}
              variant={isEditing ? 'outline' : 'default'}
            >
              {isEditing ? 'Cancel' : 'Edit Profile'}
            </Button>
          }
        />
        
        <div className="profile-content">
          <div className="profile-avatar">
            <AvatarUpload
              currentAvatar={user?.profile?.avatar_url}
              onUpload={handleAvatarUpload}
              disabled={!isEditing}
            />
          </div>
          
          <form onSubmit={form.handleSubmit(handleSave)}>
            <div className="profile-form">
              <div className="form-section">
                <h3>Personal Information</h3>
                
                <div className="form-grid">
                  <Input
                    {...form.register('firstName')}
                    label="First Name"
                    disabled={!isEditing}
                    error={form.formState.errors.firstName?.message}
                  />
                  <Input
                    {...form.register('lastName')}
                    label="Last Name"
                    disabled={!isEditing}
                    error={form.formState.errors.lastName?.message}
                  />
                </div>
                
                <Input
                  {...form.register('email')}
                  type="email"
                  label="Email Address"
                  disabled // Email cannot be changed
                  error={form.formState.errors.email?.message}
                />
                
                <Input
                  {...form.register('phone')}
                  type="tel"
                  label="Phone Number"
                  disabled={!isEditing}
                  error={form.formState.errors.phone?.message}
                />
              </div>
              
              <div className="form-section">
                <h3>Company Information</h3>
                
                <Input
                  {...form.register('company')}
                  label="Company Name"
                  disabled={!isEditing}
                  error={form.formState.errors.company?.message}
                />
                
                <Input
                  {...form.register('title')}
                  label="Job Title"
                  disabled={!isEditing}
                  error={form.formState.errors.title?.message}
                />
                
                <Textarea
                  {...form.register('bio')}
                  label="Bio"
                  placeholder="Tell us about yourself..."
                  rows={4}
                  disabled={!isEditing}
                  error={form.formState.errors.bio?.message}
                />
                
                <Input
                  {...form.register('website')}
                  type="url"
                  label="Website"
                  placeholder="https://"
                  disabled={!isEditing}
                  error={form.formState.errors.website?.message}
                />
              </div>
              
              <div className="form-section">
                <h3>Preferences</h3>
                
                <Select
                  {...form.register('timezone')}
                  label="Timezone"
                  options={TIMEZONE_OPTIONS}
                  disabled={!isEditing}
                  error={form.formState.errors.timezone?.message}
                />
              </div>
              
              {isEditing && (
                <div className="form-actions">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      form.reset();
                      setIsEditing(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    loading={form.formState.isSubmitting}
                  >
                    Save Changes
                  </Button>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
```

# Notification Settings
```tsx
export function NotificationSettings() {
  const { data: settings, loading } = useNotificationSettings();
  const [preferences, setPreferences] = useState<NotificationPreferences>({});
  
  useEffect(() => {
    if (settings) {
      setPreferences(settings);
    }
  }, [settings]);
  
  const handleToggle = async (type: NotificationType, method: NotificationMethod, enabled: boolean) => {
    const updated = {
      ...preferences,
      [type]: {
        ...preferences[type],
        [method]: enabled,
      },
    };
    
    setPreferences(updated);
    
    try {
      await notificationService.updatePreferences(updated);
      toast.success('Notification preferences updated');
    } catch (error) {
      toast.error('Failed to update preferences');
      // Revert on error
      setPreferences(preferences);
    }
  };
  
  if (loading) return <SettingsSkeleton />;
  
  const notificationTypes: NotificationTypeConfig[] = [
    {
      id: 'new_calls',
      title: 'New Calls',
      description: 'Notifications when you receive new calls',
      methods: ['email', 'push', 'sms'],
    },
    {
      id: 'call_completed',
      title: 'Call Completed',
      description: 'Notifications when calls are completed',
      methods: ['email', 'push'],
    },
    {
      id: 'fraud_detected',
      title: 'Fraud Detected',
      description: 'Alerts when fraud is detected on your campaigns',
      methods: ['email', 'push', 'sms'],
      priority: 'high',
    },
    {
      id: 'payout_processed',
      title: 'Payout Processed',
      description: 'Notifications when payouts are processed',
      methods: ['email', 'push'],
    },
    {
      id: 'budget_alerts',
      title: 'Budget Alerts',
      description: 'Alerts when campaign budgets are running low',
      methods: ['email', 'push'],
    },
    {
      id: 'system_updates',
      title: 'System Updates',
      description: 'Important platform updates and maintenance notifications',
      methods: ['email'],
    },
  ];
  
  return (
    <AppLayout>
      <div className="notification-settings">
        <PageHeader
          title="Notification Settings"
          subtitle="Choose how and when you want to be notified"
          breadcrumbs={[
            { label: 'Settings', href: '/settings' },
            { label: 'Notifications' },
          ]}
        />
        
        <div className="notification-preferences">
          <div className="preferences-header">
            <div className="header-labels">
              <span>Notification Type</span>
              <div className="method-labels">
                <span>Email</span>
                <span>Push</span>
                <span>SMS</span>
              </div>
            </div>
          </div>
          
          <div className="preferences-list">
            {notificationTypes.map(type => (
              <NotificationPreferenceRow
                key={type.id}
                type={type}
                preferences={preferences[type.id] || {}}
                onToggle={(method, enabled) => handleToggle(type.id, method, enabled)}
              />
            ))}
          </div>
          
          <div className="quiet-hours">
            <h3>Quiet Hours</h3>
            <p>Set hours when you don't want to receive notifications</p>
            
            <QuietHoursSelector
              value={preferences.quietHours}
              onChange={(quietHours) => setPreferences(prev => ({
                ...prev,
                quietHours,
              }))}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
```

# Security Settings
```tsx
export function SecuritySettings() {
  const { user } = useAuth();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const { data: securityInfo } = useSecurityInfo();
  
  const handlePasswordChange = async (data: PasswordChangeData) => {
    try {
      await authService.changePassword(data.currentPassword, data.newPassword);
      setShowPasswordForm(false);
      toast.success('Password changed successfully');
    } catch (error) {
      toast.error('Failed to change password');
    }
  };
  
  const handle2FAToggle = async (enabled: boolean) => {
    if (enabled) {
      setShow2FASetup(true);
    } else {
      try {
        await authService.disable2FA();
        toast.success('Two-factor authentication disabled');
      } catch (error) {
        toast.error('Failed to disable 2FA');
      }
    }
  };
  
  return (
    <AppLayout>
      <div className="security-settings">
        <PageHeader
          title="Security Settings"
          subtitle="Manage your account security and authentication"
          breadcrumbs={[
            { label: 'Settings', href: '/settings' },
            { label: 'Security' },
          ]}
        />
        
        <div className="security-sections">
          <div className="security-section">
            <div className="section-header">
              <h3>Password</h3>
              <p>Change your account password</p>
            </div>
            
            <div className="section-content">
              <div className="password-info">
                <span>Last changed: {formatDate(securityInfo.passwordLastChanged)}</span>
                <Button
                  variant="outline"
                  onClick={() => setShowPasswordForm(true)}
                >
                  Change Password
                </Button>
              </div>
            </div>
            
            {showPasswordForm && (
              <PasswordChangeForm
                onSubmit={handlePasswordChange}
                onCancel={() => setShowPasswordForm(false)}
              />
            )}
          </div>
          
          <div className="security-section">
            <div className="section-header">
              <h3>Two-Factor Authentication</h3>
              <p>Add an extra layer of security to your account</p>
            </div>
            
            <div className="section-content">
              <div className="2fa-status">
                <div className="status-info">
                  <div className={`status-indicator ${securityInfo.twoFactorEnabled ? 'enabled' : 'disabled'}`} />
                  <span>
                    {securityInfo.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                
                <Switch
                  checked={securityInfo.twoFactorEnabled}
                  onChange={handle2FAToggle}
                />
              </div>
              
              {securityInfo.twoFactorEnabled && (
                <div className="2fa-details">
                  <p>Configured on: {formatDate(securityInfo.twoFactorSetupDate)}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShow2FASetup(true)}
                  >
                    Reconfigure
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          <div className="security-section">
            <div className="section-header">
              <h3>Login History</h3>
              <p>Recent login activity on your account</p>
            </div>
            
            <div className="section-content">
              <LoginHistoryTable data={securityInfo.loginHistory} />
            </div>
          </div>
          
          <div className="security-section">
            <div className="section-header">
              <h3>Active Sessions</h3>
              <p>Devices and browsers currently signed in</p>
            </div>
            
            <div className="section-content">
              <ActiveSessionsList
                sessions={securityInfo.activeSessions}
                onTerminate={handleTerminateSession}
              />
            </div>
          </div>
        </div>
        
        {show2FASetup && (
          <TwoFactorSetupModal
            onClose={() => setShow2FASetup(false)}
            onComplete={() => {
              setShow2FASetup(false);
              toast.success('Two-factor authentication enabled');
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}
```

# Integration Settings
```tsx
export function IntegrationSettings() {
  const { data: apiKeys, loading } = useAPIKeys();
  const { data: webhooks } = useWebhooks();
  const [showKeyGenerator, setShowKeyGenerator] = useState(false);
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  
  const handleGenerateKey = async (keyData: APIKeyData) => {
    try {
      const newKey = await apiService.generateKey(keyData);
      toast.success('API key generated successfully');
      setShowKeyGenerator(false);
    } catch (error) {
      toast.error('Failed to generate API key');
    }
  };
  
  const handleRevokeKey = async (keyId: string) => {
    try {
      await apiService.revokeKey(keyId);
      toast.success('API key revoked');
    } catch (error) {
      toast.error('Failed to revoke API key');
    }
  };
  
  return (
    <AppLayout>
      <div className="integration-settings">
        <PageHeader
          title="Integration Settings"
          subtitle="Manage API keys, webhooks, and third-party integrations"
          breadcrumbs={[
            { label: 'Settings', href: '/settings' },
            { label: 'Integrations' },
          ]}
        />
        
        <div className="integration-sections">
          <div className="integration-section">
            <div className="section-header">
              <h3>API Keys</h3>
              <p>Manage API keys for programmatic access</p>
              <Button onClick={() => setShowKeyGenerator(true)}>
                Generate New Key
              </Button>
            </div>
            
            <div className="api-keys-list">
              {apiKeys?.map(key => (
                <APIKeyCard
                  key={key.id}
                  apiKey={key}
                  onRevoke={() => handleRevokeKey(key.id)}
                  onEdit={() => editAPIKey(key.id)}
                />
              ))}
            </div>
          </div>
          
          <div className="integration-section">
            <div className="section-header">
              <h3>Webhooks</h3>
              <p>Configure webhook endpoints for real-time notifications</p>
              <Button onClick={() => setShowWebhookForm(true)}>
                Add Webhook
              </Button>
            </div>
            
            <div className="webhooks-list">
              {webhooks?.map(webhook => (
                <WebhookCard
                  key={webhook.id}
                  webhook={webhook}
                  onTest={() => testWebhook(webhook.id)}
                  onEdit={() => editWebhook(webhook.id)}
                  onDelete={() => deleteWebhook(webhook.id)}
                />
              ))}
            </div>
          </div>
          
          <div className="integration-section">
            <div className="section-header">
              <h3>Third-Party Integrations</h3>
              <p>Connect with external services and platforms</p>
            </div>
            
            <div className="integrations-grid">
              <IntegrationCard
                name="Zapier"
                description="Automate workflows with 5000+ apps"
                status={getIntegrationStatus('zapier')}
                onConnect={() => connectIntegration('zapier')}
              />
              <IntegrationCard
                name="Salesforce"
                description="Sync leads with your CRM"
                status={getIntegrationStatus('salesforce')}
                onConnect={() => connectIntegration('salesforce')}
              />
              <IntegrationCard
                name="HubSpot"
                description="Import leads to your marketing platform"
                status={getIntegrationStatus('hubspot')}
                onConnect={() => connectIntegration('hubspot')}
              />
            </div>
          </div>
        </div>
        
        {showKeyGenerator && (
          <APIKeyGeneratorModal
            onClose={() => setShowKeyGenerator(false)}
            onGenerate={handleGenerateKey}
          />
        )}
        
        {showWebhookForm && (
          <WebhookFormModal
            onClose={() => setShowWebhookForm(false)}
            onSave={handleWebhookSave}
          />
        )}
      </div>
    </AppLayout>
  );
}
```

# Account Settings
```tsx
export function AccountSettings() {
  const { user, deleteAccount } = useAuth();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { data: accountData } = useAccountData();
  
  const handleDeleteAccount = async () => {
    try {
      await deleteAccount();
      navigate('/auth/login');
    } catch (error) {
      toast.error('Failed to delete account');
    }
  };
  
  return (
    <AppLayout>
      <div className="account-settings">
        <PageHeader
          title="Account Settings"
          subtitle="Manage your account preferences and data"
          breadcrumbs={[
            { label: 'Settings', href: '/settings' },
            { label: 'Account' },
          ]}
        />
        
        <div className="account-sections">
          <div className="account-section">
            <h3>Account Information</h3>
            <div className="account-info">
              <div className="info-item">
                <label>Account Type</label>
                <span className="account-type">{user?.role}</span>
              </div>
              <div className="info-item">
                <label>Member Since</label>
                <span>{formatDate(user?.created_at)}</span>
              </div>
              <div className="info-item">
                <label>Account Status</label>
                <StatusBadge status={accountData.status} />
              </div>
            </div>
          </div>
          
          <div className="account-section">
            <h3>Data Export</h3>
            <p>Download all your account data</p>
            <Button
              variant="outline"
              onClick={() => exportAccountData()}
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Export Data
            </Button>
          </div>
          
          <div className="account-section danger-section">
            <h3>Delete Account</h3>
            <p>Permanently delete your account and all associated data</p>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              Delete Account
            </Button>
          </div>
        </div>
        
        {showDeleteDialog && (
          <DeleteAccountDialog
            onConfirm={handleDeleteAccount}
            onCancel={() => setShowDeleteDialog(false)}
          />
        )}
      </div>
    </AppLayout>
  );
}
```

# Settings Navigation
- Sidebar navigation for settings sections
- Breadcrumb navigation
- Search functionality
- Settings categories
- Quick access shortcuts

# Form Validation
- Real-time validation feedback
- Zod schema validation
- Error message handling
- Field-level validation
- Form state management

# Security Features
- Session management
- Activity logging
- 2FA setup and management
- API key security
- Data encryption

# CRITICAL RULES
- NO regex in settings validation
- NO any types in settings interfaces
- ALWAYS validate sensitive operations
- ALWAYS confirm destructive actions
- IMPLEMENT proper access controls
- TEST security features thoroughly
- ENSURE data privacy compliance
- MAINTAIN audit trails