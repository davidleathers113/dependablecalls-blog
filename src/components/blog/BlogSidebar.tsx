import { Link } from 'react-router-dom'
import { TagIcon, FolderIcon, ClockIcon, ArrowTrendingUpIcon } from '@heroicons/react/24/outline'
import { useBlogCategories, useBlogPosts, usePopularTags } from '../../hooks/useBlog'
import { Card, CardHeader, CardContent } from '../common/Card'
import { Badge } from '../common/Badge'
import { BlogPostCard } from './BlogPostCard'

interface BlogSidebarProps {
  className?: string
  showRecentPosts?: boolean
  showCategories?: boolean
  showPopularTags?: boolean
  showStats?: boolean
  maxRecentPosts?: number
  maxCategories?: number
  maxTags?: number
}

export function BlogSidebar({
  className = '',
  showRecentPosts = true,
  showCategories = true,
  showPopularTags = true,
  showStats = false,
  maxRecentPosts = 5,
  maxCategories = 8,
  maxTags = 10
}: BlogSidebarProps) {
  const { data: categories, isLoading: categoriesLoading } = useBlogCategories()
  const { data: recentPostsData, isLoading: postsLoading } = useBlogPosts({
    limit: maxRecentPosts,
    sort: { by: 'created_at', order: 'desc' }
  })
  const { data: popularTags, isLoading: tagsLoading } = usePopularTags()

  const recentPosts = recentPostsData?.data || []

  return (
    <aside className={`space-y-6 ${className}`}>
      {/* Recent Posts */}
      {showRecentPosts && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Recent Posts</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {postsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex gap-3">
                      <div className="w-16 h-12 bg-gray-200 rounded flex-shrink-0"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : recentPosts.length > 0 ? (
              <div className="space-y-4">
                {recentPosts.map((post) => (
                  <BlogPostCard
                    key={post.id}
                    post={post}
                    variant="compact"
                    showExcerpt={false}
                  />
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No recent posts available.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Categories */}
      {showCategories && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FolderIcon className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Categories</h3>
            </div>
          </CardHeader>
          <CardContent>
            {categoriesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex items-center justify-between">
                      <div className="h-4 bg-gray-200 rounded w-24"></div>
                      <div className="h-4 bg-gray-200 rounded w-6"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : categories && categories.length > 0 ? (
              <div className="space-y-2">
                {categories.slice(0, maxCategories).map((category) => (
                  <div key={category.id} className="flex items-center justify-between">
                    <Link
                      to={`/blog/category/${category.slug}`}
                      className="text-gray-700 hover:text-primary-600 transition-colors text-sm font-medium"
                    >
                      {category.name}
                    </Link>
                    {category.postsCount !== undefined && (
                      <Badge variant="neutral" className="text-xs">
                        {category.postsCount}
                      </Badge>
                    )}
                  </div>
                ))}
                {categories.length > maxCategories && (
                  <Link
                    to="/blog/categories"
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium block mt-3"
                  >
                    View all categories →
                  </Link>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No categories available.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Popular Tags */}
      {showPopularTags && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ArrowTrendingUpIcon className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Popular Tags</h3>
            </div>
          </CardHeader>
          <CardContent>
            {tagsLoading ? (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-6 bg-gray-200 rounded-full w-16"></div>
                  </div>
                ))}
              </div>
            ) : popularTags && popularTags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {popularTags.slice(0, maxTags).map((tag) => (
                  <Link
                    key={tag.id}
                    to={`/blog/tag/${tag.slug}`}
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <TagIcon className="w-3 h-3" />
                    {tag.name}
                    {tag.count && (
                      <span className="text-gray-500">({tag.count})</span>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No popular tags available.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Blog Stats */}
      {showStats && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">Blog Statistics</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 text-sm">Total Posts</span>
                <span className="font-semibold text-gray-900">
                  {recentPostsData?.meta?.total || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 text-sm">Categories</span>
                <span className="font-semibold text-gray-900">
                  {categories?.length || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 text-sm">Tags</span>
                <span className="font-semibold text-gray-900">
                  {popularTags?.length || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Newsletter Signup */}
      <Card className="bg-gradient-to-br from-primary-50 to-primary-100 border-primary-200">
        <CardContent className="p-6 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Stay Updated
          </h3>
          <p className="text-gray-600 text-sm mb-4">
            Get the latest insights about pay-per-call marketing delivered to your inbox.
          </p>
          <div className="space-y-3">
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button className="w-full px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors">
              Subscribe
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            No spam. Unsubscribe at any time.
          </p>
        </CardContent>
      </Card>
    </aside>
  )
}

export default BlogSidebar