import { useParams, Link, Navigate } from 'react-router-dom'
import { useBlogPosts, useAuthorProfile, useBlogStatistics } from '../../hooks/useBlog'
import { Breadcrumb } from '../../components/blog/Breadcrumb'
import { useState } from 'react'
import { format } from 'date-fns'
import { 
  CalendarIcon, 
  UserIcon, 
  TagIcon,
  DocumentTextIcon,
  EyeIcon,
  ChatBubbleLeftIcon
} from '@heroicons/react/24/outline'
import type { BlogPostSort } from '../../types/blog'

export default function BlogAuthorPage() {
  const { slug } = useParams<{ slug: string }>()
  const [sortBy, setSortBy] = useState<BlogPostSort>({ by: 'published_at', order: 'desc' })
  const [currentPage, setCurrentPage] = useState(1)

  // For now, we'll treat the slug as user_id since we don't have a proper slug system for authors yet
  const { data: author, isLoading: authorLoading } = useAuthorProfile(slug || '')
  
  const { data: postsData, isLoading: postsLoading, error: postsError } = useBlogPosts({
    page: currentPage,
    limit: 12,
    filters: { 
      status: 'published',
      authorId: slug || ''
    },
    sort: sortBy,
    includeAuthor: true,
    includeCategories: true,
    includeTags: true
  })

  const { data: stats } = useBlogStatistics(slug || '')

  if (!slug) {
    return <Navigate to="/blog" replace />
  }

  if (authorLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-64 mb-6" />
          <div className="flex items-start space-x-6 mb-8">
            <div className="w-24 h-24 bg-gray-200 rounded-full" />
            <div className="flex-1">
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!author) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Author Not Found</h1>
          <p className="text-gray-600 mb-6">
            The author profile you're looking for doesn't exist.
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
    { label: author.display_name }
  ]

  if (postsError) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumb items={breadcrumbItems} className="mb-6" />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Posts</h1>
          <p className="text-gray-600">
            We're having trouble loading posts by this author. Please try again later.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbItems} className="mb-6" />

      {/* Author Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8">
        <div className="flex items-start space-x-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {author.avatar_url ? (
              <img
                src={author.avatar_url}
                alt={author.display_name}
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                <UserIcon className="h-12 w-12 text-gray-400" />
              </div>
            )}
          </div>

          {/* Author Info */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {author.display_name}
            </h1>

            {author.title && (
              <p className="text-lg text-primary-600 font-medium mb-3">
                {author.title}
              </p>
            )}

            {author.bio && (
              <p className="text-gray-600 mb-4 leading-relaxed">
                {author.bio}
              </p>
            )}

            {/* Social Links */}
            {author.social_links && Object.keys(author.social_links).length > 0 && (
              <div className="flex items-center space-x-4 mb-4">
                {Object.entries(author.social_links).map(([platform, url]) => (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-500 hover:text-primary-600 transition-colors capitalize font-medium"
                  >
                    {platform}
                  </a>
                ))}
              </div>
            )}

            {/* Stats */}
            {stats && (
              <div className="flex items-center space-x-6 text-sm text-gray-500">
                <div className="flex items-center">
                  <DocumentTextIcon className="h-4 w-4 mr-1" />
                  <span>{stats.publishedPosts} published posts</span>
                </div>
                {stats.totalViews > 0 && (
                  <div className="flex items-center">
                    <EyeIcon className="h-4 w-4 mr-1" />
                    <span>{stats.totalViews.toLocaleString()} total views</span>
                  </div>
                )}
                {stats.totalComments > 0 && (
                  <div className="flex items-center">
                    <ChatBubbleLeftIcon className="h-4 w-4 mr-1" />
                    <span>{stats.totalComments} comments</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Posts Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            Posts by {author.display_name}
          </h2>

          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              {postsData ? (
                <>
                  {postsData.meta.total} post{postsData.meta.total !== 1 ? 's' : ''}
                </>
              ) : (
                'Loading...'
              )}
            </div>

            <div className="flex items-center space-x-2">
              <label htmlFor="sort" className="text-sm font-medium text-gray-700">
                Sort by:
              </label>
              <select
                id="sort"
                value={`${sortBy.by}-${sortBy.order}`}
                onChange={(e) => {
                  const [by, order] = e.target.value.split('-') as [string, 'asc' | 'desc']
                  setSortBy({ by: by as BlogPostSort['by'], order })
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
          <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No posts yet</h3>
          <p className="text-gray-600 mb-6">
            {author.display_name} hasn't published any posts yet.
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
                    <time dateTime={post.published_at || post.created_at}>
                      {format(new Date(post.published_at || post.created_at), 'MMM d, yyyy')}
                    </time>
                    {post.view_count > 0 && (
                      <>
                        <span className="mx-2">•</span>
                        <EyeIcon className="h-4 w-4 mr-1" />
                        <span>{post.view_count} views</span>
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

                  {/* Categories */}
                  {post.categories && post.categories.length > 0 && (
                    <div className="flex items-center flex-wrap gap-2 mb-4">
                      {post.categories.slice(0, 2).map((category) => (
                        <Link
                          key={category.id}
                          to={`/blog/category/${category.slug}`}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors"
                        >
                          {category.name}
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Tags */}
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