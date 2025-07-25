import { Link, useLocation } from 'react-router-dom'
import {
  UserCircleIcon,
  CogIcon,
  BellIcon,
  ShieldCheckIcon,
  CommandLineIcon,
  CreditCardIcon,
  ChartBarIcon,
  CpuChipIcon,
  ArrowsRightLeftIcon,
  WrenchScrewdriverIcon,
  ServerStackIcon,
} from '@heroicons/react/24/outline'
import { classNames } from '../../utils/classNames'

interface SettingsSidebarProps {
  userType: 'supplier' | 'buyer' | 'admin' | 'network' | null
}

interface NavigationItem {
  id: string
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  description?: string
  requiredUserTypes?: Array<'supplier' | 'buyer' | 'admin' | 'network'>
}

export function SettingsSidebar({ userType }: SettingsSidebarProps) {
  const location = useLocation()

  // Common settings available to all users
  const commonNavigation: NavigationItem[] = [
    {
      id: 'profile',
      label: 'Profile',
      href: '/app/settings/profile',
      icon: UserCircleIcon,
      description: 'Personal information and avatar',
    },
    {
      id: 'account',
      label: 'Account',
      href: '/app/settings/account',
      icon: CogIcon,
      description: 'Preferences and customization',
    },
    {
      id: 'notifications',
      label: 'Notifications',
      href: '/app/settings/notifications',
      icon: BellIcon,
      description: 'Email, SMS, and push alerts',
    },
    {
      id: 'security',
      label: 'Security',
      href: '/app/settings/security',
      icon: ShieldCheckIcon,
      description: 'Password and authentication',
    },
  ]

  // Role-specific settings
  const roleNavigation: NavigationItem[] = [
    // Supplier settings
    {
      id: 'call-tracking',
      label: 'Call Tracking',
      href: '/app/settings/call-tracking',
      icon: ChartBarIcon,
      description: 'Tracking providers and settings',
      requiredUserTypes: ['supplier'],
    },
    {
      id: 'payouts',
      label: 'Payouts',
      href: '/app/settings/payouts',
      icon: CreditCardIcon,
      description: 'Payment methods and schedule',
      requiredUserTypes: ['supplier'],
    },

    // Buyer settings
    {
      id: 'campaigns',
      label: 'Campaign Defaults',
      href: '/app/settings/campaigns',
      icon: ChartBarIcon,
      description: 'Default campaign settings',
      requiredUserTypes: ['buyer'],
    },
    {
      id: 'billing',
      label: 'Billing',
      href: '/app/settings/billing',
      icon: CreditCardIcon,
      description: 'Payment methods and invoices',
      requiredUserTypes: ['buyer'],
    },
    {
      id: 'quality',
      label: 'Quality Standards',
      href: '/app/settings/quality',
      icon: ShieldCheckIcon,
      description: 'Call quality requirements',
      requiredUserTypes: ['buyer'],
    },

    // Network settings
    {
      id: 'routing',
      label: 'Routing Rules',
      href: '/app/settings/routing',
      icon: ArrowsRightLeftIcon,
      description: 'Call distribution settings',
      requiredUserTypes: ['network'],
    },
    {
      id: 'margins',
      label: 'Margin Settings',
      href: '/app/settings/margins',
      icon: ChartBarIcon,
      description: 'Pricing and margins',
      requiredUserTypes: ['network'],
    },

    // Admin settings
    {
      id: 'system',
      label: 'System',
      href: '/app/settings/system',
      icon: ServerStackIcon,
      description: 'Platform configuration',
      requiredUserTypes: ['admin'],
    },
    {
      id: 'maintenance',
      label: 'Maintenance',
      href: '/app/settings/maintenance',
      icon: WrenchScrewdriverIcon,
      description: 'Backups and updates',
      requiredUserTypes: ['admin'],
    },

    // Common advanced settings
    {
      id: 'integrations',
      label: 'Integrations',
      href: '/app/settings/integrations',
      icon: CommandLineIcon,
      description: 'API keys and webhooks',
      requiredUserTypes: ['supplier', 'buyer', 'network'],
    },
    {
      id: 'automation',
      label: 'Automation',
      href: '/app/settings/automation',
      icon: CpuChipIcon,
      description: 'Automated workflows',
      requiredUserTypes: ['supplier', 'buyer', 'network'],
    },
  ]

  // Filter navigation items based on user type
  const visibleRoleNavigation = roleNavigation.filter((item) => {
    if (!item.requiredUserTypes || !userType) return false
    return item.requiredUserTypes.includes(userType)
  })

  // Group navigation items
  const navigationGroups = [
    {
      label: 'General',
      items: commonNavigation,
    },
    ...(visibleRoleNavigation.length > 0
      ? [
          {
            label: getRoleLabel(userType),
            items: visibleRoleNavigation,
          },
        ]
      : []),
  ]

  return (
    <div className="w-64 bg-white border-r border-gray-200 pt-5 pb-4 overflow-y-auto">
      <nav className="px-3" aria-label="Settings navigation">
        {navigationGroups.map((group) => (
          <div key={group.label} className="mb-8">
            <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {group.label}
            </h3>
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = location.pathname === item.href
                const Icon = item.icon

                return (
                  <Link
                    key={item.id}
                    to={item.href}
                    className={classNames(
                      isActive
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                      'group flex items-center px-3 py-2 text-sm font-medium border-l-4 transition-colors'
                    )}
                  >
                    <Icon
                      className={classNames(
                        isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500',
                        'flex-shrink-0 -ml-1 mr-3 h-5 w-5'
                      )}
                      aria-hidden="true"
                    />
                    <div className="flex-1">
                      <span className="block">{item.label}</span>
                      {item.description && (
                        <span className="text-xs text-gray-500 mt-0.5">{item.description}</span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  )
}

function getRoleLabel(userType: string | null): string {
  switch (userType) {
    case 'supplier':
      return 'Supplier Settings'
    case 'buyer':
      return 'Buyer Settings'
    case 'network':
      return 'Network Settings'
    case 'admin':
      return 'Administration'
    default:
      return 'Advanced'
  }
}
