# Reports Components

# Report Structure
- `ReportBuilder.tsx` - Custom report creation
- `ReportViewer.tsx` - Report display and interaction
- `ChartComponents.tsx` - Various chart types
- `DataExport.tsx` - Export functionality
- `ReportFilters.tsx` - Advanced filtering

# Report Builder Interface
```tsx
interface ReportBuilderProps {
  onSave: (report: ReportConfig) => void;
  initialConfig?: ReportConfig;
}

export function ReportBuilder({ onSave, initialConfig }: ReportBuilderProps) {
  const [config, setConfig] = useState<ReportConfig>(
    initialConfig || {
      name: '',
      type: 'table',
      metrics: [],
      dimensions: [],
      filters: [],
      dateRange: { start: '', end: '' },
    }
  );
  
  const handleMetricAdd = (metric: ReportMetric) => {
    setConfig(prev => ({
      ...prev,
      metrics: [...prev.metrics, metric],
    }));
  };
  
  return (
    <div className="report-builder">
      <ReportConfigPanel
        config={config}
        onConfigChange={setConfig}
        onMetricAdd={handleMetricAdd}
      />
      <ReportPreview config={config} />
      <Button onClick={() => onSave(config)}>Save Report</Button>
    </div>
  );
}
```

# Chart Components
```tsx
interface ChartProps<T> {
  data: T[];
  type: 'line' | 'bar' | 'pie' | 'area';
  xKey: keyof T;
  yKey: keyof T;
  title?: string;
  loading?: boolean;
}

export function Chart<T>({ data, type, xKey, yKey, title, loading }: ChartProps<T>) {
  if (loading) return <ChartSkeleton />;
  
  const chartConfig = useMemo(() => ({
    data,
    xField: String(xKey),
    yField: String(yKey),
    title: { text: title },
    responsive: true,
  }), [data, xKey, yKey, title]);
  
  const ChartComponent = getChartComponent(type);
  
  return (
    <div className="chart-wrapper">
      <ChartComponent {...chartConfig} />
    </div>
  );
}
```

# Data Export Functionality
```tsx
interface DataExportProps {
  data: unknown[];
  fileName: string;
  formats: ExportFormat[];
}

export function DataExport({ data, fileName, formats }: DataExportProps) {
  const exportData = async (format: ExportFormat) => {
    switch (format) {
      case 'csv':
        return exportToCSV(data, fileName);
      case 'xlsx':
        return exportToExcel(data, fileName);
      case 'pdf':
        return exportToPDF(data, fileName);
      case 'json':
        return exportToJSON(data, fileName);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  };
  
  return (
    <div className="export-controls">
      {formats.map(format => (
        <Button
          key={format}
          onClick={() => exportData(format)}
          variant="outline"
        >
          Export {format.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
```

# Advanced Filtering
```tsx
interface ReportFiltersProps {
  filters: ReportFilter[];
  onFiltersChange: (filters: ReportFilter[]) => void;
  availableFields: FilterField[];
}

export function ReportFilters({ filters, onFiltersChange, availableFields }: ReportFiltersProps) {
  const addFilter = () => {
    const newFilter: ReportFilter = {
      id: generateId(),
      field: '',
      operator: 'equals',
      value: '',
    };
    onFiltersChange([...filters, newFilter]);
  };
  
  const updateFilter = (id: string, updates: Partial<ReportFilter>) => {
    onFiltersChange(filters.map(filter =>
      filter.id === id ? { ...filter, ...updates } : filter
    ));
  };
  
  return (
    <div className="report-filters">
      {filters.map(filter => (
        <FilterRow
          key={filter.id}
          filter={filter}
          availableFields={availableFields}
          onChange={(updates) => updateFilter(filter.id, updates)}
          onRemove={() => onFiltersChange(filters.filter(f => f.id !== filter.id))}
        />
      ))}
      <Button onClick={addFilter} variant="outline">Add Filter</Button>
    </div>
  );
}
```

# Real-time Report Updates
```tsx
export function useRealtimeReportData(reportConfig: ReportConfig) {
  const [data, setData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      const result = await generateReport(reportConfig);
      setData(result);
      setLoading(false);
    };
    
    fetchInitialData();
    
    // Set up real-time subscription
    const subscription = supabase
      .channel('report-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: getTableForReport(reportConfig),
      }, async () => {
        const updatedData = await generateReport(reportConfig);
        setData(updatedData);
      })
      .subscribe();
      
    return () => supabase.removeChannel(subscription);
  }, [reportConfig]);
  
  return { data, loading };
}
```

# Performance Metrics
- Call volume reports
- Conversion rate analysis
- Revenue tracking
- Quality score trends
- Fraud detection summaries

# Campaign Analytics
```tsx
interface CampaignReportProps {
  campaignId: string;
  dateRange: DateRange;
}

export function CampaignReport({ campaignId, dateRange }: CampaignReportProps) {
  const { data, loading } = useQuery({
    queryKey: ['campaign-report', campaignId, dateRange],
    queryFn: () => fetchCampaignAnalytics(campaignId, dateRange),
  });
  
  if (loading) return <ReportSkeleton />;
  
  return (
    <div className="campaign-report">
      <MetricsSummary metrics={data.summary} />
      <Chart
        data={data.callTrends}
        type="line"
        xKey="date"
        yKey="calls"
        title="Call Volume Over Time"
      />
      <DataTable
        data={data.details}
        columns={CAMPAIGN_REPORT_COLUMNS}
        exportable
      />
    </div>
  );
}
```

# Scheduled Reports
- Email delivery setup
- Recurring report generation
- Custom recipient lists
- Report template management

# Data Visualization Best Practices
- Color accessibility
- Clear axis labels
- Interactive tooltips
- Responsive charts
- Print-friendly formats

# Report Templates
```tsx
interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  config: ReportConfig;
  category: 'performance' | 'financial' | 'quality' | 'fraud';
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'daily-performance',
    name: 'Daily Performance Summary',
    description: 'Key metrics for the last 24 hours',
    config: {
      type: 'dashboard',
      metrics: ['calls', 'revenue', 'conversion_rate'],
      dateRange: { type: 'relative', value: '24h' },
    },
    category: 'performance',
  },
  // More templates...
];
```

# CRITICAL RULES
- NO regex in report logic
- NO any types in data interfaces
- ALWAYS validate data before visualization
- ALWAYS handle large datasets efficiently
- IMPLEMENT proper error handling
- TEST export functionality thoroughly
- OPTIMIZE chart rendering performance
- ENSURE accessibility compliance
- PROVIDE clear loading indicators