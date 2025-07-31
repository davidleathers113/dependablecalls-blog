import { useState } from 'react'
import { 
  UserCircleIcon,
  EnvelopeIcon,
  LinkIcon,
  MapPinIcon,
  CalendarIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import { Badge } from '../common/Badge'
import { AccessibleIcon } from '../common/AccessibleIcon'
import { ErrorBoundary } from '../common/ErrorBoundary'
import type { BlogAuthor } from '../../types/blog'

export interface BlogAuthorCardProps {
  /** Author information */
  author: BlogAuthor
  /** Display variant */
  variant?: 'default' | 'compact' | 'detailed' | 'inline'
  /** Whether to show social links */
  showSocialLinks?: boolean
  /** Whether to show author bio */
  showBio?: boolean
  /** Whether to show post count */
  showPostCount?: boolean
  /** Whether to show join date */
  showJoinDate?: boolean
  /** Whether to show location */
  showLocation?: boolean
  /** Whether to show contact button */
  showContactButton?: boolean
  /** Whether to show "View Profile" button */
  showProfileButton?: boolean
  /** Maximum bio length (characters) */
  maxBioLength?: number
  /** Called when contact button is clicked */
  onContact?: (author: BlogAuthor) => void
  /** Called when profile button is clicked */
  onViewProfile?: (author: BlogAuthor) => void
  /** Called when social link is clicked */
  onSocialClick?: (platform: string, url: string) => void
  /** Additional CSS classes */
  className?: string
}

interface SocialPlatform {
  name: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  hoverColor: string
}

const getSocialPlatforms = (): Record<string, SocialPlatform> => ({
  twitter: {
    name: 'twitter',
    label: 'Twitter',
    icon: ({ className }) => (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    color: 'text-gray-700',
    hoverColor: 'hover:text-black'
  },
  linkedin: {
    name: 'linkedin',
    label: 'LinkedIn',
    icon: ({ className }) => (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
    color: 'text-blue-700',
    hoverColor: 'hover:text-blue-800'
  },
  github: {
    name: 'github',
    label: 'GitHub',
    icon: ({ className }) => (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>
    ),
    color: 'text-gray-900',
    hoverColor: 'hover:text-black'
  },
  website: {
    name: 'website',
    label: 'Website',
    icon: LinkIcon,
    color: 'text-gray-600',
    hoverColor: 'hover:text-gray-800'
  }
})

const SocialLinks: React.FC<{
  socialLinks: Record<string, string>
  onSocialClick?: (platform: string, url: string) => void
  size?: 'sm' | 'md'
}> = ({ socialLinks, onSocialClick, size = 'md' }) => {
  const platforms = getSocialPlatforms()
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'

  return (
    <div className="flex space-x-3">
      {Object.entries(socialLinks).map(([platform, url]) => {
        const platformConfig = platforms[platform.toLowerCase()]
        if (!platformConfig || !url) return null

        const handleClick = () => {
          if (onSocialClick) {
            onSocialClick(platform, url)
          } else {
            window.open(url, '_blank', 'noopener,noreferrer')
          }
        }

        return (
          <button
            key={platform}
            onClick={handleClick}
            className={`
              ${platformConfig.color} ${platformConfig.hoverColor}
              transition-colors duration-200
            `}
            aria-label={`Visit ${platformConfig.label} profile`}
            title={platformConfig.label}
          >
            <AccessibleIcon icon={platformConfig.icon} className={iconSize} />
          </button>
        )
      })}
    </div>
  )
}

const AuthorAvatar: React.FC<{
  author: BlogAuthor
  size?: 'sm' | 'md' | 'lg'
  className?: string
}> = ({ author, size = 'md', className = '' }) => {
  const [imageError, setImageError] = useState(false)
  
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12', 
    lg: 'h-16 w-16'
  }
  
  const textSizes = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-xl'
  }

  if (author.avatar_url && !imageError) {
    return (
      <img
        src={author.avatar_url}
        alt={`${author.user?.username || author.user?.email || 'Author'} avatar`}
        className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
        onError={() => setImageError(true)}
      />
    )
  }

  return (
    <div className={`
      ${sizeClasses[size]} rounded-full bg-gray-200 flex items-center justify-center ${className}
    `}>
      <span className={`font-medium text-gray-600 ${textSizes[size]}`}>
        {(author.user?.username || author.user?.email || 'A').charAt(0).toUpperCase()}
      </span>
    </div>
  )
}

const BlogAuthorCardInner: React.FC<BlogAuthorCardProps> = ({
  author,
  variant = 'default',
  showSocialLinks = true,
  showBio = true,
  showPostCount = true,
  showJoinDate = false,
  showLocation = true,
  showContactButton = false,
  showProfileButton = false,
  maxBioLength = 200,
  onContact,
  onViewProfile,
  onSocialClick,
  className = ''
}) => {
  const [showFullBio, setShowFullBio] = useState(false)

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long'
    }).format(new Date(dateString))
  }

  const truncateBio = (bio: string, maxLength: number) => {
    if (bio.length <= maxLength) return bio
    return bio.substring(0, maxLength).trim() + '...'
  }

  const displayBio = showFullBio || !maxBioLength 
    ? author.bio 
    : truncateBio(author.bio || '', maxBioLength)

  const shouldShowReadMore = author.bio && author.bio.length > maxBioLength && !showFullBio

  if (variant === 'inline') {
    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        <AuthorAvatar author={author} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium text-gray-900 truncate">
              {author.user?.username || author.user?.email || 'Unknown Author'}
            </p>
            {showPostCount && author.postsCount && (
              <Badge variant="neutral" className="text-xs">
                {author.postsCount} posts
              </Badge>
            )}
          </div>
          {author.title && (
            <p className="text-xs text-gray-500 truncate">{author.title}</p>
          )}
        </div>
        {showSocialLinks && author.social_links && (
          <SocialLinks 
            socialLinks={author.social_links as Record<string, string>} 
            onSocialClick={onSocialClick}
            size="sm"
          />
        )}
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <Card variant="bordered" padding="md" className={`${className}`}>
        <div className="flex items-start space-x-4">
          <AuthorAvatar author={author} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  {author.user?.username || author.user?.email || 'Unknown Author'}
                </h3>
                {author.title && (
                  <p className="text-sm text-gray-600">{author.title}</p>
                )}
              </div>
              {showPostCount && author.postsCount && (
                <Badge variant="neutral">
                  {author.postsCount} posts
                </Badge>
              )}
            </div>
            
            {showBio && author.bio && (
              <p className="mt-2 text-sm text-gray-700 line-clamp-2">
                {displayBio}
              </p>
            )}
            
            <div className="mt-3 flex items-center justify-between">
              {showSocialLinks && author.social_links && (
                <SocialLinks 
                  socialLinks={author.social_links as Record<string, string>} 
                  onSocialClick={onSocialClick}
                />
              )}
              
              {(showContactButton || showProfileButton) && (
                <div className="flex space-x-2">
                  {showContactButton && onContact && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onContact(author)}
                      leftIcon={<EnvelopeIcon className="w-4 h-4" />}
                    >
                      Contact
                    </Button>
                  )}
                  {showProfileButton && onViewProfile && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onViewProfile(author)}
                    >
                      View Profile
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    )
  }

  if (variant === 'detailed') {
    return (
      <Card variant="elevated" padding="lg" className={`${className}`}>
        {/* Header */}
        <div className="flex items-start space-x-6">
          <AuthorAvatar author={author} size="lg" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {author.user?.username || author.user?.email || 'Unknown Author'}
                </h2>
                {author.title && (
                  <p className="text-lg text-gray-600 mt-1">{author.title}</p>
                )}
              </div>
              {showPostCount && author.postsCount && (
                <Badge variant="info" className="text-sm">
                  {author.postsCount} articles published
                </Badge>
              )}
            </div>

            {/* Meta Information */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-500">
              {showJoinDate && author.created_at && (
                <div className="flex items-center">
                  <AccessibleIcon icon={CalendarIcon} className="h-4 w-4 mr-1" />
                  <span>Joined {formatDate(author.created_at)}</span>
                </div>
              )}
              
              {showLocation && author.location && (
                <div className="flex items-center">
                  <AccessibleIcon icon={MapPinIcon} className="h-4 w-4 mr-1" />
                  <span>{author.location}</span>
                </div>
              )}
              
              {author.email && (
                <div className="flex items-center">
                  <AccessibleIcon icon={EnvelopeIcon} className="h-4 w-4 mr-1" />
                  <span>{author.email}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bio */}
        {showBio && author.bio && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
              <AccessibleIcon icon={UserCircleIcon} className="h-4 w-4 mr-2" />
              About
            </h3>
            <div className="prose prose-sm max-w-none">
              <p className="text-gray-700 leading-relaxed">
                {displayBio}
              </p>
              {shouldShowReadMore && (
                <button
                  onClick={() => setShowFullBio(true)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium mt-2"
                >
                  Read more
                </button>
              )}
            </div>
          </div>
        )}

        {/* Social Links */}
        {showSocialLinks && author.social_links && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Connect
            </h3>
            <SocialLinks 
              socialLinks={author.social_links as Record<string, string>} 
              onSocialClick={onSocialClick}
            />
          </div>
        )}

        {/* Action Buttons */}
        {(showContactButton || showProfileButton) && (
          <div className="mt-6 flex space-x-3">
            {showContactButton && onContact && (
              <Button
                variant="primary"
                onClick={() => onContact(author)}
                leftIcon={<EnvelopeIcon className="w-4 h-4" />}
              >
                Contact {author.user?.username || author.user?.email || 'Author'}
              </Button>
            )}
            {showProfileButton && onViewProfile && (
              <Button
                variant="outline"
                onClick={() => onViewProfile(author)}
                leftIcon={<DocumentTextIcon className="w-4 h-4" />}
              >
                View All Articles
              </Button>
            )}
          </div>
        )}
      </Card>
    )
  }

  // Default variant
  return (
    <Card variant="bordered" padding="md" className={`${className}`}>
      <div className="flex items-start space-x-4">
        <AuthorAvatar author={author} size="md" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {author.user?.username || author.user?.email || 'Unknown Author'}
              </h3>
              {author.title && (
                <p className="text-sm text-gray-600">{author.title}</p>
              )}
            </div>
            {showPostCount && author.postsCount && (
              <Badge variant="neutral">
                {author.postsCount} posts
              </Badge>
            )}
          </div>

          {showBio && author.bio && (
            <div className="mb-4">
              <p className="text-sm text-gray-700 leading-relaxed">
                {displayBio}
              </p>
              {shouldShowReadMore && (
                <button
                  onClick={() => setShowFullBio(true)}
                  className="text-blue-600 hover:text-blue-700 text-sm mt-1"
                >
                  Read more
                </button>
              )}
            </div>
          )}

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mb-3">
            {showJoinDate && author.created_at && (
              <span>Joined {formatDate(author.created_at)}</span>
            )}
            {showLocation && author.location && (
              <span>{author.location}</span>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            {showSocialLinks && author.social_links && (
              <SocialLinks 
                socialLinks={author.social_links as Record<string, string>} 
                onSocialClick={onSocialClick}
              />
            )}
            
            {(showContactButton || showProfileButton) && (
              <div className="flex space-x-2">
                {showContactButton && onContact && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onContact(author)}
                  >
                    Contact
                  </Button>
                )}
                {showProfileButton && onViewProfile && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onViewProfile(author)}
                  >
                    View Profile
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

/**
 * Blog Author Card Component
 * 
 * A comprehensive author display component supporting:
 * - Multiple display variants (default, compact, detailed, inline)
 * - Author avatars with fallback initials
 * - Social media links integration
 * - Bio text with read more functionality
 * - Post counts and author statistics
 * - Contact and profile view actions
 * - Responsive design
 * - Accessibility features
 * 
 * @example
 * ```tsx
 * <BlogAuthorCard
 *   author={authorData}
 *   variant="detailed"
 *   showSocialLinks={true}
 *   showBio={true}
 *   showPostCount={true}
 *   showContactButton={true}
 *   onContact={(author) => openContactModal(author)}
 *   onViewProfile={(author) => navigateToProfile(author.id)}
 * />
 * ```
 */
export const BlogAuthorCard: React.FC<BlogAuthorCardProps> = (props) => {
  return (
    <ErrorBoundary>
      <BlogAuthorCardInner {...props} />
    </ErrorBoundary>
  )
}

export default BlogAuthorCard