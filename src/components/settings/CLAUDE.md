# Settings Components Directory

This directory contains components for user preferences, account settings, and configuration management.

## Directory Purpose
- Manages user account settings
- Handles notification preferences
- Controls API key management
- Provides billing configuration

## Component Types
- **AccountSettings.tsx** - User profile management
- **NotificationPrefs.tsx** - Alert preferences
- **ApiKeyManager.tsx** - API key generation/revoke
- **BillingSettings.tsx** - Payment method management
- **SecuritySettings.tsx** - Password/2FA settings
- **TeamSettings.tsx** - Team member management
- **WebhookConfig.tsx** - Webhook URL setup
- **ThemeToggle.tsx** - UI theme preferences

## Settings Layout
```tsx
export function SettingsLayout() {
  return (
    <div className="settings-container">
      <SettingsSidebar />
      <div className="settings-content">
        <Outlet /> {/* Nested routes */}
      </div>
    </div>
  );
}
```

## Account Settings Form
```tsx
export function AccountSettings() {
  const { user } = useAuth();
  const { register, handleSubmit } = useForm({
    defaultValues: {
      name: user?.name,
      email: user?.email,
      phone: user?.phone,
      company: user?.company,
    }
  });
  
  const onSubmit = async (data: AccountFormData) => {
    await updateProfile(data);
    toast.success('Profile updated successfully');
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FormField label="Full Name">
        <Input {...register('name')} />
      </FormField>
      {/* More fields */}
    </form>
  );
}
```

## API Key Management
```tsx
interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: Date;
  lastUsed?: Date;
  permissions: string[];
}

export function ApiKeyManager() {
  const { data: keys } = useApiKeys();
  const [showNewKey, setShowNewKey] = useState<string | null>(null);
  
  const generateKey = async () => {
    const newKey = await createApiKey();
    setShowNewKey(newKey.key);
  };
  
  return (
    <div>
      <Button onClick={generateKey}>Generate New API Key</Button>
      {showNewKey && (
        <Alert>
          <p>Copy this key now. It won't be shown again.</p>
          <code>{showNewKey}</code>
        </Alert>
      )}
      <ApiKeyList keys={keys} />
    </div>
  );
}
```

## Notification Preferences
```tsx
interface NotificationSettings {
  email: {
    newCalls: boolean;
    dailyReports: boolean;
    fraudAlerts: boolean;
    paymentUpdates: boolean;
  };
  sms: {
    urgentAlerts: boolean;
    fraudWarnings: boolean;
  };
  webhook: {
    enabled: boolean;
    url: string;
    events: string[];
  };
}
```

## Security Settings
```tsx
export function SecuritySettings() {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  
  return (
    <div>
      <section>
        <h3>Password</h3>
        <Button onClick={() => setShowPasswordForm(true)}>
          Change Password
        </Button>
      </section>
      
      <section>
        <h3>Two-Factor Authentication</h3>
        <Toggle
          checked={user.has2FA}
          onChange={() => setShow2FASetup(true)}
        />
      </section>
      
      <section>
        <h3>Active Sessions</h3>
        <SessionList />
      </section>
    </div>
  );
}
```

## Billing Configuration
```tsx
export function BillingSettings() {
  const { data: paymentMethods } = usePaymentMethods();
  const { data: invoices } = useInvoices();
  
  return (
    <div>
      <PaymentMethodList methods={paymentMethods} />
      <InvoiceHistory invoices={invoices} />
      <UsageMetrics />
    </div>
  );
}
```

## Settings Storage
- User preferences in database
- Local storage for UI state
- Secure storage for sensitive data
- Sync across devices
- Export/import settings

## Validation Rules
```typescript
const passwordSchema = z.object({
  current: z.string(),
  new: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
  confirm: z.string(),
}).refine(data => data.new === data.confirm, {
  message: "Passwords don't match",
  path: ["confirm"],
});
```

## Permission Management
- Role-based access control
- Feature flags
- API scope management
- Team permissions
- Billing access control

## UX Considerations
- Auto-save preferences
- Confirmation for destructive actions
- Clear success/error feedback
- Inline editing where appropriate
- Mobile-responsive forms

## CRITICAL RULES
- ENCRYPT sensitive settings
- VALIDATE all inputs
- CONFIRM destructive actions
- AUDIT setting changes
- SECURE API key display