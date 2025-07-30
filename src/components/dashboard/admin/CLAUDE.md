# Admin Dashboard Components Directory

This directory contains components specific to the admin dashboard, providing platform management and oversight capabilities.

## Directory Purpose
- Admin-specific dashboard views
- Platform management tools
- User administration interfaces
- System monitoring components

## Component Types
- **AdminOverview.tsx** - Main admin dashboard
- **UserManagement.tsx** - User account control
- **FraudMonitor.tsx** - Fraud detection overview
- **SystemHealth.tsx** - Platform health metrics
- **RevenueAnalytics.tsx** - Financial overview
- **SupportQueue.tsx** - Support ticket management
- **AuditLog.tsx** - System activity logs
- **ConfigPanel.tsx** - Platform configuration

## Admin Dashboard Layout
```tsx
export function AdminDashboard() {
  const { data: stats } = useAdminStats();
  
  return (
    <DashboardLayout role="admin">
      <div className="admin-grid">
        <SystemHealth />
        <RevenueAnalytics revenue={stats?.revenue} />
        <UserManagement totalUsers={stats?.users} />
        <FraudMonitor alerts={stats?.fraudAlerts} />
      </div>
    </DashboardLayout>
  );
}
```

## User Management
```tsx
export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [filters, setFilters] = useState<UserFilters>({
    role: 'all',
    status: 'all',
    search: ''
  });
  
  return (
    <Card>
      <Card.Header>
        <h2>User Management</h2>
        <UserFilters value={filters} onChange={setFilters} />
      </Card.Header>
      <Card.Body>
        <UserTable 
          users={users}
          onSuspend={handleSuspend}
          onVerify={handleVerify}
          onDelete={handleDelete}
        />
      </Card.Body>
    </Card>
  );
}
```

## Fraud Monitoring
```tsx
interface FraudAlert {
  id: string;
  type: 'velocity' | 'pattern' | 'duplicate' | 'suspicious';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId: string;
  description: string;
  timestamp: Date;
  resolved: boolean;
}

export function FraudMonitor() {
  const { data: alerts } = useFraudAlerts();
  
  return (
    <div className="fraud-monitor">
      <FraudStats alerts={alerts} />
      <FraudAlertList 
        alerts={alerts}
        onInvestigate={handleInvestigate}
        onResolve={handleResolve}
      />
    </div>
  );
}
```

## System Health Monitoring
```tsx
export function SystemHealth() {
  const metrics = useSystemMetrics();
  
  return (
    <div className="system-health">
      <MetricCard
        title="API Uptime"
        value={metrics.uptime}
        format="percentage"
        status={metrics.uptime > 99.9 ? 'healthy' : 'warning'}
      />
      <MetricCard
        title="Response Time"
        value={metrics.responseTime}
        format="ms"
        status={metrics.responseTime < 200 ? 'healthy' : 'warning'}
      />
      <MetricCard
        title="Error Rate"
        value={metrics.errorRate}
        format="percentage"
        status={metrics.errorRate < 0.1 ? 'healthy' : 'critical'}
      />
    </div>
  );
}
```

## Revenue Analytics
```tsx
export function RevenueAnalytics() {
  const { data: revenue } = useRevenueData();
  
  return (
    <Card className="revenue-analytics">
      <Card.Header>
        <h3>Revenue Overview</h3>
        <DateRangePicker />
      </Card.Header>
      <Card.Body>
        <RevenueChart data={revenue?.daily} />
        <RevenueBreakdown
          suppliers={revenue?.bySupplier}
          buyers={revenue?.byBuyer}
          total={revenue?.total}
        />
      </Card.Body>
    </Card>
  );
}
```

## Audit Logging
```tsx
interface AuditEntry {
  id: string;
  userId: string;
  action: string;
  resource: string;
  details: Record<string, any>;
  ip: string;
  timestamp: Date;
}

export function AuditLog() {
  const { data: entries, loading } = useAuditLog();
  
  return (
    <Table
      data={entries}
      columns={[
        { key: 'timestamp', header: 'Time', format: formatDate },
        { key: 'userId', header: 'User' },
        { key: 'action', header: 'Action' },
        { key: 'resource', header: 'Resource' },
        { key: 'ip', header: 'IP Address' }
      ]}
      loading={loading}
    />
  );
}
```

## Admin Actions
- Suspend/activate users
- Override campaign settings
- Adjust fraud thresholds
- Manage platform fees
- Configure integrations
- Export reports

## Security Features
- IP whitelisting
- Session management
- Action logging
- Permission verification
- Two-factor enforcement

## Performance Dashboards
- Real-time metrics
- Historical trends
- Predictive analytics
- Capacity planning
- Cost optimization

## CRITICAL RULES
- VERIFY admin permissions
- LOG all admin actions
- REQUIRE 2FA for sensitive ops
- IMPLEMENT rate limiting
- AUDIT data access