import { useState, useEffect, useMemo } from 'react'
import { MagnifyingGlassIcon, XMarkIcon, TagIcon } from '@heroicons/react/24/outline'
import { Button } from '../common/Button'
import { Badge } from '../common/Badge'
import { Input } from '../common/Input'
import { Loading } from '../common/Loading'
import { ErrorBoundary } from '../common/ErrorBoundary'
import { AccessibleIcon } from '../common/AccessibleIcon'
import type { BlogTag, PopularTag } from '../../types/blog'

export interface BlogTagsProps {
  /** Current selected tags */
  selectedTags?: string[]
  /** Available tags to choose from */
  availableTags?: BlogTag[]
  /** Whether to show popular tags section */
  showPopularTags?: boolean
  /** Maximum number of popular tags to show */
  maxPopularTags?: number
  /** Whether tags are clickable/filterable */
  interactive?: boolean
  /** Display variant */
  variant?: 'default' | 'compact' | 'cloud'
  /** Maximum number of tags to display initially */
  maxDisplayTags?: number
  /** Whether to show tag counts */
  showCounts?: boolean
  /** Whether to allow tag creation (for editors) */
  allowCreation?: boolean
  /** Called when tag selection changes */
  onTagChange?: (selectedTags: string[]) => void
  /** Called when a new tag is created */
  onTagCreate?: (tagName: string) => void
  /** Custom empty state message */
  emptyStateMessage?: string
  /** Additional CSS classes */
  className?: string
}

interface TagCloudProps {
  tags: (BlogTag | PopularTag)[]
  selectedTags: string[]
  interactive: boolean
  showCounts: boolean
  onTagClick: (tagId: string, tagName: string) => void
}

const TagCloud: React.FC<TagCloudProps> = ({
  tags,
  selectedTags,
  interactive,
  showCounts,
  onTagClick,
}) => {
  const sortedTags = useMemo(() => {
    return tags.sort((a, b) => {
      const aCount = 'count' in a ? a.count : 'postsCount' in a ? a.postsCount || 0 : 0
      const bCount = 'count' in b ? b.count : 'postsCount' in b ? b.postsCount || 0 : 0
      return bCount - aCount
    })
  }, [tags])

  const getTagSize = (tag: BlogTag | PopularTag) => {
    const count = 'count' in tag ? tag.count : 'postsCount' in tag ? tag.postsCount || 0 : 0
    const maxCount = Math.max(
      ...sortedTags.map((t) => ('count' in t ? t.count : 'postsCount' in t ? t.postsCount || 0 : 0))
    )
    const minCount = Math.min(
      ...sortedTags.map((t) => ('count' in t ? t.count : 'postsCount' in t ? t.postsCount || 0 : 0))
    )

    if (maxCount === minCount) return 'text-base'

    const ratio = (count - minCount) / (maxCount - minCount)
    if (ratio > 0.8) return 'text-xl font-semibold'
    if (ratio > 0.6) return 'text-lg font-medium'
    if (ratio > 0.4) return 'text-base'
    if (ratio > 0.2) return 'text-sm'
    return 'text-xs'
  }

  return (
    <div className="flex flex-wrap gap-2">
      {sortedTags.map((tag) => {
        const isSelected = selectedTags.includes(tag.id)
        const sizeClass = getTagSize(tag)
        const count = 'count' in tag ? tag.count : 'postsCount' in tag ? tag.postsCount || 0 : 0

        return (
          <span
            key={tag.id}
            className={`
              ${sizeClass}
              ${interactive ? 'cursor-pointer hover:text-blue-600' : ''}
              ${isSelected ? 'text-blue-600 font-semibold' : 'text-gray-600'}
              transition-colors duration-200
            `}
            onClick={() => interactive && onTagClick(tag.id, tag.name)}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            onKeyDown={(e) => {
              if (interactive && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                onTagClick(tag.id, tag.name)
              }
            }}
            aria-label={`${isSelected ? 'Remove' : 'Add'} ${tag.name} tag filter`}
          >
            #{tag.name}
            {showCounts && count > 0 && (
              <span className="ml-1 text-xs text-gray-400">({count})</span>
            )}
          </span>
        )
      })}
    </div>
  )
}

interface TagInputProps {
  availableTags: BlogTag[]
  selectedTags: string[]
  allowCreation: boolean
  onTagChange: (selectedTags: string[]) => void
  onTagCreate?: (tagName: string) => void
}

const TagInput: React.FC<TagInputProps> = ({
  availableTags,
  selectedTags,
  allowCreation,
  onTagChange,
  onTagCreate,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const filteredTags = useMemo(() => {
    if (!searchTerm) return availableTags.slice(0, 10)
    return availableTags
      .filter(
        (tag) =>
          tag.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !selectedTags.includes(tag.id)
      )
      .slice(0, 10)
  }, [availableTags, searchTerm, selectedTags])

  const handleTagSelect = (tagId: string) => {
    if (!selectedTags.includes(tagId)) {
      onTagChange([...selectedTags, tagId])
    }
    setSearchTerm('')
    setShowSuggestions(false)
  }

  const handleTagRemove = (tagId: string) => {
    onTagChange(selectedTags.filter((id) => id !== tagId))
  }

  const handleCreateTag = async () => {
    if (!searchTerm.trim() || !allowCreation || !onTagCreate) return

    setIsCreating(true)
    try {
      await onTagCreate(searchTerm.trim())
      setSearchTerm('')
      setShowSuggestions(false)
    } catch (error) {
      console.error('Failed to create tag:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const selectedTagObjects = availableTags.filter((tag) => selectedTags.includes(tag.id))
  const canCreateTag =
    allowCreation &&
    searchTerm.trim() &&
    !availableTags.some((tag) => tag.name.toLowerCase() === searchTerm.toLowerCase())

  return (
    <div className="space-y-3">
      {/* Selected Tags */}
      {selectedTagObjects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTagObjects.map((tag) => (
            <Badge key={tag.id} variant="default" className="flex items-center gap-1 pr-1">
              <AccessibleIcon icon={TagIcon} className="h-3 w-3" />
              {tag.name}
              <button
                onClick={() => handleTagRemove(tag.id)}
                className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                aria-label={`Remove ${tag.name} tag`}
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Input
          value={searchTerm}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setSearchTerm(e.target.value)
            setShowSuggestions(true)
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="Search or add tags..."
          leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
          className="w-full"
        />

        {/* Suggestions Dropdown */}
        {showSuggestions && (searchTerm || filteredTags.length > 0) && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
            {/* Existing Tags */}
            {filteredTags.length > 0 && (
              <div className="py-1">
                <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide bg-gray-50">
                  Existing Tags
                </div>
                {filteredTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleTagSelect(tag.id)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
                  >
                    <span className="flex items-center">
                      <AccessibleIcon icon={TagIcon} className="h-4 w-4 mr-2 text-gray-400" />
                      {tag.name}
                    </span>
                    {tag.postsCount && (
                      <span className="text-xs text-gray-500">{tag.postsCount} posts</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Create New Tag */}
            {canCreateTag && (
              <div className="py-1 border-t border-gray-100">
                <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide bg-gray-50">
                  Create New
                </div>
                <button
                  onClick={handleCreateTag}
                  disabled={isCreating}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center text-blue-600 disabled:opacity-50"
                >
                  <AccessibleIcon icon={TagIcon} className="h-4 w-4 mr-2" />
                  Create "{searchTerm}"
                  {isCreating && <Loading variant="dots" size="sm" className="ml-2" />}
                </button>
              </div>
            )}

            {/* No Results */}
            {filteredTags.length === 0 && !canCreateTag && searchTerm && (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                No tags found matching "{searchTerm}"
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const BlogTagsInner: React.FC<BlogTagsProps> = ({
  selectedTags = [],
  availableTags = [],
  showPopularTags = true,
  maxPopularTags = 20,
  interactive = true,
  variant = 'default',
  maxDisplayTags,
  showCounts = false,
  allowCreation = false,
  onTagChange,
  onTagCreate,
  emptyStateMessage = 'No tags available',
  className = '',
}) => {
  const [popularTags, setPopularTags] = useState<PopularTag[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAllTags, setShowAllTags] = useState(false)

  // Load popular tags
  useEffect(() => {
    if (!showPopularTags) return

    const loadPopularTags = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // TODO: Replace with actual API call
        // const response = await fetchPopularTags({ limit: maxPopularTags })
        // setPopularTags(response)

        // Mock data for development
        setPopularTags([])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load popular tags')
      } finally {
        setIsLoading(false)
      }
    }

    loadPopularTags()
  }, [showPopularTags, maxPopularTags])

  const handleTagClick = (tagId: string) => {
    if (!interactive || !onTagChange) return

    const newSelectedTags = selectedTags.includes(tagId)
      ? selectedTags.filter((id) => id !== tagId)
      : [...selectedTags, tagId]

    onTagChange(newSelectedTags)
  }

  const displayTags = useMemo(() => {
    const tags = showPopularTags && popularTags.length > 0 ? popularTags : availableTags
    if (!maxDisplayTags || showAllTags) return tags
    return tags.slice(0, maxDisplayTags)
  }, [availableTags, popularTags, showPopularTags, maxDisplayTags, showAllTags])

  const hasMoreTags =
    maxDisplayTags && (showPopularTags ? popularTags.length : availableTags.length) > maxDisplayTags

  if (error) {
    return (
      <div className={`text-center py-4 ${className}`}>
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex flex-wrap gap-2">
          {[...Array(8)].map((_, i) => {
            const widthClass = i % 3 === 0 ? 'w-24' : i % 3 === 1 ? 'w-20' : 'w-16'
            return (
              <div key={i} className={`h-6 bg-gray-200 rounded-full animate-pulse ${widthClass}`} />
            )
          })}
        </div>
      </div>
    )
  }

  if (availableTags.length === 0 && popularTags.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <AccessibleIcon icon={TagIcon} className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500">{emptyStateMessage}</p>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Interactive Tag Input (for editors) */}
      {allowCreation && onTagChange && (
        <TagInput
          availableTags={availableTags}
          selectedTags={selectedTags}
          allowCreation={allowCreation}
          onTagChange={onTagChange}
          onTagCreate={onTagCreate}
        />
      )}

      {/* Tags Display */}
      {variant === 'cloud' ? (
        <TagCloud
          tags={displayTags}
          selectedTags={selectedTags}
          interactive={interactive}
          showCounts={showCounts}
          onTagClick={handleTagClick}
        />
      ) : variant === 'compact' ? (
        <div className="flex flex-wrap gap-1">
          {displayTags.map((tag) => {
            const isSelected = selectedTags.includes(tag.id)
            const count = 'count' in tag ? tag.count : 'postsCount' in tag ? tag.postsCount || 0 : 0

            return (
              <Badge
                key={tag.id}
                variant={isSelected ? 'info' : 'default'}
                className={`
                  text-xs
                  ${interactive ? 'cursor-pointer hover:opacity-80' : ''}
                `}
                onClick={() => interactive && handleTagClick(tag.id)}
              >
                #{tag.name}
                {showCounts && count > 0 && ` (${count})`}
              </Badge>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {displayTags.map((tag) => {
            const isSelected = selectedTags.includes(tag.id)
            const count = 'count' in tag ? tag.count : 'postsCount' in tag ? tag.postsCount || 0 : 0

            return (
              <Button
                key={tag.id}
                variant={isSelected ? 'primary' : 'outline'}
                size="sm"
                onClick={() => interactive && handleTagClick(tag.id)}
                disabled={!interactive}
                leftIcon={<TagIcon className="h-4 w-4" />}
                className={`
                  ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
                `}
              >
                {tag.name}
                {showCounts && count > 0 && (
                  <span className="ml-1 text-xs opacity-75">({count})</span>
                )}
              </Button>
            )
          })}
        </div>
      )}

      {/* Show More/Less Button */}
      {hasMoreTags && (
        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={() => setShowAllTags(!showAllTags)}>
            {showAllTags
              ? 'Show Less'
              : `Show ${(showPopularTags ? popularTags.length : availableTags.length) - maxDisplayTags!} More Tags`}
          </Button>
        </div>
      )}

      {/* Popular Tags Header */}
      {showPopularTags && popularTags.length > 0 && variant === 'default' && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Popular Tags</h4>
          <TagCloud
            tags={popularTags.slice(0, maxPopularTags)}
            selectedTags={selectedTags}
            interactive={interactive}
            showCounts={showCounts}
            onTagClick={handleTagClick}
          />
        </div>
      )}

      {/* Clear All Button */}
      {selectedTags.length > 0 && interactive && onTagChange && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onTagChange([])}
            leftIcon={<XMarkIcon className="h-4 w-4" />}
          >
            Clear All Filters
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * Blog Tags Component
 *
 * A flexible tag system supporting:
 * - Multiple display variants (default, compact, cloud)
 * - Interactive filtering and selection
 * - Popular tags display
 * - Tag creation for editors
 * - Search and autocomplete
 * - Accessibility features
 * - Loading and error states
 *
 * @example
 * ```tsx
 * <BlogTags
 *   selectedTags={selectedTagIds}
 *   availableTags={allTags}
 *   variant="cloud"
 *   interactive={true}
 *   showCounts={true}
 *   onTagChange={(tags) => setSelectedTags(tags)}
 * />
 * ```
 */
export const BlogTags: React.FC<BlogTagsProps> = (props) => {
  return (
    <ErrorBoundary>
      <BlogTagsInner {...props} />
    </ErrorBoundary>
  )
}

export default BlogTags
