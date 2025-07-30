# Buyer Dashboard Components Directory

This directory contains components specific to the buyer (advertiser) dashboard, focused on lead acquisition and campaign performance.

## Directory Purpose
- Buyer-specific dashboard views
- Lead quality monitoring
- Campaign performance tracking
- ROI analysis tools

## Component Types
- **BuyerOverview.tsx** - Main buyer dashboard
- **LeadManager.tsx** - Incoming lead management
- **CampaignPerformance.tsx** - Campaign metrics
- **CallRecordings.tsx** - Call playback interface
- **BudgetTracker.tsx** - Spend monitoring
- **QualityScores.tsx** - Lead quality metrics
- **ConversionFunnel.tsx** - Conversion tracking
- **BillingDashboard.tsx** - Invoice and payments

## Buyer Dashboard Layout
```tsx
export function BuyerDashboard() {
  const { data: metrics } = useBuyerMetrics();
  
  return (
    <DashboardLayout role="buyer">
      <div className="buyer-grid">
        <MetricCards metrics={metrics} />
        <LeadManager />
        <CampaignPerformance campaigns={metrics?.campaigns} />
        <BudgetTracker budget={metrics?.budget} />
      </div>
    </DashboardLayout>
  );
}
```

## Lead Management
```tsx
interface Lead {
  id: string;
  callId: string;
  campaignId: string;
  callerPhone: string;
  duration: number;
  recordingUrl?: string;
  quality: 'high' | 'medium' | 'low';
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'rejected';
  cost: number;
  timestamp: Date;
}

export function LeadManager() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<LeadFilter>({
    status: 'new',
    quality: 'all',
    dateRange: 'today'
  });
  
  return (
    <Card>
      <Card.Header>
        <h2>Incoming Leads</h2>
        <LeadFilters value={filter} onChange={setFilter} />
      </Card.Header>
      <Card.Body>
        <LeadTable
          leads={leads}
          onStatusChange={updateLeadStatus}
          onPlayRecording={playRecording}
          onExport={exportLeads}
        />
      </Card.Body>
    </Card>
  );
}
```

## Campaign Performance
```tsx
export function CampaignPerformance({ campaigns }: { campaigns: Campaign[] }) {
  const [selectedCampaign, setSelectedCampaign] = useState<string>();
  
  return (
    <div className="campaign-performance">
      <CampaignSelector
        campaigns={campaigns}
        value={selectedCampaign}
        onChange={setSelectedCampaign}
      />
      
      {selectedCampaign && (
        <>
          <PerformanceMetrics campaignId={selectedCampaign} />
          <ConversionChart campaignId={selectedCampaign} />
          <GeographicHeatmap campaignId={selectedCampaign} />
        </>
      )}
    </div>
  );
}
```

## Call Recordings Player
```tsx
export function CallRecordings() {
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  
  return (
    <div className="call-recordings">
      <CallList onSelect={setSelectedCall} />
      {selectedCall && (
        <CallPlayer
          call={selectedCall}
          onTranscribe={transcribeCall}
          onScore={scoreQuality}
        />
      )}
    </div>
  );
}
```

## Budget Tracking
```tsx
interface BudgetMetrics {
  totalBudget: number;
  spent: number;
  remaining: number;
  dailySpend: number;
  projectedSpend: number;
  costPerLead: number;
  costPerConversion: number;
}

export function BudgetTracker({ budget }: { budget: BudgetMetrics }) {
  return (
    <Card>
      <Card.Header>
        <h3>Budget Overview</h3>
        <BudgetAlerts budget={budget} />
      </Card.Header>
      <Card.Body>
        <BudgetGauge
          spent={budget.spent}
          total={budget.totalBudget}
        />
        <SpendChart dailyData={budget.dailySpend} />
        <CostMetrics
          cpl={budget.costPerLead}
          cpc={budget.costPerConversion}
        />
      </Card.Body>
    </Card>
  );
}
```

## Quality Scoring
```tsx
export function QualityScores() {
  const { data: scores } = useQualityScores();
  
  return (
    <div className="quality-scores">
      <QualityOverview scores={scores} />
      <QualityTrends data={scores?.trends} />
      <QualityFactors factors={scores?.factors} />
      <ImprovementSuggestions suggestions={scores?.suggestions} />
    </div>
  );
}
```

## Conversion Funnel
```tsx
export function ConversionFunnel({ campaignId }: { campaignId: string }) {
  const { data: funnel } = useConversionFunnel(campaignId);
  
  return (
    <div className="conversion-funnel">
      <FunnelChart
        stages={[
          { name: 'Calls Received', value: funnel?.calls },
          { name: 'Qualified Leads', value: funnel?.qualified },
          { name: 'Contacted', value: funnel?.contacted },
          { name: 'Converted', value: funnel?.converted }
        ]}
      />
      <ConversionRates rates={funnel?.rates} />
    </div>
  );
}
```

## ROI Analytics
```tsx
export function ROIAnalytics() {
  return (
    <Card>
      <h3>Return on Investment</h3>
      <ROIChart />
      <ROIBreakdown
        revenue={calculateRevenue()}
        spend={calculateSpend()}
        profit={calculateProfit()}
      />
    </Card>
  );
}
```

## Buyer Actions
- Accept/reject leads
- Play call recordings
- Update lead status
- Adjust campaign bids
- Set quality thresholds
- Export lead data

## Lead Filtering
- By campaign
- By quality score
- By geographic location
- By time range
- By conversion status
- By cost range

## Integration Features
- CRM sync options
- Webhook configuration
- API access setup
- Export templates
- Automated workflows

## CRITICAL RULES
- PROTECT lead privacy
- SECURE recording access
- VALIDATE quality scores
- TRACK all interactions
- RESPECT data retention