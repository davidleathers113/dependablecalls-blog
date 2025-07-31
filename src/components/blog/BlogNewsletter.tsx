import { useState } from 'react'
import { 
  EnvelopeIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  UserGroupIcon,
  BellIcon
} from '@heroicons/react/24/outline'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import { Input } from '../common/Input'
import { AccessibleIcon } from '../common/AccessibleIcon'
import { ErrorBoundary } from '../common/ErrorBoundary'

export interface BlogNewsletterProps {
  /** Display variant */
  variant?: 'default' | 'minimal' | 'sidebar' | 'modal' | 'inline'
  /** Newsletter name/title */
  title?: string
  /** Newsletter description */
  description?: string
  /** Placeholder text for email input */
  emailPlaceholder?: string
  /** Button text */
  buttonText?: string
  /** Success message after subscription */
  successMessage?: string
  /** Whether to show subscriber count */
  showSubscriberCount?: boolean
  /** Current subscriber count */
  subscriberCount?: number
  /** Whether to show frequency information */
  showFrequency?: boolean
  /** Newsletter frequency text */
  frequency?: string
  /** Whether to show features/benefits */
  showFeatures?: boolean
  /** List of newsletter features */
  features?: string[]
  /** Whether to include privacy notice */
  showPrivacyNotice?: boolean
  /** Privacy notice text */
  privacyNotice?: string
  /** Whether to require double opt-in */
  requireDoubleOptIn?: boolean
  /** Called when subscription is submitted */
  onSubscribe?: (email: string, metadata?: Record<string, unknown>) => Promise<void>
  /** Called when subscription succeeds */
  onSuccess?: (email: string) => void
  /** Called when subscription fails */
  onError?: (error: string) => void
  /** Additional CSS classes */
  className?: string
}

const validateEmail = (email: string): boolean => {
  // Using safe string methods instead of regex to avoid ReDoS attacks
  if (!email || typeof email !== 'string') return false
  
  // Basic format checks using string methods
  const trimmedEmail = email.trim()
  if (trimmedEmail.length === 0 || trimmedEmail.length > 254) return false
  
  // Must contain exactly one @ symbol
  const atIndex = trimmedEmail.indexOf('@')
  if (atIndex === -1 || atIndex !== trimmedEmail.lastIndexOf('@')) return false
  
  // Split into local and domain parts
  const localPart = trimmedEmail.substring(0, atIndex)
  const domainPart = trimmedEmail.substring(atIndex + 1)
  
  // Basic validation using string methods
  if (localPart.length === 0 || localPart.length > 64) return false
  if (domainPart.length === 0 || domainPart.length > 253) return false
  
  // Domain must contain at least one dot and have valid structure
  const dotIndex = domainPart.indexOf('.')
  if (dotIndex === -1 || dotIndex === 0 || dotIndex === domainPart.length - 1) return false
  
  // Check for consecutive dots
  if (domainPart.includes('..')) return false
  
  // Basic character validation using string methods
  const hasValidChars = (str: string) => {
    for (let i = 0; i < str.length; i++) {
      const char = str.charAt(i)
      const code = char.charCodeAt(0)
      
      // Allow alphanumeric, dots, hyphens, and common email symbols
      if (!(
        (code >= 48 && code <= 57) || // 0-9
        (code >= 65 && code <= 90) || // A-Z
        (code >= 97 && code <= 122) || // a-z
        char === '.' || char === '-' || char === '_' ||
        (str === localPart && (char === '+' || char === '='))
      )) {
        return false
      }
    }
    return true
  }
  
  // Remove special characters for validation by filtering them out
  const cleanLocal = localPart.split('').filter(c => c !== '.' && c !== '+' && c !== '_' && c !== '=' && c !== '-').join('')
  const cleanDomain = domainPart.split('').filter(c => c !== '.' && c !== '-').join('')
  
  return hasValidChars(cleanLocal) && hasValidChars(cleanDomain)
}

const NewsletterFeatures: React.FC<{
  features: string[]
  variant: string
}> = ({ features, variant }) => {
  if (!features.length) return null

  const iconSize = variant === 'sidebar' ? 'h-3 w-3' : 'h-4 w-4'
  const textSize = variant === 'sidebar' ? 'text-xs' : 'text-sm'

  return (
    <div className={`space-y-2 ${variant === 'sidebar' ? 'mt-3' : 'mt-4'}`}>
      {features.map((feature, index) => (
        <div key={index} className="flex items-center text-gray-600">
          <AccessibleIcon icon={CheckCircleIcon} className={`${iconSize} mr-2 text-green-500 flex-shrink-0`} />
          <span className={textSize}>{feature}</span>
        </div>
      ))}
    </div>
  )
}

const SubscriberCount: React.FC<{
  count: number
  variant: string
}> = ({ count, variant }) => {
  const formatCount = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const iconSize = variant === 'sidebar' ? 'h-3 w-3' : 'h-4 w-4'
  const textSize = variant === 'sidebar' ? 'text-xs' : 'text-sm'

  return (
    <div className={`flex items-center text-gray-600 ${textSize}`}>
      <AccessibleIcon icon={UserGroupIcon} className={`${iconSize} mr-2`} />
      <span>
        Join {formatCount(count)} subscribers
      </span>
    </div>
  )
}

const BlogNewsletterInner: React.FC<BlogNewsletterProps> = ({
  variant = 'default',
  title = 'Subscribe to our newsletter',
  description = 'Get the latest posts delivered right to your inbox',
  emailPlaceholder = 'Enter your email address',
  buttonText = 'Subscribe',
  successMessage = 'Thanks for subscribing! Check your email to confirm.',
  showSubscriberCount = false,
  subscriberCount = 0,
  showFrequency = true,
  frequency = 'Weekly digest, no spam',
  showFeatures = false,
  features = [],
  showPrivacyNotice = true,
  privacyNotice = 'We respect your privacy. Unsubscribe at any time.',
  requireDoubleOptIn = true,
  onSubscribe,
  onSuccess,
  onError,
  className = ''
}) => {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setError(null)

    // Validate email
    if (!validateEmail(email)) {
      setError('Please enter a valid email address')
      return
    }

    setIsSubmitting(true)

    try {
      if (onSubscribe) {
        await onSubscribe(email, {
          source: 'blog_newsletter',
          variant,
          doubleOptIn: requireDoubleOptIn,
          timestamp: new Date().toISOString()
        })
      } else {
        // TODO: Default API call
        // await subscribeToNewsletter({ email, source: 'blog' })
        
        // Simulate API call for development
        await new Promise(resolve => setTimeout(resolve, 1500))
      }

      setIsSubscribed(true)
      setEmail('')
      onSuccess?.(email)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to subscribe. Please try again.'
      setError(errorMessage)
      onError?.(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Success state
  if (isSubscribed) {
    const successContent = (
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <AccessibleIcon icon={CheckCircleIcon} className="h-12 w-12 text-green-500" />
        </div>
        <div>
          <h3 className={`font-semibold text-gray-900 ${
            variant === 'sidebar' ? 'text-sm' : 'text-lg'
          }`}>
            {requireDoubleOptIn ? 'Check your email!' : 'You\'re subscribed!'}
          </h3>
          <p className={`text-gray-600 ${
            variant === 'sidebar' ? 'text-xs mt-1' : 'text-sm mt-2'
          }`}>
            {requireDoubleOptIn 
              ? 'We sent you a confirmation link. Click it to complete your subscription.'
              : successMessage
            }
          </p>
        </div>
        <Button
          variant="outline"
          size={variant === 'sidebar' ? 'sm' : 'md'}
          onClick={() => setIsSubscribed(false)}
          className="mt-4"
        >
          Subscribe Another Email
        </Button>
      </div>
    )

    if (variant === 'minimal' || variant === 'inline') {
      return <div className={className}>{successContent}</div>
    }

    return (
      <Card variant="bordered" padding="md" className={className}>
        {successContent}
      </Card>
    )
  }

  // Form content
  const formContent = (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <div className="flex justify-center mb-3">
          <AccessibleIcon 
            icon={variant === 'sidebar' ? BellIcon : SparklesIcon} 
            className={`text-blue-500 ${variant === 'sidebar' ? 'h-5 w-5' : 'h-8 w-8'}`} 
          />
        </div>
        <h3 className={`font-semibold text-gray-900 ${
          variant === 'sidebar' ? 'text-sm' : variant === 'minimal' ? 'text-base' : 'text-lg'
        }`}>
          {title}
        </h3>
        {description && (
          <p className={`text-gray-600 ${
            variant === 'sidebar' ? 'text-xs mt-1' : 'text-sm mt-2'
          }`}>
            {description}
          </p>
        )}
      </div>

      {/* Stats */}
      {(showSubscriberCount || showFrequency) && (
        <div className={`flex items-center justify-center space-x-4 ${
          variant === 'sidebar' ? 'text-xs' : 'text-sm'
        } text-gray-500`}>
          {showSubscriberCount && subscriberCount > 0 && (
            <SubscriberCount count={subscriberCount} variant={variant} />
          )}
          {showFrequency && frequency && (
            <div className="flex items-center">
              <AccessibleIcon 
                icon={BellIcon} 
                className={`${variant === 'sidebar' ? 'h-3 w-3' : 'h-4 w-4'} mr-1`} 
              />
              <span>{frequency}</span>
            </div>
          )}
        </div>
      )}

      {/* Features */}
      {showFeatures && features.length > 0 && (
        <NewsletterFeatures features={features} variant={variant} />
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className={`flex ${variant === 'sidebar' || variant === 'minimal' ? 'flex-col space-y-2' : 'flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2'}`}>
          <div className="flex-1">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={emailPlaceholder}
              leftIcon={<EnvelopeIcon className="w-4 h-4" />}
              error={error || undefined}
              disabled={isSubmitting}
              required
              className="w-full"
              aria-label="Email address for newsletter subscription"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size={variant === 'sidebar' ? 'sm' : 'md'}
            loading={isSubmitting}
            disabled={!email.trim() || isSubmitting}
            className={variant === 'sidebar' || variant === 'minimal' ? 'w-full' : 'flex-shrink-0'}
          >
            {buttonText}
          </Button>
        </div>

        {error && (
          <div className="flex items-center text-red-600 text-xs">
            <AccessibleIcon icon={ExclamationTriangleIcon} className="h-4 w-4 mr-1 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </form>

      {/* Privacy Notice */}
      {showPrivacyNotice && privacyNotice && (
        <p className={`text-center text-gray-500 ${
          variant === 'sidebar' ? 'text-xs' : 'text-xs'
        }`}>
          {privacyNotice}
        </p>
      )}
    </div>
  )

  // Variant-specific rendering
  if (variant === 'minimal' || variant === 'inline') {
    return (
      <div className={className}>
        {formContent}
      </div>
    )
  }

  if (variant === 'modal') {
    return (
      <div className={`bg-white rounded-lg shadow-xl max-w-md w-full ${className}`}>
        <div className="p-6">
          {formContent}
        </div>
      </div>
    )
  }

  return (
    <Card 
      variant={variant === 'sidebar' ? 'bordered' : 'elevated'} 
      padding={variant === 'sidebar' ? 'md' : 'lg'} 
      className={className}
    >
      {formContent}
    </Card>
  )
}

/**
 * Blog Newsletter Component
 * 
 * A comprehensive email subscription system supporting:
 * - Multiple display variants (default, minimal, sidebar, modal, inline)
 * - Email validation and error handling
 * - Double opt-in support
 * - Subscriber count display
 * - Feature highlights
 * - Privacy notices
 * - Success/error states
 * - Accessibility features
 * - Customizable messaging
 * 
 * Features:
 * - Safe email validation without regex
 * - Configurable subscription flow
 * - GDPR-compliant privacy notices
 * - Mobile-responsive design
 * - Loading states and error handling
 * - Subscription analytics support
 * 
 * @example
 * ```tsx
 * <BlogNewsletter
 *   variant="default"
 *   title="Stay Updated"
 *   description="Get our latest articles delivered to your inbox"
 *   showSubscriberCount={true}
 *   subscriberCount={1250}
 *   showFeatures={true}
 *   features={[
 *     'Weekly digest of best articles',
 *     'Exclusive subscriber-only content',
 *     'No spam, unsubscribe anytime'
 *   ]}
 *   onSubscribe={async (email) => {
 *     await api.subscribeToNewsletter(email)
 *   }}
 *   onSuccess={(email) => {
 *     analytics.track('newsletter_subscribe', { email })
 *   }}
 * />
 * ```
 */
export const BlogNewsletter: React.FC<BlogNewsletterProps> = (props) => {
  return (
    <ErrorBoundary>
      <BlogNewsletterInner {...props} />
    </ErrorBoundary>
  )
}

export default BlogNewsletter