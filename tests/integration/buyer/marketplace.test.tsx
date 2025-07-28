import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { rest } from 'msw'
import { setupServer } from 'msw/node'

// Mock components - would import actual components in real implementation
const Marketplace = () => <div>Marketplace Component</div>
const MarketplaceSearch = () => <div>Search Component</div>
const CallListings = () => <div>Call Listings Component</div>

// MSW server setup
const server = setupServer(
  rest.get('/api/v1/marketplace/search', (req, res, ctx) => {
    const filters = Object.fromEntries(req.url.searchParams)
    
    return res(
      ctx.json({
        calls: [
          {
            id: 'call-1',
            tracking_number: '+18001234567',
            quality_score: 95,
            price: 45.00,
            duration_avg: 180,
            supplier: { name: 'Premium Leads Inc' },
            category: 'insurance',
            geo_location: 'California',
            available: true,
          },
          {
            id: 'call-2',
            tracking_number: '+18007654321',
            quality_score: 88,
            price: 35.00,
            duration_avg: 240,
            supplier: { name: 'Quality Calls LLC' },
            category: 'home_services',
            geo_location: 'Texas',
            available: true,
          },
        ],
        pagination: {
          total: 150,
          page: 1,
          per_page: 20,
          total_pages: 8,
        },
        aggregations: {
          categories: [
            { name: 'insurance', count: 45 },
            { name: 'home_services', count: 38 },
            { name: 'legal', count: 28 },
            { name: 'financial', count: 39 },
          ],
          price_ranges: [
            { range: '0-25', count: 42 },
            { range: '25-50', count: 68 },
            { range: '50-100', count: 35 },
            { range: '100+', count: 5 },
          ],
          quality_scores: [
            { range: '90-100', count: 45 },
            { range: '80-89', count: 62 },
            { range: '70-79', count: 38 },
            { range: '0-69', count: 5 },
          ],
        },
      })
    )
  }),
  
  rest.post('/api/v1/purchases/create', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        transaction: {
          id: 'trans-123',
          call_id: req.body.call_id,
          amount: req.body.amount,
          status: 'completed',
          created_at: new Date().toISOString(),
        },
      })
    )
  }),
  
  rest.get('/api/v1/buyer/saved-searches', (req, res, ctx) => {
    return res(
      ctx.json({
        searches: [
          {
            id: 'search-1',
            name: 'High Quality Insurance Leads',
            filters: {
              category: 'insurance',
              quality_score_min: 90,
              price_max: 50,
            },
            alerts_enabled: true,
          },
          {
            id: 'search-2',
            name: 'Budget Home Services',
            filters: {
              category: 'home_services',
              price_max: 30,
            },
            alerts_enabled: false,
          },
        ],
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
      auth: (state = { user: { role: 'buyer' } }) => state,
      marketplace: (state = {}) => state,
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

describe('Buyer Marketplace Integration', () => {
  describe('Marketplace Search', () => {
    it('displays search filters and results', async () => {
      renderWithProviders(<Marketplace />)
      
      // Search filters should be visible
      expect(screen.getByLabelText(/category/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/price range/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/quality score/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/location/i)).toBeInTheDocument()
      
      // Wait for initial results to load
      await waitFor(() => {
        expect(screen.getByText('Premium Leads Inc')).toBeInTheDocument()
        expect(screen.getByText('Quality Calls LLC')).toBeInTheDocument()
      })
    })
    
    it('filters calls by category', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Marketplace />)
      
      // Select insurance category
      const categoryFilter = screen.getByLabelText(/category/i)
      await user.selectOptions(categoryFilter, 'insurance')
      
      // Apply filters
      await user.click(screen.getByRole('button', { name: /apply filters/i }))
      
      // Verify API was called with correct filters
      await waitFor(() => {
        const calls = screen.getAllByTestId('call-listing')
        expect(calls.length).toBeGreaterThan(0)
      })
    })
    
    it('filters by price range', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Marketplace />)
      
      // Set price range
      const minPrice = screen.getByLabelText(/min price/i)
      const maxPrice = screen.getByLabelText(/max price/i)
      
      await user.clear(minPrice)
      await user.type(minPrice, '25')
      await user.clear(maxPrice)
      await user.type(maxPrice, '50')
      
      await user.click(screen.getByRole('button', { name: /apply filters/i }))
      
      // Verify filtered results
      await waitFor(() => {
        const prices = screen.getAllByTestId('call-price')
        prices.forEach(price => {
          const value = parseFloat(price.textContent?.replace('$', '') || '0')
          expect(value).toBeGreaterThanOrEqual(25)
          expect(value).toBeLessThanOrEqual(50)
        })
      })
    })
    
    it('filters by quality score', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Marketplace />)
      
      // Set minimum quality score
      const qualitySlider = screen.getByRole('slider', { name: /quality score/i })
      await user.click(qualitySlider)
      await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}') // Increase to 90+
      
      await user.click(screen.getByRole('button', { name: /apply filters/i }))
      
      // Verify high quality results only
      await waitFor(() => {
        const scores = screen.getAllByTestId('quality-score')
        scores.forEach(score => {
          const value = parseInt(score.textContent || '0')
          expect(value).toBeGreaterThanOrEqual(90)
        })
      })
    })
    
    it('supports multi-select location filtering', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Marketplace />)
      
      // Open location dropdown
      await user.click(screen.getByLabelText(/location/i))
      
      // Select multiple locations
      const dropdown = screen.getByRole('listbox')
      await user.click(within(dropdown).getByText('California'))
      await user.click(within(dropdown).getByText('Texas'))
      await user.click(within(dropdown).getByText('New York'))
      
      await user.click(screen.getByRole('button', { name: /apply filters/i }))
      
      // Verify location tags appear
      expect(screen.getByText('California')).toHaveClass('tag')
      expect(screen.getByText('Texas')).toHaveClass('tag')
    })
  })
  
  describe('Saved Searches', () => {
    it('loads and displays saved searches', async () => {
      renderWithProviders(<Marketplace />)
      
      // Open saved searches panel
      await userEvent.click(screen.getByRole('button', { name: /saved searches/i }))
      
      await waitFor(() => {
        expect(screen.getByText('High Quality Insurance Leads')).toBeInTheDocument()
        expect(screen.getByText('Budget Home Services')).toBeInTheDocument()
      })
    })
    
    it('applies saved search filters', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Marketplace />)
      
      // Open saved searches
      await user.click(screen.getByRole('button', { name: /saved searches/i }))
      
      // Click on a saved search
      await user.click(screen.getByText('High Quality Insurance Leads'))
      
      // Verify filters are applied
      await waitFor(() => {
        expect(screen.getByLabelText(/category/i)).toHaveValue('insurance')
        expect(screen.getByRole('slider', { name: /quality score/i })).toHaveValue('90')
        expect(screen.getByLabelText(/max price/i)).toHaveValue('50')
      })
    })
    
    it('creates new saved search', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Marketplace />)
      
      // Set up filters
      await user.selectOptions(screen.getByLabelText(/category/i), 'legal')
      await user.type(screen.getByLabelText(/max price/i), '75')
      
      // Save search
      await user.click(screen.getByRole('button', { name: /save search/i }))
      
      // Fill save dialog
      const dialog = screen.getByRole('dialog')
      await user.type(within(dialog).getByLabelText(/search name/i), 'Legal Leads Under $75')
      await user.click(within(dialog).getByLabelText(/enable alerts/i))
      
      await user.click(within(dialog).getByRole('button', { name: /save/i }))
      
      // Verify success
      await waitFor(() => {
        expect(screen.getByText('Search saved successfully')).toBeInTheDocument()
      })
    })
  })
  
  describe('Call Details and Purchase', () => {
    it('displays detailed call information', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Marketplace />)
      
      // Wait for listings
      await waitFor(() => {
        expect(screen.getByText('Premium Leads Inc')).toBeInTheDocument()
      })
      
      // Click on a call listing
      const firstCall = screen.getAllByTestId('call-listing')[0]
      await user.click(within(firstCall).getByRole('button', { name: /view details/i }))
      
      // Verify detail modal
      const modal = screen.getByRole('dialog')
      expect(within(modal).getByText(/call details/i)).toBeInTheDocument()
      expect(within(modal).getByText(/quality score: 95/i)).toBeInTheDocument()
      expect(within(modal).getByText(/average duration: 3 minutes/i)).toBeInTheDocument()
      expect(within(modal).getByText(/supplier: premium leads inc/i)).toBeInTheDocument()
    })
    
    it('completes purchase flow', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Marketplace />)
      
      // Open call details
      await waitFor(() => screen.getByText('Premium Leads Inc'))
      const firstCall = screen.getAllByTestId('call-listing')[0]
      await user.click(within(firstCall).getByRole('button', { name: /buy now/i }))
      
      // Confirm purchase dialog
      const confirmDialog = screen.getByRole('dialog')
      expect(within(confirmDialog).getByText(/confirm purchase/i)).toBeInTheDocument()
      expect(within(confirmDialog).getByText(/\$45\.00/)).toBeInTheDocument()
      
      // Complete purchase
      await user.click(within(confirmDialog).getByRole('button', { name: /confirm/i }))
      
      // Verify success
      await waitFor(() => {
        expect(screen.getByText(/purchase successful/i)).toBeInTheDocument()
        expect(screen.getByText(/transaction id: trans-123/i)).toBeInTheDocument()
      })
    })
    
    it('handles purchase errors gracefully', async () => {
      const user = userEvent.setup()
      
      // Mock purchase failure
      server.use(
        rest.post('/api/v1/purchases/create', (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({ error: 'Insufficient balance' })
          )
        })
      )
      
      renderWithProviders(<Marketplace />)
      
      // Attempt purchase
      await waitFor(() => screen.getByText('Premium Leads Inc'))
      await user.click(screen.getAllByRole('button', { name: /buy now/i })[0])
      await user.click(screen.getByRole('button', { name: /confirm/i }))
      
      // Verify error handling
      await waitFor(() => {
        expect(screen.getByText(/insufficient balance/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /add funds/i })).toBeInTheDocument()
      })
    })
  })
  
  describe('Real-time Updates', () => {
    it('updates listings when new calls become available', async () => {
      renderWithProviders(<Marketplace />)
      
      // Initial load
      await waitFor(() => {
        expect(screen.getAllByTestId('call-listing')).toHaveLength(2)
      })
      
      // Simulate WebSocket message for new call
      const wsMessage = {
        type: 'new_call',
        data: {
          id: 'call-3',
          tracking_number: '+18009999999',
          quality_score: 92,
          price: 55.00,
          supplier: { name: 'Fresh Leads Co' },
        },
      }
      
      // Trigger WebSocket update
      window.dispatchEvent(new CustomEvent('ws-message', { detail: wsMessage }))
      
      // Verify new call appears
      await waitFor(() => {
        expect(screen.getByText('Fresh Leads Co')).toBeInTheDocument()
        expect(screen.getAllByTestId('call-listing')).toHaveLength(3)
      })
    })
    
    it('removes calls when they become unavailable', async () => {
      renderWithProviders(<Marketplace />)
      
      await waitFor(() => {
        expect(screen.getByText('Premium Leads Inc')).toBeInTheDocument()
      })
      
      // Simulate call becoming unavailable
      const wsMessage = {
        type: 'call_unavailable',
        data: { id: 'call-1' },
      }
      
      window.dispatchEvent(new CustomEvent('ws-message', { detail: wsMessage }))
      
      // Verify call is removed or marked unavailable
      await waitFor(() => {
        const call = screen.queryByText('Premium Leads Inc')
        expect(call?.closest('[data-testid="call-listing"]')).toHaveClass('unavailable')
      })
    })
  })
  
  describe('Performance and Pagination', () => {
    it('implements infinite scroll for large result sets', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Marketplace />)
      
      // Initial load
      await waitFor(() => {
        expect(screen.getAllByTestId('call-listing')).toHaveLength(2)
      })
      
      // Scroll to bottom
      const container = screen.getByTestId('listings-container')
      fireEvent.scroll(container, { target: { scrollTop: container.scrollHeight } })
      
      // Verify loading indicator
      expect(screen.getByText(/loading more/i)).toBeInTheDocument()
      
      // Verify more results load
      await waitFor(() => {
        expect(screen.getAllByTestId('call-listing').length).toBeGreaterThan(2)
      })
    })
    
    it('shows empty state when no results match filters', async () => {
      const user = userEvent.setup()
      
      // Mock empty response
      server.use(
        rest.get('/api/v1/marketplace/search', (req, res, ctx) => {
          return res(ctx.json({ calls: [], pagination: { total: 0 } }))
        })
      )
      
      renderWithProviders(<Marketplace />)
      
      // Apply restrictive filters
      await user.type(screen.getByLabelText(/min price/i), '1000')
      await user.click(screen.getByRole('button', { name: /apply filters/i }))
      
      // Verify empty state
      await waitFor(() => {
        expect(screen.getByText(/no calls match your criteria/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /adjust filters/i })).toBeInTheDocument()
      })
    })
  })
})