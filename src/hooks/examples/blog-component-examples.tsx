/**
 * Example implementations showing how to use the modal state hooks
 * with the specific blog components mentioned in the requirements.
 */

import React, { useCallback } from 'react'
import { useModalState } from '../useModalState'

// =============================================================================
// 1. BlogLazyImage - Lightbox Modal Example
// =============================================================================

interface LightboxImageProps {
  src: string
  alt: string
  lightboxEnabled?: boolean
}

export function BlogLazyImageExample({ src, alt, lightboxEnabled = true }: LightboxImageProps) {
  const lightboxModal = useModalState({
    closeOnEscape: true,
    closeOnClickOutside: true,
    lockBodyScroll: true,
    animationDuration: 300,
    onOpen: () => console.log('Lightbox opened'),
    onClose: () => console.log('Lightbox closed')
  })

  const handleImageClick = useCallback(() => {
    if (lightboxEnabled) {
      lightboxModal.open()
    }
  }, [lightboxEnabled, lightboxModal])

  return (
    <>
      <div className="relative group">
        <img
          src={src}
          alt={alt}
          className={`cursor-pointer transition-transform hover:scale-105 ${
            lightboxEnabled ? 'cursor-zoom-in' : ''
          }`}
          onClick={handleImageClick}
        />
        {lightboxEnabled && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-black bg-opacity-50 rounded-full p-2">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxModal.isOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={lightboxModal.close}
          role="dialog"
          aria-modal="true"
          aria-label={`Lightbox: ${alt}`}
        >
          <div className="relative max-w-full max-h-full">
            <img
              src={src}
              alt={alt}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="absolute top-4 right-4 text-white hover:text-gray-300 text-2xl"
              onClick={lightboxModal.close}
              aria-label="Close lightbox"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// =============================================================================
// 2. BlogShare - Share Panel Example
// =============================================================================

interface ShareData {
  url: string
  title: string
  description: string
}

const shareOptions = [
  { id: 'twitter', label: 'Twitter', icon: '🐦' },
  { id: 'facebook', label: 'Facebook', icon: '📘' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { id: 'copy', label: 'Copy Link', icon: '📋' }
]

export function BlogShareExample({ url, title, description }: ShareData) {
  const shareModal = useModalState<ShareData, HTMLDivElement>({
    closeOnEscape: true,
    closeOnClickOutside: true,
    lockBodyScroll: false,
    animationDuration: 200,
    content: { url, title, description }
  })

  const handleShare = useCallback((platform: string) => {
    const shareData = shareModal.content
    if (!shareData) return

    switch (platform) {
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareData.title)}&url=${encodeURIComponent(shareData.url)}`)
        break
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}`)
        break
      case 'linkedin':
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareData.url)}`)
        break
      case 'copy':
        navigator.clipboard.writeText(shareData.url)
        // Could show a toast notification here
        break
    }
    
    shareModal.close()
  }, [shareModal])

  return (
    <div className="relative">
      <button
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        onClick={() => shareModal.open()}
      >
        <span>📤</span>
        Share
      </button>

      {shareModal.isOpen && (
        <div 
          ref={shareModal.modalRef}
          className="absolute top-full mt-2 right-0 bg-white rounded-lg shadow-lg border p-2 min-w-48 z-10"
        >
          <div className="text-sm font-medium text-gray-900 mb-2 px-2">Share this post</div>
          {shareOptions.map((option) => (
            <button
              key={option.id}
              className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-gray-100 rounded-md"
              onClick={() => handleShare(option.id)}
            >
              <span>{option.icon}</span>
              <span className="text-sm">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// 3. BlogTags - Tag Creation Modal Example
// =============================================================================

interface CreateTagData {
  name: string
  description: string
  color: string
}

const tagColors = [
  { value: 'blue', label: 'Blue', class: 'bg-blue-100 text-blue-800' },
  { value: 'green', label: 'Green', class: 'bg-green-100 text-green-800' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-100 text-purple-800' },
  { value: 'red', label: 'Red', class: 'bg-red-100 text-red-800' }
]

export function BlogTagsExample() {
  const tagModal = useModalState<CreateTagData, HTMLDivElement>({
    closeOnEscape: true,
    lockBodyScroll: true,
    autoFocus: true,
    content: { name: '', description: '', color: 'blue' }
  })

  const handleCreateTag = useCallback(async () => {
    const tagData = tagModal.content
    if (!tagData || !tagData.name.trim()) return

    tagModal.showLoading()

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      console.log('Created tag:', tagData)
      tagModal.close()
      
      // Reset form
      tagModal.setContent({ name: '', description: '', color: 'blue' })
    } catch {
      tagModal.showError('Failed to create tag. Please try again.')
    }
  }, [tagModal])

  const updateTagData = useCallback((updates: Partial<CreateTagData>) => {
    const current = tagModal.content
    if (current) {
      tagModal.setContent({ ...current, ...updates })
    }
  }, [tagModal])

  return (
    <>
      <button
        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        onClick={() => tagModal.open()}
      >
        + Create Tag
      </button>

      {tagModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div 
            ref={tagModal.modalRef}
            className="bg-white rounded-lg p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            {tagModal.isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p>Creating tag...</p>
              </div>
            ) : tagModal.hasError ? (
              <div className="text-center py-8">
                <div className="text-red-600 mb-4">❌</div>
                <p className="text-red-600 mb-4">{tagModal.errorMessage || 'An error occurred'}</p>
                <div className="flex gap-2 justify-center">
                  <button
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    onClick={() => tagModal.open()}
                  >
                    Try Again
                  </button>
                  <button
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                    onClick={tagModal.close}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold mb-4">Create New Tag</h2>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="tag-name" className="block text-sm font-medium text-gray-700 mb-1">
                      Tag Name
                    </label>
                    <input
                      id="tag-name"
                      type="text"
                      value={tagModal.content?.name || ''}
                      onChange={(e) => updateTagData({ name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter tag name..."
                    />
                  </div>

                  <div>
                    <label htmlFor="tag-description" className="block text-sm font-medium text-gray-700 mb-1">
                      Description (optional)
                    </label>
                    <textarea
                      id="tag-description"
                      value={tagModal.content?.description || ''}
                      onChange={(e) => updateTagData({ description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="Describe this tag..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Color
                    </label>
                    <div className="flex gap-2">
                      {tagColors.map((color) => (
                        <button
                          key={color.value}
                          className={`px-3 py-1 rounded-full text-xs ${color.class} ${
                            tagModal.content?.color === color.value ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                          }`}
                          onClick={() => updateTagData({ color: color.value })}
                        >
                          {color.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end mt-6">
                  <button
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                    onClick={tagModal.close}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    onClick={handleCreateTag}
                    disabled={!tagModal.content?.name.trim()}
                  >
                    Create Tag
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// =============================================================================
// 4. BlogComments - Reply Form Modal Example
// =============================================================================

interface Comment {
  id: string
  author: string
  content: string
  timestamp: Date
  replies?: Comment[]
}

interface ReplyFormContent {
  commentId: string
  content: string
}

export function BlogCommentsExample({ comments }: { comments: Comment[] }) {
  const replyModal = useModalState<ReplyFormContent>({
    closeOnEscape: true,
    closeOnClickOutside: false, // Don't close while typing
    lockBodyScroll: false,
    autoFocus: true
  })

  const handleReply = useCallback((commentId: string) => {
    replyModal.setContent({ commentId, content: '' })
    replyModal.open()
  }, [replyModal])

  const handleSubmitReply = useCallback(async () => {
    const replyData = replyModal.content
    if (!replyData || !replyData.content.trim()) return

    replyModal.showLoading()

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      console.log('Posted reply:', replyData)
      replyModal.close()
    } catch {
      replyModal.showError('Failed to post reply. Please try again.')
    }
  }, [replyModal])

  const updateReplyContent = useCallback((content: string) => {
    const current = replyModal.content
    if (current) {
      replyModal.setContent({ ...current, content })
    }
  }, [replyModal])

  const isReplyingTo = useCallback((commentId: string) => {
    return replyModal.isOpen && 
           replyModal.content?.commentId === commentId
  }, [replyModal])

  const renderComment = (comment: Comment, depth = 0) => (
    <div key={comment.id} className={`${depth > 0 ? 'ml-8 mt-4' : 'mb-6'}`}>
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium text-gray-900">{comment.author}</div>
          <div className="text-sm text-gray-500">
            {comment.timestamp.toLocaleDateString()}
          </div>
        </div>
        
        <p className="text-gray-700 mb-3">{comment.content}</p>
        
        <div className="flex items-center gap-4">
          <button
            className="text-sm text-blue-600 hover:text-blue-800"
            onClick={() => handleReply(comment.id)}
          >
            Reply
          </button>
        </div>

        {/* Reply Form */}
        {isReplyingTo(comment.id) && (
          <div className="mt-4 p-4 bg-white rounded-lg border">
            {replyModal.isLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm">Posting reply...</p>
              </div>
            ) : (
              <>
                <textarea
                  value={replyModal.content?.content || ''}
                  onChange={(e) => updateReplyContent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder={`Reply to ${comment.author}...`}
                />
                <div className="flex gap-2 justify-end mt-3">
                  <button
                    className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                    onClick={replyModal.close}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    onClick={handleSubmitReply}
                    disabled={!replyModal.content?.content.trim()}
                  >
                    Post Reply
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Nested replies */}
      {comment.replies?.map(reply => renderComment(reply, depth + 1))}
    </div>
  )

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold">Comments</h3>
      {comments.map(comment => renderComment(comment))}
    </div>
  )
}

// =============================================================================
// 5. BlogNewsletter - Success Modal Example
// =============================================================================

interface NewsletterSuccessContent {
  email: string
  preferences: string[]
  timestamp: Date
}

export function BlogNewsletterExample() {
  const [email, setEmail] = React.useState('')
  const [preferences, setPreferences] = React.useState<string[]>([])
  
  const successModal = useModalState<NewsletterSuccessContent>({
    closeOnEscape: true,
    closeOnClickOutside: true,
    lockBodyScroll: false,
    animationDuration: 300
  })

  const handleSubscribe = useCallback(async () => {
    if (!email.trim()) return

    successModal.showLoading()

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const subscriptionData: NewsletterSuccessContent = {
        email,
        preferences,
        timestamp: new Date()
      }
      
      successModal.setContent(subscriptionData)
      successModal.open()
      
      // Auto-close after 4 seconds
      setTimeout(() => {
        successModal.close()
      }, 4000)

      // Reset form
      setEmail('')
      setPreferences([])
      
    } catch {
      successModal.showError('Failed to subscribe. Please try again.')
    }
  }, [email, preferences, successModal])

  const togglePreference = useCallback((pref: string) => {
    setPreferences(prev => 
      prev.includes(pref) 
        ? prev.filter(p => p !== pref)
        : [...prev, pref]
    )
  }, [])

  const availablePreferences = [
    { id: 'weekly', label: 'Weekly Newsletter' },
    { id: 'product', label: 'Product Updates' },
    { id: 'blog', label: 'New Blog Posts' }
  ]

  return (
    <>
      <div className="bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-bold text-blue-900 mb-2">
          Subscribe to our Newsletter
        </h3>
        <p className="text-blue-700 mb-4">
          Get the latest updates delivered to your inbox.
        </p>

        <div className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your email address"
            />
          </div>

          <div>
            <p className="text-sm font-medium text-blue-800 mb-2">Preferences:</p>
            <div className="space-y-2">
              {availablePreferences.map((pref) => (
                <label key={pref.id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferences.includes(pref.id)}
                    onChange={() => togglePreference(pref.id)}
                    className="mr-2 text-blue-600"
                  />
                  <span className="text-sm text-blue-700">{pref.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            onClick={handleSubscribe}
            disabled={!email.trim() || successModal.isLoading}
          >
            {successModal.isLoading ? 'Subscribing...' : 'Subscribe'}
          </button>
        </div>
      </div>

      {/* Success/Loading Modal */}
      {successModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div 
            className="bg-white rounded-lg p-6 w-full max-w-md text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {successModal.isLoading ? (
              <>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <h3 className="text-lg font-bold mb-2">Subscribing...</h3>
                <p className="text-gray-600">Please wait while we process your subscription.</p>
              </>
            ) : successModal.hasError ? (
              <>
                <div className="text-red-600 text-4xl mb-4">❌</div>
                <h3 className="text-lg font-bold text-red-600 mb-2">Subscription Failed</h3>
                <p className="text-gray-600 mb-4">
                  {successModal.errorMessage || 'An error occurred'}
                </p>
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  onClick={successModal.close}
                >
                  Try Again
                </button>
              </>
            ) : (
              <>
                <div className="text-green-600 text-4xl mb-4">✅</div>
                <h3 className="text-lg font-bold text-green-600 mb-2">Successfully Subscribed!</h3>
                <p className="text-gray-600 mb-4">
                  Thank you for subscribing with <strong>{successModal.content?.email}</strong>
                </p>
                {successModal.content?.preferences && successModal.content.preferences.length > 0 && (
                  <div className="text-sm text-gray-500 mb-4">
                    <p>Your preferences:</p>
                    <ul className="list-disc list-inside">
                      {successModal.content.preferences.map(pref => (
                        <li key={pref}>{availablePreferences.find(p => p.id === pref)?.label}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-xs text-gray-400">
                  This message will close automatically in a few seconds.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}