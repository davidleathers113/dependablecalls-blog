import { useParams, Link, Navigate } from 'react-router-dom'
import { useBlogPosts, useBlogCategory } from '../../hooks/useBlog'
import { Breadcrumb } from '../../components/blog/Breadcrumb'
import { useState } from 'react'
import { format } from 'date-fns'
import { 
  CalendarIcon, 
  UserIcon, 
  TagIcon,
  FolderIcon
} from '@heroicons/react/24/outline'
import type { BlogPostSort } from '../../types/blog'

export default function BlogCategoryPage() {
  const { slug } = useParams<{ slug: string }>()
  const [sortBy, setSortBy] = useState<BlogPostSort>({ by: 'published_at', order: 'desc' })
  const [currentPage, setCurrentPage] = useState(1)

  // Call hooks before any conditional returns
  const { data: category, isLoading: categoryLoading } = useBlogCategory(slug || '')
  
  const { data: postsData, isLoading: postsLoading, error: postsError } = useBlogPosts({
    page: currentPage,
    limit: 12,
    filters: { 
      status: 'published',
      categorySlug: slug || ''
    },
    sort: sortBy,
    includeAuthor: true,
    includeCategories: true,
    includeTags: true
  })

  // Conditional returns after hooks
  if (!slug) {
    return <Navigate to="/blog" replace />
  }

  if (categoryLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-64 mb-6" />
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-8" />
        </div>
      </div>
    )
  }

  if (!category) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Category Not Found</h1>
          <p className="text-gray-600 mb-6">
            The category you're looking for doesn't exist.
          </p>
          <Link
            to="/blog"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Back to Blog
          </Link>
        </div>
      </div>
    )
  }

  const breadcrumbItems = [
    { label: 'Blog', href: '/blog' },
    { label: category.name }
  ]

  if (postsError) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumb items={breadcrumbItems} className="mb-6" />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Posts</h1>
          <p className="text-gray-600">
            We're having trouble loading posts for this category. Please try again later.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbItems} className="mb-6" />

      {/* Category Header */}
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <FolderIcon className="h-8 w-8 text-primary-600 mr-3" />
          <h1 className="text-4xl font-bold text-gray-900">
            {category.name}
          </h1>
        </div>
        
        {category.description && (
          <p className="text-xl text-gray-600 max-w-3xl">
            {category.description}
          </p>
        )}

        {/* Post count and sort controls */}
        <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            {postsData ? (
              <>
                {postsData.meta.total} post{postsData.meta.total !== 1 ? 's' : ''} in this category
              </>
            ) : (
              'Loading...'
            )}
          </div>

          <div className="flex items-center space-x-4">
            <label htmlFor="sort" className="text-sm font-medium text-gray-700">
              Sort by:
            </label>
            <select
              id="sort"
              value={`${sortBy.by}-${sortBy.order}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split('-') as [string, 'asc' | 'desc']
                setSortBy({ by: by as 'published_at' | 'created_at' | 'updated_at' | 'title' | 'view_count', order })
                setCurrentPage(1)
              }}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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

      {/* Posts */}
      {postsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
          <FolderIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No posts in this category</h3>
          <p className="text-gray-600 mb-6">
            There are no published posts in the "{category.name}" category yet.
          </p>
          <Link
            to="/blog"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Browse all posts
          </Link>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
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

                  <h2 className="text-xl font-semibold text-gray-900 mb-3">
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
  )
}