# Reports Pages

# Page Structure
- `ReportsOverview.tsx` - Main reports dashboard
- `PerformanceReports.tsx` - Campaign and call performance
- `FinancialReports.tsx` - Revenue and payout reports
- `QualityReports.tsx` - Call quality and fraud analysis
- `CustomReports.tsx` - User-defined report builder
- `ScheduledReports.tsx` - Automated report management

# Reports Overview Dashboard
```tsx
export function ReportsOverview() {
  const { user } = useAuth();
  const { data: reportSummary, loading } = useReportSummary(user?.id);
  const { data: recentReports } = useRecentReports(user?.id, 5);
  
  return (
    <AppLayout>
      <div className="reports-overview">
        <PageHeader
          title="Reports & Analytics"
          subtitle="Comprehensive insights into your performance"
          action={
            <Button onClick={() => navigate('/reports/custom/create')}>
              <DocumentPlusIcon className="h-4 w-4" />
              Create Report
            </Button>
          }
        />
        
        <div className="report-categories">
          <ReportCategoryCard
            title="Performance Reports"
            description="Campaign metrics, call volume, and conversion rates"
            icon={ChartBarIcon}
            href="/reports/performance"
            stats={reportSummary.performance}
          />
          <ReportCategoryCard
            title="Financial Reports"
            description="Revenue, payouts, and financial analytics"
            icon={CurrencyDollarIcon}
            href="/reports/financial"
            stats={reportSummary.financial}
          />
          <ReportCategoryCard
            title="Quality Reports"
            description="Call quality, fraud detection, and compliance"
            icon={ShieldCheckIcon}
            href="/reports/quality"
            stats={reportSummary.quality}
          />
          <ReportCategoryCard
            title="Custom Reports"
            description="Build and schedule custom reports"
            icon={CogIcon}
            href="/reports/custom"
            stats={reportSummary.custom}
          />
        </div>
        
        <div className="reports-content">
          <div className="recent-reports">
            <h3>Recent Reports</h3>
            <ReportsList reports={recentReports} />
          </div>
          
          <div className="quick-insights">
            <QuickInsightsPanel data={reportSummary.insights} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
```

# Performance Reports
```tsx
export function PerformanceReports() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: startOfMonth(new Date()),
    end: new Date(),
  });
  const [filters, setFilters] = useState<PerformanceFilters>({});
  
  const { data: performanceData, loading } = usePerformanceData(dateRange, filters);
  
  return (
    <AppLayout>
      <div className="performance-reports">
        <PageHeader
          title="Performance Reports"
          breadcrumbs={[
            { label: 'Reports', href: '/reports' },
            { label: 'Performance' },
          ]}
        />
        
        <div className="report-controls">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            presets={[
              { label: 'Last 7 days', range: { start: subDays(new Date(), 7), end: new Date() } },
              { label: 'Last 30 days', range: { start: subDays(new Date(), 30), end: new Date() } },
              { label: 'This month', range: { start: startOfMonth(new Date()), end: new Date() } },
            ]}
          />
          
          <PerformanceFilters
            filters={filters}
            onChange={setFilters}
          />
          
          <ExportButton
            data={performanceData}
            filename={`performance-report-${format(new Date(), 'yyyy-MM-dd')}`}
            formats={['csv', 'xlsx', 'pdf']}
          />
        </div>
        
        {loading ? (
          <ReportSkeleton />
        ) : (
          <div className="performance-content">
            <div className="performance-summary">
              <MetricCard
                title="Total Calls"
                value={performanceData.totalCalls}
                change={performanceData.callsChange}
                icon={PhoneIcon}
              />
              <MetricCard
                title="Conversion Rate"
                value={`${performanceData.conversionRate}%`}
                change={performanceData.conversionChange}
                icon={TrendingUpIcon}
              />
              <MetricCard
                title="Avg Call Duration"
                value={formatDuration(performanceData.avgDuration)}
                change={performanceData.durationChange}
                icon={ClockIcon}
              />
              <MetricCard
                title="Quality Score"
                value={performanceData.qualityScore}
                change={performanceData.qualityChange}
                icon={StarIcon}
              />
            </div>
            
            <div className="performance-charts">
              <div className="chart-container">
                <h3>Call Volume Trends</h3>
                <LineChart
                  data={performanceData.callTrends}
                  xKey="date"
                  yKey="calls"
                  height={300}
                />
              </div>
              
              <div className="chart-container">
                <h3>Conversion Rate by Source</h3>
                <BarChart
                  data={performanceData.conversionBySource}
                  xKey="source"
                  yKey="rate"
                  height={300}
                />
              </div>
            </div>
            
            <div className="performance-table">
              <h3>Campaign Performance Details</h3>
              <DataTable
                data={performanceData.campaignDetails}
                columns={[
                  { key: 'campaign_name', label: 'Campaign' },
                  { key: 'calls', label: 'Calls' },
                  { key: 'conversions', label: 'Conversions' },
                  { key: 'conversion_rate', label: 'Conv. Rate', render: (rate) => `${rate}%` },
                  { key: 'quality_score', label: 'Quality Score' },
                  { key: 'revenue', label: 'Revenue', render: (revenue) => formatCurrency(revenue) },
                ]}
                sortable
                searchable
              />
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
```

# Financial Reports
```tsx
export function FinancialReports() {
  const { user } = useAuth();
  const [reportType, setReportType] = useState<'revenue' | 'payouts' | 'transactions'>('revenue');
  const [dateRange, setDateRange] = useState<DateRange>({
    start: startOfMonth(new Date()),
    end: new Date(),
  });
  
  const { data: financialData, loading } = useFinancialData(reportType, dateRange);
  
  return (
    <AppLayout>
      <div className="financial-reports">
        <PageHeader
          title="Financial Reports"
          breadcrumbs={[
            { label: 'Reports', href: '/reports' },
            { label: 'Financial' },
          ]}
        />
        
        <div className="financial-controls">
          <SegmentedControl
            options={[
              { value: 'revenue', label: 'Revenue' },
              { value: 'payouts', label: 'Payouts' },
              { value: 'transactions', label: 'Transactions' },
            ]}
            value={reportType}
            onChange={setReportType}
          />
          
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
          />
          
          <Button
            variant="outline"
            onClick={() => generateTaxReport(dateRange)}
          >
            <DocumentTextIcon className="h-4 w-4" />
            Tax Report
          </Button>
        </div>
        
        {loading ? (
          <ReportSkeleton />
        ) : (
          <div className="financial-content">
            {reportType === 'revenue' && (
              <RevenueReportSection data={financialData} dateRange={dateRange} />
            )}
            {reportType === 'payouts' && (
              <PayoutsReportSection data={financialData} dateRange={dateRange} />
            )}
            {reportType === 'transactions' && (
              <TransactionsReportSection data={financialData} dateRange={dateRange} />
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
```

# Quality Reports
```tsx
export function QualityReports() {
  const [selectedMetric, setSelectedMetric] = useState<QualityMetric>('overall_quality');
  const { data: qualityData, loading } = useQualityData(selectedMetric);
  const { data: fraudData } = useFraudData();
  
  return (
    <AppLayout>
      <div className="quality-reports">
        <PageHeader
          title="Quality & Fraud Reports"
          breadcrumbs={[
            { label: 'Reports', href: '/reports' },
            { label: 'Quality' },
          ]}
        />
        
        <div className="quality-overview">
          <QualityScoreCard
            title="Overall Quality Score"
            score={qualityData.overallScore}
            trend={qualityData.scoreTrend}
          />
          <FraudRateCard
            title="Fraud Detection Rate"
            rate={fraudData.detectionRate}
            blocked={fraudData.blockedCalls}
          />
          <QualityDistributionCard
            title="Quality Distribution"
            distribution={qualityData.distribution}
          />
        </div>
        
        <div className="quality-analysis">
          <div className="quality-trends">
            <h3>Quality Score Trends</h3>
            <QualityTrendsChart
              data={qualityData.trends}
              metric={selectedMetric}
            />
          </div>
          
          <div className="fraud-analysis">
            <h3>Fraud Detection Analysis</h3>
            <FraudAnalysisChart
              data={fraudData.analysis}
              onRuleClick={handleFraudRuleClick}
            />
          </div>
        </div>
        
        <div className="quality-details">
          <Tabs defaultValue="quality-factors">
            <TabsList>
              <TabsTrigger value="quality-factors">Quality Factors</TabsTrigger>
              <TabsTrigger value="fraud-rules">Fraud Rules</TabsTrigger>
              <TabsTrigger value="low-quality-calls">Low Quality Calls</TabsTrigger>
            </TabsList>
            
            <TabsContent value="quality-factors">
              <QualityFactorsTable data={qualityData.factors} />
            </TabsContent>
            
            <TabsContent value="fraud-rules">
              <FraudRulesTable data={fraudData.rules} />
            </TabsContent>
            
            <TabsContent value="low-quality-calls">
              <LowQualityCallsTable data={qualityData.lowQualityCalls} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
```

# Custom Report Builder
```tsx
export function CustomReports() {
  const [reports, setReports] = useState<CustomReport[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  
  return (
    <AppLayout>
      <div className="custom-reports">
        <PageHeader
          title="Custom Reports"
          breadcrumbs={[
            { label: 'Reports', href: '/reports' },
            { label: 'Custom' },
          ]}
          action={
            <Button onClick={() => setShowBuilder(true)}>
              <PlusIcon className="h-4 w-4" />
              Create Report
            </Button>
          }
        />
        
        <div className="custom-reports-grid">
          {reports.map(report => (
            <CustomReportCard
              key={report.id}
              report={report}
              onRun={() => runCustomReport(report.id)}
              onEdit={() => editCustomReport(report.id)}
              onDelete={() => deleteCustomReport(report.id)}
            />
          ))}
        </div>
        
        {reports.length === 0 && (
          <EmptyState
            icon={DocumentChartBarIcon}
            title="No custom reports yet"
            description="Create your first custom report to get specific insights"
            action={
              <Button onClick={() => setShowBuilder(true)}>
                Create Report
              </Button>
            }
          />
        )}
        
        {showBuilder && (
          <ReportBuilderModal
            onClose={() => setShowBuilder(false)}
            onSave={(report) => {
              setReports(prev => [...prev, report]);
              setShowBuilder(false);
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}
```

# Report Builder Interface
```tsx
interface ReportBuilderModalProps {
  onClose: () => void;
  onSave: (report: CustomReport) => void;
  initialReport?: CustomReport;
}

export function ReportBuilderModal({ onClose, onSave, initialReport }: ReportBuilderModalProps) {
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    name: initialReport?.name || '',
    description: initialReport?.description || '',
    type: initialReport?.type || 'table',
    dimensions: initialReport?.dimensions || [],
    metrics: initialReport?.metrics || [],
    filters: initialReport?.filters || [],
    scheduling: initialReport?.scheduling || null,
  });
  
  const [previewData, setPreviewData] = useState<ReportData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  const generatePreview = async () => {
    setPreviewLoading(true);
    try {
      const data = await reportService.generatePreview(reportConfig);
      setPreviewData(data);
    } catch (error) {
      toast.error('Failed to generate preview');
    } finally {
      setPreviewLoading(false);
    }
  };
  
  const handleSave = async () => {
    try {
      const report = await reportService.saveCustomReport(reportConfig);
      onSave(report);
    } catch (error) {
      toast.error('Failed to save report');
    }
  };
  
  return (
    <Modal size="xl" onClose={onClose}>
      <div className="report-builder">
        <div className="builder-sidebar">
          <div className="config-section">
            <h3>Report Configuration</h3>
            
            <div className="form-group">
              <label>Report Name</label>
              <Input
                value={reportConfig.name}
                onChange={(e) => setReportConfig(prev => ({
                  ...prev,
                  name: e.target.value,
                }))}
                placeholder="Enter report name"
              />
            </div>
            
            <div className="form-group">
              <label>Description</label>
              <Textarea
                value={reportConfig.description}
                onChange={(e) => setReportConfig(prev => ({
                  ...prev,
                  description: e.target.value,
                }))}
                placeholder="Describe what this report shows"
              />
            </div>
            
            <div className="form-group">
              <label>Report Type</label>
              <Select
                value={reportConfig.type}
                onChange={(value) => setReportConfig(prev => ({
                  ...prev,
                  type: value as ReportType,
                }))}
                options={[
                  { value: 'table', label: 'Data Table' },
                  { value: 'chart', label: 'Chart' },
                  { value: 'dashboard', label: 'Dashboard' },
                ]}
              />
            </div>
          </div>
          
          <DimensionsSelector
            selected={reportConfig.dimensions}
            onChange={(dimensions) => setReportConfig(prev => ({
              ...prev,
              dimensions,
            }))}
          />
          
          <MetricsSelector
            selected={reportConfig.metrics}
            onChange={(metrics) => setReportConfig(prev => ({
              ...prev,
              metrics,
            }))}
          />
          
          <FiltersBuilder
            filters={reportConfig.filters}
            onChange={(filters) => setReportConfig(prev => ({
              ...prev,
              filters,
            }))}
          />
        </div>
        
        <div className="builder-preview">
          <div className="preview-header">
            <h3>Preview</h3>
            <Button
              onClick={generatePreview}
              loading={previewLoading}
              disabled={!reportConfig.metrics.length}
            >
              Generate Preview
            </Button>
          </div>
          
          <div className="preview-content">
            {previewLoading ? (
              <ReportPreviewSkeleton />
            ) : previewData ? (
              <ReportPreview data={previewData} config={reportConfig} />
            ) : (
              <EmptyState
                title="No preview available"
                description="Add metrics and generate a preview"
              />
            )}
          </div>
        </div>
        
        <div className="builder-actions">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!reportConfig.name || !reportConfig.metrics.length}
          >
            Save Report
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

# Scheduled Reports
```tsx
export function ScheduledReports() {
  const { data: scheduledReports, loading } = useScheduledReports();
  const [showScheduler, setShowScheduler] = useState(false);
  
  return (
    <div className="scheduled-reports">
      <div className="section-header">
        <h3>Scheduled Reports</h3>
        <Button onClick={() => setShowScheduler(true)}>
          Schedule Report
        </Button>
      </div>
      
      <div className="scheduled-list">
        {scheduledReports.map(report => (
          <ScheduledReportCard
            key={report.id}
            report={report}
            onToggle={() => toggleScheduledReport(report.id)}
            onEdit={() => editScheduledReport(report.id)}
            onDelete={() => deleteScheduledReport(report.id)}
          />
        ))}
      </div>
      
      {showScheduler && (
        <ReportSchedulerModal
          onClose={() => setShowScheduler(false)}
          onSave={handleScheduleReport}
        />
      )}
    </div>
  );
}
```

# Report Export Features
- Multiple export formats (PDF, Excel, CSV)
- Automated email delivery
- Branded report templates
- Data visualization export
- Scheduled report generation

# Real-time Report Updates
- Live data refresh
- Real-time notifications
- Streaming data updates
- Background report generation
- Progressive data loading

# Report Sharing
- Shareable report links
- Team collaboration
- Report templates
- Public dashboards
- Embed capabilities

# CRITICAL RULES
- NO regex in report generation
- NO any types in report interfaces
- ALWAYS validate report data
- ALWAYS handle large datasets efficiently
- IMPLEMENT proper error handling
- TEST report accuracy thoroughly
- OPTIMIZE query performance
- ENSURE data privacy compliance