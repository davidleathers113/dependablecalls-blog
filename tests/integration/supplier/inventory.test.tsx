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
const InventoryManagement = () => <div>Inventory Management Component</div>
const CallListingForm = () => <div>Call Listing Form Component</div>
const BulkUploader = () => <div>Bulk Uploader Component</div>

// MSW server setup
const server = setupServer(
  rest.get('/api/v1/supplier/inventory', (req, res, ctx) => {
    return res(
      ctx.json({
        calls: [
          {
            id: 'inv-1',
            tracking_number: '+18005551234',
            category: 'insurance',
            quality_score: 92,
            price: 45.00,
            status: 'active',
            total_calls: 150,
            sold_calls: 87,
            revenue: 3915.00,
            created_at: '2024-01-10T10:00:00Z',
          },
          {
            id: 'inv-2',
            tracking_number: '+18005555678',
            category: 'home_services',
            quality_score: 88,
            price: 35.00,
            status: 'active',
            total_calls: 200,
            sold_calls: 142,
            revenue: 4970.00,
            created_at: '2024-01-08T10:00:00Z',
          },
          {
            id: 'inv-3',
            tracking_number: '+18005559999',
            category: 'legal',
            quality_score: 78,
            price: 55.00,
            status: 'paused',
            total_calls: 75,
            sold_calls: 45,
            revenue: 2475.00,
            created_at: '2024-01-05T10:00:00Z',
          },
        ],
        stats: {
          total_inventory: 425,
          active_listings: 350,
          total_revenue: 11360.00,
          avg_quality_score: 86,
        },
      })
    )
  }),
  
  rest.post('/api/v1/supplier/inventory/create', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        call: {
          id: 'inv-new',
          ...req.body,
          created_at: new Date().toISOString(),
        },
      })
    )
  }),
  
  rest.put('/api/v1/supplier/inventory/:id', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        call: {
          id: req.params.id,
          ...req.body,
          updated_at: new Date().toISOString(),
        },
      })
    )
  }),
  
  rest.post('/api/v1/supplier/inventory/bulk-upload', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        processed: 100,
        successful: 95,
        failed: 5,
        errors: [
          { row: 23, error: 'Invalid phone number format' },
          { row: 45, error: 'Duplicate tracking number' },
          { row: 67, error: 'Category not recognized' },
          { row: 78, error: 'Price below minimum' },
          { row: 92, error: 'Missing required field: destination_number' },
        ],
      })
    )
  }),
  
  rest.get('/api/v1/supplier/analytics/pricing', (req, res, ctx) => {
    return res(
      ctx.json({
        recommendations: [
          {
            category: 'insurance',
            current_price: 45.00,
            recommended_price: 48.50,
            market_avg: 47.25,
            demand_level: 'high',
            competition: 'medium',
          },
          {
            category: 'home_services',
            current_price: 35.00,
            recommended_price: 32.00,
            market_avg: 33.50,
            demand_level: 'medium',
            competition: 'high',
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
      auth: (state = { user: { role: 'supplier' } }) => state,
      inventory: (state = {}) => state,
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

describe('Supplier Inventory Management Integration', () => {
  describe('Inventory Overview', () => {
    it('displays inventory statistics and listings', async () => {
      renderWithProviders(<InventoryManagement />)
      
      // Wait for stats to load
      await waitFor(() => {
        expect(screen.getByText(/total inventory: 425/i)).toBeInTheDocument()
        expect(screen.getByText(/active listings: 350/i)).toBeInTheDocument()
        expect(screen.getByText(/total revenue: \$11,360/i)).toBeInTheDocument()
        expect(screen.getByText(/avg quality: 86/i)).toBeInTheDocument()
      })
      
      // Verify inventory items
      expect(screen.getByText('+18005551234')).toBeInTheDocument()
      expect(screen.getByText('+18005555678')).toBeInTheDocument()
      expect(screen.getByText('+18005559999')).toBeInTheDocument()
    })
    
    it('filters inventory by status', async () => {
      const user = userEvent.setup()
      renderWithProviders(<InventoryManagement />)
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.getAllByTestId('inventory-item')).toHaveLength(3)
      })
      
      // Filter by active status
      await user.click(screen.getByRole('button', { name: /status filter/i }))
      await user.click(screen.getByRole('option', { name: /active only/i }))
      
      // Verify filtered results
      await waitFor(() => {
        const items = screen.getAllByTestId('inventory-item')
        expect(items).toHaveLength(2)
        items.forEach(item => {
          expect(within(item).getByText(/active/i)).toBeInTheDocument()
        })
      })
    })
    
    it('sorts inventory by different criteria', async () => {
      const user = userEvent.setup()
      renderWithProviders(<InventoryManagement />)
      
      // Sort by revenue
      await user.click(screen.getByRole('button', { name: /sort by/i }))
      await user.click(screen.getByRole('option', { name: /revenue/i }))
      
      // Verify order
      await waitFor(() => {
        const revenues = screen.getAllByTestId('item-revenue')
        const values = revenues.map(r => parseFloat(r.textContent?.replace(/[$,]/g, '') || '0'))
        expect(values).toEqual([...values].sort((a, b) => b - a))
      })
    })
  })
  
  describe('Creating New Listings', () => {
    it('creates single call listing', async () => {
      const user = userEvent.setup()
      renderWithProviders(<InventoryManagement />)
      
      // Open create form
      await user.click(screen.getByRole('button', { name: /create listing/i }))
      
      // Fill form
      const form = screen.getByRole('form')
      await user.type(within(form).getByLabelText(/tracking number/i), '+18001112222')
      await user.selectOptions(within(form).getByLabelText(/category/i), 'insurance')
      await user.type(within(form).getByLabelText(/destination number/i), '+18883334444')
      await user.type(within(form).getByLabelText(/price/i), '50')
      await user.type(within(form).getByLabelText(/description/i), 'Premium insurance leads from California')
      
      // Add tags
      await user.type(within(form).getByLabelText(/tags/i), 'california{Enter}high-intent{Enter}')
      
      // Submit
      await user.click(within(form).getByRole('button', { name: /create/i }))
      
      // Verify success
      await waitFor(() => {
        expect(screen.getByText(/listing created successfully/i)).toBeInTheDocument()
        expect(screen.getByText('+18001112222')).toBeInTheDocument()
      })
    })
    
    it('validates form inputs', async () => {
      const user = userEvent.setup()
      renderWithProviders(<InventoryManagement />)
      
      await user.click(screen.getByRole('button', { name: /create listing/i }))
      
      const form = screen.getByRole('form')
      
      // Try to submit empty form
      await user.click(within(form).getByRole('button', { name: /create/i }))
      
      // Check validation errors
      expect(within(form).getByText(/tracking number is required/i)).toBeInTheDocument()
      expect(within(form).getByText(/category is required/i)).toBeInTheDocument()
      expect(within(form).getByText(/price is required/i)).toBeInTheDocument()
      
      // Invalid phone format
      await user.type(within(form).getByLabelText(/tracking number/i), '123')
      await user.tab()
      expect(within(form).getByText(/invalid phone number format/i)).toBeInTheDocument()
      
      // Price too low
      await user.type(within(form).getByLabelText(/price/i), '0.50')
      await user.tab()
      expect(within(form).getByText(/minimum price is \$1/i)).toBeInTheDocument()
    })
  })
  
  describe('Bulk Upload', () => {
    it('handles CSV file upload', async () => {
      const user = userEvent.setup()
      renderWithProviders(<InventoryManagement />)
      
      // Open bulk upload
      await user.click(screen.getByRole('button', { name: /bulk upload/i }))
      
      // Create mock CSV file
      const csvContent = `tracking_number,category,destination_number,price,description
+18001234567,insurance,+18887654321,45,Insurance leads
+18002345678,home_services,+18886543210,35,Home services leads`
      
      const file = new File([csvContent], 'inventory.csv', { type: 'text/csv' })
      
      // Upload file
      const input = screen.getByLabelText(/upload csv/i)
      await user.upload(input, file)
      
      // Preview should show
      await waitFor(() => {
        expect(screen.getByText(/preview: 2 rows/i)).toBeInTheDocument()
        expect(screen.getByText('+18001234567')).toBeInTheDocument()
        expect(screen.getByText('+18002345678')).toBeInTheDocument()
      })
      
      // Process upload
      await user.click(screen.getByRole('button', { name: /process upload/i }))
      
      // Show results
      await waitFor(() => {
        expect(screen.getByText(/upload complete/i)).toBeInTheDocument()
        expect(screen.getByText(/processed: 100/i)).toBeInTheDocument()
        expect(screen.getByText(/successful: 95/i)).toBeInTheDocument()
        expect(screen.getByText(/failed: 5/i)).toBeInTheDocument()
      })
    })
    
    it('displays upload errors with row details', async () => {
      const user = userEvent.setup()
      renderWithProviders(<InventoryManagement />)
      
      // Trigger bulk upload with errors
      await user.click(screen.getByRole('button', { name: /bulk upload/i }))
      
      const file = new File(['test'], 'inventory.csv', { type: 'text/csv' })
      await user.upload(screen.getByLabelText(/upload csv/i), file)
      await user.click(screen.getByRole('button', { name: /process upload/i }))
      
      // Check error display
      await waitFor(() => {
        expect(screen.getByText(/5 errors found/i)).toBeInTheDocument()
        expect(screen.getByText(/row 23: invalid phone number format/i)).toBeInTheDocument()
        expect(screen.getByText(/row 45: duplicate tracking number/i)).toBeInTheDocument()
      })
      
      // Download error report
      await user.click(screen.getByRole('button', { name: /download error report/i }))
      // Verify download initiated
    })
  })
  
  describe('Editing Listings', () => {
    it('edits existing listing details', async () => {
      const user = userEvent.setup()
      renderWithProviders(<InventoryManagement />)
      
      // Wait for listings
      await waitFor(() => {
        expect(screen.getByText('+18005551234')).toBeInTheDocument()
      })
      
      // Edit first listing
      const firstItem = screen.getAllByTestId('inventory-item')[0]
      await user.click(within(firstItem).getByRole('button', { name: /edit/i }))
      
      // Modify price
      const editForm = screen.getByRole('form')
      const priceInput = within(editForm).getByLabelText(/price/i)
      await user.clear(priceInput)
      await user.type(priceInput, '52.50')
      
      // Save changes
      await user.click(within(editForm).getByRole('button', { name: /save/i }))
      
      // Verify update
      await waitFor(() => {
        expect(screen.getByText(/listing updated/i)).toBeInTheDocument()
        expect(within(firstItem).getByText('$52.50')).toBeInTheDocument()
      })
    })
    
    it('pauses and resumes listings', async () => {
      const user = userEvent.setup()
      renderWithProviders(<InventoryManagement />)
      
      await waitFor(() => {
        expect(screen.getAllByTestId('inventory-item')).toHaveLength(3)
      })
      
      // Pause active listing
      const activeItem = screen.getAllByTestId('inventory-item')[0]
      await user.click(within(activeItem).getByRole('button', { name: /pause/i }))
      
      // Confirm action
      await user.click(screen.getByRole('button', { name: /confirm pause/i }))
      
      // Verify status change
      await waitFor(() => {
        expect(within(activeItem).getByText(/paused/i)).toBeInTheDocument()
        expect(within(activeItem).getByRole('button', { name: /resume/i })).toBeInTheDocument()
      })
    })
  })
  
  describe('Pricing Strategy', () => {
    it('shows pricing recommendations', async () => {
      const user = userEvent.setup()
      renderWithProviders(<InventoryManagement />)
      
      // Open pricing insights
      await user.click(screen.getByRole('button', { name: /pricing insights/i }))
      
      // Wait for recommendations
      await waitFor(() => {
        expect(screen.getByText(/insurance: recommended \$48.50/i)).toBeInTheDocument()
        expect(screen.getByText(/market average: \$47.25/i)).toBeInTheDocument()
        expect(screen.getByText(/demand: high/i)).toBeInTheDocument()
      })
    })
    
    it('applies dynamic pricing', async () => {
      const user = userEvent.setup()
      renderWithProviders(<InventoryManagement />)
      
      // Enable dynamic pricing
      await user.click(screen.getByRole('button', { name: /pricing strategy/i }))
      await user.click(screen.getByLabelText(/enable dynamic pricing/i))
      
      // Configure rules
      await user.type(screen.getByLabelText(/increase when quality > /i), '90')
      await user.type(screen.getByLabelText(/price increase %/i), '10')
      
      await user.click(screen.getByRole('button', { name: /apply strategy/i }))
      
      // Verify confirmation
      await waitFor(() => {
        expect(screen.getByText(/pricing strategy applied/i)).toBeInTheDocument()
        expect(screen.getByText(/2 listings updated/i)).toBeInTheDocument()
      })
    })
  })
  
  describe('Performance Analytics', () => {
    it('displays listing performance metrics', async () => {
      const user = userEvent.setup()
      renderWithProviders(<InventoryManagement />)
      
      await waitFor(() => {
        expect(screen.getByText('+18005551234')).toBeInTheDocument()
      })
      
      // View performance details
      const firstItem = screen.getAllByTestId('inventory-item')[0]
      await user.click(within(firstItem).getByRole('button', { name: /view analytics/i }))
      
      // Check metrics display
      const analyticsModal = screen.getByRole('dialog')
      expect(within(analyticsModal).getByText(/conversion rate: 58%/i)).toBeInTheDocument()
      expect(within(analyticsModal).getByText(/avg call duration: 4:32/i)).toBeInTheDocument()
      expect(within(analyticsModal).getByText(/revenue per call: \$26.10/i)).toBeInTheDocument()
      
      // View trend chart
      expect(within(analyticsModal).getByTestId('performance-chart')).toBeInTheDocument()
    })
    
    it('compares listing performance', async () => {
      const user = userEvent.setup()
      renderWithProviders(<InventoryManagement />)
      
      // Select multiple listings
      await user.click(screen.getAllByRole('checkbox')[1])
      await user.click(screen.getAllByRole('checkbox')[2])
      
      // Open comparison
      await user.click(screen.getByRole('button', { name: /compare selected/i }))
      
      // Verify comparison view
      await waitFor(() => {
        const comparison = screen.getByTestId('performance-comparison')
        expect(within(comparison).getByText('+18005551234')).toBeInTheDocument()
        expect(within(comparison).getByText('+18005555678')).toBeInTheDocument()
        expect(within(comparison).getByTestId('comparison-chart')).toBeInTheDocument()
      })
    })
  })
  
  describe('Real-time Updates', () => {
    it('updates metrics when calls are sold', async () => {
      renderWithProviders(<InventoryManagement />)
      
      await waitFor(() => {
        expect(screen.getByText('+18005551234')).toBeInTheDocument()
      })
      
      const firstItem = screen.getAllByTestId('inventory-item')[0]
      
      // Simulate WebSocket update
      const wsMessage = {
        type: 'call_sold',
        data: {
          inventory_id: 'inv-1',
          new_sold_count: 88,
          new_revenue: 3960.00,
        },
      }
      
      window.dispatchEvent(new CustomEvent('ws-message', { detail: wsMessage }))
      
      // Verify update
      await waitFor(() => {
        expect(within(firstItem).getByText(/sold: 88/i)).toBeInTheDocument()
        expect(within(firstItem).getByText(/\$3,960/i)).toBeInTheDocument()
      })
    })
  })
})