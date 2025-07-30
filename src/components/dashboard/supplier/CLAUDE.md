# Supplier Dashboard Components Directory

This directory contains components specific to the supplier (traffic provider) dashboard, focused on campaign management and revenue optimization.

## Directory Purpose
- Supplier-specific dashboard views
- Campaign creation and management
- Traffic optimization tools
- Revenue tracking interfaces

## Component Types
- **SupplierOverview.tsx** - Main supplier dashboard
- **CampaignBuilder.tsx** - Campaign creation wizard
- **TrafficManager.tsx** - Traffic routing controls
- **RevenueTracker.tsx** - Earnings monitoring
- **PerformanceMetrics.tsx** - Campaign analytics
- **PayoutDashboard.tsx** - Payment tracking
- **OptimizationTools.tsx** - A/B testing and optimization
- **IntegrationStatus.tsx** - API integration health

## Supplier Dashboard Layout
```tsx
export function SupplierDashboard() {
  const { data: metrics } = useSupplierMetrics();
  
  return (
    <DashboardLayout role="supplier">
      <div className="supplier-grid">
        <RevenueTracker revenue={metrics?.revenue} />
        <ActiveCampaignsList campaigns={metrics?.campaigns} />
        <TrafficManager traffic={metrics?.traffic} />
        <PayoutDashboard payouts={metrics?.payouts} />
      </div>
    </DashboardLayout>
  );
}
```

## Campaign Builder
```tsx
interface CampaignConfig {
  name: string;
  vertical: string;
  geoTargets: string[];
  bidPrice: number;
  dailyCap: number;
  hours: { start: string; end: string };
  qualityThreshold: number;
}

export function CampaignBuilder() {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<CampaignConfig>({});
  
  const steps = [
    { id: 1, name: 'Basic Info', component: BasicInfoStep },
    { id: 2, name: 'Targeting', component: TargetingStep },
    { id: 3, name: 'Pricing', component: PricingStep },
    { id: 4, name: 'Review', component: ReviewStep }
  ];
  
  return (
    <div className="campaign-builder">
      <StepIndicator currentStep={step} steps={steps} />
      <StepContent
        step={steps[step - 1]}
        config={config}
        onChange={setConfig}
        onNext={() => setStep(step + 1)}
        onBack={() => setStep(step - 1)}
        onSubmit={createCampaign}
      />
    </div>
  );
}
```

## Traffic Management
```tsx
export function TrafficManager({ traffic }: { traffic: TrafficData }) {
  const [routing, setRouting] = useState<RoutingRules>({});
  
  return (
    <Card>
      <Card.Header>
        <h3>Traffic Management</h3>
        <TrafficControls />
      </Card.Header>
      <Card.Body>
        <TrafficFlow
          incoming={traffic.incoming}
          routed={traffic.routed}
          rejected={traffic.rejected}
        />
        <RoutingRules
          rules={routing}
          onChange={setRouting}
          onApply={applyRoutingRules}
        />
        <QualityFilters />
      </Card.Body>
    </Card>
  );
}
```

## Revenue Tracking
```tsx
interface RevenueMetrics {
  today: number;
  yesterday: number;
  weekToDate: number;
  monthToDate: number;
  pendingPayout: number;
  lifetimeEarnings: number;
}

export function RevenueTracker({ revenue }: { revenue: RevenueMetrics }) {
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  
  return (
    <div className="revenue-tracker">
      <RevenueCards revenue={revenue} />
      <RevenueChart
        data={getRevenueData(timeframe)}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
      />
      <RevenueBreakdown
        byCampaign={revenue.byCampaign}
        byGeo={revenue.byGeo}
        byVertical={revenue.byVertical}
      />
    </div>
  );
}
```

## Performance Analytics
```tsx
export function PerformanceMetrics() {
  const { data: metrics } = usePerformanceMetrics();
  
  return (
    <div className="performance-metrics">
      <MetricGrid>
        <MetricCard
          title="Call Volume"
          value={metrics?.callVolume}
          comparison={metrics?.callVolumeChange}
        />
        <MetricCard
          title="Conversion Rate"
          value={metrics?.conversionRate}
          format="percentage"
        />
        <MetricCard
          title="Avg Call Duration"
          value={metrics?.avgDuration}
          format="duration"
        />
        <MetricCard
          title="Revenue per Call"
          value={metrics?.revenuePerCall}
          format="currency"
        />
      </MetricGrid>
      <PerformanceTrends data={metrics?.trends} />
    </div>
  );
}
```

## Payout Management
```tsx
interface Payout {
  id: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  date: Date;
  method: 'bank' | 'paypal' | 'wire';
  reference: string;
}

export function PayoutDashboard({ payouts }: { payouts: PayoutData }) {
  return (
    <Card>
      <Card.Header>
        <h3>Payouts</h3>
        <Button onClick={requestPayout}>Request Payout</Button>
      </Card.Header>
      <Card.Body>
        <PayoutSummary
          available={payouts.available}
          pending={payouts.pending}
          nextPayout={payouts.nextDate}
        />
        <PayoutHistory payouts={payouts.history} />
      </Card.Body>
    </Card>
  );
}
```

## Campaign Optimization
```tsx
export function OptimizationTools() {
  const { data: tests } = useABTests();
  
  return (
    <div className="optimization-tools">
      <ABTestManager tests={tests} />
      <OptimizationSuggestions />
      <BidOptimizer
        currentBids={getCurrentBids()}
        suggestions={getBidSuggestions()}
        onApply={applyBidChanges}
      />
      <GeoPerformance />
    </div>
  );
}
```

## Integration Monitoring
```tsx
export function IntegrationStatus() {
  const { data: integrations } = useIntegrations();
  
  return (
    <div className="integration-status">
      {integrations?.map(integration => (
        <IntegrationCard
          key={integration.id}
          name={integration.name}
          status={integration.status}
          lastSync={integration.lastSync}
          errors={integration.errors}
          onTest={() => testIntegration(integration.id)}
          onConfigure={() => configureIntegration(integration.id)}
        />
      ))}
    </div>
  );
}
```

## Supplier Actions
- Create/edit campaigns
- Adjust bid prices
- Set traffic caps
- Configure routing rules
- Request payouts
- View call logs

## Traffic Optimization
- Geographic targeting
- Time-based routing
- Quality filtering
- Vertical selection
- Budget allocation

## Reporting Features
- Real-time statistics
- Historical reports
- Export capabilities
- Custom date ranges
- Comparative analysis

## CRITICAL RULES
- VALIDATE campaign settings
- ENFORCE quality standards
- TRACK all traffic accurately
- SECURE payout processes
- OPTIMIZE for performance