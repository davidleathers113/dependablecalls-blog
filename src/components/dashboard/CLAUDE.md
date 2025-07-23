# Dashboard Components

# Dashboard Structure
- `DashboardHeader.tsx` - Top navigation and user info
- `MetricsCards.tsx` - Key performance indicators
- `RealtimeChart.tsx` - Live data visualization
- `ActivityFeed.tsx` - Recent activity timeline
- `QuickActions.tsx` - Common action buttons

# Real-time Metrics
```tsx
interface MetricsCardsProps {
  userRole: UserRole;
  timeRange: TimeRange;
}

export function MetricsCards({ userRole, timeRange }: MetricsCardsProps) {
  const { data: metrics, loading } = useRealTimeMetrics(userRole, timeRange);
  
  const cards = useMemo(() => {
    switch (userRole) {
      case 'supplier':
        return [
          { label: 'Total Calls', value: metrics?.totalCalls, icon: PhoneIcon },
          { label: 'Earnings', value: formatCurrency(metrics?.earnings), icon: CurrencyDollarIcon },
          { label: 'Quality Score', value: `${metrics?.qualityScore}/10`, icon: StarIcon },
        ];
      case 'buyer':
        return [
          { label: 'Campaign Leads', value: metrics?.totalLeads, icon: UserGroupIcon },
          { label: 'Conversion Rate', value: `${metrics?.conversionRate}%`, icon: TrendingUpIcon },
          { label: 'Cost Per Lead', value: formatCurrency(metrics?.costPerLead), icon: CalculatorIcon },
        ];
      default:
        return [];
    }
  }, [userRole, metrics]);
  
  if (loading) return <MetricsCardsSkeleton />;
  
  return (
    <div className="metrics-cards">
      {cards.map(card => (
        <MetricCard key={card.label} {...card} />
      ))}
    </div>
  );
}
```

# Live Data Visualization
```tsx
interface RealtimeChartProps {
  chartType: 'calls' | 'revenue' | 'quality';
  timeRange: '1h' | '24h' | '7d' | '30d';
}

export function RealtimeChart({ chartType, timeRange }: RealtimeChartProps) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  
  useEffect(() => {
    const subscription = supabase
      .channel(`${chartType}-updates`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: getTableForChartType(chartType),
      }, (payload) => {
        setData(prev => updateChartData(prev, payload, timeRange));
      })
      .subscribe();
      
    return () => supabase.removeChannel(subscription);
  }, [chartType, timeRange]);
  
  return (
    <div className="chart-container">
      <ChartComponent data={data} type={chartType} />
    </div>
  );
}
```

# Activity Feed
```tsx
interface ActivityFeedProps {
  userId?: string;
  limit?: number;
}

export function ActivityFeed({ userId, limit = 10 }: ActivityFeedProps) {
  const { data: activities, loading } = useQuery({
    queryKey: ['activity-feed', userId, limit],
    queryFn: () => fetchUserActivities(userId, limit),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  
  if (loading) return <ActivityFeedSkeleton />;
  
  return (
    <div className="activity-feed">
      {activities?.map(activity => (
        <ActivityItem
          key={activity.id}
          activity={activity}
          timestamp={activity.created_at}
        />
      ))}
    </div>
  );
}
```

# Role-Specific Dashboards
```tsx
// Supplier Dashboard Components
export function SupplierDashboard() {
  return (
    <>
      <MetricsCards userRole="supplier" timeRange={timeRange} />
      <div className="dashboard-grid">
        <AvailableCampaigns />
        <RecentCalls />
        <EarningsChart />
        <QualityTrends />
      </div>
    </>
  );
}

// Buyer Dashboard Components
export function BuyerDashboard() {
  return (
    <>
      <MetricsCards userRole="buyer" timeRange={timeRange} />
      <div className="dashboard-grid">
        <CampaignPerformance />
        <IncomingLeads />
        <ConversionFunnel />
        <BudgetUtilization />
      </div>
    </>
  );
}
```

# Interactive Widgets
- Draggable widget positioning
- Resizable chart containers
- Customizable time ranges
- Filter and search capabilities

# Data Refresh Patterns
```tsx
// Auto-refresh hook for dashboard data
export function useAutoRefresh(interval = 30000) {
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  
  useEffect(() => {
    const timer = setInterval(() => {
      setLastRefresh(Date.now());
    }, interval);
    
    return () => clearInterval(timer);
  }, [interval]);
  
  return lastRefresh;
}
```

# Performance Optimization
- Virtual scrolling for large datasets
- Memoized expensive calculations
- Debounced filter updates
- Lazy loading of chart components

# Mobile Dashboard
- Responsive grid layouts
- Touch-friendly interactions
- Swipeable metric cards
- Collapsible sections

# Error States
- Network connection issues
- Data loading failures
- Permission denied scenarios
- Empty state handling

# Customization Features
- Widget visibility toggles
- Color theme preferences
- Metric display options
- Export functionality

# CRITICAL RULES
- NO regex in dashboard logic
- NO any types in component interfaces
- ALWAYS handle real-time data properly
- ALWAYS implement proper loading states
- OPTIMIZE for performance with large datasets
- TEST all interactive dashboard features
- ENSURE mobile responsiveness
- IMPLEMENT proper error boundaries