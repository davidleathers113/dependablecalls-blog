# Dashboard Pages

# Page Structure
- `SupplierDashboard.tsx` - Traffic provider dashboard
- `BuyerDashboard.tsx` - Advertiser dashboard
- `AdminDashboard.tsx` - Platform administration
- `DashboardOverview.tsx` - Shared dashboard components
- `RealTimeMetrics.tsx` - Live performance tracking

# Supplier Dashboard
```tsx
export function SupplierDashboard() {
  const { user } = useAuth();
  const { data: metrics, loading } = useSupplierMetrics(user?.id);
  const { data: activeCampaigns } = useActiveCampaigns(user?.id);
  const { data: recentCalls } = useRecentCalls(user?.id, 10);
  
  // Real-time earnings updates
  const { data: liveEarnings } = useRealtimeEarnings(user?.id);
  
  if (loading) return <DashboardSkeleton />;
  
  return (
    <AppLayout>
      <div className="supplier-dashboard">
        <PageHeader
          title={`Welcome back, ${user?.first_name}`}
          subtitle="Here's your traffic performance overview"
        />
        
        <div className="metrics-grid">
          <MetricCard
            title="Today's Earnings"
            value={formatCurrency(metrics.todayEarnings)}
            change={metrics.earningsChange}
            icon={CurrencyDollarIcon}
            trend="up"
          />
          <MetricCard
            title="Calls Today"
            value={metrics.todayCalls}
            change={metrics.callsChange}
            icon={PhoneIcon}
          />
          <MetricCard
            title="Conversion Rate"
            value={`${metrics.conversionRate}%`}
            change={metrics.conversionChange}
            icon={TrendingUpIcon}
          />
          <MetricCard
            title="Quality Score"
            value={metrics.qualityScore}
            change={metrics.qualityChange}
            icon={StarIcon}
          />
        </div>
        
        <div className="dashboard-content">
          <div className="left-column">
            <EarningsChart data={metrics.earningsChart} />
            <CampaignPerformanceTable campaigns={activeCampaigns} />
          </div>
          
          <div className="right-column">
            <RecentCallsPanel calls={recentCalls} />
            <QuickActions />
            <NotificationsPanel />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
```

# Buyer Dashboard
```tsx
export function BuyerDashboard() {
  const { user } = useAuth();
  const { data: metrics, loading } = useBuyerMetrics(user?.id);
  const { data: campaigns } = useBuyerCampaigns(user?.id);
  const { data: leadQuality } = useLeadQualityMetrics(user?.id);
  
  return (
    <AppLayout>
      <div className="buyer-dashboard">
        <PageHeader
          title={`Welcome back, ${user?.first_name}`}
          subtitle="Manage your campaigns and track lead quality"
        />
        
        <div className="metrics-grid">
          <MetricCard
            title="Today's Spend"
            value={formatCurrency(metrics.todaySpend)}
            target={metrics.dailyBudget}
            icon={CreditCardIcon}
            showProgress
          />
          <MetricCard
            title="Leads Received"
            value={metrics.todayLeads}
            change={metrics.leadsChange}
            icon={UserGroupIcon}
          />
          <MetricCard
            title="Cost Per Lead"
            value={formatCurrency(metrics.costPerLead)}
            change={metrics.cplChange}
            icon={CalculatorIcon}
          />
          <MetricCard
            title="Campaign ROI"
            value={`${metrics.roi}%`}
            change={metrics.roiChange}
            icon={ChartBarIcon}
          />
        </div>
        
        <div className="dashboard-content">
          <div className="left-column">
            <LeadVolumeChart data={metrics.leadVolumeChart} />
            <CampaignBudgetOverview campaigns={campaigns} />
          </div>
          
          <div className="right-column">
            <LeadQualityPanel quality={leadQuality} />
            <TopPerformingCampaigns campaigns={campaigns} />
            <BudgetAlerts />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
```

# Admin Dashboard
```tsx
export function AdminDashboard() {
  const { data: platformMetrics } = usePlatformMetrics();
  const { data: userStats } = useUserStats();
  const { data: fraudMetrics } = useFraudMetrics();
  const { data: systemHealth } = useSystemHealth();
  
  return (
    <AppLayout>
      <div className="admin-dashboard">
        <PageHeader
          title="Platform Administration"
          subtitle="Monitor system performance and user activity"
        />
        
        <div className="admin-metrics-grid">
          <MetricCard
            title="Platform Revenue"
            value={formatCurrency(platformMetrics.totalRevenue)}
            period="today"
            icon={CurrencyDollarIcon}
          />
          <MetricCard
            title="Total Calls"
            value={platformMetrics.totalCalls}
            change={platformMetrics.callsChange}
            icon={PhoneIcon}
          />
          <MetricCard
            title="Active Users"
            value={userStats.activeUsers}
            breakdown={{ suppliers: userStats.suppliers, buyers: userStats.buyers }}
            icon={UsersIcon}
          />
          <MetricCard
            title="Fraud Rate"
            value={`${fraudMetrics.fraudRate}%`}
            severity={fraudMetrics.fraudRate > 5 ? 'high' : 'normal'}
            icon={ShieldExclamationIcon}
          />
        </div>
        
        <div className="admin-content">
          <div className="admin-grid">
            <SystemHealthPanel health={systemHealth} />
            <RecentUsersPanel />
            <FraudAlertsPanel alerts={fraudMetrics.recentAlerts} />
            <PlatformAnalyticsChart data={platformMetrics.analytics} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
```

# Real-time Metrics Component
```tsx
export function RealTimeMetrics() {
  const [metrics, setMetrics] = useState<RealtimeMetrics | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    // Set up real-time subscription for metrics
    const subscription = supabase
      .channel('dashboard-metrics')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'real_time_metrics',
      }, (payload) => {
        setMetrics(payload.new as RealtimeMetrics);
      })
      .on('presence', { event: 'sync' }, () => {
        setIsConnected(true);
      })
      .subscribe();
      
    return () => supabase.removeChannel(subscription);
  }, []);
  
  return (
    <div className="realtime-metrics">
      <div className="metrics-header">
        <h3>Live Metrics</h3>
        <div className="connection-status">
          <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`} />
          <span>{isConnected ? 'Live' : 'Connecting...'}</span>
        </div>
      </div>
      
      {metrics && (
        <div className="live-stats">
          <div className="stat-item">
            <span className="stat-label">Active Calls</span>
            <span className="stat-value">{metrics.activeCalls}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Calls/Hour</span>
            <span className="stat-value">{metrics.callsPerHour}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Revenue/Hour</span>
            <span className="stat-value">{formatCurrency(metrics.revenuePerHour)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

# Dashboard Widget System
```tsx
interface DashboardWidgetProps {
  widget: Widget;
  onEdit?: (widget: Widget) => void;
  onRemove?: (widgetId: string) => void;
}

export function DashboardWidget({ widget, onEdit, onRemove }: DashboardWidgetProps) {
  const WidgetComponent = getWidgetComponent(widget.type);
  
  return (
    <div className="dashboard-widget" data-widget-id={widget.id}>
      <div className="widget-header">
        <h4>{widget.title}</h4>
        <div className="widget-actions">
          {onEdit && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEdit(widget)}
            >
              <Cog6ToothIcon className="h-4 w-4" />
            </Button>
          )}
          {onRemove && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRemove(widget.id)}
            >
              <XMarkIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      <div className="widget-content">
        <WidgetComponent {...widget.config} />
      </div>
    </div>
  );
}
```

# Customizable Dashboard Layout
```tsx
export function CustomDashboard() {
  const { user } = useAuth();
  const [layout, setLayout] = useState<DashboardLayout | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const { data: widgets } = useDashboardWidgets(user?.id);
  
  const handleLayoutChange = (newLayout: Layout[]) => {
    setLayout(prev => ({ ...prev, layout: newLayout }));
  };
  
  const addWidget = (widgetType: WidgetType) => {
    const newWidget: Widget = {
      id: generateId(),
      type: widgetType,
      title: getWidgetTitle(widgetType),
      config: getDefaultWidgetConfig(widgetType),
    };
    
    // Add widget to layout
    setLayout(prev => ({
      ...prev,
      widgets: [...(prev?.widgets || []), newWidget],
    }));
  };
  
  return (
    <AppLayout>
      <div className="custom-dashboard">
        <PageHeader
          title="Dashboard"
          action={
            <div className="dashboard-actions">
              <Button
                variant="outline"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? 'Done' : 'Customize'}
              </Button>
            </div>
          }
        />
        
        {isEditing && (
          <div className="widget-palette">
            <h3>Add Widgets</h3>
            <div className="widget-options">
              {AVAILABLE_WIDGETS.map(widgetType => (
                <Button
                  key={widgetType}
                  variant="outline"
                  onClick={() => addWidget(widgetType)}
                >
                  Add {getWidgetTitle(widgetType)}
                </Button>
              ))}
            </div>
          </div>
        )}
        
        <ResponsiveGridLayout
          layout={layout?.layout || []}
          onLayoutChange={handleLayoutChange}
          isDraggable={isEditing}
          isResizable={isEditing}
        >
          {widgets?.map(widget => (
            <div key={widget.id}>
              <DashboardWidget
                widget={widget}
                onEdit={isEditing ? handleEditWidget : undefined}
                onRemove={isEditing ? handleRemoveWidget : undefined}
              />
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>
    </AppLayout>
  );
}
```

# Performance Monitoring
```tsx
export function PerformanceMonitor() {
  const [performanceData, setPerformanceData] = useState<PerformanceMetrics[]>([]);
  
  useEffect(() => {
    // Monitor key performance metrics
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        if (entry.entryType === 'measure') {
          setPerformanceData(prev => [...prev, {
            name: entry.name,
            duration: entry.duration,
            timestamp: Date.now(),
          }]);
        }
      });
    });
    
    observer.observe({ entryTypes: ['measure', 'navigation'] });
    
    return () => observer.disconnect();
  }, []);
  
  return (
    <div className="performance-monitor">
      <h3>Performance Metrics</h3>
      <div className="performance-stats">
        {performanceData.slice(-5).map(metric => (
          <div key={metric.timestamp} className="performance-stat">
            <span>{metric.name}</span>
            <span>{Math.round(metric.duration)}ms</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

# Dashboard Notifications
```tsx
export function DashboardNotifications() {
  const { data: notifications } = useNotifications();
  const [showAll, setShowAll] = useState(false);
  
  const visibleNotifications = showAll 
    ? notifications 
    : notifications?.slice(0, 5);
  
  return (
    <div className="dashboard-notifications">
      <div className="notifications-header">
        <h3>Notifications</h3>
        {notifications?.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'Show Less' : `View All (${notifications.length})`}
          </Button>
        )}
      </div>
      
      <div className="notifications-list">
        {visibleNotifications?.map(notification => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onClick={() => handleNotificationClick(notification)}
          />
        ))}
      </div>
      
      {notifications?.length === 0 && (
        <EmptyState
          icon={BellIcon}
          title="No notifications"
          description="You're all caught up!"
        />
      )}
    </div>
  );
}
```

# Dashboard Export Features
- Export dashboard data to PDF/Excel
- Schedule automated reports
- Custom report generation
- Data visualization exports
- Performance snapshot sharing

# Mobile Dashboard Optimization
- Touch-optimized controls
- Responsive widget layouts
- Mobile-specific metrics
- Gesture navigation
- Offline data caching

# Dashboard Analytics
- User engagement tracking
- Widget usage analytics
- Performance optimization
- Feature adoption metrics
- User behavior insights

# CRITICAL RULES
- NO regex in dashboard logic
- NO any types in dashboard interfaces
- ALWAYS handle real-time data safely
- ALWAYS optimize for performance
- IMPLEMENT proper error boundaries
- TEST dashboard responsiveness
- ENSURE data accuracy
- MAINTAIN dashboard load times