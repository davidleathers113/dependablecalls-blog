import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useBlogFilterStore } from '../store/blogStore'
import type { PaginationInfo } from '../components/blog/BlogPagination'

export interface UseBlogPaginationOptions {
  /** Default page size */
  defaultPageSize?: number
  /** Maximum page size allowed */
  maxPageSize?: number
  /** Minimum page size allowed */
  minPageSize?: number
}

export interface UseBlogPaginationReturn {
  /** Current pagination information */
  pagination: PaginationInfo
  /** Handle page change */
  handlePageChange: (page: number) => void
  /** Handle page size change */
  handlePageSizeChange: (pageSize: number) => void
  /** Reset pagination to first page */
  resetPagination: () => void
  /** Get pagination parameters for API calls */
  getPaginationParams: () => { page: number; per_page: number }
  /** Update pagination with new data */
  updatePagination: (totalItems: number) => void
}

/**
 * Hook for managing blog pagination state and URL synchronization
 * Integrates with blog filter store and URL parameters
 */
export const useBlogPagination = (
  totalItems: number = 0,
  options: UseBlogPaginationOptions = {}
): UseBlogPaginationReturn => {
  const {
    defaultPageSize = 10,
    maxPageSize = 100,
    minPageSize = 5
  } = options

  const [searchParams, setSearchParams] = useSearchParams()
  const { 
    currentPage, 
    pageSize, 
    setCurrentPage, 
    setPageSize 
  } = useBlogFilterStore()

  // Initialize pagination from URL parameters
  useEffect(() => {
    const urlPage = parseInt(searchParams.get('page') || '1', 10)
    const urlPageSize = parseInt(searchParams.get('per_page') || defaultPageSize.toString(), 10)

    // Validate and constrain values
    const validPage = Math.max(1, urlPage)
    const validPageSize = Math.min(maxPageSize, Math.max(minPageSize, urlPageSize))

    // Update store if different from URL
    if (validPage !== currentPage) {
      setCurrentPage(validPage)
    }
    if (validPageSize !== pageSize) {
      setPageSize(validPageSize)
    }
  }, [searchParams, currentPage, pageSize, defaultPageSize, maxPageSize, minPageSize, setCurrentPage, setPageSize])

  // Calculate pagination info
  const pagination = useMemo((): PaginationInfo => {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
    const safePage = Math.min(currentPage, totalPages)
    
    return {
      currentPage: safePage,
      totalPages,
      totalItems,
      itemsPerPage: pageSize,
      hasNextPage: safePage < totalPages,
      hasPreviousPage: safePage > 1
    }
  }, [currentPage, totalItems, pageSize])

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    if (page < 1 || page > pagination.totalPages || page === currentPage) {
      return
    }

    setCurrentPage(page)
    
    // Update URL parameters
    const params = new URLSearchParams(searchParams)
    if (page === 1) {
      params.delete('page')
    } else {
      params.set('page', page.toString())
    }
    setSearchParams(params, { replace: true })
  }, [currentPage, pagination.totalPages, searchParams, setSearchParams, setCurrentPage])

  // Handle page size change
  const handlePageSizeChange = useCallback((newPageSize: number) => {
    const constrainedPageSize = Math.min(maxPageSize, Math.max(minPageSize, newPageSize))
    
    if (constrainedPageSize === pageSize) {
      return
    }

    // Calculate what the new page should be to maintain position
    const currentItemStart = (currentPage - 1) * pageSize
    const newPage = Math.floor(currentItemStart / constrainedPageSize) + 1
    
    setPageSize(constrainedPageSize)
    setCurrentPage(newPage)
    
    // Update URL parameters
    const params = new URLSearchParams(searchParams)
    
    if (newPage === 1) {
      params.delete('page')
    } else {
      params.set('page', newPage.toString())
    }
    
    if (constrainedPageSize === defaultPageSize) {
      params.delete('per_page')
    } else {
      params.set('per_page', constrainedPageSize.toString())
    }
    
    setSearchParams(params, { replace: true })
  }, [
    currentPage, 
    pageSize, 
    maxPageSize, 
    minPageSize, 
    defaultPageSize,
    searchParams, 
    setSearchParams, 
    setCurrentPage, 
    setPageSize
  ])

  // Reset pagination
  const resetPagination = useCallback(() => {
    setCurrentPage(1)
    
    const params = new URLSearchParams(searchParams)
    params.delete('page')
    setSearchParams(params, { replace: true })
  }, [searchParams, setSearchParams, setCurrentPage])

  // Get pagination parameters for API calls
  const getPaginationParams = useCallback(() => ({
    page: currentPage,
    per_page: pageSize
  }), [currentPage, pageSize])

  // Update pagination when total items change
  const updatePagination = useCallback((newTotalItems: number) => {
    const newTotalPages = Math.max(1, Math.ceil(newTotalItems / pageSize))
    
    // If current page is beyond the new total pages, reset to last page
    if (currentPage > newTotalPages) {
      handlePageChange(newTotalPages)
    }
  }, [currentPage, pageSize, handlePageChange])

  return {
    pagination,
    handlePageChange,
    handlePageSizeChange,
    resetPagination,
    getPaginationParams,
    updatePagination
  }
}

export default useBlogPagination