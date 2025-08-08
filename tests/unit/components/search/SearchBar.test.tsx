import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SearchBar } from '../SearchBar'
import type { SearchSuggestion } from '../../../types/search'

// Mock the useDebounce hook
vi.mock('../../../hooks/useDebounce', () => ({
  useDebounce: vi.fn((value) => value) // Return value immediately for testing
}))

// Mock router
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}))

// Mock clsx
vi.mock('clsx', () => ({
  clsx: (...args: (string | boolean | null | undefined)[]) => args.filter(Boolean).join(' ')
}))

describe('SearchBar', () => {
  const defaultProps = {
    placeholder: 'Search...',
    'aria-label': 'Search input'
  }

  const _mockSuggestions: SearchSuggestion[] = [
    {
      id: '1',
      text: 'Campaign Alpha',
      category: 'campaigns',
      popularity: 10
    },
    {
      id: '2',
      text: 'Call Tracking',
      category: 'calls',
      popularity: 8
    },
    {
      id: '3', 
      text: 'User Settings',
      category: 'settings',
      popularity: 5
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders search input with correct attributes', () => {
      render(<SearchBar {...defaultProps} />)
      
      const input = screen.getByRole('combobox')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('placeholder', 'Search...')
      expect(input).toHaveAttribute('aria-label', 'Search input')
      expect(input).toHaveAttribute('aria-autocomplete', 'list')
    })

    it('renders magnifying glass icon', () => {
      render(<SearchBar {...defaultProps} />)
      
      // Icon should be present but hidden from screen readers
      const icon = document.querySelector('[aria-hidden="true"]')
      expect(icon).toBeInTheDocument()
    })

    it('applies custom className', () => {
      render(<SearchBar {...defaultProps} className="custom-class" />)
      
      const container = screen.getByRole('combobox').closest('.custom-class')
      expect(container).toBeInTheDocument()
    })

    it('renders with different size variants', () => {
      const { rerender } = render(<SearchBar {...defaultProps} size="sm" />)
      expect(screen.getByRole('combobox')).toHaveClass('h-8')
      
      rerender(<SearchBar {...defaultProps} size="md" />)
      expect(screen.getByRole('combobox')).toHaveClass('h-10')
      
      rerender(<SearchBar {...defaultProps} size="lg" />)
      expect(screen.getByRole('combobox')).toHaveClass('h-12')
    })

    it('renders with different variants', () => {
      const { rerender } = render(<SearchBar {...defaultProps} variant="default" />)
      expect(screen.getByRole('combobox')).toHaveClass('border-gray-300')
      
      rerender(<SearchBar {...defaultProps} variant="minimal" />)
      expect(screen.getByRole('combobox')).toHaveClass('border-0')
      
      rerender(<SearchBar {...defaultProps} variant="rounded" />)
      expect(screen.getByRole('combobox')).toHaveClass('rounded-full')
    })
  })

  describe('User Interactions', () => {
    it('updates input value when user types', async () => {
      const user = userEvent.setup()
      render(<SearchBar {...defaultProps} />)
      
      const input = screen.getByRole('combobox')
      await user.type(input, 'test query')
      
      expect(input).toHaveValue('test query')
    })

    it('calls onSearch callback when Enter is pressed', async () => {
      const user = userEvent.setup()
      const onSearch = vi.fn()
      render(<SearchBar {...defaultProps} onSearch={onSearch} />)
      
      const input = screen.getByRole('combobox')
      await user.type(input, 'search query')
      await user.keyboard('{Enter}')
      
      expect(onSearch).toHaveBeenCalledWith('search query')
    })

    it('shows clear button when input has value', async () => {
      const user = userEvent.setup()
      render(<SearchBar {...defaultProps} />)
      
      const input = screen.getByRole('combobox')
      await user.type(input, 'test')
      
      const clearButton = screen.getByLabelText('Clear search')
      expect(clearButton).toBeInTheDocument()
    })

    it('clears input when clear button is clicked', async () => {
      const user = userEvent.setup()
      render(<SearchBar {...defaultProps} />)
      
      const input = screen.getByRole('combobox')
      await user.type(input, 'test')
      
      const clearButton = screen.getByLabelText('Clear search')
      await user.click(clearButton)
      
      expect(input).toHaveValue('')
    })

    it('focuses input when clear button is clicked', async () => {
      const user = userEvent.setup()
      render(<SearchBar {...defaultProps} />)
      
      const input = screen.getByRole('combobox')
      await user.type(input, 'test')
      
      // Focus something else
      const clearButton = screen.getByLabelText('Clear search')
      clearButton.focus()
      
      await user.click(clearButton)
      
      expect(input).toHaveFocus()
    })
  })

  describe('Suggestions', () => {
    it('shows suggestions when showSuggestions is true and input is focused', async () => {
      const user = userEvent.setup()
      const suggestions: SearchSuggestion[] = [
        { id: '1', text: 'Test suggestion', category: 'test' }
      ]
      
      render(
        <SearchBar 
          {...defaultProps} 
          showSuggestions={true} 
          suggestions={suggestions}
        />
      )
      
      const input = screen.getByRole('combobox')
      await user.click(input)
      await user.type(input, 'test')
      
      await waitFor(() => {
        expect(screen.getByText('Test suggestion')).toBeInTheDocument()
      })
    })

    it('does not show suggestions when showSuggestions is false', async () => {
      const user = userEvent.setup()
      const suggestions: SearchSuggestion[] = [
        { id: '1', text: 'Test suggestion', category: 'test' }
      ]
      
      render(
        <SearchBar 
          {...defaultProps} 
          showSuggestions={false} 
          suggestions={suggestions}
        />
      )
      
      const input = screen.getByRole('combobox')
      await user.click(input)
      await user.type(input, 'test')
      
      await waitFor(() => {
        expect(screen.queryByText('Test suggestion')).not.toBeInTheDocument()
      })
    })

    it('calls onSuggestionSelect when suggestion is clicked', async () => {
      const user = userEvent.setup()
      const onSuggestionSelect = vi.fn()
      const suggestions: SearchSuggestion[] = [
        { id: '1', text: 'Test suggestion', category: 'test', url: '/test' }
      ]
      
      render(
        <SearchBar 
          {...defaultProps} 
          showSuggestions={true} 
          suggestions={suggestions}
          onSuggestionSelect={onSuggestionSelect}
        />
      )
      
      const input = screen.getByRole('combobox')
      await user.click(input)
      await user.type(input, 'test')
      
      await waitFor(() => {
        const suggestion = screen.getByText('Test suggestion')
        expect(suggestion).toBeInTheDocument()
      })
      
      const suggestion = screen.getByText('Test suggestion')
      await user.click(suggestion)
      
      expect(onSuggestionSelect).toHaveBeenCalledWith(suggestions[0])
    })

    it('navigates to suggestion URL when no onSuggestionSelect provided', async () => {
      const user = userEvent.setup()
      const suggestions: SearchSuggestion[] = [
        { id: '1', text: 'Test suggestion', category: 'test', url: '/test-url' }
      ]
      
      render(
        <SearchBar 
          {...defaultProps} 
          showSuggestions={true} 
          suggestions={suggestions}
        />
      )
      
      const input = screen.getByRole('combobox')
      await user.click(input)
      await user.type(input, 'test')
      
      await waitFor(() => {
        const suggestion = screen.getByText('Test suggestion')
        expect(suggestion).toBeInTheDocument()
      })
      
      const suggestion = screen.getByText('Test suggestion')
      await user.click(suggestion)
      
      expect(mockNavigate).toHaveBeenCalledWith('/test-url')
    })

    it('limits suggestions to maxSuggestions', async () => {
      const user = userEvent.setup()
      const suggestions: SearchSuggestion[] = [
        { id: '1', text: 'Suggestion 1', category: 'test' },
        { id: '2', text: 'Suggestion 2', category: 'test' },
        { id: '3', text: 'Suggestion 3', category: 'test' },
        { id: '4', text: 'Suggestion 4', category: 'test' },
        { id: '5', text: 'Suggestion 5', category: 'test' }
      ]
      
      render(
        <SearchBar 
          {...defaultProps} 
          showSuggestions={true} 
          suggestions={suggestions}
          maxSuggestions={3}
        />
      )
      
      const input = screen.getByRole('combobox')
      await user.click(input)
      await user.type(input, 'suggestion')
      
      await waitFor(() => {
        expect(screen.getByText('Suggestion 1')).toBeInTheDocument()
        expect(screen.getByText('Suggestion 2')).toBeInTheDocument()
        expect(screen.getByText('Suggestion 3')).toBeInTheDocument()
        expect(screen.queryByText('Suggestion 4')).not.toBeInTheDocument()
        expect(screen.queryByText('Suggestion 5')).not.toBeInTheDocument()
      })
    })
  })

  describe('Keyboard Navigation', () => {
    it('navigates suggestions with arrow keys', async () => {
      const user = userEvent.setup()
      const suggestions: SearchSuggestion[] = [
        { id: '1', text: 'First suggestion', category: 'test' },
        { id: '2', text: 'Second suggestion', category: 'test' }
      ]
      
      render(
        <SearchBar 
          {...defaultProps} 
          showSuggestions={true} 
          suggestions={suggestions}
        />
      )
      
      const input = screen.getByRole('combobox')
      await user.click(input)
      await user.type(input, 'suggestion')
      
      // Wait for suggestions to appear
      await waitFor(() => {
        expect(screen.getByText('First suggestion')).toBeInTheDocument()
      })
      
      // Navigate down
      await user.keyboard('{ArrowDown}')
      expect(input).toHaveAttribute('aria-activedescendant', 'search-suggestion-0')
      
      // Navigate down again
      await user.keyboard('{ArrowDown}')
      expect(input).toHaveAttribute('aria-activedescendant', 'search-suggestion-1')
      
      // Navigate up
      await user.keyboard('{ArrowUp}')
      expect(input).toHaveAttribute('aria-activedescendant', 'search-suggestion-0')
    })

    it('selects suggestion with Enter key', async () => {
      const user = userEvent.setup()
      const onSuggestionSelect = vi.fn()
      const suggestions: SearchSuggestion[] = [
        { id: '1', text: 'Test suggestion', category: 'test', url: '/test' }
      ]
      
      render(
        <SearchBar 
          {...defaultProps} 
          showSuggestions={true} 
          suggestions={suggestions}
          onSuggestionSelect={onSuggestionSelect}
        />
      )
      
      const input = screen.getByRole('combobox')
      await user.click(input)
      await user.type(input, 'test')
      
      await waitFor(() => {
        expect(screen.getByText('Test suggestion')).toBeInTheDocument()
      })
      
      await user.keyboard('{ArrowDown}')
      await user.keyboard('{Enter}')
      
      expect(onSuggestionSelect).toHaveBeenCalledWith(suggestions[0])
    })

    it('closes suggestions with Escape key', async () => {
      const user = userEvent.setup()
      const suggestions: SearchSuggestion[] = [
        { id: '1', text: 'Test suggestion', category: 'test' }
      ]
      
      render(
        <SearchBar 
          {...defaultProps} 
          showSuggestions={true} 
          suggestions={suggestions}
        />
      )
      
      const input = screen.getByRole('combobox')
      await user.click(input)
      await user.type(input, 'test')
      
      await waitFor(() => {
        expect(screen.getByText('Test suggestion')).toBeInTheDocument()
      })
      
      await user.keyboard('{Escape}')
      
      await waitFor(() => {
        expect(screen.queryByText('Test suggestion')).not.toBeInTheDocument()
      })
    })
  })

  describe('Loading State', () => {
    it('shows loading indicator when isLoading is true', () => {
      render(<SearchBar {...defaultProps} isLoading={true} />)
      
      const loadingIndicator = document.querySelector('.animate-spin')
      expect(loadingIndicator).toBeInTheDocument()
    })

    it('disables input when isLoading is true', () => {
      render(<SearchBar {...defaultProps} isLoading={true} />)
      
      const input = screen.getByRole('combobox')
      expect(input).toBeDisabled()
    })

    it('does not show clear button when loading', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<SearchBar {...defaultProps} />)
      
      const input = screen.getByRole('combobox')
      await user.type(input, 'test')
      
      // Should show clear button normally
      expect(screen.getByLabelText('Clear search')).toBeInTheDocument()
      
      // Should hide clear button when loading
      rerender(<SearchBar {...defaultProps} isLoading={true} />)
      expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
    })
  })

  describe('Disabled State', () => {
    it('disables input when disabled prop is true', () => {
      render(<SearchBar {...defaultProps} disabled={true} />)
      
      const input = screen.getByRole('combobox')
      expect(input).toBeDisabled()
    })

    it('does not show clear button when disabled', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<SearchBar {...defaultProps} />)
      
      const input = screen.getByRole('combobox')
      await user.type(input, 'test')
      
      // Should show clear button normally
      expect(screen.getByLabelText('Clear search')).toBeInTheDocument()
      
      // Should hide clear button when disabled
      rerender(<SearchBar {...defaultProps} disabled={true} />)
      expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has correct ARIA attributes', () => {
      render(<SearchBar {...defaultProps} />)
      
      const input = screen.getByRole('combobox')
      expect(input).toHaveAttribute('aria-autocomplete', 'list')
      expect(input).toHaveAttribute('aria-expanded', 'false')
      expect(input).toHaveAttribute('aria-haspopup', 'listbox')
    })

    it('updates aria-expanded when suggestions are shown', async () => {
      const user = userEvent.setup()
      const suggestions: SearchSuggestion[] = [
        { id: '1', text: 'Test suggestion', category: 'test' }
      ]
      
      render(
        <SearchBar 
          {...defaultProps} 
          showSuggestions={true} 
          suggestions={suggestions}
        />
      )
      
      const input = screen.getByRole('combobox')
      expect(input).toHaveAttribute('aria-expanded', 'false')
      
      await user.click(input)
      await user.type(input, 'test')
      
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-expanded', 'true')
      })
    })

    it('suggestions have listbox role', async () => {
      const user = userEvent.setup()
      const suggestions: SearchSuggestion[] = [
        { id: '1', text: 'Test suggestion', category: 'test' }
      ]
      
      render(
        <SearchBar 
          {...defaultProps} 
          showSuggestions={true} 
          suggestions={suggestions}
        />
      )
      
      const input = screen.getByRole('combobox')
      await user.click(input)
      await user.type(input, 'test')
      
      await waitFor(() => {
        const listbox = screen.getByRole('listbox')
        expect(listbox).toBeInTheDocument()
      })
    })

    it('suggestion items have option role', async () => {
      const user = userEvent.setup()
      const suggestions: SearchSuggestion[] = [
        { id: '1', text: 'Test suggestion', category: 'test' }
      ]
      
      render(
        <SearchBar 
          {...defaultProps} 
          showSuggestions={true} 
          suggestions={suggestions}
        />
      )
      
      const input = screen.getByRole('combobox')
      await user.click(input)
      await user.type(input, 'test')
      
      await waitFor(() => {
        const option = screen.getByRole('option')
        expect(option).toBeInTheDocument()
        expect(option).toHaveAttribute('aria-selected', 'false')
      })
    })
  })

  describe('Click Outside', () => {
    it('closes suggestions when clicking outside', async () => {
      const user = userEvent.setup()
      const suggestions: SearchSuggestion[] = [
        { id: '1', text: 'Test suggestion', category: 'test' }
      ]
      
      render(
        <div>
          <SearchBar 
            {...defaultProps} 
            showSuggestions={true} 
            suggestions={suggestions}
          />
          <div data-testid="outside">Outside element</div>
        </div>
      )
      
      const input = screen.getByRole('combobox')
      await user.click(input)
      await user.type(input, 'test')
      
      await waitFor(() => {
        expect(screen.getByText('Test suggestion')).toBeInTheDocument()
      })
      
      const outside = screen.getByTestId('outside')
      await user.click(outside)
      
      await waitFor(() => {
        expect(screen.queryByText('Test suggestion')).not.toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('handles empty suggestions array gracefully', async () => {
      const user = userEvent.setup()
      render(
        <SearchBar 
          {...defaultProps} 
          showSuggestions={true} 
          suggestions={[]}
        />
      )
      
      const input = screen.getByRole('combobox')
      await user.click(input)
      await user.type(input, 'test')
      
      // Should show "no results found" message
      await waitFor(() => {
        expect(screen.getByText('No results found for "test"')).toBeInTheDocument()
      })
    })

    it('handles missing suggestion properties gracefully', async () => {
      const user = userEvent.setup()
      const suggestions: SearchSuggestion[] = [
        { id: '1', text: 'Test suggestion', category: 'test' }
        // Missing description, icon, etc.
      ]
      
      render(
        <SearchBar 
          {...defaultProps} 
          showSuggestions={true} 
          suggestions={suggestions}
        />
      )
      
      const input = screen.getByRole('combobox')
      await user.click(input)
      await user.type(input, 'test')
      
      await waitFor(() => {
        expect(screen.getByText('Test suggestion')).toBeInTheDocument()
      })
      
      // Should not crash with missing properties
      expect(screen.getByText('Test suggestion')).toBeInTheDocument()
    })
  })
})