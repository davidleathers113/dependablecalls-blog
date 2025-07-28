import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { rest } from 'msw'
import { setupServer } from 'msw/node'

// Mock components
const AdminDashboard = () => <div>Admin Dashboard Component</div>
const SystemMonitoring = () => <div>System Monitoring Component</div>
const UserManagement = () => <div>User Management Component</div>
const ConfigurationCenter = () => <div>Configuration Center Component</div>

// MSW server setup
const server = setupServer(
  rest.get('/api/v1/admin/system/health', (req, res, ctx) => {
    return res(
      ctx.json({
        status: 'healthy',
        uptime: 864000, // 10 days in seconds
        metrics: {
          cpu_usage: 45.2,
          memory_usage: 68.5,
          disk_usage: 52.3,
          active_connections: 342,
          request_rate: 1250,
          error_rate: 0.02,
          response_time_p50: 45,
          response_time_p95: 128,
          response_time_p99: 312,
        },
        services: [
          { name: 'API Gateway', status: 'healthy', uptime: 864000, version: '2.3.1' },
          { name: 'Database', status: 'healthy', uptime: 864000, connections: 45 },
          { name: 'Redis Cache', status: 'healthy', uptime: 863950, memory_usage: 2.4 },
          { name: 'WebSocket Server', status: 'degraded', uptime: 432000, active_connections: 892 },
          { name: 'Background Jobs', status: 'healthy', uptime: 863000, queue_size: 23 },
        ],
        alerts: [
          {
            id: 'alert-1',
            severity: 'warning',
            service: 'WebSocket Server',
            message: 'High connection count detected',
            timestamp: new Date(Date.now() - 1800000).toISOString(),
          },
          {
            id: 'alert-2',
            severity: 'info',
            service: 'Database',
            message: 'Scheduled maintenance in 24 hours',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
          },
        ],
      })
    )
  }),
  
  rest.get('/api/v1/admin/users', (req, res, ctx) => {
    const page = parseInt(req.url.searchParams.get('page') || '1')
    const search = req.url.searchParams.get('search') || ''
    const role = req.url.searchParams.get('role') || ''
    
    return res(
      ctx.json({
        users: [
          {
            id: 'user-1',
            email: 'john.buyer@insurance.com',
            name: 'John Smith',
            role: 'buyer',
            status: 'active',
            company: 'Insurance Direct LLC',
            created_at: '2023-06-15T10:00:00Z',
            last_login: new Date(Date.now() - 3600000).toISOString(),
            activity: {
              total_purchases: 342,
              total_spent: 15420.00,
              avg_quality_score: 88,
            },
          },
          {
            id: 'user-2',
            email: 'sarah.supplier@leads.com',
            name: 'Sarah Johnson',
            role: 'supplier',
            status: 'active',
            company: 'Premium Leads Inc',
            created_at: '2023-04-20T10:00:00Z',
            last_login: new Date(Date.now() - 7200000).toISOString(),
            activity: {
              total_listings: 25,
              total_sales: 1842,
              total_revenue: 82890.00,
            },
          },
          {
            id: 'user-3',
            email: 'mike.network@partners.com',
            name: 'Mike Wilson',
            role: 'network',
            status: 'suspended',
            company: 'Connect Partners',
            created_at: '2023-08-10T10:00:00Z',
            last_login: new Date(Date.now() - 86400000).toISOString(),
            suspension_reason: 'Policy violation - excessive disputes',
            suspension_date: new Date(Date.now() - 259200000).toISOString(),
          },
        ],
        pagination: {
          page,
          per_page: 20,
          total: 1547,
          total_pages: 78,
        },
      })
    )
  }),
  
  rest.get('/api/v1/admin/analytics/overview', (req, res, ctx) => {
    return res(
      ctx.json({
        platform_metrics: {
          total_users: 1547,
          active_users_today: 423,
          new_users_this_week: 38,
          total_transactions_today: 2841,
          total_volume_today: 127635.00,
          platform_revenue_today: 19145.25,
        },
        growth_metrics: {
          user_growth_rate: 0.15,
          transaction_growth_rate: 0.23,
          revenue_growth_rate: 0.19,
        },
        performance_by_category: [
          { category: 'insurance', volume: 45230.00, transactions: 1005, avg_price: 45.00 },
          { category: 'home_services', volume: 38420.00, transactions: 1098, avg_price: 35.00 },
          { category: 'legal', volume: 28150.00, transactions: 512, avg_price: 55.00 },
          { category: 'financial', volume: 15835.00, transactions: 226, avg_price: 70.00 },
        ],
      })
    )
  }),
  
  rest.get('/api/v1/admin/config', (req, res, ctx) => {
    return res(
      ctx.json({
        system_config: {
          platform_fees: {
            buyer_fee_percentage: 0.05,
            supplier_fee_percentage: 0.08,
            network_commission_base: 0.12,
          },
          quality_thresholds: {
            min_quality_score: 70,
            premium_quality_threshold: 85,
            auto_suspend_threshold: 60,
          },
          limits: {
            max_daily_transactions_per_user: 500,
            max_listing_price: 500.00,
            min_listing_price: 5.00,
            max_bulk_upload_size: 10000,
          },
          features: {
            dynamic_pricing_enabled: true,
            auto_matching_enabled: true,
            fraud_detection_enabled: true,
            real_time_analytics_enabled: true,
          },
        },
        integrations: [
          { name: 'Stripe', status: 'connected', last_sync: '2024-01-15T12:00:00Z' },
          { name: 'Twilio', status: 'connected', last_sync: '2024-01-15T12:30:00Z' },
          { name: 'SendGrid', status: 'connected', last_sync: '2024-01-15T11:45:00Z' },
          { name: 'Segment', status: 'error', error: 'API key expired' },
        ],
      })
    )
  }),
  
  rest.post('/api/v1/admin/users/:userId/suspend', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        user_id: req.params.userId,
        status: 'suspended',
        suspended_until: req.body.duration === 'permanent' ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
    )
  }),
  
  rest.put('/api/v1/admin/config/update', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        updated_fields: Object.keys(req.body),
        effective_at: new Date().toISOString(),
      })
    )
  })
)

beforeEach(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Test utilities
const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  
  const store = configureStore({
    reducer: {
      auth: (state = { user: { role: 'admin' } }) => state,
      admin: (state = {}) => state,
    },
  })
  
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <BrowserRouter>
          {component}
        </BrowserRouter>
      </Provider>
    </QueryClientProvider>
  )
}

describe('Admin System Management Integration', () => {
  describe('System Health Monitoring', () => {
    it('displays comprehensive system health metrics', async () => {
      renderWithProviders(<SystemMonitoring />)
      
      // Wait for health data
      await waitFor(() => {
        expect(screen.getByText(/status: healthy/i)).toBeInTheDocument()
        expect(screen.getByText(/uptime: 10 days/i)).toBeInTheDocument()
        expect(screen.getByText(/cpu usage: 45.2%/i)).toBeInTheDocument()
        expect(screen.getByText(/memory usage: 68.5%/i)).toBeInTheDocument()
        expect(screen.getByText(/active connections: 342/i)).toBeInTheDocument()
      })
      
      // Check service statuses
      expect(screen.getByText('API Gateway')).toHaveClass('status-healthy')
      expect(screen.getByText('WebSocket Server')).toHaveClass('status-degraded')
    })
    
    it('shows system alerts and notifications', async () => {
      renderWithProviders(<SystemMonitoring />)
      
      await waitFor(() => {
        const alerts = screen.getAllByTestId('system-alert')
        expect(alerts).toHaveLength(2)
        
        // Warning alert
        expect(within(alerts[0]).getByText(/high connection count/i)).toBeInTheDocument()
        expect(within(alerts[0]).getByText(/websocket server/i)).toBeInTheDocument()
        
        // Info alert
        expect(within(alerts[1]).getByText(/scheduled maintenance/i)).toBeInTheDocument()
      })
    })
    
    it('displays response time percentiles', async () => {
      renderWithProviders(<SystemMonitoring />)
      
      await waitFor(() => {
        const perfMetrics = screen.getByTestId('performance-metrics')
        expect(within(perfMetrics).getByText(/p50: 45ms/i)).toBeInTheDocument()
        expect(within(perfMetrics).getByText(/p95: 128ms/i)).toBeInTheDocument()
        expect(within(perfMetrics).getByText(/p99: 312ms/i)).toBeInTheDocument()
      })
    })
    
    it('allows drilling down into service details', async () => {
      const user = userEvent.setup()
      renderWithProviders(<SystemMonitoring />)
      
      await waitFor(() => {
        expect(screen.getByText('Database')).toBeInTheDocument()
      })
      
      // Click on database service
      await user.click(screen.getByText('Database'))
      
      // Check detailed view
      const detailModal = screen.getByRole('dialog')
      expect(within(detailModal).getByText(/connections: 45/i)).toBeInTheDocument()
      expect(within(detailModal).getByText(/query performance/i)).toBeInTheDocument()
      expect(within(detailModal).getByTestId('connection-pool-chart')).toBeInTheDocument()
    })
  })
  
  describe('User Management', () => {
    it('displays user list with activity metrics', async () => {
      renderWithProviders(<UserManagement />)
      
      await waitFor(() => {
        expect(screen.getByText('john.buyer@insurance.com')).toBeInTheDocument()
        expect(screen.getByText('sarah.supplier@leads.com')).toBeInTheDocument()
        expect(screen.getByText('mike.network@partners.com')).toBeInTheDocument()
      })
      
      // Check user details
      const userRows = screen.getAllByTestId('user-row')
      
      // Buyer metrics
      expect(within(userRows[0]).getByText(/342 purchases/i)).toBeInTheDocument()
      expect(within(userRows[0]).getByText(/\$15,420 spent/i)).toBeInTheDocument()
      
      // Supplier metrics
      expect(within(userRows[1]).getByText(/25 listings/i)).toBeInTheDocument()
      expect(within(userRows[1]).getByText(/\$82,890 revenue/i)).toBeInTheDocument()
      
      // Suspended user
      expect(within(userRows[2]).getByText(/suspended/i)).toHaveClass('status-suspended')
    })
    
    it('filters users by role and status', async () => {
      const user = userEvent.setup()
      renderWithProviders(<UserManagement />)
      
      // Filter by role
      await user.selectOptions(screen.getByLabelText(/role filter/i), 'buyer')
      
      await waitFor(() => {
        const userRows = screen.getAllByTestId('user-row')
        userRows.forEach(row => {
          expect(within(row).getByText(/buyer/i)).toBeInTheDocument()
        })
      })
      
      // Filter by status
      await user.selectOptions(screen.getByLabelText(/status filter/i), 'suspended')
      
      await waitFor(() => {
        const userRows = screen.getAllByTestId('user-row')
        userRows.forEach(row => {
          expect(within(row).getByText(/suspended/i)).toBeInTheDocument()
        })
      })
    })
    
    it('searches users by name or email', async () => {
      const user = userEvent.setup()
      renderWithProviders(<UserManagement />)
      
      // Search by email
      const searchInput = screen.getByPlaceholderText(/search users/i)
      await user.type(searchInput, 'insurance.com')
      
      await waitFor(() => {
        expect(screen.getByText('john.buyer@insurance.com')).toBeInTheDocument()
        expect(screen.queryByText('sarah.supplier@leads.com')).not.toBeInTheDocument()
      })
    })
    
    it('handles user suspension', async () => {
      const user = userEvent.setup()
      renderWithProviders(<UserManagement />)
      
      await waitFor(() => {
        expect(screen.getByText('john.buyer@insurance.com')).toBeInTheDocument()
      })
      
      // Open user actions
      const firstUserRow = screen.getAllByTestId('user-row')[0]
      await user.click(within(firstUserRow).getByRole('button', { name: /actions/i }))
      await user.click(screen.getByRole('menuitem', { name: /suspend user/i }))
      
      // Fill suspension form
      const suspendDialog = screen.getByRole('dialog')
      await user.selectOptions(within(suspendDialog).getByLabelText(/duration/i), '7_days')
      await user.type(
        within(suspendDialog).getByLabelText(/reason/i),
        'Violation of terms of service - fraudulent activity'
      )
      
      await user.click(within(suspendDialog).getByRole('button', { name: /confirm suspension/i }))
      
      // Verify suspension
      await waitFor(() => {
        expect(screen.getByText(/user suspended successfully/i)).toBeInTheDocument()
        expect(within(firstUserRow).getByText(/suspended/i)).toBeInTheDocument()
      })
    })
    
    it('exports user data', async () => {
      const user = userEvent.setup()
      renderWithProviders(<UserManagement />)
      
      // Open export options
      await user.click(screen.getByRole('button', { name: /export data/i }))
      
      // Select export format
      const exportDialog = screen.getByRole('dialog')
      await user.click(within(exportDialog).getByLabelText(/csv format/i))
      await user.click(within(exportDialog).getByLabelText(/include activity metrics/i))
      
      await user.click(within(exportDialog).getByRole('button', { name: /export/i }))
      
      // Verify export initiated
      await waitFor(() => {
        expect(screen.getByText(/export started/i)).toBeInTheDocument()
      })
    })
  })
  
  describe('Platform Analytics', () => {
    it('displays platform-wide metrics', async () => {
      renderWithProviders(<AdminDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText(/total users: 1,547/i)).toBeInTheDocument()
        expect(screen.getByText(/active today: 423/i)).toBeInTheDocument()
        expect(screen.getByText(/transactions today: 2,841/i)).toBeInTheDocument()
        expect(screen.getByText(/volume today: \$127,635/i)).toBeInTheDocument()
        expect(screen.getByText(/revenue today: \$19,145/i)).toBeInTheDocument()
      })
      
      // Check growth indicators
      expect(screen.getByText(/user growth: \+15%/i)).toBeInTheDocument()
      expect(screen.getByText(/transaction growth: \+23%/i)).toBeInTheDocument()
      expect(screen.getByText(/revenue growth: \+19%/i)).toBeInTheDocument()
    })
    
    it('shows category performance breakdown', async () => {
      renderWithProviders(<AdminDashboard />)
      
      await waitFor(() => {
        const categoryTable = screen.getByTestId('category-performance')
        
        expect(within(categoryTable).getByText('insurance')).toBeInTheDocument()
        expect(within(categoryTable).getByText(/\$45,230/i)).toBeInTheDocument()
        expect(within(categoryTable).getByText(/1,005 transactions/i)).toBeInTheDocument()
        
        expect(within(categoryTable).getByText('home_services')).toBeInTheDocument()
        expect(within(categoryTable).getByText(/\$38,420/i)).toBeInTheDocument()
        expect(within(categoryTable).getByText(/1,098 transactions/i)).toBeInTheDocument()
      })
    })
  })
  
  describe('System Configuration', () => {
    it('displays current system configuration', async () => {
      renderWithProviders(<ConfigurationCenter />)
      
      await waitFor(() => {
        // Fee configuration
        expect(screen.getByText(/buyer fee: 5%/i)).toBeInTheDocument()
        expect(screen.getByText(/supplier fee: 8%/i)).toBeInTheDocument()
        expect(screen.getByText(/network commission: 12%/i)).toBeInTheDocument()
        
        // Quality settings
        expect(screen.getByText(/min quality score: 70/i)).toBeInTheDocument()
        expect(screen.getByText(/premium threshold: 85/i)).toBeInTheDocument()
        
        // Feature flags
        expect(screen.getByLabelText(/dynamic pricing/i)).toBeChecked()
        expect(screen.getByLabelText(/fraud detection/i)).toBeChecked()
      })
    })
    
    it('updates system configuration', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ConfigurationCenter />)
      
      await waitFor(() => {
        expect(screen.getByText(/buyer fee: 5%/i)).toBeInTheDocument()
      })
      
      // Modify fee settings
      const buyerFeeInput = screen.getByLabelText(/buyer fee percentage/i)
      await user.clear(buyerFeeInput)
      await user.type(buyerFeeInput, '6')
      
      // Toggle feature flag
      await user.click(screen.getByLabelText(/auto matching/i))
      
      // Save changes
      await user.click(screen.getByRole('button', { name: /save configuration/i }))
      
      // Confirm changes
      const confirmDialog = screen.getByRole('dialog')
      expect(within(confirmDialog).getByText(/confirm configuration changes/i)).toBeInTheDocument()
      expect(within(confirmDialog).getByText(/buyer fee: 5% → 6%/i)).toBeInTheDocument()
      
      await user.click(within(confirmDialog).getByRole('button', { name: /confirm/i }))
      
      // Verify success
      await waitFor(() => {
        expect(screen.getByText(/configuration updated successfully/i)).toBeInTheDocument()
      })
    })
    
    it('manages third-party integrations', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ConfigurationCenter />)
      
      await waitFor(() => {
        const integrations = screen.getByTestId('integrations-list')
        
        // Check integration statuses
        expect(within(integrations).getByText('Stripe')).toHaveClass('status-connected')
        expect(within(integrations).getByText('Segment')).toHaveClass('status-error')
      })
      
      // Fix errored integration
      const segmentIntegration = screen.getByTestId('integration-segment')
      await user.click(within(segmentIntegration).getByRole('button', { name: /configure/i }))
      
      // Update API key
      const configDialog = screen.getByRole('dialog')
      await user.type(within(configDialog).getByLabelText(/api key/i), 'new-segment-api-key')
      await user.click(within(configDialog).getByRole('button', { name: /test connection/i }))
      
      // Verify connection test
      await waitFor(() => {
        expect(within(configDialog).getByText(/connection successful/i)).toBeInTheDocument()
      })
      
      await user.click(within(configDialog).getByRole('button', { name: /save/i }))
    })
  })
  
  describe('Audit and Compliance', () => {
    it('shows audit log of admin actions', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AdminDashboard />)
      
      // Open audit log
      await user.click(screen.getByRole('button', { name: /audit log/i }))
      
      await waitFor(() => {
        const auditEntries = screen.getAllByTestId('audit-entry')
        
        expect(auditEntries[0]).toHaveTextContent(/user suspended: mike.wilson@partners.com/i)
        expect(auditEntries[0]).toHaveTextContent(/admin: system.admin@dce.com/i)
        expect(auditEntries[0]).toHaveTextContent(/3 days ago/i)
        
        expect(auditEntries[1]).toHaveTextContent(/configuration updated: buyer_fee_percentage/i)
        expect(auditEntries[1]).toHaveTextContent(/old value: 4%, new value: 5%/i)
      })
    })
    
    it('generates compliance reports', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AdminDashboard />)
      
      // Open reports section
      await user.click(screen.getByRole('button', { name: /compliance reports/i }))
      
      // Generate monthly report
      const reportDialog = screen.getByRole('dialog')
      await user.selectOptions(within(reportDialog).getByLabelText(/report type/i), 'monthly_compliance')
      await user.selectOptions(within(reportDialog).getByLabelText(/month/i), 'january_2024')
      
      await user.click(within(reportDialog).getByRole('button', { name: /generate report/i }))
      
      // Verify report generation
      await waitFor(() => {
        expect(screen.getByText(/report generated successfully/i)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /download report/i })).toBeInTheDocument()
      })
    })
  })
  
  describe('Emergency Controls', () => {
    it('provides platform-wide emergency controls', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AdminDashboard />)
      
      // Open emergency controls
      await user.click(screen.getByRole('button', { name: /emergency controls/i }))
      
      const emergencyPanel = screen.getByTestId('emergency-panel')
      
      // Check available controls
      expect(within(emergencyPanel).getByRole('button', { name: /pause all trading/i })).toBeInTheDocument()
      expect(within(emergencyPanel).getByRole('button', { name: /disable new registrations/i })).toBeInTheDocument()
      expect(within(emergencyPanel).getByRole('button', { name: /maintenance mode/i })).toBeInTheDocument()
      
      // Activate maintenance mode
      await user.click(within(emergencyPanel).getByRole('button', { name: /maintenance mode/i }))
      
      // Confirm action
      const confirmDialog = screen.getByRole('dialog')
      await user.type(within(confirmDialog).getByLabelText(/confirmation code/i), 'MAINT-2024')
      await user.type(within(confirmDialog).getByLabelText(/estimated duration/i), '2')
      
      await user.click(within(confirmDialog).getByRole('button', { name: /activate maintenance/i }))
      
      // Verify activation
      await waitFor(() => {
        expect(screen.getByText(/maintenance mode activated/i)).toBeInTheDocument()
        expect(screen.getByText(/platform is now in read-only mode/i)).toBeInTheDocument()
      })
    })
  })
})