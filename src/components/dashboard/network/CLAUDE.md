# Network Dashboard Components Directory

This directory contains components for the network overview dashboard, showing platform-wide metrics and activity.

## Directory Purpose
- Platform-wide metrics display
- Network activity monitoring
- Marketplace overview
- Cross-role analytics

## Component Types
- **NetworkOverview.tsx** - Main network dashboard
- **MarketplaceStats.tsx** - Supply/demand metrics
- **ActiveCampaigns.tsx** - Live campaign tracker
- **NetworkMap.tsx** - Geographic activity view
- **TopPerformers.tsx** - Leading suppliers/buyers
- **TrendAnalysis.tsx** - Market trend charts
- **NetworkHealth.tsx** - System-wide health
- **ActivityFeed.tsx** - Real-time activity stream

## Network Dashboard Layout
```tsx
export function NetworkDashboard() {
  const { data: networkStats } = useNetworkStats();
  
  return (
    <DashboardLayout role="network">
      <div className="network-grid">
        <MarketplaceStats stats={networkStats?.marketplace} />
        <NetworkMap activity={networkStats?.geographic} />
        <TopPerformers performers={networkStats?.topUsers} />
        <ActivityFeed />
      </div>
    </DashboardLayout>
  );
}
```

## Marketplace Statistics
```tsx
interface MarketplaceMetrics {
  totalSuppliers: number;
  totalBuyers: number;
  activeCampaigns: number;
  dailyCallVolume: number;
  averageBidPrice: number;
  fillRate: number;
}

export function MarketplaceStats({ stats }: { stats: MarketplaceMetrics }) {
  return (
    <div className="marketplace-stats">
      <StatCard
        title="Active Suppliers"
        value={stats.totalSuppliers}
        change={calculateChange('suppliers')}
      />
      <StatCard
        title="Active Buyers"
        value={stats.totalBuyers}
        change={calculateChange('buyers')}
      />
      <StatCard
        title="Daily Call Volume"
        value={stats.dailyCallVolume}
        format="number"
      />
      <StatCard
        title="Avg Bid Price"
        value={stats.averageBidPrice}
        format="currency"
      />
    </div>
  );
}
```

## Geographic Network Map
```tsx
export function NetworkMap({ activity }: { activity: GeoActivity[] }) {
  return (
    <Card className="network-map">
      <Card.Header>
        <h3>Network Activity Map</h3>
        <MapControls />
      </Card.Header>
      <Card.Body>
        <InteractiveMap
          data={activity}
          showHeatmap
          showRoutes
          onRegionClick={handleRegionClick}
        />
        <MapLegend />
      </Card.Body>
    </Card>
  );
}
```

## Top Performers Widget
```tsx
interface Performer {
  id: string;
  name: string;
  type: 'supplier' | 'buyer';
  metric: number;
  trend: 'up' | 'down' | 'stable';
  rank: number;
}

export function TopPerformers({ performers }: { performers: Performer[] }) {
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [metric, setMetric] = useState<'volume' | 'revenue' | 'quality'>('volume');
  
  return (
    <Card>
      <Card.Header>
        <h3>Top Performers</h3>
        <div className="controls">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
          <MetricSelector value={metric} onChange={setMetric} />
        </div>
      </Card.Header>
      <Card.Body>
        <PerformerList performers={performers} metric={metric} />
      </Card.Body>
    </Card>
  );
}
```

## Real-time Activity Feed
```tsx
interface ActivityItem {
  id: string;
  type: 'campaign_created' | 'call_completed' | 'payment_processed' | 'user_joined';
  actor: string;
  description: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  
  useRealtimeChannel('network-activity', 'new_activity', (payload) => {
    setActivities(prev => [payload, ...prev].slice(0, 50));
  });
  
  return (
    <div className="activity-feed">
      <h3>Live Network Activity</h3>
      <div className="feed-items">
        {activities.map(activity => (
          <ActivityItem key={activity.id} activity={activity} />
        ))}
      </div>
    </div>
  );
}
```

## Trend Analysis
```tsx
export function TrendAnalysis() {
  const { data: trends } = useNetworkTrends();
  
  return (
    <Card>
      <Card.Header>
        <h3>Market Trends</h3>
        <TrendPeriodSelector />
      </Card.Header>
      <Card.Body>
        <TrendChart
          data={trends}
          series={[
            { key: 'callVolume', name: 'Call Volume' },
            { key: 'avgBidPrice', name: 'Avg Bid Price' },
            { key: 'conversionRate', name: 'Conversion Rate' }
          ]}
        />
        <TrendInsights insights={trends?.insights} />
      </Card.Body>
    </Card>
  );
}
```

## Network Health Monitoring
```tsx
export function NetworkHealth() {
  const health = useNetworkHealth();
  
  return (
    <div className="network-health">
      <HealthScore score={health.overall} />
      <HealthMetrics
        metrics={[
          { name: 'API Latency', value: health.apiLatency, unit: 'ms' },
          { name: 'Call Success Rate', value: health.callSuccess, unit: '%' },
          { name: 'Payment Processing', value: health.paymentSuccess, unit: '%' },
          { name: 'Fraud Detection', value: health.fraudCaught, unit: 'blocked' }
        ]}
      />
    </div>
  );
}
```

## Campaign Marketplace
```tsx
export function ActiveCampaigns() {
  const { data: campaigns } = useActiveCampaigns();
  
  return (
    <Table
      data={campaigns}
      columns={[
        { key: 'name', header: 'Campaign' },
        { key: 'supplier', header: 'Supplier' },
        { key: 'bidPrice', header: 'Bid', format: 'currency' },
        { key: 'dailyCap', header: 'Daily Cap' },
        { key: 'fillRate', header: 'Fill Rate', format: 'percentage' },
        { key: 'quality', header: 'Quality Score' }
      ]}
      onRowClick={viewCampaignDetails}
    />
  );
}
```

## Analytics Features
- Supply/demand balance
- Pricing trends
- Quality metrics
- Geographic insights
- User behavior patterns

## Visualization Types
- Heat maps
- Time series charts
- Sankey diagrams
- Network graphs
- Geographic maps

## Data Aggregation
- Real-time metrics
- Hourly rollups
- Daily summaries
- Weekly trends
- Monthly reports

## CRITICAL RULES
- AGGREGATE data properly
- PROTECT user privacy
- SHOW relevant metrics
- OPTIMIZE query performance
- CACHE where appropriate