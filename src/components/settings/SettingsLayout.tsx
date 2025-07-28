import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import {
  UserCircleIcon,
  BellIcon,
  ShieldCheckIcon,
  CogIcon,
  PhoneIcon,
  BanknotesIcon,
  ChevronLeftIcon
} from '@heroicons/react/24/outline'
import AccessibleIcon from '../common/AccessibleIcon'

interface SettingsNavItem {
  name: string
  href: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  userTypes?: Array<'supplier' | 'buyer' | 'network' | 'admin'>
}

const settingsNavItems: SettingsNavItem[] = [
  {
    name: 'Profile',
    href: '/app/settings/profile',
    icon: UserCircleIcon
  },
  {
    name: 'Notifications',
    href: '/app/settings/notifications',
    icon: BellIcon
  },
  {
    name: 'Security',
    href: '/app/settings/security',
    icon: ShieldCheckIcon
  },
  {
    name: 'Account',
    href: '/app/settings/account',
    icon: CogIcon
  },
  {
    name: 'Call Tracking',
    href: '/app/settings/call-tracking',
    icon: PhoneIcon,
    userTypes: ['supplier']
  },
  {
    name: 'Payouts',
    href: '/app/settings/payouts',
    icon: BanknotesIcon,
    userTypes: ['supplier']
  }
]

export function SettingsLayout() {
  const location = useLocation()
  const { userType } = useAuthStore()
  
  // Filter nav items based on user type
  const filteredNavItems = settingsNavItems.filter(item => {
    if (!item.userTypes) return true
    return item.userTypes.includes(userType as 'supplier' | 'buyer' | 'network' | 'admin')
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="py-6">
          {/* Header */}
          <div className="mb-8">
            <nav className="flex items-center space-x-2 text-sm text-gray-500" aria-label="Breadcrumb">
              <a href="/app/dashboard" className="hover:text-gray-700">
                Dashboard
              </a>
              <AccessibleIcon icon={ChevronLeftIcon} decorative className="h-4 w-4 transform rotate-180" />
              <span className="text-gray-900">Settings</span>
            </nav>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">Settings</h1>
          </div>

          <div className="flex gap-8">
            {/* Sidebar Navigation */}
            <nav className="w-64 flex-shrink-0">
              <ul className="space-y-1">
                {filteredNavItems.map((item) => {
                  const isActive = location.pathname === item.href
                  const Icon = item.icon
                  
                  return (
                    <li key={item.name}>
                      <NavLink
                        to={item.href}
                        className={({ isActive }) =>
                          `group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-primary-50 text-primary-700'
                              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                          }`
                        }
                      >
                        <AccessibleIcon
                          icon={Icon}
                          decorative
                          className={`mr-3 h-5 w-5 flex-shrink-0 ${
                            isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500'
                          }`}
                        />
                        {item.name}
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </nav>

            {/* Main Content Area */}
            <main className="flex-1 bg-white rounded-lg shadow">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsLayout