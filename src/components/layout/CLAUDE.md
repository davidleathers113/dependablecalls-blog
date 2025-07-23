# Layout Components

# Layout Structure
- `AppLayout.tsx` - Main application wrapper
- `PublicLayout.tsx` - Public pages wrapper
- `Sidebar.tsx` - Navigation sidebar
- `Header.tsx` - Top navigation bar
- `Footer.tsx` - Page footer

# Main Application Layout
```tsx
interface AppLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

export function AppLayout({ children, showSidebar = true }: AppLayoutProps) {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  return (
    <div className="app-layout">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="app-content">
        {showSidebar && (
          <Sidebar
            user={user}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        )}
        
        <main className="main-content">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
      
      <Footer />
    </div>
  );
}
```

# Navigation Sidebar
```tsx
interface SidebarProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ user, isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const navigationItems = useMemo(() => {
    if (!user) return [];
    
    const baseItems = [
      { icon: HomeIcon, label: 'Dashboard', href: '/dashboard' },
      { icon: ChartBarIcon, label: 'Analytics', href: '/analytics' },
      { icon: CogIcon, label: 'Settings', href: '/settings' },
    ];
    
    switch (user.role) {
      case 'supplier':
        return [
          ...baseItems,
          { icon: PhoneIcon, label: 'Campaigns', href: '/campaigns' },
          { icon: CurrencyDollarIcon, label: 'Earnings', href: '/earnings' },
        ];
      case 'buyer':
        return [
          ...baseItems,
          { icon: FolderIcon, label: 'Campaigns', href: '/campaigns' },
          { icon: DocumentChartBarIcon, label: 'Reports', href: '/reports' },
          { icon: CreditCardIcon, label: 'Billing', href: '/billing' },
        ];
      case 'admin':
        return [
          ...baseItems,
          { icon: UsersIcon, label: 'Users', href: '/admin/users' },
          { icon: ShieldCheckIcon, label: 'Fraud', href: '/admin/fraud' },
        ];
      default:
        return baseItems;
    }
  }, [user]);
  
  return (
    <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
      <nav className="sidebar-nav">
        {navigationItems.map(item => (
          <SidebarItem
            key={item.href}
            {...item}
            active={location.pathname === item.href}
            onClick={() => {
              navigate(item.href);
              onClose();
            }}
          />
        ))}
      </nav>
    </aside>
  );
}
```

# Header Component
```tsx
interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const [notificationCount] = useNotifications();
  
  return (
    <header className="app-header">
      <div className="header-left">
        <button className="menu-button" onClick={onMenuClick}>
          <Bars3Icon className="h-6 w-6" />
        </button>
        <Logo />
      </div>
      
      <div className="header-right">
        <NotificationButton count={notificationCount} />
        <UserMenu user={user} onLogout={logout} />
      </div>
    </header>
  );
}
```

# Responsive Design
- Mobile-first layout approach
- Collapsible sidebar for mobile
- Touch-friendly navigation
- Adaptive content areas

# Theme Support
```tsx
interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('theme', 'light');
  
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  
  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };
  
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

# Loading States
- Page-level loading indicators
- Skeleton layouts during data fetch
- Progressive content loading
- Smooth transitions

# Breadcrumb Navigation
```tsx
interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="breadcrumbs">
      {items.map((item, index) => (
        <Fragment key={item.href || index}>
          {index > 0 && <ChevronRightIcon className="breadcrumb-separator" />}
          {item.href ? (
            <Link to={item.href} className="breadcrumb-link">
              {item.label}
            </Link>
          ) : (
            <span className="breadcrumb-current">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
```

# Layout Animations
- Smooth sidebar transitions
- Page transition effects
- Loading state animations
- Hover interactions

# Accessibility Features
- Skip navigation links
- Proper heading hierarchy
- ARIA landmarks
- Keyboard navigation support
- Screen reader optimization

# Performance Optimization
- Layout shift prevention
- CSS containment
- Virtual scrolling for long lists
- Lazy loading of non-critical content

# Mobile Considerations
- Safe area handling (notch devices)
- Touch target sizing
- Gesture recognition
- Orientation changes

# CRITICAL RULES
- NO regex in layout logic
- NO any types in layout props
- ALWAYS implement responsive design
- ALWAYS support keyboard navigation
- ENSURE proper semantic HTML
- TEST on multiple screen sizes
- OPTIMIZE for performance
- MAINTAIN accessibility standards
- IMPLEMENT proper ARIA labels