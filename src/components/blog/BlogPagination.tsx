import React, { useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  EllipsisHorizontalIcon
} from '@heroicons/react/24/outline'
import Button from '../common/Button'
import Loading from '../common/Loading'

export interface PaginationInfo {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface BlogPaginationProps {
  /** Pagination information */
  pagination: PaginationInfo
  /** Loading state during page transitions */
  loading?: boolean
  /** Pagination variant */
  variant?: 'simple' | 'full' | 'compact'
  /** Show items per page selector */
  showItemsPerPage?: boolean
  /** Available page size options */
  pageSizeOptions?: number[]
  /** Show total items/pages display */
  showTotalInfo?: boolean
  /** Show jump to page functionality */
  showJumpToPage?: boolean
  /** Enable keyboard navigation */
  enableKeyboardNav?: boolean
  /** Maximum number of page buttons to show */
  maxPageButtons?: number
  /** Callback when page changes */
  onPageChange?: (page: number) => void
  /** Callback when page size changes */
  onPageSizeChange?: (pageSize: number) => void
  /** CSS classes */
  className?: string
  /** ARIA label for pagination */
  ariaLabel?: string
}

/**
 * Comprehensive pagination component for blog listings
 * Supports multiple variants, keyboard navigation, and URL parameter integration
 */
export const BlogPagination: React.FC<BlogPaginationProps> = ({
  pagination,
  loading = false,
  variant = 'full',
  showItemsPerPage = true,
  pageSizeOptions = [5, 10, 20, 50],
  showTotalInfo = true,
  showJumpToPage = false,
  enableKeyboardNav = true,
  maxPageButtons = 7,
  onPageChange,
  onPageSizeChange,
  className = '',
  ariaLabel = 'Blog pagination'
}) => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [jumpToPageValue, setJumpToPageValue] = useState('')

  const { currentPage, totalPages, totalItems, itemsPerPage, hasNextPage, hasPreviousPage } = pagination

  // Update URL parameters when pagination changes
  const updateUrlParams = useCallback((page: number, pageSize?: number) => {
    const params = new URLSearchParams(searchParams)
    
    if (page === 1) {
      params.delete('page')
    } else {
      params.set('page', page.toString())
    }
    
    if (pageSize && pageSize !== 10) {
      params.set('per_page', pageSize.toString())
    } else if (pageSize === 10) {
      params.delete('per_page')
    }
    
    setSearchParams(params, { replace: true })
  }, [searchParams, setSearchParams])

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    if (page < 1 || page > totalPages || page === currentPage || loading) return
    
    updateUrlParams(page)
    onPageChange?.(page)
  }, [currentPage, totalPages, loading, updateUrlParams, onPageChange])

  // Handle page size change
  const handlePageSizeChange = useCallback((newPageSize: number) => {
    const newPage = Math.ceil((currentPage - 1) * itemsPerPage / newPageSize) + 1
    updateUrlParams(newPage, newPageSize)
    onPageSizeChange?.(newPageSize)
  }, [currentPage, itemsPerPage, updateUrlParams, onPageSizeChange])

  // Handle jump to page
  const handleJumpToPage = useCallback(() => {
    const page = parseInt(jumpToPageValue, 10)
    if (page >= 1 && page <= totalPages) {
      handlePageChange(page)
      setJumpToPageValue('')
    }
  }, [jumpToPageValue, totalPages, handlePageChange])

  // Keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!enableKeyboardNav || loading) return

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault()
        if (hasPreviousPage) handlePageChange(currentPage - 1)
        break
      case 'ArrowRight':
        event.preventDefault()
        if (hasNextPage) handlePageChange(currentPage + 1)
        break
      case 'Home':
        event.preventDefault()
        handlePageChange(1)
        break
      case 'End':
        event.preventDefault()
        handlePageChange(totalPages)
        break
    }
  }, [enableKeyboardNav, loading, hasPreviousPage, hasNextPage, currentPage, totalPages, handlePageChange])

  // Generate page numbers array with ellipsis
  const pageNumbers = useMemo(() => {
    if (totalPages <= maxPageButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    const pages: (number | 'ellipsis')[] = []
    const halfRange = Math.floor((maxPageButtons - 3) / 2) // Account for first, last, and current page

    if (currentPage <= halfRange + 2) {
      // Show first pages
      for (let i = 1; i <= Math.min(maxPageButtons - 2, totalPages); i++) {
        pages.push(i)
      }
      if (totalPages > maxPageButtons - 2) {
        pages.push('ellipsis', totalPages)
      }
    } else if (currentPage >= totalPages - halfRange - 1) {
      // Show last pages
      pages.push(1)
      if (totalPages > maxPageButtons - 2) {
        pages.push('ellipsis')
      }
      for (let i = Math.max(totalPages - maxPageButtons + 3, 2); i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Show middle pages
      pages.push(1, 'ellipsis')
      for (let i = currentPage - halfRange; i <= currentPage + halfRange; i++) {
        pages.push(i)
      }
      pages.push('ellipsis', totalPages)
    }

    return pages
  }, [currentPage, totalPages, maxPageButtons])

  // Don't render if no pages
  if (totalPages <= 1 && variant !== 'full') return null

  const baseClasses = 'flex items-center justify-between bg-white px-4 py-3 sm:px-6'
  const mobileClasses = 'flex flex-1 justify-between sm:hidden'
  const desktopClasses = 'hidden sm:flex sm:flex-1 sm:items-center sm:justify-between'

  return (
    <nav
      className={`border-t border-gray-200 ${baseClasses} ${className}`}
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      tabIndex={enableKeyboardNav ? 0 : -1}
    >
      {/* Mobile view */}
      <div className={mobileClasses}>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasPreviousPage || loading}
          onClick={() => handlePageChange(currentPage - 1)}
          leftIcon={<ChevronLeftIcon className="h-4 w-4" />}
          className="relative"
        >
          Previous
        </Button>
        
        {loading && (
          <div className="flex items-center px-4">
            <Loading size="sm" />
          </div>
        )}
        
        <Button
          variant="outline"
          size="sm"
          disabled={!hasNextPage || loading}
          onClick={() => handlePageChange(currentPage + 1)}
          rightIcon={<ChevronRightIcon className="h-4 w-4" />}
        >
          Next
        </Button>
      </div>

      {/* Desktop view */}
      <div className={desktopClasses}>
        <div className="flex items-center space-x-4">
          {showTotalInfo && (
            <div>
              <p className="text-sm text-gray-700">
                Showing{' '}
                <span className="font-medium">
                  {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}
                </span>{' '}
                to{' '}
                <span className="font-medium">
                  {Math.min(currentPage * itemsPerPage, totalItems)}
                </span>{' '}
                of{' '}
                <span className="font-medium">{totalItems}</span>{' '}
                results
              </p>
            </div>
          )}

          {showItemsPerPage && (
            <div className="flex items-center space-x-2">
              <label htmlFor="items-per-page" className="text-sm text-gray-700">
                Items per page:
              </label>
              <select
                id="items-per-page"
                value={itemsPerPage}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                disabled={loading}
                className="rounded-md border-gray-300 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {loading && (
            <Loading size="sm" className="mr-2" />
          )}

          {variant === 'full' && (
            <>
              {/* First page button */}
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1 || loading}
                onClick={() => handlePageChange(1)}
                aria-label="Go to first page"
                className="p-2"
              >
                <ChevronDoubleLeftIcon className="h-4 w-4" />
              </Button>

              {/* Previous page button */}
              <Button
                variant="outline"
                size="sm"
                disabled={!hasPreviousPage || loading}
                onClick={() => handlePageChange(currentPage - 1)}
                aria-label="Go to previous page"
                className="p-2"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>

              {/* Page numbers */}
              <div className="flex items-center space-x-1">
                {pageNumbers.map((page, index) => (
                  page === 'ellipsis' ? (
                    <span key={`ellipsis-${index}`} className="px-2 py-1">
                      <EllipsisHorizontalIcon className="h-4 w-4 text-gray-400" />
                    </span>
                  ) : (
                    <Button
                      key={page}
                      variant={page === currentPage ? 'primary' : 'outline'}
                      size="sm"
                      disabled={loading}
                      onClick={() => handlePageChange(page as number)}
                      aria-label={`Go to page ${page}`}
                      aria-current={page === currentPage ? 'page' : undefined}
                      className="min-w-[2.5rem]"
                    >
                      {page}
                    </Button>
                  )
                ))}
              </div>

              {/* Next page button */}
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNextPage || loading}
                onClick={() => handlePageChange(currentPage + 1)}
                aria-label="Go to next page"
                className="p-2"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </Button>

              {/* Last page button */}
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages || loading}
                onClick={() => handlePageChange(totalPages)}
                aria-label="Go to last page"
                className="p-2"
              >
                <ChevronDoubleRightIcon className="h-4 w-4" />
              </Button>
            </>
          )}

          {variant === 'simple' && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasPreviousPage || loading}
                onClick={() => handlePageChange(currentPage - 1)}
                leftIcon={<ChevronLeftIcon className="h-4 w-4" />}
              >
                Previous
              </Button>
              
              <span className="px-4 py-2 text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNextPage || loading}
                onClick={() => handlePageChange(currentPage + 1)}
                rightIcon={<ChevronRightIcon className="h-4 w-4" />}
              >
                Next
              </Button>
            </>
          )}

          {variant === 'compact' && (
            <div className="flex items-center space-x-1">
              <Button
                variant="outline"
                size="sm"
                disabled={!hasPreviousPage || loading}
                onClick={() => handlePageChange(currentPage - 1)}
                className="p-2"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>
              
              <span className="px-3 py-1 text-sm text-gray-700 min-w-[4rem] text-center">
                {currentPage} / {totalPages}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNextPage || loading}
                onClick={() => handlePageChange(currentPage + 1)}
                className="p-2"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            </div>
          )}

          {showJumpToPage && variant === 'full' && (
            <div className="flex items-center space-x-2 ml-4">
              <label htmlFor="jump-to-page" className="text-sm text-gray-700">
                Go to:
              </label>
              <input
                id="jump-to-page"
                type="number"
                min={1}
                max={totalPages}
                value={jumpToPageValue}
                onChange={(e) => setJumpToPageValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleJumpToPage()
                  }
                }}
                disabled={loading}
                placeholder="Page"
                className="w-16 rounded-md border-gray-300 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={!jumpToPageValue || loading}
                onClick={handleJumpToPage}
              >
                Go
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

export default BlogPagination