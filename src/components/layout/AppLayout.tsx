import React from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useNavigation } from '../../store/slices/navigationSlice'
import { useSearchActions, useSearchModal } from '../../store/searchStore'
import {
  HomeIcon,
  ChartBarIcon,
  PhoneIcon,
  DocumentTextIcon,
  CogIcon,
  UserCircleIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import ErrorBoundary from '../common/ErrorBoundary'
import { AppLayoutSidebarFallbackUI, AppLayoutContentFallbackUI } from '../common/FallbackUI'
import AccessibleIcon from '../common/AccessibleIcon'
import { Logo } from '../common/Logo'
import { SearchBar } from '../search/SearchBar'
import { GlobalSearchModal } from '../search/GlobalSearchModal'
import { DemoModeIndicator } from '../demo/DemoModeIndicator'

// Dynamic navigation based on user type
const getNavigation = (userType: string | null) => {
  const baseNav = [
    { name: 'Dashboard', href: '/app/dashboard', icon: HomeIcon },
    { name: 'Settings', href: '/app/settings', icon: CogIcon },
  ]

  switch (userType) {
    case 'supplier':
      return [
        baseNav[0], // Dashboard
        { name: 'Campaigns', href: '/app/campaigns', icon: ChartBarIcon },
        { name: 'Calls', href: '/app/calls', icon: PhoneIcon },
        { name: 'Reports', href: '/app/reports', icon: DocumentTextIcon },
        baseNav[1], // Settings
      ]
    case 'buyer':
      return [
        baseNav[0], // Dashboard
        { name: 'Campaigns', href: '/app/campaigns', icon: ChartBarIcon },
        { name: 'Calls', href: '/app/calls', icon: PhoneIcon },
        { name: 'Reports', href: '/app/reports', icon: DocumentTextIcon },
        baseNav[1], // Settings
      ]
    case 'network':
      return [
        baseNav[0], // Dashboard
        { name: 'Campaigns', href: '/app/campaigns', icon: ChartBarIcon },
        { name: 'Calls', href: '/app/calls', icon: PhoneIcon },
        { name: 'Partners', href: '/app/partners', icon: UserCircleIcon },
        { name: 'Reports', href: '/app/reports', icon: DocumentTextIcon },
        baseNav[1], // Settings
      ]
    case 'admin':
      return [
        baseNav[0], // Dashboard
        { name: 'Users', href: '/app/admin/users', icon: UserCircleIcon },
        { name: 'Campaigns', href: '/app/campaigns', icon: ChartBarIcon },
        { name: 'Calls', href: '/app/calls', icon: PhoneIcon },
        { name: 'Reports', href: '/app/reports', icon: DocumentTextIcon },
        baseNav[1], // Settings
      ]
    default:
      return baseNav
  }
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export default function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, userType, signOut, isDemoMode, demoUserType } = useAuthStore()
  
  // Use demo user type if in demo mode
  const currentUserType = isDemoMode ? demoUserType : userType
  
  // Use the navigation state machine
  const {
    isSidebarCollapsed,
    isSidebarExpanded,
    isMobileMenuOpen,
    isUserDropdownOpen,
    toggleSidebar,
    toggleMobileMenu,
    toggleUserDropdown,
    closeMobileMenu,
    closeUserDropdown
  } = useNavigation()

  // Search state management
  const isSearchModalOpen = useSearchModal()
  const { setQuery: setSearchQuery, setModalOpen: setSearchModalOpen } = useSearchActions()

  // Get navigation items based on user type
  const navigation = getNavigation(currentUserType)

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  // Keyboard shortcuts for search
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open search
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        setSearchModalOpen(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [setSearchModalOpen])

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Skip to main content link for keyboard navigation */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 bg-primary-600 text-white px-6 py-3 z-50 rounded-br-md"
      >
        Skip to main content
      </a>
      {/* Mobile sidebar */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 flex z-40 lg:hidden">
          <div
            className={classNames(
              'fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity ease-linear duration-300',
              isMobileMenuOpen ? 'opacity-100' : 'opacity-0'
            )}
            onClick={closeMobileMenu}
          />

          <div
            className={classNames(
              'relative flex-1 flex flex-col max-w-xs w-full pt-5 pb-4 bg-white transition ease-in-out duration-300 transform',
              isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
            )}
          >
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={closeMobileMenu}
                aria-label="Close sidebar"
              >
                <AccessibleIcon icon={XMarkIcon} decorative className="h-6 w-6 text-white" />
              </button>
            </div>

            <div className="flex-shrink-0 flex items-center px-4">
              <Logo variant="default" />
            </div>

            <div className="mt-5 flex-1 h-0 overflow-y-auto">
              <ErrorBoundary
                context="AppLayout - Mobile Sidebar Navigation"
                fallback={<AppLayoutSidebarFallbackUI />}
              >
                <nav className="px-2 space-y-1">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={classNames(
                        location.pathname === item.href
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                        'group flex items-center px-2 py-2 text-base font-medium rounded-md'
                      )}
                      onClick={closeMobileMenu}
                    >
                      <AccessibleIcon
                        icon={item.icon}
                        decorative
                        className={classNames(
                          location.pathname === item.href
                            ? 'text-gray-500'
                            : 'text-gray-400 group-hover:text-gray-500',
                          'mr-4 flex-shrink-0 h-6 w-6'
                        )}
                      />
                      {item.name}
                    </Link>
                  ))}
                </nav>
              </ErrorBoundary>
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <div className="flex flex-col flex-1 min-h-0 bg-white border-r border-gray-200">
          <div className="flex items-center h-16 flex-shrink-0 px-4 bg-white border-b border-gray-200">
            <Logo variant="default" />
          </div>

          <div className="flex-1 flex flex-col overflow-y-auto">
            <ErrorBoundary
              context="AppLayout - Desktop Sidebar Navigation"
              fallback={<AppLayoutSidebarFallbackUI />}
            >
              <nav className="flex-1 px-2 py-4 space-y-1">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={classNames(
                      location.pathname === item.href
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                      'group flex items-center px-2 py-2 text-sm font-medium rounded-md',
                      isSidebarCollapsed ? 'justify-center' : ''
                    )}
                    title={isSidebarCollapsed ? item.name : undefined}
                  >
                    <AccessibleIcon
                      icon={item.icon}
                      decorative
                      className={classNames(
                        location.pathname === item.href
                          ? 'text-gray-500'
                          : 'text-gray-400 group-hover:text-gray-500',
                        'flex-shrink-0 h-6 w-6',
                        isSidebarCollapsed ? '' : 'mr-3'
                      )}
                    />
                    {!isSidebarCollapsed && item.name}
                  </Link>
                ))}
              </nav>
            </ErrorBoundary>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={classNames(
        "flex flex-col flex-1 transition-all duration-200",
        isSidebarCollapsed ? "lg:pl-16" : "lg:pl-64"
      )}>
        {/* Top navigation */}
        <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-white shadow">
          <button
            id="mobile-menu-button"
            type="button"
            className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 lg:hidden"
            onClick={toggleMobileMenu}
            aria-label="Open mobile navigation menu"
            aria-expanded={isMobileMenuOpen}
          >
            <AccessibleIcon icon={Bars3Icon} decorative className="h-6 w-6" />
          </button>

          {/* Desktop sidebar toggle */}
          <button
            id="sidebar-toggle"
            type="button"
            className="hidden lg:flex px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 items-center"
            onClick={toggleSidebar}
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={isSidebarExpanded}
          >
            <AccessibleIcon icon={Bars3Icon} decorative className="h-5 w-5" />
          </button>

          <div className="flex-1 px-4 flex justify-between">
            <div className="flex-1 flex items-center max-w-lg">
              <SearchBar
                placeholder="Search campaigns, calls, settings..."
                size="md"
                variant="default"
                showSuggestions={true}
                className="w-full"
                onSearch={(query) => {
                  setSearchQuery(query)
                  setSearchModalOpen(true)
                }}
              />
            </div>

            <div className="ml-4 flex items-center md:ml-6">
              {/* User menu */}
              <div className="ml-3 relative">
                <div>
                  <button
                    id="user-menu-button"
                    className="max-w-xs bg-white flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    onClick={toggleUserDropdown}
                    aria-expanded={isUserDropdownOpen}
                    aria-haspopup="true"
                    aria-label="User account menu"
                  >
                    <AccessibleIcon icon={UserCircleIcon} decorative className="h-8 w-8 text-gray-400" />
                    <span className="ml-3 text-gray-700 text-sm font-medium">{user?.email}</span>
                  </button>
                </div>

                {isUserDropdownOpen && (
                  <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div className="px-4 py-2 text-xs text-gray-500">
                      {userType && userType.charAt(0).toUpperCase() + userType.slice(1)} Account
                    </div>
                    <Link
                      to="/app/settings"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={closeUserDropdown}
                    >
                      Account Settings
                    </Link>
                    <button
                      onClick={() => {
                        handleSignOut()
                        closeUserDropdown()
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main id="main-content" className="flex-1">
          {/* Demo mode indicator */}
          {isDemoMode && (
            <div className="bg-white border-b border-gray-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="py-3">
                  <DemoModeIndicator compact />
                </div>
              </div>
            </div>
          )}
          
          <ErrorBoundary
            context="AppLayout - Main Content"
            fallback={<AppLayoutContentFallbackUI />}
          >
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* Global Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setSearchModalOpen(false)}
      />
    </div>
  )
}
