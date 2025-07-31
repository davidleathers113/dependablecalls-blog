import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import BlogPagination, { type PaginationInfo } from '../BlogPagination'

// Mock the Button and Loading components
vi.mock('../../common/Button', () => ({
  default: ({ children, onClick, disabled, className, ...props }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    [key: string]: unknown;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-testid={props['data-testid']}
      {...props}
    >
      {children}
    </button>
  )
}))

vi.mock('../../common/Loading', () => ({
  default: ({ className }: { className?: string }) => (
    <div className={className} data-testid="loading">Loading...</div>
  )
}))

const defaultPagination: PaginationInfo = {
  currentPage: 1,
  totalPages: 10,
  totalItems: 100,
  itemsPerPage: 10,
  hasNextPage: true,
  hasPreviousPage: false
}

const renderWithRouter = (component: React.ReactElement, initialEntries = ['/']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      {component}
    </MemoryRouter>
  )
}

describe('BlogPagination', () => {
  const mockOnPageChange = vi.fn()
  const mockOnPageSizeChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders pagination with default props', () => {
      renderWithRouter(
        <BlogPagination
          pagination={defaultPagination}
          onPageChange={mockOnPageChange}
        />
      )

      expect(screen.getByRole('navigation', { name: 'Blog pagination' })).toBeInTheDocument()
      expect(screen.getByText('Previous')).toBeInTheDocument()
      expect(screen.getByText('Next')).toBeInTheDocument()
    })

    it('renders total info by default', () => {
      renderWithRouter(
        <BlogPagination
          pagination={defaultPagination}
          onPageChange={mockOnPageChange}
        />
      )

      expect(screen.getByText(/Showing 1 to 10 of 100 results/)).toBeInTheDocument()
    })

    it('renders items per page selector by default', () => {
      renderWithRouter(
        <BlogPagination
          pagination={defaultPagination}
          onPageChange={mockOnPageChange}
        />
      )

      expect(screen.getByLabelText('Items per page:')).toBeInTheDocument()
    })

    it('hides pagination when totalPages is 1 and variant is not full', () => {
      const singlePagePagination: PaginationInfo = {
        ...defaultPagination,
        totalPages: 1,
        hasNextPage: false
      }

      const { container } = renderWithRouter(
        <BlogPagination
          pagination={singlePagePagination}
          variant="simple"
          onPageChange={mockOnPageChange}
        />
      )

      expect(container.firstChild).toBeNull()
    })
  })

  describe('Variants', () => {
    it('renders simple variant correctly', () => {
      renderWithRouter(
        <BlogPagination
          pagination={defaultPagination}
          variant="simple"
          onPageChange={mockOnPageChange}
        />
      )

      expect(screen.getByText('Page 1 of 10')).toBeInTheDocument()
      expect(screen.queryByText('1')).not.toBeInTheDocument() // No page numbers
    })

    it('renders compact variant correctly', () => {
      renderWithRouter(
        <BlogPagination
          pagination={defaultPagination}
          variant="compact"
          onPageChange={mockOnPageChange}
        />
      )

      expect(screen.getByText('1 / 10')).toBeInTheDocument()
    })

    it('renders full variant with page numbers', () => {
      renderWithRouter(
        <BlogPagination
          pagination={defaultPagination}
          variant="full"
          onPageChange={mockOnPageChange}
        />
      )

      // Should show page numbers
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    it('calls onPageChange when clicking next', () => {
      renderWithRouter(
        <BlogPagination
          pagination={defaultPagination}
          onPageChange={mockOnPageChange}
        />
      )

      fireEvent.click(screen.getAllByText('Next')[1]) // Desktop version
      expect(mockOnPageChange).toHaveBeenCalledWith(2)
    })

    it('calls onPageChange when clicking previous', () => {
      const middlePagePagination: PaginationInfo = {
        ...defaultPagination,
        currentPage: 5,
        hasPreviousPage: true
      }

      renderWithRouter(
        <BlogPagination
          pagination={middlePagePagination}
          onPageChange={mockOnPageChange}
        />
      )

      fireEvent.click(screen.getAllByText('Previous')[1]) // Desktop version
      expect(mockOnPageChange).toHaveBeenCalledWith(4)
    })

    it('calls onPageChange when clicking page number', () => {
      renderWithRouter(
        <BlogPagination
          pagination={defaultPagination}
          variant="full"
          onPageChange={mockOnPageChange}
        />
      )

      fireEvent.click(screen.getByText('3'))
      expect(mockOnPageChange).toHaveBeenCalledWith(3)
    })

    it('disables previous button on first page', () => {
      renderWithRouter(
        <BlogPagination
          pagination={defaultPagination}
          onPageChange={mockOnPageChange}
        />
      )

      const previousButtons = screen.getAllByText('Previous')
      previousButtons.forEach(button => {
        expect(button).toBeDisabled()
      })
    })

    it('disables next button on last page', () => {
      const lastPagePagination: PaginationInfo = {
        ...defaultPagination,
        currentPage: 10,
        hasNextPage: false,
        hasPreviousPage: true
      }

      renderWithRouter(
        <BlogPagination
          pagination={lastPagePagination}
          onPageChange={mockOnPageChange}
        />
      )

      const nextButtons = screen.getAllByText('Next')
      nextButtons.forEach(button => {
        expect(button).toBeDisabled()
      })
    })
  })

  describe('Loading State', () => {
    it('shows loading indicator when loading', () => {
      renderWithRouter(
        <BlogPagination
          pagination={defaultPagination}
          loading={true}
          onPageChange={mockOnPageChange}
        />
      )

      expect(screen.getAllByTestId('loading')).toHaveLength(2) // Mobile and desktop
    })

    it('disables buttons when loading', () => {
      renderWithRouter(
        <BlogPagination
          pagination={defaultPagination}
          loading={true}
          onPageChange={mockOnPageChange}
        />
      )

      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toBeDisabled()
      })
    })
  })

  describe('Page Size', () => {
    it('calls onPageSizeChange when changing page size', () => {
      renderWithRouter(
        <BlogPagination
          pagination={defaultPagination}
          onPageChange={mockOnPageChange}
          onPageSizeChange={mockOnPageSizeChange}
        />
      )

      const select = screen.getByLabelText('Items per page:')
      fireEvent.change(select, { target: { value: '20' } })
      
      expect(mockOnPageSizeChange).toHaveBeenCalledWith(20)
    })

    it('hides page size selector when showItemsPerPage is false', () => {
      renderWithRouter(
        <BlogPagination
          pagination={defaultPagination}
          showItemsPerPage={false}
          onPageChange={mockOnPageChange}
        />
      )

      expect(screen.queryByLabelText('Items per page:')).not.toBeInTheDocument()
    })

    it('renders custom page size options', () => {
      renderWithRouter(
        <BlogPagination
          pagination={defaultPagination}
          pageSizeOptions={[10, 25, 50]}
          onPageChange={mockOnPageChange}
        />
      )

      const select = screen.getByLabelText('Items per page:')
      expect(select).toBeInTheDocument()
      
      const options = screen.getAllByRole('option')
      expect(options).toHaveLength(3)
      expect(screen.getByRole('option', { name: '25' })).toBeInTheDocument()
    })
  })

  describe('Jump to Page', () => {
    it('shows jump to page input when enabled', () => {
      renderWithRouter(
        <BlogPagination
          pagination={defaultPagination}
          variant="full"
          showJumpToPage={true}
          onPageChange={mockOnPageChange}
        />
      )

      expect(screen.getByLabelText('Go to:')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Page')).toBeInTheDocument()
      expect(screen.getByText('Go')).toBeInTheDocument()
    })

    it('jumps to page when clicking go button', () => {
      renderWithRouter(
        <BlogPagination
          pagination={defaultPagination}
          variant="full"
          showJumpToPage={true}
          onPageChange={mockOnPageChange}
        />
      )

      const input = screen.getByPlaceholderText('Page')
      const goButton = screen.getByText('Go')

      fireEvent.change(input, { target: { value: '5' } })
      fireEvent.click(goButton)

      expect(mockOnPageChange).toHaveBeenCalledWith(5)
    })

    it('jumps to page when pressing enter in input', () => {
      renderWithRouter(
        <BlogPagination
          pagination={defaultPagination}
          variant="full"
          showJumpToPage={true}
          onPageChange={mockOnPageChange}
        />
      )

      const input = screen.getByPlaceholderText('Page')
      fireEvent.change(input, { target: { value: '7' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(mockOnPageChange).toHaveBeenCalledWith(7)
    })
  })

  describe('Keyboard Navigation', () => {
    it('navigates with arrow keys when enabled', () => {
      const middlePagePagination: PaginationInfo = {
        ...defaultPagination,
        currentPage: 5,
        hasPreviousPage: true
      }

      renderWithRouter(
        <BlogPagination
          pagination={middlePagePagination}
          enableKeyboardNav={true}
          onPageChange={mockOnPageChange}
        />
      )

      const nav = screen.getByRole('navigation')
      
      fireEvent.keyDown(nav, { key: 'ArrowRight' })
      expect(mockOnPageChange).toHaveBeenCalledWith(6)

      fireEvent.keyDown(nav, { key: 'ArrowLeft' })
      expect(mockOnPageChange).toHaveBeenCalledWith(4)
    })

    it('navigates to first/last page with Home/End keys', () => {
      const middlePagePagination: PaginationInfo = {
        ...defaultPagination,
        currentPage: 5,
        hasPreviousPage: true
      }

      renderWithRouter(
        <BlogPagination
          pagination={middlePagePagination}
          enableKeyboardNav={true}
          onPageChange={mockOnPageChange}
        />
      )

      const nav = screen.getByRole('navigation')
      
      fireEvent.keyDown(nav, { key: 'Home' })
      expect(mockOnPageChange).toHaveBeenCalledWith(1)

      fireEvent.keyDown(nav, { key: 'End' })
      expect(mockOnPageChange).toHaveBeenCalledWith(10)
    })

    it('ignores keyboard navigation when disabled', () => {
      renderWithRouter(
        <BlogPagination
          pagination={defaultPagination}
          enableKeyboardNav={false}
          onPageChange={mockOnPageChange}
        />
      )

      const nav = screen.getByRole('navigation')
      fireEvent.keyDown(nav, { key: 'ArrowRight' })
      
      expect(mockOnPageChange).not.toHaveBeenCalled()
    })
  })

  describe('Ellipsis Handling', () => {
    it('shows ellipsis for large page counts', () => {
      const largePagination: PaginationInfo = {
        ...defaultPagination,
        currentPage: 10,
        totalPages: 50,
        hasPreviousPage: true
      }

      renderWithRouter(
        <BlogPagination
          pagination={largePagination}
          variant="full"
          onPageChange={mockOnPageChange}
        />
      )

      // Should show ellipsis (represented by EllipsisHorizontalIcon)
      const pageNumbers = screen.getByRole('navigation').querySelectorAll('button, span')
      expect(pageNumbers.length).toBeGreaterThan(10) // Should have limited page buttons plus ellipsis
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      renderWithRouter(
        <BlogPagination
          pagination={defaultPagination}
          variant="full"
          onPageChange={mockOnPageChange}
        />
      )

      expect(screen.getByRole('navigation', { name: 'Blog pagination' })).toBeInTheDocument()
    })

    it('marks current page as current', () => {
      renderWithRouter(
        <BlogPagination
          pagination={defaultPagination}
          variant="full"
          onPageChange={mockOnPageChange}
        />
      )

      const currentPageButton = screen.getByRole('button', { name: 'Go to page 1' })
      expect(currentPageButton).toHaveAttribute('aria-current', 'page')
    })

    it('has proper tabindex for keyboard navigation', () => {
      renderWithRouter(
        <BlogPagination
          pagination={defaultPagination}
          enableKeyboardNav={true}
          onPageChange={mockOnPageChange}
        />
      )

      const nav = screen.getByRole('navigation')
      expect(nav).toHaveAttribute('tabindex', '0')
    })
  })

  describe('Custom Props', () => {
    it('applies custom className', () => {
      renderWithRouter(
        <BlogPagination
          pagination={defaultPagination}
          className="custom-pagination"
          onPageChange={mockOnPageChange}
        />
      )

      const nav = screen.getByRole('navigation')
      expect(nav).toHaveClass('custom-pagination')
    })

    it('uses custom aria label', () => {
      renderWithRouter(
        <BlogPagination
          pagination={defaultPagination}
          ariaLabel="Custom pagination"
          onPageChange={mockOnPageChange}
        />
      )

      expect(screen.getByRole('navigation', { name: 'Custom pagination' })).toBeInTheDocument()
    })

    it('hides total info when showTotalInfo is false', () => {
      renderWithRouter(
        <BlogPagination
          pagination={defaultPagination}
          showTotalInfo={false}
          onPageChange={mockOnPageChange}
        />
      )

      expect(screen.queryByText(/Showing.*results/)).not.toBeInTheDocument()
    })
  })
})