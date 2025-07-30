import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { rest } from 'msw'
import { setupServer } from 'msw/node'

// Mock components
const RelationshipManager = () => <div>Relationship Manager Component</div>
const PartnershipGraph = () => <div>Partnership Graph Component</div>
const QualityControl = () => <div>Quality Control Component</div>

// MSW server setup
const server = setupServer(
  rest.get('/api/v1/network/relationships', (req, res, ctx) => {
    return res(
      ctx.json({
        relationships: [
          {
            id: 'rel-1',
            buyer: {
              id: 'buyer-1',
              name: 'Insurance Direct LLC',
              type: 'buyer',
              status: 'active',
              quality_requirements: { min_score: 85, min_duration: 120 },
              volume: { daily_avg: 150, monthly_total: 4500 },
              performance: { conversion_rate: 0.42, satisfaction: 0.94 },
            },
            supplier: {
              id: 'supplier-1',
              name: 'Premium Leads Inc',
              type: 'supplier',
              status: 'active',
              quality_metrics: { avg_score: 91, avg_duration: 185 },
              volume: { daily_capacity: 200, utilization: 0.75 },
              performance: { fulfillment_rate: 0.98, quality_consistency: 0.89 },
            },
            status: 'active',
            contract: {
              id: 'contract-1',
              commission_rate: 0.15,
              volume_commitment: 3000,
              quality_sla: { min_score: 85, response_time: 5 },
              start_date: '2024-01-01',
              end_date: '2024-12-31',
            },
            metrics: {
              total_transactions: 2847,
              total_revenue: 128115.00,
              commission_earned: 19217.25,
              quality_score: 89.3,
              dispute_rate: 0.02,
            },
          },
          {
            id: 'rel-2',
            buyer: {
              id: 'buyer-2',
              name: 'HomePro Services',
              type: 'buyer',
              status: 'active',
              quality_requirements: { min_score: 80, min_duration: 90 },
              volume: { daily_avg: 75, monthly_total: 2250 },
              performance: { conversion_rate: 0.38, satisfaction: 0.91 },
            },
            supplier: {
              id: 'supplier-2',
              name: 'Quality Calls LLC',
              type: 'supplier',
              status: 'active',
              quality_metrics: { avg_score: 86, avg_duration: 142 },
              volume: { daily_capacity: 100, utilization: 0.75 },
              performance: { fulfillment_rate: 0.95, quality_consistency: 0.87 },
            },
            status: 'pending_renewal',
            contract: {
              id: 'contract-2',
              commission_rate: 0.12,
              volume_commitment: 2000,
              quality_sla: { min_score: 80, response_time: 10 },
              start_date: '2023-06-01',
              end_date: '2024-05-31',
            },
            metrics: {
              total_transactions: 1523,
              total_revenue: 53305.00,
              commission_earned: 6396.60,
              quality_score: 84.7,
              dispute_rate: 0.03,
            },
          },
        ],
        stats: {
          total_relationships: 15,
          active_relationships: 12,
          pending_approval: 2,
          expired: 1,
          total_commission_mtd: 45832.15,
          avg_quality_score: 87.2,
        },
      })
    )
  }),
  
  rest.post('/api/v1/network/relationships/match', (req, res, ctx) => {
    return res(
      ctx.json({
        matches: [
          {
            buyer_id: 'buyer-3',
            supplier_id: 'supplier-3',
            compatibility_score: 0.92,
            reasons: [
              'Category alignment: Legal services',
              'Quality requirements match: 88% overlap',
              'Geographic coverage: 95% match',
              'Volume capacity: Supplier can fulfill 120% of buyer demand',
            ],
            potential_revenue: 8500.00,
            recommended_commission: 0.14,
          },
          {
            buyer_id: 'buyer-4',
            supplier_id: 'supplier-1',
            compatibility_score: 0.87,
            reasons: [
              'Historical performance: Similar buyers showed 45% conversion',
              'Quality surplus: Supplier exceeds requirements by 15%',
              'Price alignment: Within buyer budget parameters',
            ],
            potential_revenue: 6200.00,
            recommended_commission: 0.13,
          },
        ],
      })
    )
  }),
  
  rest.get('/api/v1/network/quality/monitoring', (req, res, ctx) => {
    return res(
      ctx.json({
        alerts: [
          {
            id: 'alert-1',
            type: 'quality_degradation',
            severity: 'warning',
            relationship_id: 'rel-1',
            message: 'Quality score dropped below SLA threshold',
            details: {
              current_score: 82,
              sla_minimum: 85,
              duration: '2 hours',
              affected_calls: 23,
            },
            created_at: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: 'alert-2',
            type: 'volume_spike',
            severity: 'info',
            relationship_id: 'rel-2',
            message: 'Unusual volume increase detected',
            details: {
              normal_volume: 75,
              current_volume: 142,
              increase_percentage: 89,
            },
            created_at: new Date(Date.now() - 1800000).toISOString(),
          },
        ],
        compliance: {
          relationships_in_compliance: 10,
          relationships_out_of_compliance: 2,
          avg_compliance_score: 91.5,
        },
      })
    )
  }),
  
  rest.post('/api/v1/network/commission/calculate', (req, res, ctx) => {
    const { relationship_id, period } = req.body as { relationship_id: string; period: string }
    
    return res(
      ctx.json({
        calculation: {
          relationship_id,
          period,
          base_commission: 5420.00,
          performance_bonus: 815.00,
          quality_penalty: -125.00,
          total_commission: 6110.00,
          breakdown: {
            total_transactions: 342,
            qualifying_transactions: 325,
            commission_rate: 0.15,
            bonus_multiplier: 1.15,
            penalty_deductions: [
              { reason: 'Quality SLA breach', amount: 125.00, incidents: 3 },
            ],
          },
        },
      })
    )
  }),
  
  rest.post('/api/v1/network/disputes/create', (req, res, ctx) => {
    return res(
      ctx.json({
        dispute: {
          id: 'dispute-1',
          ...req.body,
          status: 'open',
          created_at: new Date().toISOString(),
        },
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
      auth: (state = { user: { role: 'network' } }) => state,
      relationships: (state = {}) => state,
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

describe('Network Relationship Management Integration', () => {
  describe('Relationship Overview', () => {
    it('displays all active relationships with metrics', async () => {
      renderWithProviders(<RelationshipManager />)
      
      // Wait for relationships to load
      await waitFor(() => {
        expect(screen.getByText('Insurance Direct LLC')).toBeInTheDocument()
        expect(screen.getByText('Premium Leads Inc')).toBeInTheDocument()
        expect(screen.getByText('HomePro Services')).toBeInTheDocument()
        expect(screen.getByText('Quality Calls LLC')).toBeInTheDocument()
      })
      
      // Check metrics display
      expect(screen.getByText(/total commission mtd: \$45,832/i)).toBeInTheDocument()
      expect(screen.getByText(/active relationships: 12/i)).toBeInTheDocument()
      expect(screen.getByText(/avg quality: 87.2/i)).toBeInTheDocument()
    })
    
    it('shows relationship status indicators', async () => {
      renderWithProviders(<RelationshipManager />)
      
      await waitFor(() => {
        const relationships = screen.getAllByTestId('relationship-card')
        
        // First relationship is active
        expect(within(relationships[0]).getByText(/active/i)).toHaveClass('status-active')
        
        // Second relationship pending renewal
        expect(within(relationships[1]).getByText(/pending renewal/i)).toHaveClass('status-warning')
      })
    })
    
    it('displays contract details and terms', async () => {
      const user = userEvent.setup()
      renderWithProviders(<RelationshipManager />)
      
      await waitFor(() => {
        expect(screen.getByText('Insurance Direct LLC')).toBeInTheDocument()
      })
      
      // Expand contract details
      const firstRelationship = screen.getAllByTestId('relationship-card')[0]
      await user.click(within(firstRelationship).getByRole('button', { name: /view contract/i }))
      
      // Check contract information
      const contractModal = screen.getByRole('dialog')
      expect(within(contractModal).getByText(/commission rate: 15%/i)).toBeInTheDocument()
      expect(within(contractModal).getByText(/volume commitment: 3,000/i)).toBeInTheDocument()
      expect(within(contractModal).getByText(/min quality score: 85/i)).toBeInTheDocument()
      expect(within(contractModal).getByText(/contract ends: dec 31, 2024/i)).toBeInTheDocument()
    })
  })
  
  describe('Partnership Matching', () => {
    it('suggests compatible buyer-supplier matches', async () => {
      const user = userEvent.setup()
      renderWithProviders(<RelationshipManager />)
      
      // Open matching engine
      await user.click(screen.getByRole('button', { name: /find new partnerships/i }))
      
      // Wait for matches
      await waitFor(() => {
        const matches = screen.getAllByTestId('match-suggestion')
        expect(matches).toHaveLength(2)
        
        // Check first match
        const firstMatch = matches[0]
        expect(within(firstMatch).getByText(/compatibility: 92%/i)).toBeInTheDocument()
        expect(within(firstMatch).getByText(/potential revenue: \$8,500/i)).toBeInTheDocument()
        expect(within(firstMatch).getByText(/category alignment: legal services/i)).toBeInTheDocument()
      })
    })
    
    it('filters matches by criteria', async () => {
      const user = userEvent.setup()
      renderWithProviders(<RelationshipManager />)
      
      await user.click(screen.getByRole('button', { name: /find new partnerships/i }))
      
      // Apply filters
      await user.selectOptions(screen.getByLabelText(/category/i), 'insurance')
      await user.type(screen.getByLabelText(/min compatibility/i), '90')
      await user.click(screen.getByRole('button', { name: /apply filters/i }))
      
      // Verify filtered results
      await waitFor(() => {
        const matches = screen.getAllByTestId('match-suggestion')
        matches.forEach(match => {
          const score = within(match).getByText(/compatibility: \d+%/i)
          const value = parseInt(score.textContent?.match(/\d+/)?.[0] || '0')
          expect(value).toBeGreaterThanOrEqual(90)
        })
      })
    })
    
    it('initiates partnership approval workflow', async () => {
      const user = userEvent.setup()
      renderWithProviders(<RelationshipManager />)
      
      await user.click(screen.getByRole('button', { name: /find new partnerships/i }))
      
      await waitFor(() => {
        expect(screen.getAllByTestId('match-suggestion')).toHaveLength(2)
      })
      
      // Initiate partnership
      const firstMatch = screen.getAllByTestId('match-suggestion')[0]
      await user.click(within(firstMatch).getByRole('button', { name: /initiate partnership/i }))
      
      // Fill approval form
      const approvalDialog = screen.getByRole('dialog')
      await user.type(within(approvalDialog).getByLabelText(/proposed commission/i), '14')
      await user.type(within(approvalDialog).getByLabelText(/volume commitment/i), '2500')
      await user.type(within(approvalDialog).getByLabelText(/contract duration/i), '12')
      
      await user.click(within(approvalDialog).getByRole('button', { name: /send proposal/i }))
      
      // Verify success
      await waitFor(() => {
        expect(screen.getByText(/partnership proposal sent/i)).toBeInTheDocument()
      })
    })
  })
  
  describe('Quality Monitoring', () => {
    it('displays quality alerts and compliance status', async () => {
      renderWithProviders(<QualityControl />)
      
      // Wait for quality data
      await waitFor(() => {
        expect(screen.getByText(/quality score dropped below sla/i)).toBeInTheDocument()
        expect(screen.getByText(/current score: 82/i)).toBeInTheDocument()
        expect(screen.getByText(/sla minimum: 85/i)).toBeInTheDocument()
      })
      
      // Check compliance overview
      expect(screen.getByText(/in compliance: 10/i)).toBeInTheDocument()
      expect(screen.getByText(/out of compliance: 2/i)).toBeInTheDocument()
      expect(screen.getByText(/avg compliance: 91.5%/i)).toBeInTheDocument()
    })
    
    it('handles quality dispute creation', async () => {
      const user = userEvent.setup()
      renderWithProviders(<QualityControl />)
      
      await waitFor(() => {
        expect(screen.getByText(/quality score dropped below sla/i)).toBeInTheDocument()
      })
      
      // Open dispute for quality alert
      const alert = screen.getAllByTestId('quality-alert')[0]
      await user.click(within(alert).getByRole('button', { name: /dispute/i }))
      
      // Fill dispute form
      const disputeDialog = screen.getByRole('dialog')
      await user.selectOptions(within(disputeDialog).getByLabelText(/dispute type/i), 'quality_measurement')
      await user.type(
        within(disputeDialog).getByLabelText(/description/i),
        'Call quality was affected by technical issues on buyer side'
      )
      await user.upload(
        within(disputeDialog).getByLabelText(/evidence/i),
        new File(['evidence'], 'call-logs.pdf', { type: 'application/pdf' })
      )
      
      await user.click(within(disputeDialog).getByRole('button', { name: /submit dispute/i }))
      
      // Verify submission
      await waitFor(() => {
        expect(screen.getByText(/dispute submitted successfully/i)).toBeInTheDocument()
      })
    })
    
    it('shows real-time quality metrics updates', async () => {
      renderWithProviders(<QualityControl />)
      
      await waitFor(() => {
        expect(screen.getByTestId('quality-dashboard')).toBeInTheDocument()
      })
      
      // Initial quality score
      const qualityScore = screen.getByTestId('rel-1-quality')
      expect(qualityScore).toHaveTextContent('89.3')
      
      // Simulate WebSocket quality update
      const wsMessage = {
        type: 'quality_update',
        data: {
          relationship_id: 'rel-1',
          new_quality_score: 91.2,
          trend: 'improving',
        },
      }
      
      window.dispatchEvent(new CustomEvent('ws-message', { detail: wsMessage }))
      
      // Verify update
      await waitFor(() => {
        expect(qualityScore).toHaveTextContent('91.2')
        expect(qualityScore).toHaveClass('trend-up')
      })
    })
  })
  
  describe('Commission Management', () => {
    it('calculates commission with bonuses and penalties', async () => {
      const user = userEvent.setup()
      renderWithProviders(<RelationshipManager />)
      
      await waitFor(() => {
        expect(screen.getByText('Insurance Direct LLC')).toBeInTheDocument()
      })
      
      // Open commission calculator
      const firstRelationship = screen.getAllByTestId('relationship-card')[0]
      await user.click(within(firstRelationship).getByRole('button', { name: /calculate commission/i }))
      
      // Set calculation period
      const calculator = screen.getByRole('dialog')
      await user.selectOptions(within(calculator).getByLabelText(/period/i), 'current_month')
      await user.click(within(calculator).getByRole('button', { name: /calculate/i }))
      
      // View calculation breakdown
      await waitFor(() => {
        expect(within(calculator).getByText(/base commission: \$5,420/i)).toBeInTheDocument()
        expect(within(calculator).getByText(/performance bonus: \$815/i)).toBeInTheDocument()
        expect(within(calculator).getByText(/quality penalty: -\$125/i)).toBeInTheDocument()
        expect(within(calculator).getByText(/total commission: \$6,110/i)).toBeInTheDocument()
      })
    })
    
    it('schedules and tracks payouts', async () => {
      const user = userEvent.setup()
      renderWithProviders(<RelationshipManager />)
      
      // Access payout scheduler
      await user.click(screen.getByRole('button', { name: /payout schedule/i }))
      
      await waitFor(() => {
        const schedule = screen.getByTestId('payout-schedule')
        expect(within(schedule).getByText(/next payout: may 1, 2024/i)).toBeInTheDocument()
        expect(within(schedule).getByText(/pending amount: \$45,832/i)).toBeInTheDocument()
      })
      
      // View payout history
      await user.click(screen.getByRole('tab', { name: /history/i }))
      
      expect(screen.getByText(/april 1: \$42,156/i)).toBeInTheDocument()
      expect(screen.getByText(/march 1: \$38,923/i)).toBeInTheDocument()
    })
  })
  
  describe('Relationship Visualization', () => {
    it('displays interactive network graph', async () => {
      const user = userEvent.setup()
      renderWithProviders(<PartnershipGraph />)
      
      await waitFor(() => {
        expect(screen.getByTestId('network-graph')).toBeInTheDocument()
      })
      
      // Interact with nodes
      const buyerNode = screen.getByTestId('node-buyer-1')
      await user.hover(buyerNode)
      
      // Check tooltip information
      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip')
        expect(within(tooltip).getByText('Insurance Direct LLC')).toBeInTheDocument()
        expect(within(tooltip).getByText(/volume: 150 calls\/day/i)).toBeInTheDocument()
        expect(within(tooltip).getByText(/conversion: 42%/i)).toBeInTheDocument()
      })
    })
    
    it('filters graph by relationship status', async () => {
      const user = userEvent.setup()
      renderWithProviders(<PartnershipGraph />)
      
      // Apply filter
      await user.click(screen.getByRole('button', { name: /filter/i }))
      await user.click(screen.getByLabelText(/show only active/i))
      
      // Verify filtered graph
      await waitFor(() => {
        const nodes = screen.getAllByTestId(/^node-/)
        const activeNodes = nodes.filter(node => node.classList.contains('status-active'))
        expect(activeNodes.length).toBe(nodes.length)
      })
    })
  })
  
  describe('Performance Analytics', () => {
    it('shows relationship performance trends', async () => {
      const user = userEvent.setup()
      renderWithProviders(<RelationshipManager />)
      
      await waitFor(() => {
        expect(screen.getByText('Insurance Direct LLC')).toBeInTheDocument()
      })
      
      // View analytics
      const firstRelationship = screen.getAllByTestId('relationship-card')[0]
      await user.click(within(firstRelationship).getByRole('button', { name: /view analytics/i }))
      
      // Check analytics display
      const analyticsModal = screen.getByRole('dialog')
      expect(within(analyticsModal).getByTestId('revenue-chart')).toBeInTheDocument()
      expect(within(analyticsModal).getByTestId('quality-trend')).toBeInTheDocument()
      expect(within(analyticsModal).getByTestId('volume-analysis')).toBeInTheDocument()
      
      // Verify metrics
      expect(within(analyticsModal).getByText(/total revenue: \$128,115/i)).toBeInTheDocument()
      expect(within(analyticsModal).getByText(/avg transaction: \$45/i)).toBeInTheDocument()
      expect(within(analyticsModal).getByText(/growth rate: \+12%/i)).toBeInTheDocument()
    })
  })
})