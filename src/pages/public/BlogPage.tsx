import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useBlogPosts, useBlogCategories, usePopularTags } from '../../hooks/useBlog'
import { Breadcrumb } from '../../components/blog/Breadcrumb'
import { BlogErrorBoundary } from '../../components/blog/BlogErrorBoundary'
import type { BlogPostFilters, BlogPostSort } from '../../types/blog'
import { MagnifyingGlassIcon, CalendarIcon, UserIcon, TagIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'

export default function BlogPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<BlogPostSort>({ by: 'published_at', order: 'desc' })
  const [currentPage, setCurrentPage] = useState(1)

  // Build filters
  const filters: BlogPostFilters = useMemo(() => {
    const result: BlogPostFilters = { status: 'published' }
    
    if (searchQuery.trim()) {
      result.search = searchQuery.trim()
    }
    
    if (selectedCategory) {
      result.categorySlug = selectedCategory
    }
    
    if (selectedTag) {
      result.tagSlug = selectedTag
    }
    
    return result
  }, [searchQuery, selectedCategory, selectedTag])

  // Fetch data
  const { data: postsData, isLoading: postsLoading, error: postsError } = useBlogPosts({
    page: currentPage,
    limit: 12,
    filters,
    sort: sortBy,
    includeAuthor: true,
    includeCategories: true,
    includeTags: true
  })

  const { data: categories = [] } = useBlogCategories()
  const { data: popularTags = [] } = usePopularTags(10)

  const handleClearFilters = () => {
    setSearchQuery('')
    setSelectedCategory(null)
    setSelectedTag(null)
    setCurrentPage(1)
  }

  const breadcrumbItems = [
    { label: 'Blog', href: '/blog' }
  ]

  const activeFiltersCount = [searchQuery, selectedCategory, selectedTag].filter(Boolean).length

  if (postsError) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Blog</h1>
          <p className="text-gray-600">
            We're having trouble loading the blog posts. Please try again later.
          </p>
        </div>
      </div>
    )
  }

  return (
    <BlogErrorBoundary>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbItems} className="mb-6" />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          DCE Blog
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl">
          Insights, tips, and industry updates from the world of pay-per-call marketing.
          Stay informed with the latest trends and best practices.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar - Filters */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
              {activeFiltersCount > 0 && (
                <button
                  onClick={handleClearFilters}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Clear all ({activeFiltersCount})
                </button>
              )}
            </div>

            {/* Search */}
            <div className="mb-6">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  id="search"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1)
                  }}
                  placeholder="Search posts..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Categories */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Categories</h3>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setSelectedCategory(null)
                    setCurrentPage(1)
                  }}
                  className={`block w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                    !selectedCategory
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  All Categories
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => {
                      setSelectedCategory(category.slug)
                      setCurrentPage(1)
                    }}
                    className={`block w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                      selectedCategory === category.slug
                        ? 'bg-primary-50 text-primary-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Popular Tags */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Popular Tags</h3>
              <div className="flex flex-wrap gap-2">
                {popularTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => {
                      setSelectedTag(selectedTag === tag.slug ? null : tag.slug)
                      setCurrentPage(1)
                    }}
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedTag === tag.slug
                        ? 'bg-primary-100 text-primary-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tag.name} ({tag.count})
                  </button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Sort By</h3>
              <select
                value={`${sortBy.by}-${sortBy.order}`}
                onChange={(e) => {
                  const [by, order] = e.target.value.split('-') as [any, 'asc' | 'desc']
                  setSortBy({ by, order })
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="published_at-desc">Newest First</option>
                <option value="published_at-asc">Oldest First</option>
                <option value="title-asc">Title A-Z</option>
                <option value="title-desc">Title Z-A</option>
                <option value="view_count-desc">Most Popular</option>
              </select>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {postsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden animate-pulse">
                  <div className="h-48 bg-gray-200" />
                  <div className="p-6">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-4" />
                    <div className="h-3 bg-gray-200 rounded w-full mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : !postsData?.data.length ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No posts found</h3>
              <p className="text-gray-600 mb-4">
                {activeFiltersCount > 0
                  ? 'Try adjusting your filters to see more results.'
                  : 'No blog posts have been published yet.'}
              </p>
              {activeFiltersCount > 0 && (
                <button
                  onClick={handleClearFilters}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Results header */}
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-gray-600">
                  Showing {((postsData.meta.page - 1) * postsData.meta.limit) + 1} to{' '}
                  {Math.min(postsData.meta.page * postsData.meta.limit, postsData.meta.total)} of{' '}
                  {postsData.meta.total} posts
                </p>
              </div>

              {/* Posts Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {postsData.data.map((post) => (
                  <article
                    key={post.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200"
                  >
                    {post.featured_image_url && (
                      <div className="aspect-w-16 aspect-h-9">
                        <img
                          src={post.featured_image_url}
                          alt={post.title}
                          className="w-full h-48 object-cover"
                        />
                      </div>
                    )}
                    <div className="p-6">
                      <div className="flex items-center text-sm text-gray-500 mb-3">
                        <CalendarIcon className="h-4 w-4 mr-1" />
                        <time dateTime={post.published_at || post.created_at || ''}>
                          {format(new Date(post.published_at || post.created_at || new Date()), 'MMM d, yyyy')}
                        </time>
                        {post.author && (
                          <>
                            <span className="mx-2">•</span>
                            <UserIcon className="h-4 w-4 mr-1" />
                            <Link
                              to={`/blog/author/${post.author.id}`}
                              className="hover:text-primary-600 transition-colors"
                            >
                              {post.author.display_name}
                            </Link>
                          </>
                        )}
                      </div>

                      <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        <Link
                          to={`/blog/post/${post.slug}`}
                          className="hover:text-primary-600 transition-colors"
                        >
                          {post.title}
                        </Link>
                      </h2>

                      {post.excerpt && (
                        <p className="text-gray-600 mb-4 line-clamp-3">
                          {post.excerpt}
                        </p>
                      )}

                      {post.tags && post.tags.length > 0 && (
                        <div className="flex items-center flex-wrap gap-2 mb-4">
                          <TagIcon className="h-4 w-4 text-gray-400" />
                          {post.tags.slice(0, 3).map((tag) => (
                            <Link
                              key={tag.id}
                              to={`/blog?tag=${tag.slug}`}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                            >
                              {tag.name}
                            </Link>
                          ))}
                          {post.tags.length > 3 && (
                            <span className="text-xs text-gray-500">
                              +{post.tags.length - 3} more
                            </span>
                          )}
                        </div>
                      )}

                      <Link
                        to={`/blog/post/${post.slug}`}
                        className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
                      >
                        Read more →
                      </Link>
                    </div>
                  </article>
                ))}
              </div>

              {/* Pagination */}
              {postsData.meta.totalPages > 1 && (
                <div className="flex items-center justify-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={!postsData.meta.hasPreviousPage}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>

                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, postsData.meta.totalPages) }, (_, i) => {
                      const page = i + 1
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-2 text-sm font-medium rounded-md ${
                            page === currentPage
                              ? 'bg-primary-600 text-white'
                              : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      )
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={!postsData.meta.hasNextPage}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      </div>
    </BlogErrorBoundary>
  )
}