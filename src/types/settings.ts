import type { Json } from './database'

// Base settings interface
export interface BaseSettings {
  version: number
  updatedAt: string
}

// User-level settings (stored in users.metadata)
export interface UserSettings extends BaseSettings {
  profile: ProfileSettings
  preferences: UserPreferences
  notifications: NotificationSettings
  security: SecuritySettings
}

// Profile settings
export interface ProfileSettings {
  displayName?: string
  avatarUrl?: string
  bio?: string
  timezone: string
  language: SupportedLanguage
  dateFormat: DateFormat
  phoneFormat: PhoneFormat
  currency: Currency
}

// User preferences
export interface UserPreferences {
  theme: Theme
  dashboardLayout: DashboardLayout
  defaultPage: string
  tablePageSize: number
  soundAlerts: boolean
  keyboardShortcuts: boolean
  autoRefresh: boolean
  refreshInterval: number // seconds
  compactMode: boolean
  showOnboarding: boolean
}

// Notification settings
export interface NotificationSettings {
  email: EmailNotifications
  browser: BrowserNotifications
  sms?: SMSNotifications
  quietHours?: QuietHours
  frequency: NotificationFrequency
}

export interface EmailNotifications {
  enabled: boolean
  newCalls: boolean
  callCompleted: boolean
  dailySummary: boolean
  weeklyReport: boolean
  monthlyReport: boolean
  campaignAlerts: boolean
  budgetAlerts: boolean
  qualityAlerts: boolean
  fraudAlerts: boolean
  systemUpdates: boolean
  marketingEmails: boolean
}

export interface BrowserNotifications {
  enabled: boolean
  newCalls: boolean
  callStatus: boolean
  campaignAlerts: boolean
  systemAlerts: boolean
  sound: boolean
  vibrate: boolean
}

export interface SMSNotifications {
  enabled: boolean
  phoneNumber?: string
  urgentOnly: boolean
  fraudAlerts: boolean
  systemDowntime: boolean
  dailyLimit: number
}

export interface QuietHours {
  enabled: boolean
  start: string // HH:MM format
  end: string // HH:MM format
  timezone: string
  weekendsOnly: boolean
  excludeUrgent: boolean
}

// Security settings
export interface SecuritySettings {
  twoFactorEnabled: boolean
  twoFactorMethod?: TwoFactorMethod
  sessionTimeout: number // minutes
  ipWhitelist: string[]
  apiAccess: boolean
  loginNotifications: boolean
  activityAlerts: boolean
  dataExportEnabled: boolean
}

// Supplier-specific settings
export interface SupplierSettings extends BaseSettings {
  business: SupplierBusinessSettings
  callTracking: CallTrackingSettings
  quality: QualitySettings
  payouts: PayoutSettings
  integrations: SupplierIntegrations
  automation: SupplierAutomation
}

export interface SupplierBusinessSettings {
  companyInfo: CompanyInfo
  verticalsServed: string[]
  trafficSources: TrafficSource[]
  volumeCommitments: VolumeCommitment[]
  exclusivityAgreements: string[]
  supportContact: ContactInfo
}

export interface CallTrackingSettings {
  defaultProvider: string
  trackingNumbers: TrackingNumberConfig[]
  recordCalls: boolean
  transcribeCalls: boolean
  webhookUrl?: string
  retryAttempts: number
  timeoutSeconds: number
  dataRetentionDays: number
}

export interface QualitySettings {
  minimumCallDuration: number
  maximumCallDuration: number
  requiredFields: string[]
  scriptCompliance: boolean
  qualityCheckPercentage: number
  autoRejectThreshold: number
  disputeProcess: DisputeSettings
}

export interface PayoutSettings {
  preferredMethod: PayoutMethod
  minimumPayout: number
  payoutSchedule: PayoutSchedule
  bankDetails?: BankDetails
  taxInformation: TaxInfo
  invoiceSettings: InvoiceSettings
}

export interface SupplierIntegrations {
  apiKeys: APIKeyConfig[]
  webhooks: WebhookConfig[]
  thirdPartyApps: ThirdPartyApp[]
  customIntegrations: CustomIntegration[]
}

export interface SupplierAutomation {
  autoAcceptCampaigns: boolean
  acceptCriteria: AcceptCriteria
  autoOptimization: boolean
  pauseOnQualityDrop: boolean
  alertThresholds: AlertThresholds
}

// Buyer-specific settings
export interface BuyerSettings extends BaseSettings {
  business: BuyerBusinessSettings
  campaigns: CampaignDefaultSettings
  quality: QualityRequirements
  billing: BillingSettings
  integrations: BuyerIntegrations
  compliance: ComplianceSettings
}

export interface BuyerBusinessSettings {
  companyInfo: CompanyInfo
  industries: string[]
  targetMarkets: string[]
  complianceRegions: string[]
  approvedSuppliers: string[]
  blockedSuppliers: string[]
}

export interface CampaignDefaultSettings {
  defaultBudget: BudgetSettings
  defaultTargeting: TargetingDefaults
  defaultQuality: QualityDefaults
  approvalWorkflow: ApprovalWorkflow
  namingConvention: string
  autoArchiveDays: number
}

export interface QualityRequirements {
  minimumQualityScore: number
  requiredCallDuration: DurationRange
  requiredDataFields: DataFieldRequirement[]
  fraudTolerance: number
  conversionDefinition: ConversionCriteria
  disputeWindow: number // hours
}

export interface BillingSettings {
  paymentMethod: PaymentMethod
  autoRecharge: AutoRechargeSettings
  invoicePreferences: InvoicePreferences
  spendAlerts: SpendAlert[]
  creditLimit?: number
  approvalRequired: ApprovalSettings
}

export interface BuyerIntegrations {
  crmSync: CRMIntegration
  analyticsSync: AnalyticsIntegration
  apiEndpoints: APIEndpointConfig[]
  dataExports: DataExportConfig
  sso?: SSOConfig
}

export interface ComplianceSettings {
  tcpaCompliance: boolean
  dncScrubbing: boolean
  consentRequired: boolean
  recordingConsent: boolean
  dataRetention: DataRetentionPolicy
  gdprSettings?: GDPRSettings
}

// Network-specific settings
export interface NetworkSettings extends BaseSettings {
  routing: RoutingSettings
  margin: MarginSettings
  relationships: RelationshipSettings
  automation: NetworkAutomation
  analytics: NetworkAnalytics
}

export interface RoutingSettings {
  defaultRules: RoutingRule[]
  priorityLogic: PriorityLogic
  fallbackBehavior: FallbackBehavior
  loadBalancing: LoadBalancingConfig
  geoRestrictions: GeoRestriction[]
}

export interface MarginSettings {
  defaultMargin: MarginConfig
  marginRules: MarginRule[]
  minimumMargin: number
  maximumMargin: number
  marginCalculation: MarginCalculation
  transparencyLevel: TransparencyLevel
}

export interface RelationshipSettings {
  autoApproval: boolean
  approvalCriteria: ApprovalCriteria
  contractTemplates: ContractTemplate[]
  termSheets: TermSheet[]
  disputeResolution: DisputeResolution
}

export interface NetworkAutomation {
  autoRouting: boolean
  autoMarginAdjustment: boolean
  demandSupplyMatching: boolean
  qualityMonitoring: boolean
  fraudPrevention: boolean
  alerting: NetworkAlertConfig
}

export interface NetworkAnalytics {
  dashboardConfig: DashboardConfig
  reportSchedule: ReportSchedule[]
  metrics: MetricConfig[]
  dataWarehouse?: DataWarehouseConfig
}

// Admin-specific settings
export interface AdminSettings extends BaseSettings {
  permissions: AdminPermissions
  systemConfig: SystemConfiguration
  auditLog: AuditSettings
  monitoring: MonitoringSettings
  maintenance: MaintenanceSettings
}

export interface AdminPermissions {
  fullAccess: boolean
  modules: ModulePermission[]
  dataAccess: DataAccessLevel
  userManagement: boolean
  systemConfiguration: boolean
  billingAccess: boolean
}

export interface SystemConfiguration {
  platformSettings: PlatformConfig
  securityPolicies: SecurityPolicy[]
  integrationSettings: IntegrationConfig
  featureFlags: FeatureFlag[]
  rateLimits: RateLimit[]
}

export interface AuditSettings {
  enabled: boolean
  retention: number // days
  logLevel: LogLevel
  includeReadOperations: boolean
  sensitiveDataMasking: boolean
  exportFormat: ExportFormat
}

export interface MonitoringSettings {
  healthChecks: HealthCheckConfig[]
  alertChannels: AlertChannel[]
  performanceMetrics: PerformanceConfig
  errorTracking: ErrorTrackingConfig
  uptimeMonitoring: UptimeConfig
}

export interface MaintenanceSettings {
  maintenanceWindow: MaintenanceWindow
  backupSchedule: BackupSchedule
  updatePolicy: UpdatePolicy
  disasterRecovery: DisasterRecoveryConfig
}

// Enums and constant types
export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'zh' | 'ja'
export type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'DD-MMM-YYYY'
export type PhoneFormat = 'US' | 'International' | 'E.164'
export type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD'
export type Theme = 'light' | 'dark' | 'system'
export type DashboardLayout = 'compact' | 'expanded' | 'custom'
export type NotificationFrequency = 'realtime' | 'hourly' | 'daily' | 'weekly'
export type TwoFactorMethod = 'app' | 'sms' | 'email'
export type PayoutMethod = 'bank_transfer' | 'wire' | 'check' | 'paypal'
export type PayoutSchedule = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'net30'
export type PaymentMethod = 'credit_card' | 'ach' | 'wire' | 'invoice'
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace'
export type ExportFormat = 'json' | 'csv' | 'xml' | 'parquet'
export type TransparencyLevel = 'full' | 'partial' | 'hidden'
export type MarginCalculation = 'percentage' | 'fixed' | 'tiered'
export type DataAccessLevel = 'full' | 'restricted' | 'readonly'

// Supporting interfaces
export interface CompanyInfo {
  legalName: string
  tradingName?: string
  registrationNumber?: string
  taxId?: string
  address: Address
  website?: string
  yearEstablished?: number
}

export interface Address {
  street1: string
  street2?: string
  city: string
  state: string
  zipCode: string
  country: string
}

export interface ContactInfo {
  name: string
  email: string
  phone?: string
  role?: string
  availability?: string
}

export interface TrafficSource {
  type: string
  volume: number
  quality: number
  regions: string[]
}

export interface VolumeCommitment {
  campaignId: string
  dailyVolume: number
  monthlyVolume: number
  startDate: string
  endDate?: string
}

export interface TrackingNumberConfig {
  number: string
  provider: string
  campaigns: string[]
  active: boolean
}

export interface DisputeSettings {
  enabled: boolean
  windowHours: number
  autoApproveHours: number
  evidenceRequired: string[]
}

export interface BankDetails {
  accountName: string
  accountNumber: string
  routingNumber: string
  bankName: string
  swiftCode?: string
}

export interface TaxInfo {
  taxId: string
  vatNumber?: string
  taxExempt: boolean
  w9Filed: boolean
}

export interface InvoiceSettings {
  generateAutomatically: boolean
  emailTo: string[]
  includeDetails: boolean
  customTemplate?: string
}

export interface APIKeyConfig {
  id: string
  name: string
  key: string
  permissions: string[]
  expiresAt?: string
  lastUsed?: string
}

export interface WebhookConfig {
  id: string
  url: string
  events: string[]
  secret?: string
  active: boolean
  retryPolicy: RetryPolicy
}

export interface RetryPolicy {
  maxAttempts: number
  backoffMultiplier: number
  maxBackoffSeconds: number
}

export interface ThirdPartyApp {
  id: string
  name: string
  type: string
  config: Json
  active: boolean
}

export interface CustomIntegration {
  id: string
  name: string
  type: string
  endpoint: string
  authentication: Json
  mapping: Json
}

export interface AcceptCriteria {
  minPayout: number
  minQuality: number
  requiredRegions?: string[]
  excludedBuyers?: string[]
}

export interface AlertThresholds {
  lowQuality: number
  highRejection: number
  lowVolume: number
  highCost: number
}

export interface BudgetSettings {
  dailyBudget?: number
  monthlyBudget?: number
  lifetimeBudget?: number
  alertPercentage: number
}

export interface TargetingDefaults {
  geoTargeting: string[]
  ageRange?: [number, number]
  gender?: string[]
  interests?: string[]
}

export interface QualityDefaults {
  minDuration: number
  maxDuration: number
  minQualityScore: number
}

export interface ApprovalWorkflow {
  required: boolean
  approvers: string[]
  threshold: number
  autoApprove: boolean
}

export interface DurationRange {
  min: number
  max: number
}

export interface DataFieldRequirement {
  field: string
  required: boolean
  validation?: string
}

export interface ConversionCriteria {
  type: string
  duration?: number
  outcome?: string
  customEvents?: string[]
}

export interface AutoRechargeSettings {
  enabled: boolean
  threshold: number
  amount: number
  maxMonthly: number
}

export interface InvoicePreferences {
  frequency: string
  format: string
  recipients: string[]
  includeDetails: boolean
}

export interface SpendAlert {
  type: string
  threshold: number
  recipients: string[]
}

export interface ApprovalSettings {
  threshold: number
  approvers: string[]
  escalation: string[]
}

export interface CRMIntegration {
  provider: string
  syncEnabled: boolean
  fieldMapping: Json
  syncFrequency: string
}

export interface AnalyticsIntegration {
  provider: string
  trackingId: string
  events: string[]
  customDimensions: Json
}

export interface APIEndpointConfig {
  url: string
  method: string
  events: string[]
  authentication: Json
}

export interface DataExportConfig {
  format: string
  frequency: string
  destination: string
  filters?: Json
}

export interface SSOConfig {
  provider: string
  clientId: string
  domain: string
  autoProvision: boolean
}

export interface DataRetentionPolicy {
  callRecordings: number
  callData: number
  reports: number
  logs: number
}

export interface GDPRSettings {
  dataController: string
  dpo: ContactInfo
  privacyPolicy: string
  consentManagement: boolean
}

export interface RoutingRule {
  id: string
  name: string
  priority: number
  conditions: Json
  actions: Json
  active: boolean
}

export interface PriorityLogic {
  type: string
  weights: Json
  rebalanceFrequency: number
}

export interface FallbackBehavior {
  type: string
  options: Json
}

export interface LoadBalancingConfig {
  algorithm: string
  weights?: Json
  healthChecks: boolean
}

export interface GeoRestriction {
  type: 'allow' | 'block'
  regions: string[]
  override?: string[]
}

export interface MarginConfig {
  type: MarginCalculation
  value: number
  tiers?: MarginTier[]
}

export interface MarginTier {
  min: number
  max?: number
  margin: number
}

export interface MarginRule {
  id: string
  name: string
  conditions: Json
  margin: MarginConfig
  priority: number
}

export interface ApprovalCriteria {
  minVolume?: number
  minQuality?: number
  requiredDocuments?: string[]
  financialRequirements?: Json
}

export interface ContractTemplate {
  id: string
  name: string
  type: string
  template: string
  variables: Json
}

export interface TermSheet {
  id: string
  name: string
  terms: Json
  active: boolean
}

export interface DisputeResolution {
  process: string
  sla: number
  escalation: string[]
}

export interface NetworkAlertConfig {
  channels: string[]
  conditions: Json
  frequency: string
}

export interface DashboardConfig {
  layout: Json
  widgets: Widget[]
  refreshRate: number
}

export interface Widget {
  id: string
  type: string
  config: Json
  position: Json
}

export interface ReportSchedule {
  id: string
  name: string
  type: string
  frequency: string
  recipients: string[]
  filters?: Json
}

export interface MetricConfig {
  id: string
  name: string
  calculation: string
  display: Json
}

export interface DataWarehouseConfig {
  provider: string
  connection: Json
  syncSchedule: string
}

export interface ModulePermission {
  module: string
  access: string[]
}

export interface PlatformConfig {
  siteName: string
  siteUrl: string
  supportEmail: string
  timezone: string
  maintenanceMode: boolean
}

export interface SecurityPolicy {
  id: string
  name: string
  rules: Json
  enforcement: string
}

export interface IntegrationConfig {
  providers: Json
  limits: Json
  defaults: Json
}

export interface FeatureFlag {
  key: string
  enabled: boolean
  rollout?: number
  conditions?: Json
}

export interface RateLimit {
  endpoint: string
  limit: number
  window: number
  strategy: string
}

export interface HealthCheckConfig {
  service: string
  endpoint: string
  interval: number
  timeout: number
  threshold: number
}

export interface AlertChannel {
  type: string
  config: Json
  severity: string[]
}

export interface PerformanceConfig {
  sampleRate: number
  metrics: string[]
  thresholds: Json
}

export interface ErrorTrackingConfig {
  provider: string
  projectId: string
  environment: string
  sampleRate: number
}

export interface UptimeConfig {
  monitors: UptimeMonitor[]
  statusPage: boolean
  publicUrl?: string
}

export interface UptimeMonitor {
  name: string
  url: string
  interval: number
  regions: string[]
}

export interface MaintenanceWindow {
  dayOfWeek: number
  startHour: number
  duration: number
  timezone: string
}

export interface BackupSchedule {
  frequency: string
  retention: number
  location: string
  encryption: boolean
}

export interface UpdatePolicy {
  autoUpdate: boolean
  schedule: string
  testing: boolean
  rollback: boolean
}

export interface DisasterRecoveryConfig {
  rpo: number // Recovery Point Objective in hours
  rto: number // Recovery Time Objective in hours
  backupRegions: string[]
  testFrequency: string
}

// Type guards
export function isSupplierSettings(settings: unknown): settings is SupplierSettings {
  return typeof settings === 'object' && settings !== null && 'business' in settings && 'callTracking' in settings
}

export function isBuyerSettings(settings: unknown): settings is BuyerSettings {
  return typeof settings === 'object' && settings !== null && 'business' in settings && 'campaigns' in settings
}

export function isNetworkSettings(settings: unknown): settings is NetworkSettings {
  return typeof settings === 'object' && settings !== null && 'routing' in settings && 'margin' in settings
}

export function isAdminSettings(settings: unknown): settings is AdminSettings {
  return typeof settings === 'object' && settings !== null && 'permissions' in settings && 'systemConfig' in settings
}

// Settings validation helpers
export function validateUserSettings(settings: Partial<UserSettings>): UserSettings {
  return {
    version: settings.version || 1,
    updatedAt: settings.updatedAt || new Date().toISOString(),
    profile: {
      timezone: settings.profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: settings.profile?.language || 'en',
      dateFormat: settings.profile?.dateFormat || 'MM/DD/YYYY',
      phoneFormat: settings.profile?.phoneFormat || 'US',
      currency: settings.profile?.currency || 'USD',
      ...settings.profile
    },
    preferences: {
      theme: settings.preferences?.theme || 'system',
      dashboardLayout: settings.preferences?.dashboardLayout || 'expanded',
      defaultPage: settings.preferences?.defaultPage || '/dashboard',
      tablePageSize: settings.preferences?.tablePageSize || 25,
      soundAlerts: settings.preferences?.soundAlerts ?? true,
      keyboardShortcuts: settings.preferences?.keyboardShortcuts ?? true,
      autoRefresh: settings.preferences?.autoRefresh ?? true,
      refreshInterval: settings.preferences?.refreshInterval || 30,
      compactMode: settings.preferences?.compactMode ?? false,
      showOnboarding: settings.preferences?.showOnboarding ?? true,
      ...settings.preferences
    },
    notifications: {
      email: {
        enabled: true,
        newCalls: true,
        callCompleted: false,
        dailySummary: true,
        weeklyReport: true,
        monthlyReport: false,
        campaignAlerts: true,
        budgetAlerts: true,
        qualityAlerts: true,
        fraudAlerts: true,
        systemUpdates: true,
        marketingEmails: false,
        ...settings.notifications?.email
      },
      browser: {
        enabled: true,
        newCalls: true,
        callStatus: true,
        campaignAlerts: true,
        systemAlerts: true,
        sound: true,
        vibrate: false,
        ...settings.notifications?.browser
      },
      frequency: settings.notifications?.frequency || 'realtime',
      ...settings.notifications
    },
    security: {
      twoFactorEnabled: settings.security?.twoFactorEnabled ?? false,
      sessionTimeout: settings.security?.sessionTimeout || 30,
      ipWhitelist: settings.security?.ipWhitelist || [],
      apiAccess: settings.security?.apiAccess ?? false,
      loginNotifications: settings.security?.loginNotifications ?? true,
      activityAlerts: settings.security?.activityAlerts ?? true,
      dataExportEnabled: settings.security?.dataExportEnabled ?? true,
      ...settings.security
    }
  }
}