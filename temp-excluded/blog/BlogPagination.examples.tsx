import React, { useState } from 'react'
import BlogPagination, { type PaginationInfo } from './BlogPagination'
import { useBlogPagination } from '../../hooks/useBlogPagination'
import { MemoryRouter } from 'react-router-dom'

const ExampleWrapper: React.FC<{ children: React.ReactNode; title: string }> = ({ children, title }) => (
  <div className="space-y-4 p-6 border border-gray-200 rounded-lg">
    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
    <MemoryRouter>{children}</MemoryRouter>
  </div>
)

/**
 * Basic pagination example with 100 items
 */
export const BasicPaginationExample: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const totalItems = 100

  const pagination: PaginationInfo = {
    currentPage,
    totalPages: Math.ceil(totalItems / pageSize),
    totalItems,
    itemsPerPage: pageSize,
    hasNextPage: currentPage < Math.ceil(totalItems / pageSize),
    hasPreviousPage: currentPage > 1
  }

  return (
    <ExampleWrapper title="Basic Pagination">
      <BlogPagination
        pagination={pagination}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
      />
    </ExampleWrapper>
  )
}

/**
 * Simple variant for minimal space usage
 */
export const SimplePaginationExample: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(5)
  const totalItems = 200
  const pageSize = 10

  const pagination: PaginationInfo = {
    currentPage,
    totalPages: Math.ceil(totalItems / pageSize),
    totalItems,
    itemsPerPage: pageSize,
    hasNextPage: currentPage < Math.ceil(totalItems / pageSize),
    hasPreviousPage: currentPage > 1
  }

  return (
    <ExampleWrapper title="Simple Variant">
      <BlogPagination
        pagination={pagination}
        variant="simple"
        onPageChange={setCurrentPage}
      />
    </ExampleWrapper>
  )
}

/**
 * Compact variant for very tight spaces
 */
export const CompactPaginationExample: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(3)
  const totalItems = 75
  const pageSize = 5

  const pagination: PaginationInfo = {
    currentPage,
    totalPages: Math.ceil(totalItems / pageSize),
    totalItems,
    itemsPerPage: pageSize,
    hasNextPage: currentPage < Math.ceil(totalItems / pageSize),
    hasPreviousPage: currentPage > 1
  }

  return (
    <ExampleWrapper title="Compact Variant">
      <BlogPagination
        pagination={pagination}
        variant="compact"
        showItemsPerPage={false}
        showTotalInfo={false}
        onPageChange={setCurrentPage}
      />
    </ExampleWrapper>
  )
}

/**
 * Full variant with jump to page functionality
 */
export const FullPaginationExample: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(15)
  const [pageSize, setPageSize] = useState(10)
  const totalItems = 500

  const pagination: PaginationInfo = {
    currentPage,
    totalPages: Math.ceil(totalItems / pageSize),
    totalItems,
    itemsPerPage: pageSize,
    hasNextPage: currentPage < Math.ceil(totalItems / pageSize),
    hasPreviousPage: currentPage > 1
  }

  return (
    <ExampleWrapper title="Full Variant with Jump to Page">
      <BlogPagination
        pagination={pagination}
        variant="full"
        showJumpToPage={true}
        pageSizeOptions={[5, 10, 20, 50, 100]}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
      />
    </ExampleWrapper>
  )
}

/**
 * Loading state example
 */
export const LoadingPaginationExample: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const totalItems = 150
  const pageSize = 10

  const pagination: PaginationInfo = {
    currentPage: 7,
    totalPages: Math.ceil(totalItems / pageSize),
    totalItems,
    itemsPerPage: pageSize,
    hasNextPage: true,
    hasPreviousPage: true
  }

  return (
    <ExampleWrapper title="Loading State">
      <div className="space-y-4">
        <button
          onClick={() => setLoading(!loading)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Toggle Loading
        </button>
        <BlogPagination
          pagination={pagination}
          loading={loading}
          onPageChange={() => {}}
        />
      </div>
    </ExampleWrapper>
  )
}

/**
 * Example with custom page size options
 */
export const CustomPageSizeExample: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const totalItems = 1000

  const pagination: PaginationInfo = {
    currentPage,
    totalPages: Math.ceil(totalItems / pageSize),
    totalItems,
    itemsPerPage: pageSize,
    hasNextPage: currentPage < Math.ceil(totalItems / pageSize),
    hasPreviousPage: currentPage > 1
  }

  return (
    <ExampleWrapper title="Custom Page Size Options">
      <BlogPagination
        pagination={pagination}
        pageSizeOptions={[25, 50, 100, 200]}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
      />
    </ExampleWrapper>
  )
}

/**
 * Example with minimal options (no page size selector, no total info)
 */
export const MinimalPaginationExample: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(3)
  const totalItems = 50
  const pageSize = 10

  const pagination: PaginationInfo = {
    currentPage,
    totalPages: Math.ceil(totalItems / pageSize),
    totalItems,
    itemsPerPage: pageSize,
    hasNextPage: currentPage < Math.ceil(totalItems / pageSize),
    hasPreviousPage: currentPage > 1
  }

  return (
    <ExampleWrapper title="Minimal Configuration">
      <BlogPagination
        pagination={pagination}
        showItemsPerPage={false}
        showTotalInfo={false}
        enableKeyboardNav={false}
        onPageChange={setCurrentPage}
      />
    </ExampleWrapper>
  )
}

/**
 * Large dataset example with ellipsis
 */
export const LargeDatasetExample: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(247)
  const [pageSize, setPageSize] = useState(20)
  const totalItems = 10000

  const pagination: PaginationInfo = {
    currentPage,
    totalPages: Math.ceil(totalItems / pageSize),
    totalItems,
    itemsPerPage: pageSize,
    hasNextPage: currentPage < Math.ceil(totalItems / pageSize),
    hasPreviousPage: currentPage > 1
  }

  return (
    <ExampleWrapper title="Large Dataset with Ellipsis">
      <BlogPagination
        pagination={pagination}
        variant="full"
        showJumpToPage={true}
        maxPageButtons={5}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
      />
    </ExampleWrapper>
  )
}

/**
 * Example using the useBlogPagination hook
 */
export const WithHookExample: React.FC = () => {
  const totalItems = 120
  const {
    pagination,
    handlePageChange,
    handlePageSizeChange
  } = useBlogPagination(totalItems)

  return (
    <ExampleWrapper title="Using useBlogPagination Hook">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          This example uses the useBlogPagination hook for state management and URL synchronization.
        </p>
        <BlogPagination
          pagination={pagination}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>
    </ExampleWrapper>
  )
}

/**
 * Single page example (should not render)
 */
export const SinglePageExample: React.FC = () => {
  const totalItems = 5
  const pageSize = 10

  const pagination: PaginationInfo = {
    currentPage: 1,
    totalPages: 1,
    totalItems,
    itemsPerPage: pageSize,
    hasNextPage: false,
    hasPreviousPage: false
  }

  return (
    <ExampleWrapper title="Single Page (Hidden for Simple/Compact)">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Simple and compact variants hide pagination when there's only one page.
        </p>
        <div className="space-y-2">
          <div>
            <span className="text-xs font-medium text-gray-500">Simple variant:</span>
            <BlogPagination
              pagination={pagination}
              variant="simple"
              onPageChange={() => {}}
            />
            {pagination.totalPages === 1 && (
              <p className="text-xs text-gray-400 mt-1">Hidden (as expected)</p>
            )}
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500">Full variant:</span>
            <BlogPagination
              pagination={pagination}
              variant="full"
              onPageChange={() => {}}
            />
          </div>
        </div>
      </div>
    </ExampleWrapper>
  )
}

/**
 * Main examples component that shows all variations
 */
export const BlogPaginationExamples: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">BlogPagination Examples</h1>
        <p className="text-lg text-gray-600">
          Comprehensive pagination component for blog listings with multiple variants and features
        </p>
      </div>

      <div className="grid gap-8">
        <BasicPaginationExample />
        <SimplePaginationExample />
        <CompactPaginationExample />
        <FullPaginationExample />
        <LoadingPaginationExample />
        <CustomPageSizeExample />
        <MinimalPaginationExample />
        <LargeDatasetExample />
        <WithHookExample />
        <SinglePageExample />
      </div>

      <div className="bg-gray-50 p-6 rounded-lg">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Features</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="font-medium text-gray-800 mb-2">Variants</h3>
            <ul className="space-y-1 text-gray-600">
              <li>• <strong>Full:</strong> Complete pagination with all features</li>
              <li>• <strong>Simple:</strong> Previous/Next with page count</li>
              <li>• <strong>Compact:</strong> Minimal space usage</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-800 mb-2">Features</h3>
            <ul className="space-y-1 text-gray-600">
              <li>• Keyboard navigation (Arrow keys, Home, End)</li>
              <li>• URL parameter integration</li>
              <li>• Loading states</li>
              <li>• Jump to page functionality</li>
              <li>• Items per page selector</li>
              <li>• Responsive design</li>
              <li>• Accessibility (ARIA labels, roles)</li>
              <li>• Ellipsis for large page counts</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BlogPaginationExamples