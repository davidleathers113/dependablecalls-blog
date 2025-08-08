import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GlobalSearch } from '../GlobalSearch'
import { BrowserRouter } from 'react-router-dom'
import { useGlobalSearch } from '../../../hooks/useSearch'

// Mock the useGlobalSearch hook
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

vi.mock('../../../hooks/useSearch', () => ({
  useGlobalSearch: vi.fn(() => ({
    query: '',
    setQuery: vi.fn(),
    searchResults: [],
    isSearching: false,
    isLoading: false,
    categories: ['Navigation', 'Settings'],
    selectedCategory: null,
    setSelectedCategory: vi.fn(),
    clearSearch: vi.fn()
  }))
}))

const renderComponent = (props = {}) => {
  return render(
    <BrowserRouter>
      <GlobalSearch isOpen={true} onClose={vi.fn()} {...props} />
    </BrowserRouter>
  )
}

describe('GlobalSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render search dialog when open', () => {
    renderComponent()
    
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
    expect(screen.getByText('Quick Actions')).toBeInTheDocument()
  })

  it('should not render when closed', () => {
    renderComponent({ isOpen: false })
    
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument()
  })

  it('should focus search input on mount', async () => {
    renderComponent()
    
    const searchInput = screen.getByPlaceholderText('Search...')
    await waitFor(() => {
      expect(searchInput).toHaveFocus()
    })
  })

  it('should display category filters', () => {
    vi.mocked(useGlobalSearch).mockReturnValue({
      query: '',
      setQuery: vi.fn(),
      searchResults: [],
      isSearching: false,
      isLoading: false,
      categories: ['Navigation', 'Settings', 'Help'],
      selectedCategory: null,
      setSelectedCategory: vi.fn(),
      clearSearch: vi.fn()
    })
    
    renderComponent()
    
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Navigation')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Help')).toBeInTheDocument()
  })

  it('should handle category selection', async () => {
    const mockSetSelectedCategory = vi.fn()
    vi.mocked(useGlobalSearch).mockReturnValue({
      query: '',
      setQuery: vi.fn(),
      searchResults: [],
      isSearching: false,
      isLoading: false,
      categories: ['Navigation', 'Settings'],
      selectedCategory: null,
      setSelectedCategory: mockSetSelectedCategory,
      clearSearch: vi.fn()
    })
    
    renderComponent()
    
    const navigationButton = screen.getByText('Navigation')
    await userEvent.click(navigationButton)
    
    expect(mockSetSelectedCategory).toHaveBeenCalledWith('Navigation')
  })

  it('should display search results', () => {
    vi.mocked(useGlobalSearch).mockReturnValue({
      query: 'dash',
      setQuery: vi.fn(),
      searchResults: [
        {
          id: '1',
          title: 'Dashboard',
          description: 'Main dashboard',
          category: 'Navigation',
          url: '/dashboard'
        }
      ],
      isSearching: false,
      isLoading: false,
      categories: [],
      selectedCategory: null,
      setSelectedCategory: vi.fn(),
      clearSearch: vi.fn()
    })
    
    renderComponent()
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Main dashboard')).toBeInTheDocument()
  })

  it('should show loading state', () => {
    vi.mocked(useGlobalSearch).mockReturnValue({
      query: '',
      setQuery: vi.fn(),
      searchResults: [],
      isSearching: false,
      isLoading: true,
      categories: [],
      selectedCategory: null,
      setSelectedCategory: vi.fn(),
      clearSearch: vi.fn()
    })
    
    renderComponent()
    
    expect(screen.getByText('Loading search index...')).toBeInTheDocument()
  })

  it('should show searching state', () => {
    vi.mocked(useGlobalSearch).mockReturnValue({
      query: 'test',
      setQuery: vi.fn(),
      searchResults: [],
      isSearching: true,
      isLoading: false,
      categories: [],
      selectedCategory: null,
      setSelectedCategory: vi.fn(),
      clearSearch: vi.fn()
    })
    
    renderComponent()
    
    expect(screen.getByText('Searching...')).toBeInTheDocument()
  })

  it('should show no results message', () => {
    vi.mocked(useGlobalSearch).mockReturnValue({
      query: 'nonexistent',
      setQuery: vi.fn(),
      searchResults: [],
      isSearching: false,
      isLoading: false,
      categories: [],
      selectedCategory: null,
      setSelectedCategory: vi.fn(),
      clearSearch: vi.fn()
    })
    
    renderComponent()
    
    expect(screen.getByText('No results found for "nonexistent"')).toBeInTheDocument()
  })

  it('should navigate on result selection', async () => {
    const mockOnClose = vi.fn()
    const mockClearSearch = vi.fn()
    vi.mocked(useGlobalSearch).mockReturnValue({
      query: 'dash',
      setQuery: vi.fn(),
      searchResults: [
        {
          id: '1',
          title: 'Dashboard',
          description: 'Main dashboard',
          category: 'Navigation',
          url: '/app/dashboard'
        }
      ],
      isSearching: false,
      isLoading: false,
      categories: [],
      selectedCategory: null,
      setSelectedCategory: vi.fn(),
      clearSearch: mockClearSearch
    })
    
    renderComponent({ onClose: mockOnClose })
    
    const dashboardOption = screen.getByText('Dashboard')
    await userEvent.click(dashboardOption)
    
    expect(mockNavigate).toHaveBeenCalledWith('/app/dashboard')
    expect(mockClearSearch).toHaveBeenCalled()
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should clear search on clear button click', async () => {
    const mockClearSearch = vi.fn()
    vi.mocked(useGlobalSearch).mockReturnValue({
      query: 'test',
      setQuery: vi.fn(),
      searchResults: [],
      isSearching: false,
      isLoading: false,
      categories: [],
      selectedCategory: null,
      setSelectedCategory: vi.fn(),
      clearSearch: mockClearSearch
    })
    
    renderComponent()
    
    const clearButton = screen.getByRole('button', { name: /clear/i })
    await userEvent.click(clearButton)
    
    expect(mockClearSearch).toHaveBeenCalled()
  })

  it('should handle quick actions', async () => {
    const mockOnClose = vi.fn()
    renderComponent({ onClose: mockOnClose })
    
    const createCampaignButton = screen.getByText('Create New Campaign')
    await userEvent.click(createCampaignButton)
    
    expect(mockNavigate).toHaveBeenCalledWith('/app/campaigns/new')
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should display keyboard shortcuts', () => {
    renderComponent()
    
    expect(screen.getByText(/Press.*↵.*to select/)).toBeInTheDocument()
    expect(screen.getByText(/Press.*ESC.*to close/)).toBeInTheDocument()
  })

  it('should handle escape key to close', () => {
    const mockOnClose = vi.fn()
    const mockClearSearch = vi.fn()
    vi.mocked(useGlobalSearch).mockReturnValue({
      query: 'test',
      setQuery: vi.fn(),
      searchResults: [],
      isSearching: false,
      isLoading: false,
      categories: [],
      selectedCategory: null,
      setSelectedCategory: vi.fn(),
      clearSearch: mockClearSearch
    })
    
    const { container } = renderComponent({ onClose: mockOnClose })
    
    fireEvent.keyDown(container, { key: 'Escape', code: 'Escape' })
    
    // Dialog should handle ESC internally
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should have proper accessibility attributes', () => {
    renderComponent()
    
    const searchInput = screen.getByPlaceholderText('Search...')
    expect(searchInput).toHaveAttribute('type', 'text')
    
    // Check for icons with aria-hidden
    const icons = document.querySelectorAll('[aria-hidden="true"]')
    expect(icons.length).toBeGreaterThan(0)
  })

  it('should handle input changes', async () => {
    const mockSetQuery = vi.fn()
    vi.mocked(useGlobalSearch).mockReturnValue({
      query: '',
      setQuery: mockSetQuery,
      searchResults: [],
      isSearching: false,
      isLoading: false,
      categories: [],
      selectedCategory: null,
      setSelectedCategory: vi.fn(),
      clearSearch: vi.fn()
    })
    
    renderComponent()
    
    const searchInput = screen.getByPlaceholderText('Search...')
    await userEvent.type(searchInput, 'dashboard')
    
    expect(mockSetQuery).toHaveBeenCalled()
  })
})