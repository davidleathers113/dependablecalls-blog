import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  XMarkIcon,
  CalendarIcon,
  FolderIcon,
  TagIcon
} from '@heroicons/react/24/outline'
import { useBlogCategories, useBlogTags } from '../../hooks/useBlog'
import type { BlogPostFilters, BlogPostSortBy, SortOrder } from '../../types/blog'
import { Card, CardContent } from '../common/Card'
import { Button } from '../common/Button'
import { Badge } from '../common/Badge'

interface BlogSearchProps {
  onFiltersChange: (filters: BlogPostFilters & { sort?: { by: BlogPostSortBy; order: SortOrder } }) => void
  initialFilters?: BlogPostFilters
  className?: string
}

export function BlogSearch({ onFiltersChange, initialFilters, className = '' }: BlogSearchProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [showFilters, setShowFilters] = useState(false)
  const [searchTerm, setSearchTerm] = useState(initialFilters?.search || searchParams.get('q') || '')
  const [selectedCategory, setSelectedCategory] = useState(initialFilters?.categorySlug || searchParams.get('category') || '')
  const [selectedTag, setSelectedTag] = useState(initialFilters?.tagSlug || searchParams.get('tag') || '')
  const [sortBy, setSortBy] = useState<BlogPostSortBy>(
    (searchParams.get('sort') as BlogPostSortBy) || 'created_at'
  )
  const [sortOrder, setSortOrder] = useState<SortOrder>(
    (searchParams.get('order') as SortOrder) || 'desc'
  )
  const [dateRange, setDateRange] = useState({
    startDate: initialFilters?.startDate || searchParams.get('startDate') || '',
    endDate: initialFilters?.endDate || searchParams.get('endDate') || ''
  })

  const { data: categories } = useBlogCategories()
  const { data: tags } = useBlogTags()

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams()
    
    if (searchTerm) params.set('q', searchTerm)
    if (selectedCategory) params.set('category', selectedCategory)
    if (selectedTag) params.set('tag', selectedTag)
    if (sortBy !== 'created_at') params.set('sort', sortBy)
    if (sortOrder !== 'desc') params.set('order', sortOrder)
    if (dateRange.startDate) params.set('startDate', dateRange.startDate)
    if (dateRange.endDate) params.set('endDate', dateRange.endDate)

    setSearchParams(params, { replace: true })

    // Build filters object
    const filters: BlogPostFilters & { sort?: { by: BlogPostSortBy; order: SortOrder } } = {
      ...(searchTerm && { search: searchTerm }),
      ...(selectedCategory && { categorySlug: selectedCategory }),
      ...(selectedTag && { tagSlug: selectedTag }),
      ...(dateRange.startDate && { startDate: dateRange.startDate }),
      ...(dateRange.endDate && { endDate: dateRange.endDate }),
      sort: { by: sortBy, order: sortOrder }
    }

    onFiltersChange(filters)
  }, [searchTerm, selectedCategory, selectedTag, sortBy, sortOrder, dateRange, onFiltersChange, setSearchParams])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Search is handled by useEffect above
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedCategory('')
    setSelectedTag('')
    setSortBy('created_at')
    setSortOrder('desc')
    setDateRange({ startDate: '', endDate: '' })
  }

  const hasActiveFilters = searchTerm || selectedCategory || selectedTag || dateRange.startDate || dateRange.endDate

  const activeFiltersCount = [
    searchTerm,
    selectedCategory,
    selectedTag,
    dateRange.startDate,
    dateRange.endDate
  ].filter(Boolean).length

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search blog posts..."
            className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <Badge variant="info" className="text-xs">
                {activeFiltersCount}
              </Badge>
            )}
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Toggle filters"
            >
              <FunnelIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </form>

      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600">Active filters:</span>
          {searchTerm && (
            <Badge variant="neutral" className="flex items-center gap-1">
              <MagnifyingGlassIcon className="w-3 h-3" />
              "{searchTerm}"
              <button
                onClick={() => setSearchTerm('')}
                className="ml-1 hover:text-red-600"
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {selectedCategory && (
            <Badge variant="neutral" className="flex items-center gap-1">
              <FolderIcon className="w-3 h-3" />
              {categories?.find(c => c.slug === selectedCategory)?.name || selectedCategory}
              <button
                onClick={() => setSelectedCategory('')}
                className="ml-1 hover:text-red-600"
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {selectedTag && (
            <Badge variant="neutral" className="flex items-center gap-1">
              <TagIcon className="w-3 h-3" />
              {tags?.find(t => t.slug === selectedTag)?.name || selectedTag}
              <button
                onClick={() => setSelectedTag('')}
                className="ml-1 hover:text-red-600"
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {(dateRange.startDate || dateRange.endDate) && (
            <Badge variant="neutral" className="flex items-center gap-1">
              <CalendarIcon className="w-3 h-3" />
              {dateRange.startDate && dateRange.endDate
                ? `${dateRange.startDate} - ${dateRange.endDate}`
                : dateRange.startDate || dateRange.endDate}
              <button
                onClick={() => setDateRange({ startDate: '', endDate: '' })}
                className="ml-1 hover:text-red-600"
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-xs"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Advanced Filters */}
      {showFilters && (
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FolderIcon className="w-4 h-4 inline mr-1" />
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">All Categories</option>
                  {categories?.map((category) => (
                    <option key={category.id} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tag Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <TagIcon className="w-4 h-4 inline mr-1" />
                  Tag
                </label>
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">All Tags</option>
                  {tags?.map((tag) => (
                    <option key={tag.id} value={tag.slug}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort By */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sort By
                </label>
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [by, order] = e.target.value.split('-') as [BlogPostSortBy, SortOrder]
                    setSortBy(by)
                    setSortOrder(order)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="created_at-desc">Newest First</option>
                  <option value="created_at-asc">Oldest First</option>
                  <option value="title-asc">Title A-Z</option>
                  <option value="title-desc">Title Z-A</option>
                  <option value="published_at-desc">Recently Published</option>
                  <option value="updated_at-desc">Recently Updated</option>
                </select>
              </div>

              {/* Date Range */}
              <div className="md:col-span-2 lg:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <CalendarIcon className="w-4 h-4 inline mr-1" />
                  Date Range
                </label>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Start date"
                  />
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="End date"
                  />
                </div>
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
              <Button
                variant="ghost"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
              >
                Clear Filters
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowFilters(false)}
              >
                Close Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default BlogSearch