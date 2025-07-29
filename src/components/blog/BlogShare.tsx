import { useState, useEffect } from 'react'
import { 
  ShareIcon,
  LinkIcon,
  CheckIcon,
  EnvelopeIcon,
  PrinterIcon
} from '@heroicons/react/24/outline'
import { Button } from '../common/Button'
import { AccessibleIcon } from '../common/AccessibleIcon'
import { ErrorBoundary } from '../common/ErrorBoundary'

export interface BlogShareProps {
  /** The blog post URL to share */
  url: string
  /** The blog post title */
  title: string
  /** Optional description/excerpt for sharing */
  description?: string
  /** Display variant */
  variant?: 'buttons' | 'dropdown' | 'floating' | 'minimal'
  /** Button size */
  size?: 'sm' | 'md' | 'lg'
  /** Whether to show labels on buttons */
  showLabels?: boolean
  /** Which platforms to include */
  platforms?: ('twitter' | 'facebook' | 'linkedin' | 'reddit' | 'email' | 'copy' | 'print')[]
  /** Custom share message (for platforms that support it) */
  customMessage?: string
  /** Whether to track share events */
  trackShares?: boolean
  /** Called when a share action is performed */
  onShare?: (platform: string, url: string) => void
  /** Additional CSS classes */
  className?: string
}

interface SharePlatform {
  name: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  hoverColor: string
  getUrl: (url: string, title: string, description?: string, customMessage?: string) => string
  onClick?: (url: string, title: string, description?: string) => void
}

const getSharePlatforms = (): Record<string, SharePlatform> => ({
  twitter: {
    name: 'twitter',
    label: 'Twitter',
    icon: ({ className }) => (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    color: 'text-gray-700',
    hoverColor: 'hover:text-black',
    getUrl: (url, title, description, customMessage) => {
      const text = customMessage || `${title} ${description || ''}`.trim()
      return `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
    }
  },
  facebook: {
    name: 'facebook',
    label: 'Facebook',
    icon: ({ className }) => (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    color: 'text-blue-600',
    hoverColor: 'hover:text-blue-700',
    getUrl: (url) => {
      return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
    }
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
    hoverColor: 'hover:text-blue-800',
    getUrl: (url) => {
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
    }
  },
  reddit: {
    name: 'reddit',
    label: 'Reddit',
    icon: ({ className }) => (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
      </svg>
    ),
    color: 'text-orange-600',
    hoverColor: 'hover:text-orange-700',
    getUrl: (url, title) => {
      return `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`
    }
  },
  email: {
    name: 'email',
    label: 'Email',
    icon: EnvelopeIcon,
    color: 'text-gray-600',
    hoverColor: 'hover:text-gray-700',
    getUrl: (url, title, description, customMessage) => {
      const body = customMessage || `I thought you might be interested in this article: ${title}\n\n${description || ''}\n\n${url}`
      return `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`
    }
  },
  copy: {
    name: 'copy',
    label: 'Copy Link',
    icon: LinkIcon,
    color: 'text-gray-600',
    hoverColor: 'hover:text-gray-700',
    getUrl: () => '',
    onClick: async (url) => {
      try {
        await navigator.clipboard.writeText(url)
      } catch {
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = url
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
    }
  },
  print: {
    name: 'print',
    label: 'Print',
    icon: PrinterIcon,
    color: 'text-gray-600',
    hoverColor: 'hover:text-gray-700',
    getUrl: () => '',
    onClick: () => {
      window.print()
    }
  }
})

const ShareButton: React.FC<{
  platform: SharePlatform
  url: string
  title: string
  description?: string
  customMessage?: string
  size: 'sm' | 'md' | 'lg'
  showLabel: boolean
  trackShares: boolean
  onShare?: (platform: string, url: string) => void
}> = ({ 
  platform, 
  url, 
  title, 
  description, 
  customMessage, 
  size, 
  showLabel, 
  trackShares,
  onShare 
}) => {
  const [copied, setCopied] = useState(false)

  const handleClick = async () => {
    if (platform.onClick) {
      await platform.onClick(url, title, description)
      if (platform.name === 'copy') {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } else {
      const shareUrl = platform.getUrl(url, title, description, customMessage)
      window.open(shareUrl, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes')
    }

    if (trackShares && onShare) {
      onShare(platform.name, url)
    }
  }

  const iconSize = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  }

  const Icon = platform.name === 'copy' && copied ? CheckIcon : platform.icon

  return (
    <Button
      variant="outline"
      size={size}
      onClick={handleClick}
      className={`
        ${platform.color} ${platform.hoverColor}
        border-gray-300 hover:border-gray-400
        transition-colors duration-200
      `}
      leftIcon={showLabel ? <Icon className={iconSize[size]} /> : undefined}
      aria-label={`Share on ${platform.label}`}
    >
      {showLabel ? (
        copied ? 'Copied!' : platform.label
      ) : (
        <AccessibleIcon icon={Icon} className={iconSize[size]} />
      )}
    </Button>
  )
}

const FloatingShareButton: React.FC<{
  platforms: SharePlatform[]
  url: string
  title: string
  description?: string
  customMessage?: string
  size: 'sm' | 'md' | 'lg'
  trackShares: boolean
  onShare?: (platform: string, url: string) => void
}> = ({ platforms, url, title, description, customMessage, size, trackShares, onShare }) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <Button
        variant="primary"
        size={size}
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-full shadow-lg"
        leftIcon={<ShareIcon className="h-4 w-4" />}
        aria-label="Share options"
        aria-expanded={isOpen}
      />
      
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Share Options */}
          <div className="absolute bottom-full right-0 mb-2 z-20 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-max">
            <div className="flex flex-col space-y-2">
              {platforms.map((platform) => (
                <ShareButton
                  key={platform.name}
                  platform={platform}
                  url={url}
                  title={title}
                  description={description}
                  customMessage={customMessage}
                  size="sm"
                  showLabel={true}
                  trackShares={trackShares}
                  onShare={onShare}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const BlogShareInner: React.FC<BlogShareProps> = ({
  url,
  title,
  description,
  variant = 'buttons',
  size = 'md',
  showLabels = false,
  platforms = ['twitter', 'facebook', 'linkedin', 'email', 'copy'],
  customMessage,
  trackShares = false,
  onShare,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const sharePlatforms = getSharePlatforms()
  
  const availablePlatforms = platforms
    .map(name => sharePlatforms[name])
    .filter(Boolean)

  // Show floating button on scroll (for floating variant)
  useEffect(() => {
    if (variant !== 'floating') return

    const handleScroll = () => {
      const scrolled = window.scrollY > 200
      setIsVisible(scrolled)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [variant])

  if (variant === 'floating') {
    return (
      <div 
        className={`
          fixed bottom-6 right-6 z-50 transition-opacity duration-300
          ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}
          ${className}
        `}
      >
        <FloatingShareButton
          platforms={availablePlatforms}
          url={url}
          title={title}
          description={description}
          customMessage={customMessage}
          size={size}
          trackShares={trackShares}
          onShare={onShare}
        />
      </div>
    )
  }

  if (variant === 'dropdown') {
    return (
      <div className={`relative inline-block ${className}`}>
        <div className="group">
          <Button
            variant="outline"
            size={size}
            leftIcon={<ShareIcon className="h-4 w-4" />}
            className="group-hover:bg-gray-50"
          >
            Share
          </Button>
          
          <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-10 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-max">
            <div className="flex flex-col space-y-2">
              {availablePlatforms.map((platform) => (
                <ShareButton
                  key={platform.name}
                  platform={platform}
                  url={url}
                  title={title}
                  description={description}
                  customMessage={customMessage}
                  size="sm"
                  showLabel={true}
                  trackShares={trackShares}
                  onShare={onShare}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'minimal') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <span className="text-sm text-gray-600">Share:</span>
        <div className="flex space-x-1">
          {availablePlatforms.map((platform) => (
            <ShareButton
              key={platform.name}
              platform={platform}
              url={url}
              title={title}
              description={description}
              customMessage={customMessage}
              size="sm"
              showLabel={false}
              trackShares={trackShares}
              onShare={onShare}
            />
          ))}
        </div>
      </div>
    )
  }

  // Default 'buttons' variant
  return (
    <div className={`space-y-3 ${className}`}>
      <h4 className="text-sm font-medium text-gray-700 flex items-center">
        <AccessibleIcon icon={ShareIcon} className="h-4 w-4 mr-2" />
        Share this article
      </h4>
      
      <div className="flex flex-wrap gap-2">
        {availablePlatforms.map((platform) => (
          <ShareButton
            key={platform.name}
            platform={platform}
            url={url}
            title={title}
            description={description}
            customMessage={customMessage}
            size={size}
            showLabel={showLabels}
            trackShares={trackShares}
            onShare={onShare}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Blog Share Component
 * 
 * A comprehensive social sharing system supporting:
 * - Multiple social platforms (Twitter, Facebook, LinkedIn, Reddit, Email)
 * - Copy to clipboard functionality
 * - Print option
 * - Multiple display variants (buttons, dropdown, floating, minimal)
 * - Custom messages and descriptions
 * - Share tracking and analytics
 * - Accessibility features
 * - Responsive design
 * 
 * @example
 * ```tsx
 * <BlogShare
 *   url="https://example.com/blog/post"
 *   title="My Blog Post"
 *   description="An interesting article about..."
 *   variant="buttons"
 *   showLabels={true}
 *   platforms={['twitter', 'facebook', 'linkedin', 'copy']}
 *   onShare={(platform, url) => analytics.track('share', { platform, url })}
 * />
 * ```
 */
export const BlogShare: React.FC<BlogShareProps> = (props) => {
  return (
    <ErrorBoundary>
      <BlogShareInner {...props} />
    </ErrorBoundary>
  )
}

export default BlogShare