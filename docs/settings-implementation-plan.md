# Settings Interface Implementation Plan

## Executive Summary

This document outlines a comprehensive plan to build a settings interface for the DCE platform. The system will support four user types (supplier, buyer, admin, network) with both shared and role-specific settings.

## Current State Analysis

### Existing Infrastructure
- **Database**: 
  - `settings` JSON columns in `suppliers` and `buyers` tables
  - `metadata` JSON column in `users` table  
  - Network type has detailed settings structure
- **Frontend**: Basic placeholder `SettingsPage.tsx`
- **Authentication**: Magic link system (no passwords)
- **State Management**: Zustand stores

### User Types
1. **Suppliers** - Traffic providers sending calls
2. **Buyers** - Advertisers paying for qualified leads
3. **Admins** - Platform administrators
4. **Networks** - Intermediaries between suppliers and buyers

## Settings Architecture

### Data Model

```typescript
// User-level settings (stored in users.metadata)
interface UserSettings {
  profile: ProfileSettings
  preferences: UserPreferences
  notifications: NotificationSettings
  security: SecuritySettings
}

interface ProfileSettings {
  displayName?: string
  avatarUrl?: string
  timezone: string
  language: string
  dateFormat: string
  phoneFormat: string
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  dashboardLayout: 'compact' | 'expanded'
  defaultPage: string
  tablePageSize: number
  soundAlerts: boolean
  keyboardShortcuts: boolean
}

interface NotificationSettings {
  email: EmailNotifications
  browser: BrowserNotifications
  sms: SMSNotifications
  quietHours?: QuietHours
}

interface SecuritySettings {
  twoFactorEnabled: boolean
  sessionTimeout: number
  ipWhitelist: string[]
  apiAccess: boolean
}
```

### Role-Specific Settings

```typescript
// Supplier settings (stored in suppliers.settings)
interface SupplierSettings {
  business: SupplierBusinessSettings
  callTracking: CallTrackingSettings
  quality: QualitySettings
  payouts: PayoutSettings
  integrations: SupplierIntegrations
}

// Buyer settings (stored in buyers.settings)
interface BuyerSettings {
  business: BuyerBusinessSettings
  campaigns: CampaignSettings
  quality: QualityRequirements
  billing: BillingSettings
  integrations: BuyerIntegrations
}

// Network settings (stored in networks.settings)
interface NetworkSettings {
  routing: RoutingSettings
  margin: MarginSettings
  relationships: RelationshipSettings
  automation: AutomationSettings
}

// Admin settings (stored in admins.metadata)
interface AdminSettings {
  permissions: AdminPermissions
  auditLog: AuditSettings
  systemAlerts: SystemAlertSettings
}
```

## UI/UX Design

### Navigation Structure
```
Settings
├── Profile
│   ├── Personal Information
│   ├── Avatar & Display
│   └── Contact Details
├── Account
│   ├── Preferences
│   ├── Language & Region
│   └── Dashboard Settings
├── Notifications
│   ├── Email Notifications
│   ├── Browser Alerts
│   ├── SMS Alerts
│   └── Quiet Hours
├── Security
│   ├── Two-Factor Auth
│   ├── Sessions
│   ├── API Keys
│   └── Activity Log
└── [Role-Specific]
    ├── Business Settings
    ├── Integration Settings
    └── Advanced Options
```

### Component Architecture

```typescript
// Main settings layout
<SettingsLayout>
  <SettingsSidebar />
  <SettingsContent>
    <SettingsHeader />
    <SettingsForm />
  </SettingsContent>
</SettingsLayout>

// Reusable components
<SettingsSection />
<SettingsField />
<SettingsToggle />
<SettingsSelect />
<SettingsInput />
<SettingsSaveBar />
```

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
1. Database migrations for settings storage
2. Settings store with Zustand
3. API endpoints for settings CRUD
4. Base settings components
5. Settings layout and navigation

### Phase 2: Common Settings (Week 2)
1. Profile settings
2. Account preferences
3. Notification settings
4. Security settings
5. Settings validation

### Phase 3: Role-Specific Settings (Week 3)
1. Supplier settings interface
2. Buyer settings interface
3. Network settings interface
4. Admin settings interface
5. Role-based access control

### Phase 4: Advanced Features (Week 4)
1. Settings import/export
2. Settings templates
3. Bulk settings updates
4. Settings audit log
5. Settings API documentation

## Technical Implementation

### Database Schema Updates

```sql
-- Add settings version tracking
ALTER TABLE users ADD COLUMN settings_version INTEGER DEFAULT 1;
ALTER TABLE suppliers ADD COLUMN settings_updated_at TIMESTAMPTZ;
ALTER TABLE buyers ADD COLUMN settings_updated_at TIMESTAMPTZ;
ALTER TABLE networks ADD COLUMN settings_updated_at TIMESTAMPTZ;

-- Create settings audit log
CREATE TABLE settings_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  setting_type TEXT NOT NULL,
  setting_key TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create settings templates
CREATE TABLE settings_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  user_type TEXT NOT NULL,
  settings JSONB NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API Endpoints

```typescript
// Settings API routes
POST   /api/settings/profile
GET    /api/settings/profile
PATCH  /api/settings/profile

POST   /api/settings/preferences
GET    /api/settings/preferences
PATCH  /api/settings/preferences

POST   /api/settings/notifications
GET    /api/settings/notifications
PATCH  /api/settings/notifications

POST   /api/settings/security
GET    /api/settings/security
PATCH  /api/settings/security

// Role-specific endpoints
GET    /api/settings/{userType}
PATCH  /api/settings/{userType}

// Utility endpoints
POST   /api/settings/export
POST   /api/settings/import
GET    /api/settings/templates
POST   /api/settings/apply-template
```

### State Management

```typescript
// settings store
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      userSettings: null,
      roleSettings: null,
      isDirty: false,
      isSaving: false,
      
      loadSettings: async () => {
        const settings = await settingsAPI.getAll()
        set({ userSettings: settings.user, roleSettings: settings.role })
      },
      
      updateSetting: (path: string, value: unknown) => {
        set(state => ({
          userSettings: updateNestedValue(state.userSettings, path, value),
          isDirty: true
        }))
      },
      
      saveSettings: async () => {
        set({ isSaving: true })
        try {
          await settingsAPI.update(get().userSettings, get().roleSettings)
          set({ isDirty: false })
        } finally {
          set({ isSaving: false })
        }
      }
    }),
    {
      name: 'settings-storage',
      partialize: (state) => ({ userSettings: state.userSettings })
    }
  )
)
```

## Validation Rules

```typescript
// Settings validation schemas
const profileSettingsSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  timezone: z.string(),
  language: z.enum(['en', 'es', 'fr']),
  dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']),
  phoneFormat: z.enum(['US', 'International'])
})

const notificationSettingsSchema = z.object({
  email: z.object({
    newCalls: z.boolean(),
    dailySummary: z.boolean(),
    weeklyReport: z.boolean(),
    systemUpdates: z.boolean()
  }),
  quietHours: z.object({
    enabled: z.boolean(),
    start: z.string(),
    end: z.string(),
    timezone: z.string()
  }).optional()
})
```

## Security Considerations

1. **Access Control**
   - Role-based access to settings sections
   - Field-level permissions for sensitive settings
   - Audit logging for all changes

2. **Data Protection**
   - Encryption for sensitive settings
   - Input validation and sanitization
   - XSS prevention in display values

3. **API Security**
   - Rate limiting on settings endpoints
   - CSRF protection
   - Session validation

## Performance Optimization

1. **Lazy Loading**
   - Load settings sections on demand
   - Defer loading of role-specific settings
   - Cache settings in local storage

2. **Optimistic Updates**
   - Update UI immediately
   - Save changes in background
   - Rollback on failure

3. **Batch Updates**
   - Debounce setting changes
   - Batch API calls
   - Minimize re-renders

## Testing Strategy

1. **Unit Tests**
   - Settings validation
   - Store actions
   - Component behavior

2. **Integration Tests**
   - API endpoints
   - Database operations
   - Role permissions

3. **E2E Tests**
   - Settings workflows
   - Save/cancel operations
   - Error scenarios

## Migration Plan

1. **Data Migration**
   - Migrate existing settings from various locations
   - Set default values for new settings
   - Version tracking for future migrations

2. **User Communication**
   - In-app notifications about new settings
   - Email announcement
   - Help documentation

## Success Metrics

1. **Adoption**
   - % of users who customize settings
   - Most changed settings
   - Settings completion rate

2. **Performance**
   - Settings load time
   - Save operation time
   - Error rate

3. **User Satisfaction**
   - Support tickets related to settings
   - User feedback
   - Feature requests

## Timeline

- **Week 1**: Core infrastructure
- **Week 2**: Common settings
- **Week 3**: Role-specific settings  
- **Week 4**: Advanced features and testing
- **Week 5**: Documentation and deployment

## Risk Mitigation

1. **Technical Risks**
   - Settings data corruption → Implement versioning and backups
   - Performance issues → Use pagination and lazy loading
   - Integration conflicts → Comprehensive testing

2. **User Experience Risks**
   - Complexity → Progressive disclosure
   - Data loss → Auto-save and confirmation dialogs
   - Confusion → Clear labeling and help text

## Future Enhancements

1. **Settings Sync**
   - Cross-device synchronization
   - Settings profiles
   - Team settings sharing

2. **Advanced Features**
   - A/B testing for defaults
   - ML-based recommendations
   - Settings analytics

3. **Integrations**
   - SSO provider settings sync
   - Third-party app preferences
   - Webhook configurations