# Monitoring Components Directory

This directory contains components for system monitoring, metrics display, and health status visualization.

## Directory Purpose
- Displays system health metrics
- Shows real-time performance data
- Provides alert notifications
- Monitors fraud detection status

## Component Types
- **SystemStatus.tsx** - Overall system health
- **MetricsCard.tsx** - Metric display cards
- **AlertBanner.tsx** - System-wide alerts
- **PerformanceChart.tsx** - Performance graphs
- **UptimeMonitor.tsx** - Service availability
- **FraudIndicator.tsx** - Fraud detection status
- **ErrorBoundary.tsx** - Error monitoring
- **HealthCheck.tsx** - Component health status

## Monitoring Dashboard
```tsx
export function MonitoringDashboard() {
  const { data: metrics } = useRealtimeMetrics();
  
  return (
    <div className="monitoring-grid">
      <SystemStatus status={metrics?.system} />
      <MetricsCard
        title="Active Calls"
        value={metrics?.activeCalls}
        trend={metrics?.callsTrend}
      />
      <PerformanceChart data={metrics?.performance} />
      <FraudIndicator level={metrics?.fraudRisk} />
    </div>
  );
}
```

## Real-time Updates
```tsx
function useRealtimeMetrics() {
  const [metrics, setMetrics] = useState<SystemMetrics>();
  
  useEffect(() => {
    const channel = supabase
      .channel('system-metrics')
      .on('broadcast', { event: 'metrics' }, ({ payload }) => {
        setMetrics(payload);
      })
      .subscribe();
      
    return () => supabase.removeChannel(channel);
  }, []);
  
  return { data: metrics };
}
```

## Metric Types
- **Performance**: Response times, throughput
- **Availability**: Uptime, service health
- **Business**: Call volume, conversion rates
- **Security**: Fraud attempts, blocked IPs
- **Resources**: CPU, memory, storage

## Alert Levels
```typescript
enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

interface Alert {
  id: string;
  level: AlertLevel;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}
```

## Visualization Components
- Line charts for trends
- Gauge charts for capacity
- Heat maps for geographic data
- Status indicators
- Progress bars

## Error Boundary
```tsx
export class MonitoringErrorBoundary extends Component {
  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to monitoring service
    logError(error, info);
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

## Performance Monitoring
- Page load metrics
- API response times
- Database query performance
- Real-time latency
- Resource utilization

## Admin Features
- Acknowledge alerts
- View historical data
- Export metrics
- Configure thresholds
- Manage notifications

## Integration Points
- Sentry for error tracking
- Netlify Analytics
- Custom metrics API
- Supabase performance
- Third-party monitoring

## CRITICAL RULES
- HANDLE real-time disconnects
- SHOW meaningful metrics
- ALERT on critical issues
- OPTIMIZE chart rendering
- TEST monitoring accuracy