import React from 'react'
import { Link } from 'react-router-dom'
import { CalendarIcon, UserIcon, TagIcon, ClockIcon } from '@heroicons/react/24/outline'
import { BlogPost } from '../../types/blog'
import { Card, CardContent } from '../common/Card'
import { Badge } from '../common/Badge'
import BlogLazyImage from './BlogLazyImage'

interface BlogPostCardProps {
  post: BlogPost
  showExcerpt?: boolean
  variant?: 'default' | 'compact' | 'featured'
  className?: string
}

export function BlogPostCard({ 
  post, 
  showExcerpt = true, 
  variant = 'default', 
  className = '' 
}: BlogPostCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getReadingTime = (content?: string) => {
    if (!content) return '5'
    const wordCount = content.split(/\s+/).length
    const wordsPerMinute = 200
    return Math.ceil(wordCount / wordsPerMinute).toString()
  }

  const getExcerpt = (content?: string, maxLength = 150) => {
    if (!content) return ''
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength).replace(/\s+\S*$/, '') + '...'
  }

  if (variant === 'compact') {
    return (
      <article className={`border-b border-gray-200 pb-4 mb-4 last:border-b-0 ${className}`}>
        <div className="flex flex-col sm:flex-row gap-4">
          {post.featured_image_url && (
            <div className="sm:w-32 sm:h-20 w-full h-48 flex-shrink-0">
              <BlogLazyImage
                src={post.featured_image_url}
                alt={post.title || post.title}
                aspectRatio="4:3"
                className="rounded-lg"
                sizes={[
                  { width: 320, quality: 80 },
                  { width: 640, quality: 80 }
                ]}
                placeholder="blur"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 hover:text-primary-600 transition-colors">
              <Link to={`/blog/${post.slug}`} className="block">
                {post.title}
              </Link>
            </h3>
            <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
              <span className="flex items-center gap-1">
                <CalendarIcon className="w-4 h-4" />
                {formatDate(post.published_at || post.created_at)}
              </span>
              <span className="flex items-center gap-1">
                <ClockIcon className="w-4 h-4" />
                {getReadingTime(post.content)} min read
              </span>
            </div>
          </div>
        </div>
      </article>
    )
  }

  if (variant === 'featured') {
    return (
      <Card className={`overflow-hidden hover:shadow-lg transition-shadow duration-300 ${className}`}>
        {post.featured_image_url && (
          <div className="h-64 sm:h-80 relative">
            <BlogLazyImage
              src={post.featured_image_url}
              alt={post.title || post.title}
              aspectRatio="16:9"
              sizes={[
                { width: 640, quality: 80 },
                { width: 768, quality: 80 },
                { width: 1024, quality: 85 }
              ]}
              placeholder="blur"
              priority={true}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 text-white">
              <h2 className="text-2xl sm:text-3xl font-bold mb-2 line-clamp-2">
                <Link to={`/blog/${post.slug}`} className="hover:text-primary-200 transition-colors">
                  {post.title}
                </Link>
              </h2>
              <div className="flex items-center gap-4 text-sm text-gray-200">
                {post.author && (
                  <span className="flex items-center gap-1">
                    <UserIcon className="w-4 h-4" />
                    {post.author?.user?.username || post.author?.user?.email || 'Unknown Author'}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <CalendarIcon className="w-4 h-4" />
                  {formatDate(post.published_at || post.created_at)}
                </span>
              </div>
            </div>
          </div>
        )}
        <CardContent className="p-6">
          {!post.featured_image_url && (
            <h2 className="text-2xl font-bold text-gray-900 mb-4 line-clamp-2">
              <Link to={`/blog/${post.slug}`} className="hover:text-primary-600 transition-colors">
                {post.title}
              </Link>
            </h2>
          )}
          {showExcerpt && (
            <p className="text-gray-600 mb-4 line-clamp-3">
              {post.excerpt || getExcerpt(post.content)}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {post.categories?.slice(0, 2).map((category) => (
              <Badge key={category.id} variant="secondary">
                <Link to={`/blog/category/${category.slug}`} className="hover:text-primary-600">
                  {category.name}
                </Link>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Default variant
  return (
    <Card className={`overflow-hidden hover:shadow-lg transition-shadow duration-300 ${className}`}>
      {post.featured_image_url && (
        <div className="h-48 sm:h-56 relative overflow-hidden">
          <BlogLazyImage
            src={post.featured_image_url}
            alt={post.title || post.title}
            aspectRatio="16:9"
            className="hover:scale-105 transition-transform duration-300"
            sizes={[
              { width: 400, quality: 80 },
              { width: 600, quality: 80 },
              { width: 800, quality: 85 }
            ]}
            placeholder="blur"
            lightbox={{ enabled: true, showZoomIcon: true }}
          />
        </div>
      )}
      <CardContent className="p-6">
        <div className="flex flex-wrap gap-2 mb-3">
          {post.categories?.slice(0, 2).map((category) => (
            <Badge key={category.id} variant="secondary" className="text-xs">
              <Link to={`/blog/category/${category.slug}`} className="hover:text-primary-600">
                {category.name}
              </Link>
            </Badge>
          ))}
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 line-clamp-2">
          <Link to={`/blog/${post.slug}`} className="hover:text-primary-600 transition-colors">
            {post.title}
          </Link>
        </h3>

        {showExcerpt && (
          <p className="text-gray-600 mb-4 line-clamp-3">
            {post.excerpt || getExcerpt(post.content)}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-gray-500">
            {post.author && (
              <span className="flex items-center gap-1">
                <UserIcon className="w-4 h-4" />
                <Link 
                  to={`/blog/author/${post.author.id}`}
                  className="hover:text-primary-600 transition-colors"
                >
                  {post.author?.user?.username || post.author?.user?.email || 'Unknown Author'}
                </Link>
              </span>
            )}
            <span className="flex items-center gap-1">
              <CalendarIcon className="w-4 h-4" />
              {formatDate(post.published_at || post.created_at)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <ClockIcon className="w-4 h-4" />
            {getReadingTime(post.content)} min read
          </div>
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
            <TagIcon className="w-4 h-4 text-gray-400" />
            <div className="flex flex-wrap gap-2">
              {post.tags.slice(0, 3).map((tag) => (
                <Link
                  key={tag.id}
                  to={`/blog/tag/${tag.slug}`}
                  className="text-sm text-gray-500 hover:text-primary-600 transition-colors"
                >
                  #{tag.name}
                </Link>
              ))}
              {post.tags.length > 3 && (
                <span className="text-sm text-gray-400">
                  +{post.tags.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default BlogPostCard